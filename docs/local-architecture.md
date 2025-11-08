# Local Development Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Local Machine                        │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Docker Compose Network                     │ │
│  │                                                         │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │ │
│  │  │PostgreSQL│  │  Redis   │  │  MinIO   │            │ │
│  │  │  :5432   │  │  :6379   │  │:9000/9001│            │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘            │ │
│  │       │             │             │                    │ │
│  │       └─────────────┼─────────────┘                    │ │
│  │                     │                                   │ │
│  │  ┌──────────────────┴──────────────────┐              │ │
│  │  │         Backend API (:3000)         │              │ │
│  │  │  - Express.js                       │              │ │
│  │  │  - REST API                         │              │ │
│  │  │  - Business Logic                   │              │ │
│  │  └──────────────────┬──────────────────┘              │ │
│  │                     │                                   │ │
│  │  ┌──────────────────┴──────────────────┐              │ │
│  │  │         Worker Service              │              │ │
│  │  │  - Background Jobs                  │              │ │
│  │  │  - Repository Analysis              │              │ │
│  │  └─────────────────────────────────────┘              │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │         Frontend (React) - :5173 or :80                 │ │
│  │  - Vite Dev Server (local) or Nginx (Docker)           │ │
│  │  - React 18                                             │ │
│  │  - React Router                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Development Modes

### Mode 1: Hybrid (Recommended)

**Infrastructure in Docker, Apps running locally**

```
Docker Compose (docker-compose.dev.yml)
├── PostgreSQL (container)
├── Redis (container)
└── MinIO (container)

Local Processes
├── Backend (npm run dev) - Hot reload enabled
├── Frontend (npm run dev) - Hot reload enabled
└── Worker (npm run worker) - Optional
```

**Advantages**:
- ✅ Fast hot reload
- ✅ Easy debugging
- ✅ Direct code access
- ✅ IDE integration

**Start**:
```bash
npm run docker:dev          # Start infrastructure
cd apps/backend && npm run dev
cd apps/frontend && npm run dev
```

### Mode 2: Full Docker

**Everything in Docker containers**

```
Docker Compose (docker-compose.yml)
├── PostgreSQL (container)
├── Redis (container)
├── MinIO (container)
├── Backend (container)
├── Worker (container)
└── Frontend (container)
```

**Advantages**:
- ✅ Production-like environment
- ✅ Consistent across machines
- ✅ Easy to share
- ✅ No local dependencies

**Start**:
```bash
npm run docker:up
```

### Mode 3: Full Local

**Everything running locally (no Docker)**

```
Local Services
├── PostgreSQL (installed locally)
├── Redis (installed locally)
├── Backend (npm run dev)
├── Frontend (npm run dev)
└── Worker (npm run worker)
```

**Advantages**:
- ✅ No Docker overhead
- ✅ Maximum performance
- ✅ Direct access to all services

**Requirements**:
- PostgreSQL 16 installed
- Redis 7 installed
- Node.js 18+

## Data Flow

### Repository Analysis Flow

```
1. User Request
   │
   ├─→ Frontend (React)
   │   └─→ HTTP Request
   │
2. Backend API
   │
   ├─→ Validate & Authenticate
   │
   ├─→ Create Session (PostgreSQL)
   │
   ├─→ Queue Analysis Job (Redis)
   │
3. Worker Process
   │
   ├─→ Fetch Repository (GitHub API)
   │
   ├─→ Analyze Code (Airia/OpenRouter)
   │
   ├─→ Generate Diagrams (Modal)
   │
   ├─→ Store Artifacts (MinIO)
   │
   └─→ Update Session (PostgreSQL)
   
4. Frontend Polling
   │
   └─→ Display Results
```

### Voice Interaction Flow

```
1. User Voice Input
   │
   ├─→ Frontend (WebRTC)
   │
2. Retell AI
   │
   ├─→ Speech-to-Text
   │
   ├─→ Backend API
   │   │
   │   ├─→ Airia (Policy Check)
   │   │
   │   └─→ OpenRouter (LLM Response)
   │
   ├─→ Text-to-Speech
   │
3. Frontend Audio Output
```

## Storage Layout

### PostgreSQL (Database)

```
onboarding_agent/
├── users
├── tenants
├── sessions
├── repositories
├── artifacts
├── templates
├── audit_logs
└── learning_profiles
```

### Redis (Cache)

```
Keys:
├── session:{id}              # Session state
├── user:{id}:profile         # User profiles
├── tenant:{id}:config        # Tenant configs
├── agent-flow:{id}:metadata  # Agent flows
├── models:pricing            # Model pricing
└── template:{id}:metadata    # Templates
```

### MinIO (Object Storage)

```
Buckets:
└── onboarding-artifacts/
    ├── raw/                  # Temporary (24h TTL)
    ├── intermediate/         # Temporary (24h TTL)
    ├── sanitized/            # Long-term
    ├── scripts/              # Interactive scripts
    └── templates/            # Shared templates
```

## Port Mapping

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| PostgreSQL | 5432 | TCP | Database |
| Redis | 6379 | TCP | Cache |
| MinIO API | 9000 | HTTP | S3-compatible storage |
| MinIO Console | 9001 | HTTP | Admin UI |
| Backend API | 3000 | HTTP | REST API |
| Frontend (Dev) | 5173 | HTTP | Vite dev server |
| Frontend (Docker) | 80 | HTTP | Nginx |

## Environment Variables

### Required
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/onboarding_agent
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
JWT_SECRET=local-dev-secret
```

### Optional (External APIs)
```bash
AIRIA_API_KEY=your-key
GITHUB_CLIENT_ID=your-id
GITHUB_CLIENT_SECRET=your-secret
RETELL_API_KEY=your-key
OPENROUTER_API_KEY=your-key
MODAL_API_KEY=your-key
```

## Resource Requirements

### Minimum
- **CPU**: 2 cores
- **RAM**: 4 GB
- **Disk**: 10 GB

### Recommended
- **CPU**: 4 cores
- **RAM**: 8 GB
- **Disk**: 20 GB

### Docker Resource Allocation
```yaml
PostgreSQL: 512 MB RAM
Redis: 256 MB RAM
MinIO: 512 MB RAM
Backend: 1 GB RAM
Worker: 2 GB RAM
Frontend: 512 MB RAM
```

## Network Configuration

### Docker Network
```yaml
Name: onboarding-network
Driver: bridge
Subnet: 172.18.0.0/16
```

### Service Discovery
Services communicate using Docker DNS:
- `postgres:5432`
- `redis:6379`
- `minio:9000`
- `backend:3000`

### External Access
All services exposed to host:
- `localhost:5432` → PostgreSQL
- `localhost:6379` → Redis
- `localhost:9000` → MinIO
- `localhost:3000` → Backend

## Security Considerations

### Local Development
- ⚠️ Default passwords (change for production)
- ⚠️ No SSL/TLS (use HTTPS in production)
- ⚠️ Open ports (firewall in production)
- ⚠️ Debug logging (disable in production)

### Production Differences
- ✅ Strong passwords
- ✅ SSL/TLS encryption
- ✅ Network isolation
- ✅ Structured logging
- ✅ Secret management
- ✅ Access controls

## Monitoring

### Health Checks
```bash
# Backend
curl http://localhost:3000/health

# PostgreSQL
docker exec onboarding-postgres-dev pg_isready

# Redis
docker exec onboarding-redis-dev redis-cli ping

# MinIO
curl http://localhost:9000/minio/health/live
```

### Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f backend

# Application logs
cd apps/backend && npm run dev  # Console output
```

### Metrics
```bash
# Docker stats
docker stats

# Database connections
docker exec onboarding-postgres-dev psql -U postgres -c "SELECT count(*) FROM pg_stat_activity"

# Redis info
docker exec onboarding-redis-dev redis-cli info
```

## Troubleshooting

### Common Issues

**Port Already in Use**
```bash
lsof -i :5432  # Find process
kill -9 <PID>  # Kill process
```

**Database Connection Failed**
```bash
docker-compose restart postgres
docker-compose logs postgres
```

**Out of Memory**
```bash
docker system prune -a  # Clean up
# Increase Docker memory in settings
```

**Slow Performance**
```bash
docker stats  # Check resource usage
# Increase Docker CPU/RAM allocation
```

## Next Steps

1. ✅ Understand the architecture
2. 📝 Review [LOCAL_SETUP.md](../LOCAL_SETUP.md)
3. 🚀 Start development
4. 🔍 Explore the code
5. 🧪 Write tests
6. 📊 Monitor performance
