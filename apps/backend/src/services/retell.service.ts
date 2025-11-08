/**
 * Retell AI Client Service
 * 
 * Provides integration with Retell AI for real-time voice interactions.
 * All context is sanitized via Airia before transmission to Retell.
 * 
 * Requirements: 26.1, 26.3, 28.9, 41.1, 41.2
 */

import * as crypto from 'crypto';

import {
  RetellSessionRequest,
  RetellSessionResponse,
  RetellWebhookEvent,
  SanitizedVoiceContext,
} from '@codebase-onboarding/shared';
import axios, { AxiosInstance, AxiosError } from 'axios';

import { config } from '../config';

export class RetellClient {
  private client: AxiosInstance;
  private readonly maxRetries = 3;
  private readonly initialRetryDelay = 500; // 500ms
  private readonly maxRetryDelay = 5000; // 5 seconds
  private readonly backoffMultiplier = 2;

  constructor() {
    this.client = axios.create({
      baseURL: config.retell.apiUrl || 'https://api.retellai.com/v1',
      headers: {
        'Authorization': `Bearer ${config.retell.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 seconds
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => this.handleAxiosError(error)
    );
  }

  /**
   * Create a new Retell AI voice session
   * Requirement 26.1: Integrate Retell AI for real-time voice interactions
   * Requirement 28.9: Transmit only summarized context to Retell AI without raw repository code
   */
  async createSession(request: RetellSessionRequest): Promise<RetellSessionResponse> {
    return this.retryWithBackoff(async () => {
      const response = await this.client.post<RetellSessionResponse>('/sessions', {
        session_id: request.sessionId,
        tenant_id: request.tenantId,
        user_id: request.userId,
        agent_config: {
          persona: request.persona,
          barge_in_enabled: request.config.bargeInEnabled,
          turn_taking_mode: request.config.turnTakingMode,
          latency_target_ms: request.config.voiceLatencyTarget || 800,
        },
        context: request.context, // Already sanitized by Airia
      });

      return response.data;
    });
  }

  /**
   * Update voice session context (sanitized)
   * Requirement 28.9: Transmit only summarized context to Retell AI
   */
  async updateSessionContext(
    retellSessionId: string,
    context: SanitizedVoiceContext
  ): Promise<void> {
    return this.retryWithBackoff(async () => {
      await this.client.patch(`/sessions/${retellSessionId}/context`, {
        context, // Already sanitized by Airia
      });
    });
  }

  /**
   * End a Retell AI voice session
   */
  async endSession(retellSessionId: string): Promise<void> {
    return this.retryWithBackoff(async () => {
      await this.client.post(`/sessions/${retellSessionId}/end`);
    });
  }

  /**
   * Get session status
   */
  async getSessionStatus(retellSessionId: string): Promise<{
    status: 'active' | 'ended' | 'failed';
    duration: number;
    participantCount: number;
  }> {
    return this.retryWithBackoff(async () => {
      const response = await this.client.get(`/sessions/${retellSessionId}/status`);
      return response.data;
    });
  }

  /**
   * Get raw transcript from Retell (to be sanitized before storage)
   * Note: This returns raw transcript that must be sanitized before persistence
   */
  async getRawTranscript(retellSessionId: string): Promise<{
    segments: Array<{
      speaker: 'agent' | 'user';
      text: string;
      timestamp: number;
      duration: number;
    }>;
  }> {
    return this.retryWithBackoff(async () => {
      const response = await this.client.get(`/sessions/${retellSessionId}/transcript`);
      return response.data;
    });
  }

  /**
   * Add participant to voice session
   * Requirement 27.1: Support collaborative "listen in" mode
   */
  async addParticipant(
    retellSessionId: string,
    userId: string,
    role: 'collaborator' | 'listener'
  ): Promise<{
    webSocketUrl: string;
    expiresAt: Date;
  }> {
    return this.retryWithBackoff(async () => {
      const response = await this.client.post(
        `/sessions/${retellSessionId}/participants`,
        {
          user_id: userId,
          role,
        }
      );
      return response.data;
    });
  }

  /**
   * Remove participant from voice session
   */
  async removeParticipant(retellSessionId: string, userId: string): Promise<void> {
    return this.retryWithBackoff(async () => {
      await this.client.delete(`/sessions/${retellSessionId}/participants/${userId}`);
    });
  }

  /**
   * Get voice quality metrics
   */
  async getQualityMetrics(retellSessionId: string): Promise<{
    averageLatency: number;
    maxLatency: number;
    bargeInCount: number;
    turnCount: number;
    qualityScore: number;
  }> {
    return this.retryWithBackoff(async () => {
      const response = await this.client.get(`/sessions/${retellSessionId}/metrics`);
      return response.data;
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!config.retell.webhookSecret) {
      return false;
    }

    // Implement HMAC verification
    const hmac = crypto.createHmac('sha256', config.retell.webhookSecret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(payload: unknown): RetellWebhookEvent {
    // Validate and parse webhook payload
    const event = payload as RetellWebhookEvent;
    
    if (!event.type || !event.sessionId || !event.timestamp) {
      throw new Error('Invalid webhook event format');
    }

    return event;
  }

  /**
   * Check if Retell AI service is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', {
        timeout: 5000, // 5 second timeout for health checks
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Retry logic with exponential backoff
   * Requirement 20.6: Implement exponential backoff retry logic for Retell AI
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= this.maxRetries) {
        throw error;
      }

      // Check if error is retryable
      if (!this.isRetryableError(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        this.initialRetryDelay * Math.pow(this.backoffMultiplier, attempt - 1),
        this.maxRetryDelay
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Retry
      return this.retryWithBackoff(operation, attempt + 1);
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      // Retry on network errors
      if (!error.response) {
        return true;
      }

      // Retry on 5xx server errors
      if (error.response.status >= 500) {
        return true;
      }

      // Retry on 429 (rate limit)
      if (error.response.status === 429) {
        return true;
      }

      // Don't retry on 4xx client errors (except 429)
      if (error.response.status >= 400 && error.response.status < 500) {
        return false;
      }
    }

    return false;
  }

  /**
   * Handle Axios errors and provide meaningful error messages
   */
  private handleAxiosError(error: AxiosError): Promise<never> {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as { message?: string };

      if (status === 401) {
        throw new Error('Retell AI authentication failed. Check API key configuration.');
      }

      if (status === 403) {
        throw new Error('Retell AI access forbidden. Insufficient permissions.');
      }

      if (status === 404) {
        throw new Error(`Retell AI resource not found: ${error.config?.url}`);
      }

      if (status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        throw new Error(
          `Retell AI rate limit exceeded. ${retryAfter ? `Retry after ${retryAfter} seconds.` : ''}`
        );
      }

      if (status >= 500) {
        throw new Error(`Retell AI server error: ${data?.message || 'Internal server error'}`);
      }

      throw new Error(`Retell AI API error: ${data?.message || error.message}`);
    }

    if (error.request) {
      throw new Error('Retell AI service unavailable. No response received.');
    }

    throw new Error(`Retell AI client error: ${error.message}`);
  }
}

// Singleton instance
let retellClientInstance: RetellClient | null = null;

/**
 * Get singleton instance of Retell client
 */
export function getRetellClient(): RetellClient {
  if (!retellClientInstance) {
    retellClientInstance = new RetellClient();
  }
  return retellClientInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetRetellClient(): void {
  retellClientInstance = null;
}
