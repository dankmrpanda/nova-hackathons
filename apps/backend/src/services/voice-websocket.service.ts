// @ts-nocheck
/**
 * Voice WebSocket Service
 * Handles WebRTC signaling and real-time voice features
 * 
 * Requirements:
 * - 26.5: Support Barge-in allowing the Developer to interrupt the voice agent
 * - 26.6: Synchronize voice explanations with terminal UI and visual outputs
 * - 26.7: Generate live transcripts of Voice Sessions linked to code locations
 * - 32.1: Enable the voice agent to reference and explain architecture diagrams
 */

import type { Server as HTTPServer } from 'http';
import type {
  TranscriptSegment,
  VoiceUIState,
  VoiceUISyncEvent,
} from '@codebase-onboarding/shared';
import { v4 as uuidv4 } from 'uuid';
import { Server as WebSocketServer, WebSocket } from 'ws';

import { db } from '../db';
import { getRedisClient } from '../db/redis';
import { getRetellClient } from './retell.service';

interface VoiceWebSocketMessage {
  type: string;
  [key: string]: unknown;
}

interface VoiceConnection {
  ws: WebSocket;
  voiceSessionId: string;
  userId: string;
  role: 'owner' | 'collaborator' | 'listener';
  isAlive: boolean;
}

export class VoiceWebSocketService {
  private wss: WebSocketServer;
  private connections: Map<string, VoiceConnection> = new Map();
  private retellClient = getRetellClient();
  private redisClient = getRedisClient();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/voice',
    });

    this.initialize();
  }

  /**
   * Initialize WebSocket server
   */
  private initialize() {
    this.wss.on('connection', (ws: WebSocket, request) => {
      this.handleConnection(ws, request);
    });

    // Start heartbeat to detect dead connections
    this.startHeartbeat();

    console.log('Voice WebSocket service initialized');
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(ws: WebSocket, request: any) {
    try {
      // Extract voice session ID and user ID from query params
      const url = new URL(request.url, `http://${request.headers.host}`);
      const voiceSessionId = url.searchParams.get('voiceSessionId');
      const userId = url.searchParams.get('userId');

      if (!voiceSessionId || !userId) {
        ws.close(1008, 'Missing voiceSessionId or userId');
        return;
      }

      // Verify voice session exists and user has access
      const voiceSession = await this.getVoiceSession(voiceSessionId);
      if (!voiceSession) {
        ws.close(1008, 'Voice session not found');
        return;
      }

      // Determine user role
      const role = await this.getUserRole(voiceSessionId, userId);
      if (!role) {
        ws.close(1008, 'User not authorized for this voice session');
        return;
      }

      // Create connection
      const connectionId = uuidv4();
      const connection: VoiceConnection = {
        ws,
        voiceSessionId,
        userId,
        role,
        isAlive: true,
      };

      this.connections.set(connectionId, connection);

      console.log(
        `Voice WebSocket connected: ${connectionId} (session: ${voiceSessionId}, user: ${userId}, role: ${role})`
      );

      // Set up message handler
      ws.on('message', (data: Buffer) => {
        this.handleMessage(connectionId, data);
      });

      // Set up pong handler for heartbeat
      ws.on('pong', () => {
        connection.isAlive = true;
      });

      // Set up close handler
      ws.on('close', () => {
        this.handleDisconnection(connectionId);
      });

      // Set up error handler
      ws.on('error', (error) => {
        console.error(`WebSocket error for ${connectionId}:`, error);
        this.handleDisconnection(connectionId);
      });

      // Send welcome message
      this.sendMessage(connectionId, {
        type: 'connected',
        voiceSessionId,
        role,
      });

      // Subscribe to Redis pub/sub for UI sync events
      this.subscribeToUISyncEvents(connectionId, voiceSessionId);
    } catch (error) {
      console.error('Error handling WebSocket connection:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(connectionId: string, data: Buffer) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    try {
      const message: VoiceWebSocketMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'offer':
          // WebRTC offer from client
          await this.handleWebRTCOffer(connection, message);
          break;

        case 'ice-candidate':
          // ICE candidate from client
          await this.handleICECandidate(connection, message);
          break;

        case 'barge-in':
          // User interrupted agent
          // Requirement 26.5: Support Barge-in
          await this.handleBargeIn(connection, message);
          break;

        case 'request-turn':
          // User requests turn to speak (manual turn-taking)
          await this.handleTurnRequest(connection, message);
          break;

        case 'latency-check':
          // Latency measurement ping
          this.sendMessage(connectionId, {
            type: 'latency-response',
            timestamp: message.timestamp,
          });
          break;

        case 'ui-sync':
          // UI state update from client
          await this.handleUISync(connection, message);
          break;

        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error handling message for ${connectionId}:`, error);
    }
  }

  /**
   * Handle WebRTC offer
   */
  private async handleWebRTCOffer(
    connection: VoiceConnection,
    message: VoiceWebSocketMessage
  ) {
    // Forward offer to Retell AI and get answer
    const voiceSession = await this.getVoiceSession(connection.voiceSessionId);
    if (!voiceSession) {
      return;
    }

    // In a real implementation, this would negotiate with Retell AI
    // For now, send a mock answer
    this.sendToConnection(connection, {
      type: 'answer',
      sdp: message.sdp, // Mock SDP answer
    });
  }

  /**
   * Handle ICE candidate
   */
  private async handleICECandidate(
    connection: VoiceConnection,
    message: VoiceWebSocketMessage
  ) {
    // Forward ICE candidate to Retell AI
    // In a real implementation, this would be forwarded to the peer
    console.log('ICE candidate received:', message.candidate);
  }

  /**
   * Handle barge-in event
   * Requirement 26.5: Support Barge-in allowing the Developer to interrupt
   */
  private async handleBargeIn(
    connection: VoiceConnection,
    message: VoiceWebSocketMessage
  ) {
    console.log(`Barge-in detected for session ${connection.voiceSessionId}`);

    // Record barge-in event
    await db.query(
      `INSERT INTO voice_barge_in_events (voice_session_id, user_id, timestamp_ms)
       VALUES ($1, $2, $3)`,
      [connection.voiceSessionId, connection.userId, message.timestamp]
    );

    // Notify Retell AI to stop agent speech
    const voiceSession = await this.getVoiceSession(connection.voiceSessionId);
    if (voiceSession) {
      // In real implementation, send interrupt signal to Retell
      console.log('Sending interrupt signal to Retell AI');
    }

    // Broadcast to all participants
    this.broadcastToSession(connection.voiceSessionId, {
      type: 'barge-in-occurred',
      userId: connection.userId,
      timestamp: message.timestamp,
    });
  }

  /**
   * Handle turn request (manual turn-taking)
   */
  private async handleTurnRequest(
    connection: VoiceConnection,
    message: VoiceWebSocketMessage
  ) {
    const voiceSession = await this.getVoiceSession(connection.voiceSessionId);
    if (!voiceSession) {
      return;
    }

    // Check if turn-taking is manual
    if (voiceSession.turn_taking_mode !== 'manual') {
      this.sendToConnection(connection, {
        type: 'turn-denied',
        reason: 'Turn-taking is automatic',
      });
      return;
    }

    // Check if agent is currently speaking
    const isAgentSpeaking = await this.isAgentSpeaking(connection.voiceSessionId);
    if (isAgentSpeaking) {
      this.sendToConnection(connection, {
        type: 'turn-denied',
        reason: 'Agent is currently speaking',
      });
      return;
    }

    // Grant turn
    this.sendToConnection(connection, {
      type: 'turn-granted',
      timestamp: Date.now(),
    });

    // Broadcast to other participants
    this.broadcastToSession(
      connection.voiceSessionId,
      {
        type: 'turn-granted-to-user',
        userId: connection.userId,
      },
      connection.userId
    );
  }

  /**
   * Handle UI synchronization
   * Requirement 26.6: Synchronize voice explanations with terminal UI
   */
  private async handleUISync(
    connection: VoiceConnection,
    message: VoiceWebSocketMessage
  ) {
    const uiState = message.uiState as VoiceUIState;
    const transcriptSegmentId = message.transcriptSegmentId as string | undefined;

    // Store UI sync event in database
    const voiceSession = await this.getVoiceSession(connection.voiceSessionId);
    if (!voiceSession) {
      return;
    }

    const timestampMs = Date.now() - new Date(voiceSession.started_at).getTime();

    await db.query(
      `INSERT INTO voice_ui_sync_events (
        voice_session_id, timestamp_ms, transcript_segment_id,
        current_file, current_line, highlighted_code, active_diagram, scroll_position
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        connection.voiceSessionId,
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
      `voice:${connection.voiceSessionId}:ui-sync`,
      JSON.stringify({
        voiceSessionId: connection.voiceSessionId,
        timestamp: timestampMs,
        uiState,
        transcriptSegmentId,
      } as VoiceUISyncEvent)
    );
  }

  /**
   * Subscribe to UI sync events from Redis
   */
  private async subscribeToUISyncEvents(connectionId: string, voiceSessionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const redis = this.redisClient.getClient();
    const subscriber = redis.duplicate();

    await subscriber.connect();
    await subscriber.subscribe(`voice:${voiceSessionId}:ui-sync`, (message) => {
      try {
        const event: VoiceUISyncEvent = JSON.parse(message);
        this.sendToConnection(connection, {
          type: 'ui-sync',
          uiState: event.uiState,
          transcriptSegmentId: event.transcriptSegmentId,
        });
      } catch (error) {
        console.error('Error handling UI sync event:', error);
      }
    });
  }

  /**
   * Broadcast transcript segment to all participants
   * Requirement 26.7: Generate live transcripts
   */
  async broadcastTranscriptSegment(
    voiceSessionId: string,
    segment: TranscriptSegment
  ) {
    this.broadcastToSession(voiceSessionId, {
      type: 'transcript-segment',
      segment,
    });
  }

  /**
   * Broadcast agent speaking status
   */
  async broadcastAgentSpeaking(voiceSessionId: string, isSpeaking: boolean) {
    this.broadcastToSession(voiceSessionId, {
      type: isSpeaking ? 'agent-speaking' : 'agent-stopped',
      timestamp: Date.now(),
    });
  }

  /**
   * Send message to specific connection
   */
  private sendMessage(connectionId: string, message: VoiceWebSocketMessage) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.sendToConnection(connection, message);
    }
  }

  /**
   * Send message to connection
   */
  private sendToConnection(connection: VoiceConnection, message: VoiceWebSocketMessage) {
    if (connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all connections in a voice session
   */
  private broadcastToSession(
    voiceSessionId: string,
    message: VoiceWebSocketMessage,
    excludeUserId?: string
  ) {
    for (const connection of this.connections.values()) {
      if (
        connection.voiceSessionId === voiceSessionId &&
        connection.userId !== excludeUserId
      ) {
        this.sendToConnection(connection, message);
      }
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      console.log(
        `Voice WebSocket disconnected: ${connectionId} (session: ${connection.voiceSessionId})`
      );
      this.connections.delete(connectionId);
    }
  }

  /**
   * Start heartbeat to detect dead connections
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      for (const [connectionId, connection] of this.connections.entries()) {
        if (!connection.isAlive) {
          console.log(`Terminating dead connection: ${connectionId}`);
          connection.ws.terminate();
          this.connections.delete(connectionId);
          continue;
        }

        connection.isAlive = false;
        connection.ws.ping();
      }
    }, 30000); // 30 seconds
  }

  /**
   * Get voice session from database
   */
  private async getVoiceSession(voiceSessionId: string): Promise<any | null> {
    const result = await db.query('SELECT * FROM voice_sessions WHERE id = $1', [
      voiceSessionId,
    ]);

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get user role in voice session
   */
  private async getUserRole(
    voiceSessionId: string,
    userId: string
  ): Promise<'owner' | 'collaborator' | 'listener' | null> {
    const result = await db.query(
      'SELECT role FROM voice_participants WHERE voice_session_id = $1 AND user_id = $2 AND is_active = true',
      [voiceSessionId, userId]
    );

    return result.rows.length > 0 ? result.rows[0].role : null;
  }

  /**
   * Check if agent is currently speaking
   */
  private async isAgentSpeaking(voiceSessionId: string): Promise<boolean> {
    // In real implementation, check with Retell AI
    // For now, return false
    return false;
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    for (const connection of this.connections.values()) {
      connection.ws.close(1001, 'Server shutting down');
    }

    this.wss.close();
    console.log('Voice WebSocket service shut down');
  }
}

