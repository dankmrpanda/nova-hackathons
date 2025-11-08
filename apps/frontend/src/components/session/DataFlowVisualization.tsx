import React from 'react';
import type { DataFlowPath } from '@codebase-onboarding/shared';
import './session.css';

interface DataFlowVisualizationProps {
  dataFlow: DataFlowPath;
}

export const DataFlowVisualization: React.FC<DataFlowVisualizationProps> = ({ dataFlow }) => {
  return (
    <div className="dataflow-visualization">
      <div className="dataflow-header">
        <h3>Data Flow Analysis</h3>
        <span className="depth-badge">Depth: {dataFlow.depth}</span>
      </div>

      <div className="dataflow-entry">
        <h4>Entry Point</h4>
        <div className="code-location">
          <span className="location-file">{dataFlow.entryPoint.file}</span>
          <span className="location-lines">
            Lines {dataFlow.entryPoint.startLine}-{dataFlow.entryPoint.endLine}
          </span>
        </div>
      </div>

      <div className="dataflow-steps">
        <h4>Data Transformations</h4>
        <div className="steps-timeline">
          {dataFlow.steps.map((step, index) => (
            <div key={index} className="flow-step">
              <div className="step-number">{index + 1}</div>
              <div className="step-content">
                <div className="step-operation">{step.operation}</div>
                <div className="step-location">
                  <span className="location-file">{step.location.file}</span>
                  <span className="location-lines">
                    Line {step.location.startLine}
                  </span>
                </div>
                {step.transformation && (
                  <div className="step-transformation">
                    Transform: {step.transformation}
                  </div>
                )}
                <div className="step-data">
                  {step.dataIn.length > 0 && (
                    <div className="data-in">
                      <span className="data-label">In:</span>
                      {step.dataIn.map((data, idx) => (
                        <span key={idx} className="data-item">
                          {data}
                        </span>
                      ))}
                    </div>
                  )}
                  {step.dataOut.length > 0 && (
                    <div className="data-out">
                      <span className="data-label">Out:</span>
                      {step.dataOut.map((data, idx) => (
                        <span key={idx} className="data-item">
                          {data}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {index < dataFlow.steps.length - 1 && (
                <div className="step-connector">↓</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {dataFlow.dataStructures.length > 0 && (
        <div className="dataflow-structures">
          <h4>Data Structures</h4>
          <div className="structures-grid">
            {dataFlow.dataStructures.map((structure, index) => (
              <div key={index} className="structure-card">
                <div className="structure-header">
                  <span className="structure-name">{structure.name}</span>
                  <span className="structure-type">{structure.type}</span>
                </div>
                <div className="structure-fields">
                  {structure.fields.map((field, idx) => (
                    <div key={idx} className="field-item">
                      <span className="field-name">{field.name}</span>
                      <span className="field-type">{field.type}</span>
                      {field.optional && (
                        <span className="field-optional">optional</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
