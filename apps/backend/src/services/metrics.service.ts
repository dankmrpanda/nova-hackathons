/**
 * Metrics Collection Service
 * 
 * Collects and emits metrics for:
 * - Application metrics (latency, errors, sessions)
 * - Infrastructure metrics (CPU, memory, database)
 * - Business metrics (sessions, scripts, templates)
 * - Custom metrics for Airia and Retell
 * 
 * Requirements: 15.2, 36.1, 36.2, 36.3
 */

import { EventEmitter } from 'events';
import os from 'os';

import { logger } from './logger.service';

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  TIMER = 'timer',
}

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  unit?: string;
}

export interface TimerHandle {
  end: () => number;
}

class MetricsService extends EventEmitter {
  private metrics: Map<string, Metric[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private infrastructureInterval?: NodeJS.Timeout;

  constructor() {
    super();
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);

    this.emitMetric({
      name,
      type: MetricType.COUNTER,
      value: current + value,
      timestamp: new Date(),
      tags,
    });
  }

  /**
   * Set a gauge metric
   */
  setGauge(name: string, value: number, tags?: Record<string, string>, unit?: string): void {
    const key = this.getMetricKey(name, tags);
    this.gauges.set(key, value);

    this.emitMetric({
      name,
      type: MetricType.GAUGE,
      value,
      timestamp: new Date(),
      tags,
      unit,
    });
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number, tags?: Record<string, string>, unit?: string): void {
    this.emitMetric({
      name,
      type: MetricType.HISTOGRAM,
      value,
      timestamp: new Date(),
      tags,
      unit,
    });
  }

  /**
   * Start a timer
   */
  startTimer(name: string, tags?: Record<string, string>): TimerHandle {
    const startTime = Date.now();

    return {
      end: (): number => {
        const duration = Date.now() - startTime;
        this.recordHistogram(name, duration, tags, 'ms');
        return duration;
      },
    };
  }

  /**
   * Track API request metrics
   */
  trackRequest(method: string, path: string, statusCode: number, duration: number): void {
    const tags = {
      method,
      path,
      status: statusCode.toString(),
      statusClass: `${Math.floor(statusCode / 100)}xx`,
    };

    this.incrementCounter('api.requests.total', 1, tags);
    this.recordHistogram('api.requests.duration', duration, tags, 'ms');

    if (statusCode >= 400) {
      this.incrementCounter('api.requests.errors', 1, tags);
    }
  }

  /**
   * Track session metrics
   */
  trackSession(event: 'created' | 'completed' | 'terminated', tenantId: string, sessionId: string): void {
    this.incrementCounter('sessions.total', 1, { event, tenantId });
    
    logger.info('Session metric tracked', {
      tenantId,
      sessionId,
      metadata: { event },
    });
  }

  /**
   * Track active sessions
   */
  trackActiveSessions(count: number, tenantId?: string): void {
    this.setGauge('sessions.active', count, tenantId ? { tenantId } : undefined);
  }

  /**
   * Track cost metrics
   */
  trackCost(service: string, amount: number, tenantId: string, sessionId?: string): void {
    const tags = { service, tenantId };
    
    this.incrementCounter('cost.total', amount, tags);
    this.recordHistogram('cost.per_operation', amount, tags, 'usd');

    logger.info('Cost metric tracked', {
      tenantId,
      sessionId,
      cost: amount,
      metadata: { service },
    });
  }

  /**
   * Track Airia policy enforcement
   */
  trackAiriaPolicy(event: 'enforced' | 'violated' | 'fallback', tenantId: string, policyType: string): void {
    this.incrementCounter('airia.policy.events', 1, { event, tenantId, policyType });

    logger.info('Airia policy metric tracked', {
      tenantId,
      metadata: { event, policyType },
    });
  }

  /**
   * Track Airia routing decisions
   */
  trackAiriaRouting(model: string, latency: number, tenantId: string, success: boolean): void {
    const tags = { model, tenantId, success: success.toString() };
    
    this.incrementCounter('airia.routing.requests', 1, tags);
    this.recordHistogram('airia.routing.latency', latency, tags, 'ms');

    logger.debug('Airia routing metric tracked', {
      tenantId,
      duration: latency,
      metadata: { model, success },
    });
  }

  /**
   * Track Retell AI voice session metrics
   */
  trackRetellSession(
    event: 'started' | 'ended',
    duration?: number,
    participantCount?: number,
    qualityScore?: number,
    tenantId?: string
  ): void {
    const tags: Record<string, string> = { event };
    if (tenantId) {
      tags.tenantId = tenantId;
    }
    
    this.incrementCounter('retell.sessions.total', 1, tags);

    if (event === 'ended' && duration !== undefined) {
      this.recordHistogram('retell.sessions.duration', duration, tags, 'seconds');
    }

    if (participantCount !== undefined) {
      this.recordHistogram('retell.sessions.participants', participantCount, tags);
    }

    if (qualityScore !== undefined) {
      this.recordHistogram('retell.sessions.quality', qualityScore, tags);
    }

    logger.info('Retell session metric tracked', {
      tenantId,
      metadata: { event, duration, participantCount, qualityScore },
    });
  }

  /**
   * Track Retell AI voice latency
   */
  trackRetellLatency(latency: number, tenantId?: string): void {
    const tags = tenantId ? { tenantId } : undefined;
    this.recordHistogram('retell.voice.latency', latency, tags, 'ms');

    // Alert if latency exceeds threshold (800ms per requirements)
    if (latency > 800) {
      logger.warn('Retell voice latency exceeded threshold', {
        tenantId,
        duration: latency,
        metadata: { threshold: 800 },
      });
    }
  }

  /**
   * Track template metrics
   */
  trackTemplate(event: 'created' | 'shared' | 'used', tenantId: string, templateId: string): void {
    this.incrementCounter('templates.total', 1, { event, tenantId });

    logger.info('Template metric tracked', {
      tenantId,
      metadata: { event, templateId },
    });
  }

  /**
   * Track interactive script generation
   */
  trackScript(event: 'generated' | 'replayed' | 'exported', tenantId: string, sessionId: string): void {
    this.incrementCounter('scripts.total', 1, { event, tenantId });

    logger.info('Script metric tracked', {
      tenantId,
      sessionId,
      metadata: { event },
    });
  }

  /**
   * Track database metrics
   */
  trackDatabase(operation: string, duration: number, success: boolean): void {
    const tags = { operation, success: success.toString() };
    
    this.incrementCounter('database.operations', 1, tags);
    this.recordHistogram('database.duration', duration, tags, 'ms');

    if (!success) {
      this.incrementCounter('database.errors', 1, { operation });
    }
  }

  /**
   * Track cache metrics
   */
  trackCache(operation: 'hit' | 'miss' | 'set' | 'delete', key: string): void {
    this.incrementCounter('cache.operations', 1, { operation, keyType: this.getCacheKeyType(key) });
  }

  /**
   * Start collecting infrastructure metrics
   */
  startInfrastructureMetrics(intervalMs: number = 60000): void {
    if (this.infrastructureInterval) {
      return;
    }

    this.collectInfrastructureMetrics();
    this.infrastructureInterval = setInterval(() => {
      this.collectInfrastructureMetrics();
    }, intervalMs);

    logger.info('Infrastructure metrics collection started', {
      metadata: { intervalMs },
    });
  }

  /**
   * Stop collecting infrastructure metrics
   */
  stopInfrastructureMetrics(): void {
    if (this.infrastructureInterval) {
      clearInterval(this.infrastructureInterval);
      this.infrastructureInterval = undefined;
      logger.info('Infrastructure metrics collection stopped');
    }
  }

  /**
   * Collect infrastructure metrics
   */
  private collectInfrastructureMetrics(): void {
    // CPU metrics
    const cpus = os.cpus();
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + (1 - idle / total);
    }, 0) / cpus.length;

    this.setGauge('infrastructure.cpu.usage', cpuUsage * 100, undefined, 'percent');
    this.setGauge('infrastructure.cpu.count', cpus.length);

    // Memory metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;

    this.setGauge('infrastructure.memory.total', totalMemory, undefined, 'bytes');
    this.setGauge('infrastructure.memory.used', usedMemory, undefined, 'bytes');
    this.setGauge('infrastructure.memory.free', freeMemory, undefined, 'bytes');
    this.setGauge('infrastructure.memory.usage', memoryUsage, undefined, 'percent');

    // Process metrics
    const processMemory = process.memoryUsage();
    this.setGauge('process.memory.heap_used', processMemory.heapUsed, undefined, 'bytes');
    this.setGauge('process.memory.heap_total', processMemory.heapTotal, undefined, 'bytes');
    this.setGauge('process.memory.rss', processMemory.rss, undefined, 'bytes');
    this.setGauge('process.memory.external', processMemory.external, undefined, 'bytes');

    // Uptime
    this.setGauge('process.uptime', process.uptime(), undefined, 'seconds');
    this.setGauge('infrastructure.uptime', os.uptime(), undefined, 'seconds');
  }

  /**
   * Get all current metrics
   */
  getMetrics(): Map<string, Metric[]> {
    return new Map(this.metrics);
  }

  /**
   * Get counter value
   */
  getCounter(name: string, tags?: Record<string, string>): number {
    const key = this.getMetricKey(name, tags);
    return this.counters.get(key) || 0;
  }

  /**
   * Get gauge value
   */
  getGauge(name: string, tags?: Record<string, string>): number | undefined {
    const key = this.getMetricKey(name, tags);
    return this.gauges.get(key);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
  }

  /**
   * Emit a metric
   */
  private emitMetric(metric: Metric): void {
    const key = metric.name;
    const existing = this.metrics.get(key) || [];
    existing.push(metric);
    
    // Keep only last 1000 metrics per name
    if (existing.length > 1000) {
      existing.shift();
    }
    
    this.metrics.set(key, existing);

    // Emit event for external consumers (e.g., Datadog, CloudWatch)
    this.emit('metric', metric);
  }

  /**
   * Get metric key with tags
   */
  private getMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags) return name;
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    return `${name}{${tagString}}`;
  }

  /**
   * Get cache key type for metrics
   */
  private getCacheKeyType(key: string): string {
    if (key.startsWith('session:')) return 'session';
    if (key.startsWith('repo:')) return 'repository';
    if (key.startsWith('cost:')) return 'cost';
    if (key.startsWith('embeddings:')) return 'embeddings';
    return 'other';
  }
}

// Export singleton instance
export const metricsService = new MetricsService();
