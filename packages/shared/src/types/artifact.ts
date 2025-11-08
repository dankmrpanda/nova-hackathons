/**
 * Artifact Management Types
 * Types for sanitized artifacts, interactive scripts, and templates
 */

import { FileReference } from './common';

// ============================================================================
// Retention Policy Types
// ============================================================================

export interface ArtifactRetentionPolicy {
  type: 'immediate' | 'hours' | 'days' | 'years';
  duration: number;
  autoDelete: boolean;
}

// ============================================================================
// Sanitized Artifact Types
// ============================================================================

export type ArtifactType = 'explanation' | 'diagram' | 'transcript' | 'script';

export interface SanitizedArtifact {
  id: string;
  type: ArtifactType;
  content: string;
  references: FileReference[];
  metadata: ArtifactMetadata;
  createdAt: Date;
  retentionPolicy: ArtifactRetentionPolicy;
}

export interface ArtifactMetadata {
  sessionId: string;
  tenantId: string;
  userId: string;
  size: number;
  format?: string;
  version?: string;
  [key: string]: unknown;
}

// ============================================================================
// Interactive Script Types
// ============================================================================

export interface InteractiveScript {
  id: string;
  sessionId: string;
  tenantId: string;
  userId: string;
  sections: ScriptSection[];
  voiceTimeline?: VoiceTimeline;
  diagrams: Diagram[];
  annotations: Annotation[];
  metadata: ScriptMetadata;
  retentionPolicy: ArtifactRetentionPolicy;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScriptSection {
  id: string;
  title: string;
  explanation: string; // Sanitized - no raw code
  references: FileReference[];
  timestamp?: number; // For voice sync
  order: number;
  duration?: number; // milliseconds
}

export interface VoiceTimeline {
  segments: VoiceSegment[];
  totalDuration: number; // milliseconds
  sanitized: true; // Always true
}

export interface VoiceSegment {
  id: string;
  speaker: 'agent' | 'user';
  text: string; // Sanitized transcript
  timestamp: number; // milliseconds from start
  duration: number; // milliseconds
  references: FileReference[];
  sectionId?: string; // Link to script section
}

export interface Diagram {
  id: string;
  type: 'mermaid' | 'animation' | 'static';
  title: string;
  content: string; // Mermaid code or URL
  format: 'svg' | 'png' | 'mp4';
  sectionId?: string;
  metadata: Record<string, unknown>;
}

export interface Annotation {
  id: string;
  sectionId: string;
  userId: string;
  content: string;
  timestamp: number;
  createdAt: Date;
}

export interface ScriptMetadata {
  repositoryUrl: string;
  repositoryName: string;
  analysisScope: string;
  totalDuration?: number;
  sectionCount: number;
  diagramCount: number;
  hasVoice: boolean;
  version: string;
}

// ============================================================================
// Template Types
// ============================================================================

export interface Template {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  tenantId: string;
  script: InteractiveScript;
  version: string;
  sharedWith: string[]; // tenant IDs
  tags: string[];
  usageCount: number;
  rating?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateMetadata {
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number; // minutes
  prerequisites: string[];
  learningObjectives: string[];
}

export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizationCheck: {
    passed: boolean;
    violations: string[];
  };
}

// ============================================================================
// Playback Types
// ============================================================================

export interface PlaybackState {
  scriptId: string;
  currentSectionId: string;
  currentTimestamp: number;
  speed: number; // 0.5x to 2x
  isPaused: boolean;
  isComplete: boolean;
}

export interface PlaybackControls {
  play: () => void;
  pause: () => void;
  seek: (timestamp: number) => void;
  setSpeed: (speed: number) => void;
  nextSection: () => void;
  previousSection: () => void;
  jumpToSection: (sectionId: string) => void;
}

// ============================================================================
// Export Types
// ============================================================================

export interface ScriptExportOptions {
  format: 'json' | 'markdown' | 'pdf' | 'html';
  includeVoice: boolean;
  includeDiagrams: boolean;
  includeAnnotations: boolean;
}

export interface ScriptExportResult {
  format: string;
  content: string | Buffer;
  filename: string;
  size: number;
}
