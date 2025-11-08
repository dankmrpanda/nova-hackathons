/**
 * Common Types
 * Shared types used across multiple modules to avoid circular dependencies
 */

// ============================================================================
// File Reference Types
// ============================================================================

export interface FileReference {
  path: string;
  lineNumbers: number[];
  relevance: number; // 0-1
}
