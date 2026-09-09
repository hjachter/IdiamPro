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

    // Recursive build so every <details> toggle closes right after its OWN
    // subtree. (The previous flat traversal appended all missing </details>
    // tags at the end of the file, which nested later siblings inside earlier
    // toggles — silently corrupting the structure Notion sees.)
    const emit = (nodeId: string, depth: number): void => {
      if (maxDepth !== undefined && depth > maxDepth) return;
      const node = nodes[nodeId];
      if (!node) return;

      const headingLevel = Math.min(depth + 1, 3); // Notion supports h1-h3
      const hasChildren = node.childrenIds && node.childrenIds.length > 0;
      const isToggle = depth > 2 && hasChildren;

      if (depth <= 2) {
        // Use headings for top levels
        const heading = '#'.repeat(headingLevel);
        parts.push(`${heading} ${node.name}`);
      } else if (isToggle) {
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

      if (hasChildren) {
        for (const childId of node.childrenIds!) {
          emit(childId, depth + 1);
        }
      }

      if (isToggle) {
        parts.push('</details>');
        parts.push('');
      }
    };

    emit(root, 0);

    return {
      data: parts.join('\n').trim() + '\n',
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }
}
