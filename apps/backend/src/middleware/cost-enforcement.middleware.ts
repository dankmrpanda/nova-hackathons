import { Request, Response, NextFunction } from 'express';
import { CostTrackerService } from '../services/cost-tracker.service';
import { db, getRedisClient } from '../db';

// Shared client with in-memory fallback (no external Redis needed in dev)
const redis = getRedisClient().getClient();

const costTrackerService = new CostTrackerService(db, redis);

/**
 * Middleware to check cost limits before operations
 * Requirements: 16.2, 16.8
 */
export async function checkCostLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionId = req.params.sessionId || req.body.sessionId;

    if (!sessionId) {
      next();
      return;
    }

    // Check if session exists and is active
    const sessionResult = await db.query(
      'SELECT status FROM onboarding_sessions WHERE id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const status = sessionResult.rows[0].status;

    // If already terminated, don't allow operations
    if (status === 'terminated') {
      res.status(403).json({ 
        error: 'Session terminated',
        reason: 'This session has been terminated and cannot be modified'
      });
      return;
    }

    // Check cost limit
    const costStatus = await costTrackerService.checkLimit(sessionId);

    if (costStatus.exceeded) {
      // Enforce limit - terminate session
      await costTrackerService.enforceLimit(sessionId);

      res.status(403).json({
        error: 'Cost limit exceeded',
        costStatus,
        message: `Session terminated: cost limit of $${costStatus.limit.toFixed(2)} exceeded`,
      });
      return;
    }

    // Attach cost status to request for use in handlers
    (req as any).costStatus = costStatus;

    next();
  } catch (error) {
    console.error('Error checking cost limit:', error);
    next(error);
  }
}

/**
 * Middleware to validate session can start based on estimated cost
 * Requirements: 16.4
 */
export async function validateSessionCost(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { sessionId, estimatedCost } = req.body;

    if (!sessionId || estimatedCost === undefined) {
      next();
      return;
    }

    const validation = await costTrackerService.validateSessionStart(sessionId, estimatedCost);

    if (!validation.canStart) {
      res.status(400).json({
        error: 'Cannot start session',
        reason: validation.reason,
        suggestedLimit: validation.suggestedLimit,
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Error validating session cost:', error);
    next(error);
  }
}
