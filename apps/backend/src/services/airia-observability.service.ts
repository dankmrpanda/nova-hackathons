import {
  AiriaMetrics,
  PolicyEnforcementMetric,
  RoutingDecisionMetric,
  ModelUsageMetric,
  CostMetric,
  PolicyViolation,
} from '@codebase-onboarding/shared';

/**
 * Airia Observability Service
 * 
 * Handles metrics collection, logging, and alerting for Airia operations
 * 
 * Requirements:
 * - 36.1: Emit metrics for policy enforcement events
 * - 36.2: Track routing decisions and model selection
 * - 36.7: Log all Airia API calls with redacted context
 * - 36.9: Log all Airia and Retell API errors with redacted context
 */
export class AiriaObservabilityService {
  private policyEnforcementMetrics: Map<string, PolicyEnforcementMetric> = new Map();
  private routingDecisionMetrics: Map<string, RoutingDecisionMetric> = new Map();
  private modelUsageMetrics: Map<string, ModelUsageMetric> = new Map();
  private costMetrics: CostMetric[] = [];

  /**
   * Emit policy enforcement metric
   * Requirement 36.1: Emit metrics for policy enforcement events
   */
  emitPolicyEnforcement(
    policyId: string,
    policyName: string,
    enforced: boolean,
    violated: boolean,
    violation?: PolicyViolation
  ): void {
    const key = `${policyId}-${this.getCurrentHour()}`;
    const existing = this.policyEnforcementMetrics.get(key);

    if (existing) {
      existing.enforcements += enforced ? 1 : 0;
      existing.violations += violated ? 1 : 0;
    } else {
      this.policyEnforcementMetrics.set(key, {
        policyId,
        policyName,
        enforcements: enforced ? 1 : 0,
        violations: violated ? 1 : 0,
        timestamp: new Date(),
      });
    }

    // Log policy enforcement
    this.logPolicyEnforcement(policyId, policyName, enforced, violated, violation);

    // Alert on violations if threshold exceeded
    if (violated) {
      this.checkPolicyViolationThreshold(policyId, policyName);
    }
  }

  /**
   * Emit routing decision metric
   * Requirement 36.2: Track routing decisions and model selection
   */
  emitRoutingDecision(
    model: string,
    fallbackUsed: boolean,
    latency: number,
    tenantId: string,
    sessionId?: string
  ): void {
    const key = `${model}-${this.getCurrentHour()}`;
    const existing = this.routingDecisionMetrics.get(key);

    if (existing) {
      existing.requests += 1;
      existing.fallbacks += fallbackUsed ? 1 : 0;
      // Update average latency
      existing.averageLatency =
        (existing.averageLatency * (existing.requests - 1) + latency) /
        existing.requests;
    } else {
      this.routingDecisionMetrics.set(key, {
        model,
        requests: 1,
        fallbacks: fallbackUsed ? 1 : 0,
        averageLatency: latency,
        timestamp: new Date(),
      });
    }

    // Log routing decision
    this.logRoutingDecision(model, fallbackUsed, latency, tenantId, sessionId);
  }

  /**
   * Emit model usage metric
   */
  emitModelUsage(
    model: string,
    tokens: number,
    cost: number,
    tenantId: string
  ): void {
    const key = `${model}-${this.getCurrentHour()}`;
    const existing = this.modelUsageMetrics.get(key);

    if (existing) {
      existing.requests += 1;
      existing.tokens += tokens;
      existing.cost += cost;
    } else {
      this.modelUsageMetrics.set(key, {
        model,
        requests: 1,
        tokens,
        cost,
        timestamp: new Date(),
      });
    }

    // Also emit cost metric
    this.emitCostMetric(tenantId, 'llm', cost);
  }

  /**
   * Emit cost metric
   */
  emitCostMetric(
    tenantId: string,
    service: 'llm' | 'voice' | 'animation' | 'storage',
    cost: number
  ): void {
    this.costMetrics.push({
      tenantId,
      service,
      cost,
      timestamp: new Date(),
    });

    // Log cost
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Cost metric emitted',
        tenantId,
        service,
        cost,
        timestamp: new Date().toISOString(),
      })
    );
  }

  /**
   * Log Airia API call with redacted context
   * Requirement 36.7: Log all Airia API calls with redacted context
   */
  logAiriaAPICall(
    endpoint: string,
    method: string,
    tenantId: string,
    sessionId?: string,
    duration?: number,
    statusCode?: number,
    error?: Error
  ): void {
    const logEntry = {
      level: error ? 'error' : 'info',
      message: 'Airia API call',
      service: 'airia',
      endpoint,
      method,
      tenantId,
      sessionId,
      duration,
      statusCode,
      error: error
        ? {
            message: error.message,
            // Redact stack trace in production
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          }
        : undefined,
      timestamp: new Date().toISOString(),
    };

    if (error) {
      console.error(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Log Retell API error with redacted context
   * Requirement 36.9: Log all Airia and Retell API errors
   */
  logRetellAPIError(
    endpoint: string,
    method: string,
    tenantId: string,
    sessionId: string,
    error: Error
  ): void {
    const logEntry = {
      level: 'error',
      message: 'Retell API error',
      service: 'retell',
      endpoint,
      method,
      tenantId,
      sessionId,
      error: {
        message: error.message,
        // Redact stack trace in production
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    console.error(JSON.stringify(logEntry));
  }

  /**
   * Log policy enforcement
   */
  private logPolicyEnforcement(
    policyId: string,
    policyName: string,
    enforced: boolean,
    violated: boolean,
    violation?: PolicyViolation
  ): void {
    const logEntry = {
      level: violated ? 'warn' : 'info',
      message: 'Policy enforcement',
      policyId,
      policyName,
      enforced,
      violated,
      violation: violation
        ? {
            policyId: violation.policyId,
            policyName: violation.policyName,
            severity: violation.severity,
            message: violation.message,
            // Redact any sensitive details
          }
        : undefined,
      timestamp: new Date().toISOString(),
    };

    if (violated) {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Log routing decision
   */
  private logRoutingDecision(
    model: string,
    fallbackUsed: boolean,
    latency: number,
    tenantId: string,
    sessionId?: string
  ): void {
    const logEntry = {
      level: fallbackUsed ? 'warn' : 'info',
      message: 'LLM routing decision',
      model,
      fallbackUsed,
      latency,
      tenantId,
      sessionId,
      timestamp: new Date().toISOString(),
    };

    if (fallbackUsed) {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Check if policy violation threshold is exceeded
   */
  private checkPolicyViolationThreshold(policyId: string, policyName: string): void {
    const key = `${policyId}-${this.getCurrentHour()}`;
    const metric = this.policyEnforcementMetrics.get(key);

    if (!metric) return;

    const violationRate = metric.violations / (metric.enforcements + metric.violations);

    // Alert if violation rate exceeds 5%
    if (violationRate > 0.05) {
      this.alertPolicyViolationThreshold(policyId, policyName, violationRate);
    }
  }

  /**
   * Alert on policy violation threshold exceeded
   */
  private alertPolicyViolationThreshold(
    policyId: string,
    policyName: string,
    violationRate: number
  ): void {
    const alertEntry = {
      level: 'error',
      message: 'Policy violation threshold exceeded',
      alert: 'policy_violation_threshold',
      policyId,
      policyName,
      violationRate: `${(violationRate * 100).toFixed(2)}%`,
      threshold: '5%',
      timestamp: new Date().toISOString(),
    };

    console.error(JSON.stringify(alertEntry));

    // In production, would send to alerting system (PagerDuty, Slack, etc.)
  }

  /**
   * Get current metrics
   */
  getMetrics(): AiriaMetrics {
    return {
      policyEnforcements: Array.from(this.policyEnforcementMetrics.values()),
      routingDecisions: Array.from(this.routingDecisionMetrics.values()),
      modelUsage: Array.from(this.modelUsageMetrics.values()),
      costs: this.costMetrics,
    };
  }

  /**
   * Get metrics for a specific tenant
   */
  getTenantMetrics(tenantId: string): {
    costs: CostMetric[];
    totalCost: number;
  } {
    const tenantCosts = this.costMetrics.filter((m) => m.tenantId === tenantId);
    const totalCost = tenantCosts.reduce((sum, m) => sum + m.cost, 0);

    return {
      costs: tenantCosts,
      totalCost,
    };
  }

  /**
   * Get policy enforcement metrics
   */
  getPolicyEnforcementMetrics(): PolicyEnforcementMetric[] {
    return Array.from(this.policyEnforcementMetrics.values());
  }

  /**
   * Get routing decision metrics
   */
  getRoutingDecisionMetrics(): RoutingDecisionMetric[] {
    return Array.from(this.routingDecisionMetrics.values());
  }

  /**
   * Get model usage metrics
   */
  getModelUsageMetrics(): ModelUsageMetric[] {
    return Array.from(this.modelUsageMetrics.values());
  }

  /**
   * Clear old metrics (older than 24 hours)
   */
  clearOldMetrics(): void {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    // Clear policy enforcement metrics
    for (const [key, metric] of this.policyEnforcementMetrics) {
      if (metric.timestamp < cutoff) {
        this.policyEnforcementMetrics.delete(key);
      }
    }

    // Clear routing decision metrics
    for (const [key, metric] of this.routingDecisionMetrics) {
      if (metric.timestamp < cutoff) {
        this.routingDecisionMetrics.delete(key);
      }
    }

    // Clear model usage metrics
    for (const [key, metric] of this.modelUsageMetrics) {
      if (metric.timestamp < cutoff) {
        this.modelUsageMetrics.delete(key);
      }
    }

    // Clear cost metrics
    this.costMetrics = this.costMetrics.filter((m) => m.timestamp >= cutoff);
  }

  /**
   * Get current hour key for metric aggregation
   */
  private getCurrentHour(): string {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}`;
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): string {
    const metrics = this.getMetrics();
    return JSON.stringify(metrics, null, 2);
  }

  /**
   * Reset all metrics (useful for testing)
   */
  resetMetrics(): void {
    this.policyEnforcementMetrics.clear();
    this.routingDecisionMetrics.clear();
    this.modelUsageMetrics.clear();
    this.costMetrics = [];
  }
}

// Singleton instance
let airiaObservabilityServiceInstance: AiriaObservabilityService | null = null;

/**
 * Get singleton instance of Airia observability service
 */
export function getAiriaObservabilityService(): AiriaObservabilityService {
  if (!airiaObservabilityServiceInstance) {
    airiaObservabilityServiceInstance = new AiriaObservabilityService();
  }
  return airiaObservabilityServiceInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetAiriaObservabilityService(): void {
  airiaObservabilityServiceInstance = null;
}
