import type {
  TranscriptSegment,
  VoiceSession,
  VoiceUIState,
} from '@codebase-onboarding/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * WebRTC Voice Client Hook
 * Implements real-time voice features with barge-in support and turn-taking
 * 
 * Requirements:
 * - 26.5: Support Barge-in allowing the Developer to interrupt the voice agent
 * - 26.7: Generate live transcripts of Voice Sessions linked to code locations
 * - 32.1: Enable the voice agent to reference and explain architecture diagrams
 */

interface UseWebRTCVoiceOptions {
  voiceSession: VoiceSession | null;
  onTranscriptSegment: (segment: TranscriptSegment) => void;
  onUISync: (state: VoiceUIState) => void;
  onError: (error: Error) => void;
}

interface WebRTCVoiceState {
  isConnected: boolean;
  isAgentSpeaking: boolean;
  isUserSpeaking: boolean;
  canBargeIn: boolean;
  latency: number;
  audioLevel: number;
}

export function useWebRTCVoice({
  voiceSession,
  onTranscriptSegment,
  onUISync,
  onError,
}: UseWebRTCVoiceOptions) {
  const [state, setState] = useState<WebRTCVoiceState>({
    isConnected: false,
    isAgentSpeaking: false,
    isUserSpeaking: false,
    canBargeIn: true,
    latency: 0,
    audioLevel: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bargeInTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latencyCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Initialize WebRTC connection
   * Requirement 26.1: Integrate Retell AI for real-time voice interactions
   */
  const initializeWebRTC = useCallback(async () => {
    if (!voiceSession || voiceSession.status !== 'active') {
      return;
    }

    try {
      // Get user media (microphone)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });

      localStreamRef.current = stream;

      // Create audio context for audio level monitoring
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Start monitoring audio levels
      monitorAudioLevel();

      // Create WebSocket connection
      const ws = new WebSocket(voiceSession.metadata.webSocketUrl as string);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setupPeerConnection(stream);
      };

      ws.onmessage = (event) => {
        handleWebSocketMessage(event.data);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError(new Error('WebSocket connection failed'));
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        cleanup();
      };

      // Start latency monitoring
      startLatencyMonitoring();
    } catch (error) {
      console.error('Failed to initialize WebRTC:', error);
      onError(error as Error);
    }
  }, [voiceSession, onError]);

  /**
   * Setup WebRTC peer connection
   */
  const setupPeerConnection = useCallback((stream: MediaStream) => {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    const peerConnection = new RTCPeerConnection(config);
    peerConnectionRef.current = peerConnection;

    // Add local stream tracks
    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });

    // Handle incoming tracks (agent audio)
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      playRemoteAudio(remoteStream);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate,
          })
        );
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      const connectionState = peerConnection.connectionState;
      console.log('Connection state:', connectionState);

      setState((prev) => ({
        ...prev,
        isConnected: connectionState === 'connected',
      }));

      if (connectionState === 'failed' || connectionState === 'disconnected') {
        onError(new Error('WebRTC connection failed'));
      }
    };

    // Create and send offer
    createAndSendOffer(peerConnection);
  }, [onError]);

  /**
   * Create and send WebRTC offer
   */
  const createAndSendOffer = async (peerConnection: RTCPeerConnection) => {
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      if (wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: 'offer',
            sdp: offer.sdp,
          })
        );
      }
    } catch (error) {
      console.error('Failed to create offer:', error);
      onError(error as Error);
    }
  };

  /**
   * Handle WebSocket messages
   */
  const handleWebSocketMessage = useCallback(
    async (data: string) => {
      try {
        const message = JSON.parse(data);

        switch (message.type) {
          case 'answer':
            // Handle WebRTC answer
            if (peerConnectionRef.current) {
              await peerConnectionRef.current.setRemoteDescription({
                type: 'answer',
                sdp: message.sdp,
              });
            }
            break;

          case 'ice-candidate':
            // Handle ICE candidate
            if (peerConnectionRef.current && message.candidate) {
              await peerConnectionRef.current.addIceCandidate(
                new RTCIceCandidate(message.candidate)
              );
            }
            break;

          case 'transcript-segment':
            // Handle live transcript segment
            // Requirement 26.7: Generate live transcripts
            onTranscriptSegment(message.segment);
            break;

          case 'agent-speaking':
            // Agent started speaking
            setState((prev) => ({
              ...prev,
              isAgentSpeaking: true,
              canBargeIn: voiceSession?.config.bargeInEnabled ?? true,
            }));
            break;

          case 'agent-stopped':
            // Agent stopped speaking
            setState((prev) => ({
              ...prev,
              isAgentSpeaking: false,
            }));
            break;

          case 'ui-sync':
            // Synchronize UI with voice
            // Requirement 26.6: Synchronize voice explanations with terminal UI
            onUISync(message.uiState);
            break;

          case 'turn-granted':
            // Turn-taking: user can speak
            setState((prev) => ({
              ...prev,
              canBargeIn: true,
            }));
            break;

          case 'turn-denied':
            // Turn-taking: user must wait
            setState((prev) => ({
              ...prev,
              canBargeIn: false,
            }));
            break;

          case 'latency-response': {
            // Update latency measurement
            const latency = Date.now() - (message.timestamp as number);
            setState((prev) => ({
              ...prev,
              latency,
            }));
            break;
          }

          default:
            console.warn('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Failed to handle WebSocket message:', error);
      }
    },
    [voiceSession, onTranscriptSegment, onUISync]
  );

  /**
   * Play remote audio stream
   */
  const playRemoteAudio = (stream: MediaStream) => {
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;

    // Monitor when agent is speaking
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkAgentSpeaking = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

      setState((prev) => ({
        ...prev,
        isAgentSpeaking: average > 10, // Threshold for detecting speech
      }));

      if (state.isConnected) {
        requestAnimationFrame(checkAgentSpeaking);
      }
    };

    checkAgentSpeaking();
  };

  /**
   * Monitor user audio level for barge-in detection
   * Requirement 26.5: Support Barge-in allowing the Developer to interrupt
   */
  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const checkAudioLevel = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

      setState((prev) => ({
        ...prev,
        audioLevel: average,
        isUserSpeaking: average > 20, // Threshold for detecting user speech
      }));

      // Detect barge-in
      if (average > 20 && state.isAgentSpeaking && state.canBargeIn) {
        handleBargeIn();
      }

      if (state.isConnected) {
        requestAnimationFrame(checkAudioLevel);
      }
    };

    checkAudioLevel();
  };

  /**
   * Handle barge-in event
   * Requirement 26.5: Support Barge-in
   */
  const handleBargeIn = useCallback(() => {
    // Debounce barge-in events
    if (bargeInTimeoutRef.current) {
      return;
    }

    console.log('Barge-in detected');

    // Send barge-in signal to server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'barge-in',
          timestamp: Date.now(),
        })
      );
    }

    // Prevent multiple barge-ins within 500ms
    bargeInTimeoutRef.current = setTimeout(() => {
      bargeInTimeoutRef.current = null;
    }, 500);
  }, [state.isAgentSpeaking, state.canBargeIn]);

  /**
   * Request turn to speak (manual turn-taking)
   */
  const requestTurn = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'request-turn',
          timestamp: Date.now(),
        })
      );
    }
  }, []);

  /**
   * Start latency monitoring
   * Requirement 26.4: Maintain voice latency below 800 milliseconds
   */
  const startLatencyMonitoring = () => {
    latencyCheckIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'latency-check',
            timestamp: Date.now(),
          })
        );
      }
    }, 5000); // Check every 5 seconds
  };

  /**
   * Cleanup resources
   */
  const cleanup = useCallback(() => {
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Clear intervals
    if (bargeInTimeoutRef.current) {
      clearTimeout(bargeInTimeoutRef.current);
      bargeInTimeoutRef.current = null;
    }

    if (latencyCheckIntervalRef.current) {
      clearInterval(latencyCheckIntervalRef.current);
      latencyCheckIntervalRef.current = null;
    }

    setState({
      isConnected: false,
      isAgentSpeaking: false,
      isUserSpeaking: false,
      canBargeIn: true,
      latency: 0,
      audioLevel: 0,
    });
  }, []);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    if (voiceSession && voiceSession.status === 'active') {
      initializeWebRTC();
    }

    return () => {
      cleanup();
    };
  }, [voiceSession, initializeWebRTC, cleanup]);

  return {
    state,
    requestTurn,
    cleanup,
  };
}
