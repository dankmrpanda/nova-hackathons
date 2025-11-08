import React, { useState } from 'react';
import { AnalysisResults } from './AnalysisResults';
import { ArchitectureDiagram } from './ArchitectureDiagram';
import { DataFlowVisualization } from './DataFlowVisualization';
import { CodeReferenceNav } from './CodeReferenceNav';
import type { AnalysisResult } from '@codebase-onboarding/shared';
import './session.css';

interface SessionViewerProps {
  sessionId: string;
  analysisResult: AnalysisResult | null;
  isLoading: boolean;
  onRefresh: () => void;
}

type ViewMode = 'overview' | 'architecture' | 'dataflow' | 'features';

export const SessionViewer: React.FC<SessionViewerProps> = ({
  sessionId: _sessionId,
  analysisResult,
  isLoading,
  onRefresh,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedArchitecture, setSelectedArchitecture] = useState(0);
  const [selectedDataFlow, setSelectedDataFlow] = useState(0);

  if (isLoading) {
    return (
      <div className="session-viewer loading">
        <div className="loading-spinner" role="status" aria-live="polite">
          <span>Analyzing repository...</span>
        </div>
      </div>
    );
  }

  if (!analysisResult) {
    return (
      <div className="session-viewer empty">
        <p>No analysis results available</p>
        <button onClick={onRefresh} className="btn-primary">
          Start Analysis
        </button>
      </div>
    );
  }

  return (
    <div className="session-viewer">
      <div className="session-viewer-header">
        <h2>Analysis Results</h2>
        <div className="view-mode-selector">
          <button
            className={`view-mode-btn ${viewMode === 'overview' ? 'active' : ''}`}
            onClick={() => setViewMode('overview')}
            aria-pressed={viewMode === 'overview'}
          >
            Overview
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'architecture' ? 'active' : ''}`}
            onClick={() => setViewMode('architecture')}
            aria-pressed={viewMode === 'architecture'}
          >
            Architecture
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'dataflow' ? 'active' : ''}`}
            onClick={() => setViewMode('dataflow')}
            aria-pressed={viewMode === 'dataflow'}
          >
            Data Flow
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'features' ? 'active' : ''}`}
            onClick={() => setViewMode('features')}
            aria-pressed={viewMode === 'features'}
          >
            Features
          </button>
        </div>
      </div>

      <div className="session-viewer-content">
        {viewMode === 'overview' && (
          <AnalysisResults analysisResult={analysisResult} />
        )}

        {viewMode === 'architecture' && (
          <div className="architecture-view">
            {analysisResult.architecture.length > 0 ? (
              <>
                {analysisResult.architecture.length > 1 && (
                  <div className="architecture-selector">
                    {analysisResult.architecture.map((pattern, index) => (
                      <button
                        key={index}
                        className={`architecture-tab ${selectedArchitecture === index ? 'active' : ''}`}
                        onClick={() => setSelectedArchitecture(index)}
                      >
                        {pattern.type}
                      </button>
                    ))}
                  </div>
                )}
                <ArchitectureDiagram
                  pattern={analysisResult.architecture[selectedArchitecture]}
                />
              </>
            ) : (
              <p className="no-data">No architecture patterns detected</p>
            )}
          </div>
        )}

        {viewMode === 'dataflow' && (
          <div className="dataflow-view">
            {analysisResult.dataFlows.length > 0 ? (
              <>
                {analysisResult.dataFlows.length > 1 && (
                  <div className="dataflow-selector">
                    {analysisResult.dataFlows.map((_flow, index) => (
                      <button
                        key={index}
                        className={`dataflow-tab ${selectedDataFlow === index ? 'active' : ''}`}
                        onClick={() => setSelectedDataFlow(index)}
                      >
                        Flow {index + 1}
                      </button>
                    ))}
                  </div>
                )}
                <DataFlowVisualization
                  dataFlow={analysisResult.dataFlows[selectedDataFlow]}
                />
              </>
            ) : (
              <p className="no-data">No data flows traced</p>
            )}
          </div>
        )}

        {viewMode === 'features' && (
          <CodeReferenceNav features={analysisResult.features} />
        )}
      </div>
    </div>
  );
};
