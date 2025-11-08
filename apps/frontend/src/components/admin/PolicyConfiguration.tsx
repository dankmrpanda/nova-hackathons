import React, { useState } from 'react';
import './admin.css';

export const PolicyConfiguration: React.FC = () => {
  const [selectedTenant, setSelectedTenant] = useState('');

  return (
    <div className="policy-configuration">
      <h2>Policy Configuration</h2>

      <div className="policy-section">
        <label htmlFor="tenant-select">Select Tenant:</label>
        <select
          id="tenant-select"
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
          className="tenant-select"
        >
          <option value="">-- Select Tenant --</option>
        </select>
      </div>

      <div className="policy-section">
        <h3>Model Allowlist</h3>
        <p className="section-description">
          Configure which AI models are allowed for this tenant
        </p>
        <div className="model-list">
          <label>
            <input type="checkbox" /> GPT-4
          </label>
          <label>
            <input type="checkbox" /> GPT-3.5 Turbo
          </label>
          <label>
            <input type="checkbox" /> Claude 3
          </label>
        </div>
      </div>

      <div className="policy-section">
        <h3>Cost Limits</h3>
        <div className="form-group">
          <label htmlFor="session-cost-limit">Max Session Cost ($):</label>
          <input
            id="session-cost-limit"
            type="number"
            step="0.01"
            defaultValue="5.00"
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label htmlFor="monthly-cost-limit">Monthly Cost Limit ($):</label>
          <input
            id="monthly-cost-limit"
            type="number"
            step="1"
            defaultValue="1000"
            className="form-input"
          />
        </div>
      </div>

      <div className="policy-section">
        <h3>Data Retention</h3>
        <div className="form-group">
          <label htmlFor="audio-retention">Audio Retention (days):</label>
          <input
            id="audio-retention"
            type="number"
            defaultValue="1"
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label htmlFor="transcript-retention">Transcript Retention (days):</label>
          <input
            id="transcript-retention"
            type="number"
            defaultValue="365"
            className="form-input"
          />
        </div>
      </div>

      <div className="policy-actions">
        <button className="btn-secondary">Reset</button>
        <button className="btn-primary">Save Changes</button>
      </div>
    </div>
  );
};
