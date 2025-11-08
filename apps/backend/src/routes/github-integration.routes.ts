// @ts-nocheck
import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { getGitHubService } from '../services/github.service';
import { logger } from '../services/logger.service';

const router = Router();
const githubService = getGitHubService();

// Link GitHub account
router.post('/link', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    const userId = (req as any).user.userId;

    const result = await githubService.linkGitHubAccount(userId, code);
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to link GitHub account', { service: 'github-integration' }, error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's GitHub repositories
router.get('/repositories', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const repositories = await githubService.getUserRepositories(userId);
    res.json({ repositories });
  } catch (error: any) {
    logger.error('Failed to fetch repositories', { service: 'github-integration' }, error);
    res.status(500).json({ error: error.message });
  }
});

// Get repository details
router.get('/repositories/:owner/:repo', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const userId = (req as any).user.userId;

    const details = await githubService.getRepositoryDetails(userId, owner, repo);
    res.json(details);
  } catch (error: any) {
    logger.error('Failed to fetch repository details', { service: 'github-integration' }, error);
    res.status(500).json({ error: error.message });
  }
});

// Get repository tree structure
router.get('/repositories/:owner/:repo/tree', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const { path = '' } = req.query;
    const userId = (req as any).user.userId;

    const tree = await githubService.getRepositoryTree(userId, owner, repo, path as string);
    res.json({ tree });
  } catch (error: any) {
    logger.error('Failed to fetch repository tree', { service: 'github-integration' }, error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze public repository (no auth required for public repos)
router.post('/analyze-public', async (req: Request, res: Response) => {
  try {
    const { repoUrl } = req.body;
    
    if (!repoUrl) {
      return res.status(400).json({ error: 'Repository URL is required' });
    }

    const analysis = await githubService.analyzePublicRepository(repoUrl);
    
    // Fetch additional repository stats from GitHub API
    const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
    const axios = require('axios');
    const repoStatsResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}`);
    const repoStats = repoStatsResponse.data;
    
    // Transform the response to match frontend expectations
    const response = {
      owner: analysis.repository.owner,
      repo: analysis.repository.name,
      description: analysis.repository.description || '',
      language: analysis.repository.primaryLanguage || 'Unknown',
      stars: repoStats.stargazers_count || 0,
      forks: repoStats.forks_count || 0,
      openIssues: repoStats.open_issues_count || 0,
      fileCount: analysis.fileTree.tree.length,
      aiSummary: {
        overview: analysis.aiSummary.overview,
        architecture: Array.isArray(analysis.aiSummary.architecture) 
          ? analysis.aiSummary.architecture.join(', ') 
          : analysis.aiSummary.architecture,
        keyTechnologies: analysis.aiSummary.keyTechnologies || [],
        projectStructure: Array.isArray(analysis.aiSummary.projectStructure)
          ? analysis.aiSummary.projectStructure
              .map((ps: any) => `${ps.category}: ${ps.paths.join(', ')}`)
              .join('\n')
          : analysis.aiSummary.projectStructure,
        entryPoints: analysis.aiSummary.entryPoints || [],
        buildTools: analysis.aiSummary.buildTools || [],
        suggestedOnboardingPath: analysis.aiSummary.suggestedOnboardingPath || [],
      },
    };
    
    res.json(response);
  } catch (error: any) {
    logger.error('Failed to analyze public repository', { service: 'github-integration' }, error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
