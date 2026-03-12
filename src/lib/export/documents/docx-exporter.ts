'use client';

import type { Outline } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to DOCX format using Flat OPC XML
 * Single-file Office Open XML that Word opens natively — no zip needed
 */
export class DocxExporter extends BaseExporter {
  formatId = 'docx';
  mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  extension = '.docx';

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

    const bodyParts: string[] = [];

    // Title paragraph
    bodyParts.push(this.makeDocxParagraph(title, 'Title'));

    this.traverseDepthFirst(nodes, root, (node, depth) => {
      if (depth === 0) return; // Skip root — used as title

      // Heading levels: Heading1 through Heading9
      const headingLevel = Math.min(depth, 9);
      bodyParts.push(this.makeDocxParagraph(node.name, `Heading${headingLevel}`));

      if (includeContent && node.content) {
        const content = this.stripHtml(node.content);
        if (content) {
          // Split content paragraphs
          for (const para of content.split('\n\n')) {
            const trimmed = para.trim();
            if (trimmed) {
              bodyParts.push(this.makeDocxParagraph(trimmed, 'Normal'));
            }
          }
        }
      }
    }, maxDepth);

    const xml = this.buildFlatOpcXml(bodyParts.join('\n'));

    // Flat OPC XML files use .xml extension but we save as .docx
    // Word opens Flat OPC XML natively when the file has .docx extension
    return {
      data: xml,
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: 'application/xml',
    };
  }

  private makeDocxParagraph(text: string, style: string): string {
    const escaped = this.escapeXml(text);
    return `<w:p>
  <w:pPr><w:pStyle w:val="${style}"/></w:pPr>
  <w:r><w:t xml:space="preserve">${escaped}</w:t></w:r>
</w:p>`;
  }

  private buildFlatOpcXml(bodyContent: string): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Word.Document"?>
<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">
  <pkg:part pkg:name="/_rels/.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml">
    <pkg:xmlData>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>
    </pkg:xmlData>
  </pkg:part>
  <pkg:part pkg:name="/word/_rels/document.xml.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml">
    <pkg:xmlData>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
      </Relationships>
    </pkg:xmlData>
  </pkg:part>
  <pkg:part pkg:name="/word/styles.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml">
    <pkg:xmlData>
      <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:style w:type="paragraph" w:styleId="Title">
          <w:name w:val="Title"/>
          <w:pPr><w:jc w:val="center"/></w:pPr>
          <w:rPr><w:b/><w:sz w:val="56"/></w:rPr>
        </w:style>
        <w:style w:type="paragraph" w:styleId="Heading1">
          <w:name w:val="heading 1"/>
          <w:pPr><w:outlineLvl w:val="0"/></w:pPr>
          <w:rPr><w:b/><w:sz w:val="36"/></w:rPr>
        </w:style>
        <w:style w:type="paragraph" w:styleId="Heading2">
          <w:name w:val="heading 2"/>
          <w:pPr><w:outlineLvl w:val="1"/></w:pPr>
          <w:rPr><w:b/><w:sz w:val="32"/></w:rPr>
        </w:style>
        <w:style w:type="paragraph" w:styleId="Heading3">
          <w:name w:val="heading 3"/>
          <w:pPr><w:outlineLvl w:val="2"/></w:pPr>
          <w:rPr><w:b/><w:sz w:val="28"/></w:rPr>
        </w:style>
        <w:style w:type="paragraph" w:styleId="Heading4">
          <w:name w:val="heading 4"/>
          <w:pPr><w:outlineLvl w:val="3"/></w:pPr>
          <w:rPr><w:b/><w:sz w:val="26"/></w:rPr>
        </w:style>
        <w:style w:type="paragraph" w:styleId="Heading5">
          <w:name w:val="heading 5"/>
          <w:pPr><w:outlineLvl w:val="4"/></w:pPr>
          <w:rPr><w:b/><w:sz w:val="24"/></w:rPr>
        </w:style>
        <w:style w:type="paragraph" w:styleId="Heading6">
          <w:name w:val="heading 6"/>
          <w:pPr><w:outlineLvl w:val="5"/></w:pPr>
          <w:rPr><w:b/><w:i/><w:sz w:val="24"/></w:rPr>
        </w:style>
        <w:style w:type="paragraph" w:styleId="Heading7">
          <w:name w:val="heading 7"/>
          <w:pPr><w:outlineLvl w:val="6"/></w:pPr>
          <w:rPr><w:sz w:val="24"/></w:rPr>
        </w:style>
        <w:style w:type="paragraph" w:styleId="Heading8">
          <w:name w:val="heading 8"/>
          <w:pPr><w:outlineLvl w:val="7"/></w:pPr>
          <w:rPr><w:i/><w:sz w:val="24"/></w:rPr>
        </w:style>
        <w:style w:type="paragraph" w:styleId="Heading9">
          <w:name w:val="heading 9"/>
          <w:pPr><w:outlineLvl w:val="8"/></w:pPr>
          <w:rPr><w:i/><w:sz w:val="22"/></w:rPr>
        </w:style>
        <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
          <w:name w:val="Normal"/>
          <w:rPr><w:sz w:val="24"/></w:rPr>
        </w:style>
      </w:styles>
    </pkg:xmlData>
  </pkg:part>
  <pkg:part pkg:name="/word/document.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml">
    <pkg:xmlData>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
${bodyContent}
        </w:body>
      </w:document>
    </pkg:xmlData>
  </pkg:part>
</pkg:package>`;
  }
}
