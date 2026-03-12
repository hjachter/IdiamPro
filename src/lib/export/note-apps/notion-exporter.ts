'use client';

import type { Outline } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to Notion-compatible Markdown
 * Uses toggle syntax (> details) for collapsible sections
 */
export class NotionExporter extends BaseExporter {
  formatId = 'notion';
  mimeType = 'text/markdown';
  extension = '.md';

  async convert(
    outline: Outline,
    rootNodeId?: string,
    options?: ExportOptions
  ): Promise<ExportResult> {
    const parts: string[] = [];
    const root = rootNodeId || outline.rootNodeId;
    const nodes = outline.nodes;
    const includeContent = options?.includeContent ?? true;
    const maxDepth = options?.maxDepth;

    this.traverseDepthFirst(nodes, root, (node, depth) => {
      const headingLevel = Math.min(depth + 1, 3); // Notion supports h1-h3
      const hasChildren = node.childrenIds && node.childrenIds.length > 0;

      if (depth <= 2) {
        // Use headings for top levels
        const heading = '#'.repeat(headingLevel);
        parts.push(`${heading} ${node.name}`);
      } else if (hasChildren) {
        // Use toggle (details) for deeper levels with children
        parts.push(`<details><summary><strong>${this.escapeHtml(node.name)}</strong></summary>`);
        parts.push('');
      } else {
        // Bulleted list item for leaf nodes at depth
        parts.push(`- ${node.name}`);
      }

      if (includeContent && node.content) {
        const content = this.stripHtml(node.content);
        if (content) {
          parts.push('');
          parts.push(content);
        }
      }

      parts.push('');
    }, maxDepth);

    // Close any open toggle blocks
    let result = parts.join('\n');
    // Simple approach: count open/close details tags
    const openCount = (result.match(/<details>/g) || []).length;
    const closeCount = (result.match(/<\/details>/g) || []).length;
    for (let i = 0; i < openCount - closeCount; i++) {
      result += '</details>\n\n';
    }

    return {
      data: result.trim() + '\n',
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }
}
