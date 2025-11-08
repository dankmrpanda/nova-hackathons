import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './RepositorySelector.css';
import './PublicAnalysisView.css';

interface AnalysisData {
  owner: string;
  repo: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  openIssues: number;
  fileCount: number;
  aiSummary?: {
    overview: string;
    architecture: string;
    keyTechnologies: string[];
    projectStructure: string;
    entryPoints: string[];
    buildTools: string[];
    suggestedOnboardingPath: string[];
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const PublicAnalysisView = () => {
  const navigate = useNavigate();
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load the analysis data from localStorage
    const tempData = localStorage.getItem('temp_repo_data');
    if (tempData) {
      try {
        const data = JSON.parse(tempData);
        console.log('Loaded analysis data:', data);
        setAnalysisData(data);
      } catch (error) {
        console.error('Failed to parse analysis data:', error);
        alert('Failed to load analysis results');
        navigate('/');
      }
    } else {
      alert('No analysis data found. Please analyze a repository first.');
      navigate('/');
    }
    setIsLoading(false);
  }, [navigate]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isSending || !analysisData) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);

    try {
      // Generate AI response based on the question and analysis data
      const aiResponse = generateAIResponse(message, analysisData);
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to get AI response:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: "I'm sorry, I encountered an error processing your question. Please try again.",
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const generateAIResponse = (question: string, data: AnalysisData): string => {
    const questionLower = question.toLowerCase();

    // Main purpose
    if (questionLower.includes('purpose') || questionLower.includes('what is') || questionLower.includes('about')) {
      return `${data.owner}/${data.repo} is ${data.description || 'a software project'}. ${data.aiSummary?.overview || ''}`;
    }

    // Getting started
    if (questionLower.includes('get started') || questionLower.includes('start') || questionLower.includes('setup') || questionLower.includes('begin')) {
      const buildTools = data.aiSummary?.buildTools || [];
      const onboarding = data.aiSummary?.suggestedOnboardingPath || [];
      return `To get started with ${data.repo}:\n\n${onboarding.slice(0, 4).join('\n\n')}\n\nBuild tools: ${buildTools.join(', ') || 'Check the repository for setup instructions'}`;
    }

    // Key files
    if (questionLower.includes('key files') || questionLower.includes('important files') || questionLower.includes('where to look')) {
      const entryPoints = data.aiSummary?.entryPoints || [];
      return `Key files to examine in ${data.repo}:\n\n${entryPoints.map(file => `• ${file}`).join('\n')}\n\nThese entry points will help you understand the core functionality.`;
    }

    // Testing
    if (questionLower.includes('test') || questionLower.includes('testing framework')) {
      const tech = data.aiSummary?.keyTechnologies || [];
      const testFrameworks = tech.filter(t => 
        t.toLowerCase().includes('jest') || 
        t.toLowerCase().includes('test') || 
        t.toLowerCase().includes('mocha') ||
        t.toLowerCase().includes('pytest')
      );
      return testFrameworks.length > 0 
        ? `This project uses ${testFrameworks.join(', ')} for testing. Check the test files in the repository to see examples.`
        : `Testing framework information is not explicitly available in the analysis. Check package.json or requirements.txt for testing dependencies.`;
    }

    // Project structure
    if (questionLower.includes('structure') || questionLower.includes('organized') || questionLower.includes('architecture')) {
      return `${data.repo} Architecture:\n\n${data.aiSummary?.architecture || 'Architecture pattern not detected'}\n\nProject Structure:\n${data.aiSummary?.projectStructure || 'See the file tree for detailed organization'}`;
    }

    // Technologies
    if (questionLower.includes('technolog') || questionLower.includes('stack') || questionLower.includes('built with')) {
      const tech = data.aiSummary?.keyTechnologies || [];
      return `${data.repo} uses the following technologies:\n\n${tech.map(t => `• ${t}`).join('\n')}\n\nPrimary language: ${data.language}`;
    }

    // Default response
    return `Based on the repository analysis:\n\n${data.aiSummary?.overview || data.description}\n\nThe project has ${data.fileCount} files and uses ${data.language} as the primary language. Feel free to ask more specific questions about the architecture, technologies, or how to get started!`;
  };

  const handleSuggestionClick = (question: string) => {
    handleSendMessage(question);
  };

  const handleBackToHome = () => {
    localStorage.removeItem('temp_repo_data');
    localStorage.removeItem('public_repo_analysis');
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="repository-selector">
        <div className="selector-container">
          <div className="loading">
            <h2>Analyzing Repository...</h2>
            <p>AI is examining the codebase structure</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="repository-selector">
        <div className="selector-container">
          <div className="error">
            <h2>❌ No Analysis Data</h2>
            <p>Please go back and analyze a repository first.</p>
            <button className="btn-primary" onClick={handleBackToHome}>
              Go Back Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="repository-selector">
      <div className="selector-container">
        <header className="selector-header">
          <h1>Repository Analysis Results</h1>
          <button className="back-button" onClick={handleBackToHome}>
            ← Back to Home
          </button>
        </header>

        <div className="analysis-results">
          <div className="repo-header">
            <h2>{analysisData.owner}/{analysisData.repo}</h2>
            {analysisData.description && (
              <p className="repo-description">{analysisData.description}</p>
            )}
          </div>

          <div className="repo-stats">
            <div className="stat">
              <span className="stat-label">Primary Language</span>
              <span className="stat-value">{analysisData.language || 'N/A'}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Stars</span>
              <span className="stat-value">⭐ {analysisData.stars.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Forks</span>
              <span className="stat-value">🍴 {analysisData.forks.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Open Issues</span>
              <span className="stat-value">🐛 {analysisData.openIssues.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Total Files</span>
              <span className="stat-value">📁 {analysisData.fileCount.toLocaleString()}</span>
            </div>
          </div>

          {analysisData.aiSummary && (
            <div className="ai-summary">
              <h3>🤖 AI-Powered Analysis</h3>
              
              {analysisData.aiSummary.overview && (
                <section className="summary-section">
                  <h4>📋 Overview</h4>
                  <p>{analysisData.aiSummary.overview}</p>
                </section>
              )}

              {analysisData.aiSummary.architecture && (
                <section className="summary-section">
                  <h4>🏗️ Architecture</h4>
                  <p>{analysisData.aiSummary.architecture}</p>
                </section>
              )}

              {analysisData.aiSummary.keyTechnologies && analysisData.aiSummary.keyTechnologies.length > 0 && (
                <section className="summary-section">
                  <h4>💻 Key Technologies</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {analysisData.aiSummary.keyTechnologies.map((tech, idx) => (
                      <span key={idx} className="tech-badge">{tech}</span>
                    ))}
                  </div>
                </section>
              )}

              {analysisData.aiSummary.entryPoints && analysisData.aiSummary.entryPoints.length > 0 && (
                <section className="summary-section">
                  <h4>🚪 Entry Points</h4>
                  <ul>
                    {analysisData.aiSummary.entryPoints.map((point, idx) => (
                      <li key={idx}><code>{point}</code></li>
                    ))}
                  </ul>
                </section>
              )}

              {analysisData.aiSummary.buildTools && analysisData.aiSummary.buildTools.length > 0 && (
                <section className="summary-section">
                  <h4>🔧 Build Tools</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {analysisData.aiSummary.buildTools.map((tool, idx) => (
                      <span key={idx} className="tech-badge">{tool}</span>
                    ))}
                  </div>
                </section>
              )}

              {analysisData.aiSummary.projectStructure && (
                <section className="summary-section">
                  <h4>📁 Project Structure</h4>
                  <pre className="code-block">{analysisData.aiSummary.projectStructure}</pre>
                </section>
              )}

              {analysisData.aiSummary.suggestedOnboardingPath && analysisData.aiSummary.suggestedOnboardingPath.length > 0 && (
                <section className="summary-section">
                  <h4>🗺️ Suggested Onboarding Path</h4>
                  <ol className="onboarding-steps">
                    {analysisData.aiSummary.suggestedOnboardingPath.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          )}

          <div className="ai-chat-section">
            <div className="chat-header">
              <div className="chat-icon">💬</div>
              <h3>Ask About This Repository</h3>
              <p className="chat-subtitle">Get instant answers about the codebase</p>
            </div>

            <div className="chat-messages-container">
              <div className="ai-assistant-intro">
                <div className="assistant-avatar">🤖</div>
                <div className="assistant-message">
                  <p>Hi! I'm your AI assistant for {analysisData.owner}/{analysisData.repo}. I can help you understand the codebase, architecture, and answer any questions about this repository. What would you like to know?</p>
                  <span className="message-time">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.role}`}>
                  <div className={`message-avatar ${msg.role}`}>
                    {msg.role === 'user' ? '👤' : '🤖'}
                  </div>
                  <div className="message-content">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                    <span className="message-time">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {chatMessages.length === 0 && (
              <div className="suggested-questions">
                <p className="suggestions-label">Suggested questions:</p>
                <button className="suggestion-btn" onClick={() => handleSuggestionClick('What is the main purpose of this project?')}>
                  What is the main purpose of this project?
                </button>
                <button className="suggestion-btn" onClick={() => handleSuggestionClick('How do I get started with development?')}>
                  How do I get started with development?
                </button>
                <button className="suggestion-btn" onClick={() => handleSuggestionClick('What are the key files I should look at first?')}>
                  What are the key files I should look at first?
                </button>
                <button className="suggestion-btn" onClick={() => handleSuggestionClick('What testing framework does this project use?')}>
                  What testing framework does this project use?
                </button>
                <button className="suggestion-btn" onClick={() => handleSuggestionClick('How is the project structured?')}>
                  How is the project structured?
                </button>
              </div>
            )}

            <div className="chat-input-area">
              <input 
                type="text" 
                placeholder="Ask a question about this repository..." 
                className="chat-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(inputValue);
                  }
                }}
                disabled={isSending}
              />
              <button 
                className="send-btn"
                onClick={() => handleSendMessage(inputValue)}
                disabled={isSending || !inputValue.trim()}
              >
                <span>{isSending ? 'Sending...' : 'Send'}</span>
                <span className="send-icon">→</span>
              </button>
            </div>
          </div>

          <div className="next-steps">
            <h3>What's Next?</h3>
            <p>To get interactive AI-powered onboarding with voice guidance and animated diagrams, connect your GitHub account.</p>
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/')}
            >
              Connect GitHub for Full Features
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicAnalysisView;
