// ============================================================================
// Derive slideshow slides from a REAL outline chapter (Phase 2).
// ----------------------------------------------------------------------------
// A "chapter" is the currently-selected node treated as the root of a subtree.
// We turn that node + its descendants into a small array of slides that the
// Electron video pipeline (electron/video-generator.js) can render:
//
//   { title: string, bullets: string[], narration: string }
//
// Mapping (deliberately simple — Phase 3 makes slides pretty, Phase 4 adds a
// smarter AI script):
//   • Slide 1 (intro): the chapter node itself. Title = chapter name, bullets =
//     the names of its direct children (a mini agenda), narration = chapter
//     name + its own content prose.
//   • One slide per direct child: title = child name, bullets = that child's
//     own children's names, or — if it has none — sentences pulled from its
//     content. Narration = child name + its content prose.
//
// This reads the user's actual outline text, NOT a hardcoded sample.
// ============================================================================

import type { NodeMap } from '@/types';

export interface VideoSlide {
  title: string;
  bullets: string[];
  narration: string;
  /** 'cover' = the opening title slide; 'content' = a regular body slide. */
  kind?: 'cover' | 'content';
}

const MAX_BULLETS = 5;

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

/**
 * Build the slide array for a chapter subtree.
 *
 * @param nodes      the outline's node map
 * @param chapterId  the selected node id (root of the chapter)
 * @returns          slides in reading order (intro first)
 */
export function deriveSlidesFromChapter(nodes: NodeMap, chapterId: string): VideoSlide[] {
  const chapter = nodes[chapterId];
  if (!chapter) return [];

  const slides: VideoSlide[] = [];
  const childIds = (chapter.childrenIds || []).filter((id) => nodes[id]);

  // --- Intro slide: the chapter node itself. ---
  const chapterProse = stripHtml(chapter.content);
  const agenda = childIds
    .map((id) => nodes[id]?.name?.trim())
    .filter((n): n is string => !!n)
    .slice(0, MAX_BULLETS);
  slides.push({
    title: chapter.name || 'Untitled',
    bullets: agenda,
    narration: [chapter.name, chapterProse].filter(Boolean).join('. '),
    kind: 'cover',
  });

  // --- One slide per direct child. ---
  for (const childId of childIds) {
    const child = nodes[childId];
    if (!child) continue;
    const prose = stripHtml(child.content);
    const grandchildNames = (child.childrenIds || [])
      .map((id) => nodes[id]?.name?.trim())
      .filter((n): n is string => !!n)
      .slice(0, MAX_BULLETS);

    // Prefer grandchildren names as bullets; else fall back to sentences of the
    // child's own content so the slide isn't empty.
    const bullets = grandchildNames.length > 0
      ? grandchildNames
      : sentencesToBullets(prose, 4);

    // Narration: the child's name plus its prose. If neither prose nor
    // grandchildren exist, at least read the title so the slide has audio.
    const narrationParts = [child.name, prose].filter(Boolean);
    const narration = narrationParts.length > 0
      ? narrationParts.join('. ')
      : (child.name || 'Untitled');

    slides.push({
      title: child.name || 'Untitled',
      bullets,
      narration,
      kind: 'content',
    });
  }

  return slides;
}
