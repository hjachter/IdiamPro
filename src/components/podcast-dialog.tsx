'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { NodeMap, PodcastStyle, PodcastLength, PodcastConfig, PodcastProgress, PodcastScriptSegment, OpenAIVoice } from '@/types';
import { getDefaultSpeakers, getDefaultVoices, extractSubtreeContent, buildScriptPrompt, OPENAI_VOICE_LABELS, LENGTH_TARGETS } from '@/lib/podcast-generator';
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
import { ChevronDown, ChevronRight, Download, X, Pencil, Plus, Trash2, Sparkles, Volume2, Settings2, Play } from 'lucide-react';
import { canUseFeature } from '@/lib/entitlements';
import { useAIUsageGate } from '@/lib/use-ai-usage-gate';
import { useUpgradePrompt } from '@/components/upgrade-prompt';
import { isElectron } from '@/lib/electron-storage';
import { getUserApiKey } from '@/lib/byok-keys';
import { nativeTtsAvailable, synthesizePodcastNative } from '@/lib/native-tts';

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

// Voice labels come from the shared canonical list in podcast-generator so the
// Podcast dialog and the Generate Video Style step always match.
const VOICE_LABELS = OPENAI_VOICE_LABELS;

type Phase = 'config' | 'edit-prompt' | 'generating-script' | 'edit-script' | 'generating-audio' | 'preview';

// Defensive: the script-generation API can occasionally return a malformed
// segment with a missing/blank `text` (bad AI output). Coerce text to a string
// and drop empty segments so they never crash the editor's word count or reach
// TTS. This is the single choke point every generated script passes through.
function sanitizeSegments(segs: unknown): PodcastScriptSegment[] {
  if (!Array.isArray(segs)) return [];
  return segs
    .filter((s) => !!s && String((s as { text?: unknown }).text ?? '').trim().length > 0)
    .map((s) => ({ ...(s as PodcastScriptSegment), text: String((s as PodcastScriptSegment).text) }));
}

// localStorage keys for persisting podcast preferences
const PREF_STYLE = 'idiampro-podcast-style';
const PREF_LENGTH = 'idiampro-podcast-length';
const PREF_TTS_MODEL = 'idiampro-podcast-tts-model';
const PREF_VOICES = 'idiampro-podcast-voices';
// "Don't show again" flag for the gentle enhanced-voices nudge (free desktop
// path with only basic system voices installed).
const PREF_VOICE_NUDGE_DISMISSED = 'idiampro-podcast-voice-nudge-dismissed';
// Per-style, per-speaker macOS `say` voice chosen in the in-app picker (desktop
// free path). Absent / "" for a speaker = auto-pick the best installed voice.
const PREF_SAY_VOICES = 'idiampro-podcast-say-voices';
// Sentinel Select value for "let the app auto-pick the best voice" (Radix Select
// disallows an empty-string item value, so we use a marker and map it to "").
const SAY_AUTO = '__auto__';

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

// The user's chosen free macOS `say` voice per speaker for a given style. An
// empty map means "auto-pick" for every speaker (the default, so doing nothing
// still produces a good podcast).
function loadSayVoicesForStyle(style: PodcastStyle): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(PREF_SAY_VOICES);
    if (!stored) return {};
    const all = JSON.parse(stored);
    return (all && all[style]) || {};
  } catch { return {}; }
}

function saveSayVoicesForStyle(style: PodcastStyle, sayVoices: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(PREF_SAY_VOICES);
    const all = stored ? JSON.parse(stored) : {};
    all[style] = sayVoices;
    localStorage.setItem(PREF_SAY_VOICES, JSON.stringify(all));
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

  // Live elapsed-time counter for the script-generation wait. Script generation
  // is a non-streaming, multi-pass AI call with no incremental server progress,
  // so a static bar looks hung. A ticking mm:ss timer proves it's alive.
  const [scriptElapsedSec, setScriptElapsedSec] = useState(0);
  // Running segment count reported by the streaming script route after each
  // iterative pass. Drives the DETERMINATE progress bar (segments / target).
  const [scriptSegDone, setScriptSegDone] = useState(0);
  useEffect(() => {
    if (phase !== 'generating-script' || progress.phase === 'error') {
      setScriptElapsedSec(0);
      return;
    }
    const start = Date.now();
    setScriptElapsedSec(0);
    const id = setInterval(() => {
      setScriptElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [phase, progress.phase]);

  // ---- Enhanced-voices nudge (free desktop path, basic voices only) ----
  // Detection only — never changes voice selection or blocks generation. We
  // surface a gentle, dismissible callout when: the user is on the FREE keyless
  // path AND on desktop macOS AND their Mac has NO Enhanced/Premium English
  // system voice installed (so the podcast would use the robotic basic voices).
  const [onlyBasicVoices, setOnlyBasicVoices] = useState(false);
  const [voiceNudgeDismissed, setVoiceNudgeDismissed] = useState(false);
  // The GOOD installed macOS voices (English, Enhanced/Premium, non-novelty)
  // offered in the in-app picker. Populated only on the desktop free path.
  const [goodSayVoices, setGoodSayVoices] = useState<Array<{ name: string; rank: number }>>([]);
  // Which good voice is currently playing a sample (disables the buttons while
  // it speaks). null = nothing playing.
  const [samplingVoice, setSamplingVoice] = useState<string | null>(null);
  // Per-speaker chosen `say` voice (name) for the current style; "" / absent =
  // auto-pick. Persisted per style in localStorage.
  const [saySpeakerVoices, setSaySpeakerVoices] = useState<Record<string, string>>(() =>
    loadSayVoicesForStyle(loadPref<PodcastStyle>(PREF_STYLE, 'two-host')));

  // On desktop the OpenAI key can come from the environment (.env.local, loaded by
  // the Electron main process) even when the user hasn't entered a BYOK key in
  // Settings. Ask the main process (boolean only, never the key) so the "no key"
  // banner is accurate and AI voices are treated as usable when a key exists.
  const [envOpenaiKey, setEnvOpenaiKey] = useState(false);
  useEffect(() => {
    let active = true;
    const api = typeof window !== 'undefined'
      ? (window as unknown as { electronAPI?: { hasOpenaiEnvKey?: () => Promise<boolean> } }).electronAPI
      : undefined;
    if (api?.hasOpenaiEnvKey) {
      api.hasOpenaiEnvKey().then((v) => { if (active) setEnvOpenaiKey(!!v); }).catch(() => {});
    }
    return () => { active = false; };
  }, [open]);
  // A usable OpenAI key exists if the user entered one (BYOK) OR the environment
  // provides one on desktop.
  const hasOpenaiKey = !!getUserApiKey('openai') || envOpenaiKey;

  useEffect(() => {
    if (!open) return;
    // The "don't show again" flag only silences the no-good-voices NUDGE; the
    // picker below is still populated whenever good voices exist.
    const dismissed = typeof window !== 'undefined' && localStorage.getItem(PREF_VOICE_NUDGE_DISMISSED) === '1';
    setVoiceNudgeDismissed(dismissed);
    // Free path = no OpenAI key (BYOK or env). Only meaningful on desktop macOS.
    const freePath = !hasOpenaiKey;
    const desktopVoiceApi = typeof window !== 'undefined'
      ? (window as unknown as { electronAPI?: {
          listSayVoices?: () => Promise<{ platform: string; voices: Array<{ name: string; locale: string; rank: number; good?: boolean }> }>;
        } }).electronAPI
      : undefined;
    if (!freePath || !isElectron() || !desktopVoiceApi?.listSayVoices) {
      setOnlyBasicVoices(false);
      setGoodSayVoices([]);
      return;
    }
    let cancelled = false;
    desktopVoiceApi.listSayVoices()
      .then((res) => {
        if (cancelled) return;
        if (!res || res.platform !== 'darwin') { setOnlyBasicVoices(false); setGoodSayVoices([]); return; }
        // "good" is flagged in the main process: English, Enhanced/Premium tier,
        // and not a novelty/joke voice. Best tier first, then alphabetical.
        const good = (res.voices || [])
          .filter((v) => v.good)
          .map((v) => ({ name: v.name, rank: v.rank || 2 }))
          .sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name));
        setGoodSayVoices(good);
        // No good voice installed → the picker can't help; show the nudge instead.
        setOnlyBasicVoices(good.length === 0);
      })
      .catch(() => { if (!cancelled) { setOnlyBasicVoices(false); setGoodSayVoices([]); } });
    return () => { cancelled = true; };
  }, [open, hasOpenaiKey]);

  const showVoiceNudge = onlyBasicVoices && !voiceNudgeDismissed;
  const showVoicePicker = goodSayVoices.length > 0;

  const handleOpenVoiceSettings = useCallback(() => {
    const api = typeof window !== 'undefined'
      ? (window as unknown as { electronAPI?: { openVoiceSettings?: () => Promise<unknown> } }).electronAPI
      : undefined;
    api?.openVoiceSettings?.();
  }, []);

  const handleDismissVoiceNudge = useCallback((forever: boolean) => {
    setVoiceNudgeDismissed(true);
    if (forever && typeof window !== 'undefined') {
      localStorage.setItem(PREF_VOICE_NUDGE_DISMISSED, '1');
    }
  }, []);

  // Play a short spoken sample of a specific macOS voice through the speakers so
  // the user can hear it before choosing. Runs in the main process; disables the
  // sample buttons while it speaks.
  const handleSampleVoice = useCallback((voiceName: string) => {
    if (!voiceName) return;
    const api = typeof window !== 'undefined'
      ? (window as unknown as { electronAPI?: { sampleSayVoice?: (n: string) => Promise<{ success: boolean }> } }).electronAPI
      : undefined;
    if (!api?.sampleSayVoice) return;
    setSamplingVoice(voiceName);
    api.sampleSayVoice(voiceName)
      .catch(() => { /* ignore — non-fatal */ })
      .finally(() => setSamplingVoice((cur) => (cur === voiceName ? null : cur)));
  }, []);

  const handleSaySpeakerVoiceChange = useCallback((speaker: string, voiceName: string) => {
    setSaySpeakerVoices((prev) => ({ ...prev, [speaker]: voiceName }));
  }, []);

  // Update voices when style changes
  useEffect(() => {
    setVoices(loadVoicesForStyle(style));
    setSaySpeakerVoices(loadSayVoicesForStyle(style));
  }, [style]);

  // Persist preferences when they change
  useEffect(() => { localStorage.setItem(PREF_STYLE, style); }, [style]);
  useEffect(() => { localStorage.setItem(PREF_LENGTH, length); }, [length]);
  useEffect(() => { localStorage.setItem(PREF_TTS_MODEL, ttsModel); }, [ttsModel]);
  useEffect(() => { saveVoicesForStyle(style, voices); }, [style, voices]);
  useEffect(() => { saveSayVoicesForStyle(style, saySpeakerVoices); }, [style, saySpeakerVoices]);

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

  const { promptUpgrade } = useUpgradePrompt();
  const { gate: aiUsageGate } = useAIUsageGate();

  /**
   * Phase 3 gate: podcast / universal-output generation is a Power feature.
   * Returns true if the user may proceed.
   *
   * NO-OP SAFETY: canUseFeature('podcastGeneration') returns true whenever
   * enforcement is inactive (no auth/billing keys — the state today), so
   * this never blocks and podcast generation works exactly as it does now.
   */
  const ensurePodcastAllowed = useCallback((): boolean => {
    // Launch tier model (#33): podcast generation is a Pro-only feature.
    // gate() shows the Pro upgrade dialog automatically for non-pro users
    // and counts the generation on success. Falls through to the older
    // canUseFeature gate when the launch counter is exempt (BYOK / local).
    if (!aiUsageGate({ feature: 'podcastGeneration' })) return false;
    if (canUseFeature('podcastGeneration')) return true;
    promptUpgrade({
      reason: 'Podcast generation is a Pro feature.',
      requiredTier: 'pro',
    });
    return false;
  }, [promptUpgrade, aiUsageGate]);

  const handleVoiceChange = useCallback((speaker: string, voice: OpenAIVoice) => {
    setVoices(prev => ({ ...prev, [speaker]: voice }));
  }, []);

  // Build the prompt and show it for editing
  const handleShowPrompt = useCallback(() => {
    const content = extractSubtreeContent(nodes, nodeId);
    if (!content.trim()) {
      alert('No content found in the selected suboutline');
      return;
    }
    const speakerNames = Object.keys(voices);
    const { system, user } = buildScriptPrompt(content, style, length, speakerNames);
    setEditablePrompt(`${system}\n\n${user}`);
    setPhase('edit-prompt');
  }, [nodes, nodeId, voices, style, length]);

  // Consume the streamed script-generation response (newline-delimited JSON).
  // After each iterative pass the route emits { type:'progress', segments } — we
  // update the determinate bar. The final { type:'done', segments } carries the
  // full script. BACKWARD-SAFE: if the response isn't a stream (older cached
  // build returning a single JSON { segments }), we fall back to parsing it whole
  // so nothing breaks. Returns the sanitized segments to advance the UI.
  const consumeScriptStream = useCallback(async (
    response: Response,
  ): Promise<PodcastScriptSegment[]> => {
    const targetMin = LENGTH_TARGETS[length].minSegments;
    const reader = response.body?.getReader();

    // Fallback: no readable stream at all — parse as the legacy single JSON.
    if (!reader) {
      const data = await response.json().catch(() => ({}));
      return sanitizeSegments((data as { segments?: unknown }).segments);
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let finalSegments: unknown = null;
    let sawEvent = false;

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let evt: { type?: string; segments?: unknown; error?: string };
      try {
        evt = JSON.parse(trimmed);
      } catch {
        return; // not a complete/typed event line — ignore
      }
      if (!evt || typeof evt.type !== 'string') return;
      sawEvent = true;
      if (evt.type === 'progress') {
        const count = typeof evt.segments === 'number' ? evt.segments : 0;
        setScriptSegDone(count);
      } else if (evt.type === 'done') {
        finalSegments = evt.segments;
      } else if (evt.type === 'error') {
        throw new Error(evt.error || 'Script generation failed');
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      fullText += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) handleLine(line);
    }
    if (buffer.trim()) handleLine(buffer);

    // Backward-safe fallback: never saw a typed event → treat the whole body as
    // the legacy single JSON { segments } payload.
    if (finalSegments === null && !sawEvent) {
      try {
        const parsed = JSON.parse(fullText);
        if (parsed && Array.isArray(parsed.segments)) finalSegments = parsed.segments;
      } catch {
        /* fall through to empty */
      }
    }

    return sanitizeSegments(finalSegments);
  }, [length]);

  // Generate script only (from edited prompt)
  const handleGenerateScript = useCallback(async () => {
    if (!ensurePodcastAllowed()) return;
    setPhase('generating-script');
    setScriptSegDone(0);
    setProgress({ phase: 'script', message: 'Generating podcast script...', percent: 0 });

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

      const segments = await consumeScriptStream(response);

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
  }, [style, length, voices, ttsModel, editablePrompt, ensurePodcastAllowed, consumeScriptStream]);

  // Generate script without showing prompt editor first (quick path)
  const handleQuickGenerate = useCallback(async () => {
    if (!ensurePodcastAllowed()) return;
    setPhase('generating-script');
    setScriptSegDone(0);
    setProgress({ phase: 'script', message: 'Generating podcast script...', percent: 0 });

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

      const segments = await consumeScriptStream(response);

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
  }, [style, length, voices, ttsModel, nodes, nodeId, ensurePodcastAllowed, consumeScriptStream]);

  // Synthesize audio from (edited) script segments
  const handleSynthesizeAudio = useCallback(async () => {
    setPhase('generating-audio');
    setProgress({ phase: 'tts', message: 'Starting audio synthesis...', percent: 0 });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // The user's own OpenAI key (BYOK), if they entered one in Settings. This is
    // the SAME shared key the Generate Video feature reads, so a user who already
    // added it for video does not re-enter it here.
    const userOpenaiKey = getUserApiKey('openai') || undefined;

    // Desktop path (mirrors Video): run synthesis in the Electron main process so
    // a keyless/free user still gets an AUDIBLE two-voice podcast via the free
    // built-in macOS voices, and a BYOK user's premium OpenAI audio runs on THEIR
    // key — never a silent output, never a surprise company-key charge.
    const desktopApi = typeof window !== 'undefined'
      ? (window as unknown as { electronAPI?: {
          generatePodcastAudio?: (a: unknown) => Promise<{ success: boolean; audioBase64?: string; usedLocalVoice?: boolean; error?: string }>;
          onGeneratePodcastProgress?: (cb: (p: { phase: string; message: string; percent: number; segmentIndex?: number; totalSegments?: number }) => void) => () => void;
        } }).electronAPI
      : undefined;

    if (isElectron() && desktopApi?.generatePodcastAudio) {
      let unsub: null | (() => void) = null;
      try {
        unsub = desktopApi.onGeneratePodcastProgress?.((p) => {
          if (p.phase === 'done') return; // handled after the call resolves
          setProgress({
            phase: p.phase as PodcastProgress['phase'],
            message: p.message,
            percent: p.percent || 0,
            segmentIndex: p.segmentIndex,
            totalSegments: p.totalSegments,
          });
        }) ?? null;

        // Attach the user's chosen free macOS voice per speaker (if any) so the
        // native `say` path uses it; a blank/absent choice falls back to the
        // engine's auto-pick. Only affects the free path — the OpenAI path
        // ignores sayVoiceOverride entirely.
        const segmentsWithOverride = editableSegments.map((s) => {
          const ov = saySpeakerVoices[s.speaker];
          return ov ? { ...s, sayVoiceOverride: ov } : s;
        });

        const result = await desktopApi.generatePodcastAudio({
          segments: segmentsWithOverride,
          ttsModel,
          openaiApiKey: userOpenaiKey,
        });
        unsub?.();

        if (!result?.success || !result.audioBase64) {
          throw new Error(result?.error || 'Audio synthesis failed');
        }
        const binary = atob(result.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);

        setAudioBase64(result.audioBase64);
        setAudioUrl(url);
        setScriptSegments(editableSegments);
        setPhase('preview');
      } catch (err) {
        unsub?.();
        setProgress({
          phase: 'error',
          message: (err as Error).message || 'Audio synthesis failed',
          percent: 0,
        });
      } finally {
        abortControllerRef.current = null;
      }
      return;
    }

    // iOS / iPadOS FREE path: a keyless user synthesizes the whole podcast on
    // device with Apple's built-in voices — audible, multi-voice, and $0. It
    // never touches a paid key. (A BYOK iOS user falls through to the premium
    // server route below, which runs on THEIR own key.)
    if (!userOpenaiKey && nativeTtsAvailable()) {
      try {
        setProgress({ phase: 'tts', message: 'Synthesizing audio on your device...', percent: 10 });
        const native = await synthesizePodcastNative(editableSegments);
        setAudioBase64(native.audioBase64);
        setAudioUrl(native.audioUrl);
        setScriptSegments(editableSegments);
        setPhase('preview');
      } catch (err) {
        setProgress({
          phase: 'error',
          message: (err as Error).message || 'On-device audio synthesis failed',
          percent: 0,
        });
      } finally {
        abortControllerRef.current = null;
      }
      return;
    }

    // Web / iOS path: the server route. Uses the user's BYOK key if present,
    // otherwise the company key (the paid path for web/iOS users).
    try {
      const response = await fetch('/api/synthesize-podcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments: editableSegments, ttsModel, userOpenaiKey }),
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
  }, [editableSegments, ttsModel, saySpeakerVoices]);

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
  const totalWords = editableSegments.reduce((sum, seg) => sum + String(seg?.text ?? '').split(/\s+/).filter(Boolean).length, 0);

  // Gentle, dismissible callout nudging a free desktop user to install a free
  // Enhanced/Premium English voice (or add an OpenAI key) for better sound.
  // Detection only — generation is never blocked.
  const voiceNudgeBanner = showVoiceNudge ? (
    <div className="rounded-md border border-amber-300/40 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
      <div className="flex items-start gap-2">
        <Volume2 className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1 space-y-2">
          <p className="text-amber-900 dark:text-amber-100">
            Your podcast will use your Mac&rsquo;s <strong>basic</strong> built-in voices, which can sound
            robotic. For free, near-human narration, install an Enhanced or Premium English voice.
            For studio-quality AI voices, add your own OpenAI key in Settings (premium voices run on your key).
          </p>
          <p className="text-xs text-amber-800/80 dark:text-amber-200/70 leading-relaxed">
            Open Voice Settings below, then under <strong>English</strong> download voices marked
            <strong> (Enhanced)</strong> or <strong> (Premium)</strong> — good picks are
            <strong> Ava</strong>, <strong>Zoe</strong>, and <strong>Tom</strong>. Grab two different ones so
            your two speakers sound distinct. <strong>Avoid the Eloquence category and the novelty voices</strong>
            {' '}(Bells, Bubbles, Zarvox, Grandpa, and the like) — they sound robotic or gimmicky.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleOpenVoiceSettings}
            >
              <Settings2 className="mr-2 h-3.5 w-3.5" />
              Open Voice Settings
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => handleDismissVoiceNudge(false)}
            >
              Dismiss
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => handleDismissVoiceNudge(true)}
            >
              Don&rsquo;t show again
            </Button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

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
            {voiceNudgeBanner}
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

              {/* Free macOS voice picker (desktop free path only). Lets the user
                  choose AND hear the good Enhanced/Premium system voices without
                  opening System Settings. Absent for BYOK/OpenAI users. */}
              {showVoicePicker && (
                <div className="grid gap-2">
                  <Label>Narration Voice</Label>
                  <p className="text-xs text-muted-foreground">
                    Free, natural-sounding voices already on your Mac. Tap ▶ to hear one, then choose per speaker.
                    Leave a speaker on <span className="italic">Auto</span> and we&rsquo;ll pick the best for you.
                  </p>
                  {speakers.map((speaker) => (
                    <div key={speaker} className="flex items-center gap-2">
                      <span className="text-sm w-24 shrink-0">{speaker}:</span>
                      <Select
                        value={saySpeakerVoices[speaker] || SAY_AUTO}
                        onValueChange={(v) => handleSaySpeakerVoiceChange(speaker, v === SAY_AUTO ? '' : v)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SAY_AUTO}>Auto (best voice)</SelectItem>
                          {goodSayVoices.map((v) => (
                            <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        disabled={samplingVoice !== null}
                        title={`Hear ${saySpeakerVoices[speaker] || goodSayVoices[0]?.name || 'this voice'}`}
                        onClick={() => handleSampleVoice(saySpeakerVoices[speaker] || goodSayVoices[0]?.name || '')}
                      >
                        {samplingVoice && samplingVoice === (saySpeakerVoices[speaker] || goodSayVoices[0]?.name)
                          ? <Volume2 className="h-4 w-4" />
                          : <Play className="h-4 w-4" />}
                      </Button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {goodSayVoices.map((v) => (
                      <Button
                        key={v.name}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={samplingVoice !== null}
                        title={`Hear a sample of ${v.name}`}
                        onClick={() => handleSampleVoice(v.name)}
                      >
                        {samplingVoice === v.name
                          ? <Volume2 className="mr-1 h-3 w-3" />
                          : <Play className="mr-1 h-3 w-3" />}
                        {v.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

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
                {isElectron() && !hasOpenaiKey && (
                  <p className="text-xs text-muted-foreground">
                    No AI voice key found — your podcast still records, using your Mac&rsquo;s built-in voices (free, one per speaker). For more natural AI voices, add your own OpenAI key in Settings — premium voices then run on your key.
                  </p>
                )}
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

        {/* Generating Script Phase — mirrors the Generating Audio frame below
            (same container, message line, Progress bar, right-aligned percent,
            Cancel) so the two phases feel like one consistent flow, but fed with
            SCRIPT data: real percent from the streamed segment count, the
            "X of ~N segments" tally, and the live mm:ss elapsed timer. */}
        {phase === 'generating-script' && (() => {
          const targetMin = LENGTH_TARGETS[length].minSegments;
          const scriptPercent = Math.min(100, Math.round((scriptSegDone / targetMin) * 100));
          const mmss = `${Math.floor(scriptElapsedSec / 60)}:${String(scriptElapsedSec % 60).padStart(2, '0')}`;
          const scriptMessage = scriptSegDone > 0
            ? `Building the script — ${scriptSegDone} of ~${targetMin} segments · ${mmss}`
            : `Writing your podcast script… · ${mmss}`;
          return (
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
                    <p className="text-sm text-muted-foreground">{scriptMessage}</p>
                    <Progress value={scriptPercent} className="h-2" />
                    <p className="text-xs text-muted-foreground text-right">{scriptPercent}%</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCancel}>
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </>
              )}
            </div>
          );
        })()}

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
            {voiceNudgeBanner}
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
