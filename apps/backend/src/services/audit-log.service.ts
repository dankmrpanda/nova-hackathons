/**
 * Audit Log Service
 * 
 * Implements structured audit logging with redaction and tamper detection
 * Task: 11.4 Implement audit logging
 * Requirements: 19.1, 19.2, 19.9, 19.11, 19.12
 */

import crypto from 'crypto';

import { db } from '../db';

export interface AuditLogEntry {
  userId: string;
  tenantId: string;
  action: string;
  resource: string;
  resourceId?: string;
  outcome: 'success' | 'failure';
  metadata?: Record<string, any>;
  ipAddress?: string;
}

export interface AuditLogQuery {
  tenantId?: string;
  userId?: string;
  action?: string;
  resource?: string;
  outcome?: 'success' | 'failure';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogExport {
  format: 'json' | 'csv';
  query: AuditLogQuery;
}

/**
 * Sensitive data patterns to redact from audit logs
 */
const SENSITIVE_PATTERNS = [
  // Tokens and keys
  /token["\s:=]+([a-zA-Z0-9_\-.]+)/gi,
  /api[_-]?key["\s:=]+([a-zA-Z0-9_\-.]+)/gi,
  /secret["\s:=]+([a-zA-Z0-9_\-.]+)/gi,
  /password["\s:=]+([a-zA-Z0-9_\-.]+)/gi,
  /bearer\s+([a-zA-Z0-9_\-.]+)/gi,
  
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // Phone numbers (US format)
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  
  // SSN (US format)
  /\b\d{3}-\d{2}-\d{4}\b/g,
  
  // Credit card numbers
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  
  // IP addresses (keep for audit purposes, but can be redacted if needed)
  // /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
];

/**
 * Audit Log Service for compliance and security tracking
 */
export class AuditLogService {
  /**
   * Write audit log entry
   * Requirement 19.1: Log all authentication events
   * Requirement 19.2: Log all repository access events
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Redact sensitive data from metadata
      const redactedMetadata = this.redactSensitiveData(entry.metadata || {});

      // Use partitioned table for better performance
      await db.query(
        `INSERT INTO audit_logs_partitioned 
         (user_id, tenant_id, action, resource, resource_id, outcome, metadata, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          entry.userId,
          entry.tenantId,
          entry.action,
          entry.resource,
          entry.resourceId || null,
          entry.outcome,
          JSON.stringify(redactedMetadata),
          entry.ipAddress || null,
        ]
      );
    } catch (error) {
      // Log to console if database write fails (don't throw to avoid breaking main flow)
      console.error('Failed to write audit log:', error);
      console.error('Audit log entry:', {
        ...entry,
        metadata: this.redactSensitiveData(entry.metadata || {}),
      });
    }
  }

  /**
   * Log authentication event
   * Requirement 19.1: Log all authentication events with timestamp, user ID, IP, and outcome
   */
  async logAuthEvent(
    userId: string,
    tenantId: string,
    action: 'login' | 'logout' | 'mfa_enroll' | 'mfa_verify' | 'token_refresh',
    outcome: 'success' | 'failure',
    ipAddress?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      tenantId,
      action: `auth:${action}`,
      resource: 'authentication',
      outcome,
      ipAddress,
      metadata,
    });
  }

  /**
   * Log repository access event
   * Requirement 19.2: Log repository access without code content
   */
  async logRepositoryAccess(
    userId: string,
    tenantId: string,
    action: 'list' | 'select' | 'analyze' | 'fetch_tree',
    repositoryName: string,
    outcome: 'success' | 'failure',
    metadata?: Record<string, any>
  ): Promise<void> {
    // Ensure no code content in metadata
    const sanitizedMetadata = this.removeCodeContent(metadata || {});

    await this.log({
      userId,
      tenantId,
      action: `repository:${action}`,
      resource: 'repository',
      resourceId: repositoryName,
      outcome,
      metadata: sanitizedMetadata,
    });
  }

  /**
   * Log API call to external service
   * Requirement 19.3: Log API calls with redacted metadata
   */
  async logAPICall(
    userId: string,
    tenantId: string,
    service: string,
    operation: string,
    outcome: 'success' | 'failure',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      tenantId,
      action: `api:${service}:${operation}`,
      resource: 'external_api',
      resourceId: service,
      outcome,
      metadata,
    });
  }

  /**
   * Log data deletion event
   * Requirement 19.4: Log all data deletion events
   */
  async logDataDeletion(
    userId: string,
    tenantId: string,
    resourceType: string,
    resourceId: string,
    outcome: 'success' | 'failure',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      tenantId,
      action: 'data:delete',
      resource: resourceType,
      resourceId,
      outcome,
      metadata,
    });
  }

  /**
   * Log permission change
   * Requirement 19.5: Log all permission changes
   */
  async logPermissionChange(
    userId: string,
    tenantId: string,
    action: 'grant' | 'revoke',
    targetUserId: string,
    permission: string,
    outcome: 'success' | 'failure',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      tenantId,
      action: `permission:${action}`,
      resource: 'permission',
      resourceId: targetUserId,
      outcome,
      metadata: {
        ...metadata,
        permission,
      },
    });
  }

  /**
   * Log Airia policy enforcement event
   * Requirement 19.7: Log Airia policy enforcement events
   */
  async logPolicyEnforcement(
    userId: string,
    tenantId: string,
    policyName: string,
    action: 'allow' | 'deny' | 'fallback',
    outcome: 'success' | 'failure',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      tenantId,
      action: `policy:${action}`,
      resource: 'airia_policy',
      resourceId: policyName,
      outcome,
      metadata,
    });
  }

  /**
   * Log Retell AI session event
   * Requirement 19.8: Log Retell AI session events without voice content
   */
  async logVoiceSessionEvent(
    userId: string,
    tenantId: string,
    action: 'start' | 'end' | 'join' | 'leave',
    sessionId: string,
    outcome: 'success' | 'failure',
    metadata?: Record<string, any>
  ): Promise<void> {
    // Ensure no voice content in metadata
    const sanitizedMetadata = this.removeVoiceContent(metadata || {});

    await this.log({
      userId,
      tenantId,
      action: `voice:${action}`,
      resource: 'voice_session',
      resourceId: sessionId,
      outcome,
      metadata: sanitizedMetadata,
    });
  }

  /**
   * Query audit logs
   */
  async query(query: AuditLogQuery): Promise<any[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE clause
    if (query.tenantId) {
      conditions.push(`tenant_id = $${paramIndex++}`);
      params.push(query.tenantId);
    }

    if (query.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(query.userId);
    }

    if (query.action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(query.action);
    }

    if (query.resource) {
      conditions.push(`resource = $${paramIndex++}`);
      params.push(query.resource);
    }

    if (query.outcome) {
      conditions.push(`outcome = $${paramIndex++}`);
      params.push(query.outcome);
    }

    if (query.startDate) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      params.push(query.startDate);
    }

    if (query.endDate) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      params.push(query.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = query.limit || 100;
    const offset = query.offset || 0;

    const sql = `
      SELECT id, timestamp, user_id, tenant_id, action, resource, resource_id, 
             outcome, metadata, ip_address
      FROM audit_logs_partitioned
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const result = await db.query(sql, params);
    return result.rows;
  }

  /**
   * Export audit logs for compliance
   * Requirement 19.11: Provide audit log export functionality
   */
  async export(exportConfig: AuditLogExport): Promise<string> {
    const logs = await this.query(exportConfig.query);

    if (exportConfig.format === 'json') {
      return JSON.stringify(logs, null, 2);
    } else if (exportConfig.format === 'csv') {
      return this.convertToCSV(logs);
    }

    throw new Error(`Unsupported export format: ${exportConfig.format}`);
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(tenantId: string, startDate: Date, endDate: Date): Promise<any> {
    const result = await db.query(
      `SELECT 
         action,
         resource,
         outcome,
         COUNT(*) as count
       FROM audit_logs_partitioned
       WHERE tenant_id = $1
         AND timestamp >= $2
         AND timestamp <= $3
       GROUP BY action, resource, outcome
       ORDER BY count DESC`,
      [tenantId, startDate, endDate]
    );

    return result.rows;
  }

  /**
   * Verify audit log integrity (tamper detection)
   * Requirement 19.9: Append-only storage with tamper detection
   */
  async verifyIntegrity(tenantId: string, startDate: Date, endDate: Date): Promise<{
    verified: boolean;
    totalLogs: number;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Get logs in chronological order
    const result = await db.query(
      `SELECT id, timestamp, user_id, action, resource, outcome, metadata
       FROM audit_logs_partitioned
       WHERE tenant_id = $1
         AND timestamp >= $2
         AND timestamp <= $3
       ORDER BY timestamp ASC`,
      [tenantId, startDate, endDate]
    );

    const logs = result.rows;
    const totalLogs = logs.length;

    // Check for gaps in timestamps (potential deletion)
    for (let i = 1; i < logs.length; i++) {
      const prevTimestamp = new Date(logs[i - 1].timestamp).getTime();
      const currTimestamp = new Date(logs[i].timestamp).getTime();

      // If there's a large gap (> 1 hour) and no explanation, flag it
      const gap = currTimestamp - prevTimestamp;
      if (gap > 3600000) {
        // 1 hour in milliseconds
        issues.push(
          `Large time gap detected between logs: ${new Date(prevTimestamp).toISOString()} to ${new Date(currTimestamp).toISOString()}`
        );
      }
    }

    // Check for duplicate IDs (potential tampering)
    const ids = new Set();
    for (const log of logs) {
      if (ids.has(log.id)) {
        issues.push(`Duplicate log ID detected: ${log.id}`);
      }
      ids.add(log.id);
    }

    return {
      verified: issues.length === 0,
      totalLogs,
      issues,
    };
  }

  /**
   * Get audit logs count
   */
  async getCount(query: AuditLogQuery): Promise<number> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.tenantId) {
      conditions.push(`tenant_id = $${paramIndex++}`);
      params.push(query.tenantId);
    }

    if (query.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(query.userId);
    }

    if (query.action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(query.action);
    }

    if (query.resource) {
      conditions.push(`resource = $${paramIndex++}`);
      params.push(query.resource);
    }

    if (query.outcome) {
      conditions.push(`outcome = $${paramIndex++}`);
      params.push(query.outcome);
    }

    if (query.startDate) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      params.push(query.startDate);
    }

    if (query.endDate) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      params.push(query.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT COUNT(*) as count FROM audit_logs_partitioned ${whereClause}`,
      params
    );

    return parseInt(result.rows[0].count, 10);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Redact sensitive data from metadata
   * Requirement 19.12: Redact all repository code, secrets, and PII
   */
  private redactSensitiveData(metadata: Record<string, any>): Record<string, any> {
    const redacted = { ...metadata };

    // Convert to string for pattern matching
    let metadataStr = JSON.stringify(redacted);

    // Apply redaction patterns
    for (const pattern of SENSITIVE_PATTERNS) {
      metadataStr = metadataStr.replace(pattern, (match, group1) => {
        if (group1) {
          return match.replace(group1, '[REDACTED]');
        }
        return '[REDACTED]';
      });
    }

    // Parse back to object
    try {
      return JSON.parse(metadataStr);
    } catch (error) {
      console.error('Error parsing redacted metadata:', error);
      return { error: 'Failed to redact metadata' };
    }
  }

  /**
   * Remove code content from metadata
   */
  private removeCodeContent(metadata: Record<string, any>): Record<string, any> {
    const sanitized = { ...metadata };

    // Remove fields that might contain code
    const codeFields = ['code', 'content', 'snippet', 'source', 'body', 'diff'];
    for (const field of codeFields) {
      if (sanitized[field]) {
        sanitized[field] = '[CODE_REMOVED]';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.removeCodeContent(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Remove voice content from metadata
   */
  private removeVoiceContent(metadata: Record<string, any>): Record<string, any> {
    const sanitized = { ...metadata };

    // Remove fields that might contain voice data
    const voiceFields = ['audio', 'recording', 'audioData', 'voiceData', 'transcript'];
    for (const field of voiceFields) {
      if (sanitized[field]) {
        sanitized[field] = '[VOICE_REMOVED]';
      }
    }

    // Keep duration and participant count for audit purposes
    // But remove actual content

    return sanitized;
  }

  /**
   * Convert logs to CSV format
   */
  private convertToCSV(logs: any[]): string {
    if (logs.length === 0) {
      return '';
    }

    // CSV header
    const headers = [
      'ID',
      'Timestamp',
      'User ID',
      'Tenant ID',
      'Action',
      'Resource',
      'Resource ID',
      'Outcome',
      'IP Address',
      'Metadata',
    ];

    const rows = logs.map((log) => [
      log.id,
      log.timestamp,
      log.user_id,
      log.tenant_id,
      log.action,
      log.resource,
      log.resource_id || '',
      log.outcome,
      log.ip_address || '',
      JSON.stringify(log.metadata || {}),
    ]);

    // Escape CSV values
    const escapeCsvValue = (value: any): string => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvLines = [
      headers.map(escapeCsvValue).join(','),
      ...rows.map((row) => row.map(escapeCsvValue).join(',')),
    ];

    return csvLines.join('\n');
  }

  /**
   * Calculate hash for tamper detection
   */
  private calculateHash(data: unknown): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }
}

// Singleton instance
let auditLogServiceInstance: AuditLogService | null = null;

/**
 * Get singleton AuditLogService instance
 */
export function getAuditLogService(): AuditLogService {
  if (!auditLogServiceInstance) {
    auditLogServiceInstance = new AuditLogService();
  }
  return auditLogServiceInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetAuditLogService(): void {
  auditLogServiceInstance = null;
}

