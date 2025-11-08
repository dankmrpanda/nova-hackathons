import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import RepositorySelector from './components/RepositorySelector';
import AnalysisView from './components/AnalysisView';
import PublicAnalysisView from './components/PublicAnalysisView';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('auth_token');
    setIsAuthenticated(!!token);

    // Handle OAuth callback with token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const userFromUrl = urlParams.get('user');
    const errorFromUrl = urlParams.get('error');

    if (tokenFromUrl && userFromUrl) {
      localStorage.setItem('auth_token', tokenFromUrl);
      localStorage.setItem('user', userFromUrl);
      setIsAuthenticated(true);
      
      // Clean URL and redirect to dashboard
      window.history.replaceState({}, document.title, '/dashboard');
      window.location.href = '/dashboard';
    } else if (errorFromUrl) {
      alert('Authentication failed. Please try again.');
      window.history.replaceState({}, document.title, '/');
    }
  }, []);

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/public-analysis" element={<PublicAnalysisView />} />
          <Route 
            path="/dashboard" 
            element={isAuthenticated ? <Dashboard /> : <Navigate to="/" />} 
          />
          <Route 
            path="/select-repo" 
            element={isAuthenticated ? <RepositorySelector /> : <Navigate to="/" />} 
          />
          <Route 
            path="/analysis/:analysisId" 
            element={isAuthenticated ? <AnalysisView /> : <Navigate to="/" />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
