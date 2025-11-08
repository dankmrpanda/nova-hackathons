/**
 * Alerting Service
 * 
 * Manages alerts for:
 * - Critical alerts for service failures
 * - Warning alerts for degraded performance
 * - Cost anomaly alerts
 * - Policy violation alerts
 * 
 * Requirements: 15.5, 36.7, 36.8
 */

import { EventEmitter } from 'events';

import { logger } from './logger.service';
import { metricsService } from './metrics.service';

export enum AlertSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

export enum AlertType {
  SERVICE_FAILURE = 'service_failure',
  HIGH_ERROR_RATE = 'high_error_rate',
  SLOW_RESPONSE = 'slow_response',
  COST_ANOMALY = 'cost_anomaly',
  POLICY_VIOLATION = 'policy_violation',
  RETELL_QUALITY = 'retell_quality',
  RETELL_LATENCY = 'retell_latency',
  AIRIA_UNAVAILABLE = 'airia_unavailable',
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: Date;
}

export interface AlertRule {
  type: AlertType;
  severity: AlertSeverity;
  condition: (data: any) => boolean;
  message: (data: any) => string;
  cooldownMs: number;
}

class AlertingService extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  private alertRules: AlertRule[] = [];
  private monitoringInterval?: NodeJS.Timeout;

  // Tracking windows for rate-based alerts
  private errorCounts: Map<string, number[]> = new Map();
  private requestCounts: Map<string, number[]> = new Map();
  private policyViolationCounts: Map<string, number[]> = new Map();

  constructor() {
    super();
    this.initializeAlertRules();
  }

  /**
   * Initialize alert rules
   */
  private initializeAlertRules(): void {
    // Critical: Service unavailability >5 minutes
    this.alertRules.push({
      type: AlertType.SERVICE_FAILURE,
      severity: AlertSeverity.CRITICAL,
      condition: (data: { unavailableMs: number }) => data.unavailableMs > 5 * 60 * 1000,
      message: (data) => `Service unavailable for ${Math.round(data.unavailableMs / 60000)} minutes`,
      cooldownMs: 5 * 60 * 1000, // 5 minutes
    });

    // Critical: Error rate >10% for 5 minutes
    this.alertRules.push({
      type: AlertType.HIGH_ERROR_RATE,
      severity: AlertSeverity.CRITICAL,
      condition: (data: { errorRate: number }) => data.errorRate > 0.10,
      message: (data) => `Error rate at ${(data.errorRate * 100).toFixed(1)}% (threshold: 10%)`,
      cooldownMs: 5 * 60 * 1000,
    });

    // Warning: Error rate >5% for 5 minutes
    this.alertRules.push({
      type: AlertType.HIGH_ERROR_RATE,
      severity: AlertSeverity.WARNING,
      condition: (data: { errorRate: number }) => data.errorRate > 0.05 && data.errorRate <= 0.10,
      message: (data) => `Error rate at ${(data.errorRate * 100).toFixed(1)}% (threshold: 5%)`,
      cooldownMs: 5 * 60 * 1000,
    });

    // Warning: Response time >2s for 10 minutes
    this.alertRules.push({
      type: AlertType.SLOW_RESPONSE,
      severity: AlertSeverity.WARNING,
      condition: (data: { avgResponseTime: number }) => data.avgResponseTime > 2000,
      message: (data) => `Average response time ${data.avgResponseTime}ms (threshold: 2000ms)`,
      cooldownMs: 10 * 60 * 1000,
    });

    // Warning: Cost anomaly (>2x average)
    this.alertRules.push({
      type: AlertType.COST_ANOMALY,
      severity: AlertSeverity.WARNING,
      condition: (data: { currentCost: number; avgCost: number }) => 
        data.currentCost > data.avgCost * 2,
      message: (data) => 
        `Cost anomaly detected: $${data.currentCost.toFixed(2)} (avg: $${data.avgCost.toFixed(2)})`,
      cooldownMs: 15 * 60 * 1000,
    });

    // Warning: Policy violation rate >5%
    this.alertRules.push({
      type: AlertType.POLICY_VIOLATION,
      severity: AlertSeverity.WARNING,
      condition: (data: { violationRate: number }) => data.violationRate > 0.05,
      message: (data) => 
        `Policy violation rate at ${(data.violationRate * 100).toFixed(1)}% (threshold: 5%)`,
      cooldownMs: 5 * 60 * 1000,
    });

    // Warning: Retell quality score <4/5
    this.alertRules.push({
      type: AlertType.RETELL_QUALITY,
      severity: AlertSeverity.WARNING,
      condition: (data: { qualityScore: number }) => data.qualityScore < 4,
      message: (data) => 
        `Retell voice quality score dropped to ${data.qualityScore.toFixed(1)}/5 (threshold: 4/5)`,
      cooldownMs: 10 * 60 * 1000,
    });

    // Warning: Retell latency >800ms
    this.alertRules.push({
      type: AlertType.RETELL_LATENCY,
      severity: AlertSeverity.WARNING,
      condition: (data: { latency: number }) => data.latency > 800,
      message: (data) => 
        `Retell voice latency at ${data.latency}ms (threshold: 800ms)`,
      cooldownMs: 5 * 60 * 1000,
    });

    // Critical: Airia unavailable
    this.alertRules.push({
      type: AlertType.AIRIA_UNAVAILABLE,
      severity: AlertSeverity.CRITICAL,
      condition: (data: { available: boolean }) => !data.available,
      message: () => 'Airia control plane unavailable - system in read-only mode',
      cooldownMs: 5 * 60 * 1000,
    });
  }

  /**
   * Start monitoring for alerts
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      return;
    }

    this.checkAlerts();
    this.monitoringInterval = setInterval(() => {
      this.checkAlerts();
    }, intervalMs);

    logger.info('Alert monitoring started', {
      service: 'alerting',
      metadata: { intervalMs },
    });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      logger.info('Alert monitoring stopped', { service: 'alerting' });
    }
  }

  /**
   * Check all alert conditions
   */
  private checkAlerts(): void {
    // Check error rate
    this.checkErrorRate();

    // Check policy violations
    this.checkPolicyViolations();

    // Clean up old tracking data
    this.cleanupTrackingData();
  }

  /**
   * Check error rate alerts
   */
  private checkErrorRate(): void {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    // Get error and request counts from last 5 minutes
    const recentErrors = this.getRecentCounts(this.errorCounts, fiveMinutesAgo);
    const recentRequests = this.getRecentCounts(this.requestCounts, fiveMinutesAgo);

    if (recentRequests === 0) return;

    const errorRate = recentErrors / recentRequests;

    // Check against rules
    for (const rule of this.alertRules) {
      if (rule.type === AlertType.HIGH_ERROR_RATE && rule.condition({ errorRate })) {
        this.triggerAlert(rule, { errorRate, recentErrors, recentRequests });
      }
    }
  }

  /**
   * Check policy violation alerts
   */
  private checkPolicyViolations(): void {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    const recentViolations = this.getRecentCounts(this.policyViolationCounts, fiveMinutesAgo);
    const recentRequests = this.getRecentCounts(this.requestCounts, fiveMinutesAgo);

    if (recentRequests === 0) return;

    const violationRate = recentViolations / recentRequests;

    // Check against rules
    for (const rule of this.alertRules) {
      if (rule.type === AlertType.POLICY_VIOLATION && rule.condition({ violationRate })) {
        this.triggerAlert(rule, { violationRate, recentViolations, recentRequests });
      }
    }
  }

  /**
   * Track an error for rate-based alerting
   */
  trackError(endpoint?: string): void {
    const key = endpoint || 'global';
    const errors = this.errorCounts.get(key) || [];
    errors.push(Date.now());
    this.errorCounts.set(key, errors);
  }

  /**
   * Track a request for rate-based alerting
   */
  trackRequest(endpoint?: string): void {
    const key = endpoint || 'global';
    const requests = this.requestCounts.get(key) || [];
    requests.push(Date.now());
    this.requestCounts.set(key, requests);
  }

  /**
   * Track a policy violation
   */
  trackPolicyViolation(tenantId: string): void {
    const violations = this.policyViolationCounts.get(tenantId) || [];
    violations.push(Date.now());
    this.policyViolationCounts.set(tenantId, violations);
  }

  /**
   * Trigger an alert based on a rule
   */
  private triggerAlert(rule: AlertRule, data: any): void {
    const alertKey = `${rule.type}_${rule.severity}`;
    const lastAlertTime = this.lastAlertTime.get(alertKey) || 0;
    const now = Date.now();

    // Check cooldown
    if (now - lastAlertTime < rule.cooldownMs) {
      return;
    }

    const alert: Alert = {
      id: `${alertKey}_${now}`,
      type: rule.type,
      severity: rule.severity,
      message: rule.message(data),
      timestamp: new Date(),
      metadata: data,
    };

    this.alerts.set(alert.id, alert);
    this.lastAlertTime.set(alertKey, now);

    // Emit alert event
    this.emit('alert', alert);

    // Log alert
    if (rule.severity === AlertSeverity.CRITICAL) {
      logger.error(`ALERT: ${alert.message}`, {
        service: 'alerting',
        metadata: { alertType: rule.type, ...data },
      });
    } else {
      logger.warn(`ALERT: ${alert.message}`, {
        service: 'alerting',
        metadata: { alertType: rule.type, ...data },
      });
    }

    // Track alert metric
    metricsService.incrementCounter('alerts.triggered', 1, {
      type: rule.type,
      severity: rule.severity,
    });
  }

  /**
   * Manually trigger an alert
   */
  alert(type: AlertType, severity: AlertSeverity, message: string, metadata?: Record<string, any>): void {
    const alert: Alert = {
      id: `${type}_${Date.now()}`,
      type,
      severity,
      message,
      timestamp: new Date(),
      metadata,
    };

    this.alerts.set(alert.id, alert);
    this.emit('alert', alert);

    if (severity === AlertSeverity.CRITICAL) {
      logger.error(`ALERT: ${message}`, {
        service: 'alerting',
        metadata: { alertType: type, ...metadata },
      });
    } else {
      logger.warn(`ALERT: ${message}`, {
        service: 'alerting',
        metadata: { alertType: type, ...metadata },
      });
    }

    metricsService.incrementCounter('alerts.triggered', 1, { type, severity });
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();

      logger.info(`Alert resolved: ${alert.message}`, {
        service: 'alerting',
        metadata: { alertId, alertType: alert.type },
      });

      metricsService.incrementCounter('alerts.resolved', 1, {
        type: alert.type,
        severity: alert.severity,
      });
    }
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => !a.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get recent counts from tracking map
   */
  private getRecentCounts(map: Map<string, number[]>, since: number): number {
    let total = 0;
    for (const timestamps of map.values()) {
      total += timestamps.filter(t => t >= since).length;
    }
    return total;
  }

  /**
   * Clean up old tracking data
   */
  private cleanupTrackingData(): void {
    const cutoff = Date.now() - 15 * 60 * 1000; // Keep 15 minutes

    const cleanMap = (map: Map<string, number[]>) => {
      for (const [key, timestamps] of map.entries()) {
        const filtered = timestamps.filter(t => t >= cutoff);
        if (filtered.length === 0) {
          map.delete(key);
        } else {
          map.set(key, filtered);
        }
      }
    };

    cleanMap(this.errorCounts);
    cleanMap(this.requestCounts);
    cleanMap(this.policyViolationCounts);
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts.clear();
    this.lastAlertTime.clear();
  }
}

// Export singleton instance
export const alertingService = new AlertingService();
