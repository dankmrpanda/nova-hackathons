# CodeMap - AI-Powered Codebase Onboarding

An intelligent system that helps developers understand and onboard to new codebases through AI-powered analysis, interactive chat assistance, and comprehensive repository insights.

## ✨ Features

### 🔍 Public Repository Analysis
- **Instant Analysis** - Analyze any public GitHub repository without authentication
- **AI-Powered Insights** - Get comprehensive architecture detection, technology stack identification, and onboarding recommendations
- **Interactive Chat** - Ask questions about the repository and get AI-powered answers
- **Real-Time Stats** - View live repository statistics (stars, forks, open issues, file count)

### 🤖 AI Intelligence
- **Smart Architecture Detection** - Automatically identifies full-stack, microservices, monorepo, MVC, and component-based architectures
- **Technology Stack Analysis** - Recognizes frameworks, build tools, and development patterns
- **Onboarding Path Generation** - Creates step-by-step guides with 8 detailed phases
- **Rule-Based Fallback** - Works even without external LLM APIs using intelligent pattern matching

### 💬 Interactive Features
- **Conversational AI Assistant** - Chat with an AI that understands your repository context
- **Suggested Questions** - Quick-start questions to explore common aspects
- **Real-Time Responses** - Fast, context-aware answers about code structure and implementation

### 🎨 Modern UI/UX
- **Beautiful Gradients** - Professional purple-to-pink gradient theme
- **Responsive Design** - Works seamlessly on desktop and mobile
- **Clean Typography** - Inter font for UI, JetBrains Mono for code
- **Smooth Animations** - Polished interactions and transitions

## 🚀 What Makes This Different?

Unlike traditional code documentation tools, CodeMap:

- **Zero Auth Required** - Analyze public repositories instantly without GitHub login
- **Intelligent Fallbacks** - Works with or without external AI APIs
- If you use the CLI, you can use private repositories as well, and it creates a comprehensive summary without the use of AI
- **Comprehensive Analysis** - Goes beyond basic stats to understand architecture and patterns

## 🎯 Quick Start

### Development Setup (Recommended)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (minimal setup)
cd apps/backend
cp .env.example .env
# Add your API keys (optional - works without them using fallbacks):
# - OPENROUTER_API_KEY (for advanced AI analysis)
# - GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET (for private repos)

# 3. Start both servers (from root directory)
npm run dev
```

The application will start:
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:5173

### Quick Test

1. Open http://localhost:5173
2. Enter any public GitHub repository URL (e.g., `https://github.com/facebook/react`)
3. Click "Analyze Repository"
4. View comprehensive analysis and chat with the AI about the codebase!

### Environment Variables

**Required:**
- None! The app works out of the box with in-memory storage and rule-based AI.

**Optional (for enhanced features):**
- `OPENROUTER_API_KEY` - Enables advanced AI analysis with Claude, GPT-4, etc.
- `GITHUB_CLIENT_ID` & `GITHUB_CLIENT_SECRET` - For analyzing private repositories
- `GITHUB_TOKEN` - Personal access token for higher API rate limits

**Development:**
- `REDIS_DISABLED=true` - Uses in-memory storage (default for local dev)
- `PORT=3001` - Backend server port (default)

## 🔧 How It Works

### 1. Repository Analysis
Paste any public GitHub repository URL. The system:
- Fetches repository metadata and file structure
- Analyzes code patterns and architecture
- Identifies technologies, frameworks, and build tools
- Generates comprehensive statistics

### 2. AI Processing
The analysis engine:
- **With API Keys**: Routes to advanced LLMs (Claude, GPT-4, Llama via OpenRouter)
- **Without API Keys**: Uses intelligent rule-based analysis
- Detects architecture patterns (microservices, monorepo, MVC, etc.)
- Identifies tech stack and provides detailed insights

### 3. Interactive Exploration
- **Visual Dashboard**: View stats, architecture, and project structure
- **AI Chat Interface**: Ask questions like:
  - "What's the main purpose of this project?"
  - "How do I set up the development environment?"
  - "Where is the authentication logic?"
  - "What testing frameworks are used?"
- **Suggested Questions**: Quick-start prompts for common queries
- **8-Step Onboarding Path**: From reading docs to making your first contribution

## 💡 Use Cases

- 🆕 **Onboard to Open Source**: Understand any public repository instantly
- 🎓 **Learn by Exploration**: Study popular projects with AI guidance
- � **Pre-Interview Research**: Understand a company's tech stack before interviews
- 📊 **Technology Research**: Compare architectures and patterns across projects
- 🏗️ **Architecture Study**: Learn design patterns from real-world code
- 📖 **Documentation Alternative**: Get answers without reading through docs
- 🤝 **Contribution Planning**: Understand where and how to contribute

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- React 19 with TypeScript
- Vite (development server)
- Modern CSS with gradient themes
- Responsive design

**Backend:**
- Node.js with Express
- TypeScript
- In-memory storage (Map-based caching)
- GitHub REST API integration
- OpenRouter API for LLM routing (optional)

**AI/Analysis:**
- Intelligent rule-based analysis (no API required)
- Optional LLM integration via OpenRouter (Claude, GPT-4, Llama)
- Architecture pattern detection
- Technology stack identification

### Key Features

✅ **Zero Dependencies** - Works without Redis, external databases, or mandatory API keys  
✅ **Fast Setup** - Just `npm install && npm run dev`  
✅ **Smart Fallbacks** - Gracefully degrades when external services unavailable  
✅ **Port Management** - Backend on 3001, Frontend on 5173 (no conflicts)  
✅ **Clean Code** - TypeScript throughout, modern patterns

## 📁 Access the Application

**Local Development:**
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

**API Endpoints:**
- `POST /api/github-integration/analyze-public` - Analyze public repository
- `POST /api/chat/ask` - Chat with AI about repository (coming soon)
- `GET /health` - Health check endpoint

## 📁 Project Structure

```
nova-hackathon/
├── apps/
│   ├── backend/                    # Express.js API server
│   │   ├── src/
│   │   │   ├── routes/            # API endpoints
│   │   │   │   └── github-integration.routes.ts  # Public repo analysis
│   │   │   ├── services/          # Business logic
│   │   │   │   └── github.service.ts  # GitHub API & AI analysis
│   │   │   ├── middleware/        # Auth, CORS, etc.
│   │   │   └── index.ts          # Server entry point
│   │   ├── .env                   # Environment configuration
│   │   └── package.json
│   │
│   └── frontend/                  # React + Vite frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── PublicAnalysisView.tsx     # Analysis dashboard
│       │   │   └── PublicAnalysisView.css     # Styling
│       │   ├── App.tsx           # Main app component
│       │   └── main.tsx          # Entry point
│       ├── vite.config.ts        # Vite configuration
│       └── package.json
│
├── packages/
│   └── shared/                    # Shared TypeScript types
│
├── infrastructure/                # Terraform configs (optional)
│
├── package.json                   # Root workspace config
└── README.md                      # You are here!
│   └── terraform/        # AWS infrastructure (optional)
├── .github/
│   └── workflows/        # CI/CD pipelines (optional)
├── docker-compose.yml    # Full stack deployment
```

## 🛠️ Development

### Available Scripts

```bash
# Start development servers (both frontend and backend)
npm run dev

# Individual apps
cd apps/backend && npm run dev    # Backend only
cd apps/frontend && npm run dev   # Frontend only

# Build for production
npm run build

# Run tests (when available)
npm test
```

### Development Workflow

1. Make changes to code
2. Vite (frontend) and tsx (backend) watch for changes and reload automatically
3. Test in browser at http://localhost:5173
4. Backend logs appear in terminal for debugging

### Adding New Features

**Backend API Endpoint:**
1. Add route in `apps/backend/src/routes/`
2. Implement logic in `apps/backend/src/services/`
3. Test with curl or Postman

**Frontend Component:**
1. Create component in `apps/frontend/src/components/`
2. Add styles in corresponding `.css` file
3. Import and use in `App.tsx` or other components

**Shared Types:**
1. Add types to `packages/shared/src/types/`
2. Export from `packages/shared/src/index.ts`
3. Import in frontend or backend as needed

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

## 🐛 Troubleshooting

### Port Already in Use

```powershell
# Check which process is using ports
netstat -ano | findstr "3001 5173"

# Kill process by PID (replace <PID> with actual number)
taskkill /PID <PID> /F
```

### Frontend Not Connecting to Backend

1. Ensure backend is running on port 3001
2. Check frontend `vite.config.ts` has proxy configured
3. Verify no CORS errors in browser console

### API Requests Failing

1. Check backend logs for errors
2. Verify GitHub API rate limits (60 requests/hour without auth)
3. Test endpoint directly: `curl http://localhost:3001/health`

### Module Not Found Errors

```bash
# Reinstall dependencies
npm install

# Clear npm cache if needed
npm cache clean --force
npm install
```

### GitHub API Rate Limit

Without authentication, GitHub limits to 60 requests/hour. To increase:

1. Create a GitHub Personal Access Token
2. Add to `.env`: `GITHUB_TOKEN=your_token_here`
3. Restart backend server

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Development Guidelines

- Write clean, readable TypeScript
- Follow existing code style and patterns
- Add comments for complex logic
- Test your changes thoroughly
- Update documentation if needed

## 🚀 Roadmap

**Current Features:**
- ✅ Public repository analysis
- ✅ AI-powered insights
- ✅ Interactive chat interface
- ✅ Real-time GitHub stats
- ✅ Architecture detection
- ✅ Technology stack analysis

**Coming Soon:**
- 🔄 Backend chat API integration
- 🔄 Chat history persistence
- 🔄 Private repository support
- 🔄 Multi-language AI responses
- 🔄 Code search within repositories
- 🔄 Comparison mode (compare 2+ repos)
- 🔄 Export analysis reports

**Future Ideas:**
- 📋 Visual architecture diagrams
- 📊 Trend analysis over time
- 🎯 Contribution recommendations
- 🔔 Repository monitoring
- 🤖 Advanced AI models integration

## 📄 License

MIT License - feel free to use this project for any purpose!

## 💬 Support

Need help?
- 📖 Check the documentation files in the repo
- 🐛 Open an issue on GitHub
- 💡 Suggest features via GitHub Discussions

## 🙏 Acknowledgments

Built with amazing open-source tools:
- **React** - UI framework
- **Vite** - Build tool and dev server
- **Express** - Backend framework
- **TypeScript** - Type safety
- **GitHub API** - Repository data
- **OpenRouter** - Optional LLM routing

---

**Made with ❤️ for developers who love exploring code**
