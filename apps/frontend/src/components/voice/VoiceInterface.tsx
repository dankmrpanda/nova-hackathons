import type { TranscriptSegment, VoiceSession, VoiceUIState } from '@codebase-onboarding/shared';
import React, { useCallback, useState } from 'react';

import { useWebRTCVoice } from '../../hooks/useWebRTCVoice';

import { TranscriptDisplay } from './TranscriptDisplay';
import { VoiceControls } from './VoiceControls';
import { VoiceVisualSync } from './VoiceVisualSync';
import './voice.css';

interface VoiceInterfaceProps {
  sessionId: string;
  voiceSession: VoiceSession | null;
  onStartVoice: () => Promise<void>;
  onEndVoice: () => Promise<void>;
  onPauseVoice: () => Promise<void>;
  onResumeVoice: () => Promise<void>;
}

/**
 * Voice Interface Component
 * Provides real-time voice interaction with WebRTC, barge-in, and live transcripts
 * 
 * Requirements:
 * - 26.1: Integrate Retell AI for real-time voice interactions
 * - 26.5: Support Barge-in allowing the Developer to interrupt the voice agent
 * - 26.6: Synchronize voice explanations with terminal UI and visual outputs
 * - 26.7: Generate live transcripts of Voice Sessions linked to code locations
 */
export const VoiceInterface: React.FC<VoiceInterfaceProps> = ({
  voiceSession,
  onStartVoice,
  onEndVoice,
  onPauseVoice,
  onResumeVoice,
}) => {
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [uiState, setUiState] = useState<VoiceUIState>({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle transcript segments from WebRTC
   * Requirement 26.7: Generate live transcripts
   */
  const handleTranscriptSegment = useCallback((segment: TranscriptSegment) => {
    setTranscript((prev) => [...prev, segment]);
  }, []);

  /**
   * Handle UI synchronization from voice agent
   * Requirement 26.6: Synchronize voice explanations with terminal UI
   */
  const handleUISync = useCallback((newState: VoiceUIState) => {
    setUiState(newState);
  }, []);

  /**
   * Handle WebRTC errors
   */
  const handleWebRTCError = useCallback((err: Error) => {
    console.error('WebRTC error:', err);
    setError(err.message || 'Voice connection error');
  }, []);

  /**
   * Initialize WebRTC voice connection
   * Requirement 26.5: Support Barge-in
   */
  const { state: voiceState, requestTurn } = useWebRTCVoice({
    voiceSession,
    onTranscriptSegment: handleTranscriptSegment,
    onUISync: handleUISync,
    onError: handleWebRTCError,
  });

  /**
   * Start voice session
   */
  const handleStart = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await onStartVoice();
    } catch (err) {
      setError('Failed to start voice session. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * End voice session
   */
  const handleEnd = async () => {
    try {
      await onEndVoice();
      setTranscript([]);
      setUiState({});
    } catch (err) {
      setError('Failed to end voice session.');
    }
  };

  /**
   * Pause voice session
   */
  const handlePause = async () => {
    try {
      await onPauseVoice();
    } catch (err) {
      setError('Failed to pause voice session.');
    }
  };

  /**
   * Resume voice session
   */
  const handleResume = async () => {
    try {
      await onResumeVoice();
    } catch (err) {
      setError('Failed to resume voice session.');
    }
  };

  return (
    <div className="voice-interface">
      <div className="voice-interface-header">
        <h3>Voice Session</h3>
        {voiceSession && (
          <div className="voice-status">
            <span className={`status-indicator status-${voiceSession.status}`} />
            <span className="status-text">{voiceSession.status}</span>
            {voiceState.isConnected && (
              <span className="connection-indicator">
                <span className="connection-dot" />
                Connected
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {/* Voice quality indicators */}
      {voiceSession && voiceSession.status === 'active' && voiceState.isConnected && (
        <div className="voice-quality-indicators">
          <div className="quality-indicator">
            <span className="indicator-label">Latency:</span>
            <span className={`indicator-value ${voiceState.latency > 800 ? 'warning' : ''}`}>
              {voiceState.latency}ms
            </span>
          </div>

          {voiceState.isAgentSpeaking && (
            <div className="speaking-indicator agent-speaking">
              <span className="speaker-icon">🤖</span>
              <span>Agent speaking...</span>
            </div>
          )}

          {voiceState.isUserSpeaking && (
            <div className="speaking-indicator user-speaking">
              <span className="speaker-icon">🎤</span>
              <span>You are speaking...</span>
            </div>
          )}

          {voiceSession.config.bargeInEnabled && (
            <div className="barge-in-indicator">
              <span className="indicator-icon">🔄</span>
              <span>Barge-in enabled - interrupt anytime</span>
            </div>
          )}

          {voiceSession.config.turnTakingMode === 'manual' && !voiceState.canBargeIn && (
            <button onClick={requestTurn} className="btn-request-turn">
              Request Turn to Speak
            </button>
          )}
        </div>
      )}

      <div className="voice-interface-content">
        <VoiceControls
          voiceSession={voiceSession}
          isConnecting={isConnecting}
          onStart={handleStart}
          onEnd={handleEnd}
          onPause={handlePause}
          onResume={handleResume}
        />

        {voiceSession && voiceSession.status === 'active' && (
          <>
            <TranscriptDisplay transcript={transcript} isLive={true} />

            <VoiceVisualSync uiState={uiState} onStateChange={() => {}} />
          </>
        )}

        {!voiceSession && (
          <div className="voice-prompt">
            <p>Start a voice session to interact with the onboarding agent</p>
            <ul className="voice-features">
              <li>🎤 Natural conversation with AI agent</li>
              <li>📊 Real-time visual synchronization</li>
              <li>📝 Live transcript generation</li>
              <li>🔄 Barge-in support for interruptions</li>
              <li>⚡ Low-latency voice interaction (&lt;800ms)</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
