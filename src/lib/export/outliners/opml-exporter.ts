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
    const includeMetadata = options?.includeMetadata ?? false;
    const maxDepth = options?.maxDepth;

    const body = this.buildOpmlOutline(nodes, root, includeContent, includeMetadata, maxDepth);
    const dateCreated = new Date().toISOString();

    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${this.escapeXml(title)}</title>
    <dateCreated>${dateCreated}</dateCreated>
    <ownerName>IdeaM</ownerName>
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
    includeMetadata: boolean,
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
    if (node.type && node.type !== 'document') {
      attrs += ` _type="${this.escapeXml(node.type)}"`;
    }

    // Metadata (tags, color, completion) as OPML custom attributes — custom
    // "_"-prefixed attributes are legal OPML; other apps simply ignore them,
    // while our own importer reads them back so a round-trip is not lossy.
    if (includeMetadata && node.metadata) {
      const meta = node.metadata;
      if (meta.tags && meta.tags.length > 0) {
        attrs += ` _tags="${this.escapeXml(meta.tags.join(','))}"`;
      }
      if (meta.color && meta.color !== 'default') {
        attrs += ` _color="${this.escapeXml(meta.color)}"`;
      }
      if (meta.isCompleted !== undefined) {
        attrs += ` _completed="${meta.isCompleted ? 'true' : 'false'}"`;
      }
    }

    // Build children
    const hasChildren = node.childrenIds && node.childrenIds.length > 0;

    if (hasChildren) {
      let xml = `${indent}<outline ${attrs}>\n`;
      for (const childId of node.childrenIds!) {
        xml += this.buildOpmlOutline(nodes, childId, includeContent, includeMetadata, maxDepth, depth + 1);
      }
      xml += `${indent}</outline>\n`;
      return xml;
    } else {
      return `${indent}<outline ${attrs}/>\n`;
    }
  }
}
