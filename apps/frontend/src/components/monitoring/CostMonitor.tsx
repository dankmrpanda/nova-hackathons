import React, { useState, useEffect } from 'react';
import './monitoring.css';

interface CostMonitorProps {
  sessionId: string;
  currentCost: number;
  costLimit: number;
  onRefresh: () => void;
}

export const CostMonitor: React.FC<CostMonitorProps> = ({
  sessionId: _sessionId,
  currentCost,
  costLimit,
  onRefresh,
}) => {
  const [showWarning, setShowWarning] = useState(false);
  const [showCritical, setShowCritical] = useState(false);

  const percentage = (currentCost / costLimit) * 100;
  const warningThreshold = 90;

  useEffect(() => {
    if (percentage >= warningThreshold && percentage < 100) {
      setShowWarning(true);
      setShowCritical(false);
    } else if (percentage >= 100) {
      setShowWarning(false);
      setShowCritical(true);
    } else {
      setShowWarning(false);
      setShowCritical(false);
    }
  }, [percentage]);

  const getStatusColor = () => {
    if (percentage >= 100) return '#d9534f';
    if (percentage >= warningThreshold) return '#ffc107';
    return '#5cb85c';
  };

  return (
    <div className="cost-monitor">
      <div className="cost-monitor-header">
        <h4>Session Cost</h4>
        <button onClick={onRefresh} className="btn-refresh" aria-label="Refresh cost">
          🔄
        </button>
      </div>

      <div className="cost-display">
        <div className="cost-current">
          <span className="cost-label">Current:</span>
          <span className="cost-value">${currentCost.toFixed(2)}</span>
        </div>
        <div className="cost-limit">
          <span className="cost-label">Limit:</span>
          <span className="cost-value">${costLimit.toFixed(2)}</span>
        </div>
      </div>

      <div className="cost-progress">
        <div
          className="cost-progress-bar"
          style={{
            width: `${Math.min(percentage, 100)}%`,
            backgroundColor: getStatusColor(),
          }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Cost usage: ${percentage.toFixed(1)}%`}
        />
      </div>

      <div className="cost-percentage">
        {percentage.toFixed(1)}% of limit used
      </div>

      {showWarning && (
        <div className="cost-warning" role="alert">
          <span className="warning-icon">⚠️</span>
          <span>Approaching cost limit ({warningThreshold}%)</span>
        </div>
      )}

      {showCritical && (
        <div className="cost-critical" role="alert">
          <span className="critical-icon">🚨</span>
          <span>Cost limit reached! Session will be terminated.</span>
        </div>
      )}
    </div>
  );
};
