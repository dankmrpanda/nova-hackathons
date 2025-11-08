import { Role } from './auth';

export type Resource =
  | 'session'
  | 'voice-session'
  | 'template'
  | 'user'
  | 'tenant'
  | 'policy'
  | 'audit_log'
  | 'analytics'
  | 'mfa';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'share' | 'manage' | 'view' | 'interact';

export interface Permission {
  resource: Resource;
  action: Action;
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in';
  value: any;
}

export interface RolePermissions {
  role: Role;
  permissions: Permission[];
}

export interface AccessCheckResult {
  granted: boolean;
  reason?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  tenantId: string;
  action: string;
  resource: string;
  resourceId?: string;
  outcome: 'success' | 'failure';
  metadata?: Record<string, any>;
  ipAddress?: string;
}
