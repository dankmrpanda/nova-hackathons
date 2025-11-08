import React, { useState } from 'react';
import './auth.css';

interface SSOProvider {
  id: string;
  name: string;
  icon: string;
}

const ssoProviders: SSOProvider[] = [
  { id: 'okta', name: 'Okta', icon: '🔐' },
  { id: 'azure', name: 'Azure AD', icon: '☁️' },
  { id: 'google', name: 'Google Workspace', icon: '🔵' },
];

interface LoginPageProps {
  onLogin: (provider: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleProviderSelect = async (providerId: string) => {
    setSelectedProvider(providerId);
    setIsLoading(true);
    try {
      await onLogin(providerId);
    } catch (error) {
      console.error('Login failed:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>Codebase Onboarding Agent</h1>
          <p>Sign in to continue</p>
        </div>

        <div className="sso-providers">
          {ssoProviders.map((provider) => (
            <button
              key={provider.id}
              className={`sso-button ${selectedProvider === provider.id ? 'selected' : ''}`}
              onClick={() => handleProviderSelect(provider.id)}
              disabled={isLoading}
              aria-label={`Sign in with ${provider.name}`}
            >
              <span className="sso-icon" aria-hidden="true">{provider.icon}</span>
              <span className="sso-name">Sign in with {provider.name}</span>
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="loading-indicator" role="status" aria-live="polite">
            <span>Authenticating...</span>
          </div>
        )}

        <div className="login-footer">
          <p>Secure authentication via OIDC</p>
        </div>
      </div>
    </div>
  );
};
