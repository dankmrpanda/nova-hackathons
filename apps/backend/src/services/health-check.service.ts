/**
 * Health Check Service
 * 
 * Provides health checks for:
 * - Service health
 * - Dependency health (database, Redis, Airia)
 * - Readiness and liveness probes
 * 
 * Requirements: 15.3
 */

import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { logger } from './logger.service';
import { metricsService } from './metrics.service';

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  uptime: number;
  checks: {
    [key: string]: DependencyHealth;
  };
}

export interface DependencyHealth {
  status: HealthStatus;
  message?: string;
  latency?: number;
  details?: Record<string, any>;
}

class HealthCheckService {
  private dbPool?: Pool;
  private redisClient?: Redis;
  private airiaApiUrl?: string;
  private airiaApiKey?: string;

  /**
   * Initialize health check service with dependencies
   */
  initialize(dependencies: {
    dbPool: Pool;
    redisClient: Redis;
    airiaApiUrl: string;
    airiaApiKey: string;
  }): void {
    this.dbPool = dependencies.dbPool;
    this.redisClient = dependencies.redisClient;
    this.airiaApiUrl = dependencies.airiaApiUrl;
    this.airiaApiKey = dependencies.airiaApiKey;

    logger.info('Health check service initialized');
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    const checks: { [key: string]: DependencyHealth } = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      airia: await this.checkAiria(),
    };

    // Determine overall status
    const statuses = Object.values(checks).map(c => c.status);
    let overallStatus: HealthStatus;

    if (statuses.every(s => s === HealthStatus.HEALTHY)) {
      overallStatus = HealthStatus.HEALTHY;
    } else if (statuses.some(s => s === HealthStatus.UNHEALTHY)) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else {
      overallStatus = HealthStatus.DEGRADED;
    }

    const duration = Date.now() - startTime;
    metricsService.recordHistogram('health.check.duration', duration, undefined, 'ms');

    return {
      status: overallStatus,
      timestamp: new Date(),
      uptime: process.uptime(),
      checks,
    };
  }

  /**
   * Check database health
   */
  private async checkDatabase(): Promise<DependencyHealth> {
    if (!this.dbPool) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: 'Database pool not initialized',
      };
    }

    const startTime = Date.now();

    try {
      const result = await this.dbPool.query('SELECT 1 as health_check');
      const latency = Date.now() - startTime;

      metricsService.trackDatabase('health_check', latency, true);

      if (result.rows[0].health_check === 1) {
        return {
          status: HealthStatus.HEALTHY,
          latency,
          details: {
            totalConnections: this.dbPool.totalCount,
            idleConnections: this.dbPool.idleCount,
            waitingConnections: this.dbPool.waitingCount,
          },
        };
      }

      return {
        status: HealthStatus.UNHEALTHY,
        message: 'Database query returned unexpected result',
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      metricsService.trackDatabase('health_check', latency, false);

      logger.error('Database health check failed', {
        service: 'health-check',
        metadata: { latency },
      }, error as Error);

      return {
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'Unknown error',
        latency,
      };
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedis(): Promise<DependencyHealth> {
    if (!this.redisClient) {
      // Treat missing Redis as degraded (fallback to in-memory cache)
      return {
        status: HealthStatus.DEGRADED,
        message: 'Redis not configured or disabled; using in-memory cache',
      };
    }

    const startTime = Date.now();

    try {
      const result = await this.redisClient.ping();
      const latency = Date.now() - startTime;

      if (result === 'PONG') {
        return {
          status: HealthStatus.HEALTHY,
          latency,
          details: {
            connected: this.redisClient.status === 'ready',
          },
        };
      }

      return {
        status: HealthStatus.UNHEALTHY,
        message: 'Redis ping returned unexpected result',
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      logger.error('Redis health check failed', {
        service: 'health-check',
        metadata: { latency },
      }, error as Error);

      return {
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'Unknown error',
        latency,
      };
    }
  }

  /**
   * Check Airia health
   */
  private async checkAiria(): Promise<DependencyHealth> {
    if (!this.airiaApiUrl || !this.airiaApiKey) {
      return {
        status: HealthStatus.DEGRADED,
        message: 'Airia not configured',
      };
    }

    const startTime = Date.now();

    try {
      // Simple health check - try to reach Airia API
      const response = await fetch(`${this.airiaApiUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.airiaApiKey}`,
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        return {
          status: HealthStatus.HEALTHY,
          latency,
        };
      }

      // Airia unavailable means degraded mode (read-only access to artifacts)
      return {
        status: HealthStatus.DEGRADED,
        message: `Airia returned status ${response.status}`,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      logger.warn('Airia health check failed', {
        service: 'health-check',
        metadata: { latency },
      });

      // Airia unavailable means degraded mode, not unhealthy
      return {
        status: HealthStatus.DEGRADED,
        message: error instanceof Error ? error.message : 'Unknown error',
        latency,
      };
    }
  }

  /**
   * Liveness probe - checks if the service is running
   * Should return healthy unless the service is completely broken
   */
  async checkLiveness(): Promise<{ alive: boolean }> {
    // Simple check - if we can execute this, we're alive
    return { alive: true };
  }

  /**
   * Readiness probe - checks if the service is ready to accept traffic
   * Should check critical dependencies
   */
  async checkReadiness(): Promise<{ ready: boolean; reason?: string }> {
    try {
      // Check critical dependencies
      const dbHealth = await this.checkDatabase();
      const redisHealth = await this.checkRedis();

      // Service is ready if database is healthy
      // Redis can be healthy or degraded (e.g., disabled/fallback). Only block if explicitly unhealthy.
      const ready = 
        dbHealth.status === HealthStatus.HEALTHY &&
        (redisHealth.status === HealthStatus.HEALTHY || redisHealth.status === HealthStatus.DEGRADED);

      if (!ready) {
        const reasons: string[] = [];
        if (dbHealth.status !== HealthStatus.HEALTHY) {
          reasons.push(`database: ${dbHealth.message || dbHealth.status}`);
        }
        if (redisHealth.status !== HealthStatus.HEALTHY) {
          reasons.push(`redis: ${redisHealth.message || redisHealth.status}`);
        }

        return {
          ready: false,
          reason: reasons.join(', '),
        };
      }

      return { ready: true };
    } catch (error) {
      logger.error('Readiness check failed', {
        service: 'health-check',
      }, error as Error);

      return {
        ready: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get service status summary
   */
  async getStatus(): Promise<{
    status: HealthStatus;
    version: string;
    uptime: number;
    timestamp: Date;
  }> {
    const health = await this.checkHealth();

    return {
      status: health.status,
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date(),
    };
  }
}

// Export singleton instance
export const healthCheckService = new HealthCheckService();
