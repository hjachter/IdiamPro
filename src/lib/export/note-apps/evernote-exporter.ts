'use client';

import type { Outline } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to Evernote ENEX XML format
 * Creates a single note with the outline content as HTML
 */
export class EvernoteExporter extends BaseExporter {
  formatId = 'evernote';
  mimeType = 'application/xml';
  extension = '.enex';

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

    // Build HTML content for the note
    const htmlParts: string[] = [];
    this.traverseDepthFirst(nodes, root, (node, depth) => {
      if (depth === 0) return; // Root is the note title

      const indent = '&nbsp;&nbsp;'.repeat(depth - 1);
      htmlParts.push(`<div>${indent}<b>${this.escapeHtml(node.name)}</b></div>`);

      if (includeContent && node.content) {
        const content = this.stripHtml(node.content);
        if (content) {
          for (const line of content.split('\n')) {
            if (line.trim()) {
              htmlParts.push(`<div>${indent}&nbsp;&nbsp;${this.escapeHtml(line.trim())}</div>`);
            }
          }
        }
      }
    }, maxDepth);

    const noteContent = htmlParts.join('\n');
    const date = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const enex = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export4.dtd">
<en-export export-date="${date}" application="IdiamPro">
  <note>
    <title>${this.escapeXml(title)}</title>
    <content><![CDATA[<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
<en-note>
${noteContent}
</en-note>]]></content>
    <created>${date}</created>
    <updated>${date}</updated>
    <note-attributes>
      <source>IdiamPro</source>
    </note-attributes>
  </note>
</en-export>`;

    return {
      data: enex,
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }
}
