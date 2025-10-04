import { Recording, BackendApiResponse, BackendResponse, SavedRecording, TranscriptionProgress, ExportOptions, Transcription, Summary, ActionItem, TemplateAvailableItem, TemplateConfig, TemplateGenerateRequest, TemplateGenerateResponse, TemplateGenerateMultipleRequest, TemplateComparison, TemplatePreviewRequest, TemplatePreviewResponse, TemplateExportRequest, TemplateStats, TemplateType } from '@/types/backend';

class BackendApiService {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_BACKEND_URL as string) {
    this.baseUrl = baseUrl;
  }

  // Main processing method that matches your backend
  async processCompleteRecording(
    audioFile: File,
    language: string = 'en',
    generateSummary: boolean = true,
    extractActionItems: boolean = true,
    createSearchIndex: boolean = true
  ): Promise<BackendResponse<BackendApiResponse>> {
    console.log('Backend service processing:', {
      filename: audioFile.name,
      size: audioFile.size,
      type: audioFile.type
    });

    const formData = new FormData();
    formData.append('audio', audioFile, audioFile.name);
    formData.append('meetingTitle', audioFile.name.replace(/\.[^/.]+$/, ""));
    formData.append('language', language);
    formData.append('generateSummary', generateSummary.toString());
    formData.append('extractActionItems', extractActionItems.toString());
    formData.append('createSearchIndex', createSearchIndex.toString());

    // Log what we're sending
    console.log('Sending FormData with fields:', {
      audio: audioFile.name,
      meetingTitle: audioFile.name.replace(/\.[^/.]+$/, ""),
      language,
      generateSummary: generateSummary.toString(),
      extractActionItems: extractActionItems.toString(),
      createSearchIndex: createSearchIndex.toString()
    });

    try {
      const response = await fetch(`${this.baseUrl}/api/meeting-intelligence/process-complete`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(300000) // 5 minute timeout
      });

      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        // Try to get the error details from the response
        let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.text();
          console.log('Error response body:', errorBody);
          errorDetail = errorBody || errorDetail;
        } catch (e) {
          // Ignore JSON parse errors
        }

        return {
          success: false,
          error: errorDetail,
        };
      }

      const result = await response.json();
      console.log('Backend result:', result);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Backend service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
      };
    }
  }

  // Process the API response and normalize the data
  processApiResponse(result: BackendApiResponse, recordingId: string, originalRecording?: Partial<SavedRecording>): SavedRecording {
    // Extract transcript with fallback paths (matching your Electron app logic)
    const transcript = result.transcription?.formattedTranscript ||
                      result.transcription?.fullTranscript ||
                      result.transcript ||
                      result.fullTranscript ||
                      '';

    // Extract summary with fallback paths (string or object)
    const summary = typeof result.summary === 'string'
      ? result.summary
      : (result.summary?.executiveSummary || result.summary?.summary || '');

    // Extract action items with fallback paths (support decisions array)
    let actionItems = [] as Array<unknown>;
    const ai = result.actionItems as unknown;
    if (Array.isArray(ai)) {
      actionItems = ai;
    } else if (ai && typeof ai === 'object') {
      const obj = ai as Record<string, unknown>;
      if (Array.isArray(obj.items)) actionItems = obj.items as Array<unknown>;
      else if (Array.isArray(obj.decisions)) actionItems = obj.decisions as Array<unknown>;
      else if (Array.isArray(obj.actionItems)) actionItems = obj.actionItems as Array<unknown>;
    }

    // Normalize speaker data: segments + mapping
    const speakerSegments = result.transcription?.speakerSegments || result.speakerSegments || null;
    const speakerMappingRaw = result.transcription?.speakers || result.speakers || null;
    let speakers: Record<string, unknown> = {};

    if (speakerSegments || speakerMappingRaw) {
      let speakersArray: Array<{ id: string; name: string }> = [];
      if (Array.isArray(speakerMappingRaw)) {
        // Support array like [{ name: 'spk_1' }, ...] without id
        speakersArray = (speakerMappingRaw as unknown[]).map((sp, idx) => {
          const s = (sp || {}) as Record<string, unknown>;
          const id = (s.id || s.speakerId || s.label || s.name || `spk_${idx + 1}`) as string;
          const name = (s.name || s.label || s.displayName || id) as string;
          return { id, name };
        });
      } else if (speakerMappingRaw && typeof speakerMappingRaw === 'object') {
        speakersArray = Object.keys(speakerMappingRaw).map((id) => ({
          id,
          name: (speakerMappingRaw as Record<string, string>)[id]
        }));
      }
      speakers = {
        segments: speakerSegments || [],
        speakers: speakersArray
      };
    }

    // Extract tags
    const tags = result.summary?.keyInsights ||
                result.tags ||
                [];

    // Combine metadata
    const metadata = {
      ...result.businessMetrics,
      ...result.metadata,
      wordCount: result.businessMetrics?.transcriptWordCount || 0,
      processingSuccess: result.success || false
    };

    // Auto-build speaker name map using backend speakers and summary participants
    const speakerNameMap = this.buildAutoSpeakerNameMap(transcript, speakers, summary);

    return {
      id: recordingId,
      filename: originalRecording?.filename || 'recording.wav',
      timestamp: originalRecording?.timestamp || new Date().toISOString(),
      createdAt: originalRecording?.createdAt || originalRecording?.timestamp || new Date().toISOString(),
      duration: originalRecording?.duration || 0,
      fileSize: originalRecording?.fileSize || originalRecording?.size || 0,
      size: originalRecording?.size || 0,
      type: originalRecording?.type || 'uploaded',
      processed: true,
      fileId: result.fileId || `processed-${Date.now()}`,
      transcript,
      summary,
      tags,
      metadata,
      actionItems: actionItems as Array<string | ActionItem | Record<string, unknown>>,
      speakers,
      speakerNameMap
    };
  }

  private buildAutoSpeakerNameMap(
    transcriptText: string,
    speakersNormalized: Record<string, unknown>,
    summaryText: string
  ): Record<string, string> {
    const map: Record<string, string> = {};

    // From normalized speakers mapping
    if (speakersNormalized) {
      if (Array.isArray(speakersNormalized)) {
        speakersNormalized.forEach((sp: unknown) => {
          const speaker = sp as Record<string, unknown>;
          const id = speaker?.id || speaker?.speakerId || speaker?.label;
          const name = speaker?.name || speaker?.label || speaker?.displayName;
          if (id && name) map[String(id)] = String(name);
        });
      } else if (Array.isArray((speakersNormalized as Record<string, unknown>).speakers)) {
        ((speakersNormalized as Record<string, unknown>).speakers as unknown[]).forEach((sp: unknown) => {
          const speaker = sp as Record<string, unknown>;
          const id = speaker?.id || speaker?.speakerId || speaker?.label;
          const name = speaker?.name || speaker?.label || speaker?.displayName;
          if (id && name) map[String(id)] = String(name);
        });
      } else if (speakersNormalized && typeof speakersNormalized === 'object') {
        Object.keys(speakersNormalized).forEach((id) => {
          const val = speakersNormalized[id];
          if (typeof val === 'string') map[id] = val;
          else if (val && typeof val === 'object') {
            const valObj = val as Record<string, unknown>;
            const nm = valObj.name || valObj.label || valObj.displayName;
            if (nm) map[id] = String(nm);
          }
        });
      }
    }

    // Extract ordered raw IDs from transcript header lines
    const rawIds: string[] = [];
    try {
      const re = /\[[^\]]+\]\s*([^:]+):\s*"/g;
      const seen = new Set<string>();
      let m;
      while ((m = re.exec(transcriptText || '')) !== null) {
        const id = (m[1] || '').trim();
        if (id && !seen.has(id)) {
          seen.add(id);
          rawIds.push(id);
        }
      }
    } catch {}

    // Extract participant names from summary (e.g., "- Alec:", "Alec:")
    const names: string[] = [];
    try {
      const lines = (summaryText || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
      lines.forEach(line => {
        let mm = line.match(/^[-\*]\s*([A-Za-z][A-Za-z\s.'-]{0,50}):\s+/);
        if (!mm) mm = line.match(/^([A-Za-z][A-Za-z\s.'-]{0,50}):\s+/);
        if (mm) names.push(mm[1].trim());
      });
    } catch {}

    const limit = Math.min(names.length, rawIds.length);
    for (let i = 0; i < limit; i++) {
      const rid = rawIds[i];
      if (!map[rid]) map[rid] = names[i];
    }

    return map;
  }

  async getRecording(id: string): Promise<BackendResponse<Recording>> {
    return this.request<Recording>(`/api/recordings/${id}`);
  }

  async getRecordings(limit: number = 20, offset: number = 0): Promise<BackendResponse<Recording[]>> {
    return this.request<Recording[]>(`/api/recordings?limit=${limit}&offset=${offset}`);
  }

  async deleteRecording(id: string): Promise<BackendResponse<void>> {
    return this.request<void>(`/api/recordings/${id}`, {
      method: 'DELETE',
    });
  }

  // Transcription management
  async startTranscription(recordingId: string, language: string = 'auto'): Promise<BackendResponse<Transcription>> {
    return this.request<Transcription>('/api/transcriptions', {
      method: 'POST',
      body: JSON.stringify({ recordingId, language }),
    });
  }

  async getTranscription(id: string): Promise<BackendResponse<Transcription>> {
    return this.request<Transcription>(`/api/transcriptions/${id}`);
  }

  async getTranscriptionByRecording(recordingId: string): Promise<BackendResponse<Transcription>> {
    return this.request<Transcription>(`/api/recordings/${recordingId}/transcription`);
  }

  async getTranscriptionProgress(recordingId: string): Promise<BackendResponse<TranscriptionProgress>> {
    return this.request<TranscriptionProgress>(`/api/recordings/${recordingId}/progress`);
  }

  // Summary management
  async generateSummary(
    transcriptionId: string,
    type: Summary['type'] = 'brief',
    templateId?: string
  ): Promise<BackendResponse<Summary>> {
    return this.request<Summary>('/api/summaries', {
      method: 'POST',
      body: JSON.stringify({ transcriptionId, type, templateId }),
    });
  }

  // Optional: fetch available templates from backend if supported
  async getSummaryTemplates(): Promise<BackendResponse<Array<{ id: string; name: string; description?: string; type?: string }>>> {
    return this.request<Array<{ id: string; name: string; description?: string; type?: string }>>('/api/summaries/templates');
  }

  async getSummary(id: string): Promise<BackendResponse<Summary>> {
    return this.request<Summary>(`/api/summaries/${id}`);
  }

  async getSummariesByTranscription(transcriptionId: string): Promise<BackendResponse<Summary[]>> {
    return this.request<Summary[]>(`/api/transcriptions/${transcriptionId}/summaries`);
  }

  // Export functionality
  async exportTranscription(
    transcriptionId: string,
    options: ExportOptions
  ): Promise<BackendResponse<{ downloadUrl: string }>> {
    return this.request<{ downloadUrl: string }>('/api/export/transcription', {
      method: 'POST',
      body: JSON.stringify({ transcriptionId, options }),
    });
  }

  async exportSummary(
    summaryId: string,
    format: ExportOptions['format']
  ): Promise<BackendResponse<{ downloadUrl: string }>> {
    return this.request<{ downloadUrl: string }>('/api/export/summary', {
      method: 'POST',
      body: JSON.stringify({ summaryId, format }),
    });
  }

  // Real-time updates via Server-Sent Events
  subscribeToProgress(recordingId: string, onProgress: (progress: TranscriptionProgress) => void): EventSource {
    const eventSource = new EventSource(`${this.baseUrl}/api/recordings/${recordingId}/progress-stream`);

    eventSource.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data) as TranscriptionProgress;
        onProgress(progress);
      } catch (error) {
        console.error('Error parsing progress update:', error);
      }
    };

    return eventSource;
  }

  // Health check
  async healthCheck(): Promise<BackendResponse<{ status: string; version: string }>> {
    return this.request<{ status: string; version: string }>('/api/health');
  }

  // Template system
  async getAvailableTemplates(): Promise<BackendResponse<TemplateAvailableItem[]>> {
    return this.request<TemplateAvailableItem[]>('/api/templates/available');
  }

  async getTemplateConfig(type: TemplateType): Promise<BackendResponse<TemplateConfig>> {
    return this.request<TemplateConfig>(`/api/templates/${type}/config`);
  }

  async generateTemplate(payload: TemplateGenerateRequest): Promise<BackendResponse<TemplateGenerateResponse>> {
    return this.request<TemplateGenerateResponse>('/api/templates/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async generateMultipleTemplates(payload: TemplateGenerateMultipleRequest): Promise<BackendResponse<TemplateComparison[]>> {
    return this.request<TemplateComparison[]>('/api/templates/generate-multiple', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async previewTemplate(payload: TemplatePreviewRequest): Promise<BackendResponse<TemplatePreviewResponse>> {
    return this.request<TemplatePreviewResponse>('/api/templates/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async exportTemplate(payload: TemplateExportRequest): Promise<BackendResponse<{ downloadUrl: string }>> {
    return this.request<{ downloadUrl: string }>('/api/templates/export', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getTemplateStats(): Promise<BackendResponse<TemplateStats>> {
    return this.request<TemplateStats>('/api/templates/stats');
  }

  // Private request method for API calls
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<BackendResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.text();
          errorDetail = errorBody || errorDetail;
        } catch (e) {
          // Ignore parse errors
        }

        return {
          success: false,
          error: errorDetail,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
      };
    }
  }

  // Configuration
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }
}

export const backendApi = new BackendApiService();