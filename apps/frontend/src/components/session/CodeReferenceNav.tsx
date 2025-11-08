import React, { useState } from 'react';
import type { FeatureLocation } from '@codebase-onboarding/shared';
import './session.css';

interface CodeReferenceNavProps {
  features: FeatureLocation[];
}

export const CodeReferenceNav: React.FC<CodeReferenceNavProps> = ({ features }) => {
  const [selectedFeature, setSelectedFeature] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFeatures = features.filter(
    (feature) =>
      feature.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feature.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feature.functionalArea.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedFeatures = filteredFeatures.reduce((acc, feature) => {
    const area = feature.functionalArea || 'Other';
    if (!acc[area]) {
      acc[area] = [];
    }
    acc[area].push(feature);
    return acc;
  }, {} as Record<string, FeatureLocation[]>);

  return (
    <div className="code-reference-nav">
      <div className="reference-nav-header">
        <h3>Feature Locations</h3>
        <input
          type="search"
          placeholder="Search features..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="feature-search"
          aria-label="Search features"
        />
      </div>

      <div className="reference-nav-content">
        <div className="features-sidebar">
          {Object.entries(groupedFeatures).map(([area, areaFeatures]) => (
            <div key={area} className="feature-group">
              <h4 className="group-title">{area}</h4>
              <ul className="feature-list">
                {areaFeatures.map((feature) => {
                  const globalIndex = features.indexOf(feature);
                  return (
                    <li key={globalIndex}>
                      <button
                        className={`feature-item ${selectedFeature === globalIndex ? 'active' : ''}`}
                        onClick={() => setSelectedFeature(globalIndex)}
                        aria-pressed={selectedFeature === globalIndex}
                      >
                        <span className="feature-name">{feature.name}</span>
                        <span className="feature-files-count">
                          {feature.files.length} file{feature.files.length !== 1 ? 's' : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="feature-details">
          {selectedFeature !== null && features[selectedFeature] ? (
            <div className="feature-detail-content">
              <h3>{features[selectedFeature].name}</h3>
              <p className="feature-description">
                {features[selectedFeature].description}
              </p>

              <div className="feature-section">
                <h4>Entry Points</h4>
                <div className="entry-points-list">
                  {features[selectedFeature].entryPoints.map((entry, index) => (
                    <div key={index} className="entry-point">
                      <span className="entry-file">{entry.file}</span>
                      <span className="entry-lines">
                        Lines {entry.startLine}-{entry.endLine}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="feature-section">
                <h4>Related Files</h4>
                <div className="related-files-list">
                  {features[selectedFeature].files.map((file, index) => (
                    <div key={index} className="related-file">
                      <span className="file-path">{file.path}</span>
                      <div className="file-lines">
                        {file.lineNumbers.map((line, idx) => (
                          <span key={idx} className="line-number">
                            {line}
                          </span>
                        ))}
                      </div>
                      <span className="file-relevance">
                        {Math.round(file.relevance * 100)}% relevant
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {features[selectedFeature].codeSnippets &&
                features[selectedFeature].codeSnippets.length > 0 && (
                  <div className="feature-section">
                    <h4>Code Examples</h4>
                    <div className="code-snippets">
                      {features[selectedFeature].codeSnippets.map((snippet, index) => (
                        <div key={index} className="code-snippet">
                          <div className="snippet-context">{snippet.context}</div>
                          <pre className="snippet-code">{snippet.code}</pre>
                          <div className="snippet-location">
                            {snippet.location.file}:{snippet.location.startLine}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          ) : (
            <div className="no-selection">
              <p>Select a feature to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
