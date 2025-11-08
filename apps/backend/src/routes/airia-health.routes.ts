// @ts-nocheck
import { Router, Request, Response } from 'express';

import { airiaHealthService } from '../services/airia-health.service';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';

const router = Router();

/**
 * Get Airia health status
 * GET /airia/health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const status = airiaHealthService.getHealthStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting Airia health status:', error);
    res.status(500).json({ error: 'Failed to get health status' });
  }
});

/**
 * Trigger manual health check (admin only)
 * POST /airia/health/check
 */
router.post(
  '/health/check',
  authenticateJWT,
  requireRole('administrator'),
  async (req: Request, res: Response) => {
    try {
      const status = await airiaHealthService.triggerHealthCheck();
      res.json(status);
    } catch (error) {
      console.error('Error triggering health check:', error);
      res.status(500).json({ error: 'Failed to trigger health check' });
    }
  }
);

export default router;

