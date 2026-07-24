// ============================================================================
// Derive a SLIDE DECK model from a real outline branch (deterministic — no AI).
// ----------------------------------------------------------------------------
// Sibling of src/lib/video/derive-slides.ts, but shaped for a presentation:
//   • A TITLE slide from the branch (outline / selected node) name.
//   • An optional ARC diagram slide (thought → idea → produce → publish).
//   • One SECTION slide per TOP-LEVEL child, with that child's sub-points as
//     bullets. If a section's text carries clear numbers/percentages, the slide
//     also gets a native bar CHART instead of just listing them.
//   • A CLOSING slide.
//
// This reads the user's ACTUAL outline text — nothing is hardcoded. It is fully
// deterministic (no LLM call), so building a deck never touches the AI meter.
// ============================================================================

import type { NodeMap } from '@/types';

export interface DeckDataPoint {
  label: string;
  value: number;
  /** True when the source value was a percentage (drives axis/label suffix). */
  isPercent: boolean;
}

export type DeckSlide =
  | { kind: 'title'; title: string; subtitle?: string }
  | { kind: 'arc' }
  | {
      kind: 'section';
      title: string;
      bullets: string[];
      /** When present, render a native chart from these points. */
      chart?: DeckDataPoint[];
    }
  | { kind: 'closing'; title: string; subtitle?: string };

export interface DeckModel {
  /** Deck/file title (the branch name). */
  name: string;
  slides: DeckSlide[];
}

export interface DeriveDeckOptions {
  /** Include the thought→idea→produce→publish arc slide. Default true. */
  includeArc?: boolean;
  /** Hard cap on section slides so a giant outline can't run away. Default 30. */
  maxSections?: number;
}

const MAX_BULLETS = 6;
const MAX_BULLET_CHARS = 110;
const MAX_SECTIONS_DEFAULT = 30;
// A chart needs at least this many data points to be worth drawing.
const MIN_CHART_POINTS = 2;
const MAX_CHART_POINTS = 6;

/** Decode the handful of HTML entities our outlines actually contain, and turn
 *  a few of them (·, —, –) into separators so "80% x · 29% y" splits cleanly. */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&middot;/g, ' · ')
    .replace(/&bull;/g, ' · ')
    .replace(/&mdash;/g, ' — ')
    .replace(/&ndash;/g, '–')
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'");
}

/** Strip tags → plain text, keeping block boundaries as newlines. */
function stripHtml(html: string): string {
  const withBreaks = String(html || '')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  return decodeEntities(withBreaks.replace(/<[^>]+>/g, ' '))
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function tidy(s: string, cap = MAX_BULLET_CHARS): string {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= cap) return t;
  const slice = t.slice(0, cap);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > cap * 0.6 ? slice.slice(0, lastSpace) : slice;
  return cut.replace(/[\s.,;:!?—-]+$/, '') + '…';
}

function liveChildIds(nodes: NodeMap, id: string): string[] {
  const node = nodes[id];
  if (!node) return [];
  return (node.childrenIds || []).filter((cid) => nodes[cid]);
}

/** Collect the full plain-text of a node's subtree (for data detection). */
function subtreeText(nodes: NodeMap, id: string, depth = 0): string {
  const n = nodes[id];
  if (!n || depth > 3) return '';
  const parts = [n.name || '', stripHtml(n.content || '')];
  for (const cid of liveChildIds(nodes, id)) parts.push(subtreeText(nodes, cid, depth + 1));
  return parts.filter(Boolean).join('\n');
}

/**
 * Pull labelled numeric data points out of free text.
 *
 * Splits on natural separators (·, ;, newlines, " — ") then, in each fragment
 * that contains a percentage (or a bare number followed by a word), records
 * {label, value}. Built for lines like:
 *   "80% use AI · 29% trust it · 45% lose time debugging"
 * → [{use AI,80},{trust it,29},{lose time debugging,45}]
 */
export function extractDataPoints(text: string): DeckDataPoint[] {
  const clean = decodeEntities(String(text || '').replace(/<[^>]+>/g, ' '));
  const fragments = clean
    .split(/[·•;\n]|(?:\s[—-]\s)/)
    .map((f) => f.trim())
    .filter(Boolean);

  const out: DeckDataPoint[] = [];
  const seen = new Set<string>();
  // Leading filler words to drop from the front of a label so it reads tight.
  const STOP = new Set(['of', 'the', 'a', 'an', 'in', 'to', 'that', 'who', 'say', 'they', 'is', 'are', 'use', 'used', 'and', 'for', 'on', 'with', 'their']);

  /** Take up to 4 meaningful words as a short axis label, dropping leading
   *  stopwords and stopping at the first sentence-punctuation. */
  const shortLabel = (raw: string): string => {
    const cleaned = raw.replace(/[,.;:—–()"'].*$/, '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    let words = cleaned.split(' ');
    while (words.length > 1 && STOP.has(words[0].toLowerCase())) words = words.slice(1);
    return tidy(words.slice(0, 4).join(' '), 24);
  };

  for (const frag of fragments) {
    // First percentage in the fragment; ranges ("10–25%") take the first number.
    const pctMatch = frag.match(/(\d{1,3})(?:\s?[–-]\s?\d{1,3})?\s*%/);
    if (!pctMatch) continue;
    const value = parseInt(pctMatch[1], 10);
    if (isNaN(value) || value < 0 || value > 100) continue;

    // Prefer the words immediately AFTER the number; fall back to the words
    // BEFORE it. This keeps labels tight even when the % sits inside prose.
    const after = frag.slice((pctMatch.index ?? 0) + pctMatch[0].length);
    const before = frag.slice(0, pctMatch.index ?? 0).replace(/~|≈|about|around|roughly|only|an estimated/gi, ' ');
    let label = shortLabel(after);
    if (!label) label = shortLabel(before.split(' ').reverse().join(' ')).split(' ').reverse().join(' ');
    if (!label) label = `${value}%`;

    const key = `${label.toLowerCase()}|${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, value, isPercent: true });
    if (out.length >= MAX_CHART_POINTS) break;
  }
  return out.length >= MIN_CHART_POINTS ? out : [];
}

/** Bullets for a section: prefer its children's names; else its own sentences. */
function bulletsForSection(nodes: NodeMap, id: string): string[] {
  const childNames = liveChildIds(nodes, id)
    .map((cid) => nodes[cid]?.name?.trim())
    .filter((n): n is string => !!n)
    .slice(0, MAX_BULLETS)
    .map((s) => tidy(s));
  if (childNames.length > 0) return childNames;

  // Leaf section — fall back to sentences of its own content.
  const prose = stripHtml(nodes[id]?.content || '');
  if (!prose) return [];
  const out: string[] = [];
  for (const line of prose.split(/\n+/)) {
    for (const sentence of line.split(/(?<=[.!?])\s+/)) {
      const b = tidy(sentence);
      if (b) out.push(b);
      if (out.length >= MAX_BULLETS) return out;
    }
  }
  return out;
}

/**
 * Build the deck model for a branch.
 *
 * @param nodes     the outline node map
 * @param rootId    the selected node (root of the branch / deck)
 * @param outlineName the containing outline's display name (fallback title)
 */
export function deriveDeck(
  nodes: NodeMap,
  rootId: string,
  outlineName?: string,
  opts: DeriveDeckOptions = {},
): DeckModel {
  const root = nodes[rootId];
  const includeArc = opts.includeArc !== false;
  const maxSections = Math.max(1, Math.floor(opts.maxSections ?? MAX_SECTIONS_DEFAULT));

  const deckName = (root?.name || outlineName || 'Slide Deck').trim();
  const slides: DeckSlide[] = [];

  // --- Title slide ---
  const rootProse = stripHtml(root?.content || '');
  const firstSentence = rootProse.split(/(?<=[.!?])\s+/)[0] || '';
  slides.push({
    kind: 'title',
    title: deckName,
    subtitle: firstSentence ? tidy(firstSentence, 140) : undefined,
  });

  // --- Optional arc diagram slide ---
  if (includeArc) slides.push({ kind: 'arc' });

  // --- One section slide per top-level child ---
  const sectionIds = liveChildIds(nodes, rootId).slice(0, maxSections);
  let anyChart = false;
  for (const sid of sectionIds) {
    const section = nodes[sid];
    if (!section) continue;
    const bullets = bulletsForSection(nodes, sid);
    const chart = extractDataPoints(subtreeText(nodes, sid));
    if (chart.length) anyChart = true;
    slides.push({
      kind: 'section',
      title: section.name?.trim() || 'Untitled',
      bullets,
      chart: chart.length ? chart : undefined,
    });
  }

  // --- Guarantee a chart if the branch has data but no section triggered one ---
  if (!anyChart) {
    const wholeData = extractDataPoints(subtreeText(nodes, rootId));
    if (wholeData.length) {
      // Insert right after the title/arc, before the sections.
      const insertAt = includeArc ? 2 : 1;
      slides.splice(insertAt, 0, {
        kind: 'section',
        title: 'By the Numbers',
        bullets: [],
        chart: wholeData,
      });
    }
  }

  // --- Closing slide ---
  slides.push({
    kind: 'closing',
    title: 'Thank you',
    subtitle: deckName,
  });

  return { name: deckName, slides };
}

/** Cheap count of how many slides a branch would produce (for the dialog). */
export function countDeckSlides(
  nodes: NodeMap,
  rootId: string,
  opts: DeriveDeckOptions = {},
): number {
  return deriveDeck(nodes, rootId, undefined, opts).slides.length;
}
