/**
 * Repository Selection and Validation Service
 * 
 * Handles repository URL parsing, validation, accessibility checking,
 * and analysis scope selection with size calculation.
 * 
 * Requirements: 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

import {
  ParsedRepositoryUrl,
  RepositoryValidation,
  AnalysisScope,
  ScopeValidation,
  FileTreeNode,
} from '@codebase-onboarding/shared';

import { getGitHubService } from './github.service';

/**
 * Default exclusion patterns for analysis
 * Requirement 3.7: Exclude binary files, generated files, and dependency directories
 */
const DEFAULT_EXCLUSIONS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  'out/**',
  'target/**',
  '.next/**',
  '.nuxt/**',
  'vendor/**',
  '__pycache__/**',
  '*.pyc',
  '.venv/**',
  'venv/**',
  'coverage/**',
  '.coverage/**',
  '*.min.js',
  '*.min.css',
  '*.map',
  '*.lock',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'Gemfile.lock',
  'poetry.lock',
  '*.jpg',
  '*.jpeg',
  '*.png',
  '*.gif',
  '*.svg',
  '*.ico',
  '*.pdf',
  '*.zip',
  '*.tar',
  '*.gz',
  '*.exe',
  '*.dll',
  '*.so',
  '*.dylib',
];

/**
 * Maximum analysis scope size (100MB)
 * Requirement 3.4: Analyze entire repository up to 100MB total size
 */
const MAX_SCOPE_SIZE = 100 * 1024 * 1024; // 100MB in bytes

/**
 * Repository selection and validation service
 */
export class RepositoryService {
  private githubService = getGitHubService();

  /**
   * Parse and validate repository URL
   * Requirement 2.3: Accept GitHub repository URL as input for public repositories
   */
  parseRepositoryUrl(url: string): ParsedRepositoryUrl {
    return this.githubService.parseRepositoryUrl(url);
  }

  /**
   * Validate repository accessibility
   * Requirement 2.4: Validate repository accessibility with retry logic
   */
  async validateRepository(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string
  ): Promise<RepositoryValidation> {
    return await this.githubService.validateRepository(userId, tenantId, owner, repo);
  }

  /**
   * Validate repository by URL
   */
  async validateRepositoryByUrl(
    userId: string,
    tenantId: string,
    url: string
  ): Promise<RepositoryValidation & { parsed?: ParsedRepositoryUrl }> {
    const parsed = this.parseRepositoryUrl(url);

    if (!parsed.isValid) {
      return {
        accessible: false,
        exists: false,
        hasPermission: false,
        error: parsed.error,
        parsed,
      };
    }

    const validation = await this.validateRepository(
      userId,
      tenantId,
      parsed.owner,
      parsed.repo
    );

    return {
      ...validation,
      parsed,
    };
  }

  /**
   * Calculate total size and file count for given paths
   * Requirement 3.5: Display total size, file count, and estimated cost
   */
  private calculateScopeMetrics(
    tree: FileTreeNode[],
    includedPaths: string[],
    excludedPaths: string[]
  ): { totalSize: number; fileCount: number } {
    let totalSize = 0;
    let fileCount = 0;

    // If no included paths specified, include all
    const includeAll = includedPaths.length === 0;

    for (const node of tree) {
      // Skip directories and submodules
      if (node.type !== 'file') {
        continue;
      }

      // Check if path is excluded
      if (this.isPathExcluded(node.path, excludedPaths)) {
        continue;
      }

      // Check if path is included
      if (!includeAll && !this.isPathIncluded(node.path, includedPaths)) {
        continue;
      }

      totalSize += node.size;
      fileCount++;
    }

    return { totalSize, fileCount };
  }

  /**
   * Check if path matches any exclusion pattern
   */
  private isPathExcluded(path: string, exclusions: string[]): boolean {
    return exclusions.some((pattern) => this.matchesPattern(path, pattern));
  }

  /**
   * Check if path matches any inclusion pattern
   */
  private isPathIncluded(path: string, inclusions: string[]): boolean {
    return inclusions.some((pattern) => this.matchesPattern(path, pattern));
  }

  /**
   * Simple glob pattern matching
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Get file tree with scope calculation
   * Requirement 3.1: Display repository's file tree structure with file sizes
   */
  async getFileTreeWithScope(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string,
    branch?: string
  ): Promise<{
    tree: FileTreeNode[];
    totalSize: number;
    fileCount: number;
    hasSubmodules: boolean;
  }> {
    const fileTree = await this.githubService.getFileTree(
      userId,
      tenantId,
      owner,
      repo,
      branch,
      true
    );

    const hasSubmodules = fileTree.tree.some((node) => node.type === 'submodule');

    // Calculate total size excluding default exclusions
    const { totalSize, fileCount } = this.calculateScopeMetrics(
      fileTree.tree,
      [],
      DEFAULT_EXCLUSIONS
    );

    return {
      tree: fileTree.tree,
      totalSize,
      fileCount,
      hasSubmodules,
    };
  }

  /**
   * Validate analysis scope
   * Requirement 3.6: Prompt to reduce scope if exceeds 100MB
   */
  async validateScope(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string,
    scope: AnalysisScope,
    branch?: string
  ): Promise<ScopeValidation> {
    const fileTree = await this.githubService.getFileTree(
      userId,
      tenantId,
      owner,
      repo,
      branch,
      true
    );

    // Combine default exclusions with user-specified exclusions
    const allExclusions = [...DEFAULT_EXCLUSIONS, ...scope.excludedPaths];

    const { totalSize, fileCount } = this.calculateScopeMetrics(
      fileTree.tree,
      scope.includedPaths,
      allExclusions
    );

    const exceedsLimit = totalSize > scope.maxSize;

    // Generate suggestions if scope exceeds limit
    let suggestedExclusions: string[] | undefined;
    if (exceedsLimit) {
      suggestedExclusions = this.generateExclusionSuggestions(
        fileTree.tree,
        scope.includedPaths,
        allExclusions,
        totalSize,
        scope.maxSize
      );
    }

    return {
      valid: !exceedsLimit,
      totalSize,
      fileCount,
      exceedsLimit,
      suggestedExclusions,
    };
  }

  /**
   * Generate suggestions for reducing scope
   */
  private generateExclusionSuggestions(
    tree: FileTreeNode[],
    includedPaths: string[],
    excludedPaths: string[],
    currentSize: number,
    maxSize: number
  ): string[] {
    const suggestions: string[] = [];
    const includeAll = includedPaths.length === 0;

    // Find largest directories
    const directorySizes = new Map<string, number>();

    for (const node of tree) {
      if (node.type !== 'file') continue;
      if (this.isPathExcluded(node.path, excludedPaths)) continue;
      if (!includeAll && !this.isPathIncluded(node.path, includedPaths)) continue;

      // Get directory path
      const dirPath = node.path.split('/').slice(0, -1).join('/');
      if (dirPath) {
        const currentDirSize = directorySizes.get(dirPath) || 0;
        directorySizes.set(dirPath, currentDirSize + node.size);
      }
    }

    // Sort directories by size
    const sortedDirs = Array.from(directorySizes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // Top 5 largest directories

    // Calculate how much we need to reduce
    const excessSize = currentSize - maxSize;
    let reducedSize = 0;

    for (const [dirPath, size] of sortedDirs) {
      if (reducedSize >= excessSize) break;
      suggestions.push(`${dirPath}/**`);
      reducedSize += size;
    }

    return suggestions;
  }

  /**
   * Create analysis scope with validation
   * Requirement 3.2: Allow Developer to select individual files for analysis
   * Requirement 3.3: Allow Developer to select entire folders for analysis
   */
  async createAnalysisScope(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string,
    options: {
      type: 'full' | 'partial';
      includedPaths?: string[];
      excludedPaths?: string[];
      includeSubmodules?: boolean;
      branch?: string;
    }
  ): Promise<{
    scope: AnalysisScope;
    validation: ScopeValidation;
  }> {
    const scope: AnalysisScope = {
      type: options.type,
      includedPaths: options.includedPaths || [],
      excludedPaths: [...DEFAULT_EXCLUSIONS, ...(options.excludedPaths || [])],
      maxSize: MAX_SCOPE_SIZE,
      includeSubmodules: options.includeSubmodules || false,
    };

    const validation = await this.validateScope(
      userId,
      tenantId,
      owner,
      repo,
      scope,
      options.branch
    );

    return {
      scope,
      validation,
    };
  }

  /**
   * Get suggested files for analysis based on repository structure
   */
  async getSuggestedFiles(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string,
    branch?: string
  ): Promise<string[]> {
    const fileTree = await this.githubService.getFileTree(
      userId,
      tenantId,
      owner,
      repo,
      branch,
      true
    );

    const suggestions: string[] = [];

    // Priority files to include
    const priorityPatterns = [
      'README.md',
      'README.txt',
      'ARCHITECTURE.md',
      'CONTRIBUTING.md',
      'package.json',
      'Cargo.toml',
      'go.mod',
      'pom.xml',
      'build.gradle',
      'setup.py',
      'requirements.txt',
      'Gemfile',
      'composer.json',
    ];

    for (const node of fileTree.tree) {
      if (node.type !== 'file') continue;

      const fileName = node.path.split('/').pop() || '';
      if (priorityPatterns.includes(fileName)) {
        suggestions.push(node.path);
      }
    }

    return suggestions;
  }

  /**
   * Get default exclusion patterns
   */
  getDefaultExclusions(): string[] {
    return [...DEFAULT_EXCLUSIONS];
  }

  /**
   * Get maximum scope size
   */
  getMaxScopeSize(): number {
    return MAX_SCOPE_SIZE;
  }
}

// Singleton instance
let repositoryServiceInstance: RepositoryService | null = null;

/**
 * Get singleton instance of repository service
 */
export function getRepositoryService(): RepositoryService {
  if (!repositoryServiceInstance) {
    repositoryServiceInstance = new RepositoryService();
  }
  return repositoryServiceInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetRepositoryService(): void {
  repositoryServiceInstance = null;
}
