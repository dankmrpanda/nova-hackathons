/**
 * Git History Analysis Service
 * 
 * Provides Git history analysis including commit history fetching,
 * branch selection, commit diff analysis, and architectural evolution tracking.
 * 
 * Requirements: 6.5, 6.7, 32.3, 32.5
 */

import {
  GitCommit,
  GitBranch,
  CommitHistoryResponse,
  CommitDiff,
  FileDiff,
} from '@codebase-onboarding/shared';

import { getGitHubService } from './github.service';
import { getRedisClient } from '../db';

/**
 * Maximum commit history depth
 * Requirement 6.5: Analyze Git history with maximum depth of 100 commits
 */
const MAX_COMMIT_DEPTH = 100;

/**
 * Cache TTL for Git history data
 */
const CACHE_TTL = {
  BRANCHES: 3600, // 1 hour
  COMMIT_HISTORY: 1800, // 30 minutes
  COMMIT_DIFF: 3600, // 1 hour
};

/**
 * Architectural pattern indicators in file paths and changes
 */
const ARCHITECTURE_INDICATORS = {
  mvc: ['controller', 'model', 'view', 'routes'],
  microservices: ['service', 'api', 'gateway', 'grpc', 'proto'],
  layered: ['presentation', 'business', 'data', 'domain', 'infrastructure'],
  eventDriven: ['event', 'handler', 'subscriber', 'publisher', 'queue', 'stream'],
  repository: ['repository', 'dao', 'persistence'],
  factory: ['factory', 'builder', 'creator'],
  singleton: ['singleton', 'instance'],
};

/**
 * Git history analysis service
 */
export class GitHistoryService {
  private githubService = getGitHubService();
  private redis = getRedisClient();

  /**
   * List all branches in repository
   * Requirement 6.5: Create branch selection interface
   */
  async listBranches(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string
  ): Promise<GitBranch[]> {
    // Check cache first
    const cacheKey = `git:branches:${tenantId}:${owner}:${repo}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const branches = await this.githubService.listBranches(userId, tenantId, owner, repo);

    // Cache for 1 hour
    await this.redis.setex(cacheKey, CACHE_TTL.BRANCHES, JSON.stringify(branches));

    return branches;
  }

  /**
   * Get commit history for a branch with depth limit
   * Requirement 6.5: Implement commit history fetching with depth limits (max 100)
   */
  async getCommitHistory(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string,
    branch: string,
    maxDepth?: number
  ): Promise<CommitHistoryResponse> {
    // Enforce maximum depth
    const depth = Math.min(maxDepth || MAX_COMMIT_DEPTH, MAX_COMMIT_DEPTH);

    // Check cache first
    const cacheKey = `git:history:${tenantId}:${owner}:${repo}:${branch}:${depth}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        ...parsed,
        commits: parsed.commits.map((c: any) => ({
          ...c,
          author: { ...c.author, date: new Date(c.author.date) },
          committer: { ...c.committer, date: new Date(c.committer.date) },
        })),
      };
    }

    const history = await this.githubService.getCommitHistory(
      userId,
      tenantId,
      owner,
      repo,
      branch,
      depth
    );

    // Cache for 30 minutes
    await this.redis.setex(cacheKey, CACHE_TTL.COMMIT_HISTORY, JSON.stringify(history));

    return history;
  }

  /**
   * Get commit diff with file changes
   * Requirement 6.7: Build commit diff analysis
   */
  async getCommitDiff(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string,
    sha: string
  ): Promise<CommitDiff> {
    // Check cache first
    const cacheKey = `git:diff:${tenantId}:${owner}:${repo}:${sha}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const diff = await this.githubService.getCommitDiff(userId, tenantId, owner, repo, sha);

    // Cache for 1 hour
    await this.redis.setex(cacheKey, CACHE_TTL.COMMIT_DIFF, JSON.stringify(diff));

    return diff;
  }

  /**
   * Compare two commits
   * Requirement 32.5: Allow Developer to request comparison of different code versions
   */
  async compareCommits(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string,
    baseSha: string,
    headSha: string
  ): Promise<{
    base: CommitDiff;
    head: CommitDiff;
    comparison: {
      filesChanged: number;
      additions: number;
      deletions: number;
      commonFiles: string[];
      uniqueToBase: string[];
      uniqueToHead: string[];
    };
  }> {
    const [baseDiff, headDiff] = await Promise.all([
      this.getCommitDiff(userId, tenantId, owner, repo, baseSha),
      this.getCommitDiff(userId, tenantId, owner, repo, headSha),
    ]);

    const baseFiles = new Set(baseDiff.files.map((f) => f.filename));
    const headFiles = new Set(headDiff.files.map((f) => f.filename));

    const commonFiles = Array.from(baseFiles).filter((f) => headFiles.has(f));
    const uniqueToBase = Array.from(baseFiles).filter((f) => !headFiles.has(f));
    const uniqueToHead = Array.from(headFiles).filter((f) => !baseFiles.has(f));

    return {
      base: baseDiff,
      head: headDiff,
      comparison: {
        filesChanged: baseFiles.size + headFiles.size - commonFiles.length,
        additions: baseDiff.stats.additions + headDiff.stats.additions,
        deletions: baseDiff.stats.deletions + headDiff.stats.deletions,
        commonFiles,
        uniqueToBase,
        uniqueToHead,
      },
    };
  }

  /**
   * Analyze architectural evolution over time
   * Requirement 6.7: Add architectural evolution tracking
   */
  async analyzeArchitecturalEvolution(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string,
    branch: string,
    maxDepth?: number
  ): Promise<{
    timeline: Array<{
      commit: GitCommit;
      architecturalChanges: {
        pattern: string;
        filesAdded: string[];
        filesModified: string[];
        filesRemoved: string[];
        significance: 'major' | 'minor' | 'none';
      }[];
    }>;
    summary: {
      dominantPatterns: string[];
      evolutionTrend: string;
      majorRefactorings: number;
    };
  }> {
    const history = await this.getCommitHistory(
      userId,
      tenantId,
      owner,
      repo,
      branch,
      maxDepth
    );

    const timeline: Array<{
      commit: GitCommit;
      architecturalChanges: {
        pattern: string;
        filesAdded: string[];
        filesModified: string[];
        filesRemoved: string[];
        significance: 'major' | 'minor' | 'none';
      }[];
    }> = [];

    const patternCounts = new Map<string, number>();
    let majorRefactorings = 0;

    // Analyze each commit for architectural changes
    for (const commit of history.commits) {
      try {
        const diff = await this.getCommitDiff(userId, tenantId, owner, repo, commit.sha);

        const architecturalChanges = this.detectArchitecturalChanges(diff);

        // Count pattern occurrences
        for (const change of architecturalChanges) {
          const count = patternCounts.get(change.pattern) || 0;
          patternCounts.set(change.pattern, count + 1);

          if (change.significance === 'major') {
            majorRefactorings++;
          }
        }

        if (architecturalChanges.length > 0) {
          timeline.push({
            commit,
            architecturalChanges,
          });
        }
      } catch (error) {
        // Skip commits that fail to fetch
        console.error(`Failed to analyze commit ${commit.sha}:`, error);
      }
    }

    // Determine dominant patterns
    const dominantPatterns = Array.from(patternCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([pattern]) => pattern);

    // Determine evolution trend
    const evolutionTrend = this.determineEvolutionTrend(timeline);

    return {
      timeline,
      summary: {
        dominantPatterns,
        evolutionTrend,
        majorRefactorings,
      },
    };
  }

  /**
   * Detect architectural changes in a commit diff
   */
  private detectArchitecturalChanges(diff: CommitDiff): Array<{
    pattern: string;
    filesAdded: string[];
    filesModified: string[];
    filesRemoved: string[];
    significance: 'major' | 'minor' | 'none';
  }> {
    const changes: Map<
      string,
      {
        pattern: string;
        filesAdded: string[];
        filesModified: string[];
        filesRemoved: string[];
      }
    > = new Map();

    // Analyze each file change
    for (const file of diff.files) {
      const patterns = this.identifyArchitecturalPatterns(file.filename);

      for (const pattern of patterns) {
        if (!changes.has(pattern)) {
          changes.set(pattern, {
            pattern,
            filesAdded: [],
            filesModified: [],
            filesRemoved: [],
          });
        }

        const change = changes.get(pattern)!;

        if (file.status === 'added') {
          change.filesAdded.push(file.filename);
        } else if (file.status === 'modified') {
          change.filesModified.push(file.filename);
        } else if (file.status === 'removed') {
          change.filesRemoved.push(file.filename);
        }
      }
    }

    // Determine significance of each change
    return Array.from(changes.values()).map((change) => {
      const totalChanges =
        change.filesAdded.length + change.filesModified.length + change.filesRemoved.length;

      let significance: 'major' | 'minor' | 'none' = 'none';

      if (totalChanges >= 10 || change.filesAdded.length >= 5) {
        significance = 'major';
      } else if (totalChanges >= 3) {
        significance = 'minor';
      }

      return {
        ...change,
        significance,
      };
    });
  }

  /**
   * Identify architectural patterns in a file path
   */
  private identifyArchitecturalPatterns(filePath: string): string[] {
    const patterns: string[] = [];
    const lowerPath = filePath.toLowerCase();

    for (const [pattern, indicators] of Object.entries(ARCHITECTURE_INDICATORS)) {
      if (indicators.some((indicator) => lowerPath.includes(indicator))) {
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  /**
   * Determine overall evolution trend
   */
  private determineEvolutionTrend(
    timeline: Array<{
      commit: GitCommit;
      architecturalChanges: any[];
    }>
  ): string {
    if (timeline.length === 0) {
      return 'No significant architectural changes detected';
    }

    const recentChanges = timeline.slice(0, Math.min(10, timeline.length));
    const majorChanges = recentChanges.filter((t) =>
      t.architecturalChanges.some((c) => c.significance === 'major')
    ).length;

    if (majorChanges >= 3) {
      return 'Active refactoring and architectural evolution';
    } else if (majorChanges >= 1) {
      return 'Moderate architectural changes';
    } else {
      return 'Stable architecture with incremental improvements';
    }
  }

  /**
   * Get commit statistics for a time period
   */
  async getCommitStatistics(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string,
    branch: string,
    maxDepth?: number
  ): Promise<{
    totalCommits: number;
    contributors: Array<{ name: string; email: string; commits: number }>;
    averageChangesPerCommit: number;
    mostActiveFiles: Array<{ filename: string; changes: number }>;
  }> {
    const history = await this.getCommitHistory(
      userId,
      tenantId,
      owner,
      repo,
      branch,
      maxDepth
    );

    const contributors = new Map<string, { name: string; email: string; commits: number }>();
    const fileChanges = new Map<string, number>();
    let totalChanges = 0;

    for (const commit of history.commits) {
      // Track contributors
      const authorKey = commit.author.email;
      if (!contributors.has(authorKey)) {
        contributors.set(authorKey, {
          name: commit.author.name,
          email: commit.author.email,
          commits: 0,
        });
      }
      contributors.get(authorKey)!.commits++;

      // Get commit diff to track file changes
      try {
        const diff = await this.getCommitDiff(userId, tenantId, owner, repo, commit.sha);
        totalChanges += diff.stats.total;

        for (const file of diff.files) {
          const changes = fileChanges.get(file.filename) || 0;
          fileChanges.set(file.filename, changes + file.changes);
        }
      } catch (error) {
        // Skip if diff fetch fails
      }
    }

    const mostActiveFiles = Array.from(fileChanges.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([filename, changes]) => ({ filename, changes }));

    return {
      totalCommits: history.commits.length,
      contributors: Array.from(contributors.values()).sort((a, b) => b.commits - a.commits),
      averageChangesPerCommit:
        history.commits.length > 0 ? totalChanges / history.commits.length : 0,
      mostActiveFiles,
    };
  }

  /**
   * Get maximum commit depth
   */
  getMaxCommitDepth(): number {
    return MAX_COMMIT_DEPTH;
  }
}

// Singleton instance
let gitHistoryServiceInstance: GitHistoryService | null = null;

/**
 * Get singleton instance of Git history service
 */
export function getGitHistoryService(): GitHistoryService {
  if (!gitHistoryServiceInstance) {
    gitHistoryServiceInstance = new GitHistoryService();
  }
  return gitHistoryServiceInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetGitHistoryService(): void {
  gitHistoryServiceInstance = null;
}
