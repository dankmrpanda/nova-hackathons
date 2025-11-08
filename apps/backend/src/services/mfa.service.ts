import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  GenerateRegistrationOptionsOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyRegistrationResponseOpts,
  VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import { config } from '../config';
import { db } from '../db';
import { MFASecret, MFAMethod } from '@codebase-onboarding/shared';

export class MFAService {
  /**
   * Enroll TOTP MFA for a user
   */
  async enrollTOTP(userId: string, email: string): Promise<MFASecret> {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Codebase Onboarding (${email})`,
      issuer: 'Codebase Onboarding Agent',
      length: 32,
    });

    if (!secret.otpauth_url) {
      throw new Error('Failed to generate TOTP secret');
    }

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(8);

    // Hash backup codes for storage
    const hashedBackupCodes = backupCodes.map((code) =>
      crypto.createHash('sha256').update(code).digest('hex')
    );

    // Store secret and backup codes in database
    await db.query(
      `UPDATE users 
       SET mfa_secret = $1, 
           mfa_method = $2,
           mfa_backup_codes = $3
       WHERE id = $4`,
      [secret.base32, 'TOTP', JSON.stringify(hashedBackupCodes), userId]
    );

    return {
      secret: secret.base32,
      qrCode,
      backupCodes,
    };
  }

  /**
   * Verify TOTP token
   */
  async verifyTOTP(userId: string, token: string): Promise<boolean> {
    // Get user's MFA secret
    const result = await db.query(
      'SELECT mfa_secret, mfa_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const { mfa_secret } = result.rows[0];

    if (!mfa_secret) {
      throw new Error('MFA not enrolled');
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: mfa_secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps before and after
    });

    return verified;
  }

  /**
   * Enable MFA for a user after successful verification
   */
  async enableMFA(userId: string): Promise<void> {
    await db.query('UPDATE users SET mfa_enabled = true WHERE id = $1', [userId]);
  }

  /**
   * Disable MFA for a user
   */
  async disableMFA(userId: string): Promise<void> {
    await db.query(
      `UPDATE users 
       SET mfa_enabled = false, 
           mfa_secret = NULL, 
           mfa_method = NULL,
           mfa_backup_codes = NULL,
           webauthn_credentials = NULL
       WHERE id = $1`,
      [userId]
    );
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const result = await db.query(
      'SELECT mfa_backup_codes FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].mfa_backup_codes) {
      return false;
    }

    const backupCodes: string[] = JSON.parse(result.rows[0].mfa_backup_codes);
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    const index = backupCodes.indexOf(hashedCode);
    if (index === -1) {
      return false;
    }

    // Remove used backup code
    backupCodes.splice(index, 1);
    await db.query('UPDATE users SET mfa_backup_codes = $1 WHERE id = $2', [
      JSON.stringify(backupCodes),
      userId,
    ]);

    return true;
  }

  /**
   * Generate WebAuthn registration options
   */
  async generateWebAuthnRegistrationOptions(
    userId: string,
    email: string
  ): Promise<any> {
    // Get existing credentials
    const result = await db.query(
      'SELECT webauthn_credentials FROM users WHERE id = $1',
      [userId]
    );

    const existingCredentials = result.rows[0]?.webauthn_credentials
      ? JSON.parse(result.rows[0].webauthn_credentials)
      : [];

    const options: GenerateRegistrationOptionsOpts = {
      rpName: config.auth.webauthn.rpName,
      rpID: config.auth.webauthn.rpId,
      userID: userId,
      userName: email,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map((cred: any) => ({
        id: cred.credentialID,
        type: 'public-key',
        transports: cred.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    };

    const registrationOptions = await generateRegistrationOptions(options);

    // Store challenge temporarily (in production, use Redis)
    await db.query(
      `UPDATE users 
       SET webauthn_challenge = $1 
       WHERE id = $2`,
      [registrationOptions.challenge, userId]
    );

    return registrationOptions;
  }

  /**
   * Verify WebAuthn registration response
   */
  async verifyWebAuthnRegistration(
    userId: string,
    response: any
  ): Promise<boolean> {
    // Get stored challenge
    const result = await db.query(
      'SELECT webauthn_challenge, webauthn_credentials FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const { webauthn_challenge, webauthn_credentials } = result.rows[0];

    if (!webauthn_challenge) {
      throw new Error('No challenge found');
    }

    const opts: VerifyRegistrationResponseOpts = {
      response,
      expectedChallenge: webauthn_challenge,
      expectedOrigin: config.auth.webauthn.origin,
      expectedRPID: config.auth.webauthn.rpId,
    };

    const verification = await verifyRegistrationResponse(opts);

    if (verification.verified && verification.registrationInfo) {
      const { credentialPublicKey, credentialID, counter } =
        verification.registrationInfo;

      // Store credential
      const credentials = webauthn_credentials
        ? JSON.parse(webauthn_credentials)
        : [];

      credentials.push({
        credentialID: Buffer.from(credentialID).toString('base64'),
        credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64'),
        counter,
        transports: response.response.transports || [],
      });

      await db.query(
        `UPDATE users 
         SET webauthn_credentials = $1,
             webauthn_challenge = NULL,
             mfa_method = $2,
             mfa_enabled = true
         WHERE id = $3`,
        [JSON.stringify(credentials), 'WebAuthn', userId]
      );

      return true;
    }

    return false;
  }

  /**
   * Generate WebAuthn authentication options
   */
  async generateWebAuthnAuthenticationOptions(userId: string): Promise<any> {
    // Get user's credentials
    const result = await db.query(
      'SELECT webauthn_credentials FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].webauthn_credentials) {
      throw new Error('No WebAuthn credentials found');
    }

    const credentials = JSON.parse(result.rows[0].webauthn_credentials);

    const options: GenerateAuthenticationOptionsOpts = {
      rpID: config.auth.webauthn.rpId,
      allowCredentials: credentials.map((cred: any) => ({
        id: Buffer.from(cred.credentialID, 'base64'),
        type: 'public-key',
        transports: cred.transports,
      })),
      userVerification: 'preferred',
    };

    const authenticationOptions = await generateAuthenticationOptions(options);

    // Store challenge
    await db.query(
      `UPDATE users 
       SET webauthn_challenge = $1 
       WHERE id = $2`,
      [authenticationOptions.challenge, userId]
    );

    return authenticationOptions;
  }

  /**
   * Verify WebAuthn authentication response
   */
  async verifyWebAuthnAuthentication(
    userId: string,
    response: any
  ): Promise<boolean> {
    // Get stored challenge and credentials
    const result = await db.query(
      'SELECT webauthn_challenge, webauthn_credentials FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const { webauthn_challenge, webauthn_credentials } = result.rows[0];

    if (!webauthn_challenge || !webauthn_credentials) {
      throw new Error('No challenge or credentials found');
    }

    const credentials = JSON.parse(webauthn_credentials);

    // Find the credential being used
    const credentialID = Buffer.from(response.id, 'base64url').toString('base64');
    const credential = credentials.find((c: any) => c.credentialID === credentialID);

    if (!credential) {
      throw new Error('Credential not found');
    }

    const opts: VerifyAuthenticationResponseOpts = {
      response,
      expectedChallenge: webauthn_challenge,
      expectedOrigin: config.auth.webauthn.origin,
      expectedRPID: config.auth.webauthn.rpId,
      authenticator: {
        credentialID: Buffer.from(credential.credentialID, 'base64'),
        credentialPublicKey: Buffer.from(credential.credentialPublicKey, 'base64'),
        counter: credential.counter,
      },
    };

    const verification = await verifyAuthenticationResponse(opts);

    if (verification.verified) {
      // Update counter
      credential.counter = verification.authenticationInfo.newCounter;

      await db.query(
        `UPDATE users 
         SET webauthn_credentials = $1,
             webauthn_challenge = NULL
         WHERE id = $2`,
        [JSON.stringify(credentials), userId]
      );

      return true;
    }

    return false;
  }

  /**
   * Check if user has MFA enabled
   */
  async isMFAEnabled(userId: string): Promise<boolean> {
    const result = await db.query(
      'SELECT mfa_enabled FROM users WHERE id = $1',
      [userId]
    );

    return result.rows.length > 0 && result.rows[0].mfa_enabled;
  }

  /**
   * Get user's MFA method
   */
  async getMFAMethod(userId: string): Promise<MFAMethod | null> {
    const result = await db.query(
      'SELECT mfa_method FROM users WHERE id = $1',
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0].mfa_method : null;
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
    }
    return codes;
  }
}

export const mfaService = new MFAService();
