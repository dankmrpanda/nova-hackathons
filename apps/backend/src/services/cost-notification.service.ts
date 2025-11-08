import Redis from 'ioredis';

import { CostTrackerService } from './cost-tracker.service';

interface DatabaseClient {
  query(text: string, params?: any[]): Promise<any>;
  getClient(): Promise<any>;
}

export interface CostNotificationPayload {
  sessionId: string;
  userId: string;
  tenantId: string;
  type: 'warning' | 'critical';
  message: string;
  uiMessage: string;
  voiceMessage: string;
  costStatus: {
    current: number;
    limit: number;
    percentage: number;
  };
}

/**
 * Service for managing cost-related notifications
 * Requirements: 16.7
 */
export class CostNotificationService {
  private db: DatabaseClient;
  private redis: Redis;
  private costTracker: CostTrackerService;

  constructor(db: DatabaseClient, redis: Redis) {
    this.db = db;
    this.redis = redis;
    this.costTracker = new CostTrackerService(db, redis);
  }

  /**
   * Check if notification should be sent for session
   * Requirements: 16.7
   */
  async checkAndNotify(sessionId: string): Promise<CostNotificationPayload | null> {
    // Get session info
    const sessionResult = await this.db.query(
      'SELECT user_id, tenant_id, status FROM onboarding_sessions WHERE id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return null;
    }

    const { user_id, tenant_id, status } = sessionResult.rows[0];

    // Don't notify for terminated sessions
    if (status === 'terminated') {
      return null;
    }

    // Get cost notification
    const notification = await this.costTracker.getCostNotification(sessionId);

    if (notification.type === 'none') {
      return null;
    }

    // Check if we've already sent this notification recently
    const notificationKey = `cost:notification:${sessionId}:${notification.type}`;
    const alreadySent = await this.redis.get(notificationKey);

    if (alreadySent) {
      return null; // Don't spam notifications
    }

    // Mark notification as sent (expires in 5 minutes)
    await this.redis.set(notificationKey, '1', 'EX', 300);

    // Get cost status
    const costStatus = await this.costTracker.checkLimit(sessionId);

    return {
      sessionId,
      userId: user_id,
      tenantId: tenant_id,
      type: notification.type,
      message: notification.message,
      uiMessage: notification.uiMessage,
      voiceMessage: notification.voiceMessage,
      costStatus: {
        current: costStatus.current,
        limit: costStatus.limit,
        percentage: costStatus.percentage,
      },
    };
  }

  /**
   * Send notification to UI via WebSocket/SSE
   * Requirements: 16.7
   */
  async sendUINotification(payload: CostNotificationPayload): Promise<void> {
    // Publish to Redis pub/sub for WebSocket delivery
    await this.redis.publish(
      `notifications:${payload.userId}`,
      JSON.stringify({
        type: 'cost_notification',
        payload,
      })
    );
  }

  /**
   * Send voice notification via Retell AI
   * Requirements: 16.7
   */
  async sendVoiceNotification(payload: CostNotificationPayload): Promise<void> {
    // Check if there's an active voice session
    const voiceSessionResult = await this.db.query(
      `SELECT id FROM voice_sessions 
       WHERE session_id = $1 
       AND status = 'active'
       ORDER BY started_at DESC
       LIMIT 1`,
      [payload.sessionId]
    );

    if (voiceSessionResult.rows.length === 0) {
      return; // No active voice session
    }

    // Publish voice notification to Redis for voice orchestrator
    await this.redis.publish(
      `voice:notifications:${payload.sessionId}`,
      JSON.stringify({
        type: 'cost_notification',
        message: payload.voiceMessage,
        priority: payload.type === 'critical' ? 'high' : 'medium',
      })
    );
  }

  /**
   * Monitor session costs and send notifications
   * This should be called after each cost tracking operation
   * Requirements: 16.7
   */
  async monitorAndNotify(sessionId: string): Promise<void> {
    const notification = await this.checkAndNotify(sessionId);

    if (!notification) {
      return;
    }

    // Send UI notification
    await this.sendUINotification(notification);

    // Send voice notification if applicable
    await this.sendVoiceNotification(notification);

    // Log notification
    console.log(`Cost notification sent for session ${sessionId}:`, {
      type: notification.type,
      percentage: notification.costStatus.percentage.toFixed(1),
    });
  }

  /**
   * Get notification history for session
   */
  async getNotificationHistory(sessionId: string): Promise<any[]> {
    // Check Redis for recent notifications
    const keys = await this.redis.keys(`cost:notification:${sessionId}:*`);
    
    const history = [];
    for (const key of keys) {
      const type = key.split(':').pop();
      const ttl = await this.redis.ttl(key);
      
      history.push({
        type,
        sentAt: new Date(Date.now() - (300 - ttl) * 1000),
      });
    }

    return history;
  }
}
