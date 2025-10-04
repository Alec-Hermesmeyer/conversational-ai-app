'use client';

import { useState } from 'react';
import { Clock, HardDrive, FileText, CheckCircle, Upload } from 'lucide-react';
import { SavedRecording } from '@/types/backend';

interface RecordingsListProps {
  recordings: SavedRecording[];
  isLoading: boolean;
  selectedId?: string | null;
  onUpload: (file: File) => Promise<void> | void;
  onSelect: (recording: SavedRecording) => void;
}

export default function RecordingsList({ recordings, isLoading, selectedId, onUpload, onSelect }: RecordingsListProps) {
  const [dragOver, setDragOver] = useState(false);

  const processedCount = recordings.filter(r => r.processed && (r.transcript || r.error)).length;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.find(file => file.type.startsWith('audio/'));
    if (audioFile) onUpload(audioFile);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Recordings</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{recordings.length} total • {processedCount} processed</p>
          </div>
        </div>
      </div>

      <div
        className={`mb-4 border border-dashed rounded-md p-4 text-center transition-colors ${
          dragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'
        } ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
        onDrop={handleDrop}
      >
        <Upload className={`w-8 h-8 mx-auto mb-2 ${dragOver ? 'text-blue-600' : 'text-gray-400'}`} />
        <p className="text-sm text-gray-700 dark:text-gray-300">Drop audio here or choose a file</p>
        <input type="file" accept="audio/*" onChange={handleFileInput} disabled={isLoading} className="hidden" id="audio-file-input" />
        <label htmlFor="audio-file-input" className={`mt-2 inline-flex items-center space-x-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md cursor-pointer transition-colors ${isLoading ? 'pointer-events-none opacity-60' : ''}`}>
          <FileText className="w-4 h-4" />
          <span className="text-sm">Choose File</span>
        </label>
      </div>

      {recordings.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12 border border-gray-200 dark:border-gray-700 rounded-md">
          <p className="text-sm">No recordings. Upload an audio file to begin.</p>
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
          {recordings.map((rec) => {
            const isSelected = rec.id === selectedId;
            return (
              <button
                key={rec.id}
                onClick={() => onSelect(rec)}
                className={`w-full text-left px-3 py-2 focus:outline-none ${
                  isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1 mr-3">
                    <div className="flex items-center space-x-2">
                      <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{rec.filename}</span>
                      {rec.transcript && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span>{new Date(rec.createdAt).toLocaleString()}</span>
                      {rec.duration ? (
                        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{Math.round(rec.duration)}s</span>
                      ) : null}
                      {rec.fileSize ? (
                        <span className="inline-flex items-center gap-1"><HardDrive className="w-3 h-3" />{Math.round(rec.fileSize / 1024)}KB</span>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${
                      rec.error
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                        : rec.transcript
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}>
                      {rec.error ? 'Failed' : rec.transcript ? 'Processed' : 'Pending'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}