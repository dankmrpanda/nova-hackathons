import React from 'react';
import type { PlaybackState } from '@codebase-onboarding/shared';
import './script.css';

interface PlaybackControlsProps {
  playbackState: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (timestamp: number) => void;
  onSetSpeed: (speed: number) => void;
  onNextSection: () => void;
  onPreviousSection: () => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  playbackState,
  onPlay,
  onPause,
  onSeek: _onSeek,
  onSetSpeed,
  onNextSection,
  onPreviousSection,
}) => {
  const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="playback-controls">
      <div className="control-buttons">
        <button onClick={onPreviousSection} className="btn-control" aria-label="Previous section">
          ⏮️
        </button>
        {playbackState.isPaused ? (
          <button onClick={onPlay} className="btn-control btn-play" aria-label="Play">
            ▶️
          </button>
        ) : (
          <button onClick={onPause} className="btn-control btn-pause" aria-label="Pause">
            ⏸️
          </button>
        )}
        <button onClick={onNextSection} className="btn-control" aria-label="Next section">
          ⏭️
        </button>
      </div>

      <div className="speed-control">
        <span className="speed-label">Speed:</span>
        {speeds.map((speed) => (
          <button
            key={speed}
            onClick={() => onSetSpeed(speed)}
            className={`btn-speed ${playbackState.speed === speed ? 'active' : ''}`}
            aria-pressed={playbackState.speed === speed}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
};
