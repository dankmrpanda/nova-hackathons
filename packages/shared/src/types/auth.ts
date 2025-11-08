export type Role = 'Developer' | 'Collaborator' | 'TeamLead' | 'Administrator';

export type MFAMethod = 'TOTP' | 'WebAuthn';

export interface User {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  role: Role;
  mfaEnabled: boolean;
  mfaMethod?: MFAMethod;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface SessionMetadata {
  ipAddress: string;
  userAgent: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

export interface SessionToken {
  token: string;
  expiresAt: Date;
}

export interface SessionInfo {
  id: string;
  userId: string;
  tenantId: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  metadata: SessionMetadata;
}

export interface AuthURL {
  url: string;
  state: string;
}

export interface MFASecret {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface OIDCTokenSet {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}

export interface OIDCUserInfo {
  sub: string;
  email: string;
  name?: string;
  email_verified?: boolean;
}
