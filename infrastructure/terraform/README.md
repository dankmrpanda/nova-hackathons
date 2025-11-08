# Terraform Infrastructure

This directory contains Terraform configuration for deploying the Codebase Onboarding Agent infrastructure on AWS.

## Architecture

The infrastructure includes:

- **VPC**: Multi-AZ VPC with public, private, and database subnets
- **RDS PostgreSQL**: Multi-AZ database with encryption and automated backups
- **ElastiCache Redis**: Multi-node Redis cluster with encryption
- **S3**: Buckets for artifacts, scripts, and templates with lifecycle policies
- **ECS Fargate**: Container orchestration for backend, worker, and frontend services
- **ALB**: Application Load Balancer with HTTPS termination
- **ECR**: Container registries for Docker images
- **CloudWatch**: Logging and monitoring
- **Secrets Manager**: Secure storage for API keys and credentials
- **KMS**: Encryption keys for data at rest

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Terraform >= 1.0 installed
3. S3 bucket for Terraform state (update `main.tf` backend configuration)
4. DynamoDB table for state locking
5. ACM certificate for HTTPS

## Setup

### 1. Initialize Terraform

```bash
cd infrastructure/terraform
terraform init
```

### 2. Create Environment-Specific Variables

Copy the example file and customize for your environment:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your specific values:
- Database password
- Domain name
- Certificate ARN
- Resource sizing

### 3. Plan Deployment

Review the planned changes:

```bash
terraform plan
```

### 4. Apply Configuration

Deploy the infrastructure:

```bash
terraform apply
```

## Environments

### Staging

```bash
terraform workspace new staging
terraform workspace select staging
terraform apply -var-file="staging.tfvars"
```

### Production

```bash
terraform workspace new production
terraform workspace select production
terraform apply -var-file="production.tfvars"
```

## Post-Deployment

### 1. Update Secrets

After initial deployment, update the secrets in AWS Secrets Manager:

```bash
aws secretsmanager update-secret \
  --secret-id codebase-onboarding-staging-app-secrets \
  --secret-string '{
    "JWT_SECRET": "your-jwt-secret",
    "AIRIA_API_KEY": "your-airia-key",
    "GITHUB_CLIENT_ID": "your-github-client-id",
    "GITHUB_CLIENT_SECRET": "your-github-secret",
    "RETELL_API_KEY": "your-retell-key",
    "OPENROUTER_API_KEY": "your-openrouter-key",
    "MODAL_API_KEY": "your-modal-key"
  }'
```

### 2. Configure DNS

Point your domain to the ALB:

```bash
# Get ALB DNS name
terraform output alb_dns_name

# Create Route53 record or update your DNS provider
```

### 3. Run Database Migrations

```bash
aws ecs run-task \
  --cluster codebase-onboarding-staging \
  --task-definition codebase-onboarding-staging-migrate \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx]}"
```

## Monitoring

### CloudWatch Dashboards

Access CloudWatch dashboards for:
- ECS service metrics
- RDS performance
- Redis cache metrics
- ALB request metrics

### Alarms

The following alarms are configured:
- RDS CPU utilization > 80%
- RDS free storage < 10GB
- Redis CPU utilization > 75%
- Redis memory utilization > 80%
- ALB target response time > 2s
- ALB unhealthy hosts > 0
- S3 4xx errors > 10

Alerts are sent to the SNS topic configured in `secrets.tf`.

## Scaling

### Horizontal Scaling

Update desired count in `terraform.tfvars`:

```hcl
backend_desired_count = 4
worker_desired_count  = 4
```

Then apply:

```bash
terraform apply
```

### Vertical Scaling

Update instance sizes:

```hcl
database_instance_class = "db.r5.large"
redis_node_type        = "cache.r5.large"
ecs_backend_cpu        = 2048
ecs_backend_memory     = 4096
```

## Backup and Recovery

### RDS Backups

- Automated daily backups with 7-day retention
- Backup window: 03:00-04:00 UTC
- Point-in-time recovery enabled

### Disaster Recovery

To restore from backup:

```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier codebase-onboarding-staging-restored \
  --db-snapshot-identifier <snapshot-id>
```

## Cost Optimization

### Development Environment

For cost savings in development:

```hcl
database_instance_class = "db.t3.micro"
redis_node_type        = "cache.t3.micro"
redis_num_cache_nodes  = 1
backend_desired_count  = 1
worker_desired_count   = 1
```

### Production Recommendations

- Enable RDS Multi-AZ for high availability
- Use at least 2 AZs for ECS services
- Configure auto-scaling policies (see task 14.4)

## Security

### Encryption

- All data encrypted at rest using KMS
- TLS 1.3 for data in transit
- Secrets stored in AWS Secrets Manager

### Network Security

- Private subnets for application and database tiers
- Security groups with least-privilege access
- VPC endpoints for AWS services

### Compliance

- CloudWatch logs retained for 30 days
- Audit logs retained for 90 days
- Automated security scanning in CI/CD

## Troubleshooting

### ECS Tasks Not Starting

Check CloudWatch logs:

```bash
aws logs tail /ecs/codebase-onboarding-staging/backend --follow
```

### Database Connection Issues

Verify security group rules and connection string:

```bash
terraform output database_endpoint
```

### High Costs

Review CloudWatch metrics and consider:
- Reducing ECS task count
- Downsizing RDS/Redis instances
- Implementing S3 lifecycle policies

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning**: This will delete all data. Ensure backups are taken first.

## Support

For issues or questions:
- Check CloudWatch logs
- Review AWS service health dashboard
- Contact DevOps team
