# Artifact Storage Implementation

## Overview

The Artifact Storage Service provides secure, scalable storage for sanitized artifacts with automatic retention policy enforcement. It implements requirements 18.2, 39.2, and 39.3 from the design specification.

## Architecture

### Components

1. **ArtifactStorageService** - Main service for S3 storage operations
2. **RetentionEnforcerService** - Periodic job for enforcing retention policies
3. **Redis Cache** - Fast retrieval layer for frequently accessed artifacts
4. **S3/MinIO** - Persistent storage with tenant isolation

### Data Flow

```
Store Artifact:
  Application → ArtifactStorageService → S3 (persistent) + Redis (cache)
  
Retrieve Artifact:
  Application → ArtifactStorageService → Redis (cache hit) OR S3 (cache miss)
  
Delete Expired:
  RetentionEnforcerService (cron) → ArtifactStorageService → S3 + Redis
```

## Features

### 1. S3 Storage with Tenant Isolation

All artifacts are stored with tenant-specific prefixes to ensure data isolation:

```
artifacts/{tenantId}/sessions/{sessionId}/{type}/{artifactId}.json
scripts/{tenantId}/sessions/{sessionId}/{scriptId}.json
templates/{tenantId}/{templateId}.json
```

### 2. Redis Caching

- Artifacts are cached in Redis for fast retrieval
- Cache TTL is automatically calculated based on retention policy
- Cache keys: `artifact:cache:{identifier}`
- Key lookups are cached: `artifact:key:{artifactId}`

### 3. Retention Policy Enforcement

Retention policies are defined per artifact:

```typescript
interface ArtifactRetentionPolicy {
  type: 'immediate' | 'hours' | 'days' | 'years';
  duration: number;
  autoDelete: boolean;
}
```

**Examples:**
- Raw code: `{ type: 'hours', duration: 24, autoDelete: true }` (24-hour deletion)
- Sanitized artifacts: `{ type: 'days', duration: 30, autoDelete: true }`
- Templates: `{ type: 'years', duration: 2, autoDelete: false }`

### 4. Automatic Deletion

The `RetentionEnforcerService` runs periodically (default: every 60 minutes) to:
1. Check all scheduled deletions in Redis
2. Delete expired artifacts from S3
3. Clear cache entries
4. Remove deletion schedules

## Usage

### Storing Artifacts

```typescript
import { artifactStorageService } from './services';

// Store sanitized artifact
const artifact: SanitizedArtifact = {
  id: uuidv4(),
  type: 'explanation',
  content: 'Sanitized explanation...',
  references: [{ path: 'src/main.ts', lineNumbers: [10, 20], relevance: 1.0 }],
  metadata: {
    sessionId: 'session-123',
    tenantId: 'tenant-456',
    userId: 'user-789',
    size: 1024,
  },
  createdAt: new Date(),
  retentionPolicy: {
    type: 'days',
    duration: 30,
    autoDelete: true,
  },
};

const key = await artifactStorageService.storeArtifact(artifact, {
  useCache: true,
  cacheTTL: 3600, // 1 hour
});
```

### Retrieving Artifacts

```typescript
// Retrieve with caching
const artifact = await artifactStorageService.retrieveArtifact('artifact-123');

// Retrieve without cache
const artifact = await artifactStorageService.retrieveArtifact('artifact-123', {
  useCache: false,
});
```

### Deleting Session Artifacts

```typescript
// Delete all artifacts for a session (Requirement 18.2)
const result = await artifactStorageService.deleteSessionArtifacts(
  'session-123',
  'tenant-456'
);

console.log(`Deleted ${result.deletedCount} artifacts`);
if (!result.success) {
  console.error('Errors:', result.errors);
}
```

### Starting Retention Enforcer

```typescript
import { retentionEnforcerService } from './services';

// Start with default 60-minute interval
retentionEnforcerService.start();

// Or specify custom interval (in minutes)
retentionEnforcerService.start(30); // Check every 30 minutes

// Stop the enforcer
retentionEnforcerService.stop();

// Manually trigger enforcement
await retentionEnforcerService.enforceRetentionPolicies();
```

## Configuration

### Environment Variables

```bash
# S3/MinIO Configuration
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=onboarding-artifacts

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### Bucket Structure

The S3 bucket should be organized as follows:

```
onboarding-artifacts/
├── artifacts/
│   └── {tenantId}/
│       └── sessions/
│           └── {sessionId}/
│               ├── explanation/
│               ├── diagram/
│               ├── transcript/
│               └── script/
├── scripts/
│   └── {tenantId}/
│       └── sessions/
│           └── {sessionId}/
└── templates/
    └── {tenantId}/
```

## Requirements Mapping

### Requirement 18.2
> "THE System SHALL delete all raw repository data and Intermediate Artifacts within 24 hours of session completion"

**Implementation:**
- `deleteSessionArtifacts()` method deletes all artifacts for a session
- Retention policy with `type: 'hours', duration: 24, autoDelete: true`
- Automatic enforcement via `RetentionEnforcerService`

### Requirement 39.2
> "THE System SHALL delete all raw repository data and Intermediate Artifacts within 24 hours of Onboarding Session completion"

**Implementation:**
- Same as 18.2 - automatic deletion after 24 hours
- Scheduled via Redis with TTL-based expiry tracking
- `enforceRetentionPolicies()` runs periodically to clean up

### Requirement 39.3
> "THE System SHALL retain Sanitized Artifacts and Interactive Scripts according to their own retention policies independent of the 24-hour rule"

**Implementation:**
- Sanitized artifacts have separate retention policies
- Interactive scripts can have longer retention (days, years)
- Templates can be retained indefinitely
- Each artifact type has its own `ArtifactRetentionPolicy`

## Performance Considerations

### Caching Strategy

1. **Cache Hit**: ~1-5ms (Redis lookup)
2. **Cache Miss**: ~50-200ms (S3 retrieval + cache update)
3. **Cache TTL**: Automatically calculated based on retention policy

### Optimization Tips

1. Use caching for frequently accessed artifacts
2. Batch delete operations when possible
3. Run retention enforcer during off-peak hours
4. Monitor S3 and Redis metrics

## Security

### Tenant Isolation

- All S3 keys include tenant ID prefix
- Cache keys include tenant context
- No cross-tenant artifact access possible

### Encryption

- S3 encryption at rest (configured at bucket level)
- TLS for all S3 communication
- Redis encryption in transit (if configured)

### Access Control

- S3 credentials stored in environment variables
- No direct S3 access from client
- All operations go through service layer

## Monitoring

### Metrics to Track

1. **Storage Metrics**
   - Total artifacts stored
   - Storage size per tenant
   - Cache hit rate

2. **Retention Metrics**
   - Artifacts deleted per enforcement run
   - Failed deletions
   - Retention policy violations

3. **Performance Metrics**
   - Average retrieval time
   - Cache hit/miss ratio
   - S3 operation latency

### Logging

All operations are logged with:
- Timestamp
- Operation type (store, retrieve, delete)
- Artifact ID and type
- Tenant ID
- Success/failure status
- Error details (if applicable)

## Troubleshooting

### Common Issues

1. **S3 Connection Errors**
   - Check S3_ENDPOINT configuration
   - Verify credentials
   - Ensure bucket exists

2. **Cache Misses**
   - Check Redis connection
   - Verify cache TTL settings
   - Monitor Redis memory usage

3. **Retention Not Enforcing**
   - Verify RetentionEnforcerService is running
   - Check Redis for scheduled deletions
   - Review retention policy configuration

### Debug Commands

```typescript
// Check if artifact exists
const exists = await artifactStorageService.artifactExists('artifact-123');

// Get artifact metadata without downloading
const metadata = await artifactStorageService.getArtifactMetadata('artifact-123');

// Manually enforce retention
await artifactStorageService.enforceRetentionPolicies();
```

## Future Enhancements

1. **Database Index**: Replace S3 listing with database index for faster lookups
2. **Batch Operations**: Add bulk store/retrieve operations
3. **Compression**: Compress artifacts before storage
4. **CDN Integration**: Add CloudFront for faster global access
5. **Lifecycle Policies**: Use S3 lifecycle policies for automatic deletion
6. **Metrics Dashboard**: Real-time monitoring dashboard
