import React, { useState } from 'react';
import type { MFAMethod } from '@codebase-onboarding/shared';
import './auth.css';

interface MFAVerificationProps {
  method: MFAMethod;
  onVerify: (code: string) => Promise<void>;
  onCancel: () => void;
}

export const MFAVerification: React.FC<MFAVerificationProps> = ({
  method,
  onVerify,
  onCancel,
}) => {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    try {
      await onVerify(code);
    } catch (err) {
      setError('Verification failed. Please try again.');
      setIsVerifying(false);
      setCode('');
    }
  };

  return (
    <div className="mfa-verification">
      <div className="mfa-container">
        <h2>Two-Factor Authentication</h2>
        <p className="mfa-description">
          {method === 'TOTP'
            ? 'Enter the code from your authenticator app'
            : 'Use your security key to authenticate'}
        </p>

        <form onSubmit={handleSubmit} className="mfa-verification-form">
          {method === 'TOTP' && (
            <div className="form-group">
              <label htmlFor="mfa-code">Authentication Code</label>
              <input
                id="mfa-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                maxLength={6}
                pattern="[0-9]{6}"
                required
                autoFocus
                aria-required="true"
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'mfa-error' : undefined}
              />
            </div>
          )}

          {method === 'WebAuthn' && (
            <div className="webauthn-prompt">
              <p>Insert your security key and follow the prompts.</p>
            </div>
          )}

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
              disabled={isVerifying || (method === 'TOTP' && code.length !== 6)}
            >
              {isVerifying ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
