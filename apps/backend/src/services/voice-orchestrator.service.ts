/**
 * Voice Orchestrator Service
 * 
 * Manages voice sessions via Retell AI with Airia governance.
 * All context is sanitized via Airia before transmission to Retell.
 * 
 * Requirements: 26.1, 26.3, 26.6, 41.1, 41.2
 */

import { v4 as uuidv4 } from 'uuid';
import {
  VoiceSession,
  VoiceConfig,
  VoiceParticipant,
  VoiceTranscript,
  TranscriptSegment,
  RawTranscript,
  SanitizedVoiceContext,
  VoiceUIState,
  VoiceUISyncEvent,
  VoiceQualityMetrics,
  StartVoiceSessionRequest,
  StartVoiceSessionResponse,
  EndVoiceSessionRequest,
  EndVoiceSessionResponse,
  JoinVoiceSessionRequest,
  JoinVoiceSessionResponse,
  RetentionPolicy,
} from '@codebase-onboarding/shared';

import { db } from '../db';
import { getRetellClient } from './retell.service';
import { getAiriaClient } from './airia.service';
import { sanitizationService } from './sanitization.service';
import { CostTrackerService } from './cost-tracker.service';
import { getRedisClient } from '../db/redis';

export class VoiceOrchestratorService {
  private retellClient = getRetellClient();
  private airiaClient = getAiriaClient();
  private redisClient = getRedisClient();
  private costTracker: CostTrackerService;

  constructor(costTracker: CostTrackerService) {
    this.costTracker = costTracker;
  }

  /**
   * Start a new voice session
   * Requirement 26.1: Integrate Retell AI for real-time voice interactions
   * Requirement 26.3: Initialize Retell AI agent with codebase context
   * Requirement 41.1: Route all Retell AI context through Airia's policy engine
   */
  async startVoiceSession(
    sessionId: string,
    userId: string,
    tenantId: string,
    request: StartVoiceSessionRequest
  ): Promise<StartVoiceSessionResponse> {
    // Get onboarding session
    const sessionResult = await db.query(
      'SELECT * FROM onboarding_sessions WHERE id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Onboarding session not found');
    }

    const session = sessionResult.rows[0];

    // Check if voice is enabled for this session
    if (!session.voice_enabled) {
      throw new Error('Voice is not enabled for this session');
    }

    // Get tenant voice configuration
    const voiceConfig = await this.getTenantVoiceConfig(tenantId, request.config);

    // Build raw context from session
    const rawContext = await this.buildRawContext(sessionId);

    // Sanitize context via Airia before sending to Retell
    // Requirement 41.2: Apply Airia's sensitive-data masking to all context sent to Retell AI
    const sanitizedContext = await this.sanitizeContextViaAiria(rawContext, tenantId);

    // Create voice session in database
    const voiceSessionId = uuidv4();
    const insertQuery = `
      INSERT INTO voice_sessions (
        id, session_id, retell_session_id, tenant_id, user_id, status,
        persona, barge_in_enabled, turn_taking_mode,
        audio_retention_hours, transcript_retention_hours, voice_latency_target
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const tempRetellSessionId = `pending-${voiceSessionId}`;
    const values = [
      voiceSessionId,
      sessionId,
      tempRetellSessionId,
      tenantId,
      userId,
      'initializing',
      voiceConfig.persona,
      voiceConfig.bargeInEnabled,
      voiceConfig.turnTakingMode,
      voiceConfig.audioRetentionPolicy.duration,
      voiceConfig.transcriptRetentionPolicy.duration,
      voiceConfig.voiceLatencyTarget,
    ];

    const result = await db.query(insertQuery, values);

    // Create Retell AI session
    const retellResponse = await this.retellClient.createSession({
      sessionId: voiceSessionId,
      tenantId,
      userId,
      persona: voiceConfig.persona,
      context: sanitizedContext,
      config: voiceConfig,
    });

    // Update with actual Retell session ID
    await db.query(
      'UPDATE voice_sessions SET retell_session_id = $1, status = $2 WHERE id = $3',
      [retellResponse.retellSessionId, 'active', voiceSessionId]
    );

    // Add owner as participant
    await this.addParticipant(voiceSessionId, userId, 'owner');

    // Track initial cost
    await this.costTracker.trackCost(sessionId, tenantId, userId, {
      service: 'retell',
      operation: 'voice-session-start',
      amount: 0.01, // Initial setup cost
      metadata: { voiceSessionId },
    });

    const voiceSession = this.mapRowToVoiceSession(result.rows[0]);
    voiceSession.retellSessionId = retellResponse.retellSessionId;
    voiceSession.status = 'active';

    return {
      voiceSession,
      connectionInfo: {
        webSocketUrl: retellResponse.webSocketUrl,
        phoneNumber: retellResponse.phoneNumber,
        expiresAt: retellResponse.expiresAt,
      },
    };
  }

  /**
   * End a voice session
   * Requirement 26.6: Synchronize voice explanations with terminal UI
   */
  async endVoiceSession(
    voiceSessionId: string,
    request: EndVoiceSessionRequest
  ): Promise<EndVoiceSessionResponse> {
    // Get voice session
    const voiceSession = await this.getVoiceSession(voiceSessionId);

    if (!voiceSession) {
      throw new Error('Voice session not found');
    }

    // End Retell AI session
    await this.retellClient.endSession(voiceSession.retellSessionId);

    // Get raw transcript from Retell
    const rawTranscriptData = await this.retellClient.getRawTranscript(
      voiceSession.retellSessionId
    );
    
    const rawTranscript: RawTranscript = {
      sessionId: voiceSessionId,
      segments: rawTranscriptData.segments,
    };

    // Sanitize transcript
    const sanitizedTranscript = await this.sanitizeTranscript(
      voiceSessionId,
      rawTranscript,
      voiceSession.tenantId
    );

    // Get quality metrics
    const retellMetrics = await this.retellClient.getQualityMetrics(
      voiceSession.retellSessionId
    );

    const qualityMetrics = await this.saveQualityMetrics(
      voiceSessionId,
      retellMetrics
    );

    // Calculate final cost
    const duration = voiceSession.endedAt
      ? (voiceSession.endedAt.getTime() - voiceSession.startedAt.getTime()) / 1000 / 60
      : 0;

    const voiceCost = duration * 0.10; // $0.10 per minute

    await this.costTracker.trackCost(
      voiceSession.sessionId,
      voiceSession.tenantId,
      voiceSession.userId,
      {
        service: 'retell',
        operation: 'voice-session-duration',
        amount: voiceCost,
        metadata: {
          voiceSessionId,
          durationMinutes: duration,
        },
      }
    );

    // Update voice session status
    await db.query(
      `UPDATE voice_sessions 
       SET status = $1, ended_at = CURRENT_TIMESTAMP, cost = $2 
       WHERE id = $3`,
      ['ended', voiceCost, voiceSessionId]
    );

    // Update participants
    await db.query(
      'UPDATE voice_participants SET is_active = false, left_at = CURRENT_TIMESTAMP WHERE voice_session_id = $1',
      [voiceSessionId]
    );

    const updatedSession = await this.getVoiceSession(voiceSessionId);

    return {
      voiceSession: updatedSession!,
      transcript: sanitizedTranscript,
      qualityMetrics,
    };
  }

  /**
   * Send sanitized context to Retell via Airia
   * Requirement 41.1: Route all Retell AI context through Airia's policy engine
   * Requirement 41.2: Apply Airia's sensitive-data masking
   */
  async sendVoiceContextViaAiria(
    voiceSessionId: string,
    rawContext: unknown
  ): Promise<void> {
    const voiceSession = await this.getVoiceSession(voiceSessionId);
    if (!voiceSession) {
      throw new Error('Voice session not found');
    }

    // Sanitize context via Airia
    const sanitizedContext = await this.sanitizeContextViaAiria(
      rawContext,
      voiceSession.tenantId
    );

    // Update Retell session context
    await this.retellClient.updateSessionContext(
      voiceSession.retellSessionId,
      sanitizedContext
    );
  }

  /**
   * Synchronize voice with UI state
   * Requirement 26.6: Synchronize voice explanations with terminal UI and visual outputs
   */
  async syncWithUI(
    voiceSessionId: string,
    uiState: VoiceUIState,
    transcriptSegmentId?: string
  ): Promise<void> {
    const voiceSession = await this.getVoiceSession(voiceSessionId);
    if (!voiceSession) {
      throw new Error('Voice session not found');
    }

    const timestampMs = Date.now() - voiceSession.startedAt.getTime();

    await db.query(
      `INSERT INTO voice_ui_sync_events (
        voice_session_id, timestamp_ms, transcript_segment_id,
        current_file, current_line, highlighted_code, active_diagram, scroll_position
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        voiceSessionId,
        timestampMs,
        transcriptSegmentId || null,
        uiState.currentFile || null,
        uiState.currentLine || null,
        JSON.stringify(uiState.highlightedCode || []),
        uiState.activeDiagram || null,
        uiState.scrollPosition || null,
      ]
    );

    // Broadcast to all participants via Redis pub/sub
    const redis = this.redisClient.getClient();
    await redis.publish(
      `voice:${voiceSessionId}:ui-sync`,
      JSON.stringify({
        voiceSessionId,
        timestamp: timestampMs,
        uiState,
        transcriptSegmentId,
      } as VoiceUISyncEvent)
    );
  }

  /**
   * Add a listener to a voice session
   * Requirement 27.1: Support collaborative "listen in" mode
   */
  async addListener(
    voiceSessionId: string,
    userId: string,
    role: 'collaborator' | 'listener'
  ): Promise<JoinVoiceSessionResponse> {
    const voiceSession = await this.getVoiceSession(voiceSessionId);
    if (!voiceSession) {
      throw new Error('Voice session not found');
    }

    // Add participant to Retell
    const connectionInfo = await this.retellClient.addParticipant(
      voiceSession.retellSessionId,
      userId,
      role
    );

    // Add participant to database
    const participant = await this.addParticipant(voiceSessionId, userId, role);

    return {
      voiceSession,
      participant,
      connectionInfo,
    };
  }

  /**
   * Remove a listener from a voice session
   */
  async removeListener(voiceSessionId: string, userId: string): Promise<void> {
    const voiceSession = await this.getVoiceSession(voiceSessionId);
    if (!voiceSession) {
      throw new Error('Voice session not found');
    }

    // Remove from Retell
    await this.retellClient.removeParticipant(voiceSession.retellSessionId, userId);

    // Update database
    await db.query(
      `UPDATE voice_participants 
       SET is_active = false, left_at = CURRENT_TIMESTAMP 
       WHERE voice_session_id = $1 AND user_id = $2`,
      [voiceSessionId, userId]
    );
  }

  /**
   * Get sanitized transcript
   * Requirement 28.5: Sanitize all voice transcripts to remove raw code, secrets, and PII
   */
  async getTranscript(voiceSessionId: string): Promise<VoiceTranscript | null> {
    const result = await db.query(
      'SELECT * FROM voice_transcripts WHERE voice_session_id = $1',
      [voiceSessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const transcript = result.rows[0];

    // Get segments
    const segmentsResult = await db.query(
      'SELECT * FROM transcript_segments WHERE transcript_id = $1 ORDER BY timestamp_ms',
      [transcript.id]
    );

    const segments: TranscriptSegment[] = segmentsResult.rows.map((row) => ({
      id: row.id,
      speaker: row.speaker,
      text: row.text,
      timestamp: row.timestamp_ms,
      references: row.references || [],
      duration: row.duration_ms,
    }));

    return {
      id: transcript.id,
      voiceSessionId: transcript.voice_session_id,
      segments,
      sanitized: true,
      retentionPolicy: {
        duration: transcript.retention_hours,
        deleteImmediately: false,
      },
      createdAt: transcript.created_at,
      expiresAt: transcript.expires_at,
    };
  }

  /**
   * Get voice session by ID
   */
  async getVoiceSession(voiceSessionId: string): Promise<VoiceSession | null> {
    const result = await db.query(
      'SELECT * FROM voice_sessions WHERE id = $1',
      [voiceSessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToVoiceSession(result.rows[0]);
  }

  /**
   * Get participants for a voice session
   */
  async getParticipants(voiceSessionId: string): Promise<VoiceParticipant[]> {
    const result = await db.query(
      'SELECT * FROM voice_participants WHERE voice_session_id = $1 ORDER BY joined_at',
      [voiceSessionId]
    );

    return result.rows.map((row) => ({
      userId: row.user_id,
      role: row.role,
      joinedAt: row.joined_at,
      leftAt: row.left_at,
      isActive: row.is_active,
    }));
  }

  /**
   * Build raw context from session (to be sanitized)
   */
  private async buildRawContext(sessionId: string): Promise<unknown> {
    // Get session data
    const sessionResult = await db.query(
      'SELECT * FROM onboarding_sessions WHERE id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const session = sessionResult.rows[0];

    // Build context object (will be sanitized by Airia)
    return {
      sessionId,
      repositoryName: session.repository_name,
      repositoryOwner: session.repository_owner,
      analysisScope: {
        type: session.analysis_scope_type,
        size: session.analysis_scope_size,
      },
      progress: session.progress,
      // Note: No raw code included here - will be fetched and sanitized by Airia as needed
    };
  }

  /**
   * Sanitize context via Airia before sending to Retell
   * Requirement 41.2: Apply Airia's sensitive-data masking
   */
  private async sanitizeContextViaAiria(
    rawContext: unknown,
    tenantId: string
  ): Promise<SanitizedVoiceContext> {
    // Convert context to string for masking
    const contextString = JSON.stringify(rawContext);

    // Mask sensitive data via Airia
    const maskedString = await this.airiaClient.maskSensitiveData(
      contextString,
      tenantId,
      'text'
    );

    const maskedContext = JSON.parse(maskedString);

    // Build sanitized context
    return {
      sessionId: maskedContext.sessionId,
      architectureSummary: maskedContext.repositoryName || 'Repository',
      currentFocus: {
        path: '',
        lineNumbers: [],
        relevance: 1.0,
      },
      availableCommands: [
        'explain architecture',
        'show data flow',
        'find feature',
        'explain this code',
      ],
      recentTopics: [],
    };
  }

  /**
   * Sanitize transcript before storage
   * Requirement 28.5: Sanitize all voice transcripts
   */
  private async sanitizeTranscript(
    voiceSessionId: string,
    rawTranscript: RawTranscript,
    tenantId: string
  ): Promise<VoiceTranscript> {
    const voiceSession = await this.getVoiceSession(voiceSessionId);
    if (!voiceSession) {
      throw new Error('Voice session not found');
    }

    const transcriptId = uuidv4();
    const retentionHours = voiceSession.config.transcriptRetentionPolicy.duration;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + retentionHours);

    // Create transcript record
    await db.query(
      `INSERT INTO voice_transcripts (id, voice_session_id, retention_hours, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [transcriptId, voiceSessionId, retentionHours, expiresAt]
    );

    // Sanitize and store segments
    const segments: TranscriptSegment[] = [];

    for (const rawSegment of rawTranscript.segments) {
      // Sanitize text via Airia
      const sanitizedText = await this.airiaClient.maskSensitiveData(
        rawSegment.text,
        tenantId,
        'transcript'
      );

      const segmentId = uuidv4();

      await db.query(
        `INSERT INTO transcript_segments (
          id, transcript_id, speaker, text, timestamp_ms, duration_ms, references
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          segmentId,
          transcriptId,
          rawSegment.speaker,
          sanitizedText,
          rawSegment.timestamp,
          rawSegment.duration,
          JSON.stringify([]),
        ]
      );

      segments.push({
        id: segmentId,
        speaker: rawSegment.speaker,
        text: sanitizedText,
        timestamp: rawSegment.timestamp,
        references: [],
        duration: rawSegment.duration,
      });
    }

    return {
      id: transcriptId,
      voiceSessionId,
      segments,
      sanitized: true,
      retentionPolicy: voiceSession.config.transcriptRetentionPolicy,
      createdAt: new Date(),
      expiresAt,
    };
  }

  /**
   * Get tenant voice configuration
   */
  private async getTenantVoiceConfig(
    tenantId: string,
    overrides?: Partial<VoiceConfig>
  ): Promise<VoiceConfig> {
    // Get tenant defaults
    const result = await db.query(
      'SELECT * FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Tenant not found');
    }

    // Default configuration
    const defaultConfig: VoiceConfig = {
      persona: 'helpful-guide',
      bargeInEnabled: true,
      turnTakingMode: 'automatic',
      audioRetentionPolicy: {
        duration: 24, // 24 hours
        deleteImmediately: false,
      },
      transcriptRetentionPolicy: {
        duration: 8760, // 1 year
        deleteImmediately: false,
      },
      voiceLatencyTarget: 800, // 800ms
    };

    // Merge with overrides
    return {
      ...defaultConfig,
      ...overrides,
    };
  }

  /**
   * Add participant to voice session
   */
  private async addParticipant(
    voiceSessionId: string,
    userId: string,
    role: 'owner' | 'collaborator' | 'listener'
  ): Promise<VoiceParticipant> {
    const participantId = uuidv4();

    await db.query(
      `INSERT INTO voice_participants (id, voice_session_id, user_id, role, is_active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (voice_session_id, user_id) 
       DO UPDATE SET is_active = true, joined_at = CURRENT_TIMESTAMP`,
      [participantId, voiceSessionId, userId, role, true]
    );

    return {
      userId,
      role,
      joinedAt: new Date(),
      isActive: true,
    };
  }

  /**
   * Save quality metrics
   */
  private async saveQualityMetrics(
    voiceSessionId: string,
    metrics: {
      averageLatency: number;
      maxLatency: number;
      bargeInCount: number;
      turnCount: number;
      qualityScore: number;
    }
  ): Promise<VoiceQualityMetrics> {
    await db.query(
      `INSERT INTO voice_quality_metrics (
        voice_session_id, average_latency_ms, max_latency_ms,
        barge_in_count, turn_count, quality_score
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (voice_session_id) 
      DO UPDATE SET
        average_latency_ms = EXCLUDED.average_latency_ms,
        max_latency_ms = EXCLUDED.max_latency_ms,
        barge_in_count = EXCLUDED.barge_in_count,
        turn_count = EXCLUDED.turn_count,
        quality_score = EXCLUDED.quality_score`,
      [
        voiceSessionId,
        metrics.averageLatency,
        metrics.maxLatency,
        metrics.bargeInCount,
        metrics.turnCount,
        metrics.qualityScore,
      ]
    );

    return {
      voiceSessionId,
      ...metrics,
      userSatisfaction: undefined,
    };
  }

  /**
   * Map database row to VoiceSession object
   */
  private mapRowToVoiceSession(row: any): VoiceSession {
    return {
      id: row.id,
      sessionId: row.session_id,
      retellSessionId: row.retell_session_id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      status: row.status,
      config: {
        persona: row.persona,
        bargeInEnabled: row.barge_in_enabled,
        turnTakingMode: row.turn_taking_mode,
        audioRetentionPolicy: {
          duration: row.audio_retention_hours,
          deleteImmediately: false,
        },
        transcriptRetentionPolicy: {
          duration: row.transcript_retention_hours,
          deleteImmediately: false,
        },
        voiceLatencyTarget: row.voice_latency_target,
      },
      participants: [],
      startedAt: row.started_at,
      endedAt: row.ended_at,
      cost: parseFloat(row.cost) || 0,
      metadata: row.metadata || {},
    };
  }
}
