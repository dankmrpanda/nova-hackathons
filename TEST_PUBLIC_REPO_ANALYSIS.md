# Testing Public Repository Analysis with AI Summary

## Endpoint
`POST /api/github/analyze-public`

## Example Request

```bash
curl -X POST http://localhost:3001/api/github/analyze-public \
  -H "Content-Type: application/json" \
  -d '{"repoUrl": "https://github.com/facebook/react"}'
```

## Expected Response Structure

```json
{
  "repository": {
    "id": 10270250,
    "name": "react",
    "fullName": "facebook/react",
    "owner": "facebook",
    "url": "https://github.com/facebook/react",
    "description": "The library for web and native user interfaces.",
    "primaryLanguage": "JavaScript",
    "size": 281600,
    "defaultBranch": "main",
    "isPrivate": false
  },
  "fileTree": {
    "tree": [...],
    "truncated": false,
    "sha": "abc123...",
    "cachedAt": "2025-11-08T..."
  },
  "branches": [
    {
      "name": "main",
      "commit": { "sha": "...", "url": "..." },
      "protected": true
    }
  ],
  "aiSummary": {
    "overview": "React is a JavaScript library for building user interfaces, developed by Facebook. It provides a component-based architecture for creating reusable UI elements and efficiently updating the DOM through a virtual DOM implementation.",
    "architecture": [
      "Component-based architecture",
      "Virtual DOM",
      "Monorepo with packages"
    ],
    "keyTechnologies": [
      "JavaScript",
      "Flow",
      "TypeScript",
      "Node.js",
      "Babel",
      "Rollup"
    ],
    "projectStructure": [
      {
        "category": "packages",
        "paths": [
          "packages/react",
          "packages/react-dom",
          "packages/react-reconciler"
        ]
      },
      {
        "category": "scripts",
        "paths": ["scripts/rollup", "scripts/jest"]
      }
    ],
    "entryPoints": [
      "packages/react/index.js",
      "packages/react-dom/index.js"
    ],
    "buildTools": [
      "npm/yarn",
      "Rollup",
      "Jest"
    ],
    "suggestedOnboardingPath": [
      "Read CONTRIBUTING.md for contribution guidelines",
      "Review packages/react/index.js to understand React's core API",
      "Check scripts/ for build and test configurations",
      "Explore packages/ directory to see the monorepo structure",
      "Run tests with 'yarn test' to verify your development setup"
    ]
  }
}
```

## Features

### 1. **Repository Metadata**
- Basic information (name, owner, description, language)
- Size, creation/update timestamps
- Privacy status and default branch

### 2. **File Tree Analysis**
- Complete recursive file structure
- File sizes and types
- SHA references for version tracking

### 3. **Branch Information**
- All repository branches
- Commit SHAs and protection status

### 4. **AI-Powered Structural Summary** ✨ NEW
The endpoint now includes intelligent analysis powered by LLM (with rule-based fallback):

#### a. **Overview**
Concise 2-3 sentence description of what the project does and its purpose.

#### b. **Architecture Patterns**
Detected patterns such as:
- MVC (Model-View-Controller)
- Microservices
- Monolithic architecture
- Frontend/Backend separation
- Component-based architecture

#### c. **Key Technologies**
Automatically identified from:
- File extensions (language detection)
- Configuration files (package.json, pom.xml, etc.)
- Build tools (Docker, Maven, npm, etc.)

#### d. **Project Structure**
Categorized directory breakdown:
- Source code directories
- Test directories
- Documentation
- Configuration

#### e. **Entry Points**
Main files to start understanding the codebase:
- index.js, main.py, App.java
- Configuration files
- README and documentation

#### f. **Build Tools**
Detected package managers and build systems:
- npm/yarn (Node.js)
- Maven/Gradle (Java)
- pip (Python)
- Docker
- Make

#### g. **Suggested Onboarding Path**
Step-by-step guide for new developers:
1. Read documentation
2. Review entry points
3. Check build configuration
4. Explore directory structure
5. Run tests

## Implementation Details

### AI Analysis Flow
1. **File Tree Analysis**: Extracts statistics (languages, file counts, sizes)
2. **Pattern Detection**: Identifies configuration files, test files, source files
3. **LLM Prompt**: Sends structured data to AI model (via Airia routing)
4. **Fallback**: Uses rule-based analysis if AI is unavailable

### Rule-Based Fallback
When AI services are unavailable or API keys not configured:
- Analyzes file extensions for language detection
- Detects patterns from directory/file names
- Identifies common frameworks from config files
- Generates basic but useful structural insights

## Testing Examples

### Small Repo
```bash
curl -X POST http://localhost:3001/api/github/analyze-public \
  -H "Content-Type: application/json" \
  -d '{"repoUrl": "https://github.com/sindresorhus/awesome"}'
```

### Medium Repo (with framework)
```bash
curl -X POST http://localhost:3001/api/github/analyze-public \
  -H "Content-Type: application/json" \
  -d '{"repoUrl": "https://github.com/expressjs/express"}'
```

### Large Monorepo
```bash
curl -X POST http://localhost:3001/api/github/analyze-public \
  -H "Content-Type: application/json" \
  -d '{"repoUrl": "https://github.com/vercel/next.js"}'
```

## Benefits

1. **No Authentication Required**: Works with any public GitHub repository
2. **Instant Insights**: Get architectural overview without cloning
3. **Smart Technology Detection**: Automatically identifies frameworks and tools
4. **Onboarding Assistance**: Provides step-by-step guidance for new developers
5. **Fallback Support**: Works even without AI API keys (rule-based analysis)
6. **Fast Analysis**: Leverages GitHub's tree API for efficient scanning

## Notes

- For private repositories, users need to authenticate via GitHub OAuth
- Large repositories may take a few seconds to analyze
- Rate limits apply (60 requests/hour without auth, 5000 with GitHub token)
- Set `GITHUB_TOKEN` environment variable for higher rate limits
- Set `OPENROUTER_API_KEY` or configure Airia for AI-powered analysis
