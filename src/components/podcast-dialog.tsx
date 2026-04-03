'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { NodeMap, PodcastStyle, PodcastLength, PodcastConfig, PodcastProgress, PodcastScriptSegment, OpenAIVoice } from '@/types';
import { getDefaultSpeakers, getDefaultVoices, extractSubtreeContent, buildScriptPrompt } from '@/lib/podcast-generator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Download, X, Pencil, Plus, Trash2, Sparkles } from 'lucide-react';

interface PodcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeName: string;
  nodeId: string;
  nodes: NodeMap;
}

const STYLE_LABELS: Record<PodcastStyle, string> = {
  'two-host': 'Two-Host Discussion',
  'narrator': 'Single Narrator',
  'interview': 'Interview',
  'debate': 'Debate',
};

const STYLE_DESCRIPTIONS: Record<PodcastStyle, string> = {
  'two-host': 'Two hosts discuss the content conversationally',
  'narrator': 'One narrator presents the content authoritatively',
  'interview': 'An interviewer asks questions, a guest answers',
  'debate': 'Two speakers explore different angles',
};

const LENGTH_LABELS: Record<PodcastLength, string> = {
  brief: 'Brief (2-3 min)',
  standard: 'Standard (5-8 min)',
  detailed: 'Detailed (10-15 min)',
};

const VOICE_LABELS: Record<OpenAIVoice, string> = {
  alloy: 'Alloy (neutral)',
  echo: 'Echo (male)',
  fable: 'Fable (expressive)',
  nova: 'Nova (female)',
  onyx: 'Onyx (male, deep)',
  shimmer: 'Shimmer (female, warm)',
};

type Phase = 'config' | 'edit-prompt' | 'generating-script' | 'edit-script' | 'generating-audio' | 'preview';

// localStorage keys for persisting podcast preferences
const PREF_STYLE = 'idiampro-podcast-style';
const PREF_LENGTH = 'idiampro-podcast-length';
const PREF_TTS_MODEL = 'idiampro-podcast-tts-model';
const PREF_VOICES = 'idiampro-podcast-voices';

function loadPref<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const val = localStorage.getItem(key);
  return val !== null ? (val as unknown as T) : fallback;
}

function loadVoicesForStyle(style: PodcastStyle): Record<string, OpenAIVoice> {
  if (typeof window === 'undefined') return getDefaultVoices(style);

  const stored = localStorage.getItem(PREF_VOICES);
  if (!stored) return getDefaultVoices(style);

  try {
    const allVoices = JSON.parse(stored);

    // 1. Exact match for this style
    if (allVoices[style]) return allVoices[style];

    // 2. Derive from another style's voices
    const otherStyles = Object.keys(allVoices);
    if (otherStyles.length > 0) {
      const lastVoices = Object.values(allVoices[otherStyles[otherStyles.length - 1]]) as OpenAIVoice[];
      const speakers = getDefaultSpeakers(style);
      const result: Record<string, OpenAIVoice> = {};
      speakers.forEach((speaker, i) => {
        result[speaker] = lastVoices[i] || lastVoices[0] || 'alloy';
      });
      return result;
    }
  } catch { /* ignore corrupt data */ }

  return getDefaultVoices(style);
}

function saveVoicesForStyle(style: PodcastStyle, voices: Record<string, OpenAIVoice>) {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(PREF_VOICES);
    const allVoices = stored ? JSON.parse(stored) : {};
    allVoices[style] = voices;
    localStorage.setItem(PREF_VOICES, JSON.stringify(allVoices));
  } catch { /* ignore */ }
}

export default function PodcastDialog({
  open,
  onOpenChange,
  nodeName,
  nodeId,
  nodes,
}: PodcastDialogProps) {
  // Config state — initialized from localStorage
  const [style, setStyle] = useState<PodcastStyle>(() => loadPref(PREF_STYLE, 'two-host'));
  const [length, setLength] = useState<PodcastLength>(() => loadPref(PREF_LENGTH, 'standard'));
  const [voices, setVoices] = useState<Record<string, OpenAIVoice>>(() => {
    const initialStyle = loadPref<PodcastStyle>(PREF_STYLE, 'two-host');
    return loadVoicesForStyle(initialStyle);
  });
  const [ttsModel, setTtsModel] = useState<'tts-1' | 'tts-1-hd'>(() => loadPref(PREF_TTS_MODEL, 'tts-1'));

  // Generation state
  const [phase, setPhase] = useState<Phase>('config');
  const [progress, setProgress] = useState<PodcastProgress>({
    phase: 'script',
    message: '',
    percent: 0,
  });

  // Prompt editing state
  const [editablePrompt, setEditablePrompt] = useState('');

  // Script editing state
  const [editableSegments, setEditableSegments] = useState<PodcastScriptSegment[]>([]);

  // Preview state
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [scriptSegments, setScriptSegments] = useState<PodcastScriptSegment[]>([]);
  const [scriptOpen, setScriptOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update voices when style changes
  useEffect(() => {
    setVoices(loadVoicesForStyle(style));
  }, [style]);

  // Persist preferences when they change
  useEffect(() => { localStorage.setItem(PREF_STYLE, style); }, [style]);
  useEffect(() => { localStorage.setItem(PREF_LENGTH, length); }, [length]);
  useEffect(() => { localStorage.setItem(PREF_TTS_MODEL, ttsModel); }, [ttsModel]);
  useEffect(() => { saveVoicesForStyle(style, voices); }, [style, voices]);

  // Clean up blob URL on unmount or dialog close
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPhase('config');
      setProgress({ phase: 'script', message: '', percent: 0 });
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioBase64(null);
      setAudioUrl(null);
      setScriptSegments([]);
      setScriptOpen(false);
      setEditablePrompt('');
      setEditableSegments([]);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const speakers = getDefaultSpeakers(style);

  const handleVoiceChange = useCallback((speaker: string, voice: OpenAIVoice) => {
    setVoices(prev => ({ ...prev, [speaker]: voice }));
  }, []);

  // Build the prompt and show it for editing
  const handleShowPrompt = useCallback(() => {
    const content = extractSubtreeContent(nodes, nodeId);
    if (!content.trim()) {
      alert('No content found in the selected subtree');
      return;
    }
    const speakerNames = Object.keys(voices);
    const { system, user } = buildScriptPrompt(content, style, length, speakerNames);
    setEditablePrompt(`${system}\n\n${user}`);
    setPhase('edit-prompt');
  }, [nodes, nodeId, voices, style, length]);

  // Generate script only (from edited prompt)
  const handleGenerateScript = useCallback(async () => {
    setPhase('generating-script');
    setProgress({ phase: 'script', message: 'Generating podcast script...', percent: 10 });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const config: PodcastConfig = { style, length, voices, ttsModel };

      const response = await fetch('/api/generate-podcast-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, customPrompt: editablePrompt }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      const segments: PodcastScriptSegment[] = data.segments;

      setEditableSegments(segments);
      setPhase('edit-script');
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setPhase('edit-prompt');
        return;
      }
      setProgress({
        phase: 'error',
        message: (err as Error).message || 'Script generation failed',
        percent: 0,
      });
      setPhase('generating-script');
    } finally {
      abortControllerRef.current = null;
    }
  }, [style, length, voices, ttsModel, editablePrompt]);

  // Generate script without showing prompt editor first (quick path)
  const handleQuickGenerate = useCallback(async () => {
    setPhase('generating-script');
    setProgress({ phase: 'script', message: 'Generating podcast script...', percent: 10 });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const config: PodcastConfig = { style, length, voices, ttsModel };

      const response = await fetch('/api/generate-podcast-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, rootId: nodeId, config }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      const segments: PodcastScriptSegment[] = data.segments;

      setEditableSegments(segments);
      setPhase('edit-script');
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setPhase('config');
        return;
      }
      setProgress({
        phase: 'error',
        message: (err as Error).message || 'Script generation failed',
        percent: 0,
      });
      setPhase('generating-script');
    } finally {
      abortControllerRef.current = null;
    }
  }, [style, length, voices, ttsModel, nodes, nodeId]);

  // Synthesize audio from (edited) script segments
  const handleSynthesizeAudio = useCallback(async () => {
    setPhase('generating-audio');
    setProgress({ phase: 'tts', message: 'Starting audio synthesis...', percent: 0 });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/synthesize-podcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments: editableSegments, ttsModel }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.phase === 'error') {
              throw new Error(data.message || 'Synthesis failed');
            }

            if (data.phase === 'done') {
              const binary = atob(data.audioBase64);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }
              const blob = new Blob([bytes], { type: 'audio/mpeg' });
              const url = URL.createObjectURL(blob);

              setAudioBase64(data.audioBase64);
              setAudioUrl(url);
              setScriptSegments(data.scriptSegments || editableSegments);
              setPhase('preview');
            } else {
              setProgress({
                phase: data.phase,
                message: data.message,
                percent: data.percent || 0,
                segmentIndex: data.segmentIndex,
                totalSegments: data.totalSegments,
              });
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Synthesis failed' && !parseErr.message.includes('error')) {
              continue;
            }
            throw parseErr;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setPhase('edit-script');
        return;
      }
      setProgress({
        phase: 'error',
        message: (err as Error).message || 'Audio synthesis failed',
        percent: 0,
      });
    } finally {
      abortControllerRef.current = null;
    }
  }, [editableSegments, ttsModel]);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setPhase('config');
  }, []);

  const handleDiscard = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBase64(null);
    setAudioUrl(null);
    setScriptSegments([]);
    setPhase('config');
  }, [audioUrl]);

  // Script editing helpers
  const handleSegmentTextChange = useCallback((index: number, text: string) => {
    setEditableSegments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], text };
      return updated;
    });
  }, []);

  const handleSegmentSpeakerChange = useCallback((index: number, speaker: string) => {
    setEditableSegments(prev => {
      const updated = [...prev];
      const voice = voices[speaker] || 'alloy';
      updated[index] = { ...updated[index], speaker, voice };
      return updated;
    });
  }, [voices]);

  const handleDeleteSegment = useCallback((index: number) => {
    setEditableSegments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddSegment = useCallback((afterIndex: number) => {
    const speakerNames = Object.keys(voices);
    const defaultSpeaker = speakerNames[0] || 'Host A';
    setEditableSegments(prev => {
      const updated = [...prev];
      updated.splice(afterIndex + 1, 0, {
        speaker: defaultSpeaker,
        voice: voices[defaultSpeaker] || 'alloy',
        text: '',
      });
      return updated;
    });
  }, [voices]);

  const handleSave = useCallback(async () => {
    if (!audioBase64) return;

    const safeName = nodeName.replace(/[^a-zA-Z0-9\s-_]/g, '').trim().replace(/\s+/g, '-') || 'podcast';
    const filename = `${safeName}-podcast.mp3`;

    const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron === true;
    const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

    if (isElectron) {
      try {
        const electronAPI = (window as any).electronAPI;
        const filePath = await electronAPI.saveFileDialog({
          title: 'Save Podcast',
          defaultPath: filename,
          filters: [{ name: 'Audio Files', extensions: ['mp3'] }],
        });

        if (!filePath) return;

        await electronAPI.writeFile(filePath, audioBase64, 'base64');
        console.log('Podcast saved to:', filePath);
      } catch (err: any) {
        console.error('Save failed:', err);
        alert('Save failed: ' + (err.message || err));
      }
    } else if (isCapacitor) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');

        const result = await Filesystem.writeFile({
          path: filename,
          data: audioBase64,
          directory: Directory.Cache,
        });

        await Share.share({
          title: filename,
          url: result.uri,
        });
      } catch (err: any) {
        console.error('Share failed:', err);
        alert('Share failed: ' + (err.message || err));
      }
    } else {
      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [audioBase64, nodeName]);

  const handleClose = useCallback(() => {
    if (phase === 'generating-script' || phase === 'generating-audio') {
      handleCancel();
    }
    onOpenChange(false);
  }, [phase, handleCancel, onOpenChange]);

  // Count words in editable segments
  const totalWords = editableSegments.reduce((sum, seg) => sum + seg.text.split(/\s+/).filter(Boolean).length, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Generate Podcast
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal bg-gradient-to-r from-emerald-500/20 to-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-300/30">
              <Sparkles className="h-3 w-3" />
              Premium
            </span>
          </DialogTitle>
          <DialogDescription>
            Create an audio podcast from &ldquo;{nodeName}&rdquo;
          </DialogDescription>
        </DialogHeader>

        {/* Configuration Phase */}
        {phase === 'config' && (
          <>
            <div className="grid gap-4 py-4">
              {/* Style */}
              <div className="grid gap-2">
                <Label htmlFor="podcast-style">Style</Label>
                <Select value={style} onValueChange={(v) => setStyle(v as PodcastStyle)}>
                  <SelectTrigger id="podcast-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STYLE_LABELS) as PodcastStyle[]).map(s => (
                      <SelectItem key={s} value={s}>
                        {STYLE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{STYLE_DESCRIPTIONS[style]}</p>
              </div>

              {/* Voice Assignment */}
              <div className="grid gap-2">
                <Label>Voices</Label>
                {speakers.map(speaker => (
                  <div key={speaker} className="flex items-center gap-2">
                    <span className="text-sm w-24 shrink-0">{speaker}:</span>
                    <Select
                      value={voices[speaker] || 'alloy'}
                      onValueChange={(v) => handleVoiceChange(speaker, v as OpenAIVoice)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(VOICE_LABELS) as OpenAIVoice[]).map(v => (
                          <SelectItem key={v} value={v}>
                            {VOICE_LABELS[v]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Length */}
              <div className="grid gap-2">
                <Label>Length</Label>
                <RadioGroup value={length} onValueChange={(v) => setLength(v as PodcastLength)}>
                  {(Object.keys(LENGTH_LABELS) as PodcastLength[]).map(l => (
                    <div key={l} className="flex items-center space-x-2">
                      <RadioGroupItem value={l} id={`length-${l}`} />
                      <Label htmlFor={`length-${l}`} className="font-normal cursor-pointer">
                        {LENGTH_LABELS[l]}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* TTS Quality */}
              <div className="grid gap-2">
                <Label htmlFor="tts-model">Audio Quality</Label>
                <Select value={ttsModel} onValueChange={(v) => setTtsModel(v as 'tts-1' | 'tts-1-hd')}>
                  <SelectTrigger id="tts-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tts-1">Standard (faster)</SelectItem>
                    <SelectItem value="tts-1-hd">HD (higher quality)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="outline" onClick={handleShowPrompt}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Prompt
              </Button>
              <Button onClick={handleQuickGenerate}>
                Generate
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Edit Prompt Phase */}
        {phase === 'edit-prompt' && (
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>AI Prompt</Label>
                <span className="text-xs text-muted-foreground">
                  Customize how the AI generates your podcast script
                </span>
              </div>
              <Textarea
                value={editablePrompt}
                onChange={(e) => setEditablePrompt(e.target.value)}
                className="min-h-[300px] font-mono text-xs leading-relaxed"
                placeholder="Podcast generation prompt..."
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setPhase('config')}>
                Back
              </Button>
              <Button onClick={handleGenerateScript}>
                Generate Script
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Generating Script Phase */}
        {phase === 'generating-script' && (
          <div className="py-6 space-y-4">
            {progress.phase === 'error' ? (
              <div className="space-y-3">
                <p className="text-sm text-destructive">{progress.message}</p>
                <Button variant="outline" onClick={() => setPhase('config')}>
                  Back to Settings
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{progress.message || 'Generating script...'}</p>
                  <Progress value={progress.percent} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">{progress.percent}%</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </>
            )}
          </div>
        )}

        {/* Edit Script Phase */}
        {phase === 'edit-script' && (
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label>
                Script Editor
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {editableSegments.length} segments &middot; ~{totalWords} words
                </span>
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAddSegment(editableSegments.length - 1)}
                className="text-xs"
              >
                <Plus className="mr-1 h-3 w-3" />
                Add Segment
              </Button>
            </div>

            <div className="max-h-[400px] overflow-y-auto border rounded-md p-3 space-y-3">
              {editableSegments.map((segment, index) => (
                <div key={index} className="flex gap-2 group">
                  <div className="flex flex-col gap-1 shrink-0">
                    <Select
                      value={segment.speaker}
                      onValueChange={(v) => handleSegmentSpeakerChange(index, v)}
                    >
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(voices).map(s => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleAddSegment(index)}
                        title="Add segment after"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        onClick={() => handleDeleteSegment(index)}
                        title="Delete segment"
                        disabled={editableSegments.length <= 1}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={segment.text}
                    onChange={(e) => handleSegmentTextChange(index, e.target.value)}
                    className="flex-1 min-h-[60px] text-sm resize-none"
                    rows={2}
                  />
                </div>
              ))}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setPhase('edit-prompt')}>
                Back to Prompt
              </Button>
              <Button variant="outline" onClick={() => setPhase('config')}>
                Start Over
              </Button>
              <Button onClick={handleSynthesizeAudio} disabled={editableSegments.length === 0}>
                Generate Audio
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Generating Audio Phase */}
        {phase === 'generating-audio' && (
          <div className="py-6 space-y-4">
            {progress.phase === 'error' ? (
              <div className="space-y-3">
                <p className="text-sm text-destructive">{progress.message}</p>
                <Button variant="outline" onClick={() => setPhase('edit-script')}>
                  Back to Script
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{progress.message}</p>
                  <Progress value={progress.percent} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">{progress.percent}%</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  if (abortControllerRef.current) abortControllerRef.current.abort();
                  setPhase('edit-script');
                }}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </>
            )}
          </div>
        )}

        {/* Preview Phase */}
        {phase === 'preview' && audioUrl && (
          <div className="py-4 space-y-4">
            {/* Audio Player */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <audio controls className="w-full" src={audioUrl}>
                Your browser does not support the audio element.
              </audio>
            </div>

            {/* Script Viewer */}
            <Collapsible open={scriptOpen} onOpenChange={setScriptOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                {scriptOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                View Script ({scriptSegments.length} segments)
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-3 space-y-2 text-sm">
                  {scriptSegments.map((seg, i) => (
                    <div key={i}>
                      <span className="font-semibold text-primary">{seg.speaker}:</span>{' '}
                      <span className="text-muted-foreground">{seg.text}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleDiscard}>
                Discard
              </Button>
              <Button onClick={handleSave}>
                <Download className="mr-2 h-4 w-4" />
                Save Audio File
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
