# Observability and Monitoring Implementation

This document describes the observability and monitoring implementation for the Codebase Onboarding Agent.

## Overview

The observability system provides comprehensive monitoring, logging, metrics collection, health checks, alerting, and dashboards for the application.

**Requirements Implemented:**
- 15.1, 15.8: Structured logging with correlation IDs
- 15.2: Metrics collection (application, infrastructure, business)
- 15.3: Health check endpoints (liveness, readiness)
- 15.5: Alerting for critical and warning conditions
- 15.7: Monitoring dashboards
- 36.1, 36.2, 36.3: Airia and Retell observability
- 36.5, 36.6: Dashboard metrics
- 36.7, 36.8: Policy violation and quality alerts

## Components

### 1. Structured Logging (`logger.service.ts`)

Provides centralized logging with:
- Standard fields (timestamp, level, service, userId, tenantId, sessionId)
- Correlation IDs for request tracing
- Configurable log levels (ERROR, WARN, INFO, DEBUG)
- Automatic redaction of sensitive data
- JSON output for log aggregation

**Usage:**
```typescript
import { logger } from './services/logger.service';

// Simple logging
logger.info('User logged in', { userId: 'user-123' });

// With context
logger.error('Database query failed', {
  userId: 'user-123',
  tenantId: 'tenant-456',
  sessionId: 'session-789',
  action: 'fetch_repository',
  duration: 1234,
}, error);

// Child logger with default context
const childLogger = logger.child({
  service: 'analysis-engine',
  tenantId: 'tenant-456',
});
childLogger.info('Analysis started');
```

**Configuration:**
Set `LOG_LEVEL` environment variable to `error`, `warn`, `info`, or `debug`.

### 2. Metrics Collection (`metrics.service.ts`)

Collects and emits metrics for:
- **Application metrics**: Request latency, error rates, active sessions
- **Infrastructure metrics**: CPU, memory, database connections
- **Business metrics**: Sessions, scripts, templates
- **Custom metrics**: Airia policy enforcement, Retell voice quality

**Metric Types:**
- Counter: Monotonically increasing values
- Gauge: Point-in-time values
- Histogram: Distribution of values
- Timer: Duration measurements

**Usage:**
```typescript
import { metricsService } from './services/metrics.service';

// Increment counter
metricsService.incrementCounter('sessions.created', 1, { tenantId: 'tenant-123' });

// Set gauge
metricsService.setGauge('sessions.active', 42, { tenantId: 'tenant-123' });

// Record histogram
metricsService.recordHistogram('api.latency', 123, { endpoint: '/sessions' }, 'ms');

// Start timer
const timer = metricsService.startTimer('database.query', { operation: 'select' });
// ... do work ...
const duration = timer.end(); // Automatically records histogram

// Track specific events
metricsService.trackSession('created', 'tenant-123', 'session-456');
metricsService.trackCost('openrouter', 0.15, 'tenant-123', 'session-456');
metricsService.trackAiriaPolicy('violated', 'tenant-123', 'data-access');
metricsService.trackRetellLatency(750, 'tenant-123');
```

**Infrastructure Metrics:**
Automatically collected every minute:
- CPU usage and count
- Memory usage (total, used, free)
- Process memory (heap, RSS)
- System uptime

### 3. Health Checks (`health-check.service.ts`)

Provides health checks for:
- Service health (overall status)
- Database connectivity
- Redis connectivity
- Airia availability
- Liveness probe (is service running?)
- Readiness probe (is service ready for traffic?)

**Endpoints:**
- `GET /health` - Comprehensive health check
- `GET /health/live` - Liveness probe (for Kubernetes)
- `GET /health/ready` - Readiness probe (for Kubernetes)
- `GET /health/status` - Simple status summary

**Health Statuses:**
- `healthy`: All dependencies operational
- `degraded`: Some dependencies unavailable (e.g., Airia down = read-only mode)
- `unhealthy`: Critical dependencies unavailable

**Usage:**
```typescript
import { healthCheckService } from './services/health-check.service';

// Initialize with dependencies
healthCheckService.initialize({
  dbPool: db.pool,
  redisClient,
  airiaApiUrl: config.airia.apiUrl,
  airiaApiKey: config.airia.apiKey,
});

// Check health
const health = await healthCheckService.checkHealth();
console.log(health.status); // 'healthy', 'degraded', or 'unhealthy'

// Check liveness
const liveness = await healthCheckService.checkLiveness();
console.log(liveness.alive); // true/false

// Check readiness
const readiness = await healthCheckService.checkReadiness();
console.log(readiness.ready); // true/false
```

### 4. Alerting (`alerting.service.ts`)

Manages alerts for:
- **Critical alerts**: Service failures, high error rates (>10%), Airia unavailable
- **Warning alerts**: Degraded performance, cost anomalies, policy violations
- **Custom alerts**: Retell quality issues, latency problems

**Alert Rules:**
- Service unavailability >5 minutes (CRITICAL)
- Error rate >10% for 5 minutes (CRITICAL)
- Error rate >5% for 5 minutes (WARNING)
- Response time >2s for 10 minutes (WARNING)
- Cost anomaly >2x average (WARNING)
- Policy violation rate >5% (WARNING)
- Retell quality score <4/5 (WARNING)
- Retell latency >800ms (WARNING)
- Airia unavailable (CRITICAL)

**Usage:**
```typescript
import { alertingService, AlertType, AlertSeverity } from './services/alerting.service';

// Start monitoring
alertingService.startMonitoring(60000); // Check every minute

// Track events for rate-based alerts
alertingService.trackError('/api/sessions');
alertingService.trackRequest('/api/sessions');
alertingService.trackPolicyViolation('tenant-123');

// Manually trigger alert
alertingService.alert(
  AlertType.COST_ANOMALY,
  AlertSeverity.WARNING,
  'Session cost exceeded $10',
  { sessionId: 'session-123', cost: 12.50 }
);

// Listen for alerts
alertingService.on('alert', (alert) => {
  console.log(`ALERT: ${alert.message}`);
  // Send to PagerDuty, Slack, etc.
});

// Get active alerts
const activeAlerts = alertingService.getActiveAlerts();

// Resolve alert
alertingService.resolveAlert('alert-id');
```

### 5. Dashboards (`dashboard.service.ts`)

Provides data for monitoring dashboards:

#### Operations Dashboard
- Health status and uptime
- Error rates by endpoint
- Latency percentiles (p50, p95, p99)
- Active alerts count

#### Cost Dashboard
- Total cost
- Cost by tenant
- Cost by service (OpenRouter, Retell, Modal)
- Cost over time
- Top sessions by cost

#### Usage Dashboard
- Session counts (total, active, completed)
- Sessions by tenant
- Scripts generated/replayed
- Templates created/shared/used
- Voice session counts

#### Security Dashboard
- Authentication events (successful/failed logins, MFA enrollments)
- Policy violations by type and tenant
- Audit events by action

**Endpoints:**
- `GET /api/dashboards/operations` - Operations dashboard
- `GET /api/dashboards/cost?startDate=...&endDate=...` - Cost dashboard
- `GET /api/dashboards/usage?startDate=...&endDate=...` - Usage dashboard
- `GET /api/dashboards/security?startDate=...&endDate=...` - Security dashboard

### 6. Metrics Export (`metrics.routes.ts`)

Exports metrics for external monitoring systems:
- `GET /metrics` - Prometheus format
- `GET /metrics/json` - JSON format

## Middleware

### Correlation ID Middleware (`correlation.middleware.ts`)
Adds unique correlation IDs to all requests for distributed tracing.

### Request Logger Middleware (`request-logger.middleware.ts`)
Logs all API requests with structured logging and correlation IDs.

### Metrics Middleware (`metrics.middleware.ts`)
Tracks request metrics (latency, status codes) for all API endpoints.

## Integration

All observability components are integrated in `index.ts`:

```typescript
// Initialize observability services
await initializeObservability();

// Services started:
// - Health check service
// - Dashboard service
// - Infrastructure metrics collection (every minute)
// - Alert monitoring (every minute)
// - Airia health monitoring
```

## Configuration

Environment variables:
- `LOG_LEVEL`: Log level (error, warn, info, debug) - default: info
- `NODE_ENV`: Environment (development, staging, production)

## Monitoring Integration

### Prometheus
Scrape metrics from `GET /metrics` endpoint.

### Kubernetes
Use health check endpoints:
- Liveness: `GET /health/live`
- Readiness: `GET /health/ready`

### CloudWatch / Datadog
Listen to metrics service events:
```typescript
metricsService.on('metric', (metric) => {
  // Send to CloudWatch/Datadog
});
```

### PagerDuty / Slack
Listen to alerting service events:
```typescript
alertingService.on('alert', (alert) => {
  if (alert.severity === AlertSeverity.CRITICAL) {
    // Send to PagerDuty
  } else {
    // Send to Slack
  }
});
```

## Best Practices

1. **Always use correlation IDs**: Include `correlationId` in log context for request tracing
2. **Track costs**: Use `metricsService.trackCost()` for all external service calls
3. **Log errors with context**: Include userId, tenantId, sessionId when available
4. **Use child loggers**: Create child loggers with default context for services
5. **Monitor Airia and Retell**: Track policy enforcement and voice quality metrics
6. **Set up alerts**: Configure external alerting for critical alerts
7. **Review dashboards**: Regularly check operations, cost, usage, and security dashboards

## Troubleshooting

### High Error Rates
1. Check operations dashboard for error breakdown
2. Review logs with correlation IDs
3. Check active alerts for root cause

### Performance Issues
1. Check latency metrics in operations dashboard
2. Review infrastructure metrics (CPU, memory)
3. Check database connection pool metrics

### Cost Anomalies
1. Check cost dashboard for breakdown by service/tenant
2. Review top sessions by cost
3. Check for policy violations in security dashboard

### Airia Unavailable
1. System enters read-only mode automatically
2. Check Airia health in health check endpoint
3. Alert triggered automatically
4. Users can still access existing sanitized artifacts

## Future Enhancements

- Distributed tracing with OpenTelemetry
- Custom metric aggregation and percentile calculations
- Real-time dashboard updates via WebSocket
- Advanced anomaly detection
- Cost forecasting and budgeting
- SLA monitoring and reporting
