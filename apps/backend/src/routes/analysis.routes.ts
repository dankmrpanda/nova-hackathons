// @ts-nocheck
import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { analysisService } from '../services/analysis.service';
import { logger } from '../services/logger.service';

const router = Router();

// Start repository analysis
router.post('/analyze', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { 
      repositoryId, 
      selectedPaths, 
      modelProvider,
      includeAnimation,
      options 
    } = req.body;
    const userId = (req as any).user.userId;

    if (!repositoryId) {
      return res.status(400).json({ error: 'Repository ID is required' });
    }

    const analysis = await analysisService.startAnalysis({
      userId,
      repositoryId,
      selectedPaths: selectedPaths || [],
      modelProvider: modelProvider || 'openrouter/anthropic/claude-3.5-sonnet',
      includeAnimation: includeAnimation || false,
      options: options || {}
    });

    res.json(analysis);
  } catch (error: any) {
    logger.error('Failed to start analysis', { service: 'analysis' }, error);
    res.status(500).json({ error: error.message });
  }
});

// Get analysis status
router.get('/status/:analysisId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { analysisId } = req.params;
    const userId = (req as any).user.userId;

    const status = await analysisService.getAnalysisStatus(userId, analysisId);
    res.json(status);
  } catch (error: any) {
    logger.error('Failed to fetch analysis status', { service: 'analysis' }, error);
    res.status(500).json({ error: error.message });
  }
});

// Get analysis results
router.get('/results/:analysisId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { analysisId } = req.params;
    const userId = (req as any).user.userId;

    const results = await analysisService.getAnalysisResults(userId, analysisId);
    res.json(results);
  } catch (error: any) {
    logger.error('Failed to fetch analysis results', { service: 'analysis' }, error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel analysis
router.post('/cancel/:analysisId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { analysisId } = req.params;
    const userId = (req as any).user.userId;

    await analysisService.cancelAnalysis(userId, analysisId);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to cancel analysis', { service: 'analysis' }, error);
    res.status(500).json({ error: error.message });
  }
});

// List user's analyses
router.get('/list', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { limit = 20, offset = 0 } = req.query;

    const analyses = await analysisService.listUserAnalyses(userId, Number(limit), Number(offset));
    res.json(analyses);
  } catch (error: any) {
    logger.error('Failed to list analyses', { service: 'analysis' }, error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

