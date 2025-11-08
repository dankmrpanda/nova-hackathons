import React, { useState, useEffect } from 'react';
import type { SessionInfo } from '@codebase-onboarding/shared';
import './auth.css';

interface SessionManagementProps {
  sessions: SessionInfo[];
  currentSessionId: string;
  onRevokeSession: (sessionId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export const SessionManagement: React.FC<SessionManagementProps> = ({
  sessions,
  currentSessionId,
  onRevokeSession,
  onRefresh,
}) => {
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onRefresh();
  }, []);

  const handleRevokeSession = async (sessionId: string) => {
    if (sessionId === currentSessionId) {
      if (!confirm('This will log you out. Continue?')) {
        return;
      }
    }

    setError(null);
    setRevokingSessionId(sessionId);

    try {
      await onRevokeSession(sessionId);
      await onRefresh();
    } catch (err) {
      setError('Failed to revoke session. Please try again.');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const getDeviceInfo = (userAgent: string) => {
    // Simple device detection
    if (userAgent.includes('Mobile')) return '📱 Mobile';
    if (userAgent.includes('Tablet')) return '📱 Tablet';
    return '💻 Desktop';
  };

  return (
    <div className="session-management">
      <div className="session-header">
        <h2>Active Sessions</h2>
        <button onClick={onRefresh} className="btn-secondary btn-small">
          Refresh
        </button>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <div className="sessions-list">
        {sessions.length === 0 ? (
          <p className="no-sessions">No active sessions</p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${session.id === currentSessionId ? 'current' : ''}`}
            >
              <div className="session-info">
                <div className="session-device">
                  {getDeviceInfo(session.metadata.userAgent)}
                  {session.id === currentSessionId && (
                    <span className="current-badge">Current</span>
                  )}
                </div>
                <div className="session-details">
                  <div className="session-location">
                    IP: {session.metadata.ipAddress}
                  </div>
                  <div className="session-time">
                    Created: {formatDate(session.createdAt)}
                  </div>
                  <div className="session-time">
                    Last active: {formatDate(session.lastActivityAt)}
                  </div>
                  <div className="session-time">
                    Expires: {formatDate(session.expiresAt)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRevokeSession(session.id)}
                className="btn-danger btn-small"
                disabled={revokingSessionId === session.id}
                aria-label={`Revoke session from ${session.metadata.ipAddress}`}
              >
                {revokingSessionId === session.id ? 'Revoking...' : 'Revoke'}
              </button>
            </div>
          ))
        )}
      </div>

      <div className="session-footer">
        <p className="session-note">
          Sessions expire after 8 hours of inactivity
        </p>
      </div>
    </div>
  );
};
