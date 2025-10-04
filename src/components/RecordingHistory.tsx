'use client';

import { useState } from 'react';
import { Recording } from '@/types/backend';
import { History, Play, Trash2, Download, Clock, Mic, Search, Filter } from 'lucide-react';

interface RecordingHistoryProps {
  recordings: Recording[];
  isLoading?: boolean;
  onSelectRecording?: (recording: Recording) => void;
  onDeleteRecording?: (recordingId: string) => void;
  onDownload?: (recording: Recording) => void;
  selectedRecordingId?: string;
  className?: string;
}

export function RecordingHistory({
  recordings,
  isLoading = false,
  onSelectRecording,
  onDeleteRecording,
  onDownload,
  selectedRecordingId,
  className = ''
}: RecordingHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'processed' | 'unprocessed' | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'duration' | 'title'>('date');

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  const getStatusColor = (processed: boolean) => {
    if (processed) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    } else {
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const filteredAndSortedRecordings = recordings
    .filter(recording => {
      const matchesSearch = !searchTerm.trim() ||
        recording.filename.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'processed' && recording.processed) ||
        (statusFilter === 'unprocessed' && !recording.processed);
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        case 'duration':
          return b.duration - a.duration;
        case 'title':
          return a.filename.localeCompare(b.filename);
        default:
          return 0;
      }
    });

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Recording History
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({recordings.length} recordings)
            </span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search recordings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 text-sm"
            />
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as Recording['status'] | 'all')}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="recording">Recording</option>
                <option value="error">Error</option>
              </select>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'duration' | 'title')}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="date">Sort by Date</option>
              <option value="duration">Sort by Duration</option>
              <option value="title">Sort by Title</option>
            </select>
          </div>
        </div>
      </div>

      {/* Recording List */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filteredAndSortedRecordings.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || statusFilter !== 'all'
                ? 'No recordings match your filters'
                : 'No recordings yet. Start recording to see history here.'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredAndSortedRecordings.map((recording) => (
              <div
                key={recording.id}
                className={`
                  p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors
                  ${selectedRecordingId === recording.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500'
                    : ''
                  }
                `}
                onClick={() => onSelectRecording?.(recording)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-1">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {recording.filename}
                      </h4>
                      <span className={`
                        inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                        ${getStatusColor(recording.processed)}
                      `}>
                        {recording.processed ? 'Processed' : 'Raw Audio'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatDuration(recording.duration)}
                      </span>
                      <span>
                        {new Date(recording.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center">
                        <Mic className="w-3 h-3 mr-1" />
                        {recording.settings.sampleRate / 1000}kHz
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {recording.processed && onDownload && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownload(recording);
                        }}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600"
                        title="Download recording"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}

                    {recording.processed && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRecording?.(recording);
                        }}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600"
                        title="View transcription"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}

                    {onDeleteRecording && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to delete this recording?')) {
                            onDeleteRecording(recording.id);
                          }
                        }}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600"
                        title="Delete recording"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar for processing recordings */}
                {!recording.processed && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full animate-pulse" style={{ width: '45%' }}></div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Processing transcription...
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {filteredAndSortedRecordings.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              Showing {filteredAndSortedRecordings.length} of {recordings.length} recordings
            </span>
            <span>
              Total duration: {formatDuration(recordings.reduce((sum, r) => sum + r.duration, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}