'use client';

import type { Outline, OutlineNode } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to OPML (Outline Processor Markup Language) format
 * Standard format for outline interchange between applications
 */
export class OpmlExporter extends BaseExporter {
  formatId = 'opml';
  mimeType = 'text/x-opml';
  extension = '.opml';

  async convert(
    outline: Outline,
    rootNodeId?: string,
    options?: ExportOptions
  ): Promise<ExportResult> {
    const root = rootNodeId || outline.rootNodeId;
    const nodes = outline.nodes;
    const rootNode = nodes[root];
    const title = options?.title || rootNode?.name || outline.name;
    const includeContent = options?.includeContent ?? true;
    const maxDepth = options?.maxDepth;

    const body = this.buildOpmlOutline(nodes, root, includeContent, maxDepth);
    const dateCreated = new Date().toISOString();

    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${this.escapeXml(title)}</title>
    <dateCreated>${dateCreated}</dateCreated>
    <ownerName>IdiamPro</ownerName>
  </head>
  <body>
${body}
  </body>
</opml>
`;

    return {
      data: opml,
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }

  private buildOpmlOutline(
    nodes: Record<string, OutlineNode>,
    nodeId: string,
    includeContent: boolean,
    maxDepth?: number,
    depth: number = 0
  ): string {
    if (maxDepth !== undefined && depth > maxDepth) return '';

    const node = nodes[nodeId];
    if (!node) return '';

    const indent = '    '.repeat(depth + 1);
    const text = this.escapeXml(node.name);

    // Build attributes
    let attrs = `text="${text}"`;

    // Add note (content) attribute if enabled
    if (includeContent && node.content) {
      const content = this.stripHtml(node.content);
      if (content) {
        attrs += ` _note="${this.escapeXml(content)}"`;
      }
    }

    // Add type if not default
    if (node.type && node.type !== 'default') {
      attrs += ` _type="${this.escapeXml(node.type)}"`;
    }

    // Build children
    const hasChildren = node.childrenIds && node.childrenIds.length > 0;

    if (hasChildren) {
      let xml = `${indent}<outline ${attrs}>\n`;
      for (const childId of node.childrenIds!) {
        xml += this.buildOpmlOutline(nodes, childId, includeContent, maxDepth, depth + 1);
      }
      xml += `${indent}</outline>\n`;
      return xml;
    } else {
      return `${indent}<outline ${attrs}/>\n`;
    }
  }
}
