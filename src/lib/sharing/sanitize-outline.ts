'use client';

/**
 * Sanitize an outline's user-supplied content BEFORE it is rendered into a
 * published share page. This runs in the browser (where DOMPurify has a real
 * DOM) at publish time, so the HTML sent to the publish API already has any
 * `<script>`, inline event handlers, and `javascript:` URLs stripped out of
 * user content — while safe formatting (bold, lists, links, headings) is kept.
 *
 * This is the FIRST layer of XSS defense; the public view route adds a second
 * (a script-less sandboxed iframe) so a hand-crafted malicious payload still
 * can't execute.
 */

import DOMPurify from 'dompurify';
import type { Outline, OutlineNode } from '@/types';

/** Strip all HTML from a plain-text field (node names are never HTML). */
function sanitizeText(value: string | undefined): string {
  if (!value) return value ?? '';
  return DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/** Keep safe rich-text HTML; drop scripts, handlers, and dangerous URLs. */
function sanitizeRichHtml(value: string | undefined): string {
  if (!value) return value ?? '';
  return DOMPurify.sanitize(value, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style', 'srcset'],
  });
}

/**
 * Return a deep copy of the outline with every node's name and content
 * sanitized. The original outline is never mutated.
 */
export function sanitizeOutlineForShare(outline: Outline): Outline {
  const nodes: Record<string, OutlineNode> = {};
  for (const [id, node] of Object.entries(outline.nodes)) {
    nodes[id] = {
      ...node,
      name: sanitizeText(node.name),
      content: sanitizeRichHtml(node.content),
    };
  }
  return { ...outline, name: sanitizeText(outline.name), nodes };
}
