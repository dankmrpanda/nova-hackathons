# Cost Management Module

## Overview

The Cost Management Module provides comprehensive cost tracking, limit enforcement, and reporting for all services used in the Codebase Onboarding Agent. It serves as the single source of truth for cost governance across the application.

## Requirements Implemented

### Task 5.1: Cost Tracking System
- **Requirement 16.1**: Cost estimation for session configurations
- **Requirement 16.5**: Real-time cost accumulation in Redis
- **Requirement 16.6**: Cost reporting APIs for tenants and users

### Task 5.2: Cost Limit Enforcement
- **Requirement 16.2**: Cost limit checking at 90% threshold
- **Requirement 16.3**: Automatic session termination at limit
- **Requirement 16.7**: Warning notifications (UI and voice)
- **Requirement 16.8**: Tenant-level cost limit configuration

### Task 5.3: Service Integration
- **Requirement 16.5**: OpenRouter cost tracking via Airia
- **Requirement 16.9**: Service-specific cost tracking
- **Requirement 16.10**: Retell AI, Modal, and GitHub cost tracking

## Architecture

### Core Components

1. **CostTrackerService** (`services/cost-tracker.service.ts`)
   - Central cost tracking and management
   - Cost estimation and validation
   - Limit checking and enforcement
   - Reporting and analytics

2. **CostNotificationService** (`services/cost-notification.service.ts`)
   - Real-time cost notifications
   - UI and voice notification delivery
   - Notification throttling and history

3. **ServiceCostTracking** (`services/service-cost-tracking.ts`)
   - Service-specific cost tracking helpers
   - OpenRouter/LLM cost tracking
   - Retell AI voice cost tracking
   - Modal animation cost tracking
   - GitHub API cost tracking

4. **Cost Enforcement Middleware** (`middleware/cost-enforcement.middleware.ts`)
   - Pre-operation cost limit checks
   - Session validation before start
   - Automatic termination on limit exceeded

### Database Schema

#### cost_entries
Stores detailed cost entries for all operations:
```sql
- id: UUID (primary key)
- session_id: UUID (foreign key to onboarding_sessions)
- tenant_id: UUID (foreign key to tenants)
- user_id: UUID (foreign key to users)
- service: VARCHAR (openrouter, retell, modal, github)
- operation: VARCHAR (operation name)
- amount: DECIMAL(10, 6) (cost in USD)
- metadata: JSONB (additional details)
- created_at: TIMESTAMP
```

#### tenant_cost_config
Stores per-tenant cost configuration:
```sql
- tenant_id: UUID (primary key, foreign key to tenants)
- default_cost_limit: DECIMAL(10, 2) (default: $5.00)
- max_cost_limit: DECIMAL(10, 2) (default: $50.00)
- warning_threshold: INTEGER (default: 90%)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Redis Cache Structure

#### Real-time Cost Accumulation
- Key: `cost:{sessionId}`
- Value: Current cost (float)
- TTL: 24 hours

#### Tenant Daily Cost
- Key: `cost:tenant:{tenantId}:{YYYY-MM-DD}`
- Value: Daily accumulated cost (float)
- TTL: 30 days

#### Notification Throttling
- Key: `cost:notification:{sessionId}:{type}`
- Value: "1" (flag)
- TTL: 5 minutes

## API Endpoints

### Cost Tracking

#### POST /api/cost/track
Record a cost entry for a session.

**Request:**
```json
{
  "sessionId": "uuid",
  "service": "openrouter",
  "operation": "llm_analysis",
  "amount": 0.05,
  "metadata": {
    "model": "gpt-4",
    "tokens": 1000
  }
}
```

**Response:**
```json
{
  "success": true,
  "costStatus": {
    "current": 0.05,
    "limit": 5.00,
    "percentage": 1.0,
    "warning": false,
    "exceeded": false
  }
}
```

#### GET /api/cost/session/:sessionId
Get current cost for a session.

**Response:**
```json
{
  "currentCost": 2.45,
  "costStatus": {
    "current": 2.45,
    "limit": 5.00,
    "percentage": 49.0,
    "warning": false,
    "exceeded": false
  }
}
```

### Cost Estimation

#### POST /api/cost/estimate
Estimate cost for a session configuration.

**Request:**
```json
{
  "repositoryUrl": "https://github.com/user/repo",
  "analysisScope": {
    "type": "full",
    "maxSize": 10485760
  },
  "modelPreference": "gpt-4",
  "outputFormat": "animation",
  "voiceEnabled": true
}
```

**Response:**
```json
{
  "llmCost": 1.00,
  "voiceCost": 3.00,
  "animationCost": 0.50,
  "githubCost": 0.01,
  "total": 4.51,
  "confidence": 0.7
}
```

### Cost Reporting

#### GET /api/cost/tenant?startDate=2024-01-01&endDate=2024-01-31
Get cost report for tenant.

**Response:**
```json
{
  "tenantId": "uuid",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "totalCost": 125.50,
  "costByService": {
    "openrouter": 80.00,
    "retell": 30.00,
    "modal": 15.00,
    "github": 0.50
  },
  "costByOperation": {
    "llm_analysis": 60.00,
    "voice_session": 30.00,
    "animation_generation": 15.00
  },
  "sessionCount": 25,
  "averageCostPerSession": 5.02
}
```

#### GET /api/cost/user?startDate=2024-01-01&endDate=2024-01-31
Get cost report for current user.

**Response:** Same structure as tenant report with `userId` instead of `tenantId`.

### Cost Configuration

#### GET /api/cost/config
Get tenant cost configuration.

**Response:**
```json
{
  "tenantId": "uuid",
  "defaultCostLimit": 5.00,
  "maxCostLimit": 50.00,
  "warningThreshold": 90
}
```

#### PUT /api/cost/config
Update tenant cost configuration (Administrator only).

**Request:**
```json
{
  "defaultCostLimit": 10.00,
  "maxCostLimit": 100.00,
  "warningThreshold": 85
}
```

### Cost Enforcement

#### POST /api/cost/enforce/:sessionId
Manually enforce cost limit for a session (Administrator only).

**Response:**
```json
{
  "terminated": true,
  "reason": "Session terminated: cost limit of $5.00 exceeded (current: $5.12)"
}
```

#### GET /api/cost/notification/:sessionId
Get cost notification for session.

**Response:**
```json
{
  "type": "warning",
  "message": "Cost warning: 92.5% of limit",
  "uiMessage": "⚠️ Cost Warning: 92.5% of limit ($4.63 / $5.00)",
  "voiceMessage": "Warning: Your session cost is at 93 percent of the limit..."
}
```

#### POST /api/cost/validate-start
Validate if session can start based on estimated cost.

**Request:**
```json
{
  "sessionId": "uuid",
  "estimatedCost": 4.50
}
```

**Response:**
```json
{
  "canStart": true
}
```

Or if cost exceeds limit:
```json
{
  "canStart": false,
  "reason": "Estimated cost ($6.00) exceeds session limit ($5.00)",
  "suggestedLimit": 7.20
}
```

### Cost Export

#### GET /api/cost/export?startDate=2024-01-01&endDate=2024-01-31&format=csv
Export cost data for tenant (Administrator only).

**Response:** CSV or JSON file download

## Service Integration

### OpenRouter (via Airia)

The LLM Routing Service automatically tracks costs for all OpenRouter requests:

```typescript
import { getLLMRoutingService } from './services/llm-routing.service';

const llmService = getLLMRoutingService();

const response = await llmService.routeRequest(
  {
    model: 'gpt-4',
    prompt: 'Analyze this code...',
    tenantId: 'tenant-uuid',
    operation: 'code_analysis'
  },
  sessionId,  // Required for cost tracking
  userId      // Required for cost tracking
);
```

### Retell AI

Track voice session costs:

```typescript
import { ServiceCostTracking } from './services/service-cost-tracking';

const costTracking = new ServiceCostTracking(db, redis);

await costTracking.trackRetellCost(
  sessionId,
  tenantId,
  userId,
  {
    durationSeconds: 1800,  // 30 minutes
    costPerMinute: 0.10,
    operation: 'voice_session',
    voiceSessionId: 'voice-uuid'
  }
);
```

### Modal

Track animation generation costs:

```typescript
await costTracking.trackModalCost(
  sessionId,
  tenantId,
  userId,
  {
    operation: 'animation_generation',
    durationSeconds: 600,  // 10 minutes
    resolution: '1080p',
    computeUnits: 5,
    costPerUnit: 0.10
  }
);
```

### GitHub

Track GitHub API usage costs:

```typescript
await costTracking.trackGitHubCost(
  sessionId,
  tenantId,
  userId,
  {
    operation: 'fetch_repository',
    apiCalls: 10,
    dataTransferMB: 50,
    costPerCall: 0.0001,
    costPerMB: 0.001
  }
);
```

## Cost Notifications

### UI Notifications

Cost notifications are published to Redis pub/sub for WebSocket delivery:

```typescript
// Subscribe to user notifications
redis.subscribe(`notifications:${userId}`);

redis.on('message', (channel, message) => {
  const notification = JSON.parse(message);
  if (notification.type === 'cost_notification') {
    // Display in UI
    showNotification(notification.payload.uiMessage);
  }
});
```

### Voice Notifications

Voice notifications are sent to active voice sessions:

```typescript
// Subscribe to voice notifications
redis.subscribe(`voice:notifications:${sessionId}`);

redis.on('message', (channel, message) => {
  const notification = JSON.parse(message);
  if (notification.type === 'cost_notification') {
    // Send to Retell AI for voice delivery
    retellClient.sendMessage(notification.message);
  }
});
```

## Cost Enforcement Flow

1. **Before Operation**: `checkCostLimit` middleware validates session is not terminated and cost limit not exceeded
2. **During Operation**: Service-specific cost tracking records costs in real-time
3. **After Cost Update**: 
   - Check if warning threshold (90%) reached → send notification
   - Check if limit exceeded → terminate session automatically
4. **Notification Delivery**: Send UI and voice notifications if applicable

## Configuration

### Environment Variables

```env
# Redis for real-time cost tracking
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Database for cost entries
DB_HOST=localhost
DB_PORT=5432
DB_NAME=onboarding_agent
DB_USER=postgres
DB_PASSWORD=postgres
```

### Default Cost Limits

- Default session cost limit: $5.00
- Maximum session cost limit: $50.00
- Warning threshold: 90%
- Cost entry precision: 6 decimal places (micro-dollars)

## Testing

### Unit Tests

Test cost calculation, limit checking, and enforcement:

```typescript
describe('CostTrackerService', () => {
  it('should estimate cost correctly', async () => {
    const estimate = await costTracker.estimateCost(config);
    expect(estimate.total).toBeGreaterThan(0);
  });

  it('should enforce limit when exceeded', async () => {
    const result = await costTracker.enforceLimit(sessionId);
    expect(result.terminated).toBe(true);
  });
});
```

### Integration Tests

Test end-to-end cost tracking flow:

```typescript
describe('Cost Tracking Integration', () => {
  it('should track and enforce costs across services', async () => {
    // Track LLM cost
    await trackOpenRouterCost(...);
    
    // Check status
    const status = await costTracker.checkLimit(sessionId);
    expect(status.warning).toBe(false);
    
    // Track more costs until limit
    // ...
    
    // Verify termination
    const session = await getSession(sessionId);
    expect(session.status).toBe('terminated');
  });
});
```

## Monitoring

### Key Metrics

- Total cost per tenant (daily, monthly)
- Average cost per session
- Cost by service breakdown
- Sessions terminated due to cost limits
- Warning notifications sent

### Alerts

- Cost limit exceeded rate > 5%
- Average session cost trending up
- Tenant approaching monthly budget
- Cost tracking failures

## Future Enhancements

1. **Predictive Cost Alerts**: ML-based prediction of when session will hit limit
2. **Cost Optimization Suggestions**: Recommend cheaper models or configurations
3. **Budget Management**: Monthly/quarterly budget tracking and enforcement
4. **Cost Allocation**: Tag-based cost allocation for departments/projects
5. **Real-time Cost Dashboard**: Live cost monitoring UI for administrators
