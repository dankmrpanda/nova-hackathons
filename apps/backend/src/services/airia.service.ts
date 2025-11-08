import {
  AgentFlow,
  FlowInput,
  FlowOutput,
  PolicyDecision,
  LLMRequest,
  LLMResponse,
  AiriaConfig,
  ModelAvailability,
  ABTestConfig,
  ConfigDiff,
} from '@codebase-onboarding/shared';
import axios, { AxiosInstance, AxiosError } from 'axios';

import { config } from '../config';

/**
 * Airia Client SDK Wrapper
 * 
 * Provides integration with Airia control plane for:
 * - Agent flow retrieval and execution
 * - Policy checking and enforcement
 * - Sensitive-data masking
 * - Multi-LLM routing
 * - Configuration management
 * 
 * Requirements: 22.1, 22.4, 22.5, 22.8
 */
export class AiriaClient {
  private client: AxiosInstance;
  private readonly maxRetries = 3;
  private readonly initialRetryDelay = 1000; // 1 second
  private readonly maxRetryDelay = 10000; // 10 seconds
  private readonly backoffMultiplier = 2;

  constructor() {
    this.client = axios.create({
      baseURL: config.airia.apiUrl,
      headers: {
        'Authorization': `Bearer ${config.airia.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => this.handleAxiosError(error)
    );
  }

  /**
   * Retrieve an agent flow by name and optional version
   * Requirement 22.1: Integrate Airia as control plane for all agents
   */
  async getAgentFlow(flowName: string, version?: string): Promise<AgentFlow> {
    return this.retryWithBackoff(async () => {
      const params = version ? { version } : {};
      const response = await this.client.get<AgentFlow>(
        `/agent-flows/${encodeURIComponent(flowName)}`,
        { params }
      );
      return response.data;
    });
  }

  /**
   * Execute an agent flow with given input
   * Requirement 22.1: Integrate Airia as control plane for all agents
   */
  async executeAgentFlow(flowId: string, input: FlowInput): Promise<FlowOutput> {
    return this.retryWithBackoff(async () => {
      const response = await this.client.post<FlowOutput>(
        `/agent-flows/${encodeURIComponent(flowId)}/execute`,
        input
      );
      return response.data;
    });
  }

  /**
   * Check if an operation is allowed by tenant policies
   * Requirement 22.4: Route all LLM requests through Airia's Multi-LLM Routing
   */
  async checkPolicy(
    tenantId: string,
    operation: string,
    context?: Record<string, unknown>
  ): Promise<PolicyDecision> {
    return this.retryWithBackoff(async () => {
      const response = await this.client.post<PolicyDecision>(
        `/policies/check`,
        {
          tenantId,
          operation,
          context,
        }
      );
      return response.data;
    });
  }

  /**
   * Mask sensitive data in content according to tenant policies
   * Requirement 22.5: Apply Airia's sensitive-data masking to all code sent to LLM services
   */
  async maskSensitiveData(
    content: string,
    tenantId: string,
    contentType: 'code' | 'text' | 'transcript' = 'code'
  ): Promise<string> {
    return this.retryWithBackoff(async () => {
      const response = await this.client.post<{ maskedContent: string }>(
        `/policies/mask`,
        {
          content,
          tenantId,
          contentType,
        }
      );
      return response.data.maskedContent;
    });
  }

  /**
   * Route an LLM request through Airia's multi-LLM routing layer
   * Requirement 22.4: Route all LLM requests exclusively through Airia
   * Requirement 22.8: Apply risk guardrails defined in Airia
   */
  async routeLLMRequest(request: LLMRequest): Promise<LLMResponse> {
    return this.retryWithBackoff(async () => {
      const response = await this.client.post<LLMResponse>(
        `/llm/route`,
        request
      );
      return response.data;
    });
  }

  /**
   * Get fallback model for a primary model based on tenant policies
   * Requirement 22.4: Multi-LLM routing with fallback support
   */
  async getFallbackModel(primaryModel: string, tenantId: string): Promise<string> {
    return this.retryWithBackoff(async () => {
      const response = await this.client.get<{ fallbackModel: string }>(
        `/llm/fallback`,
        {
          params: { primaryModel, tenantId },
        }
      );
      return response.data.fallbackModel;
    });
  }

  /**
   * Check model availability
   */
  async checkModelAvailability(model: string): Promise<ModelAvailability> {
    return this.retryWithBackoff(async () => {
      const response = await this.client.get<ModelAvailability>(
        `/llm/models/${encodeURIComponent(model)}/availability`
      );
      return response.data;
    });
  }

  /**
   * Get list of available models for a tenant
   */
  async getAvailableModels(tenantId: string): Promise<string[]> {
    return this.retryWithBackoff(async () => {
      const response = await this.client.get<{ models: string[] }>(
        `/llm/models`,
        {
          params: { tenantId },
        }
      );
      return response.data.models;
    });
  }

  /**
   * Export Airia configuration for a tenant
   */
  async exportConfiguration(tenantId: string): Promise<AiriaConfig> {
    return this.retryWithBackoff(async () => {
      const response = await this.client.get<AiriaConfig>(
        `/config/export`,
        {
          params: { tenantId },
        }
      );
      return response.data;
    });
  }

  /**
   * Import and apply Airia configuration
   */
  async importConfiguration(config: AiriaConfig): Promise<void> {
    return this.retryWithBackoff(async () => {
      await this.client.post(`/config/import`, config);
    });
  }

  /**
   * Validate configuration before import
   */
  async validateConfiguration(config: AiriaConfig): Promise<{
    valid: boolean;
    errors?: string[];
  }> {
    return this.retryWithBackoff(async () => {
      const response = await this.client.post<{
        valid: boolean;
        errors?: string[];
      }>(`/config/validate`, config);
      return response.data;
    });
  }

  /**
   * Get configuration diff between two versions
   */
  async getConfigurationDiff(
    tenantId: string,
    fromVersion: string,
    toVersion: string
  ): Promise<ConfigDiff> {
    return this.retryWithBackoff(async () => {
      const response = await this.client.get<ConfigDiff>(
        `/config/diff`,
        {
          params: { tenantId, fromVersion, toVersion },
        }
      );
      return response.data;
    });
  }

  /**
   * Configure A/B testing for agent flows
   * Requirement 23.3: Allow Administrators to configure A/B testing splits
   */
  async configureABTest(config: ABTestConfig): Promise<void> {
    return this.retryWithBackoff(async () => {
      await this.client.post(`/agent-flows/ab-test`, config);
    });
  }

  /**
   * Get A/B test assignment for a session
   * Requirement 23.4: Randomly assign sessions to agent flow versions
   */
  async getABTestVariant(
    flowId: string,
    sessionId: string,
    tenantId: string
  ): Promise<string> {
    return this.retryWithBackoff(async () => {
      const response = await this.client.get<{ variantId: string }>(
        `/agent-flows/${encodeURIComponent(flowId)}/ab-test/variant`,
        {
          params: { sessionId, tenantId },
        }
      );
      return response.data.variantId;
    });
  }

  /**
   * Get A/B test metrics for a flow
   */
  async getABTestMetrics(flowId: string, tenantId: string): Promise<{
    variants: Array<{
      variantId: string;
      sessions: number;
      completionRate: number;
      averageCost: number;
      averageSatisfaction: number;
    }>;
  }> {
    return this.retryWithBackoff(async () => {
      const response = await this.client.get(
        `/agent-flows/${encodeURIComponent(flowId)}/ab-test/metrics`,
        {
          params: { tenantId },
        }
      );
      return response.data;
    });
  }

  /**
   * Promote an A/B test variant to production
   */
  async promoteABTestVariant(
    flowId: string,
    variantId: string,
    tenantId: string
  ): Promise<void> {
    return this.retryWithBackoff(async () => {
      await this.client.post(
        `/agent-flows/${encodeURIComponent(flowId)}/ab-test/promote`,
        {
          variantId,
          tenantId,
        }
      );
    });
  }

  /**
   * Check if Airia service is available
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
   * Requirement 22.4: Implement retry logic for Airia API calls
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

      // Retry on 429 (rate limit) - though we should respect Retry-After header
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
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data as { message?: string };

      if (status === 401) {
        throw new Error('Airia authentication failed. Check API key configuration.');
      }

      if (status === 403) {
        throw new Error('Airia access forbidden. Insufficient permissions.');
      }

      if (status === 404) {
        throw new Error(`Airia resource not found: ${error.config?.url}`);
      }

      if (status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        throw new Error(
          `Airia rate limit exceeded. ${retryAfter ? `Retry after ${retryAfter} seconds.` : ''}`
        );
      }

      if (status >= 500) {
        throw new Error(`Airia server error: ${data?.message || 'Internal server error'}`);
      }

      throw new Error(`Airia API error: ${data?.message || error.message}`);
    }

    if (error.request) {
      // Request made but no response received
      throw new Error('Airia service unavailable. No response received.');
    }

    // Something else happened
    throw new Error(`Airia client error: ${error.message}`);
  }
}

// Singleton instance
let airiaClientInstance: AiriaClient | null = null;

/**
 * Get singleton instance of Airia client
 */
export function getAiriaClient(): AiriaClient {
  if (!airiaClientInstance) {
    airiaClientInstance = new AiriaClient();
  }
  return airiaClientInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetAiriaClient(): void {
  airiaClientInstance = null;
}
