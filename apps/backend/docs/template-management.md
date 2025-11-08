# Template Management

## Overview

The Template Management module enables Team Leads and Administrators to create, version, share, and manage standardized onboarding templates across tenants. All templates contain only sanitized artifacts without raw code, secrets, or PII, ensuring safe cross-tenant sharing.

## Requirements Addressed

- **31.1**: Save interactive scripts as sanitized artifact templates
- **31.2**: Sanitize all template content before persistence
- **31.3**: Enforce only sanitized artifacts in templates
- **31.4**: Share templates across tenants with permission
- **31.5**: Allow customization for specific repositories
- **31.6**: Track usage with analytics
- **31.7**: Version interactive script templates
- **31.8**: Provide library view of available templates
- **31.9**: Allow feedback for iterative improvement
- **31.10**: Validate templates contain only sanitized artifacts
- **31.11**: Reject templates with raw code, secrets, or PII

## Architecture

### Components

1. **TemplateService** (`template.service.ts`)
   - Core business logic for template management
   - Validation and sanitization enforcement
   - Version management
   - Cross-tenant sharing

2. **Template Routes** (`template.routes.ts`)
   - RESTful API endpoints
   - RBAC enforcement (TeamLead, Administrator)
   - Request validation

3. **Database Tables**
   - `templates`: Template metadata
   - `template_metadata`: Additional metadata (category, difficulty, etc.)
   - `template_versions`: Version history
   - `template_usage`: Usage tracking
   - `template_feedback`: User ratings and feedback

4. **Frontend Components**
   - `TemplateLibrary`: Browse and search templates
   - `TemplateCreator`: Create templates from scripts

## API Endpoints

### Create Template

```http
POST /api/templates
Authorization: Bearer <token>
Content-Type: application/json

{
  "scriptId": "script-123",
  "name": "React Architecture Onboarding",
  "description": "Comprehensive guide to React app architecture",
  "tags": ["react", "architecture", "frontend"],
  "metadata": {
    "category": "Frontend",
    "difficulty": "intermediate",
    "estimatedDuration": 45,
    "prerequisites": ["JavaScript basics"],
    "learningObjectives": ["Understand component structure", "Learn state management"]
  }
}
```

**Response:**
```json
{
  "message": "Template created successfully",
  "template": {
    "id": "template-456",
    "name": "React Architecture Onboarding",
    "description": "Comprehensive guide to React app architecture",
    "version": "1.0.0",
    "createdAt": "2025-11-08T10:00:00Z"
  }
}
```

### Validate Template

```http
POST /api/templates/:id/validate
Authorization: Bearer <token>
```

**Response:**
```json
{
  "validation": {
    "isValid": true,
    "errors": [],
    "warnings": [],
    "sanitizationCheck": {
      "passed": true,
      "violations": []
    }
  }
}
```

### Share Template

```http
POST /api/templates/:id/share
Authorization: Bearer <token>
Content-Type: application/json

{
  "targetTenants": ["tenant-789", "tenant-012"],
  "validateBeforeShare": true
}
```

**Response:**
```json
{
  "message": "Template shared successfully",
  "template": {
    "id": "template-456",
    "name": "React Architecture Onboarding",
    "sharedWith": ["tenant-789", "tenant-012"]
  }
}
```

### Version Template

```http
POST /api/templates/:id/version
Authorization: Bearer <token>
Content-Type: application/json

{
  "scriptId": "script-789",
  "versionType": "minor"
}
```

**Response:**
```json
{
  "message": "Template versioned successfully",
  "template": {
    "id": "template-456",
    "name": "React Architecture Onboarding",
    "version": "1.1.0",
    "updatedAt": "2025-11-08T11:00:00Z"
  }
}
```

### Get Template Library

```http
GET /api/templates?tags=react,frontend&limit=20&offset=0
Authorization: Bearer <token>
```

**Response:**
```json
{
  "templates": [
    {
      "id": "template-456",
      "name": "React Architecture Onboarding",
      "description": "Comprehensive guide to React app architecture",
      "version": "1.1.0",
      "tags": ["react", "architecture", "frontend"],
      "usageCount": 42,
      "rating": 4.5,
      "createdAt": "2025-11-08T10:00:00Z",
      "updatedAt": "2025-11-08T11:00:00Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

### Get Template Details

```http
GET /api/templates/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "template": {
    "id": "template-456",
    "name": "React Architecture Onboarding",
    "description": "Comprehensive guide to React app architecture",
    "creatorId": "user-123",
    "tenantId": "tenant-456",
    "script": {
      "id": "script-123",
      "sections": [...],
      "diagrams": [...],
      "metadata": {...}
    },
    "version": "1.1.0",
    "sharedWith": ["tenant-789"],
    "tags": ["react", "architecture", "frontend"],
    "usageCount": 42,
    "rating": 4.5,
    "createdAt": "2025-11-08T10:00:00Z",
    "updatedAt": "2025-11-08T11:00:00Z"
  }
}
```

### Track Template Usage

```http
POST /api/templates/:id/use
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Template usage tracked"
}
```

### Submit Feedback

```http
POST /api/templates/:id/feedback
Authorization: Bearer <token>
Content-Type: application/json

{
  "rating": 5,
  "comment": "Excellent template! Very helpful for onboarding."
}
```

**Response:**
```json
{
  "message": "Feedback submitted successfully"
}
```

### Get Template Statistics

```http
GET /api/templates/:id/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "stats": {
    "templateId": "template-456",
    "usageCount": 42,
    "averageRating": 4.5,
    "feedbackCount": 15,
    "lastUsedAt": "2025-11-08T12:00:00Z"
  }
}
```

### Customize Template

```http
POST /api/templates/:id/customize
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "React Architecture Onboarding (Custom)",
  "description": "Customized for our team's React patterns",
  "scriptModifications": {
    "sections": [...]
  }
}
```

**Response:**
```json
{
  "message": "Template customized successfully",
  "template": {
    "id": "template-789",
    "name": "React Architecture Onboarding (Custom)",
    "description": "Customized for our team's React patterns",
    "version": "1.0.0"
  }
}
```

### Delete Template

```http
DELETE /api/templates/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Template deleted successfully"
}
```

## Validation Rules

### Sanitization Checks

Templates are automatically validated to ensure they contain only sanitized content:

1. **No Raw Code**: Code blocks are checked for suspicious patterns
2. **No Secrets**: Patterns for passwords, API keys, tokens are detected
3. **No PII**: Email addresses, SSNs, and other PII patterns are flagged
4. **Voice Timeline**: Must be marked as sanitized
5. **References Only**: Code snippets replaced with file references

### Validation Patterns

```typescript
// Detected patterns that trigger validation failures:
- password\s*[:=]\s*['"][^'"]+['"]
- api[_-]?key\s*[:=]\s*['"][^'"]+['"]
- secret\s*[:=]\s*['"][^'"]+['"]
- token\s*[:=]\s*['"][^'"]+['"]
- \b\d{3}-\d{2}-\d{4}\b  // SSN
- \b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b  // Email
```

## Versioning

Templates use semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes to template structure
- **MINOR**: New sections or features added
- **PATCH**: Bug fixes or minor improvements

Version history is stored in `template_versions` table for audit and rollback.

## Cross-Tenant Sharing

### Sharing Process

1. Template creator initiates share with target tenant IDs
2. System validates template sanitization
3. If validation passes, template is added to target tenants' libraries
4. Shared templates are read-only for recipient tenants
5. Recipients can customize templates to create their own versions

### Access Control

- **Creator Tenant**: Full control (edit, version, delete, share)
- **Shared Tenants**: Read-only access, can customize to create new template
- **RBAC**: Only TeamLead and Administrator roles can create/share templates

## Usage Analytics

### Tracked Metrics

- **Usage Count**: Number of times template has been used
- **Average Rating**: Calculated from user feedback
- **Feedback Count**: Number of users who provided feedback
- **Last Used**: Timestamp of most recent usage

### Analytics Queries

```sql
-- Get most popular templates
SELECT t.id, t.name, t.usage_count, t.rating
FROM templates t
ORDER BY t.usage_count DESC
LIMIT 10;

-- Get templates by rating
SELECT t.id, t.name, t.rating, COUNT(tf.id) as feedback_count
FROM templates t
LEFT JOIN template_feedback tf ON t.id = tf.template_id
GROUP BY t.id, t.name, t.rating
HAVING t.rating >= 4.0
ORDER BY t.rating DESC;

-- Get usage trends
SELECT DATE(tu.used_at) as date, COUNT(*) as usage_count
FROM template_usage tu
WHERE tu.template_id = $1
GROUP BY DATE(tu.used_at)
ORDER BY date DESC;
```

## Database Schema

### Templates Table

```sql
CREATE TABLE templates (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    creator_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    shared_with TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3, 2),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Template Metadata Table

```sql
CREATE TABLE template_metadata (
    template_id VARCHAR(255) PRIMARY KEY,
    category VARCHAR(100),
    difficulty VARCHAR(50) CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    estimated_duration INTEGER,
    prerequisites TEXT[],
    learning_objectives TEXT[]
);
```

### Template Versions Table

```sql
CREATE TABLE template_versions (
    id SERIAL PRIMARY KEY,
    template_id VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    template_data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(template_id, version)
);
```

### Template Usage Table

```sql
CREATE TABLE template_usage (
    id SERIAL PRIMARY KEY,
    template_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    used_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Template Feedback Table

```sql
CREATE TABLE template_feedback (
    id SERIAL PRIMARY KEY,
    template_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(template_id, user_id)
);
```

## Security Considerations

### Sanitization Enforcement

- All templates validated before creation
- Cross-tenant sharing requires validation
- Automatic rejection of templates with violations
- Audit logging of validation failures

### Access Control

- RBAC enforcement at API level
- Tenant isolation in database queries
- Creator ownership verification for modifications
- Shared template read-only access

### Data Protection

- Templates stored in S3 with encryption at rest
- Tenant-specific S3 key prefixes
- Redis caching with tenant isolation
- Audit logging of all template operations

## Best Practices

### Creating Templates

1. Start with a complete interactive script
2. Ensure all content is sanitized
3. Add descriptive tags for discoverability
4. Set appropriate difficulty level
5. Provide clear learning objectives

### Sharing Templates

1. Always validate before sharing
2. Review sanitization check results
3. Document prerequisites clearly
4. Update version when making changes
5. Monitor usage and feedback

### Customizing Templates

1. Use customization for team-specific needs
2. Maintain original template reference
3. Document customizations
4. Consider contributing improvements back

## Troubleshooting

### Validation Failures

**Problem**: Template validation fails with sanitization violations

**Solution**:
1. Review violation messages
2. Check for code blocks with sensitive data
3. Ensure voice timeline is marked as sanitized
4. Replace code snippets with file references
5. Re-run validation after fixes

### Sharing Issues

**Problem**: Cannot share template across tenants

**Solution**:
1. Verify you have TeamLead or Administrator role
2. Ensure template passes validation
3. Check target tenant IDs are valid
4. Review audit logs for detailed error messages

### Performance Issues

**Problem**: Template library loads slowly

**Solution**:
1. Use pagination (limit/offset)
2. Filter by specific tags
3. Check Redis cache is enabled
4. Review database indexes
5. Monitor S3 retrieval times

## Future Enhancements

- Template categories and hierarchies
- Advanced search with full-text indexing
- Template recommendations based on usage
- Collaborative template editing
- Template marketplace
- Import/export templates as bundles
- Template diff viewer for versions
- Automated template quality scoring
