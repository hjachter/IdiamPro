'use client';

import type { Outline, OutlineNode } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to self-contained HTML website
 * Includes collapsible sections, styling, and navigation
 */
export class HtmlExporter extends BaseExporter {
  formatId = 'html';
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

    const bodyContent = this.buildHtmlTree(nodes, root, includeContent, maxDepth);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <style>
${this.getStyles()}
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${this.escapeHtml(title)}</h1>
      <div class="controls">
        <button onclick="expandAll()">Expand All</button>
        <button onclick="collapseAll()">Collapse All</button>
      </div>
    </header>
    <main>
${bodyContent}
    </main>
    <footer>
      <p>Exported from IdiamPro</p>
    </footer>
  </div>
  <script>
${this.getScript()}
  </script>
</body>
</html>`;

    return {
      data: html,
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }

  private buildHtmlTree(
    nodes: Record<string, OutlineNode>,
    nodeId: string,
    includeContent: boolean,
    maxDepth?: number,
    depth: number = 0
  ): string {
    if (maxDepth !== undefined && depth > maxDepth) return '';

    const node = nodes[nodeId];
    if (!node) return '';

    const hasChildren = node.childrenIds && node.childrenIds.length > 0;
    const headingLevel = Math.min(depth + 2, 6); // Start at h2, max h6
    const indent = '      '.repeat(depth);

    let html = '';

    // Section container
    html += `${indent}<section class="node depth-${depth}">\n`;

    // Heading with toggle if has children
    if (hasChildren) {
      html += `${indent}  <h${headingLevel} class="collapsible" onclick="toggle(this)">\n`;
      html += `${indent}    <span class="toggle-icon">▼</span>\n`;
      html += `${indent}    <span class="prefix">${this.escapeHtml(node.prefix || '')}</span>\n`;
      html += `${indent}    ${this.escapeHtml(node.name)}\n`;
      html += `${indent}  </h${headingLevel}>\n`;
    } else {
      html += `${indent}  <h${headingLevel}>\n`;
      html += `${indent}    <span class="prefix">${this.escapeHtml(node.prefix || '')}</span>\n`;
      html += `${indent}    ${this.escapeHtml(node.name)}\n`;
      html += `${indent}  </h${headingLevel}>\n`;
    }

    // Content
    if (includeContent && node.content) {
      const content = node.content.trim();
      if (content) {
        html += `${indent}  <div class="content">${content}</div>\n`;
      }
    }

    // Children
    if (hasChildren) {
      html += `${indent}  <div class="children">\n`;
      for (const childId of node.childrenIds!) {
        html += this.buildHtmlTree(nodes, childId, includeContent, maxDepth, depth + 1);
      }
      html += `${indent}  </div>\n`;
    }

    html += `${indent}</section>\n`;

    return html;
  }

  private getStyles(): string {
    return `
    :root {
      --primary: #2563eb;
      --bg: #ffffff;
      --text: #1f2937;
      --muted: #6b7280;
      --border: #e5e7eb;
      --hover: #f3f4f6;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1f2937;
        --text: #f9fafb;
        --muted: #9ca3af;
        --border: #374151;
        --hover: #374151;
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }

    header h1 {
      font-size: 1.75rem;
      font-weight: 600;
    }

    .controls button {
      padding: 0.5rem 1rem;
      margin-left: 0.5rem;
      border: 1px solid var(--border);
      border-radius: 0.375rem;
      background: var(--bg);
      color: var(--text);
      cursor: pointer;
      font-size: 0.875rem;
    }

    .controls button:hover {
      background: var(--hover);
    }

    section.node {
      margin-bottom: 0.5rem;
    }

    h2, h3, h4, h5, h6 {
      font-weight: 600;
      margin: 1rem 0 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .collapsible {
      cursor: pointer;
      user-select: none;
    }

    .collapsible:hover {
      color: var(--primary);
    }

    .toggle-icon {
      font-size: 0.75rem;
      transition: transform 0.2s;
      width: 1rem;
      text-align: center;
    }

    .collapsed .toggle-icon {
      transform: rotate(-90deg);
    }

    .collapsed + .content,
    .collapsed ~ .children {
      display: none;
    }

    .prefix {
      color: var(--muted);
      font-size: 0.875em;
      font-weight: normal;
    }

    .content {
      margin-left: 1.5rem;
      padding: 0.5rem 0;
      color: var(--text);
    }

    .content p { margin-bottom: 0.5rem; }
    .content ul, .content ol { margin-left: 1.5rem; margin-bottom: 0.5rem; }
    .content code { background: var(--hover); padding: 0.125rem 0.25rem; border-radius: 0.25rem; }
    .content pre { background: var(--hover); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
    .content a { color: var(--primary); }

    .children {
      margin-left: 1rem;
      padding-left: 1rem;
      border-left: 2px solid var(--border);
    }

    .depth-0 > h2 { font-size: 1.5rem; }
    .depth-1 > h3 { font-size: 1.25rem; }
    .depth-2 > h4 { font-size: 1.125rem; }
    .depth-3 > h5 { font-size: 1rem; }
    .depth-4 > h6 { font-size: 0.9375rem; }

    footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--muted);
      font-size: 0.875rem;
    }

    @media print {
      .controls { display: none; }
      .children { border-left: none; }
      .collapsed + .content,
      .collapsed ~ .children { display: block; }
    }
    `;
  }

  private getScript(): string {
    return `
    function toggle(element) {
      element.classList.toggle('collapsed');
    }

    function expandAll() {
      document.querySelectorAll('.collapsible').forEach(el => {
        el.classList.remove('collapsed');
      });
    }

    function collapseAll() {
      document.querySelectorAll('.collapsible').forEach(el => {
        el.classList.add('collapsed');
      });
    }
    `;
  }
}
