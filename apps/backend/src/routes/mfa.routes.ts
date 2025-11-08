// @ts-nocheck
import { Router, Response } from 'express';
import { mfaService } from '../services/mfa.service';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// All MFA routes require authentication
router.use(authenticateJWT);

/**
 * POST /mfa/totp/enroll
 * Enroll TOTP MFA
 */
router.post('/totp/enroll', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const mfaSecret = await mfaService.enrollTOTP(req.user.userId, req.user.email);

    res.json(mfaSecret);
  } catch (error) {
    console.error('TOTP enrollment error:', error);
    res.status(500).json({
      error: 'Failed to enroll TOTP',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /mfa/totp/verify
 * Verify TOTP token and enable MFA
 */
router.post('/totp/verify', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const verified = await mfaService.verifyTOTP(req.user.userId, token);

    if (verified) {
      await mfaService.enableMFA(req.user.userId);
      res.json({ verified: true, message: 'MFA enabled successfully' });
    } else {
      res.status(400).json({ verified: false, error: 'Invalid token' });
    }
  } catch (error) {
    console.error('TOTP verification error:', error);
    res.status(500).json({
      error: 'Failed to verify TOTP',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /mfa/verify
 * Verify MFA during login (supports both TOTP and backup codes)
 */
router.post('/verify', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { token, backupCode } = req.body;

    if (!token && !backupCode) {
      return res.status(400).json({ error: 'Token or backup code is required' });
    }

    let verified = false;

    if (backupCode) {
      verified = await mfaService.verifyBackupCode(req.user.userId, backupCode);
    } else if (token) {
      verified = await mfaService.verifyTOTP(req.user.userId, token);
    }

    if (verified) {
      res.json({ verified: true });
    } else {
      res.status(400).json({ verified: false, error: 'Invalid token or backup code' });
    }
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({
      error: 'Failed to verify MFA',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /mfa/webauthn/register/options
 * Generate WebAuthn registration options
 */
router.post('/webauthn/register/options', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const options = await mfaService.generateWebAuthnRegistrationOptions(
      req.user.userId,
      req.user.email
    );

    res.json(options);
  } catch (error) {
    console.error('WebAuthn registration options error:', error);
    res.status(500).json({
      error: 'Failed to generate registration options',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /mfa/webauthn/register/verify
 * Verify WebAuthn registration response
 */
router.post('/webauthn/register/verify', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { response } = req.body;

    if (!response) {
      return res.status(400).json({ error: 'Response is required' });
    }

    const verified = await mfaService.verifyWebAuthnRegistration(
      req.user.userId,
      response
    );

    if (verified) {
      res.json({ verified: true, message: 'WebAuthn registered successfully' });
    } else {
      res.status(400).json({ verified: false, error: 'Registration failed' });
    }
  } catch (error) {
    console.error('WebAuthn registration verification error:', error);
    res.status(500).json({
      error: 'Failed to verify registration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /mfa/webauthn/authenticate/options
 * Generate WebAuthn authentication options
 */
router.post('/webauthn/authenticate/options', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const options = await mfaService.generateWebAuthnAuthenticationOptions(
      req.user.userId
    );

    res.json(options);
  } catch (error) {
    console.error('WebAuthn authentication options error:', error);
    res.status(500).json({
      error: 'Failed to generate authentication options',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /mfa/webauthn/authenticate/verify
 * Verify WebAuthn authentication response
 */
router.post('/webauthn/authenticate/verify', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { response } = req.body;

    if (!response) {
      return res.status(400).json({ error: 'Response is required' });
    }

    const verified = await mfaService.verifyWebAuthnAuthentication(
      req.user.userId,
      response
    );

    if (verified) {
      res.json({ verified: true });
    } else {
      res.status(400).json({ verified: false, error: 'Authentication failed' });
    }
  } catch (error) {
    console.error('WebAuthn authentication verification error:', error);
    res.status(500).json({
      error: 'Failed to verify authentication',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /mfa
 * Disable MFA
 */
router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await mfaService.disableMFA(req.user.userId);

    res.json({ message: 'MFA disabled successfully' });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({
      error: 'Failed to disable MFA',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /mfa/status
 * Get MFA status
 */
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const enabled = await mfaService.isMFAEnabled(req.user.userId);
    const method = await mfaService.getMFAMethod(req.user.userId);

    res.json({ enabled, method });
  } catch (error) {
    console.error('MFA status error:', error);
    res.status(500).json({
      error: 'Failed to get MFA status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

