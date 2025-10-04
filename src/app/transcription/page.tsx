"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import TemplatesPanel from '@/components/TemplatesPanel'
import { pollLatestFor30s, fetchRecordings, buildDownloadUrl } from '@/services/electronHttp'

interface SavedRecording {
  id: string
  filename: string
  timestamp: string
  duration: number
  size: number
  type: 'manual' | 'uploaded'
  transcription?: string | null
  processed: boolean
  fileId?: string
  transcript?: string
  summary?: string
  tags?: string[]
  metadata?: any
  actionItems?: any[]
  speakers?: any[]
  speakerNameMap?: Record<string, string>
}

const safeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch {
      // Ignore storage errors
    }
  }
}

export default function TranscriptionApp() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = safeStorage.get('console.theme')
    return stored === 'light' ? 'light' : 'dark'
  })

  // Apply theme to document for Tailwind dark mode
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  // Recordings state
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([])
  const [uploadingFile, setUploadingFile] = useState<boolean>(false)
  const [processingRecordingIds, setProcessingRecordingIds] = useState<string[]>([])
  const [selectedRecording, setSelectedRecording] = useState<SavedRecording | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'size' | 'processed'>('newest')
  const [viewMode, setViewMode] = useState<'list' | 'details' | 'templates'>('list')

  // Audio state
  const [recordingAudioUrls, setRecordingAudioUrls] = useState<Record<string, string>>({})
  const attachedAudioIds = useRef<Set<string>>(new Set())

  // Load recordings from storage
  const readRecordingsFromStorage = (): SavedRecording[] => {
    const raw = safeStorage.get('saved-recordings')
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as SavedRecording[]) : []
    } catch (error) {
      console.warn('Failed to parse saved recordings from storage:', error)
      return []
    }
  }

  useEffect(() => {
    const loadRecordings = () => {
      const recordings = readRecordingsFromStorage()
      setSavedRecordings(recordings)
    }

    loadRecordings()

    // Listen for new recordings
    const handleNewRecording = () => loadRecordings()
    const refreshInterval = setInterval(() => {
      const recordings = readRecordingsFromStorage()
      if (recordings.length !== savedRecordings.length) {
        setSavedRecordings(recordings)
      }
    }, 2000)

    window.addEventListener('recording-saved', handleNewRecording)

    return () => {
      window.removeEventListener('recording-saved', handleNewRecording)
      clearInterval(refreshInterval)
    }
  }, [savedRecordings.length])

  useEffect(() => {
    if (!selectedRecording) return
    const updated = savedRecordings.find((recording) => recording.id === selectedRecording.id)
    if (updated && updated !== selectedRecording) {
      setSelectedRecording(updated)
    }
  }, [savedRecordings, selectedRecording])

  // IndexedDB helpers
  const openAudioDb = async (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      // Open without explicit version to avoid VersionError when a higher version already exists
      const request = indexedDB.open('AudioRecordings')
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('recordings')) {
          db.createObjectStore('recordings', { keyPath: 'id' })
        }
      }
      request.onsuccess = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('recordings')) {
          // Bump version to create the missing store
          const next = db.version + 1
          db.close()
          const upgradeReq = indexedDB.open('AudioRecordings', next)
          upgradeReq.onerror = () => reject(upgradeReq.error)
          upgradeReq.onupgradeneeded = () => {
            const upDb = upgradeReq.result
            if (!upDb.objectStoreNames.contains('recordings')) {
              upDb.createObjectStore('recordings', { keyPath: 'id' })
            }
          }
          upgradeReq.onsuccess = () => resolve(upgradeReq.result)
        } else {
          resolve(db)
        }
      }
    })
  }

  const getAudioBlob = async (id: string): Promise<Blob | null> => {
    const db = await openAudioDb()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['recordings'], 'readonly')
      const store = transaction.objectStore('recordings')
      const getRequest = store.get(id)
      getRequest.onerror = () => reject(getRequest.error)
      getRequest.onsuccess = () => {
        const result = getRequest.result
        resolve(result ? result.blob : null)
      }
      transaction.oncomplete = () => db.close()
      transaction.onerror = () => db.close()
      transaction.onabort = () => db.close()
    })
  }

  const storeAudioBlob = async (id: string, blob: Blob): Promise<void> => {
    const db = await openAudioDb()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['recordings'], 'readwrite')
      const store = transaction.objectStore('recordings')
      const putRequest = store.put({ id, blob })
      putRequest.onerror = () => reject(putRequest.error)
      putRequest.onsuccess = () => resolve()
      transaction.oncomplete = () => db.close()
      transaction.onerror = () => db.close()
      transaction.onabort = () => db.close()
    })
  }

  // File upload
  const handleFileUpload = async (file: File) => {
    setUploadingFile(true)
    try {
      const timestamp = new Date().toISOString()
      const uploadedRecording: SavedRecording = {
        id: `upload-${Date.now()}`,
        filename: file.name,
        timestamp,
        duration: 0,
        size: file.size,
        type: 'uploaded',
        transcription: null,
        processed: false
      }

      await storeAudioBlob(uploadedRecording.id, file)
      const existingRecordings = readRecordingsFromStorage()
      const updatedRecordings = [...existingRecordings, uploadedRecording]
      safeStorage.set('saved-recordings', JSON.stringify(updatedRecordings))
      setSavedRecordings(updatedRecordings)
    } catch (error) {
      console.error('Failed to upload file:', error)
      alert('Failed to upload file.')
    } finally {
      setUploadingFile(false)
    }
  }

  // Watch tray: poll for a freshly saved file for ~30s, then upload automatically
  const handleWatchTray = async () => {
    try {
      setUploadingFile(true)
      const url = await pollLatestFor30s(2000, 30000)
      if (!url) {
        alert('No recording found from tray within 30s. Stop the tray recording first.')
        return
      }
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Download failed: ${res.status}`)
      const blob = await res.blob()
      const filename = 'recording.wav'
      await handleFileUpload(new File([blob], filename, { type: blob.type || 'audio/wav' }))
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Failed to pick up recording')
    } finally {
      setUploadingFile(false)
    }
  }

  // One-click import: list all tray recordings and pick the most recent by modifiedAt/createdAt
  const handleImportLatestFromTray = async () => {
    try {
      setUploadingFile(true)
      const list = await fetchRecordings()
      if (!('success' in list) || !list.success || !list.data || list.data.length === 0) {
        alert('No tray recordings found. Stop recording first, then try again.')
        return
      }
      const sorted = [...list.data].sort((a, b) => {
        const aTime = new Date(a.modifiedAt || a.createdAt).getTime()
        const bTime = new Date(b.modifiedAt || b.createdAt).getTime()
        return bTime - aTime
      })
      const latest = sorted[0]
      const url = buildDownloadUrl(latest.sessionId)
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Download failed: ${res.status}`)
      const blob = await res.blob()
      const filename = latest.filename || 'recording.webm'
      await handleFileUpload(new File([blob], filename, { type: blob.type || 'audio/webm' }))
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Failed to import latest tray recording')
    } finally {
      setUploadingFile(false)
    }
  }

  // Processing
  const processRecording = async (recording: SavedRecording) => {
    let alreadyQueued = false
    setProcessingRecordingIds((prev) => {
      if (prev.includes(recording.id)) {
        alreadyQueued = true
        return prev
      }
      return [...prev, recording.id]
    })
    if (alreadyQueued) return

    try {
      const audioBlob = await getAudioBlob(recording.id)
      if (!audioBlob) {
        alert('Audio file not found.')
        return
      }

      const formData = new FormData()
      formData.append('audio', audioBlob, recording.filename)
      formData.append('meetingTitle', recording.filename.replace(/\.[^/.]+$/, ""))
      formData.append('language', 'en')
      formData.append('generateSummary', 'true')
      formData.append('extractActionItems', 'true')
      formData.append('createSearchIndex', 'true')

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || ''}/api/meeting-intelligence/process-complete`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(300000)
      })

      if (!response.ok) {
        throw new Error(`Processing failed: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('Backend response:', result) // Debug log to see actual structure

      // Extract data with multiple fallback paths
      const transcript = result.transcription?.formattedTranscript ||
                        result.transcription?.fullTranscript ||
                        result.transcript ||
                        result.fullTranscript ||
                        ''

      const summary = result.summary?.executiveSummary ||
                     result.summary?.summary ||
                     result.summary ||
                     ''

      const actionItems = result.actionItems?.items ||
                         result.actionItems ||
                         []

      // Normalize speaker data: segments + mapping
      const speakerSegments = result.transcription?.speakerSegments || result.speakerSegments || null
      const speakerMappingRaw = result.transcription?.speakers || result.speakers || null
      let speakers: any = {}
      if (speakerSegments || speakerMappingRaw) {
        // Normalize mapping into an array of { id, name }
        let speakersArray: any[] = []
        if (Array.isArray(speakerMappingRaw)) {
          speakersArray = speakerMappingRaw
        } else if (speakerMappingRaw && typeof speakerMappingRaw === 'object') {
          speakersArray = Object.keys(speakerMappingRaw).map((id) => ({ id, name: (speakerMappingRaw as any)[id] }))
        }
        speakers = {
          segments: speakerSegments || [],
          speakers: speakersArray
        }
      } else {
        speakers = {}
      }

      const tags = result.summary?.keyInsights ||
                  result.tags ||
                  []

      const metadata = {
        ...result.businessMetrics,
        ...result.metadata,
        wordCount: result.businessMetrics?.transcriptWordCount || 0,
        processingSuccess: result.success || false
      }

      // Auto-build speaker name map using backend speakers and summary participants
      const buildAutoSpeakerNameMap = (
        transcriptText: string,
        speakersNormalized: any,
        summaryText: string
      ): Record<string, string> => {
        const map: Record<string, string> = {}

        // From normalized speakers mapping
        if (speakersNormalized) {
          if (Array.isArray(speakersNormalized)) {
            speakersNormalized.forEach((sp: any) => {
              const id = sp?.id || sp?.speakerId || sp?.label
              const name = sp?.name || sp?.label || sp?.displayName
              if (id && name) map[String(id)] = String(name)
            })
          } else if (Array.isArray((speakersNormalized as any).speakers)) {
            ;(speakersNormalized as any).speakers.forEach((sp: any) => {
              const id = sp?.id || sp?.speakerId || sp?.label
              const name = sp?.name || sp?.label || sp?.displayName
              if (id && name) map[String(id)] = String(name)
            })
          } else if (speakersNormalized && typeof speakersNormalized === 'object') {
            Object.keys(speakersNormalized).forEach((id) => {
              const val = (speakersNormalized as any)[id]
              if (typeof val === 'string') map[id] = val
              else if (val && typeof val === 'object') {
                const nm = val.name || val.label || val.displayName
                if (nm) map[id] = String(nm)
              }
            })
          }
        }

        // Extract ordered raw IDs from transcript header lines
        const rawIds: string[] = []
        try {
          const re = /\[[^\]]+\]\s*([^:]+):\s*"/g
          const seen = new Set<string>()
          let m
          while ((m = re.exec(transcriptText || '')) !== null) {
            const id = (m[1] || '').trim()
            if (id && !seen.has(id)) {
              seen.add(id)
              rawIds.push(id)
            }
          }
        } catch {}

        // Extract participant names from summary (e.g., "- Alec:", "Alec:")
        const names: string[] = []
        try {
          const lines = (summaryText || '').split(/\n+/).map(l => l.trim()).filter(Boolean)
          lines.forEach(line => {
            let mm = line.match(/^[-\*]\s*([A-Za-z][A-Za-z\s.'-]{0,50}):\s+/)
            if (!mm) mm = line.match(/^([A-Za-z][A-Za-z\s.'-]{0,50}):\s+/)
            if (mm) names.push(mm[1].trim())
          })
        } catch {}

        const limit = Math.min(names.length, rawIds.length)
        for (let i = 0; i < limit; i++) {
          const rid = rawIds[i]
          if (rid && !map[rid]) map[rid] = names[i]
        }

        return map
      }

      const speakerNameMap = buildAutoSpeakerNameMap(transcript, speakers, summary)

      setSavedRecordings(prev => {
        const updatedRecordings = prev.map(r =>
          r.id === recording.id
            ? {
                ...r,
                processed: true,
                fileId: result.fileId || `processed-${Date.now()}`,
                transcript,
                summary,
                tags,
                metadata,
                actionItems,
                speakers,
                speakerNameMap: { ...(r.speakerNameMap || {}), ...speakerNameMap }
              }
            : r
        )
        safeStorage.set('saved-recordings', JSON.stringify(updatedRecordings))
        return updatedRecordings
      })

      // Show success feedback
      if (transcript || summary || actionItems.length > 0) {
        console.log('Processing completed successfully!')
        console.log('Transcript length:', transcript.length)
        console.log('Summary length:', summary.length)
        console.log('Action items:', actionItems.length)
        console.log('Speakers:', Array.isArray((speakers as any).speakers) ? (speakers as any).speakers.length : 0)
      } else {
        console.warn('Processing completed but no content extracted. Check backend logs.')
      }

    } catch (error) {
      console.error('Failed to process recording:', error)
      alert(`Failed to process recording: ${(error as Error).message}`)

      // Mark as processed even if failed, so user can see what happened
      setSavedRecordings(prev => {
        const failedRecordings = prev.map(r =>
          r.id === recording.id
            ? {
                ...r,
                processed: true,
                transcript: `Processing failed: ${(error as Error).message}`,
                summary: '',
                tags: [],
                metadata: { error: true, errorMessage: (error as Error).message },
                actionItems: [],
                speakers: []
              }
            : r
        )
        safeStorage.set('saved-recordings', JSON.stringify(failedRecordings))
        return failedRecordings
      })
    } finally {
      setProcessingRecordingIds(prev => prev.filter(id => id !== recording.id))
    }
  }

  // Delete recording
  const deleteRecording = async (recording: SavedRecording) => {
    if (!confirm(`Delete recording "${recording.filename}"?`)) return

    try {
      // Remove from IndexedDB
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('AudioRecordings', 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction(['recordings'], 'readwrite')
          const store = transaction.objectStore('recordings')
          const deleteRequest = store.delete(recording.id)
          deleteRequest.onerror = () => reject(deleteRequest.error)
          deleteRequest.onsuccess = () => resolve()
        }
      })

      const updatedRecordings = savedRecordings.filter(r => r.id !== recording.id)
      setSavedRecordings(updatedRecordings)
      safeStorage.set('saved-recordings', JSON.stringify(updatedRecordings))

      if (selectedRecording?.id === recording.id) {
        setSelectedRecording(null)
      }
    } catch (error) {
      console.error('Failed to delete recording:', error)
      alert('Failed to delete recording.')
    }
  }

  // Utility functions
  const formatBytes = (bytes: number) => {
    if (bytes == null || Number.isNaN(bytes)) return '--'
    const units = ['B', 'KB', 'MB', 'GB']
    let i = 0
    let n = bytes
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024
      i += 1
    }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
  }

  const formatDuration = (seconds: number) => {
    if (!seconds || Number.isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatAggregateDuration = (seconds: number) => {
    if (!seconds || Number.isNaN(seconds)) return '--'
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60)
      return `${mins} min`
    }
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (mins == 0) return `${hours} hr`
    return `${hours} hr ${mins} min`
  }

  const formatDateLabel = (timestamp: string) => {
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return '--'
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const processedCount = useMemo(
    () => savedRecordings.filter((recording) => recording.processed).length,
    [savedRecordings]
  )

  const aggregateDuration = useMemo(
    () => savedRecordings.reduce((total, recording) => total + (recording.duration || 0), 0),
    [savedRecordings]
  )

  const aggregateSize = useMemo(
    () => savedRecordings.reduce((total, recording) => total + (recording.size || 0), 0),
    [savedRecordings]
  )

  const lastUpdatedRecording = useMemo(() => {
    if (savedRecordings.length == 0) return null
    return savedRecordings
      .slice()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
  }, [savedRecordings])

  const pendingCount = Math.max(0, savedRecordings.length - processedCount)

  const summaryMetrics = useMemo(() => {
    const total = savedRecordings.length
    const processedHint = processedCount ? 'Ready for review' : 'Process audio to review results'
    const pendingHint = pendingCount === 0
      ? 'All caught up'
      : pendingCount === 1
        ? '1 recording waiting'
        : `${pendingCount} recordings waiting`
    return [
      {
        label: 'Processed',
        value: total ? `${processedCount}/${total}` : '0',
        hint: processedHint
      },
      {
        label: 'Pending',
        value: `${pendingCount}`,
        hint: pendingHint
      },
      {
        label: 'Audio Time',
        value: formatAggregateDuration(aggregateDuration),
        hint: aggregateDuration ? 'Total captured duration' : 'Add audio to begin'
      },
      {
        label: 'Storage Used',
        value: formatBytes(aggregateSize),
        hint: aggregateSize ? 'Locally cached audio' : 'No storage usage yet'
      }
    ]
  }, [savedRecordings.length, processedCount, pendingCount, aggregateDuration, aggregateSize])

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedRecording) return 'No recordings yet'
    return `Updated ${formatDateLabel(lastUpdatedRecording.timestamp)}`
  }, [lastUpdatedRecording])

  const viewModes: Array<'list' | 'details' | 'templates'> = ['list', 'details', 'templates']

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  // Filter and sort recordings
  const filteredRecordings = savedRecordings.filter(recording => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    const searchableText = [
      recording.filename,
      recording.transcript || '',
      recording.transcription || '',
      recording.summary || '',
      ...(recording.tags || [])
    ].join(' ').toLowerCase()
    return searchableText.includes(term)
  })

  const sortedRecordings = filteredRecordings.sort((a, b) => {
    switch (sortBy) {
      case 'oldest': return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      case 'name': return a.filename.localeCompare(b.filename)
      case 'size': return (b.size || 0) - (a.size || 0)
      case 'processed': return Number(b.processed) - Number(a.processed)
      case 'newest':
      default:
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    }
  })

  return (
    <div className="w-full h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col overflow-hidden font-sans">
      {/* Header */}
      <header className="px-8 py-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex flex-wrap justify-between items-start gap-6">
          <div className="flex-1 min-w-60 max-w-80">
            <div className="uppercase tracking-wider text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
              Transcript workspace
              </div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
              Meeting intelligence
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
              {lastUpdatedLabel}
                </p>
              </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const newTheme = theme === 'light' ? 'dark' : 'light'
                setTheme(newTheme)
                safeStorage.set('console.theme', newTheme)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-gray-900 dark:text-white text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <span className="flex items-center justify-center w-5 h-5">
                {theme === 'light' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4" />
                    <line x1="12" y1="2" x2="12" y2="4" />
                    <line x1="12" y1="20" x2="12" y2="22" />
                    <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
                    <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
                    <line x1="2" y1="12" x2="4" y2="12" />
                    <line x1="20" y1="12" x2="22" y2="12" />
                    <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
                    <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
                  </svg>
                )}
              </span>
              {theme === 'light' ? 'Dark mode' : 'Light mode'}
            </button>
              </div>
            </div>

        <div className="mt-6 grid gap-4 grid-cols-[repeat(auto-fit,_minmax(160px,_1fr))]">
          {summaryMetrics.map((metric) => (
            <div key={metric.label} className="p-4 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                {metric.label}
              </span>
              <span className="text-xl font-semibold text-gray-900 dark:text-white">
                {metric.value}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {metric.hint}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3 items-center">
          <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 flex-1 min-w-72 max-w-md">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2 opacity-60">
              <circle cx="11" cy="11" r="7" />
              <line x1="16.65" y1="16.65" x2="21" y2="21" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search recordings, transcripts, summaries..."
              className="bg-transparent border-none outline-none text-gray-900 dark:text-white text-sm flex-1"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white min-w-40"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">By Name</option>
            <option value="size">By Size</option>
            <option value="processed">Processed First</option>
          </select>

          <div className="inline-flex p-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            {viewModes.map((mode) => (
                <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {mode === 'list' ? 'List' : mode === 'details' ? 'Details' : 'Templates'}
              </button>
            ))}
          </div>

          <label
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-white text-sm font-semibold ${
              uploadingFile ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
            }`}
            htmlFor="file-upload-input"
          >
            {uploadingFile ? 'Uploading...' : 'Upload audio'}
          </label>
          <button
            onClick={handleWatchTray}
            disabled={uploadingFile}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold border ${
              uploadingFile ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            } border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900`}
          >
            Watch tray (30s)
          </button>
          <button
            onClick={handleImportLatestFromTray}
            disabled={uploadingFile}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold border ${
              uploadingFile ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            } border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900`}
          >
            Import latest from tray
          </button>
          <input
            id="file-upload-input"
            type="file"
            accept="audio/*"
            className="hidden"
            disabled={uploadingFile}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                handleFileUpload(file)
                e.target.value = ''
              }
            }}
          />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'list' && (
          <RecordingsList
            recordings={sortedRecordings}
            selectedRecording={selectedRecording}
            onSelectRecording={setSelectedRecording}
            onProcessRecording={processRecording}
            onDeleteRecording={deleteRecording}
            processingRecordingIds={processingRecordingIds}
            formatBytes={formatBytes}
            formatDuration={formatDuration}
            copyToClipboard={copyToClipboard}
            getAudioBlob={getAudioBlob}
          />
        )}

        {viewMode === 'details' && selectedRecording && (
          <div className="flex-1 overflow-auto">
            <RecordingDetails
              recording={selectedRecording}
              onProcessRecording={processRecording}
              onDeleteRecording={deleteRecording}
              processingRecordingIds={processingRecordingIds}
              formatBytes={formatBytes}
              formatDuration={formatDuration}
              copyToClipboard={copyToClipboard}
              getAudioBlob={getAudioBlob}
            />
          </div>
        )}

        {viewMode === 'details' && !selectedRecording && sortedRecordings.length > 0 && (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
            Select a recording to view details
          </div>
        )}

        {sortedRecordings.length === 0 && viewMode !== 'templates' && (
          <EmptyState
            hasRecordings={savedRecordings.length > 0}
            searchTerm={searchTerm}
          />
        )}

        {viewMode === 'templates' && (
          <div className="flex-1 overflow-auto">
            <TemplatesPanel recording={selectedRecording || sortedRecordings[0]} />
          </div>
        )}
      </div>
    </div>
  )
}

// Empty State Component
function EmptyState({ hasRecordings, searchTerm }: {
  hasRecordings: boolean
  searchTerm: string
}) {
  const title = hasRecordings
    ? `No recordings match "${searchTerm}"`
    : 'Bring your first conversation online'

  const description = hasRecordings
    ? 'Try adjusting your filters or clear the search to see every recording again.'
    : 'Upload an audio file or record a session to generate transcripts, summaries, and insights.'

  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="w-full max-w-sm rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-7 py-8 text-center flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-400"
          >
            <path d="M12 3v12" />
            <path d="M8 9v3a4 4 0 0 0 8 0V9" />
            <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
            <path d="M8 19h8" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-6">{description}</p>
        <div className="mt-2 flex gap-2">
          <button
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            onClick={() => {
              const input = document.getElementById('file-upload-input') as HTMLInputElement | null
              input?.click()
            }}
          >
            Upload audio
                </button>
                <button
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm"
            onClick={() => alert('Recording is not available in this demo')}
          >
            Start recording
          </button>
        </div>
      </div>
    </div>
  )
}

// Recordings List Component
function RecordingsList({
  recordings,
  selectedRecording,
  onSelectRecording,
  onProcessRecording,
  onDeleteRecording,
  processingRecordingIds,
  formatBytes,
  formatDuration,
  copyToClipboard,
  getAudioBlob
}: {
  recordings: SavedRecording[]
  selectedRecording: SavedRecording | null
  onSelectRecording: (recording: SavedRecording | null) => void
  onProcessRecording: (recording: SavedRecording) => void
  onDeleteRecording: (recording: SavedRecording) => void
  processingRecordingIds: string[]
  formatBytes: (bytes: number) => string
  formatDuration: (seconds: number) => string
  copyToClipboard: (value: string) => Promise<void>
  getAudioBlob: (id: string) => Promise<Blob | null>
}) {
  const renderSnippet = (recording: SavedRecording) => {
    const source = recording.summary || recording.transcript || recording.transcription || ''
    if (!source) return null
    const trimmed = source.trim().replace(/\s+/g, ' ')
    if (!trimmed) return null
    const limit = 140
    const display = trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed
    return display
  }

  return (
    <div className="flex-1 flex min-h-0">
      {/* List Panel */}
      <div className="w-96 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-baseline">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Queue
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {recordings.length} total
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {processingRecordingIds.length > 0
              ? `${processingRecordingIds.length} recording${processingRecordingIds.length > 1 ? 's' : ''} processing in the background. Switching recordings will not interrupt.`
              : 'Select a recording to review details on the right.'}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {recordings.length === 0 ? (
            <div className="px-3 py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
              No recordings captured yet.
            </div>
          ) : (
            recordings.map((recording) => {
              const isSelected = selectedRecording?.id === recording.id
              const snippet = renderSnippet(recording)
              const isProcessing = processingRecordingIds.includes(recording.id)
              
              return (
                <div
                  key={recording.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectRecording(recording)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') onSelectRecording(recording)
                  }}
                  className={`rounded-xl border p-4 flex flex-col gap-3 cursor-pointer transition-all outline-none ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl text-xs font-bold flex items-center justify-center tracking-wide flex-shrink-0 ${
                        recording.type === 'manual'
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                          : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {recording.type === 'manual' ? 'REC' : 'UPL'}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 justify-between">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {recording.filename}
                        </div>
                        <div className="flex gap-2">
                          {!recording.processed && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation()
                                onProcessRecording(recording)
                              }}
                              disabled={isProcessing}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                                isProcessing
                                  ? 'bg-gray-400 text-white cursor-not-allowed'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                            >
                              {isProcessing ? 'Processing...' : 'Process'}
                            </button>
                          )}
                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              onDeleteRecording(recording)
                            }}
                            className="px-3 py-1 rounded-lg border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-semibold"
                          >
                            Delete
                </button>
                        </div>
              </div>

                      <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-gray-400">
                        <span>{new Date(recording.timestamp).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{formatBytes(recording.size)}</span>
                        {recording.duration > 0 && (
                          <>
                            <span>•</span>
                            <span>{formatDuration(recording.duration)}</span>
                          </>
                        )}
                        <span>•</span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            isProcessing
                              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                              : recording.processed
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {isProcessing ? 'Processing...' : recording.processed ? 'Processed' : 'Pending'}
                        </span>
            </div>

                      {snippet && (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                          {snippet}
          </div>
                      )}

                      {Array.isArray(recording.tags) && recording.tags.length > 0 && (
                        <div className="mt-2 flex gap-1 flex-wrap">
                          {recording.tags.slice(0, 3).map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white text-xs font-medium"
                            >
                              #{tag}
                            </span>
                          ))}
                          {recording.tags.length > 3 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              +{recording.tags.length - 3} more
                            </span>
                          )}
        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Details Panel */}
      <div className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-900">
        {selectedRecording ? (
          <RecordingDetails
            recording={selectedRecording}
            onProcessRecording={onProcessRecording}
            onDeleteRecording={onDeleteRecording}
            processingRecordingIds={processingRecordingIds}
            formatBytes={formatBytes}
            formatDuration={formatDuration}
            copyToClipboard={copyToClipboard}
            getAudioBlob={getAudioBlob}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 text-lg">
            Select a recording to view details
          </div>
        )}
      </div>
    </div>
  )
}

// Recording Details Component
function RecordingDetails({
  recording,
  onProcessRecording,
  onDeleteRecording,
  processingRecordingIds,
  formatBytes,
  formatDuration,
  copyToClipboard,
  getAudioBlob
}: {
  recording: SavedRecording
  onProcessRecording: (recording: SavedRecording) => void
  onDeleteRecording: (recording: SavedRecording) => void
  processingRecordingIds: string[]
  formatBytes: (bytes: number) => string
  formatDuration: (seconds: number) => string
  copyToClipboard: (text: string) => Promise<void>
  getAudioBlob: (id: string) => Promise<Blob | null>
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'transcript' | 'summary' | 'tags' | 'actions'>('overview')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioDuration, setAudioDuration] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [speakerNameMap, setSpeakerNameMap] = useState<Record<string, string>>(() => recording.speakerNameMap || {})
  const [newMapId, setNewMapId] = useState<string>('')
  const [newMapName, setNewMapName] = useState<string>('')
  const [saveNotice, setSaveNotice] = useState<string>('')
  
  const participantNames = useMemo(() => {
    const summary = recording.summary || ''
    const lines = summary.split(/\n+/).map(l => l.trim()).filter(Boolean)
    const names: string[] = []
    lines.forEach(line => {
      let mm = line.match(/^[-\*]\s*([A-Za-z][A-Za-z\s.'-]{0,50}):\s+/)
      if (!mm) mm = line.match(/^([A-Za-z][A-Za-z\s.'-]{0,50}):\s+/)
      if (mm) names.push(mm[1].trim())
    })
    return names
  }, [recording.summary])

  // Extract ordered unique raw speaker IDs from the transcript text
  const extractRawSpeakerIdsFromTranscript = (): string[] => {
    const t = recording.transcript || recording.transcription || ''
    const re = /\[[^\]]+\]\s*([^:]+):\s*"/g
    const seen = new Set<string>()
    const ordered: string[] = []
    let m
    while ((m = re.exec(t)) !== null) {
      const id = (m[1] || '').trim()
      if (id && !seen.has(id)) {
        seen.add(id)
        ordered.push(id)
      }
    }
    return ordered
  }

  // Load audio URL
  useEffect(() => {
    const loadAudio = async () => {
      try {
        const blob = await getAudioBlob(recording.id)
        if (blob) {
          const url = URL.createObjectURL(blob)
          setAudioUrl(url)
          return () => URL.revokeObjectURL(url)
        }
      } catch (error) {
        console.error('Failed to load audio:', error)
      }
    }
    loadAudio()
  }, [recording.id, getAudioBlob])

  const hasTranscript = !!(recording.transcript || recording.transcription)
  const hasSummary = !!recording.summary
  const hasTags = !!(recording.tags && recording.tags.length > 0)
  const hasActionItems = !!(recording.actionItems && recording.actionItems.length > 0)
  const isProcessing = processingRecordingIds.includes(recording.id)

  const detailTabs = useMemo(() => {
    const tabs: Array<{ id: 'overview' | 'transcript' | 'summary' | 'tags' | 'actions'; label: string; badge?: string }> = [
      { id: 'overview', label: 'Overview' }
    ]
    if (hasTranscript) tabs.push({ id: 'transcript', label: 'Transcript' })
    if (hasSummary) tabs.push({ id: 'summary', label: 'Summary' })
    if (hasTags) tabs.push({ id: 'tags', label: 'Tags', badge: String(recording.tags?.length || 0) })
    if (hasActionItems) tabs.push({ id: 'actions', label: 'Action Items', badge: String(recording.actionItems?.length || 0) })
    return tabs
  }, [hasTranscript, hasSummary, hasTags, hasActionItems, recording.tags, recording.actionItems])

  const summaryStats = useMemo(() => {
    const stats: Array<{ label: string; value: string }> = []
    if (recording.metadata?.wordCount) {
      stats.push({ label: 'Word count', value: recording.metadata.wordCount.toLocaleString() })
    }
    stats.push({ label: 'Action items', value: String(recording.actionItems?.length || 0) })
    stats.push({ label: 'Tags', value: String(recording.tags?.length || 0) })
    if (recording.metadata?.processingSuccess != null) {
      stats.push({ label: 'Processing', value: recording.metadata.processingSuccess ? 'Success' : 'Needs review' })
    }
    return stats
  }, [recording.metadata, recording.actionItems, recording.tags])

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-start gap-5 flex-wrap">
          <div
            className={`w-16 h-16 rounded-2xl text-sm font-bold tracking-wide flex items-center justify-center flex-shrink-0 ${
              recording.type === 'manual'
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {recording.type === 'manual' ? 'REC' : 'UPL'}
          </div>

          <div className="flex-1 min-w-80">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-60">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white break-words">
                  {recording.filename}
                </h2>

                <div className="mt-3 flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-gray-400">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      isProcessing
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                        : recording.processed
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {isProcessing ? 'Processing' : recording.processed ? 'Processed' : 'Pending'}
                  </span>

                  <span
                    className={`px-2 py-1 rounded-full border font-semibold ${
                      recording.type === 'manual'
                        ? 'border-blue-700 dark:border-blue-300 text-blue-700 dark:text-blue-300'
                        : 'border-emerald-700 dark:border-emerald-300 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {recording.type === 'manual' ? 'Recorded session' : 'Uploaded audio'}
                  </span>

                  <span>{new Date(recording.timestamp).toLocaleDateString()}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-400 opacity-70"></span>
                  <span>{formatBytes(recording.size)}</span>
                  {recording.duration > 0 && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-gray-400 opacity-70"></span>
                      <span>{formatDuration(recording.duration)}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                {!recording.processed && (
                  <button
                    onClick={() => onProcessRecording(recording)}
                    disabled={isProcessing}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                      isProcessing
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isProcessing ? 'Processing...' : 'Process'}
                  </button>
                )}

                <button
                  onClick={() => onDeleteRecording(recording)}
                  className="px-4 py-2 rounded-lg border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-semibold"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Audio Player */}
        {audioUrl && (
          <div className="mt-5 p-4 bg-gray-100 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Playback</span>
              {audioDuration != null && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDuration(audioDuration)}
                </span>
              )}
            </div>
            <audio
              controls
              className="w-full h-10"
              preload="metadata"
              src={audioUrl}
              ref={audioRef}
              onLoadedMetadata={(e) => {
                const el = e.currentTarget
                if (!isNaN(el.duration)) setAudioDuration(el.duration)
              }}
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex gap-1 flex-wrap py-3">
          {detailTabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-transparent text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`px-2 py-0 rounded-full text-xs font-semibold ${
                      isActive
                        ? 'bg-white/25 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
          </div>
    </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto bg-gray-50 dark:bg-gray-900">
        {activeTab === 'overview' && (
          <div className="mb-4">
            <div className="flex gap-2 flex-wrap items-center mb-2">
              <span className="text-gray-500 dark:text-gray-400 text-xs font-semibold">Speakers</span>
              <button
                onClick={() => {
                  // Parse names from summary Participants lines: "- Name: ..." or "Name: ..."
                  const summary = recording.summary || ''
                  const lines = summary.split(/\n+/).map(l => l.trim()).filter(Boolean)
                  const names: string[] = []
                  lines.forEach(line => {
                    let mm = line.match(/^[-\*]\s*([A-Za-z][A-Za-z\s.'-]{0,50}):\s+/)
                    if (!mm) mm = line.match(/^([A-Za-z][A-Za-z\s.'-]{0,50}):\s+/)
                    if (mm) names.push(mm[1].trim())
                  })
                  if (names.length === 0) return
                  const rawIds = extractRawSpeakerIdsFromTranscript()
                  if (rawIds.length === 0) return
                  const map: Record<string, string> = { ...speakerNameMap }
                  const limit = Math.min(names.length, rawIds.length)
                  for (let i = 0; i < limit; i++) {
                    if (!map[rawIds[i]]) map[rawIds[i]] = names[i]
                  }
                  setSpeakerNameMap(map)
                }}
                className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white text-xs cursor-pointer"
              >
                Auto-assign from Summary Participants
              </button>
              <div className="flex gap-1 items-center flex-wrap">
                <input
                  value={newMapId}
                  onChange={(e) => setNewMapId(e.target.value)}
                  placeholder="speakerId"
                  className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white text-xs min-w-40"
                />
                <input
                  value={newMapName}
                  onChange={(e) => setNewMapName(e.target.value)}
                  placeholder="display name"
                  className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white text-xs min-w-36"
                />
                <button
                  onClick={() => {
                    if (!newMapId.trim() || !newMapName.trim()) return
                    const map = { ...speakerNameMap, [newMapId.trim()]: newMapName.trim() }
                    setSpeakerNameMap(map)
                    setNewMapId('')
                    setNewMapName('')
                  }}
                  className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white text-xs cursor-pointer"
                >
                  Add Mapping
                </button>
              </div>
              <button
                onClick={() => {
                  const updated: SavedRecording = { ...recording, speakerNameMap }
                  // Update in local storage list
                  const raw = safeStorage.get('saved-recordings')
                  if (raw) {
                    try {
                      const list = JSON.parse(raw) as SavedRecording[]
                      const idx = list.findIndex(r => r.id === recording.id)
                      if (idx >= 0) {
                        list[idx] = updated
                        safeStorage.set('saved-recordings', JSON.stringify(list))
                        setSaveNotice('Saved')
                        setTimeout(() => setSaveNotice(''), 1500)
                      }
                    } catch {}
                  }
                }}
                className="px-2 py-1 rounded bg-blue-600 text-white text-xs cursor-pointer"
              >
                Save Speaker Names
              </button>
              {saveNotice && (
                <span className="text-gray-500 dark:text-gray-400 text-xs">{saveNotice}</span>
              )}
            </div>
            {Object.keys(speakerNameMap).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(speakerNameMap).map(([id, name]) => (
                  <div key={id} className="flex items-center gap-1 px-2 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs">
                    <span className="text-gray-500 dark:text-gray-400">{id}</span>
                    <input
                      value={name}
                      onChange={(e) => setSpeakerNameMap({ ...speakerNameMap, [id]: e.target.value })}
                      className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white text-xs"
                    />
                    <button
                      onClick={() => {
                        const map = { ...speakerNameMap }
                        delete map[id]
                        setSpeakerNameMap(map)
                      }}
                      className="border-none bg-transparent text-red-500 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'overview' && (
          <div className="grid gap-4">
            <div className="grid grid-cols-[repeat(auto-fit,_minmax(200px,_1fr))] gap-4">
              <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Type</div>
                <div className="text-gray-900 dark:text-white text-sm font-medium">
                  {recording.type === 'manual' ? 'Recorded' : 'Uploaded'}
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Status</div>
                <div className="text-gray-900 dark:text-white text-sm font-medium">
                  {recording.processed ? 'Processed' : (isProcessing ? 'Processing...' : 'Pending')}
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Size</div>
                <div className="text-gray-900 dark:text-white text-sm font-medium">
                  {formatBytes(recording.size)}
                </div>
              </div>

              {recording.metadata?.wordCount && (
                <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Word Count</div>
                  <div className="text-gray-900 dark:text-white text-sm font-medium">
                    {recording.metadata.wordCount.toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Preview */}
            {recording.processed && (
              <div className="grid gap-4 mt-4">
                {hasTranscript && (
                  <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Transcript Preview
                      </h4>
                      <button
                        onClick={() => setActiveTab('transcript')}
                        className="text-blue-600 bg-none border-none text-xs cursor-pointer"
                      >
                        View Full →
                      </button>
                    </div>
                    <div className="text-gray-900 dark:text-white text-sm leading-6 overflow-hidden line-clamp-3">
                      {(recording.transcript || recording.transcription || '').slice(0, 200)}
                      {(recording.transcript || recording.transcription || '').length > 200 && '...'}
                    </div>
                  </div>
                )}

                {hasSummary && (
                  <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Summary
                      </h4>
                      <button
                        onClick={() => setActiveTab('summary')}
                        className="text-blue-600 bg-none border-none text-xs cursor-pointer"
                      >
                        View Full →
                      </button>
                    </div>
                    <div className="text-gray-900 dark:text-white text-sm leading-6 overflow-hidden line-clamp-3">
                      <ReactMarkdown>{(recording.summary || '').slice(0, 200)}</ReactMarkdown>
                      {(recording.summary || '').length > 200 && '...'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'transcript' && (
          <TranscriptView
            transcript={recording.transcript || recording.transcription || ''}
            speakers={recording.speakers || {}}
            copyToClipboard={copyToClipboard}
            onSeek={(seconds: number) => {
              if (audioRef.current && Number.isFinite(seconds)) {
                audioRef.current.currentTime = Math.max(0, seconds)
                try { audioRef.current.play() } catch {}
              }
            }}
            audioDuration={audioDuration ?? undefined}
            nameOverrides={speakerNameMap}
            fallbackParticipants={participantNames}
          />
        )}

        {activeTab === 'summary' && (
          <div className="flex flex-col gap-5">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/15 via-blue-500/10 to-emerald-500/10 border border-blue-200/40 dark:border-blue-800/40">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-300">
                    <path d="M12 3l2.09 6.26L21 9.27l-5 3.64L17.18 21 12 17.77 6.82 21 8 12.91l-5-3.64 6.91-0.01L12 3z" />
                  </svg>
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Executive summary
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    High-level highlights and follow-ups extracted from this recording.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(recording.summary || '')}
                  className="px-3 py-2 bg-blue-600 text-white border-none rounded-lg text-xs font-semibold cursor-pointer shadow-lg shadow-blue-600/20"
                >
                  Copy summary
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-5 items-stretch">
              <div className="flex-1 min-w-96 p-6 bg-gradient-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white leading-7">
                <ReactMarkdown
                  components={{
                    h1: (props: any) => <h1 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">{props.children}</h1>,
                    h2: (props: any) => <h2 className="text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-white">{props.children}</h2>,
                    h3: (props: any) => <h3 className="text-lg font-semibold mt-5 mb-2 text-gray-900 dark:text-white">{props.children}</h3>,
                    p: (props: any) => <p className="text-sm md:text-base mb-3 text-gray-900 dark:text-gray-100">{props.children}</p>,
                    ul: (props: any) => <ul className="list-disc pl-5 space-y-2 mb-3">{props.children}</ul>,
                    ol: (props: any) => <ol className="list-decimal pl-5 space-y-2 mb-3">{props.children}</ol>,
                    li: (props: any) => <li className="text-sm md:text-base text-gray-900 dark:text-gray-100">{props.children}</li>,
                    blockquote: (props: any) => (
                      <blockquote className="border-l-4 border-blue-300 dark:border-blue-700 pl-4 italic text-gray-700 dark:text-gray-300 bg-blue-50/40 dark:bg-blue-900/10 rounded-r-md py-2 mb-3">{props.children}</blockquote>
                    ),
                    code: (props: any) => (
                      props.inline
                        ? <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs">{props.children}</code>
                        : <code className="block w-full p-3 rounded-md bg-gray-100 dark:bg-gray-800 text-xs overflow-auto">{props.children}</code>
                    ),
                    a: (props: any) => (
                      <a href={props.href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline decoration-blue-300/50 hover:decoration-blue-600">
                        {props.children}
                      </a>
                    ),
                    hr: () => <div className="my-4 h-px bg-gray-200 dark:bg-gray-700" />
                  }}
                >
                  {recording.summary || 'No summary available'}
                </ReactMarkdown>
              </div>

              <div className="flex-1 min-w-52 flex flex-col gap-3">
                {summaryStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="p-4 bg-gray-100 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 flex flex-col gap-1"
                  >
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{stat.label}</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tags' && (
          <div>
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Tags ({recording.tags?.length || 0})
            </h3>
            <div className="flex gap-2 flex-wrap">
              {recording.tags?.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-medium"
                >
                  #{tag}
                </span>
              )) || (
                <div className="text-gray-500 dark:text-gray-400 italic">
                  No tags available
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'actions' && (
          <div>
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Action Items ({recording.actionItems?.length || 0})
            </h3>
            <div className="flex flex-col gap-3">
              {recording.actionItems?.map((item, index) => (
                <div
                  key={index}
                  className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    {item.task || item.description || item.text}
                  </div>
                  {(item.assignee || item.owner || item.responsible) && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Assigned to: {item.assignee || item.owner || item.responsible}
                    </div>
                  )}
                  {(item.dueDate || item.deadline) && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Due: {item.dueDate || item.deadline}
                    </div>
                  )}
                  {(item.priority) && (
                    <div className={`text-xs font-medium ${
                      item.priority === 'high' ? 'text-red-500' :
                      item.priority === 'medium' ? 'text-amber-500' : 'text-emerald-500'
                    }`}>
                      Priority: {item.priority}
                    </div>
                  )}
                </div>
              )) || (
                <div className="text-gray-500 dark:text-gray-400 italic">
                  No action items identified
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Speaker-aware transcript component
function TranscriptView({
  transcript,
  speakers,
  copyToClipboard,
  onSeek,
  audioDuration,
  nameOverrides,
  fallbackParticipants
}: {
  transcript: string
  speakers: any
  copyToClipboard: (text: string) => Promise<void>
  onSeek?: (seconds: number) => void
  audioDuration?: number
  nameOverrides?: Record<string, string>
  fallbackParticipants?: string[]
}) {
  const [textScale, setTextScale] = useState<'normal' | 'large'>('normal')

  // Try to use structured speaker data when available; otherwise parse free text
  const formatTime = (value: any) => {
    if (value == null) return null
    if (typeof value === 'number' && isFinite(value)) {
      const totalSeconds = Math.max(0, Math.floor(value))
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
    if (typeof value === 'string') {
      const trimmed = value.replace(/[\[\]"]+/g, '').trim()
      // Accept HH:MM:SS, MM:SS, or plain seconds
      if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) {
        const [hh, mm, ss] = trimmed.split(':').map(Number)
        const total = hh * 3600 + mm * 60 + ss
        return formatTime(total)
      }
      if (/^\d{1,2}:\d{2}$/.test(trimmed)) return trimmed
      if (/^\d+(?:\.\d+)?$/.test(trimmed)) return formatTime(parseFloat(trimmed))
      return trimmed
    }
    return null
  }

  const toSeconds = (value: any): number | null => {
    if (value == null) return null
    if (typeof value === 'number' && isFinite(value)) return value
    if (typeof value === 'string') {
      const trimmed = value.replace(/[\[\]"]+/g, '').trim()
      if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) {
        const [hh, mm, ss] = trimmed.split(':').map(Number)
        return hh * 3600 + mm * 60 + ss
      }
      if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
        const [mm, ss] = trimmed.split(':').map(Number)
        return mm * 60 + ss
      }
      if (/^\d+(?:\.\d+)?$/.test(trimmed)) return parseFloat(trimmed)
    }
    return null
  }

  const buildSegmentsFromSpeakers = (speakerData: any, fallbackText: string) => {
    const result: Array<{ speaker: string, speakerRaw?: string, text: string, timestamp: number | string | null, start?: number, end?: number }> = []

    if (!speakerData) return result

    const pushSeg = (seg: any, defaultSpeaker?: string) => {
      if (!seg) return
      const speakerName = seg.speaker || seg.speakerLabel || seg.name || defaultSpeaker || 'Speaker'
      const speakerRaw = seg.speakerId || seg.id || seg.speaker || seg.speakerLabel || seg.name || defaultSpeaker
      const text = seg.text || seg.content || seg.transcript || ''
      const start = seg.start != null ? seg.start : (seg.startTime != null ? seg.startTime : seg.timestamp)
      if (text) {
        result.push({ speaker: String(speakerName), speakerRaw: speakerRaw ? String(speakerRaw) : undefined, text: String(text).trim(), timestamp: start ?? null, start: typeof start === 'number' ? start : undefined, end: seg.end ?? seg.endTime })
      }
    }

    // Case 1: { segments: [...] }
    if (Array.isArray(speakerData?.segments)) {
      speakerData.segments.forEach((seg: any) => pushSeg(seg))
    }

    // Case 2: Array of segments directly
    else if (Array.isArray(speakerData)) {
      // Could be [{speaker, start, end, text}] or [{name, segments:[...]}]
      speakerData.forEach((item: any) => {
        if (Array.isArray(item?.segments)) {
          item.segments.forEach((seg: any) => pushSeg(seg, item.name || item.speaker || item.label))
        } else if (item && (item.text || item.content || item.transcript || item.start != null)) {
          pushSeg(item)
        } else if (item && typeof item === 'object') {
          // Possibly map shape: { startTime, endTime, speakerLabel, transcript }
          pushSeg({
            speaker: item.speakerLabel || item.speaker || item.name,
            text: item.transcript || item.text || item.content,
            start: item.startTime ?? item.start ?? item.timestamp,
            end: item.endTime ?? item.end
          })
        }
      })
    }

    // Case 3: Object map { speakerName: [ {start,end,text}, ... ] }
    else if (typeof speakerData === 'object') {
      Object.keys(speakerData).forEach((key) => {
        const maybeArr = (speakerData as any)[key]
        if (Array.isArray(maybeArr)) {
          maybeArr.forEach((seg) => pushSeg(seg, key))
        }
      })
    }

    // Sort by start if present
    result.sort((a, b) => {
      const as = a.start ?? Number.POSITIVE_INFINITY
      const bs = b.start ?? Number.POSITIVE_INFINITY
      return as - bs
    })

    return result
  }
  
  // Parse the transcript to identify speaker segments from free text
  const parseTranscript = (text: string) => {
    if (!text) return []

    // Handle your backend format: [timestamp] speaker_id: "content"
    const backendPattern = /\[([^\]]+)\]\s*([^:]+):\s*"([^"]+)"/g
    const segments: any[] = []
    let match

    while ((match = backendPattern.exec(text)) !== null) {
      const [, timestamp, speakerId, content] = match

      const rawId = String(speakerId).trim()
      const initialSpeaker = rawId // keep raw; we'll resolve to display names later

      segments.push({
        speaker: initialSpeaker,
        speakerRaw: rawId,
        text: String(content).trim(),
        timestamp: timestamp
      })
    }

    // Fallback: try simple speaker patterns like "Speaker 1:", "John:", etc.
    if (segments.length === 0) {
      const simplePattern = /^((?:Speaker|SPEAKER)[\s_]\d+|[A-Z][a-zA-Z\s]+):\s*/gm
      let lastIndex = 0

      while ((match = simplePattern.exec(text)) !== null) {
        // Add previous segment if it exists
        if (match.index > lastIndex) {
          const prevText = text.slice(lastIndex, match.index).trim()
          if (prevText) {
            segments.push({
              speaker: 'Unknown',
              speakerRaw: 'Unknown',
              text: prevText,
              timestamp: null
            })
          }
        }

        // Find the end of this speaker's segment
        const nextMatch = simplePattern.exec(text)
        const endIndex = nextMatch ? nextMatch.index : text.length
        simplePattern.lastIndex = match.index + match[0].length // Reset for next iteration

        const speakerText = text.slice(match.index + match[0].length, endIndex).trim()
        if (speakerText) {
          segments.push({
            speaker: match[1].trim(),
            speakerRaw: match[1].trim(),
            text: speakerText,
            timestamp: null
          })
        }

        lastIndex = endIndex
      }
    }

    // Final fallback: treat as single segment
    if (segments.length === 0) {
      segments.push({
        speaker: 'Speaker',
        speakerRaw: 'Speaker',
        text: text.trim(),
        timestamp: null
      })
    }

    return segments
  }

  const structuredSegments = buildSegmentsFromSpeakers(speakers, transcript)
  
  // Further split segments by inline timestamps or by sentences when duration is known
  const splitOnInlineTimestamps = (seg: any) => {
    const text: string = seg.text || ''
    const matches: Array<{ index: number, raw: string, seconds: number | null }> = []
    const timeRe = /(\n|^)(\d{1,2}:\d{2}(?::\d{2})?)(?=\s*(\n|\s))/g
    let m
    while ((m = timeRe.exec(text)) !== null) {
      matches.push({ index: m.index + (m[1] ? m[1].length : 0), raw: m[2], seconds: toSeconds(m[2]) })
    }
    if (matches.length === 0) return [seg]

    const out: any[] = []
    let lastIndex = 0
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i]
      const next = matches[i + 1]
      const startIndex = current.index + current.raw.length
      const endIndex = next ? next.index : text.length
      const chunkText = text.slice(startIndex, endIndex).trim()
      if (chunkText) {
        out.push({
          speaker: seg.speaker,
          text: chunkText,
          timestamp: current.seconds != null ? current.seconds : (seg.timestamp ?? null),
          start: current.seconds != null ? current.seconds : seg.start,
          end: next && next.seconds != null ? next.seconds : undefined
        })
      }
      lastIndex = endIndex
    }

    // Prepend any text before the first timestamp
    const first = matches[0]
    const before = text.slice(0, first.index).trim()
    if (before) {
      out.unshift({
        speaker: seg.speaker,
        text: before,
        timestamp: seg.timestamp ?? seg.start ?? null,
        start: seg.start,
        end: first.seconds != null ? first.seconds : undefined
      })
    }
    return out.length > 0 ? out : [seg]
  }

  const splitBySentencesWithTiming = (seg: any) => {
    const start: number | undefined = typeof seg.start === 'number' ? seg.start : toSeconds(seg.timestamp)
    let end: number | undefined = typeof seg.end === 'number' ? seg.end : undefined
    if (end == null && audioDuration != null && start != null) {
      // If it's the last segment and no end, use audio duration as a bound
      end = audioDuration
    }
    if (start == null || end == null) return [seg]
    const duration = Math.max(0, end - start)
    if (duration <= 0) return [seg]

    const sentences = (seg.text || '')
      .split(/(?<=[\.!?])\s+/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0)

    if (sentences.length <= 1) return [seg]

    const lengths = sentences.map((s: string) => s.length)
    const total = lengths.reduce((a: number, b: number) => a + b, 0) || 1
    let cursor = start
    const out: any[] = []
    for (let i = 0; i < sentences.length; i++) {
      const frac = lengths[i] / total
      const sliceDur = i === sentences.length - 1 ? (end - cursor) : Math.max(0, Math.round(duration * frac))
      out.push({
        speaker: seg.speaker,
        text: sentences[i],
        timestamp: cursor,
        start: cursor,
        end: cursor + sliceDur
      })
      cursor += sliceDur
    }
    return out
  }

  const postProcessSegments = (segs: any[]) => {
    let expanded: any[] = []
    segs.forEach((s) => {
      const byInline = splitOnInlineTimestamps(s)
      byInline.forEach(b => {
        const bySent = splitBySentencesWithTiming(b)
        expanded = expanded.concat(bySent)
      })
    })
    return expanded
  }

  const baseSegments = structuredSegments.length > 0 ? structuredSegments : parseTranscript(transcript)
  const segments = postProcessSegments(baseSegments)

  // Normalize overrides for case-insensitive matching
  const normalizedOverrides = useMemo(() => {
    const map: Record<string, string> = {}
    if (nameOverrides) {
      Object.entries(nameOverrides).forEach(([k, v]) => {
        map[String(k).toLowerCase()] = String(v)
      })
    }
    return map
  }, [nameOverrides])

  // Resolve speaker display names using provided speakers map when possible.
  const resolveSpeakerFromMap = (raw: string | undefined): string | undefined => {
    if (!raw || !speakers) return undefined
    const rawKey = String(raw).toLowerCase()
    if (normalizedOverrides && rawKey in normalizedOverrides) return normalizedOverrides[rawKey]
    // Direct key match
    const direct = (speakers && typeof speakers === 'object' && !Array.isArray(speakers)) ? (speakers as any)[raw] : undefined
    if (typeof direct === 'string') return direct
    if (direct && typeof direct === 'object') {
      const nm = direct.name || direct.label || direct.displayName
      if (nm && !/^spk_\d+$/i.test(nm) && !/^unknown/i.test(nm)) return nm
    }
    // Common shapes
    const arraysToCheck: any[] = []
    if (speakers && typeof speakers === 'object' && Array.isArray((speakers as any).speakers)) arraysToCheck.push((speakers as any).speakers)
    if (Array.isArray(speakers)) arraysToCheck.push(speakers)
    for (const arr of arraysToCheck) {
      const found = arr.find((s: any) => {
        const ids = [s?.id, s?.speakerId, s?.label, s?.name].filter(Boolean).map((x: any) => String(x).toLowerCase())
        return ids.includes(rawKey)
      })
      if (found) {
        const nm = found.name || found.label || found.displayName || found.speaker
        if (nm && !/^spk_\d+$/i.test(nm) && !/^unknown/i.test(nm)) return nm
      }
    }
    return undefined
  }

  const unknownIdToNumber = new Map<string, number>()
  let unknownCounter = 1
  const toDisplayName = (raw: string | undefined): string => {
    const mapped = resolveSpeakerFromMap(raw)
    if (mapped) return String(mapped)
    const key = raw || 'Unknown'
    if (key.startsWith('UNKNOWN_speaker_')) {
      if (!unknownIdToNumber.has(key)) unknownIdToNumber.set(key, unknownCounter++)
      return `Speaker ${unknownIdToNumber.get(key)}`
    }
    if (/^spk_\d+$/i.test(key)) {
      if (!unknownIdToNumber.has(key)) unknownIdToNumber.set(key, unknownCounter++)
      return `Speaker ${unknownIdToNumber.get(key)}`
    }
    // Clean underscores/numbers if it's not a friendly label
    const cleaned = key.replace(/_/g, ' ').trim()
    if (/^speaker\s*\d+$/i.test(cleaned)) return cleaned
    if (/^unknown$/i.test(cleaned)) return 'Speaker'
    return cleaned
  }

  const segmentsWithDisplay = segments.map(s => ({
    ...s,
    displaySpeaker: toDisplayName((s as any).speakerRaw || s.speaker)
  }))

  // Ensure stable mapping per raw ID; avoid heuristic alternation that can misalign names
  const finalSegments: any[] = segmentsWithDisplay

  // Generate speaker colors
  const getSpeakerColor = (speaker: string) => {
    const colors = [
      '#3b82f6', // blue
      '#10b981', // emerald
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // violet
      '#06b6d4', // cyan
      '#f97316', // orange
      '#84cc16', // lime
      '#ec4899', // pink
      '#6366f1'  // indigo
    ]

    // Simple hash function to consistently assign colors
    let hash = 0
    for (let i = 0; i < speaker.length; i++) {
      hash = ((hash << 5) - hash + speaker.charCodeAt(i)) & 0xffffffff
    }
    return colors[Math.abs(hash) % colors.length]
  }

  // Get unique speakers for legend using display names
  const uniqueSpeakers = [...new Set(finalSegments.map((s: any) => s.displaySpeaker))]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Transcript
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Navigate by speaker, jump to moments, and copy sections effortlessly.
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
            <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Text
            </span>
            <div className="inline-flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <button
                onClick={() => setTextScale('normal')}
                className={`px-2 py-1 text-xs font-semibold transition-colors ${
                  textScale === 'normal'
                    ? 'bg-blue-600 text-white'
                    : 'bg-transparent text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                A
              </button>
              <button
                onClick={() => setTextScale('large')}
                className={`px-2 py-1 text-sm font-semibold border-l border-gray-200 dark:border-gray-700 transition-colors ${
                  textScale === 'large'
                    ? 'bg-blue-600 text-white'
                    : 'bg-transparent text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                A+
              </button>
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(transcript)}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-600/25"
          >
            Copy full transcript
          </button>
        </div>
      </div>

      {/* Speaker Legend */}
      {uniqueSpeakers.length > 1 && (
        <div className="flex gap-4 items-center flex-wrap p-4 bg-blue-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Speakers</span>
          {uniqueSpeakers.map((speaker) => (
            <div
              key={speaker}
              className="flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getSpeakerColor(speaker) }}
              />
              <span className="text-gray-900 dark:text-white font-semibold">{speaker}</span>
            </div>
          ))}
        </div>
      )}

      {/* Transcript Segments */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-lg">
        {finalSegments.map((segment: any, index: number) => (
          <div
            key={index}
            className={`grid gap-6 p-6 border-b border-gray-200 dark:border-gray-700 last:border-b-0 ${
              index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-slate-700'
            } ${
              textScale === 'large' ? 'grid-cols-[minmax(200px,_260px)_minmax(0,_1fr)] gap-7 p-7' : 'grid-cols-[minmax(190px,_240px)_minmax(0,_1fr)]'
            }`}
            style={{ alignItems: 'flex-start' }}
          >
            <div className="flex flex-col gap-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getSpeakerColor(segment.displaySpeaker) }}
                />
                <span
                  className="text-sm font-semibold"
                  style={{ color: getSpeakerColor(segment.displaySpeaker) }}
                >
                  {segment.displaySpeaker}
                </span>
              </div>
              {segment.timestamp != null && (
                <button
                  onClick={() => {
                    const seconds = toSeconds(segment.timestamp)
                    if (onSeek && seconds != null) onSeek(seconds)
                  }}
                  title="Jump to this moment"
                  className="text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 rounded-full px-3 py-1 w-fit cursor-pointer font-semibold tracking-wide uppercase"
                >
                  {formatTime(segment.timestamp)}
                </button>
              )}
            </div>

            <div
              className={`text-gray-900 dark:text-white whitespace-pre-wrap max-w-prose tracking-wide ${
                textScale === 'large' ? 'text-lg leading-8' : 'text-base leading-7'
              }`}
            >
              {segment.text}
            </div>
          </div>
        ))}

        {segmentsWithDisplay.length === 0 && (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 italic">
            No transcript available
          </div>
        )}
      </div>
    </div>
  )
}