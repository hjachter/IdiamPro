'use client';

import type { Outline } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to Emacs Org-mode format
 * Uses * heading hierarchy with content as body text
 */
export class OrgModeExporter extends BaseExporter {
  formatId = 'org-mode';
  mimeType = 'text/x-org';
  extension = '.org';

  async convert(
    outline: Outline,
    rootNodeId?: string,
    options?: ExportOptions
  ): Promise<ExportResult> {
    const parts: string[] = [];
    const root = rootNodeId || outline.rootNodeId;
    const nodes = outline.nodes;
    const rootNode = nodes[root];
    const title = options?.title || rootNode?.name || outline.name;
    const includeContent = options?.includeContent ?? true;
    const maxDepth = options?.maxDepth;

    // Org-mode file header
    parts.push(`#+TITLE: ${title}`);
    parts.push(`#+DATE: ${new Date().toISOString().slice(0, 10)}`);
    parts.push(`#+OPTIONS: toc:t`);
    parts.push('');

    this.traverseDepthFirst(nodes, root, (node, depth) => {
      // Stars for heading level
      const stars = '*'.repeat(depth + 1);
      parts.push(`${stars} ${node.name}`);

      if (includeContent && node.content) {
        const content = this.stripHtml(node.content);
        if (content) {
          // Indent content body under the heading
          parts.push(content);
        }
      }

      parts.push('');
    }, maxDepth);

    return {
      data: parts.join('\n').trim() + '\n',
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }
}
