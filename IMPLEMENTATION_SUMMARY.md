# Codebase Onboarding Agent - Implementation Summary

## What We Built

A complete AI-powered codebase onboarding system that helps developers understand and navigate unfamiliar codebases through:

- **GitHub Integration**: OAuth-based authentication to access repositories
- **AI-Powered Analysis**: Deep code analysis using multiple AI models via OpenRouter
- **Interactive UI**: Modern, minimalistic interface for exploring results
- **Visual Animations**: Optional animation generation using Modal
- **Multiple AI Models**: Support for Claude, GPT-4, Llama, and more

## Architecture

### Stack
- **Frontend**: React 18 + Vite + React Router
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL
- **Cache**: Redis
- **Storage**: MinIO (S3-compatible)
- **AI**: OpenRouter API (Anthropic, OpenAI, Meta)
- **Animation**: Modal API
- **Version Control**: GitHub API

### Key Components

#### Backend (`apps/backend/src/`)

**New Routes:**
- `github-integration.routes.ts` - GitHub OAuth and repository access
- `analysis.routes.ts` - Code analysis management
- `animation.routes.ts` - Animation generation

**New Services:**
- `github.service.ts` - GitHub API integration
- `analysis.service.ts` - Repository analysis orchestration
- `agentuity.service.ts` - AI-powered code analysis
- `animation.service.ts` - Animation generation via Modal

**Database Migration:**
- `009_create_onboarding_agent_tables.sql` - New tables for:
  - `repositories` - GitHub repository metadata
  - `analyses` - Analysis jobs and results
  - `animations` - Generated animations
  - `model_providers` - Available AI models

#### Frontend (`apps/frontend/src/`)

**Components:**
- `LandingPage.tsx` - Landing page with GitHub OAuth and public repo input
- `Dashboard.tsx` - User's analysis history
- `RepositorySelector.tsx` - Repository and model selection
- `AnalysisView.tsx` - Interactive analysis results viewer

**Features:**
- Minimalistic dark theme
- Responsive design
- Real-time analysis status updates
- Tabbed interface for different analysis aspects

## How It Works

### User Flow

1. **Landing Page**
   - User can connect GitHub account (OAuth)
   - Or paste public repository URL
   
2. **Repository Selection**
   - Browse user's repositories
   - Select AI model (Claude, GPT-4, etc.)
   - Choose animation option
   - Start analysis

3. **Analysis Processing**
   - Backend fetches repository files
   - Parses code structure (AST)
   - Gathers git history
   - Sends to OpenRouter for AI analysis
   - Stores results in database
   - Optionally generates animations via Modal

4. **Results View**
   - Architecture overview
   - Feature locations
   - Data flow diagrams
   - Onboarding guide
   - Confusion points
   - Recommendations

### Technical Flow

```
Frontend → Backend → GitHub API → OpenRouter → Modal → Database
   ↓          ↓          ↓            ↓          ↓        ↓
  User    Routes    Fetch Repos   AI Analysis  Video   Store
 Action  Handler      & Code       Results    Generate Results
```

## Setup Requirements

### Environment Variables

**Backend (`.env`):**
```env
GITHUB_CLIENT_ID=<your_github_oauth_client_id>
GITHUB_CLIENT_SECRET=<your_github_oauth_secret>
OPENROUTER_API_KEY=<your_openrouter_api_key>
MODAL_API_KEY=<optional_modal_key>
```

**Frontend (`.env`):**
```env
VITE_GITHUB_CLIENT_ID=<same_as_backend>
VITE_API_URL=http://localhost:3001
```

### GitHub OAuth Setup

1. Go to GitHub Settings → Developer Settings → OAuth Apps
2. Create new OAuth App:
   - Application name: CodeMap
   - Homepage URL: http://localhost:3000
   - Callback URL: http://localhost:3001/auth/github/callback
3. Copy Client ID and Secret to `.env` files

### OpenRouter Setup

1. Sign up at https://openrouter.ai/
2. Generate API key
3. Add to backend `.env`

### Modal Setup (Optional)

1. Sign up at https://modal.com/
2. Generate API token
3. Add to backend `.env`

## Running the Application

```bash
# 1. Install dependencies
npm install

# 2. Start infrastructure
npm run docker:up

# 3. Run migrations
npm run migrate

# 4. Start backend (terminal 1)
cd apps/backend
npm run dev

# 5. Start frontend (terminal 2)
cd apps/frontend
npm run dev

# 6. Open browser
# http://localhost:3000
```

## API Endpoints

### GitHub Integration
- `POST /api/github/link` - Link GitHub account
- `GET /api/github/repositories` - List user repos
- `GET /api/github/repositories/:owner/:repo` - Get repo details
- `GET /api/github/repositories/:owner/:repo/tree` - Get file tree
- `POST /api/github/analyze-public` - Analyze public repo

### Analysis
- `POST /api/analysis/analyze` - Start analysis
- `GET /api/analysis/status/:analysisId` - Get status
- `GET /api/analysis/results/:analysisId` - Get results
- `POST /api/analysis/cancel/:analysisId` - Cancel analysis
- `GET /api/analysis/list` - List user's analyses

### Animation
- `POST /api/animation/generate` - Generate animation
- `GET /api/animation/status/:animationId` - Get status
- `GET /api/animation/url/:animationId` - Get animation URL

### Authentication
- `GET /auth/github/callback` - GitHub OAuth callback

## Database Schema

### `repositories`
- Links users to GitHub repositories
- Stores metadata (stars, language, description)

### `analyses`
- Analysis jobs and results
- Status tracking (queued, processing, completed, failed)
- Stores AI analysis results as JSONB

### `animations`
- Animation generation jobs
- Links to analyses
- Stores animation URLs

### `model_providers`
- Available AI models
- Pricing and capability information

## AI Analysis Structure

The AI generates structured JSON with:

```json
{
  "architecture": {
    "type": "monolithic|microservices|layered",
    "description": "...",
    "components": ["..."],
    "patterns": ["..."]
  },
  "features": [
    {
      "name": "...",
      "location": "...",
      "description": "..."
    }
  ],
  "dataFlow": {
    "description": "...",
    "keyPaths": ["..."]
  },
  "techStack": {
    "languages": ["..."],
    "frameworks": ["..."],
    "tools": ["..."]
  },
  "onboardingGuide": {
    "steps": ["..."],
    "tipsForNewDevs": ["..."]
  },
  "confusionPoints": [
    {
      "area": "...",
      "explanation": "...",
      "clarification": "..."
    }
  ],
  "recommendations": ["..."]
}
```

## Future Enhancements

1. **Code Execution Sandbox** - Run example code snippets
2. **Interactive Terminal** - Ask questions about the code
3. **More Animation Types** - Data flow, feature walkthroughs
4. **Collaboration Features** - Share analyses with team
5. **VS Code Extension** - Analyze from within editor
6. **Git History Analysis** - Understand evolution of features
7. **Dependency Analysis** - Visualize package dependencies
8. **Test Coverage Mapping** - Show what code is tested

## Troubleshooting

### "Failed to link GitHub account"
- Check GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET
- Verify callback URL matches OAuth app settings

### "Analysis failed"
- Check OPENROUTER_API_KEY is valid
- Ensure you have API credits
- Check repository is accessible

### "Docker services not starting"
```bash
docker compose down -v
docker compose up -d
```

### "Database migration errors"
```bash
cd apps/backend
npm run migrate
```

## Performance Considerations

- **Rate Limiting**: GitHub API has rate limits (5000/hour authenticated)
- **File Size**: Large repositories may take longer to analyze
- **Cost**: OpenRouter charges per token, larger codebases cost more
- **Caching**: Results are cached in database to avoid re-analysis

## Security Notes

- JWT tokens for authentication
- GitHub OAuth for secure repository access
- Environment variables for sensitive keys
- CORS configured for frontend-backend communication
- SQL injection prevention via parameterized queries

## Contributing

The codebase is structured for easy extension:

1. **Add new AI models**: Update `model_providers` table
2. **Customize analysis**: Modify `agentuity.service.ts` prompts
3. **Add analysis types**: Extend analysis service and routes
4. **New visualizations**: Add to animation service

---

**Built for the Nova Hackathon** - Making codebase onboarding effortless with AI.
