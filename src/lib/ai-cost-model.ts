/**
 * AI Cost Model — the single typed registry that classifies every AI
 * operation the app offers into a cost class, so the app can be honest
 * and predictable about spend (P2, 2026-09-06).
 *
 *   light  : organize / classify / tag / short chat answers. Tiny requests.
 *   medium : single-document generation (expand, summarize, reformat,
 *            transform, translate, outline-from-topic, one email/post…).
 *   heavy  : long multi-step work — podcast audio synthesis, video
 *            generation, LIVE BOOKS / Refresh-from-Web research, the
 *            YouTube package, and long batch generation across many nodes.
 *
 * Product behavior driven by this registry:
 *   - HEAVY ops show a small pre-run approval dialog (who pays, honest
 *     typical-cost framing, Run / Cancel, "Don't ask again").
 *   - LIGHT and MEDIUM ops get NO new friction — we communicate, never
 *     badger.
 *   - Every op (all classes) is recorded in the local usage ledger
 *     (src/lib/ai-usage-ledger.ts) for the user's own transparency.
 *
 * MONEY-HONESTY RULES for every string in this file (brand value):
 *   - Never promise an exact cost. Use "typically…" ranges only.
 *   - Never say "free" for anything that runs on a user's API key.
 *   - "Free" is allowed ONLY when literally nothing is billed to anyone:
 *     on-device AI, the Mac's built-in voices, the local video renderer.
 *   - Cloud calls on OUR free tier are "included in your free allowance",
 *     not "free forever".
 *
 * Op ids intentionally match the AIFeatureKey strings used by
 * use-ai-usage-gate.tsx so the gate, the ledger, and this registry all
 * speak the same vocabulary. Do not invent ops that the app doesn't offer.
 */

import { getUserApiKey, getSelectedTextProvider } from '@/lib/byok-keys';
import { TEXT_PROVIDER_NAMES, type TextProviderId } from '@/lib/ai/text-providers';

export type CostClass = 'light' | 'medium' | 'heavy';

/**
 * Which billing path an op's spend flows through. Drives the plain-English
 * "whose key pays" line in the heavy-op approval dialog.
 *
 *   text-provider : the user's selected text-AI provider (BYOK key if set,
 *                   otherwise the free-tier allowance / on-device AI).
 *   podcast-mixed : text provider for the script + OpenAI key for AI voices,
 *                   falling back to the Mac's free built-in voices.
 *   video-mixed   : local free renderer + OpenAI key for narration voices,
 *                   falling back to free Mac narration.
 *   assemblyai    : the user's AssemblyAI transcription key (never ours).
 */
export type PayerKind = 'text-provider' | 'podcast-mixed' | 'video-mixed' | 'assemblyai';

export type AICostOpId =
  // light
  | 'helpChat'
  | 'knowledgeChat'
  | 'tellAI'
  | 'aiMenu'
  | 'suggestTags'
  // medium
  | 'generateOutline'
  | 'expandContent'
  | 'summarizeOutline'
  | 'reformat'
  | 'transformOutline'
  | 'translate'
  | 'exportEmail'
  | 'importEmail'
  | 'shareSocial'
  | 'distillVoiceProfile'
  | 'recordingTranscription'
  | 'imageToOutline'
  | 'imageGeneration'
  | 'wizardRun'
  | 'verifyAgainstSource'
  // heavy
  | 'podcastGeneration'
  | 'videoGeneration'
  | 'liveBooks'
  | 'youtubePackage'
  | 'bulkResearch'
  | 'createContentForDescendants';

export interface AICostModelEntry {
  id: AICostOpId;
  /** Plain-English, value-based label — what the user gets. */
  label: string;
  costClass: CostClass;
  payerKind: PayerKind;
  /**
   * Rough RELATIVE cost note in honest, typical language. Shown to the
   * user; never an exact promise, never "free" for keyed ops.
   */
  costNote: string;
}

const L = (id: AICostOpId, label: string, costNote: string, payerKind: PayerKind = 'text-provider'): AICostModelEntry =>
  ({ id, label, costClass: 'light', payerKind, costNote });
const M = (id: AICostOpId, label: string, costNote: string, payerKind: PayerKind = 'text-provider'): AICostModelEntry =>
  ({ id, label, costClass: 'medium', payerKind, costNote });
const H = (id: AICostOpId, label: string, costNote: string, payerKind: PayerKind = 'text-provider'): AICostModelEntry =>
  ({ id, label, costClass: 'heavy', payerKind, costNote });

export const AI_COST_MODEL: Record<AICostOpId, AICostModelEntry> = {
  // ── LIGHT — short, everyday ops. No new friction, ever. ────────────────
  helpChat: L('helpChat', 'Help chat answer', 'Tiny request — typically well under a cent on a paid key.'),
  knowledgeChat: L('knowledgeChat', 'Ask Your Outlines answer', 'Tiny request — typically well under a cent on a paid key.'),
  tellAI: L('tellAI', 'AI command', 'Tiny request — typically well under a cent on a paid key.'),
  aiMenu: L('aiMenu', 'AI menu quick action', 'Tiny request — typically well under a cent on a paid key.'),
  suggestTags: L('suggestTags', 'Tag suggestions', 'Tiny request — typically well under a cent on a paid key.'),

  // ── MEDIUM — single-document generation. Communicated, not gated. ─────
  generateOutline: M('generateOutline', 'Outline from a topic', 'One document — typically under a cent on a paid key.'),
  expandContent: M('expandContent', 'Expand a section', 'One document — typically under a cent on a paid key.'),
  summarizeOutline: M('summarizeOutline', 'Summarize an outline', 'One document — typically under a cent on a paid key.'),
  reformat: M('reformat', 'Reformat content', 'One document — typically under a cent on a paid key.'),
  transformOutline: M('transformOutline', 'Transform an outline', 'One document — typically under a cent on a paid key.'),
  translate: M('translate', 'Translate content', 'One document — typically under a cent on a paid key.'),
  exportEmail: M('exportEmail', 'Draft an email', 'One document — typically under a cent on a paid key.'),
  importEmail: M('importEmail', 'Import from an email', 'One document — typically under a cent on a paid key.'),
  shareSocial: M('shareSocial', 'Draft a social post', 'One short post — typically under a cent on a paid key.'),
  distillVoiceProfile: M('distillVoiceProfile', 'Learn your writing voice', 'One analysis pass — typically under a cent on a paid key.'),
  recordingTranscription: M('recordingTranscription', 'Transcribe a recording', 'Billed per audio minute on your AssemblyAI key — typically a few cents for a short recording.', 'assemblyai'),
  imageToOutline: M('imageToOutline', 'Outline from an image', 'One image analysis — typically about a cent on a paid key.'),
  imageGeneration: M('imageGeneration', 'Generate an image', 'One image — typically a few cents on a paid key.'),
  wizardRun: M('wizardRun', 'Run a wizard', 'One document — typically under a cent on a paid key.'),
  verifyAgainstSource: M('verifyAgainstSource', 'Verify against the source', 'One checking pass — typically under a cent on a paid key.'),

  // ── HEAVY — long multi-step runs. Pre-run approval applies. ───────────
  podcastGeneration: H('podcastGeneration', 'Podcast (script + audio)',
    'A longer run: several script passes, then voice synthesis. On your own keys this is typically a few cents per podcast; the Mac-voices path synthesizes audio at no cost.', 'podcast-mixed'),
  videoGeneration: H('videoGeneration', 'Narrated video',
    'The video itself renders on this Mac at no cost. AI narration on your OpenAI key is typically a few cents per video; Mac narration costs nothing.', 'video-mixed'),
  liveBooks: H('liveBooks', 'Refresh from Web (LIVE BOOKS)',
    'A research run across your selected sections — typically a few cents on your key, more for very large sections.'),
  youtubePackage: H('youtubePackage', 'YouTube package',
    'A multi-part generation (script, description, titles, tags) — typically a few cents on your key.'),
  bulkResearch: H('bulkResearch', 'Research & Import (multiple sources)',
    'Processes every source you added — typically a few cents on your key, more with many or long sources.'),
  createContentForDescendants: H('createContentForDescendants', 'Write content for every section',
    'One generation per section — cost grows with the number of sections; typically a few cents on your key for a mid-sized outline.'),
};

/** All ops in a class — used by tests and future Settings displays. */
export function opsInClass(cls: CostClass): AICostModelEntry[] {
  return Object.values(AI_COST_MODEL).filter((e) => e.costClass === cls);
}

export function getCostModelEntry(id: string): AICostModelEntry | null {
  return (AI_COST_MODEL as Record<string, AICostModelEntry>)[id] ?? null;
}

// ── Live "who pays right now" description ────────────────────────────────

export interface PayerDescription {
  /** e.g. "your Gemini key" / "your Mac's free built-in voices — no key". */
  payerLine: string;
  /** Honest typical-cost framing for the approval dialog. */
  costLine: string;
  /** True when nothing at all is billed to any key for this run. */
  isNoKeyRun: boolean;
}

function isLocalProvider(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('aiProvider') === 'local';
  } catch {
    return false;
  }
}

function describeTextPayer(): { line: string; keyed: boolean } {
  if (isLocalProvider()) {
    return { line: 'on-device AI on this Mac (no key, no cost)', keyed: false };
  }
  const sel = getSelectedTextProvider();
  if (sel.apiKey) {
    const name = TEXT_PROVIDER_NAMES[sel.provider as TextProviderId] ?? sel.provider;
    return { line: `your ${name} key`, keyed: true };
  }
  return { line: 'your free monthly allowance (no key on file)', keyed: false };
}

/**
 * Compute the honest, current "whose key pays" + cost framing for an op,
 * from live client state (BYOK keys, provider selection). Safe on the
 * server (returns a generic description).
 */
export function describeCurrentPayer(id: AICostOpId): PayerDescription {
  const entry = AI_COST_MODEL[id];
  const hasOpenai = !!getUserApiKey('openai');

  if (entry.payerKind === 'podcast-mixed') {
    const text = describeTextPayer();
    const voiceLine = hasOpenai
      ? 'AI voices on your OpenAI key'
      : "your Mac's free built-in voices (no key)";
    return {
      payerLine: `Script: ${text.line}. Voices: ${voiceLine}.`,
      costLine: entry.costNote,
      isNoKeyRun: !text.keyed && !hasOpenai,
    };
  }

  if (entry.payerKind === 'video-mixed') {
    const voiceLine = hasOpenai
      ? 'narration on your OpenAI key'
      : "free Mac narration (no key)";
    return {
      payerLine: `Video renders on this Mac at no cost; ${voiceLine}.`,
      costLine: entry.costNote,
      isNoKeyRun: !hasOpenai,
    };
  }

  if (entry.payerKind === 'assemblyai') {
    const hasKey = !!getUserApiKey('assemblyai');
    return {
      payerLine: hasKey ? 'your AssemblyAI key' : 'no transcription key on file',
      costLine: entry.costNote,
      isNoKeyRun: !hasKey,
    };
  }

  const text = describeTextPayer();
  return {
    payerLine: text.line,
    costLine: text.keyed
      ? entry.costNote
      : 'No API key is billed for this run.',
    isNoKeyRun: !text.keyed,
  };
}
