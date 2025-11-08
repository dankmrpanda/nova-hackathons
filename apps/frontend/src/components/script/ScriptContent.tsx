import React from 'react';
import type { ScriptSection, Diagram, VoiceTimeline } from '@codebase-onboarding/shared';
import './script.css';

interface ScriptContentProps {
  section?: ScriptSection;
  diagrams: Diagram[];
  voiceTimeline?: VoiceTimeline;
  currentTimestamp: number;
}

export const ScriptContent: React.FC<ScriptContentProps> = ({
  section,
  diagrams,
  voiceTimeline,
  currentTimestamp,
}) => {
  if (!section) {
    return <div className="script-content empty">No content available</div>;
  }

  const sectionDiagrams = diagrams.filter((d) => d.sectionId === section.id);
  const currentVoiceSegment = voiceTimeline?.segments.find(
    (s) => s.timestamp <= currentTimestamp && s.timestamp + s.duration > currentTimestamp
  );

  return (
    <div className="script-content">
      <h3>{section.title}</h3>
      <div className="section-explanation">{section.explanation}</div>

      {section.references.length > 0 && (
        <div className="section-references">
          <h4>Code References</h4>
          <ul>
            {section.references.map((ref, index) => (
              <li key={index}>
                <span className="ref-path">{ref.path}</span>
                <span className="ref-lines">Lines: {ref.lineNumbers.join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sectionDiagrams.length > 0 && (
        <div className="section-diagrams">
          {sectionDiagrams.map((diagram) => (
            <div key={diagram.id} className="diagram-container">
              <h4>{diagram.title}</h4>
              {diagram.type === 'mermaid' ? (
                <pre className="mermaid-code">{diagram.content}</pre>
              ) : (
                <img src={diagram.content} alt={diagram.title} className="diagram-image" />
              )}
            </div>
          ))}
        </div>
      )}

      {currentVoiceSegment && (
        <div className="current-voice-segment">
          <div className="voice-speaker">
            {currentVoiceSegment.speaker === 'agent' ? '🤖' : '👤'}
          </div>
          <div className="voice-text">{currentVoiceSegment.text}</div>
        </div>
      )}
    </div>
  );
};
