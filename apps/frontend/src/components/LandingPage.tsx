import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleGitHubLogin = async () => {
    setIsLoading(true);
    // Redirect to GitHub OAuth
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
    const redirectUri = `${window.location.origin}/auth/github/callback`;
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo`;
  };

  const handlePublicRepoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const repoUrl = formData.get('repoUrl') as string;

    if (!repoUrl) return;

    setIsLoading(true);
    try {
      const response = await axios.post('/api/github/analyze-public', { repoUrl });
      console.log('Analysis response:', response.data);
      
      // Store temporary data and navigate to public analysis view
      localStorage.setItem('temp_repo_data', JSON.stringify(response.data));
      localStorage.setItem('public_repo_analysis', 'true');
      navigate('/public-analysis');
    } catch (error) {
      console.error('Failed to analyze repository:', error);
      alert('Failed to analyze repository. Please check the URL and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="landing-page">
      <div className="landing-container">
        <header className="landing-header">
          <div className="logo">
            <span className="logo-icon">🧭</span>
            <h1>CodeMap</h1>
          </div>
          <p className="tagline">AI-Powered Codebase Onboarding</p>
        </header>

        <div className="hero-section">
          <h2>Understand Any Codebase in Minutes</h2>
          <p className="hero-description">
            Interactive AI agent that walks you through architecture, features, and data flow.
            Get visual diagrams and animated explanations.
          </p>

          <div className="cta-cards">
            <div className="cta-card">
              <h3>Connect GitHub</h3>
              <p>Access your private repositories and get personalized insights</p>
              <button 
                className="btn btn-primary"
                onClick={handleGitHubLogin}
                disabled={isLoading}
              >
                <svg className="github-icon" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                </svg>
                Connect GitHub Account
              </button>
            </div>

            <div className="divider">
              <span>or</span>
            </div>

            <div className="cta-card">
              <h3>Analyze Public Repo</h3>
              <p>Paste any public GitHub repository URL</p>
              <form onSubmit={handlePublicRepoSubmit} className="public-repo-form">
                <input
                  type="text"
                  name="repoUrl"
                  placeholder="https://github.com/owner/repo"
                  className="input-field"
                  disabled={isLoading}
                />
                <button 
                  type="submit" 
                  className="btn btn-secondary"
                  disabled={isLoading}
                >
                  {isLoading ? 'Analyzing...' : 'Analyze Repository'}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="features-section">
          <div className="feature">
            <span className="feature-icon">🔍</span>
            <h4>Deep Code Analysis</h4>
            <p>AST parsing and intelligent pattern recognition</p>
          </div>
          <div className="feature">
            <span className="feature-icon">🎬</span>
            <h4>Visual Animations</h4>
            <p>Animated walkthroughs of architecture and data flow</p>
          </div>
          <div className="feature">
            <span className="feature-icon">🤖</span>
            <h4>AI-Powered Insights</h4>
            <p>Claude, GPT-4, and more via OpenRouter</p>
          </div>
          <div className="feature">
            <span className="feature-icon">📚</span>
            <h4>Interactive Learning</h4>
            <p>Remembers what you've learned and tracks confusion points</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
