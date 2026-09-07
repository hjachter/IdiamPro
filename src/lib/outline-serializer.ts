import type { Outline, OutlineNode, NodeMap } from '@/types';
import { htmlToPlainText, walkSubtree } from '@/lib/compile-core';

/**
 * Convert a depth level to a markdown heading prefix.
 * Depth 0 = root = ##, depth 1 = ###, etc. Caps at ###### (h6).
 */
function depthToHeading(depth: number): string {
  const level = Math.min(depth + 2, 6);
  return '#'.repeat(level);
}

/**
 * Serialize a single outline to markdown text optimized for LLM readability.
 * Walks the node tree depth-first, converting each node to a markdown heading.
 * Skips canvas and spreadsheet nodes (binary data, not useful text).
 */
export function serializeOutline(outline: Outline): { text: string; nodeCount: number } {
  const parts: string[] = [];
  let nodeCount = 0;

  // Title
  parts.push(`# ${outline.name}`);
  if (outline.lastModified) {
    const date = new Date(outline.lastModified).toISOString().split('T')[0];
    parts.push(`Last modified: ${date}`);
  }
  parts.push('');

  // Traversal + strip via the shared compile-core (Phase 0 consolidation);
  // output is byte-identical to the pre-consolidation implementation.
  walkSubtree<OutlineNode>(outline.nodes, outline.rootNodeId, (node, depth) => {
    // Skip canvas and spreadsheet nodes — binary data, not useful text
    if (node.type === 'canvas' || node.type === 'spreadsheet') return 'skip-children';

    nodeCount++;

    // Use prefix (e.g. "1.2.3") if available, otherwise just heading
    const prefix = node.prefix ? `${node.prefix} ` : '';
    const heading = depthToHeading(depth);

    if (node.type !== 'root') {
      parts.push(`${heading} ${prefix}${node.name}`);
    }

    const text = htmlToPlainText(node.content, 'serializer');
    if (text) {
      parts.push(text);
    }

    parts.push('');
  });

  return { text: parts.join('\n'), nodeCount };
}

/**
 * Serialize multiple outlines into a single markdown document.
 * Filters out guide outlines. Joins with "---" separators.
 * Returns the combined text plus metadata for UI display.
 */
export function serializeOutlines(outlines: Outline[]): {
  text: string;
  outlineCount: number;
  nodeCount: number;
  estimatedTokens: number;
} {
  const nonGuide = outlines.filter(o => !o.isGuide);

  let totalNodeCount = 0;
  const sections: string[] = [];

  for (const outline of nonGuide) {
    // Skip outlines with no nodes (lazy-loaded stubs)
    if (!outline.nodes || Object.keys(outline.nodes).length === 0) continue;

    const { text, nodeCount } = serializeOutline(outline);
    totalNodeCount += nodeCount;
    sections.push(text);
  }

  const combined = sections.join('\n---\n\n');

  return {
    text: combined,
    outlineCount: sections.length,
    nodeCount: totalNodeCount,
    estimatedTokens: Math.round(combined.length / 4),
  };
}
