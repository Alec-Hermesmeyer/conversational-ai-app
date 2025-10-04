import { useState, useEffect, useCallback } from 'react';
import { backendApi } from '@/services/backend';
import { Recording, SavedRecording, BackendApiResponse, TranscriptionProgress } from '@/types/backend';

export function useBackend() {
  const [recordings, setRecordings] = useState<SavedRecording[]>([]);
  const [currentRecording, setCurrentRecording] = useState<SavedRecording | null>(null);
  const [progress, setProgress] = useState<TranscriptionProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist recordings to localStorage
  const saveRecordings = useCallback((recordings: SavedRecording[]) => {
    setRecordings(recordings);
    try {
      localStorage.setItem('saved-recordings', JSON.stringify(recordings));
    } catch (err) {
      console.error('Failed to persist recordings to localStorage (likely quota exceeded)', err);
    }
  }, []);

  // Load recordings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('saved-recordings');
      if (saved) {
        const parsedRecordings = JSON.parse(saved) as SavedRecording[];
        setRecordings(parsedRecordings);
      }
    } catch (error) {
      console.error('Failed to load recordings from localStorage:', error);
    }
  }, []);

  const processRecording = useCallback(async (audioFile: File, recordingId: string) => {
    console.log('Processing recording:', {
      filename: audioFile.name,
      size: audioFile.size,
      type: audioFile.type,
      recordingId
    });

    setIsLoading(true);
    setError(null);

    try {
      const response = await backendApi.processCompleteRecording(audioFile);
      console.log('Backend response:', response);

      if (response.success && response.data) {
        // Get the original recording to preserve metadata
        const originalRecording = recordings.find(r => r.id === recordingId);

        // Process the response and create a normalized recording
        const processedRecording = backendApi.processApiResponse(response.data, recordingId, originalRecording);
        console.log('Processed recording:', processedRecording);

        // Update the recording using a functional state update to avoid stale closures
        setRecordings(prev => {
          const updated = prev.map(r =>
            r.id === recordingId ? { ...r, ...processedRecording, processed: true } : r
          );
          try {
            localStorage.setItem('saved-recordings', JSON.stringify(updated));
          } catch {}
          return updated;
        });
        setCurrentRecording(processedRecording);

        setIsLoading(false);
        return processedRecording;
      } else {
        throw new Error(response.error || 'Processing failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      setError(errorMessage);

      // Mark recording as failed using functional update
      setRecordings(prev => {
        const failedRecordings = prev.map(r =>
          r.id === recordingId
            ? {
                ...r,
                processed: true,
                transcript: '',
                summary: '',
                tags: [],
                metadata: { error: true, errorMessage },
                actionItems: [],
                speakers: {},
                error: errorMessage
              }
            : r
        );
        try {
          localStorage.setItem('saved-recordings', JSON.stringify(failedRecordings));
        } catch {}
        return failedRecordings;
      });
      setIsLoading(false);
      return null;
    }
  }, [recordings, saveRecordings]);

  const addRecording = useCallback(async (file: File) => {
    const recordingId = `recording-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    const newRecording: SavedRecording = {
      id: recordingId,
      filename: file.name,
      timestamp,
      createdAt: timestamp, // Add createdAt field
      duration: 0, // Could be calculated from audio file
      fileSize: file.size,  // Add fileSize field
      size: file.size,
      type: 'uploaded',
      transcription: null,
      processed: false
    };

    // Add to recordings list
    const updatedRecordings = [...recordings, newRecording];
    saveRecordings(updatedRecordings);

    // Start processing
    await processRecording(file, recordingId);

    return newRecording;
  }, [recordings, saveRecordings, processRecording]);

  const selectRecording = useCallback((recording: SavedRecording) => {
    setCurrentRecording(recording);
  }, []);

  const deleteRecording = useCallback((recordingId: string) => {
    const updatedRecordings = recordings.filter(r => r.id !== recordingId);
    saveRecordings(updatedRecordings);

    // Clear current data if it belongs to the deleted recording
    if (currentRecording?.id === recordingId) {
      setCurrentRecording(null);
      setProgress(null);
    }
  }, [recordings, currentRecording?.id, saveRecordings]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetProgress = useCallback(() => {
    setProgress(null);
  }, []);

  return {
    // State
    recordings,
    currentRecording,
    progress,
    isLoading,
    error,

    // Actions
    addRecording,
    processRecording,
    selectRecording,
    deleteRecording,
    clearError,
    resetProgress,

    // Computed values
    hasActiveRecording: !!currentRecording,
    isProcessing: isLoading,
    currentTranscription: currentRecording ? {
      id: currentRecording.id,
      recordingId: currentRecording.id,
      language: 'en',
      transcript: currentRecording.transcript,
      fullText: currentRecording.transcript || '',
      segments: [], // Would need to parse from transcript
      confidence: 0.9,
      status: currentRecording.processed ? 'completed' : 'processing',
      createdAt: new Date(currentRecording.timestamp),
      updatedAt: new Date(currentRecording.timestamp)
    } : null,
    currentSummaries: currentRecording?.summary ? [{
      id: `${currentRecording.id}-summary`,
      transcriptionId: currentRecording.id,
      executiveSummary: currentRecording.summary,
      content: currentRecording.summary,
      keyInsights: currentRecording.tags || [],
      keyPoints: currentRecording.tags || [],
      actionItems: currentRecording.actionItems || [],
      tags: currentRecording.tags || [],
      createdAt: new Date(currentRecording.timestamp)
    }] : [],
  };
}