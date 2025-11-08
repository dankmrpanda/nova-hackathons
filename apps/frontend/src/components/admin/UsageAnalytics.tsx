import React from 'react';
import './admin.css';

export const UsageAnalytics: React.FC = () => {
  return (
    <div className="usage-analytics">
      <h2>Usage & Cost Analytics</h2>

      <div className="analytics-grid">
        <div className="analytics-card">
          <h3>Total Sessions</h3>
          <div className="analytics-value">1,234</div>
          <div className="analytics-change positive">+12% from last month</div>
        </div>

        <div className="analytics-card">
          <h3>Total Cost</h3>
          <div className="analytics-value">$4,567</div>
          <div className="analytics-change negative">+8% from last month</div>
        </div>

        <div className="analytics-card">
          <h3>Active Users</h3>
          <div className="analytics-value">456</div>
          <div className="analytics-change positive">+5% from last month</div>
        </div>

        <div className="analytics-card">
          <h3>Avg Session Cost</h3>
          <div className="analytics-value">$3.70</div>
          <div className="analytics-change neutral">-2% from last month</div>
        </div>
      </div>

      <div className="analytics-section">
        <h3>Cost by Tenant</h3>
        <div className="chart-placeholder">
          <p>Chart visualization would be rendered here</p>
        </div>
      </div>

      <div className="analytics-section">
        <h3>Usage by Service</h3>
        <div className="service-breakdown">
          <div className="service-item">
            <span className="service-name">OpenRouter (LLM)</span>
            <span className="service-cost">$2,345</span>
            <span className="service-percentage">51%</span>
          </div>
          <div className="service-item">
            <span className="service-name">Retell AI (Voice)</span>
            <span className="service-cost">$1,234</span>
            <span className="service-percentage">27%</span>
          </div>
          <div className="service-item">
            <span className="service-name">Modal (Animation)</span>
            <span className="service-cost">$988</span>
            <span className="service-percentage">22%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
