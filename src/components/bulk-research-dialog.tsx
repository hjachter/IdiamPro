'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { X, Plus, FileText, Youtube, Type, Globe, Image as ImageIcon, FileArchive, Music, Video as VideoIcon, FolderOpen, Mic, Square, Pause, Play, Loader2, Upload, MessageSquare, RotateCcw, Send, ExternalLink } from 'lucide-react';
import type { ExternalSourceInput, BulkResearchSources, DiarizedTranscript } from '@/types';
import { useAudioRecorder } from '@/lib/use-audio-recorder';
import { transcribeRecordingAction, getYoutubeTitleAction } from '@/app/actions';
import { openExternalUrl } from '@/lib/electron-storage';

// Type for stored recording data
interface RecordingData {
  audioUrl: string;
  audioData: string; // base64
  mimeType: string;
  duration: number;
}

interface BulkResearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: BulkResearchSources) => Promise<void>;
  currentOutlineName?: string;
}

type SourceEntry = ExternalSourceInput & {
  id: string;
  sourceName?: string; // User-assigned meaningful name
};

// Source type configuration for cleaner UI
const SOURCE_TYPES = {
  youtube: { label: 'YouTube Video', icon: Youtube, color: 'text-red-500' },
  web: { label: 'Web Page', icon: Globe, color: 'text-indigo-500' },
  pdf: { label: 'PDF Document', icon: FileText, color: 'text-blue-500' },
  recording: { label: 'Conversation / Audio', icon: Mic, color: 'text-red-600' },
  text: { label: 'Text / Notes', icon: Type, color: 'text-green-500' },
  image: { label: 'Image (OCR)', icon: ImageIcon, color: 'text-purple-500' },
  doc: { label: 'Office Document', icon: FileArchive, color: 'text-orange-500' },
  video: { label: 'Video File', icon: VideoIcon, color: 'text-teal-500' },
  outline: { label: 'Outline File (.idm)', icon: FolderOpen, color: 'text-amber-500' },
  audio: { label: 'Audio File', icon: Music, color: 'text-pink-500' },
} as const;

export default function BulkResearchDialog({
  open,
  onOpenChange,
  onSubmit,
  currentOutlineName,
}: BulkResearchDialogProps) {
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [includeExisting, setIncludeExisting] = useState(true);
  const [outlineName, setOutlineName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recording state
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState<string | null>(null);
  const [recordingTranscripts, setRecordingTranscripts] = useState<Record<string, DiarizedTranscript>>({});
  // Track which input method is selected for recording sources
  const [recordingInputMode, setRecordingInputMode] = useState<Record<string, 'record' | 'upload' | 'paste'>>({});
  // Store recorded audio for playback before transcription
  const [recordedAudio, setRecordedAudio] = useState<Record<string, RecordingData>>({});
  // Playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackTime, setPlaybackTime] = useState<Record<string, number>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  // Track which sources are fetching YouTube titles
  const [fetchingTitle, setFetchingTitle] = useState<Record<string, boolean>>({});

  const audioRecorder = useAudioRecorder();

  // Auto-add first source when dialog opens
  useEffect(() => {
    if (open && sources.length === 0) {
      setSources([{ id: crypto.randomUUID(), type: undefined as any }]);
    }
  }, [open, sources.length]);

  // Cleanup audio URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(recordedAudio).forEach(data => {
        URL.revokeObjectURL(data.audioUrl);
      });
    };
  }, [recordedAudio]);

  // Add new source (without type - user must choose)
  const handleAddSource = () => {
    setSources([...sources, { id: crypto.randomUUID(), type: undefined as any }]);
  };

  // Remove source
  const handleRemoveSource = (id: string) => {
    setSources(sources.filter(s => s.id !== id));
    // Clean up recording state
    setRecordingInputMode(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  };

  // Update source - uses functional update to avoid stale closure issues
  const handleUpdateSource = (id: string, updates: Partial<SourceEntry>) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // Handle YouTube URL change - auto-fetch title
  const handleYoutubeUrlChange = async (id: string, url: string) => {
    // Update URL immediately
    handleUpdateSource(id, { url });

    // Check if it looks like a valid YouTube URL
    const isYoutubeUrl = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)/);
    if (!isYoutubeUrl) return;

    // Check current source name (use ref-like pattern to get latest state)
    let hasExistingName = false;
    setSources(prev => {
      const source = prev.find(s => s.id === id);
      hasExistingName = !!source?.sourceName;
      return prev; // Don't modify, just read
    });
    if (hasExistingName) return;

    // Fetch the title
    setFetchingTitle(prev => ({ ...prev, [id]: true }));
    try {
      const title = await getYoutubeTitleAction(url);
      if (title) {
        // Only update if the source name is still empty (user might have typed one)
        setSources(prev => {
          const source = prev.find(s => s.id === id);
          if (!source?.sourceName) {
            return prev.map(s => s.id === id ? { ...s, sourceName: title } : s);
          }
          return prev;
        });
      }
    } catch (error) {
      console.warn('[YouTube] Failed to fetch title:', error);
    } finally {
      setFetchingTitle(prev => ({ ...prev, [id]: false }));
    }
  };

  // Handle file upload
  const handleFileUpload = async (id: string, file: File, sourceType: ExternalSourceInput['type']) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      // Auto-set source name from filename if not already set
      const source = sources.find(s => s.id === id);
      const updates: Partial<SourceEntry> = { content, fileName: file.name };
      if (!source?.sourceName) {
        updates.sourceName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      }
      handleUpdateSource(id, updates);
    };

    // For outline files, read as text; for others, read as data URL
    if (sourceType === 'outline') {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  };

  // Start recording for a source
  const handleStartRecording = async (id: string) => {
    if (audioRecorder.isRecording) return;
    // Clear any previous recording for this source
    if (recordedAudio[id]) {
      URL.revokeObjectURL(recordedAudio[id].audioUrl);
      setRecordedAudio(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    }
    setActiveRecordingId(id);
    await audioRecorder.startRecording();
  };

  // Stop recording - store audio for playback (don't transcribe yet)
  const handleStopRecording = async (id: string) => {
    const result = await audioRecorder.stopRecording();
    setActiveRecordingId(null);

    if (!result) return;

    // Create audio URL for playback
    const audioUrl = URL.createObjectURL(result.audioBlob);

    // Store recording data for playback
    setRecordedAudio(prev => ({
      ...prev,
      [id]: {
        audioUrl,
        audioData: result.audioData,
        mimeType: result.mimeType,
        duration: result.duration,
      }
    }));

    // Initialize playback time
    setPlaybackTime(prev => ({ ...prev, [id]: 0 }));
  };

  // Play/pause audio
  const handlePlayPause = useCallback((id: string) => {
    const audio = audioRefs.current[id];
    if (!audio) return;

    if (playingId === id) {
      audio.pause();
      setPlayingId(null);
    } else {
      // Pause any currently playing audio
      if (playingId && audioRefs.current[playingId]) {
        audioRefs.current[playingId]?.pause();
      }
      audio.play();
      setPlayingId(id);
    }
  }, [playingId]);

  // Handle audio time update
  const handleTimeUpdate = useCallback((id: string) => {
    const audio = audioRefs.current[id];
    if (audio) {
      setPlaybackTime(prev => ({ ...prev, [id]: audio.currentTime }));
    }
  }, []);

  // Handle audio ended
  const handleAudioEnded = useCallback((id: string) => {
    setPlayingId(null);
    setPlaybackTime(prev => ({ ...prev, [id]: 0 }));
    const audio = audioRefs.current[id];
    if (audio) {
      audio.currentTime = 0;
    }
  }, []);

  // Seek audio
  const handleSeek = useCallback((id: string, time: number) => {
    const audio = audioRefs.current[id];
    if (audio) {
      audio.currentTime = time;
      setPlaybackTime(prev => ({ ...prev, [id]: time }));
    }
  }, []);

  // Clear recording and start over
  const handleClearRecording = useCallback((id: string) => {
    if (recordedAudio[id]) {
      URL.revokeObjectURL(recordedAudio[id].audioUrl);
    }
    setRecordedAudio(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    setPlaybackTime(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    setPlayingId(prev => prev === id ? null : prev);
  }, [recordedAudio]);

  // Transcribe the recorded audio
  const handleTranscribeRecording = async (id: string) => {
    const recording = recordedAudio[id];
    if (!recording) return;

    setIsTranscribing(id);
    try {
      const transcriptionResult = await transcribeRecordingAction(
        recording.audioData,
        recording.mimeType,
        { enableDiarization: true }
      );

      if (transcriptionResult.success && transcriptionResult.transcript && transcriptionResult.formattedText) {
        // Store transcript and update source
        setRecordingTranscripts(prev => ({ ...prev, [id]: transcriptionResult.transcript! }));
        handleUpdateSource(id, {
          content: transcriptionResult.formattedText,
          fileName: `Recording (${formatDuration(recording.duration)}, ${transcriptionResult.transcript!.speakers.length} speakers)`,
        });
        // Clean up the audio URL since we have the transcript now
        URL.revokeObjectURL(recording.audioUrl);
        setRecordedAudio(prev => {
          const updated = { ...prev };
          delete updated[id];
          return updated;
        });
      } else {
        alert(`Transcription failed: ${transcriptionResult.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      alert('Failed to transcribe recording. Please try again.');
    } finally {
      setIsTranscribing(null);
    }
  };

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Check if a source has valid content
  const isSourceValid = (source: SourceEntry): boolean => {
    if (!source.type) return false;
    switch (source.type) {
      case 'youtube':
      case 'web':
        return !!source.url;
      case 'pdf':
        return !!(source.url || source.content);
      case 'text':
      case 'recording':
        return !!source.content;
      case 'image':
      case 'doc':
      case 'audio':
      case 'video':
      case 'outline':
        return !!source.content;
      default:
        return false;
    }
  };

  // Submit
  const handleSubmit = async () => {
    const validSources = sources.filter(isSourceValid);
    if (validSources.length === 0) {
      alert('Please add at least one source with content.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        sources: validSources.map(({ id, sourceName, ...rest }) => rest),
        includeExistingContent: includeExisting,
        outlineName: outlineName.trim() || undefined,
      });

      // Reset form
      setSources([]);
      setIncludeExisting(true);
      setOutlineName('');
      setRecordingInputMode({});
      onOpenChange(false);
    } catch (error) {
      // Error is handled by parent component's toast
      console.warn('[Bulk Import] Failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get icon for source type
  const getSourceIcon = (type: keyof typeof SOURCE_TYPES | undefined) => {
    if (!type || !SOURCE_TYPES[type]) return null;
    const config = SOURCE_TYPES[type];
    const Icon = config.icon;
    return <Icon className={`w-4 h-4 ${config.color}`} />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Research & Import</DialogTitle>
          <DialogDescription>
            Import multiple sources and merge them into a comprehensive outline.
            The AI will analyze all sources, find connections, and create a unified structure.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Merge destination - default is current outline */}
          {currentOutlineName && (
            <div className="p-3 bg-muted/50 rounded-md space-y-3">
              <div className="text-sm">
                Merging into: <span className="font-medium">&quot;{currentOutlineName}&quot;</span>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="create-new"
                  checked={!includeExisting}
                  onCheckedChange={(checked) => setIncludeExisting(checked !== true)}
                />
                <Label htmlFor="create-new" className="text-sm font-normal cursor-pointer">
                  Create new outline instead
                </Label>
              </div>
              {/* Only show outline name when creating new */}
              {!includeExisting && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="outline-name" className="text-xs text-muted-foreground">New Outline Name</Label>
                  <Input
                    id="outline-name"
                    placeholder="Will auto-generate from source title"
                    value={outlineName}
                    onChange={(e) => setOutlineName(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* No current outline - always creating new */}
          {!currentOutlineName && (
            <div className="space-y-2">
              <Label htmlFor="outline-name">Outline Name (optional)</Label>
              <Input
                id="outline-name"
                placeholder="Will auto-generate from source title"
                value={outlineName}
                onChange={(e) => setOutlineName(e.target.value)}
              />
            </div>
          )}

          {/* Sources List */}
          <div className="space-y-3">
            {/* Only show header with Add Source button when we have at least one configured source */}
            {sources.some(s => s.type) && (
              <div className="flex items-center justify-between">
                <Label>Sources ({sources.filter(isSourceValid).length} ready)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSource}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Another
                </Button>
              </div>
            )}

            {sources.map((source, idx) => {
              // Check if this is the initial empty source (first source, no type)
              const isInitialSource = idx === 0 && !source.type && sources.length === 1;

              return (
              <div key={source.id} className="border rounded-md p-4 space-y-3">
                {/* Header - simplified for initial source, full for configured sources */}
                {!isInitialSource && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getSourceIcon(source.type as keyof typeof SOURCE_TYPES)}
                      <span className="text-sm font-medium">
                        {source.sourceName || `Source ${idx + 1}`}
                      </span>
                      {isSourceValid(source) && (
                        <span className="text-xs text-green-600 dark:text-green-400">✓ Ready</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSource(source.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Source Type Selection */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    {isInitialSource ? 'What would you like to import?' : 'Source Type'}
                  </Label>
                  <Select
                    value={source.type || ''}
                    onValueChange={(type) => {
                      handleUpdateSource(source.id, {
                        type: type as any,
                        // Clear previous content when changing type
                        url: undefined,
                        content: undefined,
                        fileName: undefined,
                      });
                      // Reset recording input mode
                      if (type === 'recording') {
                        setRecordingInputMode(prev => ({ ...prev, [source.id]: 'paste' }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose source type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SOURCE_TYPES).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center space-x-2">
                            <config.icon className={`w-4 h-4 ${config.color}`} />
                            <span>{config.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Source-specific input panels */}
                {source.type && (
                  <div className="space-y-3 pt-2 border-t">
                    {/* Source Name */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Source Name</Label>
                      <Input
                        placeholder={`e.g., "${source.type === 'youtube' ? 'Product Demo Video' : source.type === 'recording' ? 'Team Meeting Jan 14' : 'My Source'}"...`}
                        value={source.sourceName || ''}
                        onChange={(e) => handleUpdateSource(source.id, { sourceName: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* YouTube */}
                    {source.type === 'youtube' && (
                      <div className="space-y-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => openExternalUrl('https://www.youtube.com')}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open YouTube in Browser
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                          Find a video and copy the URL from the address bar
                        </p>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">YouTube URL</Label>
                          <div className="relative">
                            <Input
                              placeholder="https://www.youtube.com/watch?v=..."
                              value={source.url || ''}
                              onChange={(e) => handleYoutubeUrlChange(source.id, e.target.value)}
                            />
                            {fetchingTitle[source.id] && (
                              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Web Page */}
                    {source.type === 'web' && (
                      <div className="space-y-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => openExternalUrl('https://www.google.com')}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open Browser
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                          Navigate to an article and copy the URL from the address bar
                        </p>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Web Page URL</Label>
                          <Input
                            placeholder="https://example.com/article"
                            value={source.url || ''}
                            onChange={(e) => handleUpdateSource(source.id, { url: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    {/* PDF */}
                    {source.type === 'pdf' && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">PDF URL or File</Label>
                        <Input
                          placeholder="https://example.com/document.pdf"
                          value={source.url || ''}
                          onChange={(e) => handleUpdateSource(source.id, { url: e.target.value })}
                        />
                        <div className="text-xs text-center text-muted-foreground">— or upload a file —</div>
                        <Input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(source.id, file, 'pdf');
                          }}
                        />
                        {source.fileName && (
                          <div className="text-xs text-green-600 dark:text-green-400">
                            ✓ Uploaded: {source.fileName}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Conversation / Audio - Multiple input options */}
                    {source.type === 'recording' && (
                      <div className="space-y-3">
                        {/* Input method tabs */}
                        <div className="flex space-x-1 p-1 bg-muted rounded-lg">
                          <Button
                            type="button"
                            variant={recordingInputMode[source.id] === 'paste' ? 'default' : 'ghost'}
                            size="sm"
                            className="flex-1 h-8"
                            onClick={() => setRecordingInputMode(prev => ({ ...prev, [source.id]: 'paste' }))}
                          >
                            <MessageSquare className="w-3 h-3 mr-1" />
                            Paste Transcript
                          </Button>
                          <Button
                            type="button"
                            variant={recordingInputMode[source.id] === 'upload' ? 'default' : 'ghost'}
                            size="sm"
                            className="flex-1 h-8"
                            onClick={() => setRecordingInputMode(prev => ({ ...prev, [source.id]: 'upload' }))}
                          >
                            <Upload className="w-3 h-3 mr-1" />
                            Upload Audio
                          </Button>
                          <Button
                            type="button"
                            variant={recordingInputMode[source.id] === 'record' ? 'default' : 'ghost'}
                            size="sm"
                            className="flex-1 h-8"
                            onClick={() => setRecordingInputMode(prev => ({ ...prev, [source.id]: 'record' }))}
                          >
                            <Mic className="w-3 h-3 mr-1" />
                            Record
                          </Button>
                        </div>

                        {/* Paste Transcript */}
                        {recordingInputMode[source.id] === 'paste' && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Transcript Text</Label>
                            <textarea
                              className="w-full min-h-[120px] p-2 border rounded-md text-sm bg-background text-foreground"
                              placeholder="Paste your conversation transcript here...&#10;&#10;Speaker A: ...&#10;Speaker B: ..."
                              value={source.content || ''}
                              onChange={(e) => handleUpdateSource(source.id, { content: e.target.value })}
                            />
                          </div>
                        )}

                        {/* Upload Audio File */}
                        {recordingInputMode[source.id] === 'upload' && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Audio File (will be transcribed)</Label>
                            <Input
                              type="file"
                              accept="audio/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(source.id, file, 'audio');
                              }}
                            />
                            {source.fileName && (
                              <div className="text-xs text-green-600 dark:text-green-400">
                                ✓ Uploaded: {source.fileName}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Supports MP3, WAV, M4A, and other audio formats.
                            </p>
                          </div>
                        )}

                        {/* Live Recording */}
                        {recordingInputMode[source.id] === 'record' && (
                          <div className="space-y-3">
                            {/* Recording not started (and no recording saved) */}
                            {!source.content && !activeRecordingId && isTranscribing !== source.id && !recordedAudio[source.id] && (
                              <div className="flex flex-col items-center py-4 space-y-3">
                                {audioRecorder.isSupported ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="default"
                                      className="bg-red-600 hover:bg-red-700"
                                      onClick={() => handleStartRecording(source.id)}
                                    >
                                      <Mic className="w-4 h-4 mr-2" />
                                      Start Recording
                                    </Button>
                                    <p className="text-xs text-muted-foreground text-center">
                                      Record live with speaker identification (requires AssemblyAI key)
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-sm text-destructive">
                                    Recording not supported in this browser.
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Recording in progress */}
                            {activeRecordingId === source.id && (
                              <div className="flex flex-col items-center py-4 space-y-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                                <div className="flex items-center space-x-2">
                                  <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
                                  <span className="text-lg font-mono">{formatDuration(audioRecorder.duration)}</span>
                                </div>
                                <div className="w-full max-w-[200px] h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-red-600 transition-all duration-75"
                                    style={{ width: `${audioRecorder.audioLevel}%` }}
                                  />
                                </div>
                                <div className="flex space-x-2">
                                  {audioRecorder.isPaused ? (
                                    <Button type="button" variant="outline" size="sm" onClick={() => audioRecorder.resumeRecording()}>
                                      <Play className="w-4 h-4 mr-1" /> Resume
                                    </Button>
                                  ) : (
                                    <Button type="button" variant="outline" size="sm" onClick={() => audioRecorder.pauseRecording()}>
                                      <Pause className="w-4 h-4 mr-1" /> Pause
                                    </Button>
                                  )}
                                  <Button type="button" variant="destructive" size="sm" onClick={() => handleStopRecording(source.id)}>
                                    <Square className="w-4 h-4 mr-1" /> Stop
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Recording complete - playback controls */}
                            {recordedAudio[source.id] && isTranscribing !== source.id && !source.content && (
                              <div className="space-y-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                                    Recording complete ({formatDuration(recordedAudio[source.id].duration)})
                                  </span>
                                </div>

                                {/* Hidden audio element */}
                                <audio
                                  ref={(el) => { audioRefs.current[source.id] = el; }}
                                  src={recordedAudio[source.id].audioUrl}
                                  onTimeUpdate={() => handleTimeUpdate(source.id)}
                                  onEnded={() => handleAudioEnded(source.id)}
                                />

                                {/* Playback controls */}
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10"
                                    onClick={() => handlePlayPause(source.id)}
                                  >
                                    {playingId === source.id ? (
                                      <Pause className="w-5 h-5" />
                                    ) : (
                                      <Play className="w-5 h-5" />
                                    )}
                                  </Button>

                                  {/* Progress bar */}
                                  <div className="flex-1 flex items-center gap-2">
                                    <span className="text-xs font-mono w-10">
                                      {formatDuration(playbackTime[source.id] || 0)}
                                    </span>
                                    <input
                                      type="range"
                                      min={0}
                                      max={recordedAudio[source.id].duration}
                                      step={0.1}
                                      value={playbackTime[source.id] || 0}
                                      onChange={(e) => handleSeek(source.id, parseFloat(e.target.value))}
                                      className="flex-1 h-2 accent-primary cursor-pointer"
                                    />
                                    <span className="text-xs font-mono w-10">
                                      {formatDuration(recordedAudio[source.id].duration)}
                                    </span>
                                  </div>
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleClearRecording(source.id)}
                                    className="flex-1"
                                  >
                                    <RotateCcw className="w-4 h-4 mr-1" />
                                    Re-record
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleTranscribeRecording(source.id)}
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                  >
                                    <Send className="w-4 h-4 mr-1" />
                                    Transcribe
                                  </Button>
                                </div>

                                <p className="text-xs text-muted-foreground text-center">
                                  Review your recording, then click Transcribe to process with speaker identification.
                                </p>
                              </div>
                            )}

                            {/* Transcribing */}
                            {isTranscribing === source.id && (
                              <div className="flex flex-col items-center py-6 space-y-3">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Transcribing with speaker identification...</p>
                              </div>
                            )}

                            {/* Transcript ready */}
                            {source.content && isTranscribing !== source.id && recordingInputMode[source.id] === 'record' && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-green-600 dark:text-green-400">✓ Transcript ready</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      handleUpdateSource(source.id, { content: undefined, fileName: undefined });
                                      setRecordingTranscripts(prev => {
                                        const updated = { ...prev };
                                        delete updated[source.id];
                                        return updated;
                                      });
                                    }}
                                  >
                                    Re-record
                                  </Button>
                                </div>
                                {recordingTranscripts[source.id] && (
                                  <div className="max-h-[100px] overflow-y-auto p-2 bg-muted rounded text-xs font-mono">
                                    {recordingTranscripts[source.id].segments.slice(0, 3).map((seg, i) => (
                                      <div key={i} className="mb-1">
                                        <span className="font-semibold">{seg.speaker}:</span> {seg.text.slice(0, 80)}...
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Text/Notes */}
                    {source.type === 'text' && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Text Content</Label>
                        <textarea
                          className="w-full min-h-[100px] p-2 border rounded-md text-sm bg-background text-foreground"
                          placeholder="Paste or type your text content here..."
                          value={source.content || ''}
                          onChange={(e) => handleUpdateSource(source.id, { content: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Image (OCR) */}
                    {source.type === 'image' && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Image File (text will be extracted via OCR)</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(source.id, file, 'image');
                          }}
                        />
                        {source.fileName && (
                          <div className="text-xs text-green-600 dark:text-green-400">✓ Uploaded: {source.fileName}</div>
                        )}
                      </div>
                    )}

                    {/* Office Document */}
                    {source.type === 'doc' && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Office Document</Label>
                        <Input
                          type="file"
                          accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(source.id, file, 'doc');
                          }}
                        />
                        {source.fileName && (
                          <div className="text-xs text-green-600 dark:text-green-400">✓ Uploaded: {source.fileName}</div>
                        )}
                        <p className="text-xs text-muted-foreground">Supports Word, Excel, and PowerPoint files.</p>
                      </div>
                    )}

                    {/* Video File */}
                    {source.type === 'video' && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Video File (audio will be transcribed)</Label>
                        <Input
                          type="file"
                          accept="video/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(source.id, file, 'video');
                          }}
                        />
                        {source.fileName && (
                          <div className="text-xs text-green-600 dark:text-green-400">✓ Uploaded: {source.fileName}</div>
                        )}
                      </div>
                    )}

                    {/* Audio File (standalone, not conversation) */}
                    {source.type === 'audio' && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Audio File</Label>
                        <Input
                          type="file"
                          accept="audio/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(source.id, file, 'audio');
                          }}
                        />
                        {source.fileName && (
                          <div className="text-xs text-green-600 dark:text-green-400">✓ Uploaded: {source.fileName}</div>
                        )}
                      </div>
                    )}

                    {/* Outline File */}
                    {source.type === 'outline' && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Outline File (.idm or .json)</Label>
                        <Input
                          type="file"
                          accept=".json,.idm"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(source.id, file, 'outline');
                          }}
                        />
                        {source.fileName && (
                          <div className="text-xs text-green-600 dark:text-green-400">✓ Uploaded: {source.fileName}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>

        {/* Processing status indicator */}
        {isSubmitting && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-200">Synthesizing sources...</p>
              <p className="text-blue-600 dark:text-blue-400 text-xs">
                Extracting content, analyzing relationships, and generating outline. This may take 1-2 minutes.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || sources.filter(isSourceValid).length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `Synthesize ${sources.filter(isSourceValid).length} Source${sources.filter(isSourceValid).length !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
