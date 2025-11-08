# AWS Deployment Guide

This guide covers deploying the Codebase Onboarding Agent to **AWS** using Docker, Terraform, and GitHub Actions.

**For local development**, see [LOCAL_SETUP.md](LOCAL_SETUP.md) instead.

**Note**: AWS deployment is optional. The application runs perfectly fine locally using Docker Compose.

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured
- Docker installed
- Terraform >= 1.0 installed
- GitHub repository with Actions enabled
- Domain name and SSL certificate

## Architecture Overview

The application is deployed on AWS using:
- **ECS Fargate** for container orchestration
- **RDS PostgreSQL** for database (Multi-AZ)
- **ElastiCache Redis** for caching
- **S3** for artifact storage
- **ALB** for load balancing
- **ECR** for container images
- **CloudWatch** for monitoring

## Deployment Steps

### 1. Infrastructure Setup

#### Create Terraform State Backend

```bash
# Create S3 bucket for Terraform state
aws s3 mb s3://codebase-onboarding-terraform-state --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket codebase-onboarding-terraform-state \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

#### Request SSL Certificate

```bash
# Request certificate from ACM
aws acm request-certificate \
  --domain-name codebase-onboarding.example.com \
  --subject-alternative-names *.codebase-onboarding.example.com \
  --validation-method DNS \
  --region us-east-1

# Note the certificate ARN for Terraform configuration
```

#### Deploy Infrastructure

```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Create workspace for staging
terraform workspace new staging
terraform workspace select staging

# Copy and customize variables
cp terraform.tfvars.example staging.tfvars
# Edit staging.tfvars with your values

# Plan deployment
terraform plan -var-file="staging.tfvars"

# Apply infrastructure
terraform apply -var-file="staging.tfvars"

# Save outputs
terraform output > outputs.txt
```

### 2. Configure Secrets

Update AWS Secrets Manager with actual API keys:

```bash
aws secretsmanager update-secret \
  --secret-id codebase-onboarding-staging-app-secrets \
  --secret-string '{
    "JWT_SECRET": "your-secure-jwt-secret-here",
    "AIRIA_API_KEY": "your-airia-api-key",
    "GITHUB_CLIENT_ID": "your-github-oauth-client-id",
    "GITHUB_CLIENT_SECRET": "your-github-oauth-client-secret",
    "RETELL_API_KEY": "your-retell-api-key",
    "OPENROUTER_API_KEY": "your-openrouter-api-key",
    "MODAL_TOKEN_ID": "your-modal-token-id",
    "MODAL_TOKEN_SECRET": "your-modal-token-secret"
  }' \
  --region us-east-1
```

### 3. Build and Push Docker Images

#### Manual Build

```bash
# Set environment variables
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_REGISTRY=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
export VERSION=v1.0.0

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_REGISTRY

# Build images
./scripts/build-images.sh $VERSION

# Tag for ECR
docker tag codebase-onboarding-frontend:$VERSION \
  $ECR_REGISTRY/codebase-onboarding-staging-frontend:$VERSION

docker tag codebase-onboarding-backend:$VERSION \
  $ECR_REGISTRY/codebase-onboarding-staging-backend:$VERSION

docker tag codebase-onboarding-worker:$VERSION \
  $ECR_REGISTRY/codebase-onboarding-staging-worker:$VERSION

docker tag codebase-onboarding-migrate:$VERSION \
  $ECR_REGISTRY/codebase-onboarding-staging-migrate:$VERSION

# Push to ECR
docker push $ECR_REGISTRY/codebase-onboarding-staging-frontend:$VERSION
docker push $ECR_REGISTRY/codebase-onboarding-staging-backend:$VERSION
docker push $ECR_REGISTRY/codebase-onboarding-staging-worker:$VERSION
docker push $ECR_REGISTRY/codebase-onboarding-staging-migrate:$VERSION
```

#### Using GitHub Actions

Configure GitHub secrets:

```bash
# Required secrets:
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
# - ECR_REGISTRY
# - SNYK_TOKEN (optional)
# - SLACK_WEBHOOK (optional)
```

Push to `develop` branch to trigger staging deployment:

```bash
git push origin develop
```

### 4. Run Database Migrations

```bash
# Get private subnet and security group IDs from Terraform outputs
PRIVATE_SUBNETS=$(terraform output -json private_subnet_ids | jq -r '.[]' | paste -sd,)
SECURITY_GROUP=$(terraform output -raw ecs_tasks_security_group_id)

# Run migration task
aws ecs run-task \
  --cluster codebase-onboarding-staging \
  --task-definition codebase-onboarding-staging-migrate \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNETS],securityGroups=[$SECURITY_GROUP],assignPublicIp=DISABLED}" \
  --region us-east-1

# Monitor migration logs
aws logs tail /ecs/codebase-onboarding-staging/migrate --follow
```

### 5. Configure DNS

Point your domain to the ALB:

```bash
# Get ALB DNS name
ALB_DNS=$(terraform output -raw alb_dns_name)
ALB_ZONE_ID=$(terraform output -raw alb_zone_id)

# Create Route53 record (if using Route53)
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "staging.codebase-onboarding.example.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "'$ALB_ZONE_ID'",
          "DNSName": "'$ALB_DNS'",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

### 6. Verify Deployment

```bash
# Check service health
curl https://staging.codebase-onboarding.example.com/health
curl https://staging.codebase-onboarding.example.com/api/health

# Check ECS services
aws ecs describe-services \
  --cluster codebase-onboarding-staging \
  --services codebase-onboarding-staging-backend \
  --region us-east-1

# Check CloudWatch logs
aws logs tail /ecs/codebase-onboarding-staging/backend --follow
```

## Production Deployment

### Prerequisites

- Staging environment tested and validated
- Production secrets configured
- Production domain and certificate ready
- Approval workflow configured in GitHub

### Steps

1. Create production workspace:

```bash
cd infrastructure/terraform
terraform workspace new production
terraform workspace select production
```

2. Deploy production infrastructure:

```bash
cp terraform.tfvars.example production.tfvars
# Edit production.tfvars with production values
terraform apply -var-file="production.tfvars"
```

3. Configure production secrets (same as staging)

4. Deploy via GitHub Actions:

```bash
# Tag release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Or push to main branch
git push origin main
```

5. Approve deployment in GitHub Actions UI

## Auto-Scaling Configuration

Auto-scaling is configured automatically via Terraform:

### Backend Service
- **CPU-based**: Target 70% CPU utilization
- **Memory-based**: Target 80% memory utilization
- **Request-based**: Target 1000 requests per target
- **Min**: 2 tasks, **Max**: 10 tasks

### Worker Service
- **CPU-based**: Target 70% CPU utilization
- **Memory-based**: Target 80% memory utilization
- **Session-based**: Target 50 active sessions per worker
- **Min**: 2 tasks, **Max**: 10 tasks

### Scheduled Scaling
- Scale up at 8 AM UTC on weekdays
- Scale down at 8 PM UTC on weekdays

## Monitoring

### CloudWatch Dashboards

Access dashboards at:
- https://console.aws.amazon.com/cloudwatch/

Key metrics:
- ECS service CPU/Memory utilization
- RDS performance metrics
- Redis cache hit rate
- ALB request count and latency
- Active sessions count

### Alarms

Configured alarms:
- RDS CPU > 80%
- RDS free storage < 10GB
- Redis CPU > 75%
- Redis memory > 80%
- ALB response time > 2s
- Unhealthy targets > 0

Alerts sent to SNS topic (configure email in Terraform)

## Rollback Procedures

### Automatic Rollback

GitHub Actions automatically rolls back on deployment failure.

### Manual Rollback

```bash
# Rollback to previous task definition
aws ecs update-service \
  --cluster codebase-onboarding-production \
  --service codebase-onboarding-production-backend \
  --task-definition codebase-onboarding-production-backend:PREVIOUS_REVISION \
  --force-new-deployment \
  --region us-east-1
```

### Database Rollback

```bash
# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier codebase-onboarding-production-restored \
  --db-snapshot-identifier SNAPSHOT_ID \
  --region us-east-1
```

## Troubleshooting

### ECS Tasks Failing to Start

1. Check CloudWatch logs:
```bash
aws logs tail /ecs/codebase-onboarding-staging/backend --follow
```

2. Verify secrets are configured correctly
3. Check security group rules
4. Verify task definition has correct image URIs

### Database Connection Issues

1. Verify security group allows ECS tasks to connect
2. Check database endpoint in task definition
3. Verify credentials in Secrets Manager
4. Check RDS instance status

### High Costs

1. Review CloudWatch metrics for resource usage
2. Adjust auto-scaling policies
3. Consider downsizing RDS/Redis instances
4. Review S3 lifecycle policies

### Performance Issues

1. Check RDS performance insights
2. Review Redis cache hit rate
3. Check ECS task CPU/Memory utilization
4. Review ALB target response times
5. Consider scaling up resources

## Maintenance

### Database Backups

- Automated daily backups with 7-day retention
- Manual snapshots before major changes
- Test restore procedures quarterly

### Security Updates

- Automated dependency scanning in CI/CD
- Container image scanning on push
- Monthly security patch reviews
- Quarterly penetration testing

### Cost Optimization

- Review CloudWatch cost metrics monthly
- Adjust auto-scaling policies based on usage
- Implement S3 lifecycle policies
- Consider Reserved Instances for stable workloads

## Support

For deployment issues:
1. Check CloudWatch logs
2. Review GitHub Actions workflow logs
3. Verify AWS service health dashboard
4. Contact DevOps team

## Additional Resources

- [Terraform Documentation](https://www.terraform.io/docs)
- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
