// @ts-nocheck
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import {
  OnboardingSession,
  SessionConfig,
  SessionState,
  SessionStatus,
  UpdateSessionRequest,
  SessionListQuery,
  Collaborator,
  CollaboratorPermissions,
  ShareLink,
} from '@codebase-onboarding/shared';

export class SessionService {
  /**
   * Create a new onboarding session
   */
  async createSession(config: SessionConfig): Promise<OnboardingSession> {
    const sessionId = uuidv4();
    
    // Get tenant's cost limit if not specified
    let costLimit = config.costLimit;
    if (!costLimit) {
      const tenantResult = await db.query(
        'SELECT cost_limit FROM tenants WHERE id = $1',
        [config.tenantId]
      );
      costLimit = tenantResult.rows[0]?.cost_limit || 5.00;
    }

    const query = `
      INSERT INTO onboarding_sessions (
        id, user_id, tenant_id, status,
        repository_url, repository_name, repository_owner, repository_branch, repository_commit_sha,
        analysis_scope_type, analysis_scope_paths, analysis_scope_size,
        model_preference, output_format, voice_enabled, random_seed,
        progress, current_cost, cost_limit,
        artifacts, learning_profile_updates,
        started_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19,
        $20, $21,
        $22
      )
      RETURNING *
    `;

    const values = [
      sessionId,
      config.userId,
      config.tenantId,
      'initializing' as SessionStatus,
      config.repositoryUrl,
      config.repositoryName,
      config.repositoryOwner,
      config.repositoryBranch || 'main',
      config.repositoryCommitSha,
      config.analysisScope.type,
      JSON.stringify(config.analysisScope.includedPaths),
      config.analysisScope.maxSize,
      config.modelPreference,
      config.outputFormat,
      config.voiceEnabled,
      config.randomSeed,
      0, // progress
      0.00, // current_cost
      costLimit,
      JSON.stringify([]), // artifacts
      JSON.stringify([]), // learning_profile_updates
      new Date(), // started_at
    ];

    const result = await db.query(query, values);
    return this.mapRowToSession(result.rows[0]);
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<OnboardingSession | null> {
    const result = await db.query(
      'SELECT * FROM onboarding_sessions WHERE id = $1',
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSession(result.rows[0]);
  }

  /**
   * Update a session
   */
  async updateSession(
    sessionId: string,
    updates: UpdateSessionRequest
  ): Promise<OnboardingSession> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
      
      // Set completion/termination timestamps based on status
      if (updates.status === 'completed') {
        setClauses.push(`completed_at = $${paramIndex++}`);
        values.push(new Date());
      } else if (updates.status === 'terminated') {
        setClauses.push(`terminated_at = $${paramIndex++}`);
        values.push(new Date());
      }
    }

    if (updates.progress !== undefined) {
      setClauses.push(`progress = $${paramIndex++}`);
      values.push(updates.progress);
    }

    if (updates.currentCost !== undefined) {
      setClauses.push(`current_cost = $${paramIndex++}`);
      values.push(updates.currentCost);
    }

    if (updates.artifacts !== undefined) {
      setClauses.push(`artifacts = $${paramIndex++}`);
      values.push(JSON.stringify(updates.artifacts));
    }

    if (updates.learningProfileUpdates !== undefined) {
      setClauses.push(`learning_profile_updates = $${paramIndex++}`);
      values.push(JSON.stringify(updates.learningProfileUpdates));
    }

    if (updates.terminationReason !== undefined) {
      setClauses.push(`termination_reason = $${paramIndex++}`);
      values.push(updates.terminationReason);
    }

    if (setClauses.length === 0) {
      // No updates, just return current session
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      return session;
    }

    values.push(sessionId);
    const query = `
      UPDATE onboarding_sessions
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Session not found');
    }

    return this.mapRowToSession(result.rows[0]);
  }

  /**
   * Terminate a session with cleanup
   */
  async terminateSession(
    sessionId: string,
    reason: string
  ): Promise<OnboardingSession> {
    return await this.updateSession(sessionId, {
      status: 'terminated',
      terminationReason: reason,
    });
  }

  /**
   * List sessions with optional filters
   */
  async listSessions(query: SessionListQuery): Promise<OnboardingSession[]> {
    const whereClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (query.userId) {
      whereClauses.push(`user_id = $${paramIndex++}`);
      values.push(query.userId);
    }

    if (query.tenantId) {
      whereClauses.push(`tenant_id = $${paramIndex++}`);
      values.push(query.tenantId);
    }

    if (query.status) {
      whereClauses.push(`status = $${paramIndex++}`);
      values.push(query.status);
    }

    const whereClause = whereClauses.length > 0 
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const sql = `
      SELECT * FROM onboarding_sessions
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);

    const result = await db.query(sql, values);
    return result.rows.map(row => this.mapRowToSession(row));
  }

  /**
   * Get active session count for a user
   */
  async getActiveSessionCount(userId: string): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM onboarding_sessions 
       WHERE user_id = $1 AND status IN ('initializing', 'analyzing', 'paused')`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get active session count for a tenant
   */
  async getTenantActiveSessionCount(tenantId: string): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM onboarding_sessions 
       WHERE tenant_id = $1 AND status IN ('initializing', 'analyzing', 'paused')`,
      [tenantId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Check if user can create a new session based on limits
   */
  async canCreateSession(userId: string, tenantId: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // Check tenant limits
    const tenantResult = await db.query(
      'SELECT max_concurrent_sessions FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      return { allowed: false, reason: 'Tenant not found' };
    }

    const maxConcurrentSessions = tenantResult.rows[0].max_concurrent_sessions;
    const tenantActiveCount = await this.getTenantActiveSessionCount(tenantId);

    if (tenantActiveCount >= maxConcurrentSessions) {
      return {
        allowed: false,
        reason: `Tenant has reached maximum concurrent sessions (${maxConcurrentSessions})`,
      };
    }

    return { allowed: true };
  }

  /**
   * Map database row to OnboardingSession object
   */
  private mapRowToSession(row: any): OnboardingSession {
    return {
      id: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      status: row.status,
      repositoryUrl: row.repository_url,
      repositoryName: row.repository_name,
      repositoryOwner: row.repository_owner,
      repositoryBranch: row.repository_branch,
      repositoryCommitSha: row.repository_commit_sha,
      analysisScopeType: row.analysis_scope_type,
      analysisScopePaths: row.analysis_scope_paths,
      analysisScopeSize: row.analysis_scope_size,
      modelPreference: row.model_preference,
      outputFormat: row.output_format,
      voiceEnabled: row.voice_enabled,
      randomSeed: row.random_seed,
      progress: row.progress,
      currentCost: parseFloat(row.current_cost),
      costLimit: row.cost_limit ? parseFloat(row.cost_limit) : undefined,
      artifacts: row.artifacts || [],
      learningProfileUpdates: row.learning_profile_updates || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      terminatedAt: row.terminated_at,
      terminationReason: row.termination_reason,
      metadata: row.metadata || {},
    };
  }

  /**
   * Create a shareable link for a session
   */
  async createShareLink(
    sessionId: string,
    permissions: CollaboratorPermissions,
    expiresInHours: number = 24
  ): Promise<ShareLink> {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    return {
      token,
      sessionId,
      expiresAt,
      permissions,
    };
  }

  /**
   * Add a collaborator to a session
   */
  async addCollaborator(
    sessionId: string,
    userId: string,
    permissions: CollaboratorPermissions,
    shareLinkToken?: string,
    shareLinkExpiresAt?: Date
  ): Promise<Collaborator> {
    const collaboratorId = uuidv4();

    const query = `
      INSERT INTO session_collaborators (
        id, session_id, user_id,
        can_view, can_interact, can_annotate,
        share_link_token, share_link_expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (session_id, user_id) 
      DO UPDATE SET
        can_view = EXCLUDED.can_view,
        can_interact = EXCLUDED.can_interact,
        can_annotate = EXCLUDED.can_annotate,
        last_active_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      collaboratorId,
      sessionId,
      userId,
      permissions.canView,
      permissions.canInteract,
      permissions.canAnnotate,
      shareLinkToken,
      shareLinkExpiresAt,
    ];

    const result = await db.query(query, values);
    return this.mapRowToCollaborator(result.rows[0]);
  }

  /**
   * Join a session using a share link
   */
  async joinSession(
    shareToken: string,
    userId: string
  ): Promise<{ session: OnboardingSession; collaborator: Collaborator }> {
    // First, find the collaborator entry with this share token
    const collaboratorResult = await db.query(
      `SELECT * FROM session_collaborators 
       WHERE share_link_token = $1 AND share_link_expires_at > NOW()`,
      [shareToken]
    );

    if (collaboratorResult.rows.length === 0) {
      throw new Error('Invalid or expired share link');
    }

    const existingCollaborator = collaboratorResult.rows[0];
    const sessionId = existingCollaborator.session_id;

    // Get the session
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Check if user is already a collaborator
    const existingUserCollaborator = await db.query(
      'SELECT * FROM session_collaborators WHERE session_id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    let collaborator: Collaborator;

    if (existingUserCollaborator.rows.length > 0) {
      // Update last active time
      const updateResult = await db.query(
        `UPDATE session_collaborators 
         SET last_active_at = CURRENT_TIMESTAMP 
         WHERE session_id = $1 AND user_id = $2
         RETURNING *`,
        [sessionId, userId]
      );
      collaborator = this.mapRowToCollaborator(updateResult.rows[0]);
    } else {
      // Add as new collaborator with same permissions as share link
      const permissions: CollaboratorPermissions = {
        canView: existingCollaborator.can_view,
        canInteract: existingCollaborator.can_interact,
        canAnnotate: existingCollaborator.can_annotate,
      };

      collaborator = await this.addCollaborator(
        sessionId,
        userId,
        permissions,
        shareToken,
        existingCollaborator.share_link_expires_at
      );
    }

    return { session, collaborator };
  }

  /**
   * Get all collaborators for a session
   */
  async getCollaborators(sessionId: string): Promise<Collaborator[]> {
    const result = await db.query(
      'SELECT * FROM session_collaborators WHERE session_id = $1 ORDER BY joined_at',
      [sessionId]
    );

    return result.rows.map(row => this.mapRowToCollaborator(row));
  }

  /**
   * Remove a collaborator from a session
   */
  async removeCollaborator(sessionId: string, userId: string): Promise<void> {
    await db.query(
      'DELETE FROM session_collaborators WHERE session_id = $1 AND user_id = $2',
      [sessionId, userId]
    );
  }

  /**
   * Update collaborator's last active time
   */
  async updateCollaboratorActivity(
    sessionId: string,
    userId: string
  ): Promise<void> {
    await db.query(
      `UPDATE session_collaborators 
       SET last_active_at = CURRENT_TIMESTAMP 
       WHERE session_id = $1 AND user_id = $2`,
      [sessionId, userId]
    );
  }

  /**
   * Check if a user has access to a session (as owner or collaborator)
   */
  async hasSessionAccess(sessionId: string, userId: string): Promise<boolean> {
    // Check if user is the owner
    const sessionResult = await db.query(
      'SELECT user_id FROM onboarding_sessions WHERE id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return false;
    }

    if (sessionResult.rows[0].user_id === userId) {
      return true;
    }

    // Check if user is a collaborator
    const collaboratorResult = await db.query(
      'SELECT id FROM session_collaborators WHERE session_id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    return collaboratorResult.rows.length > 0;
  }

  /**
   * Get collaborator permissions for a user
   */
  async getCollaboratorPermissions(
    sessionId: string,
    userId: string
  ): Promise<CollaboratorPermissions | null> {
    const result = await db.query(
      `SELECT can_view, can_interact, can_annotate 
       FROM session_collaborators 
       WHERE session_id = $1 AND user_id = $2`,
      [sessionId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      canView: result.rows[0].can_view,
      canInteract: result.rows[0].can_interact,
      canAnnotate: result.rows[0].can_annotate,
    };
  }

  /**
   * Map database row to Collaborator object
   */
  private mapRowToCollaborator(row: unknown): Collaborator {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      permissions: {
        canView: row.can_view,
        canInteract: row.can_interact,
        canAnnotate: row.can_annotate,
      },
      joinedAt: row.joined_at,
      lastActiveAt: row.last_active_at,
      shareLinkToken: row.share_link_token,
      shareLinkExpiresAt: row.share_link_expires_at,
    };
  }
}

export const sessionService = new SessionService();

