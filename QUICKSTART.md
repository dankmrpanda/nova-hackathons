# Quick Start Guide

Get the Codebase Onboarding Agent running locally in 5 minutes.

## Prerequisites

✅ Docker Desktop installed and running  
✅ Node.js 18+ installed  
✅ Git installed  

## Setup (One-time)

### macOS/Linux
```bash
git clone <repository-url>
cd codebase-onboarding-agent
chmod +x scripts/setup-local.sh
./scripts/setup-local.sh
```

### Windows
```bash
git clone <repository-url>
cd codebase-onboarding-agent
scripts\setup-local.bat
```

### Using Make (macOS/Linux)
```bash
git clone <repository-url>
cd codebase-onboarding-agent
make setup
```

## Daily Development

### Start Development Servers

**Terminal 1 - Backend:**
```bash
cd apps/backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd apps/frontend
npm run dev
```

Or use Make:
```bash
make dev
```

### Access Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- MinIO Console: http://localhost:9001

## Common Commands

```bash
# Start infrastructure
npm run docker:dev

# Stop infrastructure
npm run docker:dev:down

# View logs
npm run docker:logs

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format

# Clean everything
npm run docker:clean
```

## Using Make

```bash
make setup      # Initial setup
make start      # Start services
make stop       # Stop services
make logs       # View logs
make dev        # Start dev servers
make test       # Run tests
make clean      # Clean up
make help       # Show all commands
```

## Troubleshooting

### Services won't start
```bash
npm run docker:clean
npm run docker:dev
```

### Port conflicts
```bash
# Check what's using ports
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :3000  # Backend
```

### Database issues
```bash
# Reset database
npm run docker:clean
npm run setup
```

### Need help?
See [LOCAL_SETUP.md](LOCAL_SETUP.md) for detailed troubleshooting.

## What's Running?

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache |
| MinIO | 9000 | S3-compatible storage |
| MinIO Console | 9001 | Storage admin UI |
| Backend API | 3000 | REST API |
| Frontend | 5173 | React app (dev) |

## Next Steps

1. ✅ Services running? Check http://localhost:3000/health
2. 📝 Configure API keys in `.env`:
   - Modal credentials are already set (for diagram generation)
   - Add GitHub OAuth, Airia, Retell, OpenRouter keys as needed
3. 🔍 Explore the code in `apps/backend` and `apps/frontend`
4. 📚 Read [LOCAL_SETUP.md](LOCAL_SETUP.md) for more details
5. 🎨 See [docs/modal-setup.md](docs/modal-setup.md) for Modal configuration
6. 🚀 Start building!

## Production Deployment

For AWS deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).

**Note**: AWS deployment is optional. The app works great locally!
