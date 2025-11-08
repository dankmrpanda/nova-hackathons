import React, { useState, useEffect } from 'react';
import type { AnalysisScope, ScopeValidation } from '@codebase-onboarding/shared';
import './repository.css';

interface AnalysisScopeConfigProps {
  selectedPaths: string[];
  onValidateScope: (scope: AnalysisScope) => Promise<ScopeValidation>;
  onSubmit: (scope: AnalysisScope) => void;
  estimatedCost?: number;
}

export const AnalysisScopeConfig: React.FC<AnalysisScopeConfigProps> = ({
  selectedPaths,
  onValidateScope,
  onSubmit,
  estimatedCost,
}) => {
  const [scopeType, setScopeType] = useState<'full' | 'partial'>('partial');
  const [excludedPaths, setExcludedPaths] = useState<string[]>([
    'node_modules',
    'dist',
    'build',
    '.git',
    'coverage',
  ]);
  const [includeSubmodules, setIncludeSubmodules] = useState(false);
  const [validation, setValidation] = useState<ScopeValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxSize = 100 * 1024 * 1024; // 100MB

  useEffect(() => {
    validateScope();
  }, [selectedPaths, scopeType, excludedPaths, includeSubmodules]);

  const validateScope = async () => {
    const scope: AnalysisScope = {
      type: scopeType,
      includedPaths: scopeType === 'full' ? [] : selectedPaths,
      excludedPaths,
      maxSize,
      includeSubmodules,
    };

    setIsValidating(true);
    setError(null);

    try {
      const result = await onValidateScope(scope);
      setValidation(result);

      if (result.exceedsLimit) {
        setError(
          `Selected scope exceeds the 100MB limit (${formatSize(result.totalSize)}). Please reduce your selection.`
        );
      }
    } catch (err) {
      setError('Failed to validate scope. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = () => {
    if (validation?.valid) {
      const scope: AnalysisScope = {
        type: scopeType,
        includedPaths: scopeType === 'full' ? [] : selectedPaths,
        excludedPaths,
        maxSize,
        includeSubmodules,
      };
      onSubmit(scope);
    }
  };

  const handleAddExclusion = (path: string) => {
    if (path.trim() && !excludedPaths.includes(path.trim())) {
      setExcludedPaths([...excludedPaths, path.trim()]);
    }
  };

  const handleRemoveExclusion = (path: string) => {
    setExcludedPaths(excludedPaths.filter((p) => p !== path));
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="analysis-scope-config">
      <h3>Configure Analysis Scope</h3>

      <div className="scope-type-selector">
        <label>
          <input
            type="radio"
            name="scope-type"
            value="full"
            checked={scopeType === 'full'}
            onChange={() => setScopeType('full')}
          />
          <span>Analyze entire repository</span>
        </label>
        <label>
          <input
            type="radio"
            name="scope-type"
            value="partial"
            checked={scopeType === 'partial'}
            onChange={() => setScopeType('partial')}
          />
          <span>Analyze selected files/folders only</span>
        </label>
      </div>

      {scopeType === 'partial' && selectedPaths.length === 0 && (
        <div className="warning-message">
          Please select at least one file or folder from the tree above
        </div>
      )}

      <div className="exclusions-section">
        <h4>Excluded Paths</h4>
        <p className="section-description">
          These paths will be excluded from analysis (e.g., dependencies, build artifacts)
        </p>
        <div className="exclusions-list">
          {excludedPaths.map((path) => (
            <div key={path} className="exclusion-item">
              <span>{path}</span>
              <button
                onClick={() => handleRemoveExclusion(path)}
                className="btn-remove"
                aria-label={`Remove ${path} from exclusions`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="add-exclusion">
          <input
            type="text"
            placeholder="Add path to exclude..."
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAddExclusion(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
            className="exclusion-input"
          />
        </div>
      </div>

      <div className="submodules-option">
        <label>
          <input
            type="checkbox"
            checked={includeSubmodules}
            onChange={(e) => setIncludeSubmodules(e.target.checked)}
          />
          <span>Include submodules in analysis</span>
        </label>
      </div>

      {validation && (
        <div className="scope-summary">
          <h4>Scope Summary</h4>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Total Size:</span>
              <span className={`summary-value ${validation.exceedsLimit ? 'error' : ''}`}>
                {formatSize(validation.totalSize)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">File Count:</span>
              <span className="summary-value">{validation.fileCount}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Size Limit:</span>
              <span className="summary-value">{formatSize(maxSize)}</span>
            </div>
            {estimatedCost !== undefined && (
              <div className="summary-item">
                <span className="summary-label">Estimated Cost:</span>
                <span className="summary-value">${estimatedCost.toFixed(2)}</span>
              </div>
            )}
          </div>

          {validation.suggestedExclusions && validation.suggestedExclusions.length > 0 && (
            <div className="suggestions">
              <p>Suggested exclusions to reduce size:</p>
              <ul>
                {validation.suggestedExclusions.map((path) => (
                  <li key={path}>
                    <button
                      onClick={() => handleAddExclusion(path)}
                      className="btn-link"
                    >
                      + Add "{path}"
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <div className="form-actions">
        <button
          onClick={handleSubmit}
          className="btn-primary"
          disabled={!validation?.valid || isValidating}
        >
          {isValidating ? 'Validating...' : 'Continue with this scope'}
        </button>
      </div>
    </div>
  );
};
