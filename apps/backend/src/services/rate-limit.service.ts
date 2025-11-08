/**
 * Rate Limit Handling Service
 * 
 * Manages GitHub API rate limits with detection, quota display,
 * request queuing, and cache-first strategies.
 * 
 * Requirements: 2.8, 20.5, 20.7, 24.3
 */

import { RateLimitResponse, RateLimit } from '@codebase-onboarding/shared';

import { getGitHubService } from './github.service';
import { getRedisClient } from '../db';

/**
 * Request queue entry
 */
interface QueuedRequest {
  id: string;
  userId: string;
  tenantId: string;
  operation: string;
  priority: number;
  queuedAt: Date;
  estimatedWaitTime: number;
}

/**
 * Rate limit status
 */
interface RateLimitStatus {
  isLimited: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  waitTimeSeconds?: number;
  percentageUsed: number;
}

/**
 * Rate limit handling service
 */
export class RateLimitService {
  private githubService = getGitHubService();
  private redis = getRedisClient();
  private requestQueue: Map<string, QueuedRequest[]> = new Map();

  /**
   * Get current rate limit status
   * Requirement 2.8: Display remaining quota and estimated reset time
   */
  async getRateLimitStatus(userId: string, tenantId: string): Promise<RateLimitStatus> {
    try {
      const rateLimit = await this.githubService.getRateLimit(userId, tenantId);
      const core = rateLimit.core;

      const isLimited = core.remaining === 0;
      const percentageUsed = ((core.limit - core.remaining) / core.limit) * 100;

      let waitTimeSeconds: number | undefined;
      if (isLimited) {
        waitTimeSeconds = Math.ceil((core.reset.getTime() - Date.now()) / 1000);
        if (waitTimeSeconds < 0) waitTimeSeconds = 0;
      }

      return {
        isLimited,
        remaining: core.remaining,
        limit: core.limit,
        resetAt: core.reset,
        waitTimeSeconds,
        percentageUsed,
      };
    } catch (error) {
      // If we can't get rate limit, assume we're not limited
      return {
        isLimited: false,
        remaining: 5000,
        limit: 5000,
        resetAt: new Date(Date.now() + 3600000), // 1 hour from now
        percentageUsed: 0,
      };
    }
  }

  /**
   * Check if rate limited and should queue request
   * Requirement 20.7: Detect rate limiting responses and pause requests until quota resets
   */
  async shouldQueueRequest(userId: string, tenantId: string): Promise<boolean> {
    const status = await this.getRateLimitStatus(userId, tenantId);
    
    // Queue if rate limited or if usage is very high (>95%)
    return status.isLimited || status.percentageUsed > 95;
  }

  /**
   * Queue a request when rate limited
   * Requirement 20.5: Implement request queuing on rate limits
   */
  async queueRequest(
    userId: string,
    tenantId: string,
    operation: string,
    priority: number = 0
  ): Promise<QueuedRequest> {
    const status = await this.getRateLimitStatus(userId, tenantId);

    const request: QueuedRequest = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      tenantId,
      operation,
      priority,
      queuedAt: new Date(),
      estimatedWaitTime: status.waitTimeSeconds || 0,
    };

    // Get or create queue for tenant
    const queueKey = `${tenantId}:${userId}`;
    if (!this.requestQueue.has(queueKey)) {
      this.requestQueue.set(queueKey, []);
    }

    const queue = this.requestQueue.get(queueKey)!;
    queue.push(request);

    // Sort by priority (higher first) and then by queued time
    queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.queuedAt.getTime() - b.queuedAt.getTime();
    });

    // Store queue in Redis for persistence
    await this.redis.setex(
      `ratelimit:queue:${queueKey}`,
      3600, // 1 hour TTL
      JSON.stringify(queue)
    );

    return request;
  }

  /**
   * Get queued requests for a user
   */
  async getQueuedRequests(userId: string, tenantId: string): Promise<QueuedRequest[]> {
    const queueKey = `${tenantId}:${userId}`;
    
    // Try memory first
    if (this.requestQueue.has(queueKey)) {
      return this.requestQueue.get(queueKey)!;
    }

    // Try Redis
    const cached = await this.redis.get(`ratelimit:queue:${queueKey}`);
    if (cached) {
      const queue = JSON.parse(cached);
      this.requestQueue.set(queueKey, queue);
      return queue;
    }

    return [];
  }

  /**
   * Remove request from queue
   */
  async dequeueRequest(userId: string, tenantId: string, requestId: string): Promise<void> {
    const queueKey = `${tenantId}:${userId}`;
    const queue = await this.getQueuedRequests(userId, tenantId);

    const filtered = queue.filter((r) => r.id !== requestId);
    this.requestQueue.set(queueKey, filtered);

    if (filtered.length > 0) {
      await this.redis.setex(
        `ratelimit:queue:${queueKey}`,
        3600,
        JSON.stringify(filtered)
      );
    } else {
      await this.redis.del(`ratelimit:queue:${queueKey}`);
    }
  }

  /**
   * Process queued requests when rate limit resets
   */
  async processQueue(userId: string, tenantId: string): Promise<QueuedRequest[]> {
    const status = await this.getRateLimitStatus(userId, tenantId);

    if (status.isLimited) {
      return [];
    }

    const queue = await this.getQueuedRequests(userId, tenantId);
    
    // Process up to remaining quota
    const toProcess = queue.slice(0, Math.min(queue.length, status.remaining));

    // Remove processed requests from queue
    const remaining = queue.slice(toProcess.length);
    const queueKey = `${tenantId}:${userId}`;
    this.requestQueue.set(queueKey, remaining);

    if (remaining.length > 0) {
      await this.redis.setex(
        `ratelimit:queue:${queueKey}`,
        3600,
        JSON.stringify(remaining)
      );
    } else {
      await this.redis.del(`ratelimit:queue:${queueKey}`);
    }

    return toProcess;
  }

  /**
   * Check if cached data is available for an operation
   * Requirement 24.3: Use cached repository data when GitHub API is rate-limited
   */
  async hasCachedData(
    tenantId: string,
    owner: string,
    repo: string,
    dataType: 'metadata' | 'tree' | 'history' | 'diff'
  ): Promise<boolean> {
    let cacheKey: string;

    switch (dataType) {
      case 'metadata':
        cacheKey = `github:repo:${tenantId}:${owner}:${repo}`;
        break;
      case 'tree':
        cacheKey = `github:tree:${tenantId}:${owner}:${repo}:*`;
        break;
      case 'history':
        cacheKey = `git:history:${tenantId}:${owner}:${repo}:*`;
        break;
      case 'diff':
        cacheKey = `git:diff:${tenantId}:${owner}:${repo}:*`;
        break;
      default:
        return false;
    }

    // For wildcard patterns, check if any keys exist
    if (cacheKey.includes('*')) {
      const keys = await this.redis.keys(cacheKey);
      return keys.length > 0;
    }

    return await this.redis.exists(cacheKey);
  }

  /**
   * Get cache-first strategy recommendation
   * Requirement 20.5: Build cache-first strategy for rate-limited scenarios
   */
  async getCacheStrategy(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string,
    operation: string
  ): Promise<{
    useCacheFirst: boolean;
    hasCachedData: boolean;
    rateLimitStatus: RateLimitStatus;
    recommendation: string;
  }> {
    const status = await this.getRateLimitStatus(userId, tenantId);

    // Determine data type from operation
    let dataType: 'metadata' | 'tree' | 'history' | 'diff' = 'metadata';
    if (operation.includes('tree') || operation.includes('files')) {
      dataType = 'tree';
    } else if (operation.includes('history') || operation.includes('commits')) {
      dataType = 'history';
    } else if (operation.includes('diff')) {
      dataType = 'diff';
    }

    const hasCachedData = await this.hasCachedData(tenantId, owner, repo, dataType);

    // Use cache first if:
    // 1. Rate limited
    // 2. High usage (>90%) and cache available
    // 3. Low remaining quota (<10) and cache available
    const useCacheFirst =
      status.isLimited ||
      (status.percentageUsed > 90 && hasCachedData) ||
      (status.remaining < 10 && hasCachedData);

    let recommendation: string;
    if (status.isLimited) {
      if (hasCachedData) {
        recommendation = `Rate limit exceeded. Using cached data. Quota resets at ${status.resetAt.toISOString()}`;
      } else {
        recommendation = `Rate limit exceeded. No cached data available. Request queued. Wait time: ${status.waitTimeSeconds} seconds`;
      }
    } else if (useCacheFirst) {
      recommendation = `High API usage (${status.percentageUsed.toFixed(1)}%). Using cached data to preserve quota`;
    } else {
      recommendation = `Sufficient quota available (${status.remaining}/${status.limit}). Fetching fresh data`;
    }

    return {
      useCacheFirst,
      hasCachedData,
      rateLimitStatus: status,
      recommendation,
    };
  }

  /**
   * Get rate limit warning threshold
   */
  shouldWarnAboutRateLimit(status: RateLimitStatus): boolean {
    return status.percentageUsed > 80 && !status.isLimited;
  }

  /**
   * Get estimated time until rate limit reset
   */
  getTimeUntilReset(resetAt: Date): {
    seconds: number;
    minutes: number;
    hours: number;
    formatted: string;
  } {
    const now = Date.now();
    const resetTime = resetAt.getTime();
    const diffMs = Math.max(0, resetTime - now);

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    let formatted: string;
    if (hours > 0) {
      formatted = `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      formatted = `${minutes}m ${seconds % 60}s`;
    } else {
      formatted = `${seconds}s`;
    }

    return {
      seconds,
      minutes,
      hours,
      formatted,
    };
  }

  /**
   * Clear queue for a user (e.g., when they disconnect)
   */
  async clearQueue(userId: string, tenantId: string): Promise<void> {
    const queueKey = `${tenantId}:${userId}`;
    this.requestQueue.delete(queueKey);
    await this.redis.del(`ratelimit:queue:${queueKey}`);
  }

  /**
   * Get queue statistics
   */
  async getQueueStatistics(userId: string, tenantId: string): Promise<{
    queueLength: number;
    estimatedWaitTime: number;
    oldestRequest?: Date;
    highestPriority: number;
  }> {
    const queue = await this.getQueuedRequests(userId, tenantId);

    if (queue.length === 0) {
      return {
        queueLength: 0,
        estimatedWaitTime: 0,
        highestPriority: 0,
      };
    }

    const oldestRequest = queue.reduce((oldest, current) =>
      current.queuedAt < oldest.queuedAt ? current : oldest
    ).queuedAt;

    const highestPriority = Math.max(...queue.map((r) => r.priority));

    // Estimate wait time based on rate limit reset
    const status = await this.getRateLimitStatus(userId, tenantId);
    const estimatedWaitTime = status.waitTimeSeconds || 0;

    return {
      queueLength: queue.length,
      estimatedWaitTime,
      oldestRequest,
      highestPriority,
    };
  }
}

// Singleton instance
let rateLimitServiceInstance: RateLimitService | null = null;

/**
 * Get singleton instance of rate limit service
 */
export function getRateLimitService(): RateLimitService {
  if (!rateLimitServiceInstance) {
    rateLimitServiceInstance = new RateLimitService();
  }
  return rateLimitServiceInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetRateLimitService(): void {
  rateLimitServiceInstance = null;
}
