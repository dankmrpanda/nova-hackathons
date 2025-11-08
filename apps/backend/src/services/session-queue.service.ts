import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface QueueEntry {
  id: string;
  userId: string;
  tenantId: string;
  sessionConfig: any;
  position: number;
  createdAt: Date;
  expiresAt: Date;
}

class SessionQueueService {
  private readonly QUEUE_EXPIRY_MINUTES = 30;

  /**
   * Add user to session queue
   */
  async addToQueue(
    userId: string,
    tenantId: string,
    sessionConfig: any
  ): Promise<QueueEntry> {
    const queueId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.QUEUE_EXPIRY_MINUTES);

    // Get current queue position
    const positionResult = await db.query(
      `SELECT COUNT(*) as count FROM session_queue 
       WHERE tenant_id = $1 AND expires_at > NOW()`,
      [tenantId]
    );

    const position = parseInt(positionResult.rows[0].count, 10) + 1;

    const query = `
      INSERT INTO session_queue (
        id, user_id, tenant_id, session_config, position, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      queueId,
      userId,
      tenantId,
      JSON.stringify(sessionConfig),
      position,
      expiresAt,
    ];

    const result = await db.query(query, values);
    return this.mapRowToQueueEntry(result.rows[0]);
  }

  /**
   * Get queue position for a user
   */
  async getQueuePosition(userId: string, tenantId: string): Promise<QueueEntry | null> {
    const result = await db.query(
      `SELECT * FROM session_queue 
       WHERE user_id = $1 AND tenant_id = $2 AND expires_at > NOW()
       ORDER BY created_at ASC
       LIMIT 1`,
      [userId, tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToQueueEntry(result.rows[0]);
  }

  /**
   * Get next user in queue for a tenant
   */
  async getNextInQueue(tenantId: string): Promise<QueueEntry | null> {
    const result = await db.query(
      `SELECT * FROM session_queue 
       WHERE tenant_id = $1 AND expires_at > NOW()
       ORDER BY position ASC, created_at ASC
       LIMIT 1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToQueueEntry(result.rows[0]);
  }

  /**
   * Remove user from queue
   */
  async removeFromQueue(queueId: string): Promise<void> {
    await db.query('DELETE FROM session_queue WHERE id = $1', [queueId]);
  }

  /**
   * Remove user from queue by userId
   */
  async removeUserFromQueue(userId: string, tenantId: string): Promise<void> {
    await db.query(
      'DELETE FROM session_queue WHERE user_id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );
  }

  /**
   * Clean up expired queue entries
   */
  async cleanupExpiredEntries(): Promise<number> {
    const result = await db.query(
      'DELETE FROM session_queue WHERE expires_at <= NOW() RETURNING id'
    );

    return result.rowCount || 0;
  }

  /**
   * Get queue length for a tenant
   */
  async getQueueLength(tenantId: string): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM session_queue 
       WHERE tenant_id = $1 AND expires_at > NOW()`,
      [tenantId]
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Update queue positions after removal
   */
  async updateQueuePositions(tenantId: string): Promise<void> {
    // Recalculate positions for all entries in the queue
    await db.query(
      `WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY position ASC, created_at ASC) as new_position
        FROM session_queue
        WHERE tenant_id = $1 AND expires_at > NOW()
      )
      UPDATE session_queue
      SET position = ranked.new_position
      FROM ranked
      WHERE session_queue.id = ranked.id`,
      [tenantId]
    );
  }

  /**
   * Map database row to QueueEntry object
   */
  private mapRowToQueueEntry(row: any): QueueEntry {
    return {
      id: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      sessionConfig: row.session_config,
      position: row.position,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }
}

export const sessionQueueService = new SessionQueueService();
