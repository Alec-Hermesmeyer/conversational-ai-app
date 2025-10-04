'use client';

import { TranscriptionProgress as ITranscriptionProgress } from '@/types/backend';
import { Loader2, Upload, Cpu, FileText, Sparkles, CheckCircle } from 'lucide-react';

interface TranscriptionProgressProps {
  progress: ITranscriptionProgress | null;
  className?: string;
}

export function TranscriptionProgress({ progress, className = '' }: TranscriptionProgressProps) {
  if (!progress) return null;

  const getStageInfo = (stage: ITranscriptionProgress['stage']) => {
    switch (stage) {
      case 'uploading':
        return {
          icon: Upload,
          label: 'Uploading Audio',
          description: 'Sending audio to processing server...',
          color: 'blue'
        };
      case 'processing':
        return {
          icon: Cpu,
          label: 'Processing Audio',
          description: 'Preparing audio for transcription...',
          color: 'blue'
        };
      case 'transcribing':
        return {
          icon: FileText,
          label: 'Transcribing',
          description: 'Converting speech to text...',
          color: 'green'
        };
      case 'summarizing':
        return {
          icon: Sparkles,
          label: 'Generating Summary',
          description: 'Creating AI-powered summary...',
          color: 'purple'
        };
      case 'completed':
        return {
          icon: CheckCircle,
          label: 'Complete',
          description: 'Transcription and summary ready!',
          color: 'green'
        };
      default:
        return {
          icon: Loader2,
          label: 'Processing',
          description: 'Working on your recording...',
          color: 'blue'
        };
    }
  };

  const stageInfo = getStageInfo(progress.stage);
  const Icon = stageInfo.icon;

  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds) return 'Calculating...';

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    if (mins > 0) {
      return `${mins}m ${secs}s remaining`;
    }
    return `${secs}s remaining`;
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6 ${className}`}>
      <div className="flex items-center space-x-4">
        {/* Icon */}
        <div className={`
          flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center
          ${stageInfo.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/20' :
            stageInfo.color === 'green' ? 'bg-green-100 dark:bg-green-900/20' :
            stageInfo.color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/20' :
            'bg-gray-100 dark:bg-gray-700'
          }
        `}>
          <Icon className={`
            w-6 h-6
            ${stageInfo.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
              stageInfo.color === 'green' ? 'text-green-600 dark:text-green-400' :
              stageInfo.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
              'text-gray-600 dark:text-gray-400'
            }
            ${progress.stage !== 'completed' ? 'animate-spin' : ''}
          `} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {stageInfo.label}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            {stageInfo.description}
          </p>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">
                Progress: {Math.round(progress.progress)}%
              </span>
              {progress.estimatedTimeRemaining && (
                <span className="text-gray-500 dark:text-gray-400">
                  {formatTimeRemaining(progress.estimatedTimeRemaining)}
                </span>
              )}
            </div>

            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className={`
                  h-2.5 rounded-full transition-all duration-300 ease-in-out
                  ${stageInfo.color === 'blue' ? 'bg-blue-500' :
                    stageInfo.color === 'green' ? 'bg-green-500' :
                    stageInfo.color === 'purple' ? 'bg-purple-500' :
                    'bg-gray-500'
                  }
                `}
                style={{ width: `${Math.min(progress.progress, 100)}%` }}
              />
            </div>
          </div>

          {/* Stage Steps */}
          <div className="flex items-center justify-between mt-4 text-xs">
            {['uploading', 'processing', 'transcribing', 'summarizing', 'completed'].map((stage, index) => (
              <div
                key={stage}
                className={`
                  flex items-center space-x-1
                  ${progress.stage === stage ? 'text-blue-600 dark:text-blue-400 font-medium' :
                    ['uploading', 'processing', 'transcribing', 'summarizing', 'completed'].indexOf(progress.stage) > index
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-400 dark:text-gray-600'
                  }
                `}
              >
                <div className={`
                  w-2 h-2 rounded-full
                  ${progress.stage === stage ? 'bg-blue-500 animate-pulse' :
                    ['uploading', 'processing', 'transcribing', 'summarizing', 'completed'].indexOf(progress.stage) > index
                      ? 'bg-green-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }
                `} />
                <span className="capitalize">{stage}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}