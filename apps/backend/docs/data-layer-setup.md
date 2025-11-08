# Data Layer Setup Guide

This guide provides step-by-step instructions for setting up the data layer and caching infrastructure for the Codebase Onboarding Agent.

## Prerequisites

- PostgreSQL 12+ installed and running
- Redis 6+ installed and running
- S3-compatible storage (AWS S3 or MinIO) configured
- Node.js 18+ and npm installed

## Quick Start

### 1. Environment Configuration

Create or update your `.env` file with the following variables:

```env
# PostgreSQL Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=codebase_onboarding
DATABASE_USER=postgres
DATABASE_PASSWORD=your_secure_password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# S3/MinIO Configuration
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET=codebase-onboarding
```

### 2. Database Setup

Run the database migrations to create all required tables:

```bash
cd apps/backend
npm run migrate
```

This will create:
- User and tenant tables
- Session management tables
- Audit log tables (partitioned)
- Learning profiles table
- Cost tracking tables
- Voice session tables
- Template tables
- And more...

### 3. S3 Bucket Initialization

Initialize the S3 bucket with encryption and lifecycle policies:

```bash
npm run init:s3
```

This script will:
- Configure AES-256 encryption at rest
- Set up lifecycle policies for automatic data deletion
- Verify the configuration

### 4. Audit Log Partition Setup

Create initial audit log partitions:

```bash
npm run manage:audit-partitions
```

This should be run:
- Once during initial setup
- Monthly via cron job to create future partitions

### 5. Verify Setup

Run the verification script to ensure everything is configured correctly:

```bash
npm run verify:data-layer
```

## Detailed Setup Instructions

### PostgreSQL Setup

#### Create Database

```sql
CREATE DATABASE codebase_onboarding;
CREATE USER codebase_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE codebase_onboarding TO codebase_user;
```

#### Enable Required Extensions

```sql
\c codebase_onboarding
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

#### Run Migrations

The migration system will automatically run all migrations in order:

```bash
npm run migrate
```

Migrations included:
1. `001_create_auth_tables.sql` - Users, tenants, sessions
2. `002_create_audit_logs.sql` - Audit logging
3. `003_create_onboarding_sessions.sql` - Session management
4. `004_create_cost_tracking.sql` - Cost tracking
5. `005_create_template_tables.sql` - Template management
6. `006_create_voice_tables.sql` - Voice sessions
7. `008_complete_data_layer.sql` - Learning profiles, partitioning, etc.

### Redis Setup

#### Install Redis (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

#### Configure Redis

Edit `/etc/redis/redis.conf`:

```conf
# Set password
requirepass your_redis_password

# Set max memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Enable persistence
save 900 1
save 300 10
save 60 10000
```

Restart Redis:

```bash
sudo systemctl restart redis-server
```

#### Verify Redis Connection

```bash
redis-cli -a your_redis_password ping
# Should return: PONG
```

### S3/MinIO Setup

#### Option 1: Using MinIO (Local Development)

Install MinIO:

```bash
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/
```

Start MinIO:

```bash
mkdir -p ~/minio/data
minio server ~/minio/data --console-address ":9001"
```

Access MinIO Console at http://localhost:9001

Create bucket:
1. Login with default credentials (minioadmin/minioadmin)
2. Create bucket named "codebase-onboarding"
3. Generate access keys

#### Option 2: Using AWS S3

Create S3 bucket:

```bash
aws s3 mb s3://codebase-onboarding --region us-east-1
```

Create IAM user with S3 access:

```bash
aws iam create-user --user-name codebase-onboarding-app
aws iam attach-user-policy --user-name codebase-onboarding-app --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam create-access-key --user-name codebase-onboarding-app
```

#### Initialize Bucket

Run the initialization script:

```bash
npm run init:s3
```

This configures:
- AES-256 encryption at rest
- Lifecycle policies for automatic deletion
- Bucket structure

## Maintenance Tasks

### Daily Tasks

Monitor cache and database health:

```bash
npm run health:check
```

### Weekly Tasks

Review audit logs and storage usage:

```bash
npm run audit:stats
npm run storage:usage
```

### Monthly Tasks

Create new audit log partitions:

```bash
npm run manage:audit-partitions
```

Archive old data:

```bash
npm run archive:old-data
```

## Cron Job Setup

Add these to your crontab (`crontab -e`):

```cron
# Create audit log partitions monthly (1st of month at 2 AM)
0 2 1 * * cd /path/to/app/apps/backend && npm run manage:audit-partitions

# Health check daily (every day at 3 AM)
0 3 * * * cd /path/to/app/apps/backend && npm run health:check

# Archive old data weekly (Sunday at 4 AM)
0 4 * * 0 cd /path/to/app/apps/backend && npm run archive:old-data
```

## Monitoring

### Key Metrics to Monitor

1. **Redis**
   - Memory usage
   - Cache hit rate
   - Connection count
   - Eviction rate

2. **PostgreSQL**
   - Connection pool usage
   - Query performance
   - Partition sizes
   - Replication lag (if applicable)

3. **S3**
   - Storage usage by prefix
   - Request rate
   - Error rate
   - Lifecycle policy execution

### Monitoring Commands

Check Redis stats:

```bash
redis-cli -a your_password INFO stats
```

Check PostgreSQL connections:

```sql
SELECT count(*) FROM pg_stat_activity;
```

Check S3 bucket size:

```bash
aws s3 ls s3://codebase-onboarding --recursive --summarize
```

## Troubleshooting

### Database Connection Issues

Check PostgreSQL is running:

```bash
sudo systemctl status postgresql
```

Check connection:

```bash
psql -h localhost -U codebase_user -d codebase_onboarding
```

### Redis Connection Issues

Check Redis is running:

```bash
sudo systemctl status redis-server
```

Test connection:

```bash
redis-cli -a your_password ping
```

### S3 Connection Issues

Test MinIO connection:

```bash
curl http://localhost:9000/minio/health/live
```

Test AWS S3 connection:

```bash
aws s3 ls s3://codebase-onboarding
```

### Migration Issues

Reset migrations (WARNING: This will delete all data):

```bash
npm run migrate:reset
npm run migrate
```

Roll back last migration:

```bash
npm run migrate:rollback
```

## Performance Tuning

### PostgreSQL

Optimize for your workload in `postgresql.conf`:

```conf
# Memory
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB

# Connections
max_connections = 100

# Checkpoints
checkpoint_completion_target = 0.9
wal_buffers = 16MB

# Query Planning
random_page_cost = 1.1
effective_io_concurrency = 200
```

### Redis

Optimize Redis configuration:

```conf
# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Performance
tcp-backlog 511
timeout 0
tcp-keepalive 300

# Persistence (adjust based on needs)
save 900 1
save 300 10
save 60 10000
```

### S3/MinIO

For MinIO, increase performance:

```bash
# Use multiple drives
minio server /mnt/disk1 /mnt/disk2 /mnt/disk3 /mnt/disk4

# Increase cache
export MINIO_CACHE="on"
export MINIO_CACHE_DRIVES="/mnt/cache1,/mnt/cache2"
export MINIO_CACHE_QUOTA=80
```

## Backup and Recovery

### PostgreSQL Backup

Daily backup:

```bash
pg_dump -h localhost -U codebase_user codebase_onboarding > backup_$(date +%Y%m%d).sql
```

Restore:

```bash
psql -h localhost -U codebase_user codebase_onboarding < backup_20250108.sql
```

### Redis Backup

Redis automatically creates RDB snapshots based on save configuration.

Manual backup:

```bash
redis-cli -a your_password BGSAVE
cp /var/lib/redis/dump.rdb /backup/redis_$(date +%Y%m%d).rdb
```

### S3 Backup

Enable versioning:

```bash
aws s3api put-bucket-versioning --bucket codebase-onboarding --versioning-configuration Status=Enabled
```

Cross-region replication (optional):

```bash
aws s3api put-bucket-replication --bucket codebase-onboarding --replication-configuration file://replication.json
```

## Security Checklist

- [ ] PostgreSQL password is strong and unique
- [ ] Redis password is configured
- [ ] S3 bucket has encryption enabled
- [ ] Database connections use SSL/TLS
- [ ] Redis connections use SSL/TLS (if exposed)
- [ ] S3 bucket has proper IAM policies
- [ ] Audit logs are enabled and monitored
- [ ] Backup strategy is in place
- [ ] Monitoring and alerting configured
- [ ] Firewall rules restrict database access

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs in `apps/backend/logs/`
3. Check the implementation summary: `apps/backend/docs/task-11-implementation-summary.md`

