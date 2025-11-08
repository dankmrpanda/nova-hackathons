import React from 'react';
import type { AnalysisResult } from '@codebase-onboarding/shared';
import './session.css';

interface AnalysisResultsProps {
  analysisResult: AnalysisResult;
}

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({ analysisResult }) => {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const getDuration = () => {
    if (!analysisResult.completedAt) return 'In progress';
    const start = new Date(analysisResult.startedAt).getTime();
    const end = new Date(analysisResult.completedAt).getTime();
    const seconds = Math.floor((end - start) / 1000);
    return `${seconds}s`;
  };

  return (
    <div className="analysis-results">
      <div className="results-summary">
        <h3>Analysis Summary</h3>
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">Status</div>
            <div className={`summary-value status-${analysisResult.status}`}>
              {analysisResult.status}
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Duration</div>
            <div className="summary-value">{getDuration()}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Architecture Patterns</div>
            <div className="summary-value">{analysisResult.architecture.length}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Features Found</div>
            <div className="summary-value">{analysisResult.features.length}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Data Flows</div>
            <div className="summary-value">{analysisResult.dataFlows.length}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Artifacts</div>
            <div className="summary-value">{analysisResult.sanitizedArtifacts.length}</div>
          </div>
        </div>
      </div>

      <div className="results-details">
        <div className="detail-section">
          <h4>Repository</h4>
          <p className="repository-url">{analysisResult.repositoryUrl}</p>
          <div className="scope-info">
            <span className="scope-label">Scope:</span>
            <span className="scope-value">{analysisResult.analysisScope.type}</span>
          </div>
        </div>

        {analysisResult.architecture.length > 0 && (
          <div className="detail-section">
            <h4>Detected Architecture Patterns</h4>
            <ul className="architecture-list">
              {analysisResult.architecture.map((pattern, index) => (
                <li key={index} className="architecture-item">
                  <div className="pattern-header">
                    <span className="pattern-type">{pattern.type}</span>
                    <span className="pattern-confidence">
                      {Math.round(pattern.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="pattern-explanation">{pattern.explanation}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysisResult.executionResults.length > 0 && (
          <div className="detail-section">
            <h4>Code Execution Results</h4>
            <div className="execution-results">
              {analysisResult.executionResults.map((result, index) => (
                <div
                  key={index}
                  className={`execution-result ${result.success ? 'success' : 'error'}`}
                >
                  <div className="execution-header">
                    <span className="execution-status">
                      {result.success ? '✓' : '✗'}
                    </span>
                    <span className="execution-duration">{result.duration}ms</span>
                  </div>
                  {result.output && (
                    <pre className="execution-output">{result.output}</pre>
                  )}
                  {result.error && (
                    <pre className="execution-error">{result.error}</pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="detail-section">
          <h4>Timeline</h4>
          <div className="timeline">
            <div className="timeline-item">
              <span className="timeline-label">Started:</span>
              <span className="timeline-value">{formatDate(analysisResult.startedAt)}</span>
            </div>
            {analysisResult.completedAt && (
              <div className="timeline-item">
                <span className="timeline-label">Completed:</span>
                <span className="timeline-value">{formatDate(analysisResult.completedAt)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
