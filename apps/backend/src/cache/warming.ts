import Redis from 'ioredis';

/**
 * Cache warming strategies for optimal performance
 * Pre-loads frequently accessed data into Redis cache
 */

interface CacheWarmingConfig {
  redis: Redis;
  enabled: boolean;
  interval: number; // milliseconds
}

export class CacheWarmer {
  private redis: Redis;
  private enabled: boolean;
  private interval: number;
  private timerId?: NodeJS.Timeout;

  constructor(config: CacheWarmingConfig) {
    this.redis = config.redis;
    this.enabled = config.enabled;
    this.interval = config.interval;
  }

  /**
   * Start cache warming process
   */
  start(): void {
    if (!this.enabled) {
      console.log('Cache warming is disabled');
      return;
    }

    console.log(`Starting cache warming with interval: ${this.interval}ms`);
    
    // Initial warming
    this.warmCache().catch(err => {
      console.error('Initial cache warming failed:', err);
    });

    // Schedule periodic warming
    this.timerId = setInterval(() => {
      this.warmCache().catch(err => {
        console.error('Periodic cache warming failed:', err);
      });
    }, this.interval);
  }

  /**
   * Stop cache warming process
   */
  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = undefined;
      console.log('Cache warming stopped');
    }
  }

  /**
   * Warm cache with frequently accessed data
   */
  private async warmCache(): Promise<void> {
    console.log('Starting cache warming...');
    const startTime = Date.now();

    try {
      await Promise.all([
        this.warmTenantConfigurations(),
        this.warmAgentFlowMetadata(),
        this.warmModelPricing(),
        this.warmTemplateMetadata(),
      ]);

      const duration = Date.now() - startTime;
      console.log(`Cache warming completed in ${duration}ms`);
    } catch (error) {
      console.error('Cache warming error:', error);
      throw error;
    }
  }

  /**
   * Warm tenant configurations
   */
  private async warmTenantConfigurations(): Promise<void> {
    // In production, fetch from database and cache
    // For now, this is a placeholder
    const tenants = await this.fetchActiveTenants();
    
    for (const tenant of tenants) {
      const cacheKey = `tenant:${tenant.id}:config`;
      await this.redis.setex(
        cacheKey,
        3600, // 1 hour TTL
        JSON.stringify(tenant.config)
      );
    }

    console.log(`Warmed ${tenants.length} tenant configurations`);
  }

  /**
   * Warm agent flow metadata
   */
  private async warmAgentFlowMetadata(): Promise<void> {
    // Cache frequently used agent flow metadata
    const flows = await this.fetchActiveAgentFlows();
    
    for (const flow of flows) {
      const cacheKey = `agent-flow:${flow.id}:metadata`;
      await this.redis.setex(
        cacheKey,
        1800, // 30 minutes TTL
        JSON.stringify(flow.metadata)
      );
    }

    console.log(`Warmed ${flows.length} agent flow metadata entries`);
  }

  /**
   * Warm model pricing information
   */
  private async warmModelPricing(): Promise<void> {
    // Cache model pricing from OpenRouter/Airia
    const pricing = await this.fetchModelPricing();
    
    const cacheKey = 'models:pricing';
    await this.redis.setex(
      cacheKey,
      3600, // 1 hour TTL
      JSON.stringify(pricing)
    );

    console.log('Warmed model pricing data');
  }

  /**
   * Warm template metadata
   */
  private async warmTemplateMetadata(): Promise<void> {
    // Cache popular template metadata
    const templates = await this.fetchPopularTemplates();
    
    for (const template of templates) {
      const cacheKey = `template:${template.id}:metadata`;
      await this.redis.setex(
        cacheKey,
        7200, // 2 hours TTL
        JSON.stringify(template.metadata)
      );
    }

    console.log(`Warmed ${templates.length} template metadata entries`);
  }

  /**
   * Fetch active tenants from database
   */
  private async fetchActiveTenants(): Promise<any[]> {
    // Placeholder - implement actual database query
    return [];
  }

  /**
   * Fetch active agent flows
   */
  private async fetchActiveAgentFlows(): Promise<any[]> {
    // Placeholder - implement actual Airia API call
    return [];
  }

  /**
   * Fetch model pricing
   */
  private async fetchModelPricing(): Promise<any> {
    // Placeholder - implement actual OpenRouter/Airia API call
    return {};
  }

  /**
   * Fetch popular templates
   */
  private async fetchPopularTemplates(): Promise<any[]> {
    // Placeholder - implement actual database query
    return [];
  }
}

/**
 * Create and configure cache warmer
 */
export function createCacheWarmer(redis: Redis): CacheWarmer {
  const config: CacheWarmingConfig = {
    redis,
    enabled: process.env.CACHE_WARMING_ENABLED === 'true',
    interval: parseInt(process.env.CACHE_WARMING_INTERVAL || '300000'), // 5 minutes default
  };

  return new CacheWarmer(config);
}

/**
 * Cache invalidation strategies
 */
export class CacheInvalidator {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Invalidate tenant configuration cache
   */
  async invalidateTenantConfig(tenantId: string): Promise<void> {
    const pattern = `tenant:${tenantId}:*`;
    await this.invalidateByPattern(pattern);
  }

  /**
   * Invalidate agent flow cache
   */
  async invalidateAgentFlow(flowId: string): Promise<void> {
    const pattern = `agent-flow:${flowId}:*`;
    await this.invalidateByPattern(pattern);
  }

  /**
   * Invalidate template cache
   */
  async invalidateTemplate(templateId: string): Promise<void> {
    const pattern = `template:${templateId}:*`;
    await this.invalidateByPattern(pattern);
  }

  /**
   * Invalidate by pattern
   */
  private async invalidateByPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
      console.log(`Invalidated ${keys.length} cache entries matching: ${pattern}`);
    }
  }
}
