'use client';

import { useAudioWebSocket } from '@/hooks/useAudioWebSocket';

interface ConnectionStatusProps {
  onRetry?: () => void;
}

export function ConnectionStatus({ onRetry }: ConnectionStatusProps) {
  const { connectionState, connect, error } = useAudioWebSocket();

  const getStatusColor = () => {
    if (connectionState.isConnected) return 'bg-green-500';
    if (connectionState.isConnecting) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (connectionState.isConnected) return 'Connected to Electron App';
    if (connectionState.isConnecting) return 'Connecting...';
    return 'Disconnected';
  };

  const handleRetry = async () => {
    if (onRetry) {
      onRetry();
    } else {
      await connect();
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
      <div className="flex items-center space-x-3">
        <div className={`w-3 h-3 rounded-full ${getStatusColor()} relative`}>
          {connectionState.isConnecting && (
            <div className="absolute inset-0 rounded-full bg-yellow-500 animate-ping"></div>
          )}
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {getStatusText()}
          </p>
          {connectionState.lastConnected && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last connected: {connectionState.lastConnected.toLocaleTimeString()}
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      </div>

      {!connectionState.isConnected && !connectionState.isConnecting && (
        <button
          onClick={handleRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm font-medium transition-colors"
        >
          Retry Connection
        </button>
      )}
    </div>
  );
}