/**
 * GitHub Integration Types
 * 
 * Types for GitHub API integration via Airia connectors
 * Requirements: 1.2, 1.3, 2.1, 2.4, 2.5, 6.5, 6.7
 */

/**
 * GitHub OAuth token with encryption
 * Requirement 1.2: Encrypt Access Token using AES-256 encryption
 */
export interface GitHubToken {
  encryptedToken: string;
  expiresAt: Date;
  refreshToken?: string;
  scope: string[];
}

/**
 * Repository metadata
 * Requirement 2.5: Display repository metadata
 */
export interface Repository {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  url: string;
  description: string | null;
  primaryLanguage: string | null;
  size: number; // in bytes
  hasSubmodules: boolean;
  defaultBranch: string;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Paginated repository list
 * Requirement 2.1: Display paginated lists of accessible repositories
 */
export interface RepositoryListResponse {
  repositories: Repository[];
  page: number;
  perPage: number;
  totalCount: number;
  hasNextPage: boolean;
}

/**
 * File tree node
 * Requirement 2.4: Validate repository accessibility
 */
export interface FileTreeNode {
  path: string;
  type: 'file' | 'directory' | 'submodule';
  size: number;
  sha: string;
  url: string;
}

/**
 * File tree response with caching metadata
 */
export interface FileTreeResponse {
  tree: FileTreeNode[];
  truncated: boolean;
  sha: string;
  cachedAt?: Date;
}

/**
 * Git commit information
 * Requirement 6.5: Analyze Git history with configurable branch selection
 */
export interface GitCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: Date;
  };
  committer: {
    name: string;
    email: string;
    date: Date;
  };
  parents: string[];
  url: string;
}

/**
 * Git commit history response
 * Requirement 6.5: Implement commit history fetching with depth limits
 */
export interface CommitHistoryResponse {
  commits: GitCommit[];
  branch: string;
  hasMore: boolean;
  depth: number;
}

/**
 * Git branch information
 */
export interface GitBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

/**
 * Commit diff information
 * Requirement 6.7: Build commit diff analysis
 */
export interface CommitDiff {
  sha: string;
  files: FileDiff[];
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
}

/**
 * File diff in a commit
 */
export interface FileDiff {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previousFilename?: string;
}

/**
 * GitHub API rate limit information
 * Requirement 2.8: Display remaining quota and estimated reset time
 */
export interface RateLimit {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

/**
 * Rate limit response
 */
export interface RateLimitResponse {
  core: RateLimit;
  search: RateLimit;
  graphql: RateLimit;
}

/**
 * Repository validation result
 * Requirement 2.4: Validate repository accessibility with retry logic
 */
export interface RepositoryValidation {
  accessible: boolean;
  exists: boolean;
  hasPermission: boolean;
  error?: string;
}

/**
 * Repository URL parse result
 */
export interface ParsedRepositoryUrl {
  owner: string;
  repo: string;
  isValid: boolean;
  error?: string;
}

/**
 * Scope validation result
 * Requirement 3.6: Prompt to reduce scope if exceeds 100MB
 */
export interface ScopeValidation {
  valid: boolean;
  totalSize: number;
  fileCount: number;
  exceedsLimit: boolean;
  suggestedExclusions?: string[];
}
