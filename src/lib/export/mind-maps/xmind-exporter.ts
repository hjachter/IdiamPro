'use client';

import type { Outline, OutlineNode } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to XMind format
 * XMind 8+ uses a ZIP containing content.json
 */
export class XMindExporter extends BaseExporter {
  formatId = 'xmind';
  mimeType = 'application/x-xmind';
  extension = '.xmind';

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

    const rootTopic = this.buildTopic(nodes, root, includeContent, maxDepth, 0);

    const content = [{
      id: this.generateId(),
      class: 'sheet',
      title,
      rootTopic,
    }];

    const blob = this.createXMindZip(JSON.stringify(content));

    return {
      data: blob,
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }

  private buildTopic(
    nodes: Record<string, OutlineNode>,
    nodeId: string,
    includeContent: boolean,
    maxDepth: number | undefined,
    depth: number
  ): any {
    if (maxDepth !== undefined && depth > maxDepth) return null;

    const node = nodes[nodeId];
    if (!node) return null;

    const topic: any = {
      id: this.generateId(),
      class: 'topic',
      title: node.name,
    };

    if (includeContent && node.content) {
      const content = this.stripHtml(node.content);
      if (content) {
        topic.notes = {
          plain: { content },
        };
      }
    }

    if (node.childrenIds && node.childrenIds.length > 0) {
      const children: any[] = [];
      for (const childId of node.childrenIds) {
        const childTopic = this.buildTopic(nodes, childId, includeContent, maxDepth, depth + 1);
        if (childTopic) children.push(childTopic);
      }
      if (children.length > 0) {
        topic.children = { attached: children };
      }
    }

    return topic;
  }

  private createXMindZip(contentJson: string): Blob {
    const encoder = new TextEncoder();
    const files: { name: string; content: Uint8Array }[] = [
      {
        name: 'content.json',
        content: encoder.encode(contentJson),
      },
      {
        name: 'metadata.json',
        content: encoder.encode(JSON.stringify({
          creator: { name: 'IdiamPro', version: '1.0.0' },
        })),
      },
      {
        name: 'manifest.json',
        content: encoder.encode(JSON.stringify({
          'file-entries': {
            'content.json': {},
            'metadata.json': {},
          },
        })),
      },
    ];

    return this.buildZipBlob(files);
  }

  private buildZipBlob(files: { name: string; content: Uint8Array }[]): Blob {
    const parts: Uint8Array[] = [];
    const centralDir: Uint8Array[] = [];
    let offset = 0;

    for (const file of files) {
      const nameBytes = new TextEncoder().encode(file.name);

      const header = new ArrayBuffer(30 + nameBytes.length);
      const hView = new DataView(header);
      hView.setUint32(0, 0x04034b50, true);
      hView.setUint16(4, 20, true);
      hView.setUint16(6, 0, true);
      hView.setUint16(8, 0, true); // store
      hView.setUint16(10, 0, true);
      hView.setUint16(12, 0, true);
      hView.setUint32(14, this.crc32(file.content), true);
      hView.setUint32(18, file.content.length, true);
      hView.setUint32(22, file.content.length, true);
      hView.setUint16(26, nameBytes.length, true);
      hView.setUint16(28, 0, true);
      new Uint8Array(header).set(nameBytes, 30);

      parts.push(new Uint8Array(header));
      parts.push(file.content);

      const cdEntry = new ArrayBuffer(46 + nameBytes.length);
      const cdView = new DataView(cdEntry);
      cdView.setUint32(0, 0x02014b50, true);
      cdView.setUint16(4, 20, true);
      cdView.setUint16(6, 20, true);
      cdView.setUint16(8, 0, true);
      cdView.setUint16(10, 0, true);
      cdView.setUint16(12, 0, true);
      cdView.setUint16(14, 0, true);
      cdView.setUint32(16, this.crc32(file.content), true);
      cdView.setUint32(20, file.content.length, true);
      cdView.setUint32(24, file.content.length, true);
      cdView.setUint16(28, nameBytes.length, true);
      cdView.setUint16(30, 0, true);
      cdView.setUint16(32, 0, true);
      cdView.setUint16(34, 0, true);
      cdView.setUint16(36, 0, true);
      cdView.setUint32(38, 0, true);
      cdView.setUint32(42, offset, true);
      new Uint8Array(cdEntry).set(nameBytes, 46);

      centralDir.push(new Uint8Array(cdEntry));
      offset += 30 + nameBytes.length + file.content.length;
    }

    const cdOffset = offset;
    let cdSize = 0;
    for (const entry of centralDir) {
      parts.push(entry);
      cdSize += entry.length;
    }

    const eocd = new ArrayBuffer(22);
    const eocdView = new DataView(eocd);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, files.length, true);
    eocdView.setUint16(10, files.length, true);
    eocdView.setUint32(12, cdSize, true);
    eocdView.setUint32(16, cdOffset, true);
    eocdView.setUint16(20, 0, true);
    parts.push(new Uint8Array(eocd));

    return new Blob(parts, { type: 'application/x-xmind' });
  }

  private crc32(data: Uint8Array): number {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  private generateId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
