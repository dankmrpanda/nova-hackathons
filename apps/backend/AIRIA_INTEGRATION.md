# Airia Control Plane Integration

This document describes the integration with Airia control plane for the Codebase Onboarding Agent.

## Overview

Airia serves as the enterprise control plane for all AI agent operations, providing:

- **Governance**: Policy enforcement and sensitive-data masking
- **Multi-LLM Routing**: Dynamic model selection with fallback support
- **Configuration Management**: Versioned configuration with import/export
- **Observability**: Comprehensive metrics and logging

## Architecture

All LLM requests flow through Airia:

```
Application → Airia Client → Airia Control Plane → OpenRouter/Modal
```

No direct access to OpenRouter or Modal is allowed. All requests must go through Airia's policy engine.

## Services

### 1. AiriaClient (`airia.service.ts`)

Core SDK wrapper for Airia API integration.

**Key Methods:**

- `getAgentFlow(flowName, version?)` - Retrieve agent flow definitions
- `executeAgentFlow(flowId, input)` - Execute agent flows
- `checkPolicy(tenantId, operation, context?)` - Check policy compliance
- `maskSensitiveData(content, tenantId, contentType)` - Mask sensitive data
- `routeLLMRequest(request)` - Route LLM requests through Airia
- `getFallbackModel(primaryModel, tenantId)` - Get fallback model
- `exportConfiguration(tenantId)` - Export configuration
- `importConfiguration(config)` - Import configuration

**Requirements Addressed:**

- 22.1: Integrate Airia as control plane
- 22.4: Route all LLM requests through Airia
- 22.5: Apply sensitive-data masking
- 22.8: Apply risk guardrails

**Usage:**

```typescript
import { getAiriaClient } from './services/airia.service';

const airiaClient = getAiriaClient();

// Check policy before operation
const decision = await airiaClient.checkPolicy(tenantId, 'analyze_code', {
  repositoryUrl: 'https://github.com/user/repo',
});

if (decision.allowed) {
  // Mask sensitive data
  const maskedCode = await airiaClient.maskSensitiveData(
    sourceCode,
    tenantId,
    'code'
  );

  // Route LLM request
  const response = await airiaClient.routeLLMRequest({
    model: 'gpt-4',
    prompt: 'Analyze this code',
    context: maskedCode,
    tenantId,
    sessionId,
  });
}
```

### 2. LLMRoutingService (`llm-routing.service.ts`)

Handles multi-LLM routing with automatic fallback and model selection.

**Key Methods:**

- `routeRequest(request)` - Route with automatic fallback
- `checkModelAvailability(model)` - Check model availability
- `getAvailableModels(tenantId, filters?)` - Get available models
- `selectOptimalModel(tenantId, preference)` - Select optimal model
- `routeWithABTest(request, flowId, sessionId)` - Route with A/B testing
- `batchRoute(requests, preference)` - Batch route multiple requests

**Requirements Addressed:**

- 23.3: A/B testing support
- 23.4: Random assignment to agent flow versions
- 24.2: Automatic fallback on model failure
- 25.5: Model routing preferences (latency vs cost)

**Usage:**

```typescript
import { getLLMRoutingService } from './services/llm-routing.service';

const routingService = getLLMRoutingService();

// Route with automatic fallback
const response = await routingService.routeRequest({
  model: 'gpt-4',
  prompt: 'Explain this architecture',
  tenantId,
});

// Select optimal model based on preference
const optimalModel = await routingService.selectOptimalModel(
  tenantId,
  'latency' // or 'cost' or 'balanced'
);

// Route with A/B testing
const responseWithVariant = await routingService.routeWithABTest(
  request,
  'analysis-flow-v2',
  sessionId
);
```

### 3. ConfigManagementService (`config-management.service.ts`)

Manages Airia configuration with versioning and validation.

**Key Methods:**

- `exportConfiguration(tenantId)` - Export configuration
- `importConfiguration(config, options?)` - Import configuration
- `validateConfiguration(config)` - Validate configuration
- `getConfigurationDiff(tenantId, fromVersion, toVersion)` - Get diff
- `getVersionHistory(tenantId)` - Get version history
- `rollbackToVersion(tenantId, version)` - Rollback to version
- `createNewVersion(tenantId, versionType, changes?)` - Create new version

**Requirements Addressed:**

- 35.1: Export Agent Policies
- 35.2: Export routing rules
- 35.3: Export voice personas
- 35.7: Import and apply configurations
- 35.10: Diff configuration versions

**Usage:**

```typescript
import { getConfigManagementService } from './services/config-management.service';

const configService = getConfigManagementService();

// Export current configuration
const config = await configService.exportConfiguration(tenantId);

// Validate before import
const validation = await configService.validateConfiguration(config);

if (validation.valid) {
  // Import configuration
  const result = await configService.importConfiguration(config, {
    validate: true,
    dryRun: false,
  });
}

// Get diff between versions
const diff = await configService.getConfigurationDiff(
  tenantId,
  'v1.0.0',
  'v1.1.0'
);

// Rollback to previous version
await configService.rollbackToVersion(tenantId, 'v1.0.0');
```

### 4. AiriaObservabilityService (`airia-observability.service.ts`)

Provides comprehensive observability for Airia operations.

**Key Methods:**

- `emitPolicyEnforcement(policyId, policyName, enforced, violated, violation?)` - Emit policy metric
- `emitRoutingDecision(model, fallbackUsed, latency, tenantId, sessionId?)` - Emit routing metric
- `emitModelUsage(model, tokens, cost, tenantId)` - Emit model usage metric
- `emitCostMetric(tenantId, service, cost)` - Emit cost metric
- `logAiriaAPICall(endpoint, method, tenantId, sessionId?, duration?, statusCode?, error?)` - Log API call
- `logRetellAPIError(endpoint, method, tenantId, sessionId, error)` - Log Retell error
- `getMetrics()` - Get all metrics
- `getTenantMetrics(tenantId)` - Get tenant-specific metrics

**Requirements Addressed:**

- 36.1: Emit metrics for policy enforcement
- 36.2: Track routing decisions and model selection
- 36.7: Log all Airia API calls with redacted context
- 36.9: Log all API errors with redacted context

**Usage:**

```typescript
import { getAiriaObservabilityService } from './services/airia-observability.service';

const observability = getAiriaObservabilityService();

// Emit policy enforcement metric
observability.emitPolicyEnforcement(
  'policy-123',
  'Sensitive Data Policy',
  true,
  false
);

// Emit routing decision metric
observability.emitRoutingDecision(
  'gpt-4',
  false, // no fallback used
  250, // latency in ms
  tenantId,
  sessionId
);

// Log Airia API call
observability.logAiriaAPICall(
  '/llm/route',
  'POST',
  tenantId,
  sessionId,
  250, // duration
  200 // status code
);

// Get metrics
const metrics = observability.getMetrics();
```

## Configuration

Add the following environment variables:

```env
# Airia Configuration
AIRIA_API_URL=https://api.airia.example.com
AIRIA_API_KEY=your-airia-api-key
```

## Error Handling

All Airia services implement retry logic with exponential backoff:

- **Max Retries**: 3 attempts
- **Initial Delay**: 1 second
- **Max Delay**: 10 seconds
- **Backoff Multiplier**: 2x

Retryable errors:
- Network errors (no response)
- 5xx server errors
- 429 rate limit errors

Non-retryable errors:
- 4xx client errors (except 429)
- Authentication failures (401)
- Authorization failures (403)

## Airia Downtime Handling

When Airia is unavailable:

1. **Read-Only Mode**: Allow access to existing sanitized artifacts
2. **Block New Operations**: Prevent new LLM/agent operations
3. **UI Indication**: Display "Limited Functionality" banner
4. **Automatic Recovery**: Resume full functionality when Airia returns

See `airia-health.service.ts` for health check implementation.

## Testing

All services provide singleton reset functions for testing:

```typescript
import {
  resetAiriaClient,
  resetLLMRoutingService,
  resetConfigManagementService,
  resetAiriaObservabilityService,
} from './services';

// Reset all singletons before each test
beforeEach(() => {
  resetAiriaClient();
  resetLLMRoutingService();
  resetConfigManagementService();
  resetAiriaObservabilityService();
});
```

## Security Considerations

1. **No Direct Access**: Never access OpenRouter or Modal directly
2. **Sensitive Data Masking**: Always mask code before sending to LLM services
3. **Policy Enforcement**: Check policies before operations
4. **Audit Logging**: All operations are logged with redacted context
5. **Tenant Isolation**: All operations are tenant-scoped

## Monitoring

Key metrics to monitor:

- **Policy Violations**: Alert if >5% of requests violate policies
- **Fallback Rate**: Track how often fallbacks are used
- **Model Latency**: Alert if latency >2s
- **Cost per Tenant**: Track and alert on anomalies
- **Airia Availability**: Alert if unavailable >5 minutes

## References

- Requirements: 22, 23, 24, 25, 35, 36
- Design Document: Section "Airia Integration Module"
- Tasks: 4.1, 4.2, 4.3, 4.4
