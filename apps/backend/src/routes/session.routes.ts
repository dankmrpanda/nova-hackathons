// @ts-nocheck
import { Router, Response } from 'express';
import { sessionService } from '../services/session.service';
import { sessionQueueService } from '../services/session-queue.service';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { blockIfReadOnly } from '../middleware/airia-readonly.middleware';
import { CreateSessionRequest, UpdateSessionRequest } from '@codebase-onboarding/shared';

const router = Router();

/**
 * Create a new onboarding session
 * POST /sessions
 */
router.post(
  '/',
  authenticateJWT,
  blockIfReadOnly,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;
      const body: CreateSessionRequest = req.body;

      // Validate required fields
      if (!body.repositoryUrl || !body.analysisScope || !body.outputFormat) {
        return res.status(400).json({
          error: 'Missing required fields: repositoryUrl, analysisScope, outputFormat',
        });
      }

      // Check if user can create a new session
      const canCreate = await sessionService.canCreateSession(userId, tenantId);
      if (!canCreate.allowed) {
        // Add to queue if limit reached
        const queueEntry = await sessionQueueService.addToQueue(userId, tenantId, body);
        
        return res.status(429).json({
          error: canCreate.reason || 'Cannot create session',
          queued: true,
          queuePosition: queueEntry.position,
          queueId: queueEntry.id,
          expiresAt: queueEntry.expiresAt,
        });
      }

      // Create session
      const session = await sessionService.createSession({
        userId,
        tenantId,
        repositoryUrl: body.repositoryUrl,
        repositoryBranch: body.repositoryBranch,
        analysisScope: body.analysisScope,
        modelPreference: body.modelPreference,
        outputFormat: body.outputFormat,
        voiceEnabled: body.voiceEnabled || false,
        randomSeed: body.randomSeed,
      });

      res.status(201).json(session);
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  }
);

/**
 * Get a session by ID
 * GET /sessions/:id
 */
router.get(
  '/:id',
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;

      const session = await sessionService.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Check if user has access to this session
      if (session.userId !== userId && session.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(session);
    } catch (error) {
      console.error('Error getting session:', error);
      res.status(500).json({ error: 'Failed to get session' });
    }
  }
);

/**
 * Update a session
 * PATCH /sessions/:id
 */
router.patch(
  '/:id',
  authenticateJWT,
  blockIfReadOnly,
  async (req: AuthRequest, res: Response) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.userId;
      const updates: UpdateSessionRequest = req.body;

      // Get session to check ownership
      const session = await sessionService.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Check if user owns this session
      if (session.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updatedSession = await sessionService.updateSession(sessionId, updates);
      res.json(updatedSession);
    } catch (error) {
      console.error('Error updating session:', error);
      res.status(500).json({ error: 'Failed to update session' });
    }
  }
);

/**
 * Terminate a session
 * POST /sessions/:id/terminate
 */
router.post(
  '/:id/terminate',
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.userId;
      const { reason } = req.body;

      // Get session to check ownership
      const session = await sessionService.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Check if user owns this session
      if (session.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const terminatedSession = await sessionService.terminateSession(
        sessionId,
        reason || 'User requested termination'
      );

      res.json(terminatedSession);
    } catch (error) {
      console.error('Error terminating session:', error);
      res.status(500).json({ error: 'Failed to terminate session' });
    }
  }
);

/**
 * List sessions
 * GET /sessions
 */
router.get(
  '/',
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;
      const role = req.user.role;

      const { status, limit, offset } = req.query;

      // Administrators can see all sessions in tenant
      // Others can only see their own sessions
      const query: any = {
        status: status as string,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      };

      if (role === 'Administrator') {
        query.tenantId = tenantId;
      } else {
        query.userId = userId;
      }

      const sessions = await sessionService.listSessions(query);
      res.json(sessions);
    } catch (error) {
      console.error('Error listing sessions:', error);
      res.status(500).json({ error: 'Failed to list sessions' });
    }
  }
);
/**
 * Create a share link for a session
 * POST /sessions/:id/share
 */
router.post(
  '/:id/share',
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.userId;
      const { permissions, expiresInHours } = req.body;

      // Get session to check ownership
      const session = await sessionService.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Check if user owns this session
      if (session.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Validate permissions
      if (!permissions || typeof permissions.canView !== 'boolean') {
        return res.status(400).json({
          error: 'Invalid permissions. Must include canView, canInteract, canAnnotate',
        });
      }

      const shareLink = await sessionService.createShareLink(
        sessionId,
        permissions,
        expiresInHours || 24
      );

      // Store the share link as a placeholder collaborator
      await sessionService.addCollaborator(
        sessionId,
        'placeholder', // Will be replaced when someone joins
        permissions,
        shareLink.token,
        shareLink.expiresAt
      );

      res.json(shareLink);
    } catch (error) {
      console.error('Error creating share link:', error);
      res.status(500).json({ error: 'Failed to create share link' });
    }
  }
);

/**
 * Join a session using a share link
 * POST /sessions/join/:token
 */
router.post(
  '/join/:token',
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const shareToken = req.params.token;
      const userId = req.user.userId;

      const result = await sessionService.joinSession(shareToken, userId);

      res.json(result);
    } catch (error: any) {
      console.error('Error joining session:', error);
      if (error.message === 'Invalid or expired share link') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to join session' });
    }
  }
);

/**
 * Get collaborators for a session
 * GET /sessions/:id/collaborators
 */
router.get(
  '/:id/collaborators',
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.userId;

      // Check if user has access to this session
      const hasAccess = await sessionService.hasSessionAccess(sessionId, userId);

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const collaborators = await sessionService.getCollaborators(sessionId);
      res.json(collaborators);
    } catch (error) {
      console.error('Error getting collaborators:', error);
      res.status(500).json({ error: 'Failed to get collaborators' });
    }
  }
);

/**
 * Remove a collaborator from a session
 * DELETE /sessions/:id/collaborators/:userId
 */
router.delete(
  '/:id/collaborators/:collaboratorUserId',
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const sessionId = req.params.id;
      const collaboratorUserId = req.params.collaboratorUserId;
      const userId = req.user.userId;

      // Get session to check ownership
      const session = await sessionService.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Check if user owns this session
      if (session.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await sessionService.removeCollaborator(sessionId, collaboratorUserId);
      res.json({ message: 'Collaborator removed successfully' });
    } catch (error) {
      console.error('Error removing collaborator:', error);
      res.status(500).json({ error: 'Failed to remove collaborator' });
    }
  }
);

/**
 * Update collaborator activity (heartbeat)
 * POST /sessions/:id/activity
 */
router.post(
  '/:id/activity',
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.userId;

      // Check if user has access to this session
      const hasAccess = await sessionService.hasSessionAccess(sessionId, userId);

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await sessionService.updateCollaboratorActivity(sessionId, userId);
      res.json({ message: 'Activity updated' });
    } catch (error) {
      console.error('Error updating activity:', error);
      res.status(500).json({ error: 'Failed to update activity' });
    }
  }
);
/**
 * Get queue position for current user
 * GET /sessions/queue/position
 */
router.get(
  '/queue/position',
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;

      const queueEntry = await sessionQueueService.getQueuePosition(userId, tenantId);

      if (!queueEntry) {
        return res.status(404).json({ error: 'Not in queue' });
      }

      res.json(queueEntry);
    } catch (error) {
      console.error('Error getting queue position:', error);
      res.status(500).json({ error: 'Failed to get queue position' });
    }
  }
);

/**
 * Remove user from queue
 * DELETE /sessions/queue
 */
router.delete(
  '/queue',
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;

      await sessionQueueService.removeUserFromQueue(userId, tenantId);
      res.json({ message: 'Removed from queue' });
    } catch (error) {
      console.error('Error removing from queue:', error);
      res.status(500).json({ error: 'Failed to remove from queue' });
    }
  }
);

/**
 * Get queue length for tenant (admin only)
 * GET /sessions/queue/length
 */
router.get(
  '/queue/length',
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user.tenantId;

      const length = await sessionQueueService.getQueueLength(tenantId);
      res.json({ length });
    } catch (error) {
      console.error('Error getting queue length:', error);
      res.status(500).json({ error: 'Failed to get queue length' });
    }
  }
);

export default router;

