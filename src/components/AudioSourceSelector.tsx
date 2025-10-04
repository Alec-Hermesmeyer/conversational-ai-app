'use client';

import { useAudioWebSocket } from '@/hooks/useAudioWebSocket';
import { RefreshCw, Mic, Volume2 } from 'lucide-react';
import { useState } from 'react';

interface AudioSourceSelectorProps {
  className?: string;
}

export function AudioSourceSelector({ className = '' }: AudioSourceSelectorProps) {
  const {
    devices,
    setAudioDevice,
    refreshDevices,
    isConnected,
    error
  } = useAudioWebSocket();

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleDeviceSelect = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setAudioDevice(deviceId);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    refreshDevices();
    // Simulate loading state
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const getDeviceIcon = (deviceName: string) => {
    const name = deviceName.toLowerCase();
    if (name.includes('microphone') || name.includes('mic')) {
      return <Mic className="w-4 h-4" />;
    }
    return <Volume2 className="w-4 h-4" />;
  };

  if (!isConnected) {
    return (
      <div className={`p-4 bg-gray-100 dark:bg-gray-700 rounded-lg ${className}`}>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Audio Source
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Connect to Electron app to select audio source
        </p>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Audio Source
        </h3>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          title="Refresh device list"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {devices.length === 0 ? (
        <div className="text-center py-6">
          <Mic className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No audio devices found
          </p>
          <button
            onClick={handleRefresh}
            className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Try refreshing
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map((device) => (
            <div
              key={device.id}
              className={`
                flex items-center space-x-3 p-3 rounded-md border cursor-pointer transition-all duration-200
                ${selectedDeviceId === device.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                }
              `}
              onClick={() => handleDeviceSelect(device.id)}
            >
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full
                ${selectedDeviceId === device.id
                  ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                }
              `}>
                {getDeviceIcon(device.name)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className={`
                    text-sm font-medium truncate
                    ${selectedDeviceId === device.id
                      ? 'text-blue-900 dark:text-blue-100'
                      : 'text-gray-900 dark:text-gray-100'
                    }
                  `}>
                    {device.name}
                  </p>
                  {device.isDefault && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  ID: {device.id}
                </p>
              </div>

              {selectedDeviceId === device.id && (
                <div className="w-4 h-4 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {devices.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {devices.length} audio device{devices.length !== 1 ? 's' : ''} available
          </p>
        </div>
      )}
    </div>
  );
}