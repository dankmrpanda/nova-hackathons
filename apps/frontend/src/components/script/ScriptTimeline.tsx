import React from 'react';
import type { ScriptSection } from '@codebase-onboarding/shared';
import './script.css';

interface ScriptTimelineProps {
  sections: ScriptSection[];
  currentSectionId: string;
  currentTimestamp: number;
  totalDuration: number;
  onSeek: (timestamp: number) => void;
  onJumpToSection: (sectionId: string) => void;
}

export const ScriptTimeline: React.FC<ScriptTimelineProps> = ({
  sections,
  currentSectionId,
  currentTimestamp,
  totalDuration,
  onSeek: _onSeek,
  onJumpToSection,
}) => {
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="script-timeline">
      <div className="timeline-sections">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onJumpToSection(section.id)}
            className={`timeline-section ${section.id === currentSectionId ? 'active' : ''}`}
            title={section.title}
          >
            {section.order + 1}
          </button>
        ))}
      </div>
      <div className="timeline-time">
        <span>{formatTime(currentTimestamp)}</span>
        <span>/</span>
        <span>{formatTime(totalDuration)}</span>
      </div>
    </div>
  );
};
