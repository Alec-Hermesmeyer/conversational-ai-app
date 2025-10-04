export interface AudioDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface AudioSettings {
  selectedDeviceId: string;
  sampleRate: number;
  bufferSize: number;
  gain: number;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
}

export interface AudioData {
  samples: Float32Array;
  timestamp: number;
  sampleRate: number;
}

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastConnected: Date | null;
}

export type WebSocketMessage =
  | { type: 'audioData'; data: AudioData }
  | { type: 'deviceList'; data: AudioDevice[] }
  | { type: 'recordingState'; data: RecordingState }
  | { type: 'error'; message: string };