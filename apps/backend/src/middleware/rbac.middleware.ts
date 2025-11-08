import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { rbacService } from '../services/rbac.service';
import { Resource, Action, Role } from '@codebase-onboarding/shared';

/**
 * Middleware factory to check permissions
 */
export const requirePermission = (resource: Resource, action: Action) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const hasPermission = await rbacService.checkPermission(
        req.user.userId,
        resource,
        action
      );

      // Log access attempt
      await rbacService.logAccessAttempt(
        req.user.userId,
        resource,
        action,
        hasPermission,
        {
          path: req.path,
          method: req.method,
        }
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `You do not have permission to ${action} ${resource}`,
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        error: 'Failed to check permissions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
};

/**
 * Middleware to check resource ownership
 */
export const requireOwnership = (resourceIdParam: string = 'id') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const resourceId = req.params[resourceIdParam];

      if (!resourceId) {
        return res.status(400).json({ error: 'Resource ID is required' });
      }

      // Administrators can access all resources
      if (req.user.role === 'Administrator') {
        return next();
      }

      // Check ownership based on resource type
      // This is a simplified check - in production, you'd query the database
      // to verify ownership based on the resource type

      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      return res.status(500).json({
        error: 'Failed to check ownership',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
};

/**
 * Middleware to require specific role
 */
export const requireRole = (...roles: Role[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!roles.includes(req.user.role as Role)) {
        await rbacService.logAccessAttempt(
          req.user.userId,
          'user' as Resource,
          'read' as Action,
          false,
          {
            requiredRoles: roles,
            userRole: req.user.role,
            path: req.path,
          }
        );

        return res.status(403).json({
          error: 'Forbidden',
          message: `This action requires one of the following roles: ${roles.join(', ')}`,
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({
        error: 'Failed to check role',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
};

/**
 * Middleware to check tenant isolation
 */
export const requireTenantAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    // Check if user belongs to the tenant
    if (req.user.tenantId !== tenantId) {
      await rbacService.logAccessAttempt(
        req.user.userId,
        'tenant' as Resource,
        'read' as Action,
        false,
        {
          requestedTenantId: tenantId,
          userTenantId: req.user.tenantId,
        }
      );

      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this tenant',
      });
    }

    next();
  } catch (error) {
    console.error('Tenant access check error:', error);
    return res.status(500).json({
      error: 'Failed to check tenant access',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
