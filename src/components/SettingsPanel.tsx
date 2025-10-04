'use client';

import { useAudioWebSocket } from '@/hooks/useAudioWebSocket';
import { useState } from 'react';
import { Settings, Volume2, Mic2 } from 'lucide-react';

interface AudioSettings {
  sampleRate: number;
  bufferSize: number;
  gain: number;
}

interface SettingsPanelProps {
  className?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function SettingsPanel({ className = '', isOpen = false, onToggle }: SettingsPanelProps) {
  const { setAudioSettings, isConnected } = useAudioWebSocket();

  const [settings, setSettings] = useState<AudioSettings>({
    sampleRate: 44100,
    bufferSize: 1024,
    gain: 1.0,
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const sampleRateOptions = [
    { value: 44100, label: '44.1 kHz (CD Quality)' },
    { value: 48000, label: '48 kHz (Professional)' },
    { value: 96000, label: '96 kHz (High Resolution)' },
  ];

  const bufferSizeOptions = [
    { value: 256, label: '256 samples (Low Latency)' },
    { value: 512, label: '512 samples' },
    { value: 1024, label: '1024 samples (Default)' },
    { value: 2048, label: '2048 samples' },
    { value: 4096, label: '4096 samples (High Stability)' },
  ];

  const handleSettingChange = <K extends keyof AudioSettings>(
    key: K,
    value: AudioSettings[K]
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
    setHasUnsavedChanges(true);
  };

  const handleApplySettings = () => {
    setAudioSettings(settings);
    setHasUnsavedChanges(false);
  };

  const handleResetSettings = () => {
    const defaultSettings: AudioSettings = {
      sampleRate: 44100,
      bufferSize: 1024,
      gain: 1.0,
    };
    setSettings(defaultSettings);
    setAudioSettings(defaultSettings);
    setHasUnsavedChanges(false);
  };

  if (!isOpen) return null;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Audio Settings
          </h3>
        </div>
        {onToggle && (
          <button
            onClick={onToggle}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        )}
      </div>

      {/* Settings Content */}
      <div className="p-6 space-y-6">
        {!isConnected && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Connect to the Electron app to apply audio settings.
            </p>
          </div>
        )}

        {/* Sample Rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sample Rate
          </label>
          <select
            value={settings.sampleRate}
            onChange={(e) => handleSettingChange('sampleRate', Number(e.target.value))}
            disabled={!isConnected}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
          >
            {sampleRateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Higher sample rates provide better quality but use more bandwidth.
          </p>
        </div>

        {/* Buffer Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Buffer Size
          </label>
          <select
            value={settings.bufferSize}
            onChange={(e) => handleSettingChange('bufferSize', Number(e.target.value))}
            disabled={!isConnected}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
          >
            {bufferSizeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Smaller buffers reduce latency but may cause audio dropouts.
          </p>
        </div>

        {/* Gain Control */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Input Gain: {settings.gain.toFixed(1)}x
          </label>
          <div className="flex items-center space-x-3">
            <Volume2 className="w-4 h-4 text-gray-500" />
            <input
              type="range"
              min="0.1"
              max="5.0"
              step="0.1"
              value={settings.gain}
              onChange={(e) => handleSettingChange('gain', Number(e.target.value))}
              disabled={!isConnected}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Mic2 className="w-4 h-4 text-gray-500" />
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>Quiet (0.1x)</span>
            <span>Normal (1.0x)</span>
            <span>Loud (5.0x)</span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Adjust input sensitivity. Be careful with high values to avoid clipping.
          </p>
        </div>

        {/* Quick Presets */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Quick Presets
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => {
                setSettings({ sampleRate: 44100, bufferSize: 512, gain: 1.0 });
                setHasUnsavedChanges(true);
              }}
              disabled={!isConnected}
              className="px-4 py-3 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md border border-gray-200 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                Low Latency
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                44.1kHz, 512 samples
              </div>
            </button>

            <button
              onClick={() => {
                setSettings({ sampleRate: 48000, bufferSize: 1024, gain: 1.0 });
                setHasUnsavedChanges(true);
              }}
              disabled={!isConnected}
              className="px-4 py-3 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md border border-gray-200 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                High Quality
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                48kHz, 1024 samples
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleResetSettings}
          disabled={!isConnected}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset to Default
        </button>

        <div className="flex items-center space-x-3">
          {hasUnsavedChanges && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400">
              Unsaved changes
            </span>
          )}
          <button
            onClick={handleApplySettings}
            disabled={!isConnected || !hasUnsavedChanges}
            className={`
              px-4 py-2 text-sm font-medium rounded-md transition-colors
              ${isConnected && hasUnsavedChanges
                ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }
            `}
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
}