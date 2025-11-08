// @ts-nocheck
/**
 * Dashboard Routes
 * 
 * Provides endpoints for monitoring dashboards
 * 
 * Requirements: 15.7, 36.5, 36.6
 */

import { Router, Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { logger } from '../services/logger.service';

const router = Router();

/**
 * GET /dashboards/operations
 * Get operations dashboard data
 */
router.get('/operations', async (req: Request, res: Response) => {
  try {
    const dashboard = await dashboardService.getOperationsDashboard();
    res.json(dashboard);
  } catch (error) {
    logger.error('Failed to get operations dashboard', {
      service: 'dashboard',
      correlationId: req.correlationId,
    }, error as Error);

    res.status(500).json({
      error: 'Failed to retrieve operations dashboard',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /dashboards/cost
 * Get cost dashboard data
 */
router.get('/cost', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const dashboard = await dashboardService.getCostDashboard(startDate, endDate);
    res.json(dashboard);
  } catch (error) {
    logger.error('Failed to get cost dashboard', {
      service: 'dashboard',
      correlationId: req.correlationId,
    }, error as Error);

    res.status(500).json({
      error: 'Failed to retrieve cost dashboard',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /dashboards/usage
 * Get usage dashboard data
 */
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const dashboard = await dashboardService.getUsageDashboard(startDate, endDate);
    res.json(dashboard);
  } catch (error) {
    logger.error('Failed to get usage dashboard', {
      service: 'dashboard',
      correlationId: req.correlationId,
    }, error as Error);

    res.status(500).json({
      error: 'Failed to retrieve usage dashboard',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /dashboards/security
 * Get security dashboard data
 */
router.get('/security', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const dashboard = await dashboardService.getSecurityDashboard(startDate, endDate);
    res.json(dashboard);
  } catch (error) {
    logger.error('Failed to get security dashboard', {
      service: 'dashboard',
      correlationId: req.correlationId,
    }, error as Error);

    res.status(500).json({
      error: 'Failed to retrieve security dashboard',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

