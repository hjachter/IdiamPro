// ============================================================================
// Podcast compiler adapter (content-compiler Phase 1).
// ----------------------------------------------------------------------------
// The podcast is the first output format wired into the content-compiler
// architecture (docs/content-compiler-architecture.md §2.7). This module holds
// the platform-neutral pieces:
//
//   * SECTION PLANNING — split the chosen subtree into podcast sections (one
//     per top-level branch, grouped when there are many), each carrying its
//     source node ids and a combined content fingerprint from compile-core.
//   * DIFFING — compare a fresh plan against the stored manifest to find which
//     sections' source content changed since the last generation.
//   * THE COMPILE MANIFEST — the persisted record of a generated podcast:
//     per-section source node ids + fingerprints, the final (user-edited)
//     script text per segment, and each segment's cached audio-clip reference.
//     Stored in app-local storage (localStorage), keyed by the subtree root
//     node id, capped at MAX_MANIFESTS with oldest-first eviction.
//
// None of this vocabulary ever reaches the UI: users see "Update Changed" /
// "Start Fresh", never "manifest/cache/compile" (value-based naming).
//
// The per-segment AUDIO clip cache lives in the Electron main process
// (electron/podcast-generator.js) — this module only records the clip keys the
// generator reports, so the manifest can prove traceability and reuse.
// ============================================================================

import type {
  NodeMap,
  OpenAIVoice,
  PodcastLength,
  PodcastScriptSegment,
  PodcastStyle,
} from '@/types';
import {
  contentFingerprint,
  hashText,
  htmlToPlainText,
  liveChildIds,
  walkSubtree,
} from '@/lib/compile-core';
import { LENGTH_TARGETS } from '@/lib/podcast-generator';

// ── Section planning ────────────────────────────────────────────────────────

export interface PodcastSectionPlanSection {
  /** 0-based position in the show. */
  index: number;
  /** Stable identity across edits: the branch-root node id(s) it covers. */
  key: string;
  /** Human title (branch name, "+N more" when branches are grouped). */
  title: string;
  /** EVERY node id whose content feeds this section (branch roots + descendants). */
  nodeIds: string[];
  /** Combined content fingerprint of all those nodes — the staleness signal. */
  fingerprint: string;
  /** The section's source material, extracted once via compile-core. */
  content: string;
  /** Per-section script sizing (proportional share of the length target). */
  targetWords: number;
  minSegments: number;
}

export interface PodcastSectionPlan {
  rootNodeId: string;
  rootName: string;
  sections: PodcastSectionPlanSection[];
  /** True when the plan is a single section covering the whole subtree. */
  wholeSubtree: boolean;
}

/** Smallest section worth its own AI call, in dialogue words. */
const MIN_SECTION_WORDS = 80;
/** Hard cap on sections per podcast (bounds AI calls per generation). */
const MAX_SECTIONS = 8;

/** Heading-style extraction for one branch — same shape the legacy
 *  whole-subtree extraction produces, scoped to the branch. */
function extractBranchContent(nodes: NodeMap, branchRootId: string): string {
  const parts: string[] = [];
  walkSubtree(nodes, branchRootId, (node, depth) => {
    const heading = `${'#'.repeat(Math.min(depth + 2, 6))} ${node.name}`;
    let section = `${heading}\n`;
    const content = htmlToPlainText(node.content ?? '', 'podcast');
    if (content) section += `${content}\n`;
    parts.push(section + '\n');
  });
  return parts.join('');
}

/** All node ids in a branch, pre-order. */
function branchNodeIds(nodes: NodeMap, branchRootId: string): string[] {
  const ids: string[] = [];
  const walk = (id: string) => {
    if (!nodes[id] || ids.includes(id)) return;
    ids.push(id);
    for (const cid of liveChildIds(nodes, id)) walk(cid);
  };
  walk(branchRootId);
  return ids;
}

/**
 * Combined fingerprint over a set of nodes. Node ids are part of the material
 * so a moved/replaced node registers even if its text matches. `shallowRoot`
 * excludes a node's child-id list from its own fingerprint (used for the
 * subtree root, whose child list already shows up as sections appearing or
 * disappearing — without this, ANY structure edit would invalidate section 1).
 */
function combinedFingerprint(nodes: NodeMap, nodeIds: string[], shallowRootId?: string): string {
  const parts = nodeIds.map((id) => {
    const n = nodes[id];
    if (!n) return `${id}:missing`;
    const fp = id === shallowRootId
      ? contentFingerprint({ name: n.name, content: n.content, childrenIds: [] })
      : contentFingerprint(n);
    return `${id}:${fp}`;
  });
  return hashText(parts.join('|'));
}

/**
 * Plan the podcast's sections for a subtree.
 *
 * - Root with >=2 children: one section per top-level branch (grouped evenly
 *   when there are more branches than the length target can support — every
 *   section must be worth at least MIN_SECTION_WORDS of dialogue). The root's
 *   own name/content ride along with section 1.
 * - Root with 0-1 children, or a length too short to split: ONE section
 *   covering the whole subtree — which degenerates to exactly the legacy
 *   whole-outline generation, with all-or-nothing reuse.
 */
export function planPodcastSections(
  nodes: NodeMap,
  rootId: string,
  length: PodcastLength,
  options?: { forceWhole?: boolean },
): PodcastSectionPlan | null {
  const root = nodes[rootId];
  if (!root) return null;
  const target = LENGTH_TARGETS[length];
  const children = liveChildIds(nodes, rootId);
  const maxSections = Math.max(1, Math.min(MAX_SECTIONS, Math.floor(target.min / MIN_SECTION_WORDS)));

  const wholePlan = (): PodcastSectionPlan => ({
    rootNodeId: rootId,
    rootName: root.name ?? 'Podcast',
    wholeSubtree: true,
    sections: [{
      index: 0,
      key: rootId,
      title: root.name ?? 'Podcast',
      nodeIds: branchNodeIds(nodes, rootId),
      fingerprint: combinedFingerprint(nodes, branchNodeIds(nodes, rootId)),
      content: '', // whole-subtree content comes from the legacy extractor
      targetWords: target.min,
      minSegments: target.minSegments,
    }],
  });

  if (options?.forceWhole || children.length < 2 || maxSections < 2) return wholePlan();

  // Group consecutive branches evenly into at most maxSections sections.
  const groupCount = Math.min(children.length, maxSections);
  const groups: string[][] = [];
  for (let g = 0; g < groupCount; g++) {
    const start = Math.floor((g * children.length) / groupCount);
    const end = Math.floor(((g + 1) * children.length) / groupCount);
    groups.push(children.slice(start, end));
  }

  const sections: PodcastSectionPlanSection[] = groups.map((branchIds, index) => {
    const nodeIds = branchIds.flatMap((bid) => branchNodeIds(nodes, bid));
    // Section 1 also carries the subtree root (its intro material), with the
    // root fingerprinted SHALLOW so unrelated structure edits don't churn it.
    const withRoot = index === 0 ? [rootId, ...nodeIds] : nodeIds;
    const firstName = nodes[branchIds[0]]?.name ?? 'Section';
    const title = branchIds.length > 1 ? `${firstName} (+${branchIds.length - 1} more)` : firstName;
    let content = branchIds.map((bid) => extractBranchContent(nodes, bid)).join('');
    if (index === 0) {
      const rootIntro = htmlToPlainText(root.content ?? '', 'podcast');
      content = `# ${root.name ?? ''}\n${rootIntro ? rootIntro + '\n' : ''}\n${content}`;
    }
    return {
      index,
      key: branchIds.join('+'),
      title,
      nodeIds: withRoot,
      fingerprint: combinedFingerprint(nodes, withRoot, rootId),
      content,
      targetWords: 0, // filled below
      minSegments: 0,
    };
  });

  // Proportional word budgets by content share, floored at MIN_SECTION_WORDS.
  const totalChars = sections.reduce((sum, s) => sum + Math.max(s.content.length, 1), 0);
  // Aim mid-range so per-section single-pass generation lands near target.
  const showWords = Math.round((target.min + target.max) / 2);
  for (const s of sections) {
    const share = Math.max(s.content.length, 1) / totalChars;
    s.targetWords = Math.max(MIN_SECTION_WORDS, Math.round(showWords * share));
    s.minSegments = Math.max(3, Math.round(target.minSegments * share));
  }

  return {
    rootNodeId: rootId,
    rootName: root.name ?? 'Podcast',
    wholeSubtree: false,
    sections,
  };
}

// ── Options fingerprint (a different voice/style/length is a different show) ─

export function podcastOptionsFingerprint(
  style: PodcastStyle,
  length: PodcastLength,
  voices: Record<string, OpenAIVoice>,
): string {
  return hashText(JSON.stringify({ style, length, voices }));
}

// ── The Compile Manifest ────────────────────────────────────────────────────

export interface PodcastManifestSegment {
  speaker: string;
  voice: OpenAIVoice;
  text: string;
  /** Audio-clip cache reference (Electron clip cache), when known. */
  clipKey?: string;
  /** Which engine produced the cached clip ('openai' | 'say'). */
  engine?: string;
  durationSeconds?: number;
}

export interface PodcastManifestSection {
  index: number;
  key: string;
  title: string;
  sourceNodeIds: string[];
  fingerprint: string;
  segments: PodcastManifestSegment[];
}

export interface PodcastManifest {
  version: 1;
  format: 'podcast';
  rootNodeId: string;
  rootName: string;
  compiledAt: number;
  optionsFingerprint: string;
  style: PodcastStyle;
  length: PodcastLength;
  voices: Record<string, OpenAIVoice>;
  sections: PodcastManifestSection[];
}

const MANIFEST_STORE_KEY = 'idiampro-podcast-manifests';
/** Keep at most this many podcast records; oldest compiledAt evicted first. */
const MAX_MANIFESTS = 12;

type ManifestStore = Record<string, PodcastManifest>;

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

export function loadPodcastManifest(rootNodeId: string): PodcastManifest | null {
  const m = readStore()[rootNodeId];
  return m && m.version === 1 && Array.isArray(m.sections) ? m : null;
}

export function savePodcastManifest(manifest: PodcastManifest): void {
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
 * Assemble the manifest after a successful audio generation: the plan gives
 * section identity + source nodes; `segments` is the FINAL (possibly
 * user-edited) script; `segmentResults` (from the Electron generator, aligned
 * by segment order) contributes each clip's cache reference.
 */
export function buildPodcastManifest(opts: {
  plan: PodcastSectionPlan;
  style: PodcastStyle;
  length: PodcastLength;
  voices: Record<string, OpenAIVoice>;
  segments: PodcastScriptSegment[];
  segmentResults?: Array<{ index: number; engine?: string; clipKey?: string; durationSeconds?: number } | null>;
}): PodcastManifest {
  const { plan, style, length, voices, segments, segmentResults } = opts;
  const sections: PodcastManifestSection[] = plan.sections.map((s) => ({
    index: s.index,
    key: s.key,
    title: s.title,
    sourceNodeIds: s.nodeIds,
    fingerprint: s.fingerprint,
    segments: [],
  }));
  segments.forEach((seg, i) => {
    const idx = typeof seg.sectionIndex === 'number' ? seg.sectionIndex : 0;
    const section = sections[Math.min(Math.max(idx, 0), sections.length - 1)];
    const r = segmentResults?.[i] ?? null;
    section.segments.push({
      speaker: seg.speaker,
      voice: seg.voice,
      text: seg.text,
      clipKey: r?.clipKey,
      engine: r?.engine,
      durationSeconds: r?.durationSeconds,
    });
  });
  return {
    version: 1,
    format: 'podcast',
    rootNodeId: plan.rootNodeId,
    rootName: plan.rootName,
    compiledAt: Date.now(),
    optionsFingerprint: podcastOptionsFingerprint(style, length, voices),
    style,
    length,
    voices,
    sections,
  };
}

// ── Staleness diff (plan vs. manifest) ──────────────────────────────────────

export interface PodcastSectionDiff {
  /** Plan sections whose source content changed (or are new) — need fresh script+audio. */
  changed: PodcastSectionPlanSection[];
  /** Plan sections whose source is untouched AND have a stored script to reuse. */
  unchanged: PodcastSectionPlanSection[];
  total: number;
}

export function diffPodcastSections(
  plan: PodcastSectionPlan,
  manifest: PodcastManifest,
): PodcastSectionDiff {
  const byKey = new Map(manifest.sections.map((s) => [s.key, s]));
  const changed: PodcastSectionPlanSection[] = [];
  const unchanged: PodcastSectionPlanSection[] = [];
  for (const s of plan.sections) {
    const prev = byKey.get(s.key);
    if (prev && prev.fingerprint === s.fingerprint && prev.segments.length > 0) {
      unchanged.push(s);
    } else {
      changed.push(s);
    }
  }
  return { changed, unchanged, total: plan.sections.length };
}

/** The stored, reusable script lines of a manifest section (by plan-section key). */
export function reusableSegmentsFor(
  manifest: PodcastManifest,
  sectionKey: string,
  sectionIndex: number,
): PodcastScriptSegment[] {
  const section = manifest.sections.find((s) => s.key === sectionKey);
  if (!section) return [];
  return section.segments.map((seg) => ({
    speaker: seg.speaker,
    voice: seg.voice,
    text: seg.text,
    sectionIndex,
  }));
}
