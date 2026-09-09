// ============================================================================
// Derive slideshow slides from a REAL outline chapter (Phase 2).
// ----------------------------------------------------------------------------
// A "chapter" is the currently-selected node treated as the root of a subtree.
// We turn that node + its descendants into an array of slides that the Electron
// video pipeline (electron/video-generator.js) can render:
//
//   { title: string, bullets: string[], narration: string, kind }
//
// The mapping now walks the FULL hierarchy to a caller-chosen depth (maxDepth),
// producing a recursive agenda→detail structure:
//   • Cover slide: the chapter node itself. Title = chapter name, bullets =
//     the names of its direct children (a mini agenda), narration = chapter
//     name + its own content prose. kind:'cover'.
//   • Then, depth-first, one slide per node at each level up to maxDepth. Each
//     slide's bullets are its own children's names (a sub-agenda) or — if it
//     has no children — sentence fragments from its content. Its narration is
//     the node name + its content prose. kind:'content'.
//
// maxDepth semantics: 1 = only direct children get their own slides (the old
// two-levels-deep behavior); 2 = children + grandchildren; a large value (99)
// means "the full outline." A hard maxSlides cap keeps a giant outline from
// kicking off an unbounded render.
//
// This reads the user's actual outline text, NOT a hardcoded sample.
// ============================================================================

import type { NodeMap } from '@/types';
import { generateCappedMindmapMermaid } from '@/lib/outline-utils';
import { htmlToPlainText, liveChildIds, mapStructure } from '@/lib/compile-core';

export interface VideoSlide {
  title: string;
  bullets: string[];
  narration: string;
  /** 'cover' = the opening title slide; 'content' = a regular body slide. */
  kind?: 'cover' | 'content';
  /**
   * Which outline node this slide came from (the cover carries the chapter
   * node id). The derivation always knew this — recording it is the
   * traceability foundation of the content-compiler video adapter (Phase 3A):
   * the compile manifest maps every scene back to its node.
   */
  sourceNodeId?: string;
  /**
   * EVERY node id whose content shows on this slide: the node itself plus the
   * children whose names appear as its bullets/agenda. Used by the manifest
   * for scene → node traceability (and later staleness UX).
   */
  sourceNodeIds?: string[];
  /**
   * Optional Mermaid definition of a mind map for this slide's subtree. Only
   * SECTION slides (a node that HAS children) carry one; leaf slides and the
   * cover slide leave it undefined. The Electron pipeline renders it to a
   * visual and composes a split layout; if it fails, the slide falls back to
   * text-only. (Phase A of slide visuals — mind maps.)
   */
  mindmapMermaid?: string;
}

// Keep a slide's mind map readable: cap how deep and how many nodes it draws.
const MINDMAP_MAX_DEPTH = 2;
const MINDMAP_MAX_NODES = 20;

const MAX_BULLETS = 5;
// A bullet is a PHRASE, never a paragraph. Anything longer than this gets
// truncated at a word boundary with an ellipsis so slides stay readable and
// never render a run-on wall of text.
const MAX_BULLET_CHARS = 120;
const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_MAX_SLIDES = 400;

export interface DeriveSlidesOptions {
  /** How many levels below the chapter get their own slides. 1 = direct
   *  children only; 99 (or any large value) = the full outline. Default 2. */
  maxDepth?: number;
  /** Hard safety cap on total slides so a huge outline can't run away. */
  maxSlides?: number;
}

/** Strip HTML tags and collapse whitespace to plain prose.
 *  Shared implementation: compile-core (Phase 0 consolidation). */
function stripHtml(html: string): string {
  return htmlToPlainText(html, 'video-inline');
}

/**
 * Tidy a single bullet: collapse stray whitespace and cap it to a readable
 * length, truncating at a word boundary with an ellipsis when it runs long.
 * Emojis are preserved; only the layout-breaking length is trimmed.
 */
function tidyBullet(s: string): string {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= MAX_BULLET_CHARS) return t;
  const slice = t.slice(0, MAX_BULLET_CHARS);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > MAX_BULLET_CHARS * 0.6 ? slice.slice(0, lastSpace) : slice;
  return cut.replace(/[\s.,;:!?—-]+$/, '') + '…';
}

/**
 * Break a node's rich-text content into SHORT, clean bullets. Splits on block
 * boundaries (paragraphs, list items, <br>) AND sentence boundaries, trims each
 * fragment, drops empties, caps each bullet's length, and caps the count — so a
 * single dense paragraph becomes several readable phrases instead of one
 * run-on wall of text.
 */
function contentToBullets(html: string, max: number): string[] {
  if (!html) return [];
  // Turn block-level boundaries into newlines BEFORE stripping tags, so separate
  // paragraphs / list items don't fuse into one giant bullet.
  const withBreaks = String(html)
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  const text = withBreaks
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[^\S\n]+/g, ' '); // collapse spaces/tabs but KEEP newlines as splits
  const out: string[] = [];
  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // Split each line on sentence boundaries so a multi-sentence paragraph
    // becomes several bullets rather than one.
    for (const sentence of line.split(/(?<=[.!?])\s+/)) {
      const b = tidyBullet(sentence);
      if (b) out.push(b);
      if (out.length >= max) return out;
    }
  }
  return out;
}

// Live child ids (existing nodes only) now come from the shared compile-core
// (`liveChildIds`), imported above — Phase 0 consolidation.

/**
 * Build the slide array for a chapter subtree.
 *
 * @param nodes      the outline's node map
 * @param chapterId  the selected node id (root of the chapter)
 * @param opts       maxDepth / maxSlides controls
 * @returns          slides in reading order (cover first)
 */
export function deriveSlidesFromChapter(
  nodes: NodeMap,
  chapterId: string,
  opts: DeriveSlidesOptions = {},
): VideoSlide[] {
  const chapter = nodes[chapterId];
  if (!chapter) return [];

  const maxDepth = Math.max(1, Math.floor(opts.maxDepth ?? DEFAULT_MAX_DEPTH));
  const maxSlides = Math.max(1, Math.floor(opts.maxSlides ?? DEFAULT_MAX_SLIDES));

  const slides: VideoSlide[] = [];

  // --- Cover slide: the chapter node itself. ---
  const chapterProse = stripHtml(chapter.content);
  // Keep the (id, name) pairing so the agenda's source node ids are exactly
  // the children whose names actually appear on the cover.
  const agendaPairs = liveChildIds(nodes, chapterId)
    .map((id) => ({ id, name: nodes[id]?.name?.trim() }))
    .filter((p): p is { id: string; name: string } => !!p.name)
    .slice(0, MAX_BULLETS);
  const agenda = agendaPairs.map((p) => tidyBullet(p.name));
  slides.push({
    title: chapter.name || 'Untitled',
    bullets: agenda,
    narration: [chapter.name, chapterProse].filter(Boolean).join('. '),
    kind: 'cover',
    sourceNodeId: chapterId,
    sourceNodeIds: [chapterId, ...agendaPairs.map((p) => p.id)],
  });

  // Build a content slide for a single node.
  const buildContentSlide = (childId: string): VideoSlide => {
    const child = nodes[childId];
    const prose = stripHtml(child.content);
    const childIds = liveChildIds(nodes, childId);
    // Keep the (id, name) pairing so sourceNodeIds lists exactly the
    // grandchildren whose names appear as this slide's bullets.
    const grandchildPairs = childIds
      .map((id) => ({ id, name: nodes[id]?.name?.trim() }))
      .filter((p): p is { id: string; name: string } => !!p.name)
      .slice(0, MAX_BULLETS);
    const grandchildNames = grandchildPairs.map((p) => tidyBullet(p.name));

    // Section slides (a node that HAS children) carry a mind map of their
    // subtree; leaf slides stay text-only. Capped so it stays legible.
    const mindmapMermaid = childIds.length > 0
      ? generateCappedMindmapMermaid(child, nodes, {
          maxDepth: MINDMAP_MAX_DEPTH,
          maxNodes: MINDMAP_MAX_NODES,
        })
      : undefined;

    // Prefer children names as bullets (a sub-agenda); else fall back to
    // sentences of the node's own content so the slide isn't empty.
    const bullets = grandchildNames.length > 0
      ? grandchildNames
      : contentToBullets(child.content, MAX_BULLETS);

    // Narration: the node's name plus its prose. If neither exists, at least
    // read the title so the slide has audio.
    const narrationParts = [child.name, prose].filter(Boolean);
    const narration = narrationParts.length > 0
      ? narrationParts.join('. ')
      : (child.name || 'Untitled');

    return {
      title: child.name || 'Untitled',
      bullets,
      narration,
      kind: 'content',
      mindmapMermaid,
      sourceNodeId: childId,
      sourceNodeIds: grandchildNames.length > 0
        ? [childId, ...grandchildPairs.map((p) => p.id)]
        : [childId],
    };
  };

  // Which nodes get slides, in what order, under what caps, is now decided by
  // the shared Structure Mapper (compile-core, Phase 0 consolidation): a
  // pre-order enumeration of the subtree to maxDepth, capped at maxSlides
  // total units (the cover included). Unit 0 is the chapter itself — already
  // rendered as the cover above — so content slides are units 1+.
  const units = mapStructure(nodes, chapterId, { maxDepth, maxUnits: maxSlides });
  for (const unit of units.slice(1)) {
    slides.push(buildContentSlide(unit.nodeId));
  }

  // Enforce the cap defensively (walk already stops, but keep it exact).
  return slides.length > maxSlides ? slides.slice(0, maxSlides) : slides;
}

/**
 * Count how many slides a chapter would produce at a given depth WITHOUT
 * building them — lets the dialog show a live count / detect the cap cheaply.
 */
export function countSlidesForChapter(
  nodes: NodeMap,
  chapterId: string,
  opts: DeriveSlidesOptions = {},
): number {
  return deriveSlidesFromChapter(nodes, chapterId, opts).length;
}
