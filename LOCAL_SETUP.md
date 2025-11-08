# Local Development Setup

This guide covers running the Codebase Onboarding Agent locally using Docker Compose.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose v2.0+
- Node.js 18+ (for local development without Docker)
- Git

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd codebase-onboarding-agent

# Copy environment file
cp .env.example .env

# Edit .env with your API keys (optional for basic testing)
```

### 2. Start All Services

```bash
# Start all services with Docker Compose
npm run docker:up

# Or use docker-compose directly
docker-compose up -d
```

This will start:
- **PostgreSQL** on port 5432
- **Redis** on port 6379
- **MinIO** (S3-compatible) on ports 9000 (API) and 9001 (Console)
- **Backend API** on port 3000
- **Worker** for background jobs
- **Frontend** on port 80

### 3. Initialize Database

```bash
# Run database migrations
docker-compose exec backend npm run migrate

# Or if running locally
cd apps/backend
npm run migrate
```

### 4. Access the Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000
- **API Health**: http://localhost:3000/health
- **MinIO Console**: http://localhost:9001 (login: minioadmin/minioadmin)

### 5. View Logs

```bash
# View all logs
npm run docker:logs

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f worker
docker-compose logs -f frontend
```

### 6. Stop Services

```bash
# Stop all services
npm run docker:down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose down -v
```

## Development Workflow

### Option 1: Full Docker Development

All services run in Docker containers:

```bash
# Start services
docker-compose up -d

# Rebuild after code changes
docker-compose up -d --build

# View logs
docker-compose logs -f backend
```

### Option 2: Hybrid Development

Run infrastructure in Docker, but run backend/frontend locally for faster development:

```bash
# Start only infrastructure services
docker-compose up -d postgres redis minio

# Run backend locally
cd apps/backend
npm install
npm run dev

# Run frontend locally (in another terminal)
cd apps/frontend
npm install
npm run dev

# Run worker locally (in another terminal)
cd apps/backend
npm run worker
```

### Option 3: Full Local Development

Run everything locally without Docker:

```bash
# Install PostgreSQL, Redis locally
# Or use cloud services

# Install dependencies
npm install

# Set environment variables
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/onboarding_agent
export REDIS_URL=redis://localhost:6379

# Run migrations
cd apps/backend
npm run migrate

# Start backend
npm run dev

# Start frontend (in another terminal)
cd apps/frontend
npm run dev
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/onboarding_agent

# Redis
REDIS_URL=redis://localhost:6379

# S3 (MinIO)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=onboarding-artifacts

# JWT
JWT_SECRET=local-dev-secret-change-in-production

# External APIs (optional for testing)
AIRIA_API_URL=http://localhost:8080
AIRIA_API_KEY=your-airia-key
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
RETELL_API_KEY=your-retell-key
OPENROUTER_API_KEY=your-openrouter-key
MODAL_TOKEN_ID=your-modal-token-id
MODAL_TOKEN_SECRET=your-modal-token-secret
```

### MinIO Setup

1. Access MinIO Console at http://localhost:9001
2. Login with `minioadmin` / `minioadmin`
3. Create bucket named `onboarding-artifacts`
4. Set bucket policy to allow read/write

Or use the MinIO CLI:

```bash
# Install mc (MinIO Client)
# macOS: brew install minio/stable/mc
# Linux: wget https://dl.min.io/client/mc/release/linux-amd64/mc

# Configure mc
mc alias set local http://localhost:9000 minioadmin minioadmin

# Create bucket
mc mb local/onboarding-artifacts

# Set policy
mc anonymous set download local/onboarding-artifacts
```

## Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests for specific package
npm test --workspace=@codebase-onboarding/backend

# Run tests in watch mode (local development)
cd apps/backend
npm run test:watch
```

### Manual API Testing

```bash
# Health check
curl http://localhost:3000/health

# Create session (requires authentication)
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"repositoryUrl": "https://github.com/user/repo"}'
```

## Troubleshooting

### Services Won't Start

1. Check if ports are already in use:
```bash
# Check port 5432 (PostgreSQL)
lsof -i :5432

# Check port 6379 (Redis)
lsof -i :6379

# Check port 3000 (Backend)
lsof -i :3000
```

2. Check Docker logs:
```bash
docker-compose logs postgres
docker-compose logs redis
docker-compose logs backend
```

3. Restart services:
```bash
docker-compose restart
```

### Database Connection Issues

1. Verify PostgreSQL is running:
```bash
docker-compose ps postgres
```

2. Test connection:
```bash
docker-compose exec postgres psql -U postgres -d onboarding_agent -c "SELECT 1"
```

3. Check connection string in `.env`

### Redis Connection Issues

1. Verify Redis is running:
```bash
docker-compose ps redis
```

2. Test connection:
```bash
docker-compose exec redis redis-cli ping
```

### MinIO Issues

1. Verify MinIO is running:
```bash
docker-compose ps minio
```

2. Check bucket exists:
```bash
mc ls local/
```

3. Create bucket if missing:
```bash
mc mb local/onboarding-artifacts
```

### Build Failures

1. Clear Docker cache:
```bash
docker-compose down
docker system prune -a
docker-compose build --no-cache
docker-compose up -d
```

2. Check Dockerfile syntax
3. Verify all dependencies are in package.json

### Performance Issues

1. Increase Docker resources:
   - Docker Desktop → Settings → Resources
   - Increase CPU and Memory allocation

2. Check container resource usage:
```bash
docker stats
```

3. Optimize database queries:
```bash
# Check slow queries
docker-compose exec postgres psql -U postgres -d onboarding_agent -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10"
```

## Database Management

### Backup Database

```bash
# Backup to file
docker-compose exec postgres pg_dump -U postgres onboarding_agent > backup.sql

# Restore from file
docker-compose exec -T postgres psql -U postgres onboarding_agent < backup.sql
```

### Reset Database

```bash
# Drop and recreate database
docker-compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS onboarding_agent"
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE onboarding_agent"

# Run migrations
docker-compose exec backend npm run migrate
```

### Access Database Shell

```bash
# PostgreSQL shell
docker-compose exec postgres psql -U postgres -d onboarding_agent

# Redis CLI
docker-compose exec redis redis-cli
```

## Monitoring

### View Container Stats

```bash
# Real-time stats
docker stats

# Specific container
docker stats onboarding-backend
```

### Check Health

```bash
# All services
docker-compose ps

# Specific service health
curl http://localhost:3000/health
```

### View Logs

```bash
# All logs
docker-compose logs

# Follow logs
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

## Development Tips

### Hot Reload

For faster development, mount source code as volumes:

```yaml
# Add to docker-compose.yml
services:
  backend:
    volumes:
      - ./apps/backend/src:/app/apps/backend/src
    command: npm run dev
```

### Debug Mode

Enable debug logging:

```bash
# Set in .env
DEBUG=*
LOG_LEVEL=debug
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run build
```

## Cleaning Up

### Remove Containers

```bash
# Stop and remove containers
docker-compose down

# Remove containers and volumes
docker-compose down -v

# Remove containers, volumes, and images
docker-compose down -v --rmi all
```

### Free Up Space

```bash
# Remove unused Docker resources
docker system prune -a

# Remove specific volumes
docker volume rm codebase-onboarding-agent_postgres_data
```

## Next Steps

- Configure external API keys in `.env`
- Set up GitHub OAuth application
- Configure Airia integration
- Set up Retell AI for voice features
- Review security settings before production deployment

## Support

For local development issues:
1. Check Docker Desktop is running
2. Review logs: `docker-compose logs`
3. Verify environment variables in `.env`
4. Check port conflicts
5. Restart services: `docker-compose restart`

For production deployment, see `DEPLOYMENT.md`.
