# CodeMap - AI-Powered Codebase Onboarding

An intelligent system that helps developers understand and onboard to new codebases through AI-powered analysis, interactive walkthroughs, and visual animations.

**🚀 [Setup Guide](SETUP_GUIDE.md)**

## Features

- � **GitHub Integration** - Connect your GitHub account or analyze any public repository
- 🤖 **AI-Powered Analysis** - Deep code analysis using Claude, GPT-4, Llama, and more via OpenRouter
- �️ **Architecture Insights** - Understand system design, patterns, and component relationships
- � **Feature Mapping** - Discover where features live and how they work
- � **Data Flow Tracing** - Visualize how data moves through the system
- � **Animated Walkthroughs** - Generate visual animations using Modal (optional)
- � **Interactive Onboarding** - Step-by-step guides tailored to the codebase
- ⚠️ **Confusion Detection** - Identifies and explains potentially confusing patterns
- 🎨 **Minimalistic UI** - Clean, focused interface optimized for code exploration

## What Makes This Different?

Unlike traditional code documentation tools, CodeMap:

- **Understands Context**: Uses AI to understand not just what the code does, but *why* decisions were made
- **Interactive Learning**: Remembers what you've learned and adapts explanations
- **Vibe Coding Ready**: Walks you through the codebase interactively, perfect for getting into the flow
- **Visual First**: Generates diagrams and animations to visualize architecture and data flow
- **Model Agnostic**: Choose the AI model that works best for your needs and budget

## Quick Start

See the [Setup Guide](SETUP_GUIDE.md) for detailed instructions.

**TL;DR:**

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp apps/backend/.env.example apps/backend/.env
# Edit .env with your GitHub OAuth and OpenRouter API keys

# 3. Start services
npm run docker:up
npm run migrate

# 4. Run dev servers
cd apps/backend && npm run dev   # Terminal 1
cd apps/frontend && npm run dev  # Terminal 2

# 5. Open http://localhost:3000
```

## How It Works

1. **Connect Repository**: Link your GitHub account or paste a public repo URL
2. **Select Model**: Choose from Claude 3.5 Sonnet, GPT-4o, Llama, and more
3. **Analyze**: AI examines code structure, patterns, git history, and architecture
4. **Explore Results**: Interactive interface showing:
   - Architecture overview and patterns
   - Feature locations and descriptions
   - Data flow diagrams
   - Onboarding guide with steps
   - Confusion points and clarifications
   - Recommendations for improvement
5. **Optional Animation**: Generate visual walkthroughs using Modal

## Use Cases

- 🆕 **New Team Members**: Get up to speed on unfamiliar codebases quickly
- 🔍 **Code Review**: Understand PRs in projects you don't know well
- 📖 **Documentation**: Auto-generate onboarding docs from code analysis
- 🎓 **Learning**: Study open-source projects with AI guidance
- 🏗️ **Architecture Review**: Visualize and understand system design decisions
- 🔄 **Migration Planning**: Understand legacy code before refactoring

```bash
# Clone the repository
git clone <repository-url>
cd codebase-onboarding-agent

# Copy environment file
cp .env.example .env

# Install dependencies
npm install

# Start infrastructure services
npm run docker:dev

# Wait a few seconds, then run migrations
npm run migrate
```

### 3. Start Development

**Option A: Run apps locally (Recommended for development)**

```bash
# Infrastructure is already running from setup
# Start backend
cd apps/backend
npm run dev

# In another terminal, start frontend
cd apps/frontend
npm run dev
```

**Option B: Run everything in Docker**

```bash
# Start all services (infrastructure + application)
npm run docker:up

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

### 4. Access the Application

When running locally:
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend API**: http://localhost:3000
- **API Health**: http://localhost:3000/health

When running in Docker:
- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000
- **API Health**: http://localhost:3000/health

Always available:
- **MinIO Console**: http://localhost:9001 (login: minioadmin/minioadmin)
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Project Structure

```
codebase-onboarding-agent/
├── apps/
│   ├── backend/          # Express.js API server
│   │   ├── src/
│   │   │   ├── routes/   # API routes
│   │   │   ├── services/ # Business logic
│   │   │   ├── db/       # Database and migrations
│   │   │   └── cache/    # Redis caching
│   │   └── Dockerfile
│   └── frontend/         # React frontend
│       ├── src/
│       └── Dockerfile
├── packages/
│   └── shared/           # Shared types and utilities
├── infrastructure/
│   └── terraform/        # AWS infrastructure (optional)
├── .github/
│   └── workflows/        # CI/CD pipelines (optional)
├── docker-compose.yml    # Full stack deployment
├── docker-compose.dev.yml # Development infrastructure only
└── LOCAL_SETUP.md        # Detailed local setup guide
```

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start all apps in development mode
npm run docker:dev       # Start infrastructure only
npm run docker:up        # Start full stack in Docker

# Building
npm run build            # Build all apps
npm run docker:build     # Build Docker images
npm run docker:rebuild   # Rebuild and restart containers

# Testing
npm test                 # Run all tests
npm run lint             # Lint code
npm run format           # Format code

# Database
npm run migrate          # Run database migrations

# Cleanup
npm run docker:down      # Stop containers
npm run docker:clean     # Stop and remove volumes
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required for basic functionality
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/onboarding_agent
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
JWT_SECRET=your-secret-key

# Optional - for full features
AIRIA_API_KEY=your-airia-key
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
RETELL_API_KEY=your-retell-key
OPENROUTER_API_KEY=your-openrouter-key
MODAL_TOKEN_ID=your-modal-token-id
MODAL_TOKEN_SECRET=your-modal-token-secret
```

## Architecture

### Technology Stack

**Backend**:
- Node.js + Express.js
- PostgreSQL (database)
- Redis (caching)
- MinIO (S3-compatible storage)

**Frontend**:
- React 18
- React Router
- Axios

**Infrastructure**:
- Docker & Docker Compose
- Nginx (reverse proxy)
- Terraform (optional, for AWS deployment)

**External Services**:
- Airia (LLM governance and routing)
- Retell AI (voice interactions)
- OpenRouter (LLM access)
- Modal (diagram generation)
- GitHub OAuth (authentication)

### Key Components

1. **Analysis Orchestrator** - Coordinates repository analysis workflows
2. **Session Manager** - Manages onboarding sessions and state
3. **Artifact Manager** - Handles sanitized artifacts and storage
4. **Voice Integration** - Retell AI voice interaction layer
5. **Diagram Generator** - Modal-based architecture visualization
6. **Policy Engine** - Airia governance and cost management

## Testing

```bash
# Run all tests
npm test

# Run tests for specific package
npm test --workspace=@codebase-onboarding/backend

# Run tests in watch mode
cd apps/backend
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## Documentation

- **[LOCAL_SETUP.md](LOCAL_SETUP.md)** - Detailed local development guide
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide (AWS)
- **[infrastructure/README.md](infrastructure/README.md)** - Infrastructure overview
- **[.kiro/specs/](./kiro/specs/)** - Feature specifications and requirements

## Troubleshooting

### Services won't start

```bash
# Check if ports are in use
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :3000  # Backend

# Restart services
npm run docker:down
npm run docker:up
```

### Database connection issues

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection
docker exec -it onboarding-postgres psql -U postgres -d onboarding_agent -c "SELECT 1"

# Reset database
npm run docker:clean
npm run setup
```

### Build failures

```bash
# Clear Docker cache
docker system prune -a

# Rebuild from scratch
npm run docker:clean
npm run docker:build
npm run docker:up
```

See [LOCAL_SETUP.md](LOCAL_SETUP.md) for more troubleshooting tips.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Quality

```bash
# Before committing
npm run lint          # Check for linting errors
npm run format        # Format code
npm test             # Run tests
npm run build        # Ensure builds succeed
```

## Security

- All data encrypted at rest and in transit
- Multi-tenant isolation at database and application level
- RBAC with least-privilege access
- Sanitized artifacts (no raw code in long-term storage)
- Configurable data retention policies
- SSO/OIDC authentication with optional MFA

## License

[Your License Here]

## Support

For issues and questions:
- Check [LOCAL_SETUP.md](LOCAL_SETUP.md) for local development
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
- Review logs: `npm run docker:logs`
- Open an issue on GitHub

## Roadmap

- [ ] Enhanced voice interaction features
- [ ] Additional diagram types
- [ ] Plugin system for custom analyzers
- [ ] Mobile app support
- [ ] Real-time collaboration features
- [ ] Advanced analytics dashboard

## Acknowledgments

Built with:
- [Airia](https://airia.com) - LLM governance
- [Retell AI](https://retell.ai) - Voice interactions
- [OpenRouter](https://openrouter.ai) - LLM access
- [Modal](https://modal.com) - Serverless compute
