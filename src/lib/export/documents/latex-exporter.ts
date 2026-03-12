'use client';

import type { Outline } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to LaTeX format
 * Uses \section, \subsection hierarchy
 */
export class LatexExporter extends BaseExporter {
  formatId = 'latex';
  mimeType = 'application/x-latex';
  extension = '.tex';

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

    // Preamble
    parts.push('\\documentclass{article}');
    parts.push('\\usepackage[utf8]{inputenc}');
    parts.push('\\usepackage[T1]{fontenc}');
    parts.push('\\usepackage{hyperref}');
    parts.push('\\usepackage{geometry}');
    parts.push('\\geometry{margin=1in}');
    parts.push('');
    parts.push(`\\title{${this.escapeLatex(title)}}`);
    parts.push('\\author{Exported from IdiamPro}');
    parts.push(`\\date{${new Date().toLocaleDateString()}}`);
    parts.push('');
    parts.push('\\begin{document}');
    parts.push('\\maketitle');
    parts.push('\\tableofcontents');
    parts.push('\\newpage');
    parts.push('');

    // LaTeX section commands by depth
    const sectionCommands = [
      'section', 'subsection', 'subsubsection',
      'paragraph', 'subparagraph',
    ];

    this.traverseDepthFirst(nodes, root, (node, depth) => {
      const cmdIndex = Math.min(depth, sectionCommands.length - 1);
      const cmd = sectionCommands[cmdIndex];
      parts.push(`\\${cmd}{${this.escapeLatex(node.name)}}`);

      if (includeContent && node.content) {
        const content = this.stripHtml(node.content);
        if (content) {
          parts.push('');
          parts.push(this.escapeLatex(content));
        }
      }

      parts.push('');
    }, maxDepth);

    parts.push('\\end{document}');

    return {
      data: parts.join('\n'),
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }

  private escapeLatex(str: string): string {
    return str
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/[&%$#_{}]/g, (m) => `\\${m}`)
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  }
}
