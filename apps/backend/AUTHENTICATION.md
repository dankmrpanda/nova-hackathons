# Authentication and Authorization Implementation

This document describes the authentication and authorization system implemented for the Codebase Onboarding Agent.

## Overview

The authentication and authorization module provides:
- SSO/OIDC authentication
- Multi-factor authentication (TOTP and WebAuthn)
- Role-based access control (RBAC)
- Session management
- Audit logging

## Components Implemented

### 1. SSO/OIDC Authentication Service

**Location**: `src/services/auth.service.ts`

**Features**:
- OIDC client integration with configurable providers
- OAuth flow handlers (initiate, callback, token exchange)
- JWT token generation and validation
- Session storage in PostgreSQL with 8-hour expiry
- Automatic user creation on first login

**API Endpoints**:
- `POST /auth/sso/initiate` - Initiate SSO flow
- `GET /auth/callback` - OAuth callback
- `POST /auth/session` - Create session
- `GET /auth/session/validate` - Validate session
- `DELETE /auth/session/:sessionId` - Revoke session
- `GET /auth/sessions` - List active sessions

### 2. MFA Service

**Location**: `src/services/mfa.service.ts`

**Features**:
- TOTP enrollment with QR code generation
- WebAuthn registration and authentication
- Backup codes generation and verification
- MFA verification middleware
- Enforcement for Administrator role

**API Endpoints**:
- `POST /mfa/totp/enroll` - Enroll TOTP
- `POST /mfa/totp/verify` - Verify TOTP and enable MFA
- `POST /mfa/verify` - Verify MFA during login
- `POST /mfa/webauthn/register/options` - Get WebAuthn registration options
- `POST /mfa/webauthn/register/verify` - Verify WebAuthn registration
- `POST /mfa/webauthn/authenticate/options` - Get WebAuthn authentication options
- `POST /mfa/webauthn/authenticate/verify` - Verify WebAuthn authentication
- `DELETE /mfa` - Disable MFA
- `GET /mfa/status` - Get MFA status

### 3. RBAC Service

**Location**: `src/services/rbac.service.ts`

**Features**:
- Role hierarchy (Collaborator < Developer < TeamLead < Administrator)
- Permission checking for resources and actions
- Role assignment and revocation
- Audit logging for all access attempts
- Tenant isolation

**Roles and Permissions**:

**Collaborator**:
- Read shared sessions

**Developer**:
- Create, read, update, delete own sessions
- Share sessions
- Read templates
- Manage own MFA

**TeamLead**:
- All Developer permissions
- Create, update, delete templates
- Share templates
- Read analytics
- Read user information

**Administrator**:
- All permissions
- Manage users and roles
- Configure policies
- Access audit logs
- Manage tenant settings

**API Endpoints**:
- `GET /rbac/permissions` - Get current user's permissions
- `POST /rbac/roles/assign` - Assign role (Admin only)
- `POST /rbac/roles/revoke` - Revoke role (Admin only)
- `GET /rbac/users/:role` - Get users by role
- `GET /rbac/audit-logs` - Get audit logs (Admin only)
- `GET /rbac/audit-logs/user/:userId` - Get user audit logs (Admin only)
- `GET /rbac/check-permission` - Check specific permission

## Middleware

### Authentication Middleware

**Location**: `src/middleware/auth.middleware.ts`

- `authenticateJWT` - Verify JWT token
- `authenticateSession` - Verify session token
- `optionalAuth` - Optional authentication

### MFA Middleware

**Location**: `src/middleware/mfa.middleware.ts`

- `enforceMFAForAdmin` - Require MFA for Administrators
- `requireMFAVerification` - Check MFA verification status
- `enforceTenantMFAPolicy` - Enforce tenant-level MFA policy

### RBAC Middleware

**Location**: `src/middleware/rbac.middleware.ts`

- `requirePermission(resource, action)` - Check specific permission
- `requireOwnership(resourceIdParam)` - Verify resource ownership
- `requireRole(...roles)` - Require specific role(s)
- `requireTenantAccess` - Enforce tenant isolation

## Database Schema

### Tables Created

**users**:
- User accounts with role, MFA settings, and OIDC integration
- Columns: id, email, name, tenant_id, role, mfa_enabled, mfa_method, mfa_secret, mfa_backup_codes, webauthn_credentials, webauthn_challenge, oidc_sub

**sessions**:
- Active user sessions with expiry tracking
- Columns: id, user_id, tenant_id, token_hash, expires_at, created_at, last_activity_at, ip_address, user_agent

**tenants**:
- Tenant configuration and policies
- Columns: id, name, organization_id, cost_limit, max_concurrent_sessions, mfa_required

**audit_logs**:
- Immutable audit trail of all access attempts
- Columns: id, timestamp, user_id, tenant_id, action, resource, resource_id, outcome, metadata, ip_address

## Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRES_IN=8h
SESSION_EXPIRY_HOURS=8

# OIDC/SSO Configuration
OIDC_ISSUER=https://your-oidc-provider.com
OIDC_CLIENT_ID=your_oidc_client_id
OIDC_CLIENT_SECRET=your_oidc_client_secret
OIDC_REDIRECT_URI=http://localhost:3001/auth/callback

# WebAuthn Configuration
WEBAUTHN_RP_NAME=Codebase Onboarding Agent
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:3001
```

## Usage Examples

### Protecting Routes with Authentication

```typescript
import { authenticateJWT } from './middleware/auth.middleware';

router.get('/protected', authenticateJWT, (req, res) => {
  // req.user contains authenticated user info
  res.json({ message: 'Protected resource' });
});
```

### Protecting Routes with Permissions

```typescript
import { requirePermission } from './middleware/rbac.middleware';

router.post('/sessions', 
  authenticateJWT,
  requirePermission('session', 'create'),
  (req, res) => {
    // User has permission to create sessions
  }
);
```

### Protecting Routes with Role

```typescript
import { requireRole } from './middleware/rbac.middleware';

router.get('/admin/settings',
  authenticateJWT,
  requireRole('Administrator'),
  (req, res) => {
    // Only administrators can access
  }
);
```

### Enforcing MFA for Administrators

```typescript
import { enforceMFAForAdmin } from './middleware/mfa.middleware';

router.get('/admin/sensitive',
  authenticateJWT,
  enforceMFAForAdmin,
  (req, res) => {
    // Administrators must have MFA enabled
  }
);
```

## Running Migrations

To set up the database schema:

```bash
npm run migrate
```

This will create all necessary tables and indexes.

## Security Features

1. **Password-less Authentication**: Uses SSO/OIDC for secure authentication
2. **JWT Tokens**: Short-lived tokens (8 hours) with secure signing
3. **Session Management**: Database-backed sessions with automatic expiry
4. **MFA Support**: Both TOTP and WebAuthn for strong authentication
5. **RBAC**: Fine-grained permission control
6. **Audit Logging**: Immutable audit trail of all access attempts
7. **Tenant Isolation**: Strict separation of tenant data
8. **Encrypted Storage**: Sensitive data encrypted at rest

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **Requirement 37**: Role-based access control with least-privilege principles
- **Requirement 38**: Strong authentication with SSO and optional MFA
- **Requirement 38.1**: SSO authentication via OIDC protocol
- **Requirement 38.2**: Optional MFA for all user roles
- **Requirement 38.3**: Required MFA for Administrator role
- **Requirement 38.5**: Support for TOTP and WebAuthn as MFA methods
- **Requirement 38.6**: Session management with secure session tokens
- **Requirement 38.7**: Session expiry after 8 hours
- **Requirement 38.9**: Logging of all authentication events
- **Requirement 37.1-37.11**: Complete RBAC implementation with four roles
- **Requirement 19**: Audit logging for compliance

## Next Steps

To complete the authentication system:

1. Integrate with a real OIDC provider (e.g., Auth0, Okta, Azure AD)
2. Set up proper JWT secret rotation
3. Configure production database with SSL
4. Set up monitoring and alerting for authentication failures
5. Implement rate limiting for authentication endpoints
6. Add email notifications for security events
