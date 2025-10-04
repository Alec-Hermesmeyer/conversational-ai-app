import { Transcription, TranscriptionSegment, Summary, ExportOptions } from '@/types/backend';

export class ExportUtility {
  static downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static exportAsText(
    transcription: Transcription,
    options: Partial<ExportOptions> = {}
  ): void {
    const {
      includeTimestamps = true,
      speakerLabels = true,
      includeSummary = false,
    } = options;

    let content = '';

    // Header
    content += `Transcription Export\n`;
    content += `Generated: ${new Date().toLocaleString()}\n`;
    content += `Language: ${transcription.language}\n`;
    content += `Confidence: ${Math.round(transcription.confidence * 100)}%\n`;
    content += `\n${'='.repeat(50)}\n\n`;

    // Full text
    if (transcription.fullText) {
      content += `Full Text:\n\n${transcription.fullText}\n\n`;
      content += `${'='.repeat(50)}\n\n`;
    }

    // Detailed segments
    content += `Detailed Transcript:\n\n`;
    transcription.segments.forEach((segment, index) => {
      content += `[${index + 1}] `;

      if (includeTimestamps) {
        const startTime = this.formatTime(segment.startTime);
        const endTime = this.formatTime(segment.endTime);
        content += `${startTime} - ${endTime} `;
      }

      if (speakerLabels && segment.speaker) {
        content += `${segment.speaker}: `;
      }

      content += `${segment.text}`;

      content += ` (${Math.round(segment.confidence * 100)}%)`;
      content += `\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    this.downloadBlob(blob, `transcription-${transcription.id}.txt`);
  }

  static exportAsSRT(transcription: Transcription): void {
    let content = '';

    transcription.segments.forEach((segment, index) => {
      const startTime = this.formatSRTTime(segment.startTime);
      const endTime = this.formatSRTTime(segment.endTime);

      content += `${index + 1}\n`;
      content += `${startTime} --> ${endTime}\n`;
      content += `${segment.text}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    this.downloadBlob(blob, `transcription-${transcription.id}.srt`);
  }

  static exportAsVTT(transcription: Transcription): void {
    let content = 'WEBVTT\n\n';

    transcription.segments.forEach((segment) => {
      const startTime = this.formatVTTTime(segment.startTime);
      const endTime = this.formatVTTTime(segment.endTime);

      content += `${startTime} --> ${endTime}\n`;
      content += `${segment.text}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/vtt' });
    this.downloadBlob(blob, `transcription-${transcription.id}.vtt`);
  }

  static exportAsJSON(
    transcription: Transcription,
    summary?: Summary
  ): void {
    const data = {
      transcription,
      summary,
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };

    const content = JSON.stringify(data, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    this.downloadBlob(blob, `transcription-${transcription.id}.json`);
  }

  static exportSummaryAsText(summary: Summary): void {
    let content = '';

    content += `Summary Export\n`;
    content += `Type: ${summary.type}\n`;
    content += `Generated: ${new Date(summary.createdAt).toLocaleString()}\n`;
    content += `\n${'='.repeat(50)}\n\n`;

    content += `Summary:\n\n${summary.content}\n\n`;

    if (summary.keyPoints.length > 0) {
      content += `${'='.repeat(50)}\n\n`;
      content += `Key Points:\n\n`;
      summary.keyPoints.forEach((point, index) => {
        content += `${index + 1}. ${point}\n`;
      });
      content += `\n`;
    }

    if (summary.actionItems && summary.actionItems.length > 0) {
      content += `${'='.repeat(50)}\n\n`;
      content += `Action Items:\n\n`;
      summary.actionItems.forEach((item, index) => {
        content += `${index + 1}. ${item.text}`;
        if (item.priority) {
          content += ` (${item.priority.toUpperCase()})`;
        }
        if (item.dueDate) {
          content += ` - Due: ${new Date(item.dueDate).toLocaleDateString()}`;
        }
        if (item.assignee) {
          content += ` - Assigned to: ${item.assignee}`;
        }
        content += `\n`;
      });
      content += `\n`;
    }

    if (summary.tags.length > 0) {
      content += `${'='.repeat(50)}\n\n`;
      content += `Tags: ${summary.tags.join(', ')}\n`;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    this.downloadBlob(blob, `summary-${summary.id}.txt`);
  }

  static exportCombined(
    transcription: Transcription,
    summaries: Summary[],
    options: Partial<ExportOptions> = {}
  ): void {
    let content = '';

    // Header
    content += `Audio Recording Analysis\n`;
    content += `Generated: ${new Date().toLocaleString()}\n`;
    content += `Recording ID: ${transcription.recordingId}\n`;
    content += `\n${'='.repeat(60)}\n\n`;

    // Summaries
    if (summaries.length > 0) {
      content += `SUMMARIES\n\n`;
      summaries.forEach((summary, index) => {
        content += `${index + 1}. ${summary.type.toUpperCase()} SUMMARY\n`;
        content += `${'-'.repeat(30)}\n`;
        content += `${summary.content}\n\n`;

        if (summary.keyPoints.length > 0) {
          content += `Key Points:\n`;
          summary.keyPoints.forEach(point => content += `• ${point}\n`);
          content += `\n`;
        }

        if (summary.actionItems && summary.actionItems.length > 0) {
          content += `Action Items:\n`;
          summary.actionItems.forEach(item => {
            content += `• ${item.text}`;
            if (item.priority) content += ` (${item.priority})`;
            content += `\n`;
          });
          content += `\n`;
        }
      });

      content += `${'='.repeat(60)}\n\n`;
    }

    // Full Transcription
    content += `FULL TRANSCRIPTION\n\n`;
    content += `Language: ${transcription.language}\n`;
    content += `Confidence: ${Math.round(transcription.confidence * 100)}%\n\n`;

    if (options.includeTimestamps) {
      transcription.segments.forEach((segment, index) => {
        const startTime = this.formatTime(segment.startTime);
        const endTime = this.formatTime(segment.endTime);
        content += `[${startTime}-${endTime}] `;

        if (options.speakerLabels && segment.speaker) {
          content += `${segment.speaker}: `;
        }

        content += `${segment.text}\n`;
      });
    } else {
      content += transcription.fullText;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    this.downloadBlob(blob, `recording-analysis-${transcription.recordingId}.txt`);
  }

  private static formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private static formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const milliseconds = Math.floor((secs % 1) * 1000);
    const wholeSeconds = Math.floor(secs);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${wholeSeconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  }

  private static formatVTTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const milliseconds = Math.floor((secs % 1) * 1000);
    const wholeSeconds = Math.floor(secs);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${wholeSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }
}