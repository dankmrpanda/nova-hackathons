import React from 'react';
import type { VoiceSession } from '@codebase-onboarding/shared';
import './voice.css';

interface VoiceControlsProps {
  voiceSession: VoiceSession | null;
  isConnecting: boolean;
  onStart: () => void;
  onEnd: () => void;
  onPause: () => void;
  onResume: () => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  voiceSession,
  isConnecting,
  onStart,
  onEnd,
  onPause,
  onResume,
}) => {
  // const isActive = voiceSession?.status === 'active';
  const isPaused = voiceSession?.status === 'paused';

  return (
    <div className="voice-controls">
      {!voiceSession ? (
        <button
          onClick={onStart}
          disabled={isConnecting}
          className="btn-voice btn-start"
          aria-label="Start voice session"
        >
          {isConnecting ? (
            <>
              <span className="btn-icon">⏳</span>
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <span className="btn-icon">🎤</span>
              <span>Start Voice Session</span>
            </>
          )}
        </button>
      ) : (
        <div className="voice-control-buttons">
          {isPaused ? (
            <button
              onClick={onResume}
              className="btn-voice btn-resume"
              aria-label="Resume voice session"
            >
              <span className="btn-icon">▶️</span>
              <span>Resume</span>
            </button>
          ) : (
            <button
              onClick={onPause}
              className="btn-voice btn-pause"
              aria-label="Pause voice session"
            >
              <span className="btn-icon">⏸️</span>
              <span>Pause</span>
            </button>
          )}

          <button
            onClick={onEnd}
            className="btn-voice btn-end"
            aria-label="End voice session"
          >
            <span className="btn-icon">⏹️</span>
            <span>End Session</span>
          </button>
        </div>
      )}

      {voiceSession && (
        <div className="voice-info">
          <div className="voice-info-item">
            <span className="info-label">Participants:</span>
            <span className="info-value">{voiceSession.participants.length}</span>
          </div>
          <div className="voice-info-item">
            <span className="info-label">Cost:</span>
            <span className="info-value">${voiceSession.cost.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
