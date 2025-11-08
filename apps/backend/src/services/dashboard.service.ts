/**
 * Dashboard Service
 * 
 * Provides data for monitoring dashboards:
 * - Operations dashboard (health, errors, latency)
 * - Cost dashboard (by tenant, service, time)
 * - Usage dashboard (sessions, features, adoption)
 * - Security dashboard (auth events, violations)
 * 
 * Requirements: 15.7, 36.5, 36.6
 */

import { Pool } from 'pg';
import { metricsService } from './metrics.service';
import { healthCheckService } from './health-check.service';
import { alertingService } from './alerting.service';
import { logger } from './logger.service';

export interface OperationsDashboard {
  health: {
    status: string;
    uptime: number;
    dependencies: Record<string, any>;
  };
  errors: {
    total: number;
    rate: number;
    byEndpoint: Array<{ endpoint: string; count: number }>;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  activeAlerts: number;
  timestamp: Date;
}

export interface CostDashboard {
  totalCost: number;
  byTenant: Array<{ tenantId: string; cost: number }>;
  byService: Array<{ service: string; cost: number }>;
  byTime: Array<{ timestamp: Date; cost: number }>;
  topSessions: Array<{ sessionId: string; cost: number }>;
  timestamp: Date;
}

export interface UsageDashboard {
  sessions: {
    total: number;
    active: number;
    completed: number;
    byTenant: Array<{ tenantId: string; count: number }>;
  };
  scripts: {
    generated: number;
    replayed: number;
  };
  templates: {
    created: number;
    shared: number;
    used: number;
  };
  features: {
    voiceSessions: number;
    collaborativeSessions: number;
  };
  timestamp: Date;
}

export interface SecurityDashboard {
  authentication: {
    successfulLogins: number;
    failedLogins: number;
    mfaEnrollments: number;
  };
  policyViolations: {
    total: number;
    byType: Array<{ type: string; count: number }>;
    byTenant: Array<{ tenantId: string; count: number }>;
  };
  auditEvents: {
    total: number;
    byAction: Array<{ action: string; count: number }>;
  };
  timestamp: Date;
}

class DashboardService {
  private dbPool?: Pool;

  /**
   * Initialize dashboard service
   */
  initialize(dbPool: Pool): void {
    this.dbPool = dbPool;
    logger.info('Dashboard service initialized');
  }

  /**
   * Get operations dashboard data
   */
  async getOperationsDashboard(): Promise<OperationsDashboard> {
    try {
      // Get health status
      const health = await healthCheckService.checkHealth();

      // Get error metrics
      const totalErrors = metricsService.getCounter('api.requests.errors') || 0;
      const totalRequests = metricsService.getCounter('api.requests.total') || 1;
      const errorRate = totalErrors / totalRequests;

      // Get active alerts
      const activeAlerts = alertingService.getActiveAlerts().length;

      return {
        health: {
          status: health.status,
          uptime: health.uptime,
          dependencies: health.checks,
        },
        errors: {
          total: totalErrors,
          rate: errorRate,
          byEndpoint: [], // Would need to aggregate from metrics
        },
        latency: {
          p50: 0, // Would calculate from histogram data
          p95: 0,
          p99: 0,
        },
        activeAlerts,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get operations dashboard', {
        service: 'dashboard',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Get cost dashboard data
   */
  async getCostDashboard(startDate?: Date, endDate?: Date): Promise<CostDashboard> {
    if (!this.dbPool) {
      throw new Error('Database pool not initialized');
    }

    try {
      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
      const end = endDate || new Date();

      // Query cost data from audit logs
      const costByTenantQuery = `
        SELECT 
          tenant_id,
          SUM((metadata->>'cost')::numeric) as total_cost
        FROM audit_logs
        WHERE action = 'cost_tracked'
          AND created_at >= $1
          AND created_at <= $2
        GROUP BY tenant_id
        ORDER BY total_cost DESC
      `;

      const costByServiceQuery = `
        SELECT 
          metadata->>'service' as service,
          SUM((metadata->>'cost')::numeric) as total_cost
        FROM audit_logs
        WHERE action = 'cost_tracked'
          AND created_at >= $1
          AND created_at <= $2
        GROUP BY metadata->>'service'
        ORDER BY total_cost DESC
      `;

      const costByTimeQuery = `
        SELECT 
          DATE_TRUNC('hour', created_at) as timestamp,
          SUM((metadata->>'cost')::numeric) as total_cost
        FROM audit_logs
        WHERE action = 'cost_tracked'
          AND created_at >= $1
          AND created_at <= $2
        GROUP BY DATE_TRUNC('hour', created_at)
        ORDER BY timestamp
      `;

      const topSessionsQuery = `
        SELECT 
          metadata->>'sessionId' as session_id,
          SUM((metadata->>'cost')::numeric) as total_cost
        FROM audit_logs
        WHERE action = 'cost_tracked'
          AND created_at >= $1
          AND created_at <= $2
          AND metadata->>'sessionId' IS NOT NULL
        GROUP BY metadata->>'sessionId'
        ORDER BY total_cost DESC
        LIMIT 10
      `;

      const [byTenantResult, byServiceResult, byTimeResult, topSessionsResult] = await Promise.all([
        this.dbPool.query(costByTenantQuery, [start, end]),
        this.dbPool.query(costByServiceQuery, [start, end]),
        this.dbPool.query(costByTimeQuery, [start, end]),
        this.dbPool.query(topSessionsQuery, [start, end]),
      ]);

      const totalCost = byTenantResult.rows.reduce((sum, row) => sum + parseFloat(row.total_cost || 0), 0);

      return {
        totalCost,
        byTenant: byTenantResult.rows.map(row => ({
          tenantId: row.tenant_id,
          cost: parseFloat(row.total_cost || 0),
        })),
        byService: byServiceResult.rows.map(row => ({
          service: row.service,
          cost: parseFloat(row.total_cost || 0),
        })),
        byTime: byTimeResult.rows.map(row => ({
          timestamp: new Date(row.timestamp),
          cost: parseFloat(row.total_cost || 0),
        })),
        topSessions: topSessionsResult.rows.map(row => ({
          sessionId: row.session_id,
          cost: parseFloat(row.total_cost || 0),
        })),
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get cost dashboard', {
        service: 'dashboard',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Get usage dashboard data
   */
  async getUsageDashboard(startDate?: Date, endDate?: Date): Promise<UsageDashboard> {
    if (!this.dbPool) {
      throw new Error('Database pool not initialized');
    }

    try {
      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate || new Date();

      // Query session data
      const sessionsQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          tenant_id
        FROM sessions
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY tenant_id
      `;

      const scriptsQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE action = 'script_generated') as generated,
          COUNT(*) FILTER (WHERE action = 'script_replayed') as replayed
        FROM audit_logs
        WHERE created_at >= $1 AND created_at <= $2
          AND action IN ('script_generated', 'script_replayed')
      `;

      const templatesQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE action = 'template_created') as created,
          COUNT(*) FILTER (WHERE action = 'template_shared') as shared,
          COUNT(*) FILTER (WHERE action = 'template_used') as used
        FROM audit_logs
        WHERE created_at >= $1 AND created_at <= $2
          AND action IN ('template_created', 'template_shared', 'template_used')
      `;

      const voiceSessionsQuery = `
        SELECT COUNT(*) as count
        FROM voice_sessions
        WHERE created_at >= $1 AND created_at <= $2
      `;

      const [sessionsResult, scriptsResult, templatesResult, voiceResult] = await Promise.all([
        this.dbPool.query(sessionsQuery, [start, end]),
        this.dbPool.query(scriptsQuery, [start, end]),
        this.dbPool.query(templatesQuery, [start, end]),
        this.dbPool.query(voiceSessionsQuery, [start, end]),
      ]);

      const totalSessions = sessionsResult.rows.reduce((sum, row) => sum + parseInt(row.total || 0), 0);
      const activeSessions = sessionsResult.rows.reduce((sum, row) => sum + parseInt(row.active || 0), 0);
      const completedSessions = sessionsResult.rows.reduce((sum, row) => sum + parseInt(row.completed || 0), 0);

      return {
        sessions: {
          total: totalSessions,
          active: activeSessions,
          completed: completedSessions,
          byTenant: sessionsResult.rows.map(row => ({
            tenantId: row.tenant_id,
            count: parseInt(row.total || 0),
          })),
        },
        scripts: {
          generated: parseInt(scriptsResult.rows[0]?.generated || 0),
          replayed: parseInt(scriptsResult.rows[0]?.replayed || 0),
        },
        templates: {
          created: parseInt(templatesResult.rows[0]?.created || 0),
          shared: parseInt(templatesResult.rows[0]?.shared || 0),
          used: parseInt(templatesResult.rows[0]?.used || 0),
        },
        features: {
          voiceSessions: parseInt(voiceResult.rows[0]?.count || 0),
          collaborativeSessions: 0, // Would need to query collaborators table
        },
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get usage dashboard', {
        service: 'dashboard',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Get security dashboard data
   */
  async getSecurityDashboard(startDate?: Date, endDate?: Date): Promise<SecurityDashboard> {
    if (!this.dbPool) {
      throw new Error('Database pool not initialized');
    }

    try {
      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate || new Date();

      // Query authentication events
      const authQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE action = 'login_success') as successful_logins,
          COUNT(*) FILTER (WHERE action = 'login_failed') as failed_logins,
          COUNT(*) FILTER (WHERE action = 'mfa_enrolled') as mfa_enrollments
        FROM audit_logs
        WHERE created_at >= $1 AND created_at <= $2
          AND action IN ('login_success', 'login_failed', 'mfa_enrolled')
      `;

      // Query policy violations
      const violationsQuery = `
        SELECT 
          COUNT(*) as total,
          metadata->>'policyType' as type,
          tenant_id
        FROM audit_logs
        WHERE created_at >= $1 AND created_at <= $2
          AND action = 'policy_violated'
        GROUP BY metadata->>'policyType', tenant_id
      `;

      // Query audit events
      const auditQuery = `
        SELECT 
          action,
          COUNT(*) as count
        FROM audit_logs
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY action
        ORDER BY count DESC
        LIMIT 10
      `;

      const [authResult, violationsResult, auditResult] = await Promise.all([
        this.dbPool.query(authQuery, [start, end]),
        this.dbPool.query(violationsQuery, [start, end]),
        this.dbPool.query(auditQuery, [start, end]),
      ]);

      const totalViolations = violationsResult.rows.reduce((sum, row) => sum + parseInt(row.total || 0), 0);

      // Aggregate violations by type
      const violationsByType = new Map<string, number>();
      const violationsByTenant = new Map<string, number>();

      violationsResult.rows.forEach(row => {
        const type = row.type || 'unknown';
        const tenant = row.tenant_id;
        const count = parseInt(row.total || 0);

        violationsByType.set(type, (violationsByType.get(type) || 0) + count);
        violationsByTenant.set(tenant, (violationsByTenant.get(tenant) || 0) + count);
      });

      return {
        authentication: {
          successfulLogins: parseInt(authResult.rows[0]?.successful_logins || 0),
          failedLogins: parseInt(authResult.rows[0]?.failed_logins || 0),
          mfaEnrollments: parseInt(authResult.rows[0]?.mfa_enrollments || 0),
        },
        policyViolations: {
          total: totalViolations,
          byType: Array.from(violationsByType.entries()).map(([type, count]) => ({ type, count })),
          byTenant: Array.from(violationsByTenant.entries()).map(([tenantId, count]) => ({ tenantId, count })),
        },
        auditEvents: {
          total: auditResult.rows.reduce((sum, row) => sum + parseInt(row.count || 0), 0),
          byAction: auditResult.rows.map(row => ({
            action: row.action,
            count: parseInt(row.count || 0),
          })),
        },
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get security dashboard', {
        service: 'dashboard',
      }, error as Error);
      throw error;
    }
  }
}

// Export singleton instance
export const dashboardService = new DashboardService();
