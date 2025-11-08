import {
  LLMRequest,
  LLMResponse,
  ModelAvailability,
} from '@codebase-onboarding/shared';

import { getAiriaClient } from './airia.service';

/**
 * LLM Routing Service
 * 
 * Handles multi-LLM routing with fallback logic and model selection
 * 
 * Requirements:
 * - 23.3: A/B testing support for agent flows
 * - 23.4: Random assignment to agent flow versions
 * - 24.2: Automatic routing to fallback model via Airia
 * - 25.5: Model routing preferences (latency vs cost)
 */
export class LLMRoutingService {
  private airiaClient = getAiriaClient();

  /**
   * Route an LLM request with automatic fallback handling
   * Requirement 24.2: Automatic fallback on primary model failure
   */
  async routeRequest(request: LLMRequest): Promise<LLMResponse> {
    const primaryModel = request.model;
    let lastError: Error | null = null;

    try {
      // Check if primary model is available
      const availability = await this.checkModelAvailability(primaryModel);
      
      if (availability.available) {
        // Try primary model
        return await this.airiaClient.routeLLMRequest(request);
      }
    } catch (error) {
      lastError = error as Error;
      console.warn(`Primary model ${primaryModel} failed:`, error);
    }

    // Primary model failed or unavailable, try fallback
    try {
      const fallbackModel = await this.airiaClient.getFallbackModel(
        primaryModel,
        request.tenantId
      );

      console.log(`Falling back from ${primaryModel} to ${fallbackModel}`);

      const fallbackRequest: LLMRequest = {
        ...request,
        model: fallbackModel,
      };

      return await this.airiaClient.routeLLMRequest(fallbackRequest);
    } catch (fallbackError) {
      console.error('Fallback model also failed:', fallbackError);
      throw new Error(
        `Both primary model (${primaryModel}) and fallback failed. ` +
        `Last error: ${lastError?.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Check model availability with caching
   */
  async checkModelAvailability(model: string): Promise<ModelAvailability> {
    try {
      return await this.airiaClient.checkModelAvailability(model);
    } catch (error) {
      console.error(`Failed to check availability for model ${model}:`, error);
      // Assume unavailable on error
      return {
        model,
        available: false,
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Get available models for a tenant with filtering
   */
  async getAvailableModels(
    tenantId: string,
    filters?: {
      minAvailability?: number;
      maxCost?: number;
      preferredProvider?: string;
    }
  ): Promise<string[]> {
    const models = await this.airiaClient.getAvailableModels(tenantId);

    if (!filters) {
      return models;
    }

    // Filter models based on criteria
    const filteredModels: string[] = [];

    for (const model of models) {
      try {
        const availability = await this.checkModelAvailability(model);

        // Apply filters
        if (filters.minAvailability && !availability.available) {
          continue;
        }

        if (filters.preferredProvider && !model.includes(filters.preferredProvider)) {
          continue;
        }

        filteredModels.push(model);
      } catch (error) {
        console.warn(`Failed to check model ${model}:`, error);
      }
    }

    return filteredModels;
  }

  /**
   * Select optimal model based on routing preferences
   * Requirement 25.5: Model routing preferences (latency vs cost)
   */
  async selectOptimalModel(
    tenantId: string,
    preference: 'latency' | 'cost' | 'balanced' = 'balanced'
  ): Promise<string> {
    const models = await this.airiaClient.getAvailableModels(tenantId);

    if (models.length === 0) {
      throw new Error('No models available for tenant');
    }

    // For now, return first available model
    // In production, this would query model metadata and select based on preference
    const availabilities = await Promise.all(
      models.map(async (model) => ({
        model,
        availability: await this.checkModelAvailability(model),
      }))
    );

    const availableModels = availabilities.filter(
      (m) => m.availability.available
    );

    if (availableModels.length === 0) {
      throw new Error('No available models for tenant');
    }

    // Select based on preference
    switch (preference) {
      case 'latency':
        // Sort by latency (ascending)
        availableModels.sort(
          (a, b) => (a.availability.latency || Infinity) - (b.availability.latency || Infinity)
        );
        break;
      case 'cost':
        // In production, would sort by cost
        // For now, just return first available
        break;
      case 'balanced':
      default:
        // Balance between latency and cost
        // For now, just return first available
        break;
    }

    return availableModels[0].model;
  }

  /**
   * Execute request with A/B testing variant selection
   * Requirement 23.4: Random assignment to agent flow versions
   */
  async routeWithABTest(
    request: LLMRequest,
    flowId: string,
    sessionId: string
  ): Promise<LLMResponse & { variantId: string }> {
    // Get A/B test variant for this session
    const variantId = await this.airiaClient.getABTestVariant(
      flowId,
      sessionId,
      request.tenantId
    );

    console.log(`Session ${sessionId} assigned to variant ${variantId}`);

    // Route request (variant selection is handled by Airia)
    const response = await this.routeRequest(request);

    return {
      ...response,
      variantId,
    };
  }

  /**
   * Batch route multiple requests with optimal model selection
   */
  async batchRoute(
    requests: LLMRequest[],
    preference: 'latency' | 'cost' | 'balanced' = 'balanced'
  ): Promise<LLMResponse[]> {
    const responses: LLMResponse[] = [];

    for (const request of requests) {
      try {
        // Select optimal model if not specified
        if (!request.model) {
          request.model = await this.selectOptimalModel(
            request.tenantId,
            preference
          );
        }

        const response = await this.routeRequest(request);
        responses.push(response);
      } catch (error) {
        console.error('Failed to route request:', error);
        throw error;
      }
    }

    return responses;
  }
}

// Singleton instance
let llmRoutingServiceInstance: LLMRoutingService | null = null;

/**
 * Get singleton instance of LLM routing service
 */
export function getLLMRoutingService(): LLMRoutingService {
  if (!llmRoutingServiceInstance) {
    llmRoutingServiceInstance = new LLMRoutingService();
  }
  return llmRoutingServiceInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetLLMRoutingService(): void {
  llmRoutingServiceInstance = null;
}
