// @ts-nocheck
import { Router, Response } from 'express';
import { rbacService } from '../services/rbac.service';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { requireRole, requirePermission } from '../middleware/rbac.middleware';
import { Role } from '@codebase-onboarding/shared';

const router = Router();

// All RBAC routes require authentication
router.use(authenticateJWT);

/**
 * GET /rbac/permissions
 * Get permissions for current user's role
 */
router.get('/permissions', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const permissions = rbacService.getPermissionsForRole(req.user.role as Role);

    res.json({ role: req.user.role, permissions });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({
      error: 'Failed to get permissions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /rbac/roles/assign
 * Assign role to a user (Administrator only)
 */
router.post(
  '/roles/assign',
  requireRole('Administrator'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { userId, role } = req.body;

      if (!userId || !role) {
        return res.status(400).json({ error: 'User ID and role are required' });
      }

      // Validate role
      const validRoles: Role[] = ['Developer', 'Collaborator', 'TeamLead', 'Administrator'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      await rbacService.assignRole(userId, role, req.user.tenantId);

      // Log the role assignment
      await rbacService.logAccessAttempt(
        req.user.userId,
        'user',
        'update',
        true,
        {
          targetUserId: userId,
          newRole: role,
        }
      );

      res.json({ message: 'Role assigned successfully', userId, role });
    } catch (error) {
      console.error('Assign role error:', error);
      res.status(500).json({
        error: 'Failed to assign role',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /rbac/roles/revoke
 * Revoke role from a user (Administrator only)
 */
router.post(
  '/roles/revoke',
  requireRole('Administrator'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      await rbacService.revokeRole(userId, req.user.tenantId);

      // Log the role revocation
      await rbacService.logAccessAttempt(
        req.user.userId,
        'user',
        'update',
        true,
        {
          targetUserId: userId,
          action: 'role_revoked',
        }
      );

      res.json({ message: 'Role revoked successfully', userId });
    } catch (error) {
      console.error('Revoke role error:', error);
      res.status(500).json({
        error: 'Failed to revoke role',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /rbac/users/:role
 * Get all users with a specific role (TeamLead and Administrator)
 */
router.get(
  '/users/:role',
  requireRole('TeamLead', 'Administrator'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { role } = req.params;

      // Validate role
      const validRoles: Role[] = ['Developer', 'Collaborator', 'TeamLead', 'Administrator'];
      if (!validRoles.includes(role as Role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const users = await rbacService.getUsersByRole(role as Role, req.user.tenantId);

      res.json({ role, users });
    } catch (error) {
      console.error('Get users by role error:', error);
      res.status(500).json({
        error: 'Failed to get users',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /rbac/audit-logs
 * Get audit logs (Administrator only)
 */
router.get(
  '/audit-logs',
  requireRole('Administrator'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const logs = await rbacService.getAuditLogs(req.user.tenantId, limit, offset);

      res.json({ logs, limit, offset, total: logs.length });
    } catch (error) {
      console.error('Get audit logs error:', error);
      res.status(500).json({
        error: 'Failed to get audit logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /rbac/audit-logs/user/:userId
 * Get audit logs for a specific user (Administrator only)
 */
router.get(
  '/audit-logs/user/:userId',
  requireRole('Administrator'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const logs = await rbacService.getUserAuditLogs(userId, limit, offset);

      res.json({ userId, logs, limit, offset, total: logs.length });
    } catch (error) {
      console.error('Get user audit logs error:', error);
      res.status(500).json({
        error: 'Failed to get user audit logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /rbac/check-permission
 * Check if user has a specific permission
 */
router.get('/check-permission', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { resource, action } = req.query;

    if (!resource || !action) {
      return res.status(400).json({ error: 'Resource and action are required' });
    }

    const hasPermission = await rbacService.checkPermission(
      req.user.userId,
      resource as any,
      action as any
    );

    res.json({ hasPermission, resource, action });
  } catch (error) {
    console.error('Check permission error:', error);
    res.status(500).json({
      error: 'Failed to check permission',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

