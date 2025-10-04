'use client';

import { SavedRecording } from '@/types/backend';
import { FileText, Tag, Users } from 'lucide-react';
import { TranscriptionDisplay } from '@/components/TranscriptionDisplay';
import { SummaryPanel } from '@/components/SummaryPanel';

interface RecordingDetailsProps {
  recording: SavedRecording | null;
  isLoading: boolean;
}

export default function RecordingDetails({ recording, isLoading }: RecordingDetailsProps) {
  const transcription = recording
    ? {
        id: recording.id,
        recordingId: recording.id,
        language: 'en',
        fullText: recording.transcript || '',
        segments: [],
        confidence: 0.9,
        status: recording.processed ? 'completed' as const : 'processing' as const,
        createdAt: new Date(recording.timestamp),
        updatedAt: new Date(recording.timestamp)
      }
    : null;

  const summaries = recording?.summary
    ? [{
        id: `${recording.id}-summary`,
        transcriptionId: recording.id,
        executiveSummary: recording.summary,
        content: recording.summary,
        keyInsights: recording.tags || [],
        keyPoints: recording.tags || [],
        actionItems: recording.actionItems || [],
        tags: recording.tags || [],
        createdAt: new Date(recording.timestamp)
      }]
    : [];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Transcription</h3>
        </div>
        <div className="p-4">
          <TranscriptionDisplay transcription={transcription as any} isLoading={isLoading && !!recording} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Participants</h3>
        </div>
        <div className="p-4">
          {recording?.speakers && Array.isArray((recording.speakers as any).speakers) && (recording.speakers as any).speakers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(recording.speakers as any).speakers.map((sp: any, idx: number) => (
                <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                  {sp.name || sp.id}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No participant data</p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Tag className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Summary</h3>
        </div>
        <div className="p-4">
          <SummaryPanel summaries={summaries as any} isLoading={isLoading && !!recording} />
        </div>
      </div>
    </div>
  );
}


