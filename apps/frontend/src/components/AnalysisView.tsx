import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AnalysisView.css';

interface AnalysisResults {
  architecture: any;
  features: any[];
  dataFlow: any;
  techStack: any;
  onboardingGuide: any;
  confusionPoints: any[];
  recommendations: string[];
}

const AnalysisView = () => {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<any>(null);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalysis();
    const interval = setInterval(() => {
      if (analysis?.status === 'processing' || analysis?.status === 'queued') {
        loadAnalysis();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [analysisId]);

  const loadAnalysis = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`/api/analysis/results/${analysisId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data as any;
      setAnalysis(data);
      if (data.results) {
        setResults(typeof data.results === 'string' 
          ? JSON.parse(data.results) 
          : data.results
        );
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load analysis:', error);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading analysis...</div>;
  }

  if (!analysis) {
    return <div className="error">Analysis not found</div>;
  }

  const renderStatus = () => {
    if (analysis.status === 'processing' || analysis.status === 'queued') {
      return (
        <div className="status-banner status-processing">
          <div className="spinner"></div>
          <span>Analysis in progress... This may take a few minutes.</span>
        </div>
      );
    }
    if (analysis.status === 'failed') {
      return (
        <div className="status-banner status-failed">
          <span>❌ Analysis failed: {analysis.error}</span>
        </div>
      );
    }
    return null;
  };

  const renderOverview = () => (
    <div className="section">
      <h2>Architecture Overview</h2>
      {results?.architecture && (
        <div className="architecture-card">
          <div className="info-row">
            <strong>Type:</strong> {results.architecture.type}
          </div>
          <div className="info-row">
            <strong>Description:</strong> {results.architecture.description}
          </div>
          {results.architecture.components && (
            <div className="info-row">
              <strong>Components:</strong>
              <ul>
                {results.architecture.components.map((comp: string, idx: number) => (
                  <li key={idx}>{comp}</li>
                ))}
              </ul>
            </div>
          )}
          {results.architecture.patterns && (
            <div className="info-row">
              <strong>Patterns:</strong>
              <div className="tags">
                {results.architecture.patterns.map((pattern: string, idx: number) => (
                  <span key={idx} className="tag">{pattern}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <h2>Tech Stack</h2>
      {results?.techStack && (
        <div className="tech-stack-grid">
          {results.techStack.languages && results.techStack.languages.length > 0 && (
            <div className="tech-category">
              <h3>Languages</h3>
              <div className="tags">
                {results.techStack.languages.map((lang: string, idx: number) => (
                  <span key={idx} className="tag tag-language">{lang}</span>
                ))}
              </div>
            </div>
          )}
          {results.techStack.frameworks && results.techStack.frameworks.length > 0 && (
            <div className="tech-category">
              <h3>Frameworks</h3>
              <div className="tags">
                {results.techStack.frameworks.map((fw: string, idx: number) => (
                  <span key={idx} className="tag tag-framework">{fw}</span>
                ))}
              </div>
            </div>
          )}
          {results.techStack.tools && results.techStack.tools.length > 0 && (
            <div className="tech-category">
              <h3>Tools</h3>
              <div className="tags">
                {results.techStack.tools.map((tool: string, idx: number) => (
                  <span key={idx} className="tag tag-tool">{tool}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderFeatures = () => (
    <div className="section">
      <h2>Features & Locations</h2>
      <div className="features-list">
        {results?.features && results.features.length > 0 ? (
          results.features.map((feature: any, idx: number) => (
            <div key={idx} className="feature-card">
              <h3>{feature.name}</h3>
              <p className="feature-location">📍 {feature.location}</p>
              <p>{feature.description}</p>
            </div>
          ))
        ) : (
          <p>No features identified yet.</p>
        )}
      </div>
    </div>
  );

  const renderOnboarding = () => (
    <div className="section">
      <h2>Onboarding Guide</h2>
      {results?.onboardingGuide && (
        <>
          <div className="onboarding-steps">
            <h3>Steps to Get Started</h3>
            <ol>
              {results.onboardingGuide.steps?.map((step: string, idx: number) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
          
          {results.onboardingGuide.tipsForNewDevs && results.onboardingGuide.tipsForNewDevs.length > 0 && (
            <div className="tips-section">
              <h3>💡 Tips for New Developers</h3>
              <ul>
                {results.onboardingGuide.tipsForNewDevs.map((tip: string, idx: number) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {results?.confusionPoints && results.confusionPoints.length > 0 && (
        <div className="confusion-points">
          <h3>⚠️ Potential Confusion Points</h3>
          {results.confusionPoints.map((point: any, idx: number) => (
            <div key={idx} className="confusion-card">
              <h4>{point.area}</h4>
              <p><strong>Why confusing:</strong> {point.explanation}</p>
              <p><strong>Clarification:</strong> {point.clarification}</p>
            </div>
          ))}
        </div>
      )}

      {results?.recommendations && results.recommendations.length > 0 && (
        <div className="recommendations">
          <h3>📋 Recommendations</h3>
          <ul>
            {results.recommendations.map((rec: string, idx: number) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const renderDataFlow = () => (
    <div className="section">
      <h2>Data Flow</h2>
      {results?.dataFlow && (
        <>
          <p className="dataflow-description">{results.dataFlow.description}</p>
          {results.dataFlow.keyPaths && results.dataFlow.keyPaths.length > 0 && (
            <div className="dataflow-paths">
              <h3>Key Paths</h3>
              {results.dataFlow.keyPaths.map((path: string, idx: number) => (
                <div key={idx} className="path-item">
                  {path}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="analysis-view">
      <div className="analysis-container">
        <header className="analysis-header">
          <button className="btn-back" onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </button>
          <h1>Analysis Results</h1>
        </header>

        {renderStatus()}

        {analysis.status === 'completed' && results && (
          <>
            <nav className="tabs">
              <button 
                className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button 
                className={`tab ${activeTab === 'features' ? 'active' : ''}`}
                onClick={() => setActiveTab('features')}
              >
                Features
              </button>
              <button 
                className={`tab ${activeTab === 'onboarding' ? 'active' : ''}`}
                onClick={() => setActiveTab('onboarding')}
              >
                Onboarding
              </button>
              <button 
                className={`tab ${activeTab === 'dataflow' ? 'active' : ''}`}
                onClick={() => setActiveTab('dataflow')}
              >
                Data Flow
              </button>
            </nav>

            <div className="tab-content">
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'features' && renderFeatures()}
              {activeTab === 'onboarding' && renderOnboarding()}
              {activeTab === 'dataflow' && renderDataFlow()}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AnalysisView;
