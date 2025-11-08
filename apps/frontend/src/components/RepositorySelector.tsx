import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './RepositorySelector.css';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  language: string;
  stargazers_count: number;
}

interface ModelProvider {
  provider_key: string;
  display_name: string;
  description: string;
}

const RepositorySelector = () => {
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [modelProviders, setModelProviders] = useState<ModelProvider[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [includeAnimation, setIncludeAnimation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      // Load repositories
      const repoResponse = await axios.get('/api/github/repositories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const repoData = repoResponse.data as any;
      setRepositories(repoData.repositories);

      // Load model providers
      setModelProviders([
        { provider_key: 'openrouter/anthropic/claude-3.5-sonnet', display_name: 'Claude 3.5 Sonnet', description: 'Most intelligent' },
        { provider_key: 'openrouter/anthropic/claude-3-opus', display_name: 'Claude 3 Opus', description: 'Best for complex analysis' },
        { provider_key: 'openrouter/openai/gpt-4o', display_name: 'GPT-4o', description: 'Optimized GPT-4' },
        { provider_key: 'openrouter/meta-llama/llama-3.1-405b', display_name: 'Llama 3.1 405B', description: 'Open source' },
      ]);
      setSelectedModel('openrouter/anthropic/claude-3.5-sonnet');
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!selectedRepo || !selectedModel) return;

    setIsAnalyzing(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(
        '/api/analysis/analyze',
        {
          repositoryId: selectedRepo,
          modelProvider: selectedModel,
          includeAnimation,
          selectedPaths: [],
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const data = response.data as any;
      navigate(`/analysis/${data.analysisId}`);
    } catch (error) {
      console.error('Failed to start analysis:', error);
      alert('Failed to start analysis. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading repositories...</div>;
  }

  return (
    <div className="repository-selector">
      <div className="selector-container">
        <header className="selector-header">
          <h1>Select Repository to Analyze</h1>
          <button className="btn-back" onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </button>
        </header>

        <div className="selection-grid">
          <div className="selection-section">
            <h2>Choose Repository</h2>
            <div className="repo-list">
              {repositories.map((repo) => (
                <div
                  key={repo.id}
                  className={`repo-card ${selectedRepo === repo.id.toString() ? 'selected' : ''}`}
                  onClick={() => setSelectedRepo(repo.id.toString())}
                >
                  <h3>{repo.name}</h3>
                  <p className="repo-description">{repo.description || 'No description'}</p>
                  <div className="repo-meta">
                    {repo.language && <span className="language-badge">{repo.language}</span>}
                    <span className="stars">⭐ {repo.stargazers_count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="selection-section">
            <h2>Choose AI Model</h2>
            <div className="model-list">
              {modelProviders.map((model) => (
                <div
                  key={model.provider_key}
                  className={`model-card ${selectedModel === model.provider_key ? 'selected' : ''}`}
                  onClick={() => setSelectedModel(model.provider_key)}
                >
                  <h3>{model.display_name}</h3>
                  <p>{model.description}</p>
                </div>
              ))}
            </div>

            <div className="options-section">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includeAnimation}
                  onChange={(e) => setIncludeAnimation(e.target.checked)}
                />
                <span>Generate animated walkthrough (takes longer)</span>
              </label>
            </div>

            <button
              className="btn btn-primary btn-analyze"
              onClick={handleStartAnalysis}
              disabled={!selectedRepo || !selectedModel || isAnalyzing}
            >
              {isAnalyzing ? 'Starting Analysis...' : 'Start Analysis'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RepositorySelector;
