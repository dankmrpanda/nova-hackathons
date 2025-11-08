export type SessionStatus = 'initializing' | 'analyzing' | 'paused' | 'completed' | 'terminated';

export type AnalysisScopeType = 'full' | 'partial';

export type OutputFormat = 'text' | 'animation';

export interface AnalysisScope {
  type: AnalysisScopeType;
  includedPaths: string[];
  excludedPaths: string[];
  maxSize: number;
  includeSubmodules: boolean;
}

export interface SessionConfig {
  userId: string;
  tenantId: string;
  repositoryUrl: string;
  repositoryName?: string;
  repositoryOwner?: string;
  repositoryBranch?: string;
  repositoryCommitSha?: string;
  analysisScope: AnalysisScope;
  modelPreference?: string;
  outputFormat: OutputFormat;
  voiceEnabled: boolean;
  randomSeed?: number;
  costLimit?: number;
}

export interface SessionState {
  status: SessionStatus;
  progress: number;
  currentCost: number;
  artifacts: ArtifactReference[];
  learningProfileUpdates: LearningProfileUpdate[];
}

export interface ArtifactReference {
  id: string;
  type: string;
  url: string;
  createdAt: Date;
}

export interface LearningProfileUpdate {
  conceptId: string;
  understood: boolean;
  timestamp: Date;
}

export interface OnboardingSession {
  id: string;
  userId: string;
  tenantId: string;
  status: SessionStatus;
  
  // Configuration
  repositoryUrl: string;
  repositoryName?: string;
  repositoryOwner?: string;
  repositoryBranch?: string;
  repositoryCommitSha?: string;
  
  // Analysis scope
  analysisScopeType?: AnalysisScopeType;
  analysisScopePaths?: string[];
  analysisScopeSize?: number;
  
  // Model and output preferences
  modelPreference?: string;
  outputFormat?: OutputFormat;
  voiceEnabled: boolean;
  randomSeed?: number;
  
  // State tracking
  progress: number;
  currentCost: number;
  costLimit?: number;
  
  // Artifacts
  artifacts: ArtifactReference[];
  
  // Learning profile updates
  learningProfileUpdates: LearningProfileUpdate[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  terminatedAt?: Date;
  terminationReason?: string;
  
  // Metadata
  metadata?: Record<string, any>;
}

export interface CollaboratorPermissions {
  canView: boolean;
  canInteract: boolean;
  canAnnotate: boolean;
}

export interface Collaborator {
  id: string;
  sessionId: string;
  userId: string;
  permissions: CollaboratorPermissions;
  joinedAt: Date;
  lastActiveAt: Date;
  shareLinkToken?: string;
  shareLinkExpiresAt?: Date;
}

export interface ShareLink {
  token: string;
  sessionId: string;
  expiresAt: Date;
  permissions: CollaboratorPermissions;
}

export interface CreateSessionRequest {
  repositoryUrl: string;
  repositoryBranch?: string;
  analysisScope: AnalysisScope;
  modelPreference?: string;
  outputFormat: OutputFormat;
  voiceEnabled?: boolean;
  randomSeed?: number;
}

export interface UpdateSessionRequest {
  status?: SessionStatus;
  progress?: number;
  currentCost?: number;
  artifacts?: ArtifactReference[];
  learningProfileUpdates?: LearningProfileUpdate[];
  terminationReason?: string;
}

export interface SessionListQuery {
  userId?: string;
  tenantId?: string;
  status?: SessionStatus;
  limit?: number;
  offset?: number;
}
