// @ts-nocheck
/**
 * Voice Session Routes
 * 
 * API endpoints for voice interactions via Retell AI
 * Requirements: 26, 27, 28
 */

import { Router, Request, Response } from 'express';
import {
  StartVoiceSessionRequest,
  EndVoiceSessionRequest,
  JoinVoiceSessionRequest,
  LeaveVoiceSessionRequest,
  GetTranscriptRequest,
  VoiceUIState,
} from '@codebase-onboarding/shared';

import { VoiceOrchestratorService } from '../services/voice-orchestrator.service';
import { CostTrackerService } from '../services/cost-tracker.service';
import { rbacService } from '../services/rbac.service';
import { db } from '../db';
import { getRedisClient } from '../db/redis';

const router = Router();

// Initialize services
const redis = getRedisClient().getClient();
const costTracker = new CostTrackerService(db, redis);
const voiceOrchestrator = new VoiceOrchestratorService(costTracker);

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tenantId: string;
        role: string;
      };
    }
  }
}

/**
 * Start a voice session
 * POST /api/voice/sessions
 * Requirement 26.1: Integrate Retell AI for real-time voice interactions
 */
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const request: StartVoiceSessionRequest = req.body;

    // Check if user has access to the session
    const hasAccess = await rbacService.checkPermission(
      userId,
      'session',
      'interact'
    );

    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden: No access to session' });
    }

    // Start voice session
    const response = await voiceOrchestrator.startVoiceSession(
      request.sessionId,
      userId,
      tenantId,
      request
    );

    res.status(201).json(response);
  } catch (error) {
    console.error('Error starting voice session:', error);
    res.status(500).json({
      error: 'Failed to start voice session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * End a voice session
 * POST /api/voice/sessions/:voiceSessionId/end
 * Requirement 26.6: Synchronize voice explanations with terminal UI
 */
router.post('/sessions/:voiceSessionId/end', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { voiceSessionId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get voice session to check ownership
    const voiceSession = await voiceOrchestrator.getVoiceSession(voiceSessionId);
    if (!voiceSession) {
      return res.status(404).json({ error: 'Voice session not found' });
    }

    // Check if user is owner or has permission
    if (voiceSession.userId !== userId) {
      const hasAccess = await rbacService.checkPermission(
        userId,
        'voice-session',
        'interact',
        voiceSession.userId
      );

      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden: Not session owner' });
      }
    }

    const request: EndVoiceSessionRequest = {
      voiceSessionId,
      reason: req.body.reason,
    };

    const response = await voiceOrchestrator.endVoiceSession(voiceSessionId, request);

    res.json(response);
  } catch (error) {
    console.error('Error ending voice session:', error);
    res.status(500).json({
      error: 'Failed to end voice session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get voice session details
 * GET /api/voice/sessions/:voiceSessionId
 */
router.get('/sessions/:voiceSessionId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { voiceSessionId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const voiceSession = await voiceOrchestrator.getVoiceSession(voiceSessionId);
    if (!voiceSession) {
      return res.status(404).json({ error: 'Voice session not found' });
    }

    // Check access
    const hasAccess = await rbacService.checkPermission(
      userId,
      'voice-session',
      'view',
      voiceSession.userId
    );

    if (!hasAccess && voiceSession.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get participants
    const participants = await voiceOrchestrator.getParticipants(voiceSessionId);
    voiceSession.participants = participants;

    res.json({ voiceSession });
  } catch (error) {
    console.error('Error getting voice session:', error);
    res.status(500).json({
      error: 'Failed to get voice session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Join a voice session as collaborator or listener
 * POST /api/voice/sessions/:voiceSessionId/join
 * Requirement 27.1: Support collaborative "listen in" mode
 */
router.post('/sessions/:voiceSessionId/join', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { voiceSessionId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const request: JoinVoiceSessionRequest = {
      voiceSessionId,
      userId,
      role: req.body.role || 'listener',
    };

    // Check if user has access to join
    const voiceSession = await voiceOrchestrator.getVoiceSession(voiceSessionId);
    if (!voiceSession) {
      return res.status(404).json({ error: 'Voice session not found' });
    }

    const hasAccess = await rbacService.checkPermission(
      userId,
      'session',
      'view'
    );

    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden: No access to session' });
    }

    const response = await voiceOrchestrator.addListener(
      voiceSessionId,
      userId,
      request.role
    );

    res.json(response);
  } catch (error) {
    console.error('Error joining voice session:', error);
    res.status(500).json({
      error: 'Failed to join voice session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Leave a voice session
 * POST /api/voice/sessions/:voiceSessionId/leave
 */
router.post('/sessions/:voiceSessionId/leave', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { voiceSessionId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await voiceOrchestrator.removeListener(voiceSessionId, userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error leaving voice session:', error);
    res.status(500).json({
      error: 'Failed to leave voice session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get voice transcript
 * GET /api/voice/sessions/:voiceSessionId/transcript
 * Requirement 28.5: Sanitize all voice transcripts
 */
router.get('/sessions/:voiceSessionId/transcript', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { voiceSessionId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check access
    const voiceSession = await voiceOrchestrator.getVoiceSession(voiceSessionId);
    if (!voiceSession) {
      return res.status(404).json({ error: 'Voice session not found' });
    }

    const hasAccess = await rbacService.checkPermission(
      userId,
      'voice-session',
      'view',
      voiceSession.userId
    );

    if (!hasAccess && voiceSession.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const transcript = await voiceOrchestrator.getTranscript(voiceSessionId);

    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    res.json({ transcript });
  } catch (error) {
    console.error('Error getting transcript:', error);
    res.status(500).json({
      error: 'Failed to get transcript',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Sync UI state with voice
 * POST /api/voice/sessions/:voiceSessionId/sync-ui
 * Requirement 26.6: Synchronize voice explanations with terminal UI
 */
router.post('/sessions/:voiceSessionId/sync-ui', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { voiceSessionId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const uiState: VoiceUIState = req.body.uiState;
    const transcriptSegmentId = req.body.transcriptSegmentId;

    await voiceOrchestrator.syncWithUI(voiceSessionId, uiState, transcriptSegmentId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error syncing UI:', error);
    res.status(500).json({
      error: 'Failed to sync UI',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get participants in a voice session
 * GET /api/voice/sessions/:voiceSessionId/participants
 * Requirement 27.4: Display presence indicators
 */
router.get('/sessions/:voiceSessionId/participants', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { voiceSessionId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check access
    const voiceSession = await voiceOrchestrator.getVoiceSession(voiceSessionId);
    if (!voiceSession) {
      return res.status(404).json({ error: 'Voice session not found' });
    }

    const hasAccess = await rbacService.checkPermission(
      userId,
      'voice-session',
      'view',
      voiceSession.userId
    );

    if (!hasAccess && voiceSession.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const participants = await voiceOrchestrator.getParticipants(voiceSessionId);

    res.json({ participants });
  } catch (error) {
    console.error('Error getting participants:', error);
    res.status(500).json({
      error: 'Failed to get participants',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Webhook endpoint for Retell AI events
 * POST /api/voice/webhook
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-retell-signature'] as string;
    const payload = JSON.stringify(req.body);

    // Verify webhook signature
    const retellClient = require('../services/retell.service').getRetellClient();
    const isValid = retellClient.verifyWebhookSignature(payload, signature);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const event = retellClient.parseWebhookEvent(req.body);

    // Handle different event types
    switch (event.type) {
      case 'session.started':
        console.log('Voice session started:', event.sessionId);
        break;
      case 'session.ended':
        console.log('Voice session ended:', event.sessionId);
        break;
      case 'transcript.segment':
        console.log('Transcript segment received:', event.sessionId);
        break;
      case 'error':
        console.error('Voice session error:', event.sessionId, event.data);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      error: 'Failed to process webhook',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

