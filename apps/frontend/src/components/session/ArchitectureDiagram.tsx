import React from 'react';
import type { ArchitecturePattern } from '@codebase-onboarding/shared';
import './session.css';

interface ArchitectureDiagramProps {
  pattern: ArchitecturePattern;
}

export const ArchitectureDiagram: React.FC<ArchitectureDiagramProps> = ({ pattern }) => {
  return (
    <div className="architecture-diagram">
      <div className="diagram-header">
        <h3>{pattern.type} Architecture</h3>
        <span className="confidence-badge">
          {Math.round(pattern.confidence * 100)}% confidence
        </span>
      </div>

      <div className="diagram-explanation">
        <p>{pattern.explanation}</p>
      </div>

      <div className="diagram-content">
        <div className="components-section">
          <h4>Components</h4>
          <div className="components-grid">
            {pattern.components.map((component, index) => (
              <div key={index} className="component-card">
                <div className="component-header">
                  <span className="component-name">{component.name}</span>
                  <span className="component-type">{component.type}</span>
                </div>
                <div className="component-responsibilities">
                  {component.responsibilities.map((resp, idx) => (
                    <div key={idx} className="responsibility">
                      • {resp}
                    </div>
                  ))}
                </div>
                <div className="component-files">
                  <span className="files-label">Files:</span>
                  <span className="files-count">{component.files.length}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relationships-section">
          <h4>Relationships</h4>
          <div className="relationships-list">
            {pattern.relationships.map((rel, index) => (
              <div key={index} className="relationship-item">
                <div className="relationship-flow">
                  <span className="relationship-from">{rel.from}</span>
                  <span className="relationship-arrow">
                    {rel.type === 'depends-on' && '→'}
                    {rel.type === 'calls' && '⇒'}
                    {rel.type === 'imports' && '⊂'}
                    {rel.type === 'extends' && '↑'}
                    {rel.type === 'implements' && '⊙'}
                  </span>
                  <span className="relationship-to">{rel.to}</span>
                </div>
                <div className="relationship-type">{rel.type}</div>
                <div className="relationship-description">{rel.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
