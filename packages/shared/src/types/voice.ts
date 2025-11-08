/**
 * Voice Integration Types
 * Types for Retell AI voice interactions, transcripts, and voice sessions
 */

import type { FileReference } from './common';

// ============================================================================
// Voice Session Types
// ============================================================================

export interface VoiceSession {
  id: string;
  sessionId: string; // Parent onboarding session ID
  retellSessionId: string; // Retell AI session ID
  tenantId: string;
  userId: string;
  status: VoiceSessionStatus;
  config: VoiceConfig;
  participants: VoiceParticipant[];
  startedAt: Date;
  endedAt?: Date;
  cost: number;
  metadata: Record<string, unknown>;
}

export type VoiceSessionStatus = 'initializing' | 'active' | 'paused' | 'ended' | 'failed';

export interface VoiceConfig {
  persona: string;
  bargeInEnabled: boolean;
  turnTakingMode: 'automatic' | 'manual';
  audioRetentionPolicy: VoiceRetentionPolicy;
  transcriptRetentionPolicy: VoiceRetentionPolicy;
  voiceLatencyTarget: number; // milliseconds, default 800
}

export interface VoiceRetentionPolicy {
  duration: number; // hours
  deleteImmediately: boolean;
}

export interface VoiceParticipant {
  userId: string;
  role: 'owner' | 'collaborator' | 'listener';
  joinedAt: Date;
  leftAt?: Date;
  isActive: boolean;
}

// ============================================================================
// Voice Context Types (Sanitized)
// ============================================================================

export interface SanitizedVoiceContext {
  sessionId: string;
  architectureSummary: string;
  currentFocus: FileReference;
  availableCommands: string[];
  recentTopics: string[];
  // No raw code included - sanitized by Airia before Retell
}

// ============================================================================
// Transcript Types
// ============================================================================

export interface VoiceTranscript {
  id: string;
  voiceSessionId: string;
  segments: TranscriptSegment[];
  sanitized: true; // Always true - only sanitized transcripts stored
  retentionPolicy: VoiceRetentionPolicy;
  createdAt: Date;
  expiresAt?: Date;
}

export interface TranscriptSegment {
  id: string;
  speaker: 'agent' | 'user';
  text: string; // Always sanitized - no raw code, secrets, or PII
  timestamp: number; // milliseconds from session start
  references: FileReference[]; // File paths and line numbers only
  duration: number; // milliseconds
}

export interface RawTranscript {
  segments: RawTranscriptSegment[];
  sessionId: string;
}

export interface RawTranscriptSegment {
  speaker: 'agent' | 'user';
  text: string;
  timestamp: number;
  duration: number;
}

// ============================================================================
// Voice Session Timeline Types
// ============================================================================

export interface VoiceSessionTimeline {
  voiceSessionId: string;
  events: VoiceSessionTimelineEvent[];
  totalDuration: number; // milliseconds
}

export interface VoiceSessionTimelineEvent {
  timestamp: number; // milliseconds from session start
  type: 'speech' | 'navigation' | 'diagram' | 'code-reference';
  speaker?: 'agent' | 'user';
  content: string; // Sanitized
  references: FileReference[];
  metadata: Record<string, unknown>;
}

// ============================================================================
// Retell AI Integration Types
// ============================================================================

export interface RetellConfig {
  apiKey: string;
  apiUrl: string;
  webhookSecret?: string;
}

export interface RetellSessionRequest {
  sessionId: string;
  tenantId: string;
  userId: string;
  persona: string;
  context: SanitizedVoiceContext;
  config: VoiceConfig;
}

export interface RetellSessionResponse {
  retellSessionId: string;
  webSocketUrl: string;
  phoneNumber?: string;
  expiresAt: Date;
}

export interface RetellWebhookEvent {
  type: 'session.started' | 'session.ended' | 'transcript.segment' | 'error';
  sessionId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

// ============================================================================
// Voice UI Synchronization Types
// ============================================================================

export interface VoiceUIState {
  currentFile?: string;
  currentLine?: number;
  highlightedCode?: string[];
  activeDiagram?: string;
  scrollPosition?: number;
}

export interface VoiceUISyncEvent {
  voiceSessionId: string;
  timestamp: number;
  uiState: VoiceUIState;
  transcriptSegmentId?: string;
}

// ============================================================================
// Voice Cost Tracking Types
// ============================================================================

export interface VoiceCostEntry {
  voiceSessionId: string;
  service: 'retell';
  operation: 'voice-session' | 'transcript-generation' | 'audio-storage';
  amount: number;
  duration?: number; // milliseconds
  metadata: Record<string, unknown>;
}

// ============================================================================
// Voice Collaboration Types
// ============================================================================

export interface VoiceCollaborationRequest {
  voiceSessionId: string;
  userId: string;
  role: 'collaborator' | 'listener';
}

export interface VoicePresenceUpdate {
  voiceSessionId: string;
  participants: VoiceParticipant[];
  timestamp: Date;
}

// ============================================================================
// Voice Quality Metrics
// ============================================================================

export interface VoiceQualityMetrics {
  voiceSessionId: string;
  averageLatency: number; // milliseconds
  maxLatency: number; // milliseconds
  bargeInCount: number;
  turnCount: number;
  qualityScore: number; // 1-5
  userSatisfaction?: number; // 1-5
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface StartVoiceSessionRequest {
  sessionId: string;
  config?: Partial<VoiceConfig>;
}

export interface StartVoiceSessionResponse {
  voiceSession: VoiceSession;
  connectionInfo: {
    webSocketUrl: string;
    phoneNumber?: string;
    expiresAt: Date;
  };
}

export interface EndVoiceSessionRequest {
  voiceSessionId: string;
  reason?: string;
}

export interface EndVoiceSessionResponse {
  voiceSession: VoiceSession;
  transcript: VoiceTranscript;
  qualityMetrics: VoiceQualityMetrics;
}

export interface GetTranscriptRequest {
  voiceSessionId: string;
  includeReferences?: boolean;
}

export interface GetTranscriptResponse {
  transcript: VoiceTranscript;
}

export interface JoinVoiceSessionRequest {
  voiceSessionId: string;
  userId: string;
  role: 'collaborator' | 'listener';
}

export interface JoinVoiceSessionResponse {
  voiceSession: VoiceSession;
  participant: VoiceParticipant;
  connectionInfo: {
    webSocketUrl: string;
    expiresAt: Date;
  };
}

export interface LeaveVoiceSessionRequest {
  voiceSessionId: string;
  userId: string;
}

export interface LeaveVoiceSessionResponse {
  success: boolean;
}
