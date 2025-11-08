// @ts-nocheck
/**
 * Alerts Routes
 * 
 * Provides endpoints for alert management
 * 
 * Requirements: 15.5, 36.7, 36.8
 */

import { Router, Request, Response } from 'express';
import { alertingService } from '../services/alerting.service';
import { logger } from '../services/logger.service';

const router = Router();

/**
 * GET /alerts
 * Get all active alerts
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.active === 'true';
    const alerts = activeOnly 
      ? alertingService.getActiveAlerts()
      : alertingService.getAllAlerts();

    res.json({
      alerts,
      count: alerts.length,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to get alerts', {
      service: 'alerts',
      correlationId: req.correlationId,
    }, error as Error);

    res.status(500).json({
      error: 'Failed to retrieve alerts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /alerts/:alertId/resolve
 * Resolve an alert
 */
router.post('/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;

    alertingService.resolveAlert(alertId);

    res.json({
      success: true,
      alertId,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to resolve alert', {
      service: 'alerts',
      correlationId: req.correlationId,
      metadata: { alertId: req.params.alertId },
    }, error as Error);

    res.status(500).json({
      error: 'Failed to resolve alert',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

