# Local Deployment Summary

## What Changed

The deployment infrastructure has been reconfigured to **run locally by default** using Docker Compose. AWS deployment is now optional and only needed for production cloud hosting.

## Local Setup (Primary Method)

### Quick Start
```bash
# Automated setup
./scripts/setup-local.sh  # macOS/Linux
scripts\setup-local.bat   # Windows

# Or using Make
make setup

# Or using npm
npm run setup
```

### What Gets Installed

**Infrastructure Services (Docker)**:
- PostgreSQL 16 (port 5432)
- Redis 7 (port 6379)
- MinIO (ports 9000, 9001)

**Application Services**:
- Backend API (Node.js/Express)
- Worker (Background jobs)
- Frontend (React)

### Development Workflow

**Option 1: Local Development (Recommended)**
```bash
# Start infrastructure only
npm run docker:dev

# Run apps locally for hot reload
cd apps/backend && npm run dev
cd apps/frontend && npm run dev
```

**Option 2: Full Docker**
```bash
# Everything in Docker
npm run docker:up
npm run docker:logs
```

## File Structure

### Local Development Files
```
├── docker-compose.yml          # Full stack (all services)
├── docker-compose.dev.yml      # Infrastructure only
├── .env.example                # Environment template
├── LOCAL_SETUP.md              # Detailed setup guide
├── QUICKSTART.md               # 5-minute quick start
├── README.md                   # Main documentation
├── Makefile                    # Convenience commands
└── scripts/
    ├── setup-local.sh          # Setup script (Unix)
    └── setup-local.bat         # Setup script (Windows)
```

### AWS Deployment Files (Optional)
```
├── DEPLOYMENT.md               # AWS deployment guide
├── infrastructure/
│   └── terraform/              # AWS infrastructure
├── .github/
│   └── workflows/              # CI/CD pipelines
├── docker-compose.prod.yml     # Production compose
└── scripts/
    ├── build-images.sh         # Build Docker images
    └── push-images.sh          # Push to registry
```

## Key Features

### Local Development
✅ **No AWS required** - Everything runs on your machine  
✅ **Fast setup** - Automated scripts handle everything  
✅ **Hot reload** - Changes reflect immediately  
✅ **Full feature parity** - Same features as production  
✅ **Easy cleanup** - One command to reset everything  

### Production Deployment (Optional)
✅ **AWS infrastructure** - Terraform for ECS, RDS, etc.  
✅ **CI/CD pipelines** - GitHub Actions workflows  
✅ **Auto-scaling** - ECS auto-scaling policies  
✅ **Monitoring** - CloudWatch dashboards and alarms  

## Common Commands

### Setup & Start
```bash
make setup              # Initial setup
make start              # Start services
make dev                # Start dev servers
npm run docker:dev      # Start infrastructure
```

### Development
```bash
npm run dev             # Start all apps
npm test                # Run tests
npm run lint            # Lint code
npm run format          # Format code
```

### Docker Management
```bash
npm run docker:logs     # View logs
npm run docker:down     # Stop services
npm run docker:clean    # Clean everything
make logs               # View logs (Make)
make stop               # Stop services (Make)
```

### Database
```bash
npm run migrate         # Run migrations
make migrate            # Run migrations (Make)
```

## Access Points

### Local Development
- Frontend: http://localhost:5173 (Vite dev server)
- Backend: http://localhost:3000
- Health: http://localhost:3000/health

### Docker Deployment
- Frontend: http://localhost
- Backend: http://localhost:3000
- Health: http://localhost:3000/health

### Infrastructure
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin)
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## Environment Configuration

### Required (Minimal Setup)
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/onboarding_agent
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
JWT_SECRET=local-dev-secret
```

### Optional (Full Features)
```bash
AIRIA_API_KEY=your-key
GITHUB_CLIENT_ID=your-id
GITHUB_CLIENT_SECRET=your-secret
RETELL_API_KEY=your-key
OPENROUTER_API_KEY=your-key
MODAL_TOKEN_ID=your-modal-token-id
MODAL_TOKEN_SECRET=your-modal-token-secret
```

## Troubleshooting

### Quick Fixes
```bash
# Reset everything
npm run docker:clean
npm run setup

# Check service health
make health
curl http://localhost:3000/health

# View logs
npm run docker:logs
```

### Port Conflicts
```bash
# Check what's using ports
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :3000  # Backend
```

## Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - 5-minute setup guide
- **[LOCAL_SETUP.md](LOCAL_SETUP.md)** - Detailed local development
- **[README.md](README.md)** - Project overview
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - AWS deployment (optional)
- **[infrastructure/README.md](infrastructure/README.md)** - Infrastructure details

## Migration from AWS-First to Local-First

### What Stayed the Same
- Docker containers and images
- Application code
- Database schema
- API endpoints

### What Changed
- **Default**: Local Docker Compose (was: AWS ECS)
- **Database**: Local PostgreSQL (was: RDS)
- **Cache**: Local Redis (was: ElastiCache)
- **Storage**: Local MinIO (was: S3)
- **Setup**: Automated scripts (was: Manual Terraform)

### AWS Deployment Still Available
All AWS infrastructure code is preserved in:
- `infrastructure/terraform/` - Terraform configs
- `.github/workflows/` - CI/CD pipelines
- `DEPLOYMENT.md` - Deployment guide

Use these when you're ready to deploy to production.

## Benefits of Local-First Approach

1. **Faster Onboarding** - New developers can start in minutes
2. **No Cloud Costs** - Develop without AWS charges
3. **Offline Development** - Work without internet
4. **Easier Debugging** - Direct access to all services
5. **Consistent Environment** - Same setup for everyone
6. **Production Parity** - Same services, different scale

## Next Steps

1. ✅ Run setup script
2. ✅ Start development servers
3. ✅ Access application
4. 📝 Configure API keys (optional)
5. 🔍 Explore the code
6. 🚀 Start building features
7. ☁️ Deploy to AWS when ready (optional)

## Support

- **Local Issues**: See [LOCAL_SETUP.md](LOCAL_SETUP.md)
- **AWS Deployment**: See [DEPLOYMENT.md](DEPLOYMENT.md)
- **Quick Help**: See [QUICKSTART.md](QUICKSTART.md)
