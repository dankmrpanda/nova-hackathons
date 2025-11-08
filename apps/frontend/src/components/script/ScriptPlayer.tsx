import React, { useState, useEffect } from 'react';
import { PlaybackControls } from './PlaybackControls';
import { ScriptTimeline } from './ScriptTimeline';
import { ScriptContent } from './ScriptContent';
import { ScriptAnnotations } from './ScriptAnnotations';
import type { InteractiveScript, PlaybackState, Annotation } from '@codebase-onboarding/shared';
import './script.css';

interface ScriptPlayerProps {
  script: InteractiveScript;
  onExport: (format: string) => void;
}

export const ScriptPlayer: React.FC<ScriptPlayerProps> = ({ script, onExport }) => {
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    scriptId: script.id,
    currentSectionId: script.sections[0]?.id || '',
    currentTimestamp: 0,
    speed: 1.0,
    isPaused: true,
    isComplete: false,
  });

  const [annotations, setAnnotations] = useState<Annotation[]>(script.annotations || []);
  const [showAnnotations, setShowAnnotations] = useState(true);

  useEffect(() => {
    if (!playbackState.isPaused && !playbackState.isComplete) {
      const interval = setInterval(() => {
        setPlaybackState((prev) => {
          const newTimestamp = prev.currentTimestamp + (100 * prev.speed);
          const totalDuration = script.metadata.totalDuration || 0;

          if (newTimestamp >= totalDuration) {
            return { ...prev, currentTimestamp: totalDuration, isPaused: true, isComplete: true };
          }

          // Update current section based on timestamp
          const currentSection = findSectionAtTimestamp(newTimestamp);
          return {
            ...prev,
            currentTimestamp: newTimestamp,
            currentSectionId: currentSection?.id || prev.currentSectionId,
          };
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [playbackState.isPaused, playbackState.speed, playbackState.isComplete, script]);

  const findSectionAtTimestamp = (timestamp: number) => {
    let cumulativeTime = 0;
    for (const section of script.sections) {
      const sectionDuration = section.duration || 0;
      if (timestamp >= cumulativeTime && timestamp < cumulativeTime + sectionDuration) {
        return section;
      }
      cumulativeTime += sectionDuration;
    }
    return script.sections[script.sections.length - 1];
  };

  const handlePlay = () => {
    setPlaybackState((prev) => ({ ...prev, isPaused: false, isComplete: false }));
  };

  const handlePause = () => {
    setPlaybackState((prev) => ({ ...prev, isPaused: true }));
  };

  const handleSeek = (timestamp: number) => {
    const section = findSectionAtTimestamp(timestamp);
    setPlaybackState((prev) => ({
      ...prev,
      currentTimestamp: timestamp,
      currentSectionId: section?.id || prev.currentSectionId,
      isComplete: false,
    }));
  };

  const handleSetSpeed = (speed: number) => {
    setPlaybackState((prev) => ({ ...prev, speed }));
  };

  const handleNextSection = () => {
    const currentIndex = script.sections.findIndex((s) => s.id === playbackState.currentSectionId);
    if (currentIndex < script.sections.length - 1) {
      const nextSection = script.sections[currentIndex + 1];
      setPlaybackState((prev) => ({
        ...prev,
        currentSectionId: nextSection.id,
        currentTimestamp: nextSection.timestamp || 0,
      }));
    }
  };

  const handlePreviousSection = () => {
    const currentIndex = script.sections.findIndex((s) => s.id === playbackState.currentSectionId);
    if (currentIndex > 0) {
      const prevSection = script.sections[currentIndex - 1];
      setPlaybackState((prev) => ({
        ...prev,
        currentSectionId: prevSection.id,
        currentTimestamp: prevSection.timestamp || 0,
      }));
    }
  };

  const handleJumpToSection = (sectionId: string) => {
    const section = script.sections.find((s) => s.id === sectionId);
    if (section) {
      setPlaybackState((prev) => ({
        ...prev,
        currentSectionId: sectionId,
        currentTimestamp: section.timestamp || 0,
        isComplete: false,
      }));
    }
  };

  const handleAddAnnotation = (content: string) => {
    const newAnnotation: Annotation = {
      id: `ann-${Date.now()}`,
      sectionId: playbackState.currentSectionId,
      userId: 'current-user', // Would come from auth context
      content,
      timestamp: playbackState.currentTimestamp,
      createdAt: new Date(),
    };
    setAnnotations((prev) => [...prev, newAnnotation]);
  };

  const currentSection = script.sections.find((s) => s.id === playbackState.currentSectionId);

  return (
    <div className="script-player">
      <div className="script-player-header">
        <h2>{script.metadata.repositoryName}</h2>
        <div className="script-actions">
          <button
            onClick={() => setShowAnnotations(!showAnnotations)}
            className="btn-toggle-annotations"
            aria-pressed={showAnnotations}
          >
            {showAnnotations ? '📝 Hide Notes' : '📝 Show Notes'}
          </button>
          <button onClick={() => onExport('json')} className="btn-export">
            ⬇️ Export
          </button>
        </div>
      </div>

      <div className="script-player-content">
        <div className="script-main">
          <ScriptContent
            section={currentSection}
            diagrams={script.diagrams}
            voiceTimeline={script.voiceTimeline}
            currentTimestamp={playbackState.currentTimestamp}
          />

          <ScriptTimeline
            sections={script.sections}
            currentSectionId={playbackState.currentSectionId}
            currentTimestamp={playbackState.currentTimestamp}
            totalDuration={script.metadata.totalDuration || 0}
            onSeek={handleSeek}
            onJumpToSection={handleJumpToSection}
          />

          <PlaybackControls
            playbackState={playbackState}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
            onSetSpeed={handleSetSpeed}
            onNextSection={handleNextSection}
            onPreviousSection={handlePreviousSection}
          />
        </div>

        {showAnnotations && (
          <div className="script-sidebar">
            <ScriptAnnotations
              annotations={annotations.filter((a) => a.sectionId === playbackState.currentSectionId)}
              onAddAnnotation={handleAddAnnotation}
            />
          </div>
        )}
      </div>
    </div>
  );
};
