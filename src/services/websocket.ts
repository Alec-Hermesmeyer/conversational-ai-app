import { AudioData, AudioDevice, RecordingState, WebSocketMessage, ConnectionState } from '@/types/audio';

export class AudioWebSocketClient {
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = {
    isConnected: false,
    isConnecting: false,
    error: null,
    lastConnected: null,
  };
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 2000;
  private reconnectTimer: NodeJS.Timeout | null = null;

  // Event listeners
  private onConnectionStateChange: ((state: ConnectionState) => void) | null = null;
  private onAudioData: ((data: AudioData) => void) | null = null;
  private onDeviceList: ((devices: AudioDevice[]) => void) | null = null;
  private onRecordingState: ((state: RecordingState) => void) | null = null;
  private onError: ((error: string) => void) | null = null;

  constructor(private url: string = 'ws://localhost:3001/ws') {}

  connect(): Promise<void> {
    if (this.connectionState.isConnected || this.connectionState.isConnecting) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        this.updateConnectionState({
          ...this.connectionState,
          isConnecting: true,
          error: null,
        });

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.updateConnectionState({
            isConnected: true,
            isConnecting: false,
            error: null,
            lastConnected: new Date(),
          });
          resolve();
        };

        this.ws.onclose = (event) => {
          this.updateConnectionState({
            isConnected: false,
            isConnecting: false,
            error: event.wasClean ? null : 'Connection lost',
            lastConnected: this.connectionState.lastConnected,
          });

          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          const errorMessage = 'WebSocket connection failed';
          this.updateConnectionState({
            ...this.connectionState,
            isConnecting: false,
            error: errorMessage,
          });
          this.onError?.(errorMessage);
          reject(new Error(errorMessage));
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        this.updateConnectionState({
          ...this.connectionState,
          isConnecting: false,
          error: errorMessage,
        });
        reject(new Error(errorMessage));
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }

    this.updateConnectionState({
      isConnected: false,
      isConnecting: false,
      error: null,
      lastConnected: this.connectionState.lastConnected,
    });
  }

  sendCommand(command: string, data?: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify({ command, data }));
  }

  // Recording controls
  startRecording(): void {
    this.sendCommand('startRecording');
  }

  stopRecording(): void {
    this.sendCommand('stopRecording');
  }

  pauseRecording(): void {
    this.sendCommand('pauseRecording');
  }

  resumeRecording(): void {
    this.sendCommand('resumeRecording');
  }

  // Audio settings
  setAudioDevice(deviceId: string): void {
    this.sendCommand('setAudioDevice', { deviceId });
  }

  requestDeviceList(): void {
    this.sendCommand('getDeviceList');
  }

  setAudioSettings(settings: { sampleRate?: number; bufferSize?: number; gain?: number }): void {
    this.sendCommand('setAudioSettings', settings);
  }

  // Event listener setters
  setOnConnectionStateChange(callback: (state: ConnectionState) => void): void {
    this.onConnectionStateChange = callback;
  }

  setOnAudioData(callback: (data: AudioData) => void): void {
    this.onAudioData = callback;
  }

  setOnDeviceList(callback: (devices: AudioDevice[]) => void): void {
    this.onDeviceList = callback;
  }

  setOnRecordingState(callback: (state: RecordingState) => void): void {
    this.onRecordingState = callback;
  }

  setOnError(callback: (error: string) => void): void {
    this.onError = callback;
  }

  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      switch (message.type) {
        case 'audioData':
          // Convert array buffer to Float32Array if needed
          if (message.data.samples instanceof ArrayBuffer) {
            message.data.samples = new Float32Array(message.data.samples);
          }
          this.onAudioData?.(message.data);
          break;

        case 'deviceList':
          this.onDeviceList?.(message.data);
          break;

        case 'recordingState':
          this.onRecordingState?.(message.data);
          break;

        case 'error':
          this.onError?.(message.message);
          break;

        default:
          console.warn('Unknown message type:', message);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      this.onError?.('Failed to parse server message');
    }
  }

  private updateConnectionState(newState: ConnectionState): void {
    this.connectionState = newState;
    this.onConnectionStateChange?.(newState);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);

    this.reconnectTimer = setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      this.connect().catch(() => {
        // Reconnection failed, will try again if under max attempts
      });
    }, delay);
  }
}

// Export singleton instance
export const audioWebSocket = new AudioWebSocketClient();