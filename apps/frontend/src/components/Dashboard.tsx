import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';

interface Analysis {
  id: string;
  repository_name: string;
  repository_owner: string;
  status: string;
  created_at: string;
  model_provider: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalyses();
  }, []);

  const loadAnalyses = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get('/api/analysis/list', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data as any;
      setAnalyses(data.analyses);
    } catch (error) {
      console.error('Failed to load analyses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewAnalysis = () => {
    navigate('/select-repo');
  };

  const handleViewAnalysis = (analysisId: string) => {
    navigate(`/analysis/${analysisId}`);
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      completed: 'status-badge status-completed',
      processing: 'status-badge status-processing',
      queued: 'status-badge status-queued',
      failed: 'status-badge status-failed',
      cancelled: 'status-badge status-cancelled',
    };
    return statusClasses[status as keyof typeof statusClasses] || 'status-badge';
  };

  return (
    <div className="dashboard">
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="header-content">
            <h1>Your Analyses</h1>
            <button className="btn btn-primary" onClick={handleNewAnalysis}>
              + New Analysis
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="loading">Loading...</div>
        ) : analyses.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📁</span>
            <h2>No analyses yet</h2>
            <p>Start by analyzing your first repository</p>
            <button className="btn btn-primary" onClick={handleNewAnalysis}>
              Get Started
            </button>
          </div>
        ) : (
          <div className="analyses-grid">
            {analyses.map((analysis) => (
              <div 
                key={analysis.id} 
                className="analysis-card"
                onClick={() => handleViewAnalysis(analysis.id)}
              >
                <div className="card-header">
                  <h3>{analysis.repository_name}</h3>
                  <span className={getStatusBadge(analysis.status)}>
                    {analysis.status}
                  </span>
                </div>
                <p className="repo-owner">{analysis.repository_owner}</p>
                <div className="card-footer">
                  <span className="model-badge">{analysis.model_provider.split('/').pop()}</span>
                  <span className="date">{new Date(analysis.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
