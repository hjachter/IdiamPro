'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { X, Plus, FileText, Youtube, Type, Globe, Image as ImageIcon, FileArchive, Music, Video as VideoIcon, FolderOpen, Mic, Square, Pause, Play, Loader2 } from 'lucide-react';
import type { ExternalSourceInput, BulkResearchSources, DiarizedTranscript } from '@/types';
import { useAudioRecorder } from '@/lib/use-audio-recorder';
import { transcribeRecordingAction } from '@/app/actions';

interface BulkResearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: BulkResearchSources) => Promise<void>;
  currentOutlineName?: string;
}

type SourceEntry = ExternalSourceInput & { id: string };

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

  const audioRecorder = useAudioRecorder();

  // Add new source
  const handleAddSource = () => {
    setSources([...sources, { id: crypto.randomUUID(), type: 'youtube' }]);
  };

  // Remove source
  const handleRemoveSource = (id: string) => {
    setSources(sources.filter(s => s.id !== id));
  };

  // Update source
  const handleUpdateSource = (id: string, updates: Partial<SourceEntry>) => {
    setSources(sources.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // Handle file upload
  const handleFileUpload = async (id: string, file: File, sourceType: ExternalSourceInput['type']) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      handleUpdateSource(id, { content, fileName: file.name });
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
    setActiveRecordingId(id);
    await audioRecorder.startRecording();
  };

  // Stop recording and transcribe
  const handleStopRecording = async (id: string) => {
    const result = await audioRecorder.stopRecording();
    setActiveRecordingId(null);

    if (!result) return;

    // Start transcription
    setIsTranscribing(id);
    try {
      const transcriptionResult = await transcribeRecordingAction(
        result.audioData,
        result.mimeType,
        { enableDiarization: true }
      );

      if (transcriptionResult.success && transcriptionResult.transcript && transcriptionResult.formattedText) {
        // Store transcript and update source
        setRecordingTranscripts(prev => ({ ...prev, [id]: transcriptionResult.transcript! }));
        handleUpdateSource(id, {
          content: transcriptionResult.formattedText,
          fileName: `Recording (${formatDuration(result.duration)}, ${transcriptionResult.transcript!.speakers.length} speakers)`,
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
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Submit
  const handleSubmit = async () => {
    if (sources.length === 0) {
      alert('Please add at least one source.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        sources: sources.map(({ id, ...rest }) => rest),
        includeExistingContent: includeExisting,
        outlineName: outlineName.trim() || undefined,
      });

      // Reset form
      setSources([]);
      setIncludeExisting(true);
      setOutlineName('');
      onOpenChange(false);
    } catch (error) {
      console.error('Bulk import failed:', error);
    } finally {
      setIsSubmitting(false);
    }
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
          {/* Outline Name */}
          <div className="space-y-2">
            <Label htmlFor="outline-name">Outline Name (optional)</Label>
            <Input
              id="outline-name"
              placeholder="Research Synthesis"
              value={outlineName}
              onChange={(e) => setOutlineName(e.target.value)}
            />
          </div>

          {/* Include Existing Content */}
          {currentOutlineName && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-existing"
                checked={includeExisting}
                onCheckedChange={(checked) => setIncludeExisting(checked === true)}
              />
              <Label htmlFor="include-existing" className="text-sm font-normal cursor-pointer">
                Include existing content from &quot;{currentOutlineName}&quot;
              </Label>
            </div>
          )}

          {/* Sources List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Sources ({sources.length})</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSource}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Source
              </Button>
            </div>

            {sources.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-md">
                No sources added yet. Click &quot;Add Source&quot; to begin.
              </div>
            )}

            {sources.map((source, idx) => (
              <div key={source.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    {source.type === 'youtube' && <Youtube className="w-4 h-4 text-red-500" />}
                    {source.type === 'pdf' && <FileText className="w-4 h-4 text-blue-500" />}
                    {source.type === 'text' && <Type className="w-4 h-4 text-green-500" />}
                    {source.type === 'web' && <Globe className="w-4 h-4 text-indigo-500" />}
                    {source.type === 'image' && <ImageIcon className="w-4 h-4 text-purple-500" />}
                    {source.type === 'doc' && <FileArchive className="w-4 h-4 text-orange-500" />}
                    {source.type === 'audio' && <Music className="w-4 h-4 text-pink-500" />}
                    {source.type === 'video' && <VideoIcon className="w-4 h-4 text-teal-500" />}
                    {source.type === 'outline' && <FolderOpen className="w-4 h-4 text-amber-500" />}
                    {source.type === 'recording' && <Mic className="w-4 h-4 text-red-600" />}
                    <span className="text-sm font-medium">Source {idx + 1}</span>
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

                <div className="space-y-2">
                  <Select
                    value={source.type}
                    onValueChange={(type) => handleUpdateSource(source.id, { type: type as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recording">Record Conversation</SelectItem>
                      <SelectItem value="outline">Outline File (.idm/.json)</SelectItem>
                      <SelectItem value="youtube">YouTube Video</SelectItem>
                      <SelectItem value="pdf">PDF Document</SelectItem>
                      <SelectItem value="web">Web Page (URL)</SelectItem>
                      <SelectItem value="image">Image (OCR)</SelectItem>
                      <SelectItem value="doc">Document (Word/Excel/PowerPoint)</SelectItem>
                      <SelectItem value="audio">Audio File</SelectItem>
                      <SelectItem value="video">Video File</SelectItem>
                      <SelectItem value="text">Text/Notes</SelectItem>
                    </SelectContent>
                  </Select>

                  {source.type === 'recording' && (
                    <div className="space-y-3">
                      {/* Recording not started or completed */}
                      {!source.content && !activeRecordingId && isTranscribing !== source.id && (
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
                                Record a meeting or conversation. The AI will transcribe and identify speakers.
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-destructive">
                              Audio recording is not supported in this browser.
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

                          {/* Audio level bar */}
                          <div className="w-full max-w-[200px] h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-600 transition-all duration-75"
                              style={{ width: `${audioRecorder.audioLevel}%` }}
                            />
                          </div>

                          <div className="flex space-x-2">
                            {audioRecorder.isPaused ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => audioRecorder.resumeRecording()}
                              >
                                <Play className="w-4 h-4 mr-1" />
                                Resume
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => audioRecorder.pauseRecording()}
                              >
                                <Pause className="w-4 h-4 mr-1" />
                                Pause
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleStopRecording(source.id)}
                            >
                              <Square className="w-4 h-4 mr-1" />
                              Stop
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Transcribing */}
                      {isTranscribing === source.id && (
                        <div className="flex flex-col items-center py-6 space-y-3">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          <p className="text-sm text-muted-foreground">
                            Transcribing with speaker identification...
                          </p>
                        </div>
                      )}

                      {/* Transcript ready */}
                      {source.content && isTranscribing !== source.id && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">
                              Transcript ready
                            </span>
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
                          <div className="text-xs text-muted-foreground">
                            {source.fileName}
                          </div>
                          {recordingTranscripts[source.id] && (
                            <div className="max-h-[150px] overflow-y-auto p-2 bg-muted rounded text-xs font-mono">
                              {recordingTranscripts[source.id].segments.slice(0, 5).map((seg, i) => (
                                <div key={i} className="mb-1">
                                  <span className="font-semibold">{seg.speaker}:</span> {seg.text.slice(0, 100)}{seg.text.length > 100 ? '...' : ''}
                                </div>
                              ))}
                              {recordingTranscripts[source.id].segments.length > 5 && (
                                <div className="text-muted-foreground">
                                  ... and {recordingTranscripts[source.id].segments.length - 5} more segments
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {source.type === 'outline' && (
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept=".json,.idm,application/json,application/octet-stream"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(source.id, file, 'outline');
                        }}
                      />
                      {source.fileName && (
                        <div className="text-xs text-muted-foreground">
                          Uploaded: {source.fileName}
                        </div>
                      )}
                    </div>
                  )}

                  {source.type === 'youtube' && (
                    <Input
                      placeholder="YouTube URL"
                      value={source.url || ''}
                      onChange={(e) => handleUpdateSource(source.id, { url: e.target.value })}
                    />
                  )}

                  {source.type === 'web' && (
                    <Input
                      placeholder="Web page URL (e.g., https://example.com/article)"
                      value={source.url || ''}
                      onChange={(e) => handleUpdateSource(source.id, { url: e.target.value })}
                    />
                  )}

                  {source.type === 'pdf' && (
                    <div className="space-y-2">
                      <Input
                        placeholder="PDF URL (optional)"
                        value={source.url || ''}
                        onChange={(e) => handleUpdateSource(source.id, { url: e.target.value })}
                      />
                      <div className="text-sm text-muted-foreground text-center">or</div>
                      <Input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(source.id, file, 'pdf');
                        }}
                      />
                      {source.fileName && (
                        <div className="text-xs text-muted-foreground">
                          Uploaded: {source.fileName}
                        </div>
                      )}
                    </div>
                  )}

                  {source.type === 'image' && (
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(source.id, file, 'image');
                        }}
                      />
                      {source.fileName && (
                        <div className="text-xs text-muted-foreground">
                          Uploaded: {source.fileName}
                        </div>
                      )}
                    </div>
                  )}

                  {source.type === 'doc' && (
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(source.id, file, 'doc');
                        }}
                      />
                      {source.fileName && (
                        <div className="text-xs text-muted-foreground">
                          Uploaded: {source.fileName}
                        </div>
                      )}
                    </div>
                  )}

                  {source.type === 'audio' && (
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(source.id, file, 'audio');
                        }}
                      />
                      {source.fileName && (
                        <div className="text-xs text-muted-foreground">
                          Uploaded: {source.fileName}
                        </div>
                      )}
                    </div>
                  )}

                  {source.type === 'video' && (
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept="video/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(source.id, file, 'video');
                        }}
                      />
                      {source.fileName && (
                        <div className="text-xs text-muted-foreground">
                          Uploaded: {source.fileName}
                        </div>
                      )}
                    </div>
                  )}

                  {source.type === 'text' && (
                    <textarea
                      className="w-full min-h-[100px] p-2 border rounded-md text-sm"
                      placeholder="Paste your text or notes here..."
                      value={source.content || ''}
                      onChange={(e) => handleUpdateSource(source.id, { content: e.target.value })}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || sources.length === 0}>
            {isSubmitting ? 'Processing...' : `Synthesize ${sources.length} Source${sources.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
