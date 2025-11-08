import React from 'react';
import type { SessionStatus } from '@codebase-onboarding/shared';
import './monitoring.css';

interface SessionProgressProps {
  sessionId: string;
  status: SessionStatus;
  progress: number;
  startedAt?: Date;
  estimatedCompletion?: Date;
}

export const SessionProgress: React.FC<SessionProgressProps> = ({
  sessionId: _sessionId,
  status,
  progress,
  startedAt,
  estimatedCompletion,
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'initializing':
        return '🔄';
      case 'analyzing':
        return '⚙️';
      case 'paused':
        return '⏸️';
      case 'completed':
        return '✅';
      case 'terminated':
        return '⏹️';
      default:
        return '❓';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return '#5cb85c';
      case 'analyzing':
        return '#6a9fb5';
      case 'paused':
        return '#ffc107';
      case 'terminated':
        return '#d9534f';
      default:
        return '#808080';
    }
  };

  const formatDuration = (start: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(start).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="session-progress">
      <div className="progress-header">
        <div className="progress-status">
          <span className="status-icon" aria-hidden="true">
            {getStatusIcon()}
          </span>
          <span className="status-text" style={{ color: getStatusColor() }}>
            {status}
          </span>
        </div>
        {startedAt && (
          <div className="progress-duration">
            Duration: {formatDuration(startedAt)}
          </div>
        )}
      </div>

      <div className="progress-bar-container">
        <div
          className="progress-bar"
          style={{
            width: `${progress}%`,
            backgroundColor: getStatusColor(),
          }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Session progress: ${progress}%`}
        />
      </div>

      <div className="progress-info">
        <span className="progress-percentage">{progress}% complete</span>
        {estimatedCompletion && status === 'analyzing' && (
          <span className="progress-eta">
            ETA: {new Date(estimatedCompletion).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
};
