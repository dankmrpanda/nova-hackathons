import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { mfaService } from '../services/mfa.service';
import { db } from '../db';

/**
 * Middleware to enforce MFA for Administrator role
 */
export const enforceMFAForAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is Administrator
    if (req.user.role === 'Administrator') {
      const mfaEnabled = await mfaService.isMFAEnabled(req.user.userId);

      if (!mfaEnabled) {
        return res.status(403).json({
          error: 'MFA required',
          message: 'Administrators must enable MFA to access this resource',
        });
      }
    }

    next();
  } catch (error) {
    console.error('MFA enforcement error:', error);
    return res.status(500).json({
      error: 'Failed to enforce MFA',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Middleware to check if MFA verification is required
 */
export const requireMFAVerification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const mfaEnabled = await mfaService.isMFAEnabled(req.user.userId);

    if (mfaEnabled) {
      // Check if MFA has been verified in this session
      // In production, you would check a session flag or separate MFA token
      const mfaVerified = req.headers['x-mfa-verified'] === 'true';

      if (!mfaVerified) {
        return res.status(403).json({
          error: 'MFA verification required',
          message: 'Please complete MFA verification',
          mfaRequired: true,
        });
      }
    }

    next();
  } catch (error) {
    console.error('MFA verification check error:', error);
    return res.status(500).json({
      error: 'Failed to check MFA verification',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Middleware to enforce tenant-level MFA policy
 */
export const enforceTenantMFAPolicy = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check tenant MFA policy
    const result = await db.query(
      'SELECT mfa_required FROM tenants WHERE id = $1',
      [req.user.tenantId]
    );

    if (result.rows.length > 0 && result.rows[0].mfa_required) {
      const mfaEnabled = await mfaService.isMFAEnabled(req.user.userId);

      if (!mfaEnabled) {
        return res.status(403).json({
          error: 'MFA required',
          message: 'Your organization requires MFA to be enabled',
        });
      }
    }

    next();
  } catch (error) {
    console.error('Tenant MFA policy enforcement error:', error);
    return res.status(500).json({
      error: 'Failed to enforce tenant MFA policy',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
