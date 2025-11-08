import React, { useState, useEffect } from 'react';
import './monitoring.css';

interface TerminationCountdownProps {
  terminationTime: Date;
  reason: string;
  onCancel?: () => void;
}

export const TerminationCountdown: React.FC<TerminationCountdownProps> = ({
  terminationTime,
  reason,
  onCancel,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const target = new Date(terminationTime).getTime();
      const remaining = Math.max(0, target - now);
      setTimeRemaining(remaining);

      if (remaining === 0) {
        // Termination time reached
        return;
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [terminationTime]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  if (timeRemaining === 0) {
    return (
      <div className="termination-countdown terminated" role="alert">
        <div className="countdown-icon">⏹️</div>
        <div className="countdown-content">
          <h4>Session Terminated</h4>
          <p>{reason}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="termination-countdown active" role="alert" aria-live="assertive">
      <div className="countdown-icon">⚠️</div>
      <div className="countdown-content">
        <h4>Session Terminating Soon</h4>
        <p className="countdown-reason">{reason}</p>
        <div className="countdown-timer">{formatTime(timeRemaining)}</div>
        {onCancel && (
          <button onClick={onCancel} className="btn-cancel-termination">
            Cancel Termination
          </button>
        )}
      </div>
    </div>
  );
};
