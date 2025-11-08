// @ts-nocheck
/**
 * Health Check Routes
 * 
 * Provides endpoints for health checks, liveness, and readiness probes
 * 
 * Requirements: 15.3
 */

import { Router, Request, Response } from 'express';
import { healthCheckService } from '../services/health-check.service';
import { logger } from '../services/logger.service';

const router = Router();

/**
 * GET / (mounted at /health)
 * Comprehensive health check
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const health = await healthCheckService.checkHealth();

    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check endpoint failed', {
      service: 'health-check',
    }, error as Error);

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /health/live
 * Liveness probe for Kubernetes/container orchestration
 */
router.get('/health/live', async (_req: Request, res: Response) => {
  try {
    const liveness = await healthCheckService.checkLiveness();

    if (liveness.alive) {
      res.status(200).json({ status: 'alive', timestamp: new Date() });
    } else {
      res.status(503).json({ status: 'dead', timestamp: new Date() });
    }
  } catch (error) {
    logger.error('Liveness check failed', {
      service: 'health-check',
    }, error as Error);

    res.status(503).json({
      status: 'dead',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /health/ready
 * Readiness probe for Kubernetes/container orchestration
 */
router.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    const readiness = await healthCheckService.checkReadiness();

    if (readiness.ready) {
      res.status(200).json({ status: 'ready', timestamp: new Date() });
    } else {
      res.status(503).json({
        status: 'not_ready',
        reason: readiness.reason,
        timestamp: new Date(),
      });
    }
  } catch (error) {
    logger.error('Readiness check failed', {
      service: 'health-check',
    }, error as Error);

    res.status(503).json({
      status: 'not_ready',
      reason: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    });
  }
});

/**
 * GET /health/status
 * Simple status endpoint
 */
router.get('/health/status', async (_req: Request, res: Response) => {
  try {
    const status = await healthCheckService.getStatus();
    res.status(200).json(status);
  } catch (error) {
    logger.error('Status check failed', {
      service: 'health-check',
    }, error as Error);

    res.status(500).json({
      status: 'error',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

