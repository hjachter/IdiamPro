// ============================================================================
// Derive a SLIDE DECK model from a real outline branch (deterministic — no AI).
// ----------------------------------------------------------------------------
// Sibling of src/lib/video/derive-slides.ts, but shaped for a presentation:
//   • A TITLE slide from the branch (outline / selected node) name.
//   • An optional ARC diagram slide (thought → idea → produce → publish).
//   • For each TOP-LEVEL child, a SECTION slide carrying that section's OWN
//     prose as bullets (the real substance — not just its sub-headings), plus a
//     native bar CHART when the text carries clear numbers/percentages.
//   • For each of that section's children, a follow-on CONTENT slide with the
//     child's prose as bullets — so the deck reads as a full talk, not a
//     table-of-contents skeleton.
//   • A CLOSING slide.
//
// This reads the user's ACTUAL outline text — nothing is hardcoded. It is fully
// deterministic (no LLM call), so building a deck never touches the AI meter.
//
// TEXT SAFETY: all surfaced text runs through `cleanText`, which (a) decodes the
// HTML entities our outlines store (&ldquo; &amp; &times; &ndash; numeric, …)
// and (b) strips tags to plain text while INSERTING a space at every tag
// boundary — so words never run together and raw "&ldquo;" never leaks onto a
// slide. pptxgenjs escapes the decoded text itself, so we must hand it real
// characters, never entities (handing it entities double-encodes them).
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
  /** Hard cap on top-level section slides so a giant outline can't run away. Default 30. */
  maxSections?: number;
}

const MAX_BULLETS = 6;
const MAX_BULLET_CHARS = 150;
const MAX_SECTIONS_DEFAULT = 30;
// Per top-level section, how many child slides we'll expand (keeps huge outlines sane).
const MAX_CHILD_SLIDES = 6;
// Absolute ceiling on total slides regardless of outline size.
const MAX_TOTAL_SLIDES = 60;
// A chart needs at least this many data points to be worth drawing.
const MIN_CHART_POINTS = 2;
const MAX_CHART_POINTS = 6;

/** Decode the HTML entities our outlines actually contain — named + numeric —
 *  so real characters (not "&ldquo;") reach the slide. A few (·, —, –) become
 *  clean separators so "80% x · 29% y" splits nicely for the chart extractor. */
function decodeEntities(s: string): string {
  return String(s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&middot;/g, ' · ')
    .replace(/&bull;/g, ' · ')
    .replace(/&mdash;/g, ' — ')
    .replace(/&ndash;/g, '–')
    .replace(/&times;/g, '×')
    .replace(/&hellip;/g, '…')
    .replace(/&ldquo;|&rdquo;|&quot;/g, '"')
    .replace(/&lsquo;|&rsquo;|&apos;/g, "'")
    // Numeric entities (decimal & hex) — decode anything we didn't name above.
    .replace(/&#(\d+);/g, (_, n) => safeCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => safeCodePoint(parseInt(n, 16)));
}

function safeCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return ' ';
  try {
    return String.fromCodePoint(cp);
  } catch {
    return ' ';
  }
}

/** Strip tags → plain text. Block-closers become newlines; EVERY tag boundary
 *  becomes at least a space, so inline tags never fuse two words together.
 *  Entities are decoded AFTER stripping so an entity can never hide a tag. */
function stripHtml(html: string): string {
  const withBreaks = String(html || '')
    .replace(/<\/(p|div|li|h[1-6]|tr|ul|ol)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  return decodeEntities(withBreaks.replace(/<[^>]+>/g, ' '))
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/\s+([,.;:!?%)])/g, '$1') // drop the space a stripped tag left before punctuation
    .replace(/([(])\s+/g, '$1')
    .trim();
}

/** One-line clean text (names / titles): strip tags with spaces, decode, collapse. */
function cleanText(s: string): string {
  return decodeEntities(String(s || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?%)])/g, '$1')
    .replace(/([(])\s+/g, '$1')
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
  const parts = [cleanText(n.name || ''), stripHtml(n.content || '')];
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

  // A percentage, optionally a range ("10–25%") — we take the first number.
  const PCT = /(\d{1,3})(?:\s?[–-]\s?\d{1,3})?\s*%/g;
  for (const frag of fragments) {
    // EVERY percentage in the fragment — prose often packs several into one
    // sentence ("80% use it, 29% trust it, 45% lose time"), and dropping all
    // but the first would gut the chart.
    const matches = [...frag.matchAll(PCT)];
    for (let m = 0; m < matches.length; m++) {
      const pctMatch = matches[m];
      const value = parseInt(pctMatch[1], 10);
      if (isNaN(value) || value < 0 || value > 100) continue;

      const start = (pctMatch.index ?? 0) + pctMatch[0].length;
      // Label = words AFTER this number, stopping before the NEXT number so two
      // adjacent stats don't bleed into one label. Fall back to words BEFORE.
      const nextIdx = m + 1 < matches.length ? matches[m + 1].index ?? frag.length : frag.length;
      const after = frag.slice(start, nextIdx);
      const before = frag.slice(0, pctMatch.index ?? 0).replace(/~|≈|about|around|roughly|only|an estimated/gi, ' ');
      let label = shortLabel(after);
      if (!label) label = shortLabel(before.split(' ').reverse().join(' ')).split(' ').reverse().join(' ');
      if (!label) label = `${value}%`;

      const key = `${label.toLowerCase()}|${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label, value, isPercent: true });
      if (out.length >= MAX_CHART_POINTS) return out;
    }
  }
  return out.length >= MIN_CHART_POINTS ? out : [];
}

/** Break a node's own HTML content into presentation bullets — the real
 *  substance of the node. Splits on paragraphs/list-items, then on sentences
 *  and on inline separators (→, ·) so long "a → b → c" lines become tidy
 *  bullets instead of one truncated run. */
function bulletsFromContent(html: string, max = MAX_BULLETS): string[] {
  const text = stripHtml(html);
  if (!text) return [];
  const out: string[] = [];
  for (const line of text.split(/\n+/)) {
    // Split a line into sentences, then further on arrows / middots.
    const chunks = line
      .split(/(?<=[.!?])\s+/)
      .flatMap((s) => s.split(/\s*(?:→|·)\s*/))
      .map((s) => tidy(s))
      .filter(Boolean);
    for (const c of chunks) {
      out.push(c);
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** Bullets for a slide about `id`: prefer the node's OWN prose (the substance);
 *  fall back to its children's names when it has no prose of its own. */
function bulletsForNode(nodes: NodeMap, id: string): string[] {
  const own = bulletsFromContent(nodes[id]?.content || '');
  if (own.length > 0) return own;
  return liveChildIds(nodes, id)
    .map((cid) => cleanText(nodes[cid]?.name || ''))
    .filter(Boolean)
    .slice(0, MAX_BULLETS);
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

  const deckName = cleanText(root?.name || outlineName || 'Slide Deck');
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

  // --- Section slides (top-level child) + their children as follow-on slides ---
  const sectionIds = liveChildIds(nodes, rootId).slice(0, maxSections);
  let anyChart = false;
  const contentSlides: Extract<DeckSlide, { kind: 'section' }>[] = [];

  for (const sid of sectionIds) {
    const section = nodes[sid];
    if (!section) continue;

    // The section headline slide carries the section's OWN substance.
    const sectionChart = extractDataPoints(subtreeText(nodes, sid));
    if (sectionChart.length) anyChart = true;
    contentSlides.push({
      kind: 'section',
      title: cleanText(section.name) || 'Untitled',
      bullets: bulletsForNode(nodes, sid),
      chart: sectionChart.length ? sectionChart : undefined,
    });

    // Each child becomes its own content slide (the depth that makes a real talk).
    for (const cid of liveChildIds(nodes, sid).slice(0, MAX_CHILD_SLIDES)) {
      const child = nodes[cid];
      if (!child) continue;
      const childChart = extractDataPoints(subtreeText(nodes, cid));
      if (childChart.length) anyChart = true;
      contentSlides.push({
        kind: 'section',
        title: cleanText(child.name) || 'Untitled',
        bullets: bulletsForNode(nodes, cid),
        chart: childChart.length ? childChart : undefined,
      });
    }
  }

  slides.push(...contentSlides);

  // --- Guarantee a chart if the branch has data but no slide triggered one ---
  if (!anyChart) {
    const wholeData = extractDataPoints(subtreeText(nodes, rootId));
    if (wholeData.length) {
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

  // --- Absolute safety ceiling: keep the intro slides + a trailing closing. ---
  if (slides.length > MAX_TOTAL_SLIDES) {
    const closing = slides[slides.length - 1];
    const kept = slides.slice(0, MAX_TOTAL_SLIDES - 1);
    kept.push(closing);
    return { name: deckName, slides: kept };
  }

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
