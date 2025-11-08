import { db } from '../db';
import {
  Role,
  Resource,
  Action,
  Permission,
  RolePermissions,
  AccessCheckResult,
  AuditLogEntry,
} from '@codebase-onboarding/shared';

export class RBACService {
  private roleHierarchy: Record<Role, number> = {
    Collaborator: 1,
    Developer: 2,
    TeamLead: 3,
    Administrator: 4,
  };

  private rolePermissions: RolePermissions[] = [
    {
      role: 'Collaborator',
      permissions: [
        { resource: 'session', action: 'read' },
        // Collaborators can only read shared sessions
      ],
    },
    {
      role: 'Developer',
      permissions: [
        { resource: 'session', action: 'create' },
        { resource: 'session', action: 'read' },
        { resource: 'session', action: 'update' },
        { resource: 'session', action: 'delete' },
        { resource: 'session', action: 'share' },
        { resource: 'template', action: 'read' },
        { resource: 'mfa', action: 'manage' },
      ],
    },
    {
      role: 'TeamLead',
      permissions: [
        { resource: 'session', action: 'create' },
        { resource: 'session', action: 'read' },
        { resource: 'session', action: 'update' },
        { resource: 'session', action: 'delete' },
        { resource: 'session', action: 'share' },
        { resource: 'template', action: 'create' },
        { resource: 'template', action: 'read' },
        { resource: 'template', action: 'update' },
        { resource: 'template', action: 'delete' },
        { resource: 'template', action: 'share' },
        { resource: 'analytics', action: 'read' },
        { resource: 'user', action: 'read' },
        { resource: 'mfa', action: 'manage' },
      ],
    },
    {
      role: 'Administrator',
      permissions: [
        { resource: 'session', action: 'create' },
        { resource: 'session', action: 'read' },
        { resource: 'session', action: 'update' },
        { resource: 'session', action: 'delete' },
        { resource: 'session', action: 'manage' },
        { resource: 'template', action: 'create' },
        { resource: 'template', action: 'read' },
        { resource: 'template', action: 'update' },
        { resource: 'template', action: 'delete' },
        { resource: 'template', action: 'share' },
        { resource: 'user', action: 'create' },
        { resource: 'user', action: 'read' },
        { resource: 'user', action: 'update' },
        { resource: 'user', action: 'delete' },
        { resource: 'user', action: 'manage' },
        { resource: 'tenant', action: 'read' },
        { resource: 'tenant', action: 'update' },
        { resource: 'tenant', action: 'manage' },
        { resource: 'policy', action: 'create' },
        { resource: 'policy', action: 'read' },
        { resource: 'policy', action: 'update' },
        { resource: 'policy', action: 'delete' },
        { resource: 'audit_log', action: 'read' },
        { resource: 'analytics', action: 'read' },
        { resource: 'mfa', action: 'manage' },
      ],
    },
  ];

  /**
   * Check if a user has permission to perform an action on a resource
   */
  async checkPermission(
    userId: string,
    resource: Resource,
    action: Action,
    resourceOwnerId?: string
  ): Promise<boolean> {
    try {
      // Get user role
      const role = await this.getUserRole(userId);

      if (!role) {
        return false;
      }

      // Get role permissions
      const rolePerms = this.rolePermissions.find((rp) => rp.role === role);

      if (!rolePerms) {
        return false;
      }

      // Check if permission exists
      const hasPermission = rolePerms.permissions.some(
        (p) => p.resource === resource && p.action === action
      );

      if (!hasPermission) {
        return false;
      }

      // Additional ownership check for certain resources
      if (resourceOwnerId && resource === 'session') {
        // Developers can only access their own sessions
        if (role === 'Developer' && userId !== resourceOwnerId) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * Get user role
   */
  async getUserRole(userId: string): Promise<Role | null> {
    try {
      const result = await db.query('SELECT role FROM users WHERE id = $1', [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].role as Role;
    } catch (error) {
      console.error('Get user role error:', error);
      return null;
    }
  }

  /**
   * Get user role with tenant context
   */
  async getUserRoleInTenant(userId: string, tenantId: string): Promise<Role | null> {
    try {
      const result = await db.query(
        'SELECT role FROM users WHERE id = $1 AND tenant_id = $2',
        [userId, tenantId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].role as Role;
    } catch (error) {
      console.error('Get user role in tenant error:', error);
      return null;
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, role: Role, tenantId: string): Promise<void> {
    try {
      await db.query('UPDATE users SET role = $1 WHERE id = $2 AND tenant_id = $3', [
        role,
        userId,
        tenantId,
      ]);
    } catch (error) {
      console.error('Assign role error:', error);
      throw error;
    }
  }

  /**
   * Revoke role (set to default Developer role)
   */
  async revokeRole(userId: string, tenantId: string): Promise<void> {
    try {
      await db.query('UPDATE users SET role = $1 WHERE id = $2 AND tenant_id = $3', [
        'Developer',
        userId,
        tenantId,
      ]);
    } catch (error) {
      console.error('Revoke role error:', error);
      throw error;
    }
  }

  /**
   * Log access attempt for audit
   */
  async logAccessAttempt(
    userId: string,
    resource: Resource,
    action: Action,
    granted: boolean,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Get user's tenant
      const userResult = await db.query(
        'SELECT tenant_id FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return;
      }

      const tenantId = userResult.rows[0].tenant_id;

      await db.query(
        `INSERT INTO audit_logs (user_id, tenant_id, action, resource, outcome, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          tenantId,
          action,
          resource,
          granted ? 'success' : 'failure',
          metadata ? JSON.stringify(metadata) : null,
        ]
      );
    } catch (error) {
      console.error('Log access attempt error:', error);
      // Don't throw - logging failures shouldn't break the application
    }
  }

  /**
   * Get permissions for a role
   */
  getPermissionsForRole(role: Role): Permission[] {
    const rolePerms = this.rolePermissions.find((rp) => rp.role === role);
    return rolePerms ? rolePerms.permissions : [];
  }

  /**
   * Check if role has higher or equal privilege than another role
   */
  hasHigherOrEqualPrivilege(role1: Role, role2: Role): boolean {
    return this.roleHierarchy[role1] >= this.roleHierarchy[role2];
  }

  /**
   * Get all users with a specific role in a tenant
   */
  async getUsersByRole(role: Role, tenantId: string): Promise<any[]> {
    try {
      const result = await db.query(
        'SELECT id, email, name, role, created_at FROM users WHERE role = $1 AND tenant_id = $2',
        [role, tenantId]
      );

      return result.rows;
    } catch (error) {
      console.error('Get users by role error:', error);
      throw error;
    }
  }

  /**
   * Get audit logs for a tenant
   */
  async getAuditLogs(
    tenantId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLogEntry[]> {
    try {
      const result = await db.query(
        `SELECT * FROM audit_logs 
         WHERE tenant_id = $1 
         ORDER BY timestamp DESC 
         LIMIT $2 OFFSET $3`,
        [tenantId, limit, offset]
      );

      return result.rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        userId: row.user_id,
        tenantId: row.tenant_id,
        action: row.action,
        resource: row.resource,
        resourceId: row.resource_id,
        outcome: row.outcome,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        ipAddress: row.ip_address,
      }));
    } catch (error) {
      console.error('Get audit logs error:', error);
      throw error;
    }
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserAuditLogs(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLogEntry[]> {
    try {
      const result = await db.query(
        `SELECT * FROM audit_logs 
         WHERE user_id = $1 
         ORDER BY timestamp DESC 
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      return result.rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        userId: row.user_id,
        tenantId: row.tenant_id,
        action: row.action,
        resource: row.resource,
        resourceId: row.resource_id,
        outcome: row.outcome,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        ipAddress: row.ip_address,
      }));
    } catch (error) {
      console.error('Get user audit logs error:', error);
      throw error;
    }
  }
}

export const rbacService = new RBACService();
