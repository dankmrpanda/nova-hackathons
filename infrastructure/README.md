# Infrastructure Overview

This directory contains deployment and infrastructure configuration for the Codebase Onboarding Agent.

**Note**: The AWS infrastructure (Terraform, CI/CD) is **optional** and only needed for production cloud deployment. For local development, you only need Docker Compose (see [LOCAL_SETUP.md](../LOCAL_SETUP.md)).

## What's Included

### 1. Docker Containers (Task 14.1)

**Location**: Root directory and `apps/` subdirectories

- **Frontend Container** (`apps/frontend/Dockerfile`)
  - Multi-stage build with Nginx
  - Optimized production build
  - Security headers configured
  - Health check endpoint
  - Gzip compression enabled

- **Backend API Container** (`apps/backend/Dockerfile`)
  - Multi-stage build for minimal image size
  - Non-root user for security
  - Production dependencies only
  - Health check endpoint

- **Worker Container** (`apps/backend/Dockerfile.worker`)
  - Optimized for analysis jobs
  - Docker-in-Docker support for sandboxing
  - Resource limits configured
  - Separate health check

- **Migration Container** (`apps/backend/Dockerfile.migrate`)
  - Database migration runner
  - One-time execution container
  - Minimal dependencies

**Build Scripts**:
- `scripts/build-images.sh` - Build all Docker images
- `scripts/push-images.sh` - Push images to registry
- `docker-compose.prod.yml` - Production Docker Compose configuration

### 2. CI/CD Pipeline (Task 14.2)

**Location**: `.github/workflows/`

- **CI Pipeline** (`ci.yml`)
  - Automated linting and formatting checks
  - Unit and integration tests
  - Security scanning (npm audit, Snyk)
  - Docker image builds
  - Code coverage reporting

- **Staging Deployment** (`deploy-staging.yml`)
  - Triggered on push to `develop` branch
  - Builds and pushes images to ECR
  - Container vulnerability scanning (Trivy)
  - Deploys to staging ECS cluster
  - Runs smoke tests
  - Slack notifications

- **Production Deployment** (`deploy-production.yml`)
  - Triggered on push to `main` or version tags
  - Requires manual approval
  - Blue-green deployment strategy
  - Database migrations
  - Integration tests
  - Automatic rollback on failure
  - Slack notifications

- **Security Scanning** (`security-scan.yml`)
  - Daily scheduled scans
  - Dependency scanning
  - Container scanning
  - Code scanning (CodeQL)
  - Secret scanning (Gitleaks)
  - Security alerts

### 3. Infrastructure as Code (Task 14.3)

**Location**: `infrastructure/terraform/`

Comprehensive Terraform configuration for AWS:

#### Core Infrastructure

- **VPC** (`vpc.tf`)
  - Multi-AZ setup with public, private, and database subnets
  - NAT gateways for outbound connectivity
  - VPC endpoints for AWS services
  - Route tables and associations

- **RDS PostgreSQL** (`rds.tf`)
  - Multi-AZ deployment for high availability
  - Automated backups (7-day retention)
  - Encryption at rest with KMS
  - Performance Insights enabled
  - CloudWatch alarms for CPU and storage

- **ElastiCache Redis** (`elasticache.tf`)
  - Multi-node cluster with automatic failover
  - Encryption at rest and in transit
  - Auth token enabled
  - CloudWatch logging
  - Alarms for CPU and memory

- **S3 Buckets** (`s3.tf`)
  - Artifacts bucket with lifecycle policies
  - Scripts bucket for interactive scripts
  - Templates bucket for shared templates
  - Encryption with KMS
  - Versioning enabled
  - Public access blocked

#### Application Infrastructure

- **ECS Cluster** (`ecs.tf`)
  - Fargate launch type
  - Container Insights enabled
  - Task definitions for backend, worker, and frontend
  - IAM roles for task execution and task access
  - CloudWatch log groups
  - Health checks configured

- **Application Load Balancer** (`alb.tf`)
  - HTTPS termination with ACM certificate
  - HTTP to HTTPS redirect
  - Target groups with health checks
  - Access logs to S3
  - CloudWatch alarms

- **ECR Repositories** (`ecr.tf`)
  - Separate repositories for each service
  - Image scanning on push
  - Encryption with KMS
  - Lifecycle policies to manage image retention

- **Secrets Management** (`secrets.tf`)
  - AWS Secrets Manager for API keys
  - KMS encryption
  - SNS topic for alerts
  - Email notifications

#### Configuration Files

- `main.tf` - Provider and backend configuration
- `variables.tf` - Input variables
- `outputs.tf` - Output values
- `terraform.tfvars.example` - Example configuration
- `README.md` - Detailed Terraform documentation

### 4. Auto-Scaling (Task 14.4)

**Location**: `infrastructure/terraform/autoscaling.tf`

#### ECS Auto-Scaling

**Backend Service**:
- CPU-based scaling (target: 70%)
- Memory-based scaling (target: 80%)
- Request count-based scaling (target: 1000 req/target)
- Min: 2 tasks, Max: 10 tasks
- Scale-out cooldown: 60s
- Scale-in cooldown: 300s

**Worker Service**:
- CPU-based scaling (target: 70%)
- Memory-based scaling (target: 80%)
- Session-based scaling (target: 50 sessions/worker)
- Min: 2 tasks, Max: 10 tasks
- Scale-out cooldown: 60s
- Scale-in cooldown: 300s

#### Scheduled Scaling

- Scale up at 8 AM UTC on weekdays (2x capacity)
- Scale down at 8 PM UTC on weekdays (normal capacity)

#### CloudWatch Alarms

- Alerts when services scale beyond 2x desired count
- SNS notifications for scaling events

#### Database Connection Pooling

**Location**: `apps/backend/src/db/pool.ts`

- PostgreSQL connection pool with configurable limits
- Min: 2 connections, Max: 20 connections
- Connection timeout: 5 seconds
- Idle timeout: 30 seconds
- Statement timeout: 30 seconds
- Keep-alive enabled
- SSL for production
- Health check function
- Graceful shutdown handling

#### Cache Warming Strategies

**Location**: `apps/backend/src/cache/warming.ts`

- Periodic cache warming (default: 5 minutes)
- Pre-loads frequently accessed data:
  - Tenant configurations
  - Agent flow metadata
  - Model pricing information
  - Template metadata
- Configurable TTLs per data type
- Cache invalidation strategies
- Graceful start/stop

## Deployment Guide

See `DEPLOYMENT.md` in the root directory for complete deployment instructions.

## Quick Start

### Local Development

```bash
# Start local services
npm run docker:up

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

### Build Docker Images

```bash
# Build all images
npm run docker:build

# Or use the script directly
./scripts/build-images.sh v1.0.0
```

### Deploy Infrastructure

```bash
# Initialize Terraform
npm run terraform:init

# Plan changes
npm run terraform:plan

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │   ALB   │ (HTTPS)
                    └────┬────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
   │Frontend │     │ Backend │     │ Worker  │
   │  (ECS)  │     │  (ECS)  │     │  (ECS)  │
   └─────────┘     └────┬────┘     └────┬────┘
                        │                │
        ┌───────────────┼────────────────┤
        │               │                │
   ┌────▼────┐     ┌───▼────┐      ┌───▼────┐
   │   RDS   │     │ Redis  │      │   S3   │
   │(Multi-AZ)│    │(Cluster)│     │(Buckets)│
   └─────────┘     └────────┘      └────────┘
```

## Monitoring and Observability

- **CloudWatch Logs**: All services log to CloudWatch
- **CloudWatch Metrics**: Custom and AWS metrics tracked
- **CloudWatch Alarms**: Configured for critical metrics
- **SNS Alerts**: Email notifications for alarms
- **Container Insights**: ECS performance monitoring
- **Performance Insights**: RDS query performance

## Security Features

- **Encryption at Rest**: KMS encryption for all data stores
- **Encryption in Transit**: TLS 1.3 for all connections
- **Secrets Management**: AWS Secrets Manager with KMS
- **Network Isolation**: Private subnets for application tier
- **Security Groups**: Least-privilege access rules
- **IAM Roles**: Task-specific permissions
- **Container Scanning**: Automated vulnerability scanning
- **Dependency Scanning**: Daily security scans

## Cost Optimization

- **Auto-scaling**: Scale down during low usage
- **Spot Instances**: Consider for non-critical workloads
- **Reserved Instances**: For stable production workloads
- **S3 Lifecycle Policies**: Automatic data archival
- **CloudWatch Log Retention**: 30-day retention
- **ECR Lifecycle Policies**: Automatic image cleanup

## Maintenance

- **Automated Backups**: Daily RDS backups (7-day retention)
- **Security Updates**: Automated scanning and alerts
- **Dependency Updates**: Dependabot configured
- **Infrastructure Updates**: Terraform state management
- **Monitoring**: CloudWatch dashboards and alarms

## Support

For deployment and infrastructure issues:
1. Check CloudWatch logs
2. Review GitHub Actions workflow logs
3. Verify AWS service health
4. Consult DEPLOYMENT.md
5. Contact DevOps team
