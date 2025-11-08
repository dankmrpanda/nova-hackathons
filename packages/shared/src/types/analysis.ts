/**
 * Analysis Engine Types
 * Types for code analysis, AST parsing, and architecture detection
 */

import type { SanitizedArtifact } from './artifact';
import type { FileReference } from './common';
import type { AnalysisScope } from './session';

// Re-export common types
export type { FileReference };

// ============================================================================
// AST and Code Analysis Types
// ============================================================================

export interface SourceFile {
  path: string;
  content: string;
  language: SupportedLanguage;
  size: number;
}

export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'cpp'
  | 'unknown';

export interface ASTNode {
  type: string;
  name?: string;
  location: CodeLocation;
  children: ASTNode[];
  metadata: Record<string, unknown>;
}

export interface CodeLocation {
  file: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}

export interface ParseResult {
  success: boolean;
  ast?: ASTNode;
  error?: string;
  fallbackUsed: boolean;
  language: SupportedLanguage;
}

// ============================================================================
// Architecture Pattern Types
// ============================================================================

export type ArchitecturePatternType =
  | 'mvc'
  | 'microservices'
  | 'layered'
  | 'event-driven'
  | 'unknown';

export interface ArchitecturePattern {
  type: ArchitecturePatternType;
  confidence: number; // 0-1
  components: Component[];
  relationships: Relationship[];
  explanation: string;
}

export interface Component {
  name: string;
  type: string;
  files: string[];
  responsibilities: string[];
  location: CodeLocation;
}

export interface Relationship {
  from: string;
  to: string;
  type: 'depends-on' | 'calls' | 'imports' | 'extends' | 'implements';
  description: string;
}

// ============================================================================
// Data Flow Types
// ============================================================================

export interface DataFlowPath {
  entryPoint: CodeLocation;
  steps: DataFlowStep[];
  dataStructures: DataStructure[];
  depth: number;
}

export interface DataFlowStep {
  location: CodeLocation;
  operation: string;
  transformation?: string;
  dataIn: string[];
  dataOut: string[];
}

export interface DataStructure {
  name: string;
  type: string;
  fields: DataField[];
  location: CodeLocation;
  relationships: string[];
}

export interface DataField {
  name: string;
  type: string;
  optional: boolean;
}

export interface EntryPoint {
  type: 'api-endpoint' | 'event-handler' | 'main-function' | 'cli-command';
  name: string;
  location: CodeLocation;
  parameters: string[];
}

// ============================================================================
// Feature Location Types
// ============================================================================

export interface FeatureLocation {
  name: string;
  description: string;
  functionalArea: string;
  files: FileReference[];
  entryPoints: CodeLocation[];
  codeSnippets: CodeSnippet[];
}

export interface CodeSnippet {
  code: string;
  location: CodeLocation;
  context: string;
}

// ============================================================================
// Code Execution Types
// ============================================================================

export interface SandboxConfig {
  memoryLimit: number; // bytes (default 512MB)
  cpuLimit: number; // cores (default 1)
  timeLimit: number; // seconds (default 5)
  networkAccess: boolean; // default false
}

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  duration: number; // milliseconds
  memoryUsed?: number; // bytes
}

// ============================================================================
// Analysis Result Types
// ============================================================================

export interface AnalysisResult {
  sessionId: string;
  repositoryUrl: string;
  analysisScope: AnalysisScope;
  architecture: ArchitecturePattern[];
  features: FeatureLocation[];
  dataFlows: DataFlowPath[];
  executionResults: ExecutionResult[];
  sanitizedArtifacts: SanitizedArtifact[];
  startedAt: Date;
  completedAt?: Date;
  status: 'in-progress' | 'completed' | 'failed';
}

// ============================================================================
// Pattern Matching (Fallback) Types
// ============================================================================

export interface PatternAnalysis {
  patterns: DetectedPattern[];
  confidence: number;
  method: 'ast' | 'pattern-matching';
}

export interface DetectedPattern {
  type: string;
  name: string;
  locations: CodeLocation[];
  confidence: number;
  description: string;
}

// ============================================================================
// Call Graph Types
// ============================================================================

export interface CallGraph {
  nodes: CallGraphNode[];
  edges: CallGraphEdge[];
  maxDepth: number;
}

export interface CallGraphNode {
  id: string;
  name: string;
  location: CodeLocation;
  type: 'function' | 'method' | 'class' | 'module';
}

export interface CallGraphEdge {
  from: string;
  to: string;
  callType: 'direct' | 'indirect' | 'dynamic';
  location: CodeLocation;
}
