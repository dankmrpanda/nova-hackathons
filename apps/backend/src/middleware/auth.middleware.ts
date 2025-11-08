import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    userId: string;
    email: string;
    tenantId: string;
    role: string;
  };
  sessionInfo?: {
    id: string;
    userId: string;
    tenantId: string;
  };
}

/**
 * Middleware to authenticate requests using JWT
 */
export const authenticateJWT = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No authentication token provided',
      });
    }

    const token = authHeader.substring(7);

    // Verify JWT
    const decoded = authService.verifyJWT(token);

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      userId: decoded.userId,
      email: decoded.email,
      tenantId: decoded.tenantId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      error: 'Invalid or expired token',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Middleware to authenticate requests using session token
 */
export const authenticateSession = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No session token provided',
      });
    }

    const token = authHeader.substring(7);

    // Validate session
    const sessionInfo = await authService.validateSession(token);

    if (!sessionInfo) {
      return res.status(401).json({
        error: 'Invalid or expired session',
      });
    }

    // Attach session info to request
    req.sessionInfo = {
      id: sessionInfo.id,
      userId: sessionInfo.userId,
      tenantId: sessionInfo.tenantId,
    };

    next();
  } catch (error) {
    console.error('Session authentication error:', error);
    return res.status(401).json({
      error: 'Session authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = authService.verifyJWT(token);

      req.user = {
        id: decoded.userId,
        userId: decoded.userId,
        email: decoded.email,
        tenantId: decoded.tenantId,
        role: decoded.role,
      };
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};
