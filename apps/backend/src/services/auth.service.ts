import { Issuer, Client, generators, TokenSet } from 'openid-client';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { db } from '../db';
import {
  AuthURL,
  AuthToken,
  SessionToken,
  SessionInfo,
  SessionMetadata,
  OIDCUserInfo,
  User,
} from '@codebase-onboarding/shared';

export class AuthService {
  private oidcClient: Client | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initializeOIDC();
  }

  private async initializeOIDC(): Promise<void> {
    try {
      if (!config.auth.oidc.issuer) {
        console.warn('OIDC issuer not configured, SSO will not be available');
        return;
      }

      const issuer = await Issuer.discover(config.auth.oidc.issuer);
      this.oidcClient = new issuer.Client({
        client_id: config.auth.oidc.clientId,
        client_secret: config.auth.oidc.clientSecret,
        redirect_uris: [config.auth.oidc.redirectUri],
        response_types: ['code'],
      });

      console.log('OIDC client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OIDC client:', error);
      throw error;
    }
  }

  async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Initiate SSO authentication flow
   */
  async initiateSSO(tenantId: string): Promise<AuthURL> {
    await this.ensureInitialized();

    if (!this.oidcClient) {
      throw new Error('OIDC client not initialized');
    }

    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    // Store state, nonce, and code_verifier in session or cache
    // For now, we'll encode them in the state parameter
    const stateData = {
      state,
      nonce,
      codeVerifier,
      tenantId,
    };

    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64');

    const url = this.oidcClient.authorizationUrl({
      scope: 'openid email profile',
      state: encodedState,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return {
      url,
      state: encodedState,
    };
  }

  /**
   * Complete SSO authentication flow
   */
  async completeSSO(code: string, state: string): Promise<AuthToken> {
    await this.ensureInitialized();

    if (!this.oidcClient) {
      throw new Error('OIDC client not initialized');
    }

    // Decode state data
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { nonce, codeVerifier, tenantId } = stateData;

    // Exchange code for tokens
    const tokenSet: TokenSet = await this.oidcClient.callback(
      config.auth.oidc.redirectUri,
      { code, state },
      { nonce, code_verifier: codeVerifier, state }
    );

    // Get user info from ID token or userinfo endpoint
    const userInfo = tokenSet.claims() as OIDCUserInfo;

    // Find or create user
    const user = await this.findOrCreateUser(userInfo, tenantId);

    // Update last login
    await db.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate JWT token
    const accessToken = this.generateJWT(user);

    return {
      accessToken,
      expiresIn: 8 * 60 * 60, // 8 hours in seconds
      tokenType: 'Bearer',
    };
  }

  /**
   * Find or create user from OIDC user info
   */
  private async findOrCreateUser(userInfo: OIDCUserInfo, tenantId: string): Promise<User> {
    // Check if user exists
    const result = await db.query(
      'SELECT * FROM users WHERE oidc_sub = $1 AND tenant_id = $2',
      [userInfo.sub, tenantId]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        tenantId: row.tenant_id,
        role: row.role,
        mfaEnabled: row.mfa_enabled,
        mfaMethod: row.mfa_method,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
      };
    }

    // Create new user with Developer role by default
    const insertResult = await db.query(
      `INSERT INTO users (email, name, tenant_id, role, oidc_sub, mfa_enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userInfo.email,
        userInfo.name || userInfo.email,
        tenantId,
        'Developer',
        userInfo.sub,
        false,
      ]
    );

    const row = insertResult.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      tenantId: row.tenant_id,
      role: row.role,
      mfaEnabled: row.mfa_enabled,
      mfaMethod: row.mfa_method,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
    };
  }

  /**
   * Generate JWT token
   */
  private generateJWT(user: User): string {
    const payload = {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    };

    return jwt.sign(payload, config.auth.jwtSecret, {
      expiresIn: config.auth.jwtExpiresIn as string | number,
      issuer: 'codebase-onboarding-agent',
      subject: user.id,
    } as jwt.SignOptions);
  }

  /**
   * Verify JWT token
   */
  verifyJWT(token: string): any {
    try {
      return jwt.verify(token, config.auth.jwtSecret, {
        issuer: 'codebase-onboarding-agent',
      });
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Create session with token storage in database
   */
  async createSession(userId: string, metadata: SessionMetadata): Promise<SessionToken> {
    // Get user to validate and get tenant
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    // Generate session token
    const token = uuidv4();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Calculate expiry (8 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + config.auth.sessionExpiryHours);

    // Store session in database
    await db.query(
      `INSERT INTO sessions (user_id, tenant_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, user.tenant_id, tokenHash, expiresAt, metadata.ipAddress, metadata.userAgent]
    );

    return {
      token,
      expiresAt,
    };
  }

  /**
   * Validate session token
   */
  async validateSession(token: string): Promise<SessionInfo | null> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await db.query(
      `SELECT s.*, u.tenant_id
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Update last activity
    await db.query(
      'UPDATE sessions SET last_activity_at = CURRENT_TIMESTAMP WHERE id = $1',
      [row.id]
    );

    return {
      id: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      lastActivityAt: new Date(),
      metadata: {
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
      },
    };
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionId: string): Promise<void> {
    await db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
  }

  /**
   * List active sessions for a user
   */
  async listActiveSessions(userId: string): Promise<SessionInfo[]> {
    const result = await db.query(
      `SELECT s.*, u.tenant_id
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.user_id = $1 AND s.expires_at > CURRENT_TIMESTAMP
       ORDER BY s.created_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      lastActivityAt: row.last_activity_at,
      metadata: {
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
      },
    }));
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await db.query(
      'DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP'
    );
    return result.rowCount || 0;
  }

  /**
   * Handle GitHub OAuth callback
   */
  async handleGitHubCallback(code: string): Promise<{ token: string; user: any }> {
    const axios = require('axios');

    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    if (!accessToken) {
      throw new Error('Failed to obtain access token');
    }

    // Get user info from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const githubUser = userResponse.data;

    // Check if user exists
    let userResult = await db.query(
      'SELECT * FROM users WHERE github_user_id = $1',
      [githubUser.id]
    );

    let userId: string;

    if (userResult.rows.length === 0) {
      // Create new user
      const newUserResult = await db.query(
        `INSERT INTO users (
          id, email, display_name, github_access_token, 
          github_username, github_user_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
        RETURNING *`,
        [
          uuidv4(),
          githubUser.email || `${githubUser.login}@github.com`,
          githubUser.name || githubUser.login,
          accessToken,
          githubUser.login,
          githubUser.id,
        ]
      );
      userId = newUserResult.rows[0].id;
    } else {
      // Update existing user
      userId = userResult.rows[0].id;
      await db.query(
        `UPDATE users 
         SET github_access_token = $1, 
             github_username = $2,
             display_name = COALESCE(display_name, $3)
         WHERE id = $4`,
        [accessToken, githubUser.login, githubUser.name || githubUser.login, userId]
      );
    }

    // Create JWT token
    const token = jwt.sign(
      { userId, email: githubUser.email, username: githubUser.login },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiresIn } as jwt.SignOptions
    );

    return {
      token,
      user: {
        id: userId,
        email: githubUser.email,
        username: githubUser.login,
        name: githubUser.name,
      },
    };
  }
}

export const authService = new AuthService();
