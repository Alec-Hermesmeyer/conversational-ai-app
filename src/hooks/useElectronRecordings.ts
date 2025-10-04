import { useState, useEffect, useCallback } from 'react';
import { SavedRecording } from '@/types/backend';

export function useElectronRecordings() {
  const [recordings, setRecordings] = useState<SavedRecording[]>([]);
  const [electronAvailable, setElectronAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if Electron app is running
  const checkElectronApp = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3001/api/health', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      setElectronAvailable(response.ok);
    } catch {
      setElectronAvailable(false);
    }
  }, []);

  // Fetch recordings from Electron app
  const fetchElectronRecordings = useCallback(async () => {
    if (!electronAvailable) return [];

    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/recordings', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        console.warn(`HTTP ${response.status}: ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      console.log('Electron recordings data:', data);

      if (data.success && data.data) {
        // Convert Electron format to our SavedRecording format
        const electronRecordings: SavedRecording[] = data.data.map((rec: Record<string, unknown>) => ({
          id: String(rec.sessionId || ''),
          filename: String(rec.filename || ''),
          timestamp: String(rec.createdAt || ''),
          duration: 0, // We don't have this from Electron
          size: Number(rec.fileSize || 0),
          type: 'manual' as const,
          processed: false, // These need to be processed
          transcript: '',
          summary: '',
          actionItems: [],
          speakers: {},
          tags: [],
          metadata: {}
        }));

        setRecordings(electronRecordings);
        return electronRecordings;
      } else {
        console.warn('API returned success: false', data);
        return [];
      }
    } catch (error) {
      console.error('Failed to fetch electron recordings:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [electronAvailable]);

  // Process recording by fetching audio from Electron and sending to backend
  const processRecording = useCallback(async (recordingId: string) => {
    if (!electronAvailable) return;

    try {
      // First, get the audio file from Electron
      const audioResponse = await fetch(`http://localhost:3001/api/recordings/${recordingId}`, {
        method: 'GET'
      });

      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.statusText}`);
      }

      const audioBlob = await audioResponse.blob();
      const recording = recordings.find(r => r.id === recordingId);
      const filename = recording?.filename || `recording-${recordingId}.webm`;

      // Convert blob to File
      const audioFile = new File([audioBlob], filename, { type: audioBlob.type });

      // Return the file for processing by the component
      return { audioFile, recordingId };
    } catch (error) {
      console.error('Failed to fetch recording from Electron:', error);
      throw error;
    }
  }, [electronAvailable, recordings]);

  // Check for Electron app and load recordings
  useEffect(() => {
    checkElectronApp();
  }, [checkElectronApp]);

  // Load recordings when electron becomes available
  useEffect(() => {
    if (electronAvailable) {
      fetchElectronRecordings();
    }
  }, [electronAvailable, fetchElectronRecordings]);

  // Check periodically for app availability
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        checkElectronApp();
      }
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [checkElectronApp]);

  return {
    recordings,
    loading,
    electronAvailable,
    processRecording,
    refreshRecordings: fetchElectronRecordings,
    checkElectronApp
  };
}