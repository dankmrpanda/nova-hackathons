# Codebase Onboarding Agent - Setup Guide

This application helps developers understand and onboard to new codebases through AI-powered analysis, interactive walkthroughs, and visual animations.

## Features

- **GitHub Integration**: Link your GitHub account or analyze public repositories
- **AI-Powered Analysis**: Choose from multiple AI models (Claude, GPT-4, Llama) via OpenRouter
- **Interactive Results**: Explore architecture, features, data flow, and onboarding guides
- **Visual Animations**: Generate animated walkthroughs using Modal (optional)
- **Minimalistic UI**: Clean, dark-themed interface focused on code understanding

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed
- **Docker Desktop** installed and running
- **Git** installed

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd nova-hackathon
npm install
```

### 2. Set Up Environment Variables

#### Backend Configuration

Copy the example environment file:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Edit `apps/backend/.env` and configure:

**Required:**
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`: Create a GitHub OAuth App at https://github.com/settings/developers
  - Set callback URL to `http://localhost:3001/auth/callback`
- `OPENROUTER_API_KEY`: Get your key from https://openrouter.ai/
  - This is required for AI analysis

**Optional:**
- `MODAL_API_KEY`: For generating animated visualizations (get from https://modal.com/)

#### Frontend Configuration

```bash
cp apps/frontend/.env.example apps/frontend/.env
```

Edit `apps/frontend/.env`:

```env
VITE_GITHUB_CLIENT_ID=your_github_client_id
VITE_API_URL=http://localhost:3001
```

### 3. Start Infrastructure Services

Start PostgreSQL, Redis, and MinIO using Docker:

```bash
npm run docker:up
```

### 4. Run Database Migrations

```bash
npm run migrate
```

### 5. Start Development Servers

In separate terminals:

```bash
# Terminal 1: Backend
cd apps/backend
npm run dev

# Terminal 2: Frontend
cd apps/frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## How to Use

### For GitHub Users

1. Click "Connect GitHub Account" on the landing page
2. Authorize the application
3. Select a repository from your account
4. Choose an AI model (Claude 3.5 Sonnet recommended)
5. Optionally enable animations
6. Click "Start Analysis"
7. View comprehensive results including:
   - Architecture overview
   - Feature locations
   - Onboarding guide
   - Data flow diagrams
   - Confusion points and recommendations

### For Public Repositories

1. Paste any public GitHub repository URL
2. Click "Analyze Repository"
3. Choose an AI model
4. View analysis results

## AI Models Available

All models are accessed through OpenRouter:

- **Claude 3.5 Sonnet** (Recommended): Most intelligent, best for complex codebases
- **Claude 3 Opus**: Best for in-depth analysis
- **GPT-4o**: Optimized for speed and accuracy
- **Llama 3.1 405B**: Large open-source model

## Architecture

```
├── apps/
│   ├── backend/          # Express.js API server
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Business logic
│   │   └── db/          # Database migrations
│   └── frontend/         # React + Vite UI
│       ├── components/   # React components
│       └── src/         # Application code
├── packages/
│   └── shared/          # Shared types and utilities
└── infrastructure/      # Docker, Terraform configs
```

## Tech Stack

**Backend:**
- Node.js + Express
- PostgreSQL (database)
- Redis (caching)
- MinIO (S3-compatible storage)
- OpenRouter (AI model access)
- GitHub API (repository access)

**Frontend:**
- React 18
- React Router (navigation)
- Vite (build tool)
- Axios (HTTP client)

**AI & Integrations:**
- Agentuity-style analysis patterns
- AST parsing for code structure
- Modal for animation generation (optional)
- GitHub API for repository data

## Development

### Available Scripts

```bash
npm run dev          # Start all development servers
npm run build        # Build all packages
npm run docker:up    # Start infrastructure services
npm run docker:down  # Stop infrastructure services
npm run migrate      # Run database migrations
```

### Adding New Models

Edit `apps/backend/src/db/migrations/009_create_onboarding_agent_tables.sql` to add new model providers.

### Customizing Analysis

Modify `apps/backend/src/services/agentuity.service.ts` to customize the analysis prompts and structure.

## Troubleshooting

### Docker Services Not Starting

```bash
docker compose down -v
docker compose up -d
```

### Database Migration Errors

```bash
cd apps/backend
npm run migrate
```

### Build Errors

```bash
npm install
npm run build
```

### API Connection Issues

Ensure:
1. Backend is running on port 3001
2. Frontend proxy is configured in `vite.config.ts`
3. CORS is enabled in backend

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
- Open a GitHub issue
- Check existing documentation
- Review the code comments

## Roadmap

- [ ] Real-time collaboration features
- [ ] More animation types
- [ ] Integration with more AI providers
- [ ] Code execution sandbox
- [ ] Interactive tutorials
- [ ] Team templates and sharing
- [ ] VS Code extension

---

Built with ❤️ for developers who want to understand code faster.
