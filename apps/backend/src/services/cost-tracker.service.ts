import Redis from 'ioredis';

import {
  CostEntry,
  CostStatus,
  CostEstimate,
  CostReport,
  CostReportQuery,
  TenantCostConfig,
  CostService,
  SessionConfig,
} from '@codebase-onboarding/shared';

interface PoolClient {
  query(text: string, params?: any[]): Promise<any>;
  release(): void;
}

interface DatabaseClient {
  query(text: string, params?: any[]): Promise<any>;
  getClient(): Promise<PoolClient>;
}

export class CostTrackerService {
  private db: DatabaseClient;
  private redis: Redis;

  constructor(db: DatabaseClient, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  /**
   * Estimate cost for a session configuration
   * Requirements: 16.1, 16.5
   */
  async estimateCost(config: SessionConfig): Promise<CostEstimate> {
    // Base cost estimates per service (in USD)
    const BASE_LLM_COST_PER_MB = 0.05; // Approximate cost per MB of code analyzed
    const BASE_VOICE_COST_PER_MINUTE = 0.10; // Retell AI cost per minute
    const BASE_ANIMATION_COST = 0.50; // Modal animation generation
    const BASE_GITHUB_COST = 0.01; // GitHub API usage (minimal)

    // Calculate scope size in MB
    const scopeSizeMB = (config.analysisScope.maxSize || 0) / (1024 * 1024);

    // Estimate LLM cost based on scope size and model
    let llmCost = scopeSizeMB * BASE_LLM_COST_PER_MB;
    
    // Adjust for model preference (some models are more expensive)
    if (config.modelPreference?.includes('gpt-4')) {
      llmCost *= 2.0;
    } else if (config.modelPreference?.includes('claude-3-opus')) {
      llmCost *= 1.8;
    }

    // Estimate voice cost (assume 30 minutes average session)
    const voiceCost = config.voiceEnabled ? 30 * BASE_VOICE_COST_PER_MINUTE : 0;

    // Estimate animation cost
    const animationCost = config.outputFormat === 'animation' ? BASE_ANIMATION_COST : 0;

    // GitHub cost is minimal
    const githubCost = BASE_GITHUB_COST;

    const total = llmCost + voiceCost + animationCost + githubCost;

    // Confidence is lower for larger scopes and voice-enabled sessions
    let confidence = 0.8;
    if (scopeSizeMB > 50) confidence -= 0.1;
    if (config.voiceEnabled) confidence -= 0.1;
    confidence = Math.max(0.5, confidence);

    return {
      llmCost,
      voiceCost,
      animationCost,
      githubCost,
      total,
      confidence,
    };
  }

  /**
   * Track a cost entry for a session
   * Requirements: 16.5, 16.6
   */
  async trackCost(
    sessionId: string,
    tenantId: string,
    userId: string,
    entry: Omit<CostEntry, 'timestamp'>
  ): Promise<void> {
    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');

      // Insert cost entry into database
      await client.query(
        `INSERT INTO cost_entries (session_id, tenant_id, user_id, service, operation, amount, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          sessionId,
          tenantId,
          userId,
          entry.service,
          entry.operation,
          entry.amount,
          JSON.stringify(entry.metadata || {}),
        ]
      );

      // Update session current_cost
      await client.query(
        `UPDATE onboarding_sessions
         SET current_cost = current_cost + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [entry.amount, sessionId]
      );

      await client.query('COMMIT');

      // Update real-time cost in Redis
      const redisKey = `cost:${sessionId}`;
      await this.redis.incrbyfloat(redisKey, entry.amount);
      await this.redis.expire(redisKey, 86400); // 24 hour TTL

      // Also track tenant-level cost accumulation
      const tenantKey = `cost:tenant:${tenantId}:${this.getCurrentDateKey()}`;
      await this.redis.incrbyfloat(tenantKey, entry.amount);
      await this.redis.expire(tenantKey, 2592000); // 30 day TTL
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get current cost for a session
   * Requirements: 16.6
   */
  async getCurrentCost(sessionId: string): Promise<number> {
    // Try Redis first for real-time data
    const redisKey = `cost:${sessionId}`;
    const redisCost = await this.redis.get(redisKey);
    
    if (redisCost !== null) {
      return parseFloat(redisCost);
    }

    // Fallback to database
    const result = await this.db.query(
      'SELECT current_cost FROM onboarding_sessions WHERE id = $1',
      [sessionId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const cost = parseFloat(result.rows[0].current_cost) || 0;

    // Populate Redis cache
    await this.redis.set(redisKey, cost.toString(), 'EX', 86400);

    return cost;
  }

  /**
   * Check cost status against limit
   * Requirements: 16.2, 16.7
   */
  async checkLimit(sessionId: string): Promise<CostStatus> {
    const result = await this.db.query(
      `SELECT 
        s.current_cost,
        COALESCE(s.cost_limit, tcc.default_cost_limit) as cost_limit,
        tcc.warning_threshold
       FROM onboarding_sessions s
       JOIN tenant_cost_config tcc ON s.tenant_id = tcc.tenant_id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const { current_cost, cost_limit, warning_threshold } = result.rows[0];
    const current = parseFloat(current_cost) || 0;
    const limit = parseFloat(cost_limit) || 5.0;
    const threshold = parseInt(warning_threshold) || 90;

    const percentage = (current / limit) * 100;
    const warning = percentage >= threshold;
    const exceeded = current >= limit;

    return {
      current,
      limit,
      percentage,
      warning,
      exceeded,
    };
  }

  /**
   * Get tenant cost configuration
   */
  async getTenantCostConfig(tenantId: string): Promise<TenantCostConfig> {
    const result = await this.db.query(
      'SELECT * FROM tenant_cost_config WHERE tenant_id = $1',
      [tenantId]
    );

    if (result.rows.length === 0) {
      // Return default config
      return {
        tenantId,
        defaultCostLimit: 5.0,
        maxCostLimit: 50.0,
        warningThreshold: 90,
      };
    }

    const row = result.rows[0];
    return {
      tenantId: row.tenant_id,
      defaultCostLimit: parseFloat(row.default_cost_limit),
      maxCostLimit: parseFloat(row.max_cost_limit),
      warningThreshold: parseInt(row.warning_threshold),
    };
  }

  /**
   * Update tenant cost configuration
   */
  async updateTenantCostConfig(config: TenantCostConfig): Promise<void> {
    await this.db.query(
      `INSERT INTO tenant_cost_config (tenant_id, default_cost_limit, max_cost_limit, warning_threshold)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id) 
       DO UPDATE SET
         default_cost_limit = EXCLUDED.default_cost_limit,
         max_cost_limit = EXCLUDED.max_cost_limit,
         warning_threshold = EXCLUDED.warning_threshold,
         updated_at = CURRENT_TIMESTAMP`,
      [config.tenantId, config.defaultCostLimit, config.maxCostLimit, config.warningThreshold]
    );
  }

  /**
   * Get cost report for tenant
   * Requirements: 16.6
   */
  async getTenantCosts(tenantId: string, query: CostReportQuery): Promise<CostReport> {
    const result = await this.db.query(
      `SELECT 
        service,
        operation,
        SUM(amount) as total_amount,
        COUNT(DISTINCT session_id) as session_count
       FROM cost_entries
       WHERE tenant_id = $1
         AND created_at >= $2
         AND created_at <= $3
       GROUP BY service, operation`,
      [tenantId, query.startDate, query.endDate]
    );

    const costByService: Record<CostService, number> = {
      openrouter: 0,
      retell: 0,
      modal: 0,
      github: 0,
    };

    const costByOperation: Record<string, number> = {};
    let totalCost = 0;
    let sessionCount = 0;

    for (const row of result.rows) {
      const amount = parseFloat(row.total_amount);
      costByService[row.service as CostService] = 
        (costByService[row.service as CostService] || 0) + amount;
      costByOperation[row.operation] = 
        (costByOperation[row.operation] || 0) + amount;
      totalCost += amount;
      sessionCount = Math.max(sessionCount, parseInt(row.session_count));
    }

    const averageCostPerSession = sessionCount > 0 ? totalCost / sessionCount : 0;

    return {
      tenantId,
      startDate: query.startDate,
      endDate: query.endDate,
      totalCost,
      costByService,
      costByOperation,
      sessionCount,
      averageCostPerSession,
    };
  }

  /**
   * Get cost report for user
   * Requirements: 16.6
   */
  async getUserCosts(userId: string, query: CostReportQuery): Promise<CostReport> {
    const result = await this.db.query(
      `SELECT 
        service,
        operation,
        SUM(amount) as total_amount,
        COUNT(DISTINCT session_id) as session_count
       FROM cost_entries
       WHERE user_id = $1
         AND created_at >= $2
         AND created_at <= $3
       GROUP BY service, operation`,
      [userId, query.startDate, query.endDate]
    );

    const costByService: Record<CostService, number> = {
      openrouter: 0,
      retell: 0,
      modal: 0,
      github: 0,
    };

    const costByOperation: Record<string, number> = {};
    let totalCost = 0;
    let sessionCount = 0;

    for (const row of result.rows) {
      const amount = parseFloat(row.total_amount);
      costByService[row.service as CostService] = 
        (costByService[row.service as CostService] || 0) + amount;
      costByOperation[row.operation] = 
        (costByOperation[row.operation] || 0) + amount;
      totalCost += amount;
      sessionCount = Math.max(sessionCount, parseInt(row.session_count));
    }

    const averageCostPerSession = sessionCount > 0 ? totalCost / sessionCount : 0;

    return {
      userId,
      startDate: query.startDate,
      endDate: query.endDate,
      totalCost,
      costByService,
      costByOperation,
      sessionCount,
      averageCostPerSession,
    };
  }

  /**
   * Export cost data in specified format
   */
  async exportCostData(tenantId: string, format: 'csv' | 'json', query: CostReportQuery): Promise<string> {
    const result = await this.db.query(
      `SELECT 
        ce.session_id,
        ce.user_id,
        ce.service,
        ce.operation,
        ce.amount,
        ce.metadata,
        ce.created_at,
        s.repository_url,
        s.status
       FROM cost_entries ce
       JOIN onboarding_sessions s ON ce.session_id = s.id
       WHERE ce.tenant_id = $1
         AND ce.created_at >= $2
         AND ce.created_at <= $3
       ORDER BY ce.created_at DESC`,
      [tenantId, query.startDate, query.endDate]
    );

    if (format === 'json') {
      return JSON.stringify(result.rows, null, 2);
    }

    // CSV format
    const headers = ['session_id', 'user_id', 'service', 'operation', 'amount', 'created_at', 'repository_url', 'status'];
    const csvRows = [headers.join(',')];

    for (const row of result.rows) {
      const values = [
        row.session_id,
        row.user_id,
        row.service,
        row.operation,
        row.amount,
        row.created_at.toISOString(),
        `"${row.repository_url}"`,
        row.status,
      ];
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Enforce cost limit - terminate session if exceeded
   * Requirements: 16.2, 16.8
   */
  async enforceLimit(sessionId: string): Promise<{ terminated: boolean; reason?: string }> {
    const costStatus = await this.checkLimit(sessionId);

    if (costStatus.exceeded) {
      // Terminate the session
      await this.db.query(
        `UPDATE onboarding_sessions
         SET status = 'terminated',
             terminated_at = CURRENT_TIMESTAMP,
             termination_reason = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        ['Cost limit exceeded', sessionId]
      );

      return {
        terminated: true,
        reason: `Session terminated: cost limit of $${costStatus.limit.toFixed(2)} exceeded (current: $${costStatus.current.toFixed(2)})`,
      };
    }

    return { terminated: false };
  }

  /**
   * Check if session should show warning
   * Requirements: 16.7
   */
  async shouldWarn(sessionId: string): Promise<{ shouldWarn: boolean; message?: string }> {
    const costStatus = await this.checkLimit(sessionId);

    if (costStatus.warning && !costStatus.exceeded) {
      return {
        shouldWarn: true,
        message: `Warning: Session cost at ${costStatus.percentage.toFixed(1)}% of limit ($${costStatus.current.toFixed(2)} / $${costStatus.limit.toFixed(2)})`,
      };
    }

    return { shouldWarn: false };
  }

  /**
   * Get notification for cost status
   * Requirements: 16.7
   */
  async getCostNotification(sessionId: string): Promise<{
    type: 'none' | 'warning' | 'critical';
    message: string;
    uiMessage: string;
    voiceMessage: string;
  }> {
    const costStatus = await this.checkLimit(sessionId);

    if (costStatus.exceeded) {
      return {
        type: 'critical',
        message: `Cost limit exceeded: $${costStatus.current.toFixed(2)} / $${costStatus.limit.toFixed(2)}`,
        uiMessage: `⚠️ Session terminated: Cost limit of $${costStatus.limit.toFixed(2)} exceeded`,
        voiceMessage: `Your session has been terminated because the cost limit of ${costStatus.limit.toFixed(2)} dollars has been exceeded. Current cost is ${costStatus.current.toFixed(2)} dollars.`,
      };
    }

    if (costStatus.warning) {
      return {
        type: 'warning',
        message: `Cost warning: ${costStatus.percentage.toFixed(1)}% of limit`,
        uiMessage: `⚠️ Cost Warning: ${costStatus.percentage.toFixed(1)}% of limit ($${costStatus.current.toFixed(2)} / $${costStatus.limit.toFixed(2)})`,
        voiceMessage: `Warning: Your session cost is at ${Math.round(costStatus.percentage)} percent of the limit. Current cost is ${costStatus.current.toFixed(2)} dollars out of ${costStatus.limit.toFixed(2)} dollars.`,
      };
    }

    return {
      type: 'none',
      message: '',
      uiMessage: '',
      voiceMessage: '',
    };
  }

  /**
   * Validate session can start based on estimated cost
   * Requirements: 16.4
   */
  async validateSessionStart(sessionId: string, estimatedCost: number): Promise<{
    canStart: boolean;
    reason?: string;
    suggestedLimit?: number;
  }> {
    const result = await this.db.query(
      `SELECT 
        COALESCE(s.cost_limit, tcc.default_cost_limit) as cost_limit,
        tcc.max_cost_limit
       FROM onboarding_sessions s
       JOIN tenant_cost_config tcc ON s.tenant_id = tcc.tenant_id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return { canStart: false, reason: 'Session not found' };
    }

    const { cost_limit, max_cost_limit } = result.rows[0];
    const limit = parseFloat(cost_limit);
    const maxLimit = parseFloat(max_cost_limit);

    if (estimatedCost > limit) {
      return {
        canStart: false,
        reason: `Estimated cost ($${estimatedCost.toFixed(2)}) exceeds session limit ($${limit.toFixed(2)})`,
        suggestedLimit: Math.min(estimatedCost * 1.2, maxLimit), // Suggest 20% buffer
      };
    }

    return { canStart: true };
  }

  /**
   * Helper to get current date key for Redis
   */
  private getCurrentDateKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}
