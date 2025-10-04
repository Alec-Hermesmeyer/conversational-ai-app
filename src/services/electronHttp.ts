export interface LatestRecordingResponse {
  data?: {
    sessionId: string;
    createdAt?: string;
    sizeBytes?: number;
  } | null;
  error?: string;
}

export interface TrayRecordingMeta {
  sessionId: string;
  filename: string;
  filePath: string;
  fileSize: number;
  createdAt: string;
  modifiedAt?: string;
}

const ELECTRON_BASE = process.env.NEXT_PUBLIC_TRAY_URL || 'http://localhost:3001';

export async function fetchLatestRecording(): Promise<LatestRecordingResponse> {
  try {
    const res = await fetch(`${ELECTRON_BASE}/api/recordings/latest`, { cache: 'no-store' });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to reach tray' };
  }
}

export function buildDownloadUrl(sessionId: string): string {
  return `${ELECTRON_BASE}/api/recordings/${sessionId}/download`;
}

export async function startMicCapture(): Promise<void> {
  await fetch(`${ELECTRON_BASE}/api/audio/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId: 'microphone' })
  });
}

export async function stopCapture(): Promise<void> {
  await fetch(`${ELECTRON_BASE}/api/audio/stop`, { method: 'POST' });
}

export async function awaitCompletion(timeoutMs = 120000): Promise<{ success: boolean }>{
  const res = await fetch(`${ELECTRON_BASE}/api/audio/await-completion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeoutMs })
  });
  if (!res.ok) return { success: false };
  return { success: true };
}

export async function pollLatestFor30s(intervalMs = 2000, totalMs = 30000): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < totalMs) {
    const latest = await fetchLatestRecording();
    const id = latest.data?.sessionId;
    if (id) return buildDownloadUrl(id);
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

export async function fetchRecordings(): Promise<{ success: boolean; data: TrayRecordingMeta[] } | { success: false; error: string }> {
  try {
    const res = await fetch(`${ELECTRON_BASE}/api/recordings`, { cache: 'no-store' });
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` } as const;
    return await res.json();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch recordings' } as const;
  }
}


