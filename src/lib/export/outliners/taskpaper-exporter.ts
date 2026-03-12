'use client';

import type { Outline } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to TaskPaper format
 * Projects end with ':', tasks start with '- ', notes are indented text
 */
export class TaskPaperExporter extends BaseExporter {
  formatId = 'taskpaper';
  mimeType = 'text/plain';
  extension = '.taskpaper';

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
      const indent = '\t'.repeat(depth);
      const hasChildren = node.childrenIds && node.childrenIds.length > 0;

      if (hasChildren) {
        // Projects (parent nodes) end with ':'
        parts.push(`${indent}${node.name}:`);
      } else {
        // Leaf nodes are tasks
        parts.push(`${indent}- ${node.name}`);
      }

      if (includeContent && node.content) {
        const content = this.stripHtml(node.content);
        if (content) {
          // Notes are indented one level deeper
          for (const line of content.split('\n')) {
            if (line.trim()) {
              parts.push(`${indent}\t${line.trim()}`);
            }
          }
        }
      }
    }, maxDepth);

    return {
      data: parts.join('\n') + '\n',
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }
}
