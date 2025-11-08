// @ts-nocheck
import { Router, Request, Response } from 'express';
import { CostTrackerService } from '../services/cost-tracker.service';
import { CostNotificationService } from '../services/cost-notification.service';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { db, getRedisClient } from '../db';
import { RecordCostRequest, CostReportQuery } from '@codebase-onboarding/shared';

const router = Router();
// Use shared client with in-memory fallback (controlled by REDIS_DISABLED)
const redis = getRedisClient().getClient();

const costTrackerService = new CostTrackerService(db, redis);
const costNotificationService = new CostNotificationService(db, redis);

/**
 * POST /api/cost/track
 * Record a cost entry for a session
 * Requirements: 16.5
 */
router.post(
  '/track',
  authenticateJWT,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId, service, operation, amount, metadata } = req.body as RecordCostRequest;
      const userId = (req as any).user.userId;
      const tenantId = (req as any).user.tenantId;

      // Verify session belongs to user or user has access
      const sessionResult = await db.query(
        'SELECT user_id FROM onboarding_sessions WHERE id = $1',
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const sessionOwnerId = sessionResult.rows[0].user_id;
      if (sessionOwnerId !== userId) {
        // Check if user is a collaborator
        const collabResult = await db.query(
          'SELECT id FROM session_collaborators WHERE session_id = $1 AND user_id = $2',
          [sessionId, userId]
        );

        if (collabResult.rows.length === 0) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      }

      await costTrackerService.trackCost(sessionId, tenantId, userId, {
        service,
        operation,
        amount,
        metadata: metadata || {},
      });

      // Get updated cost status
      const costStatus = await costTrackerService.checkLimit(sessionId);

      // Check for notifications
      await costNotificationService.monitorAndNotify(sessionId);

      // Check if limit exceeded and enforce
      if (costStatus.exceeded) {
        const enforcement = await costTrackerService.enforceLimit(sessionId);
        res.json({
          success: true,
          costStatus,
          terminated: enforcement.terminated,
          reason: enforcement.reason,
        });
        return;
      }

      res.json({
        success: true,
        costStatus,
      });
    } catch (error) {
      console.error('Error tracking cost:', error);
      res.status(500).json({ error: 'Failed to track cost' });
    }
  }
);

/**
 * GET /api/cost/session/:sessionId
 * Get current cost for a session
 * Requirements: 16.6
 */
router.get(
  '/session/:sessionId',
  authenticateJWT,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const userId = (req as any).user.userId;

      // Verify access
      const sessionResult = await db.query(
        'SELECT user_id FROM onboarding_sessions WHERE id = $1',
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const sessionOwnerId = sessionResult.rows[0].user_id;
      if (sessionOwnerId !== userId) {
        const collabResult = await db.query(
          'SELECT id FROM session_collaborators WHERE session_id = $1 AND user_id = $2',
          [sessionId, userId]
        );

        if (collabResult.rows.length === 0) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      }

      const currentCost = await costTrackerService.getCurrentCost(sessionId);
      const costStatus = await costTrackerService.checkLimit(sessionId);

      res.json({
        currentCost,
        costStatus,
      });
    } catch (error) {
      console.error('Error getting session cost:', error);
      res.status(500).json({ error: 'Failed to get session cost' });
    }
  }
);

/**
 * GET /api/cost/estimate
 * Estimate cost for a session configuration
 * Requirements: 16.1
 */
router.post(
  '/estimate',
  authenticateJWT,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const config = req.body;
      const userId = (req as any).user.userId;
      const tenantId = (req as any).user.tenantId;

      // Add user and tenant info to config
      config.userId = userId;
      config.tenantId = tenantId;

      const estimate = await costTrackerService.estimateCost(config);

      res.json(estimate);
    } catch (error) {
      console.error('Error estimating cost:', error);
      res.status(500).json({ error: 'Failed to estimate cost' });
    }
  }
);

/**
 * GET /api/cost/tenant
 * Get cost report for tenant
 * Requirements: 16.6
 */
router.get(
  '/tenant',
  authenticateJWT,
  requirePermission('analytics', 'read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = (req as any).user.tenantId;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ error: 'startDate and endDate are required' });
        return;
      }

      const query: CostReportQuery = {
        tenantId,
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      };

      const report = await costTrackerService.getTenantCosts(tenantId, query);

      res.json(report);
    } catch (error) {
      console.error('Error getting tenant costs:', error);
      res.status(500).json({ error: 'Failed to get tenant costs' });
    }
  }
);

/**
 * GET /api/cost/user
 * Get cost report for current user
 * Requirements: 16.6
 */
router.get(
  '/user',
  authenticateJWT,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ error: 'startDate and endDate are required' });
        return;
      }

      const query: CostReportQuery = {
        userId,
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      };

      const report = await costTrackerService.getUserCosts(userId, query);

      res.json(report);
    } catch (error) {
      console.error('Error getting user costs:', error);
      res.status(500).json({ error: 'Failed to get user costs' });
    }
  }
);

/**
 * GET /api/cost/export
 * Export cost data for tenant
 */
router.get(
  '/export',
  authenticateJWT,
  requirePermission('analytics', 'read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = (req as any).user.tenantId;
      const { startDate, endDate, format = 'json' } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ error: 'startDate and endDate are required' });
        return;
      }

      const query: CostReportQuery = {
        tenantId,
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      };

      const data = await costTrackerService.exportCostData(
        tenantId,
        format as 'csv' | 'json',
        query
      );

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="cost-report-${tenantId}.csv"`);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="cost-report-${tenantId}.json"`);
      }

      res.send(data);
    } catch (error) {
      console.error('Error exporting cost data:', error);
      res.status(500).json({ error: 'Failed to export cost data' });
    }
  }
);

/**
 * GET /api/cost/config
 * Get tenant cost configuration
 */
router.get(
  '/config',
  authenticateJWT,
  requirePermission('tenant', 'read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = (req as any).user.tenantId;
      const config = await costTrackerService.getTenantCostConfig(tenantId);

      res.json(config);
    } catch (error) {
      console.error('Error getting tenant cost config:', error);
      res.status(500).json({ error: 'Failed to get tenant cost config' });
    }
  }
);

/**
 * PUT /api/cost/config
 * Update tenant cost configuration
 */
router.put(
  '/config',
  authenticateJWT,
  requirePermission('tenant', 'manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = (req as any).user.tenantId;
      const { defaultCostLimit, maxCostLimit, warningThreshold } = req.body;

      await costTrackerService.updateTenantCostConfig({
        tenantId,
        defaultCostLimit,
        maxCostLimit,
        warningThreshold,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating tenant cost config:', error);
      res.status(500).json({ error: 'Failed to update tenant cost config' });
    }
  }
);

/**
 * POST /api/cost/enforce/:sessionId
 * Manually enforce cost limit for a session
 * Requirements: 16.8
 */
router.post(
  '/enforce/:sessionId',
  authenticateJWT,
  requirePermission('session', 'manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;

      const enforcement = await costTrackerService.enforceLimit(sessionId);

      res.json(enforcement);
    } catch (error) {
      console.error('Error enforcing cost limit:', error);
      res.status(500).json({ error: 'Failed to enforce cost limit' });
    }
  }
);

/**
 * GET /api/cost/notification/:sessionId
 * Get cost notification for session
 * Requirements: 16.7
 */
router.get(
  '/notification/:sessionId',
  authenticateJWT,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const userId = (req as any).user.userId;

      // Verify access
      const sessionResult = await db.query(
        'SELECT user_id FROM onboarding_sessions WHERE id = $1',
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const sessionOwnerId = sessionResult.rows[0].user_id;
      if (sessionOwnerId !== userId) {
        const collabResult = await db.query(
          'SELECT id FROM session_collaborators WHERE session_id = $1 AND user_id = $2',
          [sessionId, userId]
        );

        if (collabResult.rows.length === 0) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      }

      const notification = await costTrackerService.getCostNotification(sessionId);

      res.json(notification);
    } catch (error) {
      console.error('Error getting cost notification:', error);
      res.status(500).json({ error: 'Failed to get cost notification' });
    }
  }
);

/**
 * POST /api/cost/validate-start
 * Validate if session can start based on estimated cost
 * Requirements: 16.4
 */
router.post(
  '/validate-start',
  authenticateJWT,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId, estimatedCost } = req.body;

      if (!sessionId || estimatedCost === undefined) {
        res.status(400).json({ error: 'sessionId and estimatedCost are required' });
        return;
      }

      const validation = await costTrackerService.validateSessionStart(sessionId, estimatedCost);

      res.json(validation);
    } catch (error) {
      console.error('Error validating session start:', error);
      res.status(500).json({ error: 'Failed to validate session start' });
    }
  }
);

export default router;

