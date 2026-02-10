'use client';

import type { Outline, OutlineNode } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to Obsidian-compatible Markdown
 * Uses [[wiki-links]] for internal references
 */
export class ObsidianExporter extends BaseExporter {
  formatId = 'obsidian';
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

    // Add YAML frontmatter
    parts.push('---');
    parts.push(`title: "${this.escapeYaml(nodes[root]?.name || outline.name)}"`);
    parts.push(`created: ${new Date().toISOString()}`);
    parts.push(`source: IdiamPro`);
    parts.push('---');
    parts.push('');

    this.traverseDepthFirst(nodes, root, (node, depth) => {
      // Generate heading
      const headingLevel = Math.min(depth + 1, 6);
      const heading = '#'.repeat(headingLevel);

      // Create wiki-link friendly name
      const wikiLink = this.toWikiLink(node.name);
      parts.push(`${heading} ${node.name}`);

      // Add content if enabled
      if (includeContent && node.content) {
        const content = this.processContentForObsidian(node.content);
        if (content) {
          parts.push('');
          parts.push(content);
        }
      }

      // Add child links as wiki-links
      if (node.childrenIds && node.childrenIds.length > 0) {
        parts.push('');
        parts.push('**Sub-topics:**');
        for (const childId of node.childrenIds) {
          const childNode = nodes[childId];
          if (childNode) {
            parts.push(`- [[${this.toWikiLink(childNode.name)}]]`);
          }
        }
      }

      parts.push('');
    }, maxDepth);

    const markdown = parts.join('\n').trim() + '\n';

    return {
      data: markdown,
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }

  private toWikiLink(name: string): string {
    // Remove characters that are problematic in wiki-links
    return name
      .replace(/[\[\]#|^]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private escapeYaml(str: string): string {
    return str.replace(/"/g, '\\"');
  }

  private processContentForObsidian(html: string): string {
    let content = this.stripHtml(html);

    // Convert URLs to Obsidian external links
    content = content.replace(
      /https?:\/\/[^\s]+/g,
      (url) => `[${url}](${url})`
    );

    return content;
  }
}
