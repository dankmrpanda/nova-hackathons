import React, { useState } from 'react';
import type { RepositoryValidation } from '@codebase-onboarding/shared';
import './repository.css';

interface RepositoryUrlInputProps {
  onValidate: (url: string) => Promise<RepositoryValidation>;
  onSubmit: (url: string) => void;
}

export const RepositoryUrlInput: React.FC<RepositoryUrlInputProps> = ({
  onValidate,
  onSubmit,
}) => {
  const [url, setUrl] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validation, setValidation] = useState<RepositoryValidation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setValidation(null);
    setError(null);
  };

  const handleValidate = async () => {
    if (!url.trim()) {
      setError('Please enter a repository URL');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const result = await onValidate(url);
      setValidation(result);

      if (!result.accessible) {
        if (!result.exists) {
          setError('Repository not found');
        } else if (!result.hasPermission) {
          setError('You do not have permission to access this repository');
        } else {
          setError(result.error || 'Repository is not accessible');
        }
      }
    } catch (err) {
      setError('Failed to validate repository. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validation?.accessible) {
      onSubmit(url);
    } else {
      handleValidate();
    }
  };

  const isGitHubUrl = (urlString: string) => {
    return urlString.includes('github.com');
  };

  return (
    <div className="repository-url-input">
      <h3>Or enter a repository URL</h3>
      <form onSubmit={handleSubmit} className="url-input-form">
        <div className="form-group">
          <label htmlFor="repo-url">GitHub Repository URL</label>
          <div className="input-with-button">
            <input
              id="repo-url"
              type="url"
              value={url}
              onChange={handleUrlChange}
              placeholder="https://github.com/owner/repository"
              className={`url-input ${validation?.accessible ? 'valid' : ''} ${error ? 'invalid' : ''}`}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'url-error' : validation?.accessible ? 'url-success' : undefined}
            />
            <button
              type="button"
              onClick={handleValidate}
              disabled={isValidating || !url.trim()}
              className="btn-secondary"
            >
              {isValidating ? 'Validating...' : 'Validate'}
            </button>
          </div>
          {!isGitHubUrl(url) && url.trim() && (
            <p className="input-hint">Only GitHub repositories are supported</p>
          )}
        </div>

        {error && (
          <div id="url-error" className="error-message" role="alert">
            {error}
          </div>
        )}

        {validation?.accessible && (
          <div id="url-success" className="success-message" role="status">
            ✓ Repository is accessible
          </div>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={!validation?.accessible || isValidating}
        >
          Continue with this repository
        </button>
      </form>
    </div>
  );
};
