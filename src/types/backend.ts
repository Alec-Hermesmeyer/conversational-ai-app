// Updated to match your backend API structure
export interface SavedRecording {
  id: string;
  filename: string;
  timestamp: string;
  createdAt: string;  // Add for consistency with UI
  duration: number;
  fileSize: number;   // Match what UI expects
  size: number;
  type: 'manual' | 'uploaded';
  transcription?: string | null;
  processed: boolean;
  fileId?: string;
  transcript?: string;
  summary?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  actionItems?: Array<ActionItem | string | Record<string, unknown>>;
  speakers?: Record<string, unknown>;
  speakerNameMap?: Record<string, string>;
  error?: string;     // Add error field
}

export interface BackendApiResponse {
  success?: boolean;
  fileId?: string;
  // Transcription data with multiple possible paths
  transcription?: {
    formattedTranscript?: string;
    fullTranscript?: string;
    speakerSegments?: SpeakerSegment[];
    speakers?: Record<string, string>;
  };
  transcript?: string;
  fullTranscript?: string;

  // Summary data with multiple possible paths
  summary?: {
    executiveSummary?: string;
    summary?: string;
    keyInsights?: string[];
  };

  // Action items with multiple possible paths
  actionItems?: {
    items?: ActionItem[];
  } | ActionItem[];

  // Speaker data
  speakerSegments?: SpeakerSegment[];
  speakers?: Record<string, string>;

  // Tags and insights
  tags?: string[];

  // Business metrics and metadata
  businessMetrics?: {
    transcriptWordCount?: number;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
}

export interface SpeakerSegment {
  start: number;
  end: number;
  speaker: string;
  text: string;
}

export interface TranscriptionSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  speaker?: string;
}

export interface Recording {
  id: string;
  filename: string;
  timestamp: string;
  duration: number;
  size: number;
  type: 'manual' | 'uploaded';
  processed: boolean;
  fileId?: string;
  transcript?: string;
  summary?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  actionItems?: ActionItem[];
  speakers?: Record<string, unknown>;
  speakerNameMap?: Record<string, string>;
}

export interface Transcription {
  id: string;
  recordingId: string;
  language: string;
  formattedTranscript?: string;
  fullTranscript?: string;
  transcript?: string;
  speakerSegments?: SpeakerSegment[];
  speakers?: Record<string, string>;
  confidence?: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

export interface Summary {
  id: string;
  transcriptionId: string;
  type?: 'brief' | 'detailed' | 'action_items' | 'key_points' | string;
  executiveSummary?: string;
  summary?: string;
  content?: string;
  keyInsights?: string[];
  keyPoints?: string[];
  actionItems?: ActionItem[];
  tags?: string[];
  createdAt: Date;
}

export interface ActionItem {
  id: string;
  text: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  assignee?: string;
  completed: boolean;
}

export interface BackendResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface TranscriptionProgress {
  recordingId: string;
  progress: number;
  stage: 'uploading' | 'processing' | 'transcribing' | 'summarizing' | 'completed';
  estimatedTimeRemaining?: number;
}

export interface ExportOptions {
  format: 'txt' | 'json' | 'srt' | 'vtt' | 'docx' | 'pdf';
  includeTimestamps: boolean;
  includeSummary: boolean;
  includeActionItems: boolean;
  speakerLabels: boolean;
}

// Template system types
export type TemplateType =
  | 'executive_summary'
  | 'meeting_notes'
  | 'action_items'
  | 'project_brief'
  | 'daily_standup'
  | 'weekly_report'
  | 'client_update'
  | 'technical_review';

export type TemplateFormat = 'markdown' | 'html' | 'pdf' | 'rtf';

export type TemplateStyle = 'professional' | 'casual' | 'bullet';

export type TemplateDetailLevel = 'brief' | 'standard' | 'detailed';

export interface TemplateAvailableItem {
  type: TemplateType;
  name: string;
  description?: string;
}

export interface TemplateSectionsConfig {
  [sectionId: string]: boolean;
}

export interface TemplateConfig {
  type: TemplateType;
  defaultFormat: TemplateFormat;
  availableFormats: TemplateFormat[];
  defaultStyle: TemplateStyle;
  availableStyles: TemplateStyle[];
  defaultDetail: TemplateDetailLevel;
  availableDetails: TemplateDetailLevel[];
  sections: TemplateSectionsConfig;
}

export interface TemplateContext {
  meetingTitle?: string;
  transcript?: string;
  summary?: string;
  tags?: string[];
  actionItems?: Array<ActionItem | string | Record<string, unknown>>;
  speakers?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface TemplateOptions {
  format?: TemplateFormat;
  style?: TemplateStyle;
  detail?: TemplateDetailLevel;
  sections?: TemplateSectionsConfig;
}

export interface TemplateGenerateRequest extends TemplateContext {
  type: TemplateType;
  options?: TemplateOptions;
}

export interface TemplateGenerateResponse {
  type: TemplateType;
  content: string; // canonical string for display
  markdown?: string;
  html?: string;
  rtf?: string;
  stats?: TemplateStats;
}

export interface TemplateGenerateMultipleRequest extends TemplateContext {
  types: TemplateType[];
  options?: TemplateOptions;
}

export interface TemplateComparison {
  type: TemplateType;
  content: string;
  stats?: TemplateStats;
}

export interface TemplatePreviewRequest extends TemplateContext {
  type: TemplateType;
  options?: TemplateOptions;
}

export interface TemplatePreviewResponseSection {
  id: string;
  title: string;
  snippet?: string;
}

export interface TemplatePreviewResponse {
  type: TemplateType;
  outline: TemplatePreviewResponseSection[];
  sections?: Record<string, string>;
}

export interface TemplateExportRequest {
  type: TemplateType;
  format: TemplateFormat;
  content?: string; // optionally pass client-side generated content
  options?: TemplateOptions;
}

export interface TemplateStats {
  totalGenerations: number;
  uniqueUsers?: number;
  byTemplate?: Record<TemplateType, number>;
  avgCompressionRatio?: number; // summary length / transcript length
  lastUsedAt?: string;
}