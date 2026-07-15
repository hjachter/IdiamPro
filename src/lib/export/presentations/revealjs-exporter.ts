'use client';

import type { Outline, OutlineNode } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to Reveal.js HTML slide deck
 * Self-contained HTML presentation with embedded Reveal.js from CDN
 */
export class RevealjsExporter extends BaseExporter {
  formatId = 'revealjs';
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
    const maxDepth = options?.maxDepth ?? 2; // Limit depth for slides

    const slides = this.buildSlides(nodes, root, includeContent, maxDepth);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4/dist/theme/white.css">
  <style>
    .reveal h1 { font-size: 2.2em; }
    .reveal h2 { font-size: 1.6em; }
    .reveal h3 { font-size: 1.3em; }
    .reveal ul { text-align: left; }
    .reveal .slide-content { font-size: 0.85em; text-align: left; margin-top: 1em; }
    .reveal .title-slide h1 { margin-bottom: 0.5em; }
    .reveal .title-slide p { color: #666; font-size: 0.8em; }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
      <section class="title-slide">
        <h1>${this.escapeHtml(title)}</h1>
        <p>Exported from IdiamPro</p>
      </section>
${slides}
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@4/dist/reveal.js"></script>
  <script>
    Reveal.initialize({
      hash: true,
      transition: 'slide',
      slideNumber: true,
    });
  </script>
</body>
</html>`;

    return {
      data: html,
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }

  private buildSlides(
    nodes: Record<string, OutlineNode>,
    rootId: string,
    includeContent: boolean,
    maxDepth: number
  ): string {
    const rootNode = nodes[rootId];
    if (!rootNode?.childrenIds?.length) return '';

    const slides: string[] = [];

    for (const childId of rootNode.childrenIds) {
      const child = nodes[childId];
      if (!child) continue;

      const hasSubSlides = child.childrenIds && child.childrenIds.length > 0 && maxDepth > 1;

      if (hasSubSlides) {
        // Vertical slide stack
        slides.push('      <section>');
        // Parent slide
        slides.push('        <section>');
        slides.push(`          <h2>${this.escapeHtml(child.name)}</h2>`);
        if (includeContent && child.content) {
          const content = this.stripHtml(child.content);
          if (content) {
            slides.push(`          <div class="slide-content"><p>${this.escapeHtml(content)}</p></div>`);
          }
        }
        // Show sub-topics as bullet preview
        if (child.childrenIds!.length > 0) {
          slides.push('          <ul>');
          for (const subId of child.childrenIds!) {
            const sub = nodes[subId];
            if (sub) slides.push(`            <li>${this.escapeHtml(sub.name)}</li>`);
          }
          slides.push('          </ul>');
        }
        slides.push('        </section>');

        // Child slides
        for (const subId of child.childrenIds!) {
          const sub = nodes[subId];
          if (!sub) continue;
          slides.push('        <section>');
          slides.push(`          <h3>${this.escapeHtml(sub.name)}</h3>`);
          if (includeContent && sub.content) {
            const content = this.stripHtml(sub.content);
            if (content) {
              slides.push(`          <div class="slide-content"><p>${this.escapeHtml(content)}</p></div>`);
            }
          }
          // Sub-children as bullets
          if (sub.childrenIds?.length) {
            slides.push('          <ul>');
            for (const bulletId of sub.childrenIds) {
              const bullet = nodes[bulletId];
              if (bullet) slides.push(`            <li>${this.escapeHtml(bullet.name)}</li>`);
            }
            slides.push('          </ul>');
          }
          slides.push('        </section>');
        }

        slides.push('      </section>');
      } else {
        // Single slide
        slides.push('      <section>');
        slides.push(`        <h2>${this.escapeHtml(child.name)}</h2>`);
        if (includeContent && child.content) {
          const content = this.stripHtml(child.content);
          if (content) {
            slides.push(`        <div class="slide-content"><p>${this.escapeHtml(content)}</p></div>`);
          }
        }
        // Children as bullets
        if (child.childrenIds?.length) {
          slides.push('        <ul>');
          for (const bulletId of child.childrenIds) {
            const bullet = nodes[bulletId];
            if (bullet) slides.push(`          <li>${this.escapeHtml(bullet.name)}</li>`);
          }
          slides.push('        </ul>');
        }
        slides.push('      </section>');
      }
    }

    return slides.join('\n');
  }
}
