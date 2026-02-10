'use client';

import type { Outline } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to plain text format
 * Uses indentation for hierarchy (2 spaces per level)
 */
export class PlainTextExporter extends BaseExporter {
  formatId = 'plain-text';
  mimeType = 'text/plain';
  extension = '.txt';

  async convert(
    outline: Outline,
    rootNodeId?: string,
    options?: ExportOptions
  ): Promise<ExportResult> {
    const lines: string[] = [];
    const root = rootNodeId || outline.rootNodeId;
    const nodes = outline.nodes;
    const includeContent = options?.includeContent ?? true;
    const maxDepth = options?.maxDepth;

    this.traverseDepthFirst(nodes, root, (node, depth) => {
      const indent = '  '.repeat(depth);

      // Add node name with prefix if available
      const prefix = node.prefix ? `${node.prefix} ` : '';
      lines.push(`${indent}${prefix}${node.name}`);

      // Add content if enabled (indented further)
      if (includeContent && node.content) {
        const content = this.stripHtml(node.content);
        if (content) {
          const contentIndent = '  '.repeat(depth + 1);
          // Split content into lines and indent each
          const contentLines = content.split('\n');
          for (const line of contentLines) {
            if (line.trim()) {
              lines.push(`${contentIndent}${line}`);
            }
          }
        }
      }
    }, maxDepth);

    const text = lines.join('\n') + '\n';

    return {
      data: text,
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }
}
