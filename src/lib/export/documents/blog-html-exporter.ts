'use client';

import type { Outline } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to clean semantic HTML blog post
 * CMS-ready article with proper semantic markup
 */
export class BlogHtmlExporter extends BaseExporter {
  formatId = 'blog-html';
  mimeType = 'text/html';
  extension = '.html';

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

    const parts: string[] = [];

    // Build article body from children of root
    this.traverseDepthFirst(nodes, root, (node, depth) => {
      if (depth === 0) return; // Skip root — it becomes the title

      const headingLevel = Math.min(depth + 1, 6);
      parts.push(`<h${headingLevel}>${this.escapeHtml(node.name)}</h${headingLevel}>`);

      if (includeContent && node.content) {
        const content = node.content.trim();
        if (content) {
          parts.push(`<div>${content}</div>`);
        }
      }
    }, maxDepth);

    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      background: #fff;
      color: #333;
      line-height: 1.8;
    }
    article {
      max-width: 720px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }
    header { margin-bottom: 2.5rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1.5rem; }
    h1 { font-size: 2.25rem; line-height: 1.2; margin-bottom: 0.75rem; color: #111; }
    .meta { color: #6b7280; font-size: 0.9rem; font-style: italic; }
    h2 { font-size: 1.5rem; margin: 2rem 0 0.75rem; color: #111; }
    h3 { font-size: 1.25rem; margin: 1.5rem 0 0.5rem; color: #222; }
    h4, h5, h6 { font-size: 1.1rem; margin: 1.25rem 0 0.5rem; color: #333; }
    p { margin-bottom: 1rem; }
    ul, ol { margin: 0.5rem 0 1rem 2rem; }
    blockquote {
      border-left: 3px solid #d1d5db;
      padding-left: 1rem;
      margin: 1rem 0;
      color: #555;
      font-style: italic;
    }
    code { background: #f3f4f6; padding: 0.15rem 0.3rem; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f3f4f6; padding: 1rem; border-radius: 6px; overflow-x: auto; margin: 1rem 0; }
    a { color: #2563eb; }
    footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <article>
    <header>
      <h1>${this.escapeHtml(title)}</h1>
      <p class="meta">${date}</p>
    </header>
    ${parts.join('\n    ')}
    <footer>
      <p>Exported from IdiamPro</p>
    </footer>
  </article>
</body>
</html>`;

    return {
      data: html,
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }
}
