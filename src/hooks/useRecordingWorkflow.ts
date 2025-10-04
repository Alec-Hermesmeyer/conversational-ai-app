import { useState, useRef, useCallback, useEffect } from 'react';
import { useAudioWebSocket } from './useAudioWebSocket';
import { useBackend } from './useBackend';
import { Recording } from '@/types/backend';

export function useRecordingWorkflow() {
  const audioWebSocket = useAudioWebSocket();
  const backend = useBackend();

  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Audio buffer for real-time processing
  const audioBufferRef = useRef<Float32Array[]>([]);

  const startRecording = useCallback(async () => {
    try {
      // Start Electron app recording
      audioWebSocket.startRecording();

      // Create audio context and stream for web recording
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      // Request microphone access for local recording
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;

      // Set up MediaRecorder for local backup recording
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setRecordedChunks(chunks);

        // Convert to WAV blob
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });

        // Get current audio settings
        const settings: Recording['settings'] = {
          sampleRate: 44100,
          bufferSize: 1024,
          gain: 1.0,
          deviceId: 'default', // This should come from the selected device
        };

        // Upload to backend for processing
        const recording = await backend.uploadRecording(audioBlob, settings);
        if (recording) {
          setCurrentRecordingId(recording.id);
        }
      };

      // Start recording
      mediaRecorder.start(1000); // Capture data every second
      setIsRecording(true);
      setRecordedChunks([]);

    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error('Failed to start recording');
    }
  }, [audioWebSocket, backend]);

  const stopRecording = useCallback(() => {
    try {
      // Stop Electron app recording
      audioWebSocket.stopRecording();

      // Stop local recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }

      // Clean up streams
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      setIsRecording(false);
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }, [audioWebSocket]);

  const pauseRecording = useCallback(() => {
    audioWebSocket.pauseRecording();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
    }
  }, [audioWebSocket]);

  const resumeRecording = useCallback(() => {
    audioWebSocket.resumeRecording();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
    }
  }, [audioWebSocket]);

  const selectRecording = useCallback(async (recording: Recording) => {
    setCurrentRecordingId(recording.id);

    // Load transcription for this recording
    const transcriptionResponse = await backend.loadTranscription(recording.id);
    if (!transcriptionResponse) {
      // Start transcription if it doesn't exist
      await backend.startTranscription(recording.id);
    }
  }, [backend]);

  // Process incoming audio data from Electron app
  useEffect(() => {
    if (audioWebSocket.audioData) {
      // Store audio data for potential local processing
      audioBufferRef.current.push(audioWebSocket.audioData.samples);

      // Keep buffer size manageable (last 10 seconds)
      const maxChunks = Math.floor(10 * (audioWebSocket.audioData.sampleRate || 44100) / 1024);
      if (audioBufferRef.current.length > maxChunks) {
        audioBufferRef.current.shift();
      }
    }
  }, [audioWebSocket.audioData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    // Recording state
    isRecording,
    currentRecordingId,
    recordedChunks,

    // Recording controls
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    selectRecording,

    // WebSocket state (from Electron app)
    connectionState: audioWebSocket.connectionState,
    audioData: audioWebSocket.audioData,
    devices: audioWebSocket.devices,
    recordingState: audioWebSocket.recordingState,
    error: audioWebSocket.error,

    // Backend state
    recordings: backend.recordings,
    currentTranscription: backend.currentTranscription,
    currentSummaries: backend.currentSummaries,
    progress: backend.progress,
    isLoading: backend.isLoading,
    backendError: backend.error,

    // Backend actions
    generateSummary: backend.generateSummary,
    deleteRecording: backend.deleteRecording,
    exportTranscription: backend.exportTranscription,

    // WebSocket actions
    connect: audioWebSocket.connect,
    disconnect: audioWebSocket.disconnect,
    setAudioDevice: audioWebSocket.setAudioDevice,
    refreshDevices: audioWebSocket.refreshDevices,
    setAudioSettings: audioWebSocket.setAudioSettings,

    // Computed values
    isConnected: audioWebSocket.isConnected,
    isConnecting: audioWebSocket.isConnecting,
    canRecord: audioWebSocket.isConnected && !isRecording,
    canStop: audioWebSocket.isConnected && isRecording,
    canPause: audioWebSocket.isConnected && isRecording && !audioWebSocket.recordingState.isPaused,
    canResume: audioWebSocket.isConnected && isRecording && audioWebSocket.recordingState.isPaused,
    hasActiveTranscription: backend.hasActiveTranscription,
    isTranscribing: backend.isTranscribing,
    transcriptionProgress: backend.transcriptionProgress,
  };
}