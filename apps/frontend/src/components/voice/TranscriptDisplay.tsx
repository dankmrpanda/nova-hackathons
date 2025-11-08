import React, { useEffect, useRef } from 'react';
import type { TranscriptSegment } from '@codebase-onboarding/shared';
import './voice.css';

interface TranscriptDisplayProps {
  transcript: TranscriptSegment[];
  isLive: boolean;
}

export const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({
  transcript,
  isLive,
}) => {
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new segments arrive
    if (transcriptRef.current && isLive) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript, isLive]);

  const formatTimestamp = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="transcript-display">
      <div className="transcript-header">
        <h4>Live Transcript</h4>
        {isLive && <span className="live-indicator">● LIVE</span>}
      </div>

      <div
        ref={transcriptRef}
        className="transcript-content"
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        {transcript.length === 0 ? (
          <p className="no-transcript">Waiting for conversation to start...</p>
        ) : (
          transcript.map((segment) => (
            <div
              key={segment.id}
              className={`transcript-segment segment-${segment.speaker}`}
            >
              <div className="segment-header">
                <span className="segment-speaker">
                  {segment.speaker === 'agent' ? '🤖 Agent' : '👤 You'}
                </span>
                <span className="segment-timestamp">
                  {formatTimestamp(segment.timestamp)}
                </span>
              </div>
              <div className="segment-text">{segment.text}</div>
              {segment.references.length > 0 && (
                <div className="segment-references">
                  <span className="references-label">References:</span>
                  {segment.references.map((ref: any, index: number) => (
                    <span key={index} className="reference-item">
                      {ref.path}:{ref.lineNumbers.join(',')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
