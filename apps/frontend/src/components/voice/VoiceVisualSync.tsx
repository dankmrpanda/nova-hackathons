import type { VoiceUIState } from '@codebase-onboarding/shared';
import React, { useEffect } from 'react';

import './voice.css';

interface VoiceVisualSyncProps {
  uiState: VoiceUIState;
  onStateChange: (state: VoiceUIState) => void;
}

/**
 * Voice Visual Synchronization Component
 * Synchronizes voice explanations with terminal UI and visual outputs
 * Requirement 26.6: Synchronize voice explanations with terminal UI and visual outputs in real-time
 */
export const VoiceVisualSync: React.FC<VoiceVisualSyncProps> = ({
  uiState,
}) => {
  useEffect(() => {
    // Sync UI state when voice agent references code
    if (uiState.currentFile) {
      // Scroll to current file/line in the UI
      const element = document.querySelector(`[data-file="${uiState.currentFile}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    // Highlight code sections
    if (uiState.highlightedCode && uiState.highlightedCode.length > 0) {
      // Apply highlighting to code elements
      uiState.highlightedCode.forEach((lineId: string) => {
        const lineElement = document.querySelector(`[data-line-id="${lineId}"]`);
        if (lineElement) {
          lineElement.classList.add('voice-highlighted');
        }
      });

      // Clean up highlights after 3 seconds
      const timeout = setTimeout(() => {
        uiState.highlightedCode?.forEach((lineId: string) => {
          const lineElement = document.querySelector(`[data-line-id="${lineId}"]`);
          if (lineElement) {
            lineElement.classList.remove('voice-highlighted');
          }
        });
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [uiState]);

  if (!uiState.currentFile && !uiState.activeDiagram) {
    return null;
  }

  return (
    <div className="voice-visual-sync">
      {uiState.currentFile && (
        <div className="sync-indicator">
          <span className="sync-icon">📍</span>
          <span className="sync-text">
            {uiState.currentFile}
            {uiState.currentLine && `:${uiState.currentLine}`}
          </span>
        </div>
      )}

      {uiState.activeDiagram && (
        <div className="sync-indicator">
          <span className="sync-icon">📊</span>
          <span className="sync-text">Viewing: {uiState.activeDiagram}</span>
        </div>
      )}
    </div>
  );
};
