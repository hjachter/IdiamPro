'use client';

import type { Outline, OutlineNode } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to ePub format
 * Creates a valid ePub 3.0 using in-browser zip creation (raw ArrayBuffer)
 */
export class EpubExporter extends BaseExporter {
  formatId = 'epub';
  mimeType = 'application/epub+zip';
  extension = '.epub';

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

    // Build chapters from top-level children
    const chapters = this.buildChapters(nodes, root, includeContent, maxDepth);

    // Build the ePub zip
    const blob = this.createEpubZip(title, chapters);

    return {
      data: blob,
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }

  private buildChapters(
    nodes: Record<string, OutlineNode>,
    rootId: string,
    includeContent: boolean,
    maxDepth?: number
  ): { title: string; html: string }[] {
    const rootNode = nodes[rootId];
    if (!rootNode?.childrenIds?.length) {
      return [{ title: rootNode?.name || 'Untitled', html: this.nodeToHtml(nodes, rootId, includeContent, maxDepth, 0) }];
    }

    return rootNode.childrenIds.map((childId) => {
      const child = nodes[childId];
      if (!child) return { title: 'Untitled', html: '' };
      return {
        title: child.name,
        html: this.nodeToHtml(nodes, childId, includeContent, maxDepth, 0),
      };
    }).filter(ch => ch.html);
  }

  private nodeToHtml(
    nodes: Record<string, OutlineNode>,
    nodeId: string,
    includeContent: boolean,
    maxDepth: number | undefined,
    depth: number
  ): string {
    if (maxDepth !== undefined && depth > maxDepth) return '';
    const node = nodes[nodeId];
    if (!node) return '';

    const level = Math.min(depth + 1, 6);
    let html = `<h${level}>${this.escapeHtml(node.name)}</h${level}>`;

    if (includeContent && node.content) {
      const content = node.content.trim();
      if (content) {
        html += `<div>${content}</div>`;
      }
    }

    if (node.childrenIds?.length) {
      for (const childId of node.childrenIds) {
        html += this.nodeToHtml(nodes, childId, includeContent, maxDepth, depth + 1);
      }
    }

    return html;
  }

  private createEpubZip(title: string, chapters: { title: string; html: string }[]): Blob {
    const files: { name: string; content: Uint8Array }[] = [];
    const encoder = new TextEncoder();

    // mimetype must be first and uncompressed
    files.push({ name: 'mimetype', content: encoder.encode('application/epub+zip') });

    // META-INF/container.xml
    files.push({
      name: 'META-INF/container.xml',
      content: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`),
    });

    // Chapter XHTML files
    chapters.forEach((ch, i) => {
      files.push({
        name: `OEBPS/chapter${i + 1}.xhtml`,
        content: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${this.escapeHtml(ch.title)}</title>
<style>body{font-family:Georgia,serif;line-height:1.6;margin:1em;}</style>
</head>
<body>
${ch.html}
</body>
</html>`),
      });
    });

    // Table of contents (toc.xhtml)
    const tocItems = chapters.map((ch, i) =>
      `<li><a href="chapter${i + 1}.xhtml">${this.escapeHtml(ch.title)}</a></li>`
    ).join('\n');
    files.push({
      name: 'OEBPS/toc.xhtml',
      content: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Table of Contents</title></head>
<body>
<nav epub:type="toc">
<h1>Table of Contents</h1>
<ol>${tocItems}</ol>
</nav>
</body>
</html>`),
    });

    // content.opf (package document)
    const manifestItems = chapters.map((_, i) =>
      `<item id="ch${i + 1}" href="chapter${i + 1}.xhtml" media-type="application/xhtml+xml"/>`
    ).join('\n    ');
    const spineItems = chapters.map((_, i) =>
      `<itemref idref="ch${i + 1}"/>`
    ).join('\n    ');

    const uuid = this.generateUuid();
    files.push({
      name: 'OEBPS/content.opf',
      content: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${this.escapeXml(title)}</dc:title>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${manifestItems}
  </manifest>
  <spine>
    <itemref idref="toc"/>
    ${spineItems}
  </spine>
</package>`),
    });

    return this.buildZipBlob(files);
  }

  /**
   * Minimal ZIP file builder — no compression (store only)
   * Sufficient for text-based ePub content
   */
  private buildZipBlob(files: { name: string; content: Uint8Array }[]): Blob {
    const parts: Uint8Array[] = [];
    const centralDir: Uint8Array[] = [];
    let offset = 0;

    for (const file of files) {
      const nameBytes = new TextEncoder().encode(file.name);
      const isFirst = file.name === 'mimetype';

      // Local file header
      const header = new ArrayBuffer(30 + nameBytes.length);
      const hView = new DataView(header);
      hView.setUint32(0, 0x04034b50, true); // signature
      hView.setUint16(4, 20, true); // version needed
      hView.setUint16(6, 0, true); // flags
      hView.setUint16(8, 0, true); // compression: store
      hView.setUint16(10, 0, true); // mod time
      hView.setUint16(12, 0, true); // mod date
      hView.setUint32(14, this.crc32(file.content), true); // crc
      hView.setUint32(18, file.content.length, true); // compressed size
      hView.setUint32(22, file.content.length, true); // uncompressed size
      hView.setUint16(26, nameBytes.length, true); // name length
      hView.setUint16(28, 0, true); // extra field length
      new Uint8Array(header).set(nameBytes, 30);

      parts.push(new Uint8Array(header));
      parts.push(file.content);

      // Central directory entry
      const cdEntry = new ArrayBuffer(46 + nameBytes.length);
      const cdView = new DataView(cdEntry);
      cdView.setUint32(0, 0x02014b50, true); // signature
      cdView.setUint16(4, 20, true); // version made by
      cdView.setUint16(6, 20, true); // version needed
      cdView.setUint16(8, 0, true); // flags
      cdView.setUint16(10, 0, true); // compression: store
      cdView.setUint16(12, 0, true); // mod time
      cdView.setUint16(14, 0, true); // mod date
      cdView.setUint32(16, this.crc32(file.content), true); // crc
      cdView.setUint32(20, file.content.length, true); // compressed
      cdView.setUint32(24, file.content.length, true); // uncompressed
      cdView.setUint16(28, nameBytes.length, true); // name length
      cdView.setUint16(30, 0, true); // extra length
      cdView.setUint16(32, 0, true); // comment length
      cdView.setUint16(34, 0, true); // disk start
      cdView.setUint16(36, 0, true); // internal attrs
      cdView.setUint32(38, 0, true); // external attrs
      cdView.setUint32(42, offset, true); // local header offset
      new Uint8Array(cdEntry).set(nameBytes, 46);

      centralDir.push(new Uint8Array(cdEntry));

      offset += 30 + nameBytes.length + file.content.length;
    }

    // Central directory
    const cdOffset = offset;
    let cdSize = 0;
    for (const entry of centralDir) {
      parts.push(entry);
      cdSize += entry.length;
    }

    // End of central directory
    const eocd = new ArrayBuffer(22);
    const eocdView = new DataView(eocd);
    eocdView.setUint32(0, 0x06054b50, true); // signature
    eocdView.setUint16(4, 0, true); // disk number
    eocdView.setUint16(6, 0, true); // central dir disk
    eocdView.setUint16(8, files.length, true); // entries on disk
    eocdView.setUint16(10, files.length, true); // total entries
    eocdView.setUint32(12, cdSize, true); // central dir size
    eocdView.setUint32(16, cdOffset, true); // central dir offset
    eocdView.setUint16(20, 0, true); // comment length
    parts.push(new Uint8Array(eocd));

    return new Blob(parts, { type: 'application/epub+zip' });
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

  private generateUuid(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}
