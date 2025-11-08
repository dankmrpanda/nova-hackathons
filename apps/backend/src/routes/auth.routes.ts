// @ts-nocheck
import { Router, Request, Response } from 'express';
import { authService } from '../services/auth.service';

const router = Router();

/**
 * POST /auth/sso/initiate
 * Initiate SSO authentication flow
 */
router.post('/sso/initiate', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant ID is required',
      });
    }

    const authUrl = await authService.initiateSSO(tenantId);

    res.json(authUrl);
  } catch (error) {
    console.error('SSO initiation error:', error);
    res.status(500).json({
      error: 'Failed to initiate SSO authentication',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /auth/github/callback
 * GitHub OAuth callback endpoint
 */
router.get('/github/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.redirect('http://localhost:3000?error=no_code');
    }

    // Exchange code for token and create/login user
    const result = await authService.handleGitHubCallback(code);

    // Redirect to frontend with token
    res.redirect(`http://localhost:3000?token=${result.token}&user=${encodeURIComponent(JSON.stringify(result.user))}`);
  } catch (error) {
    console.error('GitHub callback error:', error);
    res.redirect('http://localhost:3000?error=auth_failed');
  }
});

/**
 * GET /auth/callback
 * OAuth callback endpoint
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
      return res.status(400).json({
        error: 'Invalid callback parameters',
      });
    }

    const authToken = await authService.completeSSO(code, state);

    // In production, you might want to redirect to frontend with token
    // For now, return the token
    res.json(authToken);
  } catch (error) {
    console.error('SSO callback error:', error);
    res.status(500).json({
      error: 'Failed to complete SSO authentication',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /auth/session
 * Create a new session
 */
router.post('/session', async (req: Request, res: Response) => {
  try {
    const { userId, ipAddress, userAgent } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'User ID is required',
      });
    }

    const sessionToken = await authService.createSession(userId, {
      ipAddress: ipAddress || req.ip || 'unknown',
      userAgent: userAgent || req.get('user-agent') || 'unknown',
    });

    res.json(sessionToken);
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({
      error: 'Failed to create session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /auth/session/validate
 * Validate session token
 */
router.get('/session/validate', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'No token provided',
      });
    }

    const sessionInfo = await authService.validateSession(token);

    if (!sessionInfo) {
      return res.status(401).json({
        error: 'Invalid or expired session',
      });
    }

    res.json(sessionInfo);
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({
      error: 'Failed to validate session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /auth/session/:sessionId
 * Revoke a session
 */
router.delete('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    await authService.revokeSession(sessionId);

    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    console.error('Session revocation error:', error);
    res.status(500).json({
      error: 'Failed to revoke session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /auth/sessions
 * List active sessions for authenticated user
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        error: 'User ID is required',
      });
    }

    const sessions = await authService.listActiveSessions(userId);

    res.json(sessions);
  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({
      error: 'Failed to list sessions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

