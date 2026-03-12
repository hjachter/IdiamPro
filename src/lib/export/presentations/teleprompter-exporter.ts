'use client';

import type { Outline } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to teleprompter-ready HTML
 * Large scrolling text optimized for reading while presenting/recording
 */
export class TeleprompterExporter extends BaseExporter {
  formatId = 'teleprompter';
  mimeType = 'text/html';
  extension = '.html';

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

    this.traverseDepthFirst(nodes, root, (node, depth) => {
      if (depth === 0) return; // Root is the title

      if (node.childrenIds && node.childrenIds.length > 0) {
        // Section header
        parts.push(`<div class="section-break">---</div>`);
        parts.push(`<h2>${this.escapeHtml(node.name)}</h2>`);
      } else {
        // Speaking point
        parts.push(`<p class="point">${this.escapeHtml(node.name)}</p>`);
      }

      if (includeContent && node.content) {
        const content = this.stripHtml(node.content);
        if (content) {
          parts.push(`<p class="detail">${this.escapeHtml(content)}</p>`);
        }
      }
    }, maxDepth);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)} - Teleprompter</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif;
      font-size: 2.5rem;
      line-height: 1.6;
      padding: 40vh 2rem 80vh;
      cursor: none;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { font-size: 3rem; margin-bottom: 2rem; text-align: center; color: #ffd700; }
    h2 { font-size: 2.8rem; margin: 2rem 0 1rem; color: #87ceeb; }
    .point { margin: 1.5rem 0; }
    .detail { color: #ccc; font-size: 2rem; margin: 0.5rem 0 1.5rem; }
    .section-break { text-align: center; color: #555; margin: 2rem 0 0.5rem; font-size: 1.5rem; }
    .controls {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      display: flex;
      gap: 0.5rem;
      opacity: 0.3;
      cursor: pointer;
    }
    .controls:hover { opacity: 1; }
    .controls button {
      background: #333;
      color: #fff;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
    }
    .controls button:hover { background: #555; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${this.escapeHtml(title)}</h1>
    ${parts.join('\n    ')}
  </div>
  <div class="controls">
    <button onclick="startScroll()">Auto-Scroll</button>
    <button onclick="stopScroll()">Stop</button>
    <button onclick="faster()">Faster</button>
    <button onclick="slower()">Slower</button>
  </div>
  <script>
    let scrollInterval = null;
    let speed = 1;
    function startScroll() {
      stopScroll();
      scrollInterval = setInterval(() => window.scrollBy(0, speed), 30);
    }
    function stopScroll() { if (scrollInterval) { clearInterval(scrollInterval); scrollInterval = null; } }
    function faster() { speed = Math.min(speed + 0.5, 10); }
    function slower() { speed = Math.max(speed - 0.5, 0.5); }
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ') { e.preventDefault(); scrollInterval ? stopScroll() : startScroll(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); slower(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); faster(); }
    });
  </script>
</body>
</html>`;

    return {
      data: html,
      filename: `${this.sanitizeFilename(title)}_teleprompter.html`,
      mimeType: 'text/html',
    };
  }
}
