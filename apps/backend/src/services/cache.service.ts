/**
 * Cache Service
 * 
 * Implements Redis caching layer with TTL management and tenant isolation
 * Task: 11.2 Implement Redis caching layer
 * Requirements: 14.7, 39.2, 39.5
 */

import { getRedisClient } from '../db/redis';

/**
 * Cache key prefixes for different data types
 */
const CACHE_PREFIXES = {
  SESSION_STATE: 'session:state',
  REPO_METADATA: 'repo:metadata',
  EMBEDDINGS: 'embeddings',
  COST_ACCUMULATION: 'cost:accumulation',
  ANALYSIS_RESULTS: 'analysis:results',
  FILE_TREE: 'file:tree',
  AST_CACHE: 'ast:cache',
  RATE_LIMIT: 'rate:limit',
} as const;

/**
 * TTL values in seconds
 */
const TTL = {
  SESSION_STATE: 28800, // 8 hours (session lifetime)
  REPO_METADATA: 3600, // 1 hour
  EMBEDDINGS: 86400, // 24 hours
  COST_ACCUMULATION: 28800, // 8 hours (session lifetime)
  ANALYSIS_RESULTS: 86400, // 24 hours
  FILE_TREE: 3600, // 1 hour
  AST_CACHE: 86400, // 24 hours
  RATE_LIMIT: 3600, // 1 hour
} as const;

export interface SessionStateCache {
  sessionId: string;
  status: string;
  progress: number;
  currentCost: number;
  artifacts: string[];
  lastUpdated: string;
}

export interface RepoMetadataCache {
  url: string;
  name: string;
  owner: string;
  branch: string;
  commitSha: string;
  size: number;
  primaryLanguage: string;
  fileCount: number;
  lastFetched: string;
}

export interface EmbeddingCache {
  hash: string;
  embedding: number[];
  model: string;
  tenantId: string;
  createdAt: string;
}

export interface CostAccumulationCache {
  sessionId: string;
  totalCost: number;
  breakdown: {
    openrouter: number;
    retell: number;
    modal: number;
    github: number;
  };
  lastUpdated: string;
}

/**
 * Cache Service for managing Redis cache operations
 */
export class CacheService {
  private redis = getRedisClient();

  /**
   * Build cache key with tenant isolation
   */
  private buildKey(prefix: string, identifier: string, tenantId?: string): string {
    if (tenantId) {
      return `${prefix}:${tenantId}:${identifier}`;
    }
    return `${prefix}:${identifier}`;
  }

  // ============================================================================
  // Session State Caching
  // ============================================================================

  /**
   * Cache session state
   * Requirement 14.7: Cache session state with TTL
   */
  async cacheSessionState(sessionId: string, state: SessionStateCache): Promise<void> {
    const key = this.buildKey(CACHE_PREFIXES.SESSION_STATE, sessionId);
    await this.redis.setex(key, TTL.SESSION_STATE, JSON.stringify(state));
  }

  /**
   * Get cached session state
   */
  async getSessionState(sessionId: string): Promise<SessionStateCache | null> {
    const key = this.buildKey(CACHE_PREFIXES.SESSION_STATE, sessionId);
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Update session state field
   */
  async updateSessionStateField(
    sessionId: string,
    field: keyof SessionStateCache,
    value: string | number | string[]
  ): Promise<void> {
    const state = await this.getSessionState(sessionId);
    if (state) {
      (state[field] as string | number | string[]) = value;
      state.lastUpdated = new Date().toISOString();
      await this.cacheSessionState(sessionId, state);
    }
  }

  /**
   * Delete session state cache
   */
  async deleteSessionState(sessionId: string): Promise<void> {
    const key = this.buildKey(CACHE_PREFIXES.SESSION_STATE, sessionId);
    await this.redis.del(key);
  }

  // ============================================================================
  // Repository Metadata Caching
  // ============================================================================

  /**
   * Cache repository metadata (1 hour TTL)
   * Requirement 39.2: Cache repository metadata with tenant isolation
   */
  async cacheRepoMetadata(
    repoUrl: string,
    metadata: RepoMetadataCache,
    tenantId: string
  ): Promise<void> {
    const key = this.buildKey(CACHE_PREFIXES.REPO_METADATA, repoUrl, tenantId);
    await this.redis.setex(key, TTL.REPO_METADATA, JSON.stringify(metadata));
  }

  /**
   * Get cached repository metadata
   */
  async getRepoMetadata(repoUrl: string, tenantId: string): Promise<RepoMetadataCache | null> {
    const key = this.buildKey(CACHE_PREFIXES.REPO_METADATA, repoUrl, tenantId);
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Delete repository metadata cache
   */
  async deleteRepoMetadata(repoUrl: string, tenantId: string): Promise<void> {
    const key = this.buildKey(CACHE_PREFIXES.REPO_METADATA, repoUrl, tenantId);
    await this.redis.del(key);
  }

  /**
   * Delete all repository metadata for a tenant
   */
  async deleteAllRepoMetadataForTenant(tenantId: string): Promise<void> {
    const pattern = this.buildKey(CACHE_PREFIXES.REPO_METADATA, '*', tenantId);
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await Promise.all(keys.map((key) => this.redis.del(key)));
    }
  }

  // ============================================================================
  // Embeddings Caching
  // ============================================================================

  /**
   * Cache embeddings (24 hour TTL, tenant-isolated)
   * Requirement 39.5: Tenant isolation for embeddings cache
   */
  async cacheEmbedding(
    contentHash: string,
    embedding: number[],
    model: string,
    tenantId: string
  ): Promise<void> {
    const key = this.buildKey(CACHE_PREFIXES.EMBEDDINGS, contentHash, tenantId);
    const data: EmbeddingCache = {
      hash: contentHash,
      embedding,
      model,
      tenantId,
      createdAt: new Date().toISOString(),
    };
    await this.redis.setex(key, TTL.EMBEDDINGS, JSON.stringify(data));
  }

  /**
   * Get cached embedding
   */
  async getEmbedding(contentHash: string, tenantId: string): Promise<number[] | null> {
    const key = this.buildKey(CACHE_PREFIXES.EMBEDDINGS, contentHash, tenantId);
    const data = await this.redis.get(key);
    if (!data) return null;

    const cached: EmbeddingCache = JSON.parse(data);
    // Verify tenant isolation
    if (cached.tenantId !== tenantId) {
      console.error('Tenant isolation violation detected in embeddings cache');
      await this.redis.del(key);
      return null;
    }
    return cached.embedding;
  }

  /**
   * Delete all embeddings for a tenant
   */
  async deleteAllEmbeddingsForTenant(tenantId: string): Promise<void> {
    const pattern = this.buildKey(CACHE_PREFIXES.EMBEDDINGS, '*', tenantId);
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await Promise.all(keys.map((key) => this.redis.del(key)));
    }
  }

  // ============================================================================
  // Cost Accumulation Caching
  // ============================================================================

  /**
   * Initialize cost accumulation cache for session
   */
  async initializeCostAccumulation(sessionId: string): Promise<void> {
    const key = this.buildKey(CACHE_PREFIXES.COST_ACCUMULATION, sessionId);
    const data: CostAccumulationCache = {
      sessionId,
      totalCost: 0,
      breakdown: {
        openrouter: 0,
        retell: 0,
        modal: 0,
        github: 0,
      },
      lastUpdated: new Date().toISOString(),
    };
    await this.redis.setex(key, TTL.COST_ACCUMULATION, JSON.stringify(data));
  }

  /**
   * Add cost to accumulation
   */
  async addCost(
    sessionId: string,
    service: 'openrouter' | 'retell' | 'modal' | 'github',
    amount: number
  ): Promise<CostAccumulationCache> {
    const key = this.buildKey(CACHE_PREFIXES.COST_ACCUMULATION, sessionId);
    const data = await this.redis.get(key);

    let costData: CostAccumulationCache;
    if (data) {
      costData = JSON.parse(data);
    } else {
      // Initialize if not exists
      costData = {
        sessionId,
        totalCost: 0,
        breakdown: {
          openrouter: 0,
          retell: 0,
          modal: 0,
          github: 0,
        },
        lastUpdated: new Date().toISOString(),
      };
    }

    // Add cost
    costData.breakdown[service] += amount;
    costData.totalCost += amount;
    costData.lastUpdated = new Date().toISOString();

    // Save back to cache
    await this.redis.setex(key, TTL.COST_ACCUMULATION, JSON.stringify(costData));

    return costData;
  }

  /**
   * Get current cost accumulation
   */
  async getCostAccumulation(sessionId: string): Promise<CostAccumulationCache | null> {
    const key = this.buildKey(CACHE_PREFIXES.COST_ACCUMULATION, sessionId);
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Delete cost accumulation cache
   */
  async deleteCostAccumulation(sessionId: string): Promise<void> {
    const key = this.buildKey(CACHE_PREFIXES.COST_ACCUMULATION, sessionId);
    await this.redis.del(key);
  }

  // ============================================================================
  // Analysis Results Caching (Intermediate Artifacts)
  // ============================================================================

  /**
   * Cache analysis results (24 hour TTL)
   * These are intermediate artifacts and will be deleted after 24 hours
   */
  async cacheAnalysisResults(
    sessionId: string,
    analysisType: string,
    results: Record<string, unknown>,
    tenantId: string
  ): Promise<void> {
    const key = this.buildKey(
      CACHE_PREFIXES.ANALYSIS_RESULTS,
      `${sessionId}:${analysisType}`,
      tenantId
    );
    await this.redis.setex(key, TTL.ANALYSIS_RESULTS, JSON.stringify(results));
  }

  /**
   * Get cached analysis results
   */
  async getAnalysisResults(
    sessionId: string,
    analysisType: string,
    tenantId: string
  ): Promise<Record<string, unknown> | null> {
    const key = this.buildKey(
      CACHE_PREFIXES.ANALYSIS_RESULTS,
      `${sessionId}:${analysisType}`,
      tenantId
    );
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Delete analysis results cache
   */
  async deleteAnalysisResults(sessionId: string, tenantId: string): Promise<void> {
    const pattern = this.buildKey(CACHE_PREFIXES.ANALYSIS_RESULTS, `${sessionId}:*`, tenantId);
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await Promise.all(keys.map((key) => this.redis.del(key)));
    }
  }

  // ============================================================================
  // File Tree Caching
  // ============================================================================

  /**
   * Cache file tree (1 hour TTL)
   */
  async cacheFileTree(repoUrl: string, fileTree: Record<string, unknown>, tenantId: string): Promise<void> {
    const key = this.buildKey(CACHE_PREFIXES.FILE_TREE, repoUrl, tenantId);
    await this.redis.setex(key, TTL.FILE_TREE, JSON.stringify(fileTree));
  }

  /**
   * Get cached file tree
   */
  async getFileTree(repoUrl: string, tenantId: string): Promise<Record<string, unknown> | null> {
    const key = this.buildKey(CACHE_PREFIXES.FILE_TREE, repoUrl, tenantId);
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  // ============================================================================
  // AST Caching (Intermediate Artifacts)
  // ============================================================================

  /**
   * Cache AST (24 hour TTL)
   * These are intermediate artifacts and will be deleted after 24 hours
   */
  async cacheAST(fileHash: string, ast: Record<string, unknown>, tenantId: string): Promise<void> {
    const key = this.buildKey(CACHE_PREFIXES.AST_CACHE, fileHash, tenantId);
    await this.redis.setex(key, TTL.AST_CACHE, JSON.stringify(ast));
  }

  /**
   * Get cached AST
   */
  async getAST(fileHash: string, tenantId: string): Promise<Record<string, unknown> | null> {
    const key = this.buildKey(CACHE_PREFIXES.AST_CACHE, fileHash, tenantId);
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  // ============================================================================
  // Rate Limiting
  // ============================================================================

  /**
   * Increment rate limit counter
   */
  async incrementRateLimit(identifier: string, windowSeconds: number = 3600): Promise<number> {
    const key = this.buildKey(CACHE_PREFIXES.RATE_LIMIT, identifier);
    const count = await this.redis.incr(key);

    // Set expiry on first increment
    if (count === 1) {
      await this.redis.getClient().expire(key, windowSeconds);
    }

    return count;
  }

  /**
   * Get current rate limit count
   */
  async getRateLimitCount(identifier: string): Promise<number> {
    const key = this.buildKey(CACHE_PREFIXES.RATE_LIMIT, identifier);
    const count = await this.redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  /**
   * Reset rate limit counter
   */
  async resetRateLimit(identifier: string): Promise<void> {
    const key = this.buildKey(CACHE_PREFIXES.RATE_LIMIT, identifier);
    await this.redis.del(key);
  }

  // ============================================================================
  // Cleanup Operations
  // ============================================================================

  /**
   * Delete all cache data for a session (called on session deletion)
   * Requirement 39.9: Delete cached data when session is deleted
   */
  async deleteAllSessionCache(sessionId: string, tenantId: string): Promise<void> {
    await Promise.all([
      this.deleteSessionState(sessionId),
      this.deleteCostAccumulation(sessionId),
      this.deleteAnalysisResults(sessionId, tenantId),
    ]);
  }

  /**
   * Delete all cache data for a tenant
   */
  async deleteAllTenantCache(tenantId: string): Promise<void> {
    await Promise.all([
      this.deleteAllRepoMetadataForTenant(tenantId),
      this.deleteAllEmbeddingsForTenant(tenantId),
    ]);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    keysByPrefix: Record<string, number>;
  }> {
    const allKeys = await this.redis.keys('*');
    const keysByPrefix: Record<string, number> = {};

    for (const prefix of Object.values(CACHE_PREFIXES)) {
      const keys = allKeys.filter((key) => key.startsWith(prefix));
      keysByPrefix[prefix] = keys.length;
    }

    return {
      totalKeys: allKeys.length,
      keysByPrefix,
    };
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.set('health:check', 'ok', 10);
      const result = await this.redis.get('health:check');
      return result === 'ok';
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
let cacheServiceInstance: CacheService | null = null;

/**
 * Get singleton CacheService instance
 */
export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
  }
  return cacheServiceInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetCacheService(): void {
  cacheServiceInstance = null;
}

