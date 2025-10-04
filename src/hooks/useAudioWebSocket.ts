import { useEffect, useState, useCallback, useRef } from 'react';
import { audioWebSocket } from '@/services/websocket';
import { AudioData, AudioDevice, RecordingState, ConnectionState } from '@/types/audio';

export function useAudioWebSocket() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(() =>
    audioWebSocket.getConnectionState()
  );
  const [audioData, setAudioData] = useState<AudioData | null>(null);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const isInitialized = useRef(false);

  // Initialize WebSocket connection and event listeners
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    // Set up event listeners
    audioWebSocket.setOnConnectionStateChange(setConnectionState);
    audioWebSocket.setOnAudioData(setAudioData);
    audioWebSocket.setOnDeviceList(setDevices);
    audioWebSocket.setOnRecordingState(setRecordingState);
    audioWebSocket.setOnError(setError);

    // Auto-connect on mount
    audioWebSocket.connect().catch((err) => {
      console.error('Failed to connect to Electron app:', err);
      setError('Failed to connect to Electron app. Make sure it\'s running on localhost:3001.');
    });

    // Request device list on successful connection
    if (connectionState.isConnected) {
      audioWebSocket.requestDeviceList();
    }

    return () => {
      audioWebSocket.disconnect();
    };
  }, []);

  // Request device list when connection is established
  useEffect(() => {
    if (connectionState.isConnected) {
      audioWebSocket.requestDeviceList();
      setError(null); // Clear any previous errors
    }
  }, [connectionState.isConnected]);

  const connect = useCallback(async () => {
    try {
      await audioWebSocket.connect();
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed';
      setError(errorMessage);
    }
  }, []);

  const disconnect = useCallback(() => {
    audioWebSocket.disconnect();
  }, []);

  const startRecording = useCallback(() => {
    try {
      audioWebSocket.startRecording();
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
    }
  }, []);

  const stopRecording = useCallback(() => {
    try {
      audioWebSocket.stopRecording();
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop recording';
      setError(errorMessage);
    }
  }, []);

  const pauseRecording = useCallback(() => {
    try {
      audioWebSocket.pauseRecording();
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pause recording';
      setError(errorMessage);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    try {
      audioWebSocket.resumeRecording();
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resume recording';
      setError(errorMessage);
    }
  }, []);

  const setAudioDevice = useCallback((deviceId: string) => {
    try {
      audioWebSocket.setAudioDevice(deviceId);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set audio device';
      setError(errorMessage);
    }
  }, []);

  const refreshDevices = useCallback(() => {
    try {
      audioWebSocket.requestDeviceList();
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh devices';
      setError(errorMessage);
    }
  }, []);

  const setAudioSettings = useCallback((settings: { sampleRate?: number; bufferSize?: number; gain?: number }) => {
    try {
      audioWebSocket.setAudioSettings(settings);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update audio settings';
      setError(errorMessage);
    }
  }, []);

  return {
    // State
    connectionState,
    audioData,
    devices,
    recordingState,
    error,

    // Actions
    connect,
    disconnect,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    setAudioDevice,
    refreshDevices,
    setAudioSettings,

    // Computed values
    isConnected: connectionState.isConnected,
    isConnecting: connectionState.isConnecting,
    canRecord: connectionState.isConnected && !recordingState.isRecording,
    canStop: connectionState.isConnected && recordingState.isRecording,
    canPause: connectionState.isConnected && recordingState.isRecording && !recordingState.isPaused,
    canResume: connectionState.isConnected && recordingState.isRecording && recordingState.isPaused,
  };
}