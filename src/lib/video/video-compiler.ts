// ============================================================================
// Video compiler adapter (content-compiler Phase 3A).
// ----------------------------------------------------------------------------
// The video (narrated slideshow) is the third output format wired into the
// content-compiler architecture (docs/content-compiler-architecture.md §2.6,
// Phase 3), mirroring the podcast adapter (src/lib/podcast-compiler.ts). This
// module holds the platform-neutral pieces:
//
//   * SCENE PLANNING — every derived slide becomes a scene that knows which
//     outline node produced it (sourceNodeId, attached by derive-slides) and
//     carries a content fingerprint of everything that affects its rendered
//     frame + narration (title, bullets, narration, mind map, position).
//   * DIFFING — compare a fresh plan against the stored manifest to find which
//     scenes' source content changed since the last render.
//   * THE COMPILE MANIFEST — the persisted record of a generated video:
//     per-scene source node ids + fingerprints + narration text, the style/
//     options fingerprint the video was rendered with, and each scene's cached
//     clip reference. Stored in app-local storage (localStorage), keyed by the
//     chapter root node id, capped at MAX_MANIFESTS with oldest-first eviction.
//
// None of this vocabulary ever reaches the UI: users see "Update Changed" /
// "Start Fresh", never "manifest/cache/compile" (value-based naming).
//
// The per-scene CLIP cache (rendered MP4 segments) lives in the Electron main
// process (electron/video-generator.js) — this module only records the clip
// keys the generator reports, so the manifest can prove traceability + reuse.
//
// FINGERPRINT NOTE — position is part of a scene's identity material: every
// slide paints its "n / total" number onto the frame, so a scene whose index
// or the video's total slide count changed is honestly a CHANGED scene (its
// pixels differ). Content-only edits (the common case — fixing a typo in one
// node) leave every other scene's index/total untouched, so those scenes
// reuse their cached clips.
// ============================================================================

import type { NodeMap } from '@/types';
import { hashText } from '@/lib/compile-core';
import {
  deriveSlidesFromChapter,
  type DeriveSlidesOptions,
  type VideoSlide,
} from '@/lib/video/derive-slides';
import type { VideoStyle } from '@/lib/video/video-style';

// ── Scene planning ──────────────────────────────────────────────────────────

export interface VideoScenePlanScene {
  /** 0-based position in the video (slide order). */
  index: number;
  /** Stable identity across edits: the source node id (cover = chapter id). */
  key: string;
  /** Human title (the slide title). */
  title: string;
  /** EVERY node id whose content feeds this scene (the node + the children
   *  whose names appear as its bullets/agenda). Traceability foundation. */
  sourceNodeIds: string[];
  /** Fingerprint of everything that affects the rendered scene — the
   *  staleness signal (see FINGERPRINT NOTE above). */
  fingerprint: string;
  /** The derived slide itself — exactly what the render pipeline consumes. */
  slide: VideoSlide;
}

export interface VideoScenePlan {
  rootNodeId: string;
  rootName: string;
  sceneCount: number;
  scenes: VideoScenePlanScene[];
}

/** Fingerprint of one scene's render-relevant material. */
function sceneFingerprint(slide: VideoSlide, index: number, total: number): string {
  return hashText(JSON.stringify({
    sourceNodeId: slide.sourceNodeId ?? '',
    index,
    total,
    title: slide.title,
    bullets: slide.bullets,
    narration: slide.narration,
    kind: slide.kind ?? 'content',
    mindmapMermaid: slide.mindmapMermaid ?? '',
  }));
}

/**
 * Plan the video's scenes for a chapter subtree: one scene per derived slide,
 * each carrying its source node ids and content fingerprint. Deterministic —
 * the same outline + options always yields the same plan.
 */
export function planVideoScenes(
  nodes: NodeMap,
  chapterId: string,
  opts: DeriveSlidesOptions = {},
): VideoScenePlan | null {
  const chapter = nodes[chapterId];
  if (!chapter) return null;
  const slides = deriveSlidesFromChapter(nodes, chapterId, opts);
  if (slides.length === 0) return null;
  const total = slides.length;
  const scenes: VideoScenePlanScene[] = slides.map((slide, index) => ({
    index,
    key: slide.sourceNodeId ?? `${chapterId}#${index}`,
    title: slide.title,
    sourceNodeIds: slide.sourceNodeIds ?? (slide.sourceNodeId ? [slide.sourceNodeId] : []),
    fingerprint: sceneFingerprint(slide, index, total),
    slide,
  }));
  return {
    rootNodeId: chapterId,
    rootName: chapter.name ?? 'Video',
    sceneCount: total,
    scenes,
  };
}

// ── Options fingerprint ─────────────────────────────────────────────────────
// A different voice/theme/branding/visuals/depth — or a switch between free
// and premium narration — is a DIFFERENT video: the previous version is only
// offered for reuse when every option that affects the output matches.

export interface VideoOptionsForFingerprint {
  style: VideoStyle;
  visuals: { mindmap: boolean; photo: boolean; videoclip: boolean };
  maxDepth: number;
  /** Whether the render would carry the free-tier watermark (painted on every
   *  slide, so it is part of the output's identity). */
  watermark: boolean;
  /** Whether narration would run on a premium AI voice key vs. the free local
   *  voice — adding/removing a key changes every scene's sound, so it must
   *  honestly void the "only N scenes changed" offer. */
  premiumNarration: boolean;
}

export function videoOptionsFingerprint(opts: VideoOptionsForFingerprint): string {
  const { style, visuals, maxDepth, watermark, premiumNarration } = opts;
  return hashText(JSON.stringify({
    theme: style.theme,
    accent: style.accent,
    brandLabel: style.brandLabel,
    logoDataUrl: style.logoDataUrl,
    voice: style.voice,
    visuals,
    maxDepth,
    watermark,
    premiumNarration,
  }));
}

// ── The Compile Manifest ────────────────────────────────────────────────────

export interface VideoManifestScene {
  index: number;
  key: string;
  title: string;
  sourceNodeIds: string[];
  fingerprint: string;
  /** The narration text spoken over this scene. */
  narration: string;
  /** Scene-clip cache reference (Electron scene cache), when known. */
  clipKey?: string;
  /** Which narration engine produced the clip ('openai' | 'say' | 'silent'). */
  engine?: string;
  durationSeconds?: number;
}

export interface VideoManifest {
  version: 1;
  format: 'video';
  rootNodeId: string;
  rootName: string;
  compiledAt: number;
  optionsFingerprint: string;
  sceneCount: number;
  scenes: VideoManifestScene[];
  /** Where the finished MP4 landed (informational; the file may move). */
  outputPath?: string;
}

const MANIFEST_STORE_KEY = 'idiampro-video-manifests';
/** Keep at most this many video records; oldest compiledAt evicted first. */
const MAX_MANIFESTS = 12;

type ManifestStore = Record<string, VideoManifest>;

function readStore(): ManifestStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(MANIFEST_STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as ManifestStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: ManifestStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MANIFEST_STORE_KEY, JSON.stringify(store));
  } catch {
    // Quota pressure — drop the oldest half and retry once; never throw.
    try {
      const entries = Object.values(store).sort((a, b) => b.compiledAt - a.compiledAt);
      const trimmed: ManifestStore = {};
      for (const m of entries.slice(0, Math.max(1, Math.floor(entries.length / 2)))) {
        trimmed[m.rootNodeId] = m;
      }
      window.localStorage.setItem(MANIFEST_STORE_KEY, JSON.stringify(trimmed));
    } catch { /* give up quietly — the manifest is an optimization, never data */ }
  }
}

export function loadVideoManifest(rootNodeId: string): VideoManifest | null {
  const m = readStore()[rootNodeId];
  return m && m.version === 1 && Array.isArray(m.scenes) ? m : null;
}

export function saveVideoManifest(manifest: VideoManifest): void {
  const store = readStore();
  store[manifest.rootNodeId] = manifest;
  const keys = Object.keys(store);
  if (keys.length > MAX_MANIFESTS) {
    const sorted = keys.sort((a, b) => (store[a].compiledAt ?? 0) - (store[b].compiledAt ?? 0));
    for (const k of sorted.slice(0, keys.length - MAX_MANIFESTS)) delete store[k];
  }
  writeStore(store);
}

/**
 * Assemble the manifest after a successful render: the plan gives scene
 * identity + source nodes + narration; `sceneResults` (from the Electron
 * generator, aligned by scene index) contributes each clip's cache reference.
 */
export function buildVideoManifest(opts: {
  plan: VideoScenePlan;
  optionsFingerprint: string;
  sceneResults?: Array<{ index: number; engine?: string; clipKey?: string; durationSeconds?: number } | null>;
  outputPath?: string;
}): VideoManifest {
  const { plan, optionsFingerprint, sceneResults, outputPath } = opts;
  const scenes: VideoManifestScene[] = plan.scenes.map((s) => {
    const r = sceneResults?.[s.index] ?? null;
    return {
      index: s.index,
      key: s.key,
      title: s.title,
      sourceNodeIds: s.sourceNodeIds,
      fingerprint: s.fingerprint,
      narration: s.slide.narration,
      clipKey: r?.clipKey ?? undefined,
      engine: r?.engine ?? undefined,
      durationSeconds: r?.durationSeconds ?? undefined,
    };
  });
  return {
    version: 1,
    format: 'video',
    rootNodeId: plan.rootNodeId,
    rootName: plan.rootName,
    compiledAt: Date.now(),
    optionsFingerprint,
    sceneCount: plan.sceneCount,
    scenes,
    outputPath,
  };
}

// ── Staleness diff (plan vs. manifest) ──────────────────────────────────────

export interface VideoSceneDiff {
  /** Plan scenes whose render material changed (or are new) — need a fresh clip. */
  changed: VideoScenePlanScene[];
  /** Plan scenes whose material is untouched — their cached clip is reusable. */
  unchanged: VideoScenePlanScene[];
  total: number;
}

export function diffVideoScenes(
  plan: VideoScenePlan,
  manifest: VideoManifest,
): VideoSceneDiff {
  const byKey = new Map(manifest.scenes.map((s) => [s.key, s]));
  const changed: VideoScenePlanScene[] = [];
  const unchanged: VideoScenePlanScene[] = [];
  for (const s of plan.scenes) {
    const prev = byKey.get(s.key);
    if (prev && prev.fingerprint === s.fingerprint) unchanged.push(s);
    else changed.push(s);
  }
  return { changed, unchanged, total: plan.scenes.length };
}
