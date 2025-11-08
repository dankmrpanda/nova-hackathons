// @ts-nocheck
import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { animationService } from '../services/animation.service';
import { logger } from '../services/logger.service';

const router = Router();

// Generate animation for analysis
router.post('/generate', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { analysisId, animationType, options } = req.body;
    const userId = (req as any).user.userId;

    if (!analysisId) {
      return res.status(400).json({ error: 'Analysis ID is required' });
    }

    const animation = await animationService.generateAnimation({
      userId,
      analysisId,
      animationType: animationType || 'architecture',
      options: options || {}
    });

    res.json(animation);
  } catch (error: any) {
    logger.error('Failed to generate animation', { service: 'animation' }, error);
    res.status(500).json({ error: error.message });
  }
});

// Get animation status
router.get('/status/:animationId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { animationId } = req.params;
    const userId = (req as any).user.userId;

    const status = await animationService.getAnimationStatus(userId, animationId);
    res.json(status);
  } catch (error: any) {
    logger.error('Failed to fetch animation status', { service: 'animation' }, error);
    res.status(500).json({ error: error.message });
  }
});

// Get animation URL
router.get('/url/:animationId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { animationId } = req.params;
    const userId = (req as any).user.userId;

    const url = await animationService.getAnimationUrl(userId, animationId);
    res.json({ url });
  } catch (error: any) {
    logger.error('Failed to fetch animation URL', { service: 'animation' }, error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

