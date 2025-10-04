'use client';

import { useState, useRef, useEffect } from 'react';
import { Transcription, TranscriptionSegment } from '@/types/backend';
import { FileText, Search, Clock, Volume2, Download, Copy, User } from 'lucide-react';

interface TranscriptionDisplayProps {
  transcription: Transcription | null;
  isLoading?: boolean;
  onExport?: (format: string) => void;
  className?: string;
}

export function TranscriptionDisplay({
  transcription,
  isLoading = false,
  onExport,
  className = ''
}: TranscriptionDisplayProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const transcriptionRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const highlightSearchTerm = (text: string) => {
    if (!searchTerm.trim()) return text;

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
  };

  const filteredSegments = transcription?.segments?.filter(segment =>
    !searchTerm.trim() || segment.text.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const scrollToSegment = (segmentId: string) => {
    const element = document.getElementById(`segment-${segmentId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setSelectedSegment(segmentId);
      setTimeout(() => setSelectedSegment(null), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6 ${className}`}>
        <div className="flex items-center space-x-2 mb-4">
          <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Transcription
          </h3>
        </div>

        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!transcription) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6 ${className}`}>
        <div className="flex items-center space-x-2 mb-4">
          <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Transcription
          </h3>
        </div>

        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            Start a recording to see transcription here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Transcription
            </h3>
            <span className={`
              px-2 py-1 rounded-full text-xs font-medium
              ${transcription.status === 'completed'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : transcription.status === 'processing'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }
            `}>
              {transcription.status}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowTimestamps(!showTimestamps)}
              className={`
                px-3 py-1 text-sm rounded-md transition-colors
                ${showTimestamps
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }
              `}
            >
              <Clock className="w-3 h-3 mr-1 inline" />
              Timestamps
            </button>

            {onExport && (
              <div className="relative group">
                <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                  <Download className="w-4 h-4" />
                </button>
                <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <button
                    onClick={() => onExport('txt')}
                    className="block w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Text (.txt)
                  </button>
                  <button
                    onClick={() => onExport('srt')}
                    className="block w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Subtitles (.srt)
                  </button>
                  <button
                    onClick={() => onExport('json')}
                    className="block w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    JSON (.json)
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => copyToClipboard(transcription.fullText)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Copy transcription"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search transcription..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        {/* Stats */}
        <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
          <span>{transcription.segments.length} segments</span>
          <span>•</span>
          <span>{Math.round(transcription.confidence * 100)}% confidence</span>
          <span>•</span>
          <span>{transcription.language}</span>
        </div>
      </div>

      {/* Transcription Content */}
      <div className="p-4 max-h-96 overflow-y-auto" ref={transcriptionRef}>
        {filteredSegments.length === 0 ? (
          transcription?.fullText ? (
            <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
              {transcription.fullText}
            </div>
          ) : (
            <div className="text-center py-8">
              <Search className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">
                {searchTerm ? 'No segments match your search' : 'No transcription available'}
              </p>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {filteredSegments.map((segment, index) => (
              <div
                key={segment.id}
                id={`segment-${segment.id}`}
                className={`
                  p-3 rounded-lg transition-all duration-200 cursor-pointer
                  ${selectedSegment === segment.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }
                `}
                onClick={() => scrollToSegment(segment.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {showTimestamps && (
                      <div className="flex items-center space-x-2 mb-2">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                        </span>
                        {segment.speaker && (
                          <>
                            <User className="w-3 h-3 text-gray-400 ml-2" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {segment.speaker}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                    <p
                      className="text-gray-900 dark:text-gray-100 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: highlightSearchTerm(segment.text) }}
                    />
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <div className={`
                      w-2 h-2 rounded-full
                      ${segment.confidence > 0.9
                        ? 'bg-green-500'
                        : segment.confidence > 0.7
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                      }
                    `} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {Math.round(segment.confidence * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            Updated {new Date(transcription.updatedAt).toLocaleString()}
          </span>
          {searchTerm && (
            <span>
              Showing {filteredSegments.length} of {transcription.segments.length} segments
            </span>
          )}
        </div>
      </div>
    </div>
  );
}