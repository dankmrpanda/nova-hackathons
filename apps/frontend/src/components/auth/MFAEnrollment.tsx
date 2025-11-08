import React, { useState } from 'react';
import type { MFAMethod, MFASecret } from '@codebase-onboarding/shared';
import './auth.css';

interface MFAEnrollmentProps {
  onEnroll: (method: MFAMethod, code: string) => Promise<void>;
  onCancel: () => void;
  mfaSecret?: MFASecret;
}

export const MFAEnrollment: React.FC<MFAEnrollmentProps> = ({
  onEnroll,
  onCancel,
  mfaSecret,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<MFAMethod>('TOTP');
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    try {
      await onEnroll(selectedMethod, verificationCode);
    } catch (err) {
      setError('Verification failed. Please check your code and try again.');
      setIsVerifying(false);
    }
  };

  return (
    <div className="mfa-enrollment">
      <div className="mfa-container">
        <h2>Set Up Multi-Factor Authentication</h2>
        <p className="mfa-description">
          Add an extra layer of security to your account
        </p>

        <div className="mfa-method-selector">
          <label>
            <input
              type="radio"
              name="mfa-method"
              value="TOTP"
              checked={selectedMethod === 'TOTP'}
              onChange={() => setSelectedMethod('TOTP')}
            />
            <span>Authenticator App (TOTP)</span>
          </label>
          <label>
            <input
              type="radio"
              name="mfa-method"
              value="WebAuthn"
              checked={selectedMethod === 'WebAuthn'}
              onChange={() => setSelectedMethod('WebAuthn')}
            />
            <span>Security Key (WebAuthn)</span>
          </label>
        </div>

        {selectedMethod === 'TOTP' && mfaSecret && (
          <div className="totp-setup">
            <div className="qr-code-container">
              <img
                src={mfaSecret.qrCode}
                alt="QR Code for authenticator app"
                className="qr-code"
              />
            </div>
            <div className="secret-key">
              <p>Or enter this key manually:</p>
              <code>{mfaSecret.secret}</code>
            </div>
            <div className="backup-codes">
              <p>Backup codes (save these securely):</p>
              <ul>
                {mfaSecret.backupCodes.map((code, index) => (
                  <li key={index}>
                    <code>{code}</code>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {selectedMethod === 'WebAuthn' && (
          <div className="webauthn-setup">
            <p>Insert your security key and follow the prompts.</p>
          </div>
        )}

        <form onSubmit={handleEnroll} className="mfa-verification-form">
          <div className="form-group">
            <label htmlFor="verification-code">Verification Code</label>
            <input
              id="verification-code"
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Enter 6-digit code"
              maxLength={6}
              pattern="[0-9]{6}"
              required
              aria-required="true"
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'mfa-error' : undefined}
            />
          </div>

          {error && (
            <div id="mfa-error" className="error-message" role="alert">
              {error}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary"
              disabled={isVerifying}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isVerifying || verificationCode.length !== 6}
            >
              {isVerifying ? 'Verifying...' : 'Enable MFA'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
