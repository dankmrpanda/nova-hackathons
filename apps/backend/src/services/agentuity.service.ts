// @ts-nocheck
import axios from 'axios';
import { config } from '../config';
import { logger } from './logger.service';

interface CodebaseAnalysisRequest {
  repository: {
    owner: string;
    name: string;
  };
  files: any[];
  astResults: any[];
  commits: any[];
  modelProvider: string;
}

class AgentuityService {
  async analyzeCodebase(request: CodebaseAnalysisRequest) {
    try {
      // Use OpenRouter for LLM analysis with Agentuity-style prompting
      const analysis = await this.performDeepAnalysis(request);

      return {
        architecture: analysis.architecture,
        features: analysis.features,
        dataFlow: analysis.dataFlow,
        techStack: analysis.techStack,
        onboardingGuide: analysis.onboardingGuide,
        confusionPoints: analysis.confusionPoints,
        recommendations: analysis.recommendations,
      };
    } catch (error: any) {
      logger.error('Agentuity analysis failed', { service: 'agentuity' }, error);
      throw error;
    }
  }

  private async performDeepAnalysis(request: CodebaseAnalysisRequest) {
    const { repository, files, astResults, commits, modelProvider } = request;

    // Prepare context
    const context = this.prepareAnalysisContext(files, astResults, commits);

    // Call OpenRouter API with structured prompts
    const prompt = this.buildAnalysisPrompt(repository, context);

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: modelProvider,
        messages: [
          {
            role: 'system',
            content: `You are an expert code analyst helping developers understand new codebases. 
            Analyze the provided codebase and generate a comprehensive onboarding guide.
            Focus on architecture decisions, feature locations, data flow, and potential confusion points.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      },
      {
        headers: {
          Authorization: `Bearer ${config.openRouter.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const analysisText = response.data.choices[0].message.content;

    // Parse structured analysis from response
    return this.parseAnalysisResponse(analysisText);
  }

  private prepareAnalysisContext(files: any[], astResults: any[], commits: any[]) {
    // Summarize files by type
    const filesByType: any = {};
    files.forEach(file => {
      const ext = file.path.split('.').pop() || 'unknown';
      if (!filesByType[ext]) {
        filesByType[ext] = [];
      }
      filesByType[ext].push(file.path);
    });

    // Extract key files (likely entry points)
    const keyFiles = files.filter(f =>
      f.path.match(/(index|main|app|server)\.(ts|js|tsx|jsx|py|java|go)$/)
    );

    // Summarize commit activity
    const recentCommits = commits.slice(0, 10).map(c => ({
      message: c.commit.message,
      date: c.commit.author.date,
    }));

    return {
      totalFiles: files.length,
      filesByType,
      keyFiles: keyFiles.map(f => f.path),
      recentCommits,
      astSummary: astResults.length > 0 ? 'AST data available' : 'No AST data',
    };
  }

  private buildAnalysisPrompt(repository: any, context: any) {
    return `
# Repository Analysis Request

Repository: ${repository.owner}/${repository.name}

## Context
- Total Files: ${context.totalFiles}
- File Types: ${Object.keys(context.filesByType).join(', ')}
- Key Entry Points: ${context.keyFiles.join(', ')}

## Recent Commits
${context.recentCommits.map((c: any) => `- ${c.message} (${c.date})`).join('\n')}

## Analysis Required

Please provide a comprehensive analysis in the following JSON structure:

\`\`\`json
{
  "architecture": {
    "type": "monolithic|microservices|layered|etc",
    "description": "Brief architecture overview",
    "components": ["component1", "component2"],
    "patterns": ["pattern1", "pattern2"]
  },
  "features": [
    {
      "name": "Feature name",
      "location": "Path or module",
      "description": "What it does"
    }
  ],
  "dataFlow": {
    "description": "How data flows through the system",
    "keyPaths": ["path1 -> path2 -> path3"]
  },
  "techStack": {
    "languages": ["lang1", "lang2"],
    "frameworks": ["framework1", "framework2"],
    "tools": ["tool1", "tool2"]
  },
  "onboardingGuide": {
    "steps": [
      "Step 1 description",
      "Step 2 description"
    ],
    "tipsForNewDevs": ["tip1", "tip2"]
  },
  "confusionPoints": [
    {
      "area": "Area of potential confusion",
      "explanation": "Why it might be confusing",
      "clarification": "How to understand it"
    }
  ],
  "recommendations": [
    "Recommendation 1",
    "Recommendation 2"
  ]
}
\`\`\`

Focus on making this useful for a developer trying to understand and contribute to the codebase.
`;
  }

  private parseAnalysisResponse(analysisText: string) {
    try {
      // Extract JSON from markdown code block if present
      const jsonMatch = analysisText.match(/```json\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : analysisText;

      const parsed = JSON.parse(jsonStr);
      return parsed;
    } catch (error) {
      logger.error('Failed to parse analysis response', { service: 'agentuity' }, error as Error);

      // Return a fallback structure
      return {
        architecture: {
          type: 'unknown',
          description: 'Could not parse architecture details',
          components: [],
          patterns: [],
        },
        features: [],
        dataFlow: {
          description: 'Could not determine data flow',
          keyPaths: [],
        },
        techStack: {
          languages: [],
          frameworks: [],
          tools: [],
        },
        onboardingGuide: {
          steps: ['Analysis parsing failed. Please try again.'],
          tipsForNewDevs: [],
        },
        confusionPoints: [],
        recommendations: [],
        rawResponse: analysisText,
      };
    }
  }
}

export const agentuityService = new AgentuityService();
