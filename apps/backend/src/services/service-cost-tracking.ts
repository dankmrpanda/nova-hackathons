import Redis from 'ioredis';

import { CostNotificationService } from './cost-notification.service';
import { CostTrackerService } from './cost-tracker.service';

interface DatabaseClient {
  query(text: string, params?: any[]): Promise<any>;
  getClient(): Promise<any>;
}

/**
 * Service-specific cost tracking integrations
 * Requirements: 16.5, 16.9, 16.10
 */
export class ServiceCostTracking {
  private costTracker: CostTrackerService;
  private costNotification: CostNotificationService;

  constructor(db: DatabaseClient, redis: Redis) {
    this.costTracker = new CostTrackerService(db, redis);
    this.costNotification = new CostNotificationService(db, redis);
  }

  /**
   * Track OpenRouter LLM costs via Airia
   * Requirements: 16.5, 16.9
   */
  async trackOpenRouterCost(
    sessionId: string,
    tenantId: string,
    userId: string,
    params: {
      model: string;
      inputTokens: number;
      outputTokens: number;
      costPerInputToken: number;
      costPerOutputToken: number;
      operation: string;
    }
  ): Promise<void> {
    const inputCost = params.inputTokens * params.costPerInputToken;
    const outputCost = params.outputTokens * params.costPerOutputToken;
    const totalCost = inputCost + outputCost;

    await this.costTracker.trackCost(sessionId, tenantId, userId, {
      service: 'openrouter',
      operation: params.operation,
      amount: totalCost,
      metadata: {
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        inputCost,
        outputCost,
      },
    });

    // Monitor and notify
    await this.costNotification.monitorAndNotify(sessionId);
  }

  /**
   * Track Retell AI voice costs
   * Requirements: 16.10
   */
  async trackRetellCost(
    sessionId: string,
    tenantId: string,
    userId: string,
    params: {
      durationSeconds: number;
      costPerMinute: number;
      operation: string;
      voiceSessionId?: string;
    }
  ): Promise<void> {
    const durationMinutes = params.durationSeconds / 60;
    const totalCost = durationMinutes * params.costPerMinute;

    await this.costTracker.trackCost(sessionId, tenantId, userId, {
      service: 'retell',
      operation: params.operation,
      amount: totalCost,
      metadata: {
        durationSeconds: params.durationSeconds,
        durationMinutes,
        costPerMinute: params.costPerMinute,
        voiceSessionId: params.voiceSessionId,
      },
    });

    // Monitor and notify
    await this.costNotification.monitorAndNotify(sessionId);
  }

  /**
   * Track Modal animation generation costs
   * Requirements: 16.10
   */
  async trackModalCost(
    sessionId: string,
    tenantId: string,
    userId: string,
    params: {
      operation: string;
      durationSeconds: number;
      resolution: string;
      computeUnits: number;
      costPerUnit: number;
    }
  ): Promise<void> {
    const totalCost = params.computeUnits * params.costPerUnit;

    await this.costTracker.trackCost(sessionId, tenantId, userId, {
      service: 'modal',
      operation: params.operation,
      amount: totalCost,
      metadata: {
        durationSeconds: params.durationSeconds,
        resolution: params.resolution,
        computeUnits: params.computeUnits,
        costPerUnit: params.costPerUnit,
      },
    });

    // Monitor and notify
    await this.costNotification.monitorAndNotify(sessionId);
  }

  /**
   * Track GitHub API usage costs
   * Requirements: 16.10
   */
  async trackGitHubCost(
    sessionId: string,
    tenantId: string,
    userId: string,
    params: {
      operation: string;
      apiCalls: number;
      dataTransferMB: number;
      costPerCall?: number;
      costPerMB?: number;
    }
  ): Promise<void> {
    const callCost = params.apiCalls * (params.costPerCall || 0.0001);
    const transferCost = params.dataTransferMB * (params.costPerMB || 0.001);
    const totalCost = callCost + transferCost;

    await this.costTracker.trackCost(sessionId, tenantId, userId, {
      service: 'github',
      operation: params.operation,
      amount: totalCost,
      metadata: {
        apiCalls: params.apiCalls,
        dataTransferMB: params.dataTransferMB,
        callCost,
        transferCost,
      },
    });

    // Monitor and notify
    await this.costNotification.monitorAndNotify(sessionId);
  }

  /**
   * Track batch LLM operations via Airia
   */
  async trackBatchLLMCost(
    sessionId: string,
    tenantId: string,
    userId: string,
    operations: Array<{
      model: string;
      inputTokens: number;
      outputTokens: number;
      costPerInputToken: number;
      costPerOutputToken: number;
      operation: string;
    }>
  ): Promise<void> {
    for (const op of operations) {
      await this.trackOpenRouterCost(sessionId, tenantId, userId, op);
    }
  }

  /**
   * Get cost breakdown by service for a session
   */
  async getSessionCostBreakdown(sessionId: string): Promise<{
    total: number;
    byService: Record<string, number>;
    byOperation: Record<string, number>;
  }> {
    const db = this.costTracker['db']; // Access private db property
    
    const result = await db.query(
      `SELECT 
        service,
        operation,
        SUM(amount) as total_amount
       FROM cost_entries
       WHERE session_id = $1
       GROUP BY service, operation`,
      [sessionId]
    );

    const byService: Record<string, number> = {};
    const byOperation: Record<string, number> = {};
    let total = 0;

    for (const row of result.rows) {
      const amount = parseFloat(row.total_amount);
      byService[row.service] = (byService[row.service] || 0) + amount;
      byOperation[row.operation] = (byOperation[row.operation] || 0) + amount;
      total += amount;
    }

    return { total, byService, byOperation };
  }

  /**
   * Estimate cost for specific operations
   */
  estimateOperationCost(operation: {
    type: 'llm' | 'voice' | 'animation' | 'github';
    params: unknown;
  }): number {
    switch (operation.type) {
      case 'llm': {
        const params = operation.params as {
          inputTokens: number;
          outputTokens: number;
          costPerInputToken: number;
          costPerOutputToken: number;
        };
        return (
          params.inputTokens * params.costPerInputToken +
          params.outputTokens * params.costPerOutputToken
        );
      }
      
      case 'voice': {
        const params = operation.params as {
          durationSeconds: number;
          costPerMinute: number;
        };
        return (params.durationSeconds / 60) * params.costPerMinute;
      }
      
      case 'animation': {
        const params = operation.params as {
          computeUnits: number;
          costPerUnit: number;
        };
        return params.computeUnits * params.costPerUnit;
      }
      
      case 'github': {
        const params = operation.params as {
          apiCalls: number;
          dataTransferMB: number;
          costPerCall?: number;
          costPerMB?: number;
        };
        return (
          params.apiCalls * (params.costPerCall || 0.0001) +
          params.dataTransferMB * (params.costPerMB || 0.001)
        );
      }
      
      default:
        return 0;
    }
  }
}
