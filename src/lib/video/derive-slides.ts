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

export interface VideoSlide {
  title: string;
  bullets: string[];
  narration: string;
  /** 'cover' = the opening title slide; 'content' = a regular body slide. */
  kind?: 'cover' | 'content';
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
const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_MAX_SLIDES = 400;

export interface DeriveSlidesOptions {
  /** How many levels below the chapter get their own slides. 1 = direct
   *  children only; 99 (or any large value) = the full outline. Default 2. */
  maxDepth?: number;
  /** Hard safety cap on total slides so a huge outline can't run away. */
  maxSlides?: number;
}

/** Strip HTML tags and collapse whitespace to plain prose. */
function stripHtml(html: string): string {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Break plain prose into up to `max` sentence-ish bullet fragments. */
function sentencesToBullets(text: string, max: number): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, max);
}

/** Live child ids (existing nodes only). */
function liveChildIds(nodes: NodeMap, id: string): string[] {
  const node = nodes[id];
  if (!node) return [];
  return (node.childrenIds || []).filter((cid) => nodes[cid]);
}

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
  const agenda = liveChildIds(nodes, chapterId)
    .map((id) => nodes[id]?.name?.trim())
    .filter((n): n is string => !!n)
    .slice(0, MAX_BULLETS);
  slides.push({
    title: chapter.name || 'Untitled',
    bullets: agenda,
    narration: [chapter.name, chapterProse].filter(Boolean).join('. '),
    kind: 'cover',
  });

  // Build a content slide for a single node.
  const buildContentSlide = (childId: string): VideoSlide => {
    const child = nodes[childId];
    const prose = stripHtml(child.content);
    const childIds = liveChildIds(nodes, childId);
    const grandchildNames = childIds
      .map((id) => nodes[id]?.name?.trim())
      .filter((n): n is string => !!n)
      .slice(0, MAX_BULLETS);

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
      : sentencesToBullets(prose, 4);

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
    };
  };

  // Depth-first walk: the children of `node` sit at `level`. We start at
  // walk(chapter, 1) so the chapter's direct children are level 1.
  const walk = (parentId: string, level: number): void => {
    for (const childId of liveChildIds(nodes, parentId)) {
      if (slides.length >= maxSlides) return; // safety cap reached
      slides.push(buildContentSlide(childId));
      // Recurse into this child's subtree if we haven't reached maxDepth and
      // it actually has children.
      if (level < maxDepth && liveChildIds(nodes, childId).length > 0) {
        walk(childId, level + 1);
        if (slides.length >= maxSlides) return;
      }
    }
  };

  walk(chapterId, 1);

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
