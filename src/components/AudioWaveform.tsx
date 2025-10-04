'use client';

import { useElectronRecordings } from '@/hooks/useElectronRecordings';
import { useEffect, useRef, useState } from 'react';
import { Activity, Volume2 } from 'lucide-react';

interface AudioWaveformProps {
  className?: string;
  height?: number;
  showLevel?: boolean;
}

export function AudioWaveform({ className = '', height = 200, showLevel = true }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const audioBufferRef = useRef<number[]>([]);
  const { electronAvailable } = useElectronRecordings();

  const [audioLevel, setAudioLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);

  // Configuration
  const BUFFER_SIZE = 1024; // Number of audio samples to keep in buffer
  const WAVEFORM_COLOR = '#3b82f6'; // Blue
  const WAVEFORM_COLOR_RECORDING = '#ef4444'; // Red when recording
  const BACKGROUND_COLOR = '#f8fafc';
  const GRID_COLOR = '#e2e8f0';

  // Initialize audio buffer
  useEffect(() => {
    audioBufferRef.current = [];
  }, []);

  // Generate demo waveform data when connected
  useEffect(() => {
    if (electronAvailable) {
      const interval = setInterval(() => {
        // Generate fake waveform data for demo
        const randomLevel = Math.random() * 0.8;
        audioBufferRef.current.push(randomLevel);

        // Keep buffer size manageable
        if (audioBufferRef.current.length > BUFFER_SIZE) {
          audioBufferRef.current.shift();
        }

        // Set fake audio level
        const level = randomLevel * 100;
        setAudioLevel(level);

        // Update peak level
        if (level > peakLevel) {
          setPeakLevel(level);
          // Decay peak level over time
          setTimeout(() => {
            setPeakLevel(prev => Math.max(prev - 5, level));
          }, 100);
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [electronAvailable, peakLevel]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      drawWaveform();
      animationRef.current = requestAnimationFrame(animate);
    };

    if (electronAvailable) {
      animate();
    } else {
      // Clear canvas when disconnected
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawPlaceholder(ctx, canvas.width, canvas.height);
        }
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [electronAvailable]);

  const generateWaveformSamples = (level: number, count: number): number[] => {
    const samples: number[] = [];
    for (let i = 0; i < count; i++) {
      // Create a sine wave with some randomness based on the level
      const t = (i / count) * Math.PI * 4;
      const base = Math.sin(t) * level;
      const noise = (Math.random() - 0.5) * level * 0.3;
      samples.push(base + noise);
    }
    return samples;
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    drawGrid(ctx, width, height);

    if (audioBufferRef.current.length === 0) {
      drawPlaceholder(ctx, width, height);
      return;
    }

    // Use buffered audio levels to generate waveform
    const currentLevel = audioBufferRef.current[audioBufferRef.current.length - 1] || 0;

    // Generate synthetic waveform samples based on current audio level
    const waveformSamples = generateWaveformSamples(currentLevel, width);
    if (waveformSamples.length === 0) return;

    // Set waveform color based on connection state
    const waveformColor = electronAvailable ? WAVEFORM_COLOR : WAVEFORM_COLOR_RECORDING;
    ctx.strokeStyle = waveformColor;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';

    // Draw waveform
    ctx.beginPath();
    const centerY = height / 2;

    for (let i = 0; i < waveformSamples.length; i++) {
      const sample = waveformSamples[i];

      // Normalize sample to fit canvas height
      const y = centerY + (sample * centerY * 0.8);
      const x = (i / waveformSamples.length) * width;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw center line
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([1, 3]);

    // Vertical lines
    const verticalLines = 10;
    for (let i = 1; i < verticalLines; i++) {
      const x = (i / verticalLines) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    const horizontalLines = 4;
    for (let i = 1; i < horizontalLines; i++) {
      const y = (i / horizontalLines) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  };

  const drawPlaceholder = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = GRID_COLOR;
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = electronAvailable ? 'Waiting for audio data...' : 'Connect to Electron app to see waveform';
    ctx.fillText(text, width / 2, height / 2);
  };

  const getLevelColor = (level: number) => {
    if (level > 80) return 'bg-red-500';
    if (level > 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Audio Waveform
          </h3>
          {electronAvailable && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></div>
              CONNECTED
            </span>
          )}
        </div>

        {/* Audio Level Meters */}
        {showLevel && electronAvailable && (
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              <Volume2 className="w-4 h-4 text-gray-500" />
              <div className="flex items-center space-x-1">
                <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${getLevelColor(audioLevel)}`}
                    style={{ width: `${Math.min(audioLevel, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono w-8">
                  {Math.round(audioLevel)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Waveform Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={800}
          height={height}
          className="w-full block"
          style={{ height: `${height}px` }}
        />

        {!electronAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 dark:bg-gray-800/80">
            <div className="text-center">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Connect to Electron app
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer with stats */}
      {electronAvailable && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center justify-between">
            <span>
              Buffer: {audioBufferRef.current.length} chunks
            </span>
            <span>
              Peak: {Math.round(peakLevel)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}