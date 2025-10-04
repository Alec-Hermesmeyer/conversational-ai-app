'use client';

import { useAudioWebSocket } from '@/hooks/useAudioWebSocket';
import { Play, Square, Pause } from 'lucide-react';

interface RecordingControlsProps {
  className?: string;
}

export function RecordingControls({ className = '' }: RecordingControlsProps) {
  const {
    recordingState,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    canRecord,
    canStop,
    canPause,
    canResume,
    isConnected
  } = useAudioWebSocket();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecord = () => {
    startRecording();
  };

  const handleStopRecord = () => {
    stopRecording();
  };

  const handlePauseResume = () => {
    if (recordingState.isPaused) {
      resumeRecording();
    } else {
      pauseRecording();
    }
  };

  if (!isConnected) {
    return (
      <div className={`flex items-center justify-center p-6 bg-gray-100 dark:bg-gray-700 rounded-lg ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">
          Connect to Electron app to access recording controls
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center space-y-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border ${className}`}>
      {/* Recording Status */}
      <div className="flex items-center space-x-2">
        {recordingState.isRecording && (
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${recordingState.isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`}></div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {recordingState.isPaused ? 'PAUSED' : 'RECORDING'}
            </span>
          </div>
        )}
        {!recordingState.isRecording && (
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            READY
          </span>
        )}
      </div>

      {/* Duration Display */}
      <div className="text-2xl font-mono font-bold text-gray-900 dark:text-gray-100">
        {formatDuration(recordingState.duration)}
      </div>

      {/* Control Buttons */}
      <div className="flex items-center space-x-4">
        {/* Record/Stop Button */}
        {!recordingState.isRecording ? (
          <button
            onClick={handleStartRecord}
            disabled={!canRecord}
            className={`
              flex items-center justify-center w-16 h-16 rounded-full transition-all duration-200
              ${canRecord
                ? 'bg-red-600 hover:bg-red-700 focus:ring-4 focus:ring-red-200 dark:focus:ring-red-800'
                : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
              }
              focus:outline-none
            `}
            title="Start Recording"
          >
            <div className="w-6 h-6 bg-white rounded-full"></div>
          </button>
        ) : (
          <button
            onClick={handleStopRecord}
            disabled={!canStop}
            className={`
              flex items-center justify-center w-16 h-16 rounded-full transition-all duration-200
              ${canStop
                ? 'bg-gray-600 hover:bg-gray-700 focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-800'
                : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
              }
              focus:outline-none
            `}
            title="Stop Recording"
          >
            <Square className="w-6 h-6 text-white" fill="currentColor" />
          </button>
        )}

        {/* Pause/Resume Button */}
        {recordingState.isRecording && (
          <button
            onClick={handlePauseResume}
            disabled={!canPause && !canResume}
            className={`
              flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200
              ${(canPause || canResume)
                ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-4 focus:ring-yellow-200 dark:focus:ring-yellow-800'
                : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
              }
              focus:outline-none
            `}
            title={recordingState.isPaused ? 'Resume Recording' : 'Pause Recording'}
          >
            {recordingState.isPaused ? (
              <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
            ) : (
              <Pause className="w-5 h-5 text-white" fill="currentColor" />
            )}
          </button>
        )}
      </div>

      {/* Recording State Info */}
      {recordingState.isRecording && (
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {recordingState.isPaused
              ? 'Recording is paused. Click resume to continue.'
              : 'Recording in progress. Click stop when finished.'
            }
          </p>
        </div>
      )}
    </div>
  );
}