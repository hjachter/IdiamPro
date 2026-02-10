'use client';

import type { Outline, OutlineNode } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to Markdown format
 * Uses heading levels for hierarchy (#, ##, ###, etc.)
 */
export class MarkdownExporter extends BaseExporter {
  formatId = 'markdown';
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
      // Generate heading (max 6 levels in Markdown)
      const headingLevel = Math.min(depth + 1, 6);
      const heading = '#'.repeat(headingLevel);
      parts.push(`${heading} ${node.name}`);

      // Add content if enabled
      if (includeContent && node.content) {
        const content = this.stripHtml(node.content);
        if (content) {
          parts.push('');
          parts.push(content);
        }
      }

      // Add blank line after each section
      parts.push('');
    }, maxDepth);

    const markdown = parts.join('\n').trim() + '\n';

    return {
      data: markdown,
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }
}
