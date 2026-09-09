'use client';

import type { ImportOptions, ImportResult, ParsedNode } from '../types';
import { BaseImporter } from '../base-importer';

/**
 * Import Markdown files into outline structure
 * Parses headings (#, ##, etc.) as hierarchy
 */
export class MarkdownImporter extends BaseImporter {
  formatId = 'markdown';
  supportedExtensions = ['.md', '.markdown'];
  supportedMimeTypes = ['text/markdown', 'text/x-markdown'];

  async parse(
    content: string,
    filename: string,
    options?: ImportOptions
  ): Promise<ImportResult> {
    const text = this.normalizeText(content as string);
    const lines = text.split('\n');
    const warnings: string[] = [];

    // Parse markdown into tree structure
    const root: ParsedNode = {
      name: options?.outlineName || this.getOutlineNameFromFilename(filename),
      children: [],
    };

    // Stack to track current position in tree
    // Each item: { node, level }
    const stack: { node: ParsedNode; level: number }[] = [{ node: root, level: 0 }];

    let currentContent: string[] = [];
    let lastHeadingNode: ParsedNode | null = null;

    for (const line of lines) {
      // `(.*)` (not `.+`) so a heading with an empty title — which our own
      // Markdown exporter writes for empty-named nodes — is still a node
      // instead of being silently dropped.
      const headingMatch = line.match(/^(#{1,6})\s(.*)$/);

      if (headingMatch) {
        // Save accumulated content to previous heading
        if (lastHeadingNode && currentContent.length > 0) {
          lastHeadingNode.content = currentContent.join('\n').trim();
          currentContent = [];
        }

        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();

        const newNode: ParsedNode = {
          name: title,
          children: [],
        };

        // Find parent: pop stack until we find a node with lower level
        while (stack.length > 1 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }

        // Add to parent
        const parent = stack[stack.length - 1].node;
        if (!parent.children) parent.children = [];
        parent.children.push(newNode);

        // Push to stack
        stack.push({ node: newNode, level });
        lastHeadingNode = newNode;
      } else {
        // Non-heading line - accumulate as content
        currentContent.push(line);
      }
    }

    // Save final content
    if (lastHeadingNode && currentContent.length > 0) {
      lastHeadingNode.content = currentContent.join('\n').trim();
    } else if (!lastHeadingNode && currentContent.length > 0) {
      // No headings found - content goes to root
      root.content = currentContent.join('\n').trim();
    }

    // If no children were created, treat each paragraph as a node
    if (root.children?.length === 0) {
      warnings.push('No headings found. Content imported as single node.');
      root.content = text;
    }

    // If the document has exactly ONE top-level heading and no preamble text
    // (the shape our own Markdown exporter writes — the outline's root node as
    // a single "# Title"), use it directly as the root instead of nesting it
    // under a synthetic wrapper. Without this, an IdeaM → Markdown → IdeaM
    // round-trip silently pushed every node one level deeper.
    const effectiveRoot =
      root.children && root.children.length === 1 && !root.content
        ? root.children[0]
        : root;

    const { outline, stats } = this.buildOutlineFromTree(effectiveRoot, effectiveRoot.name || root.name);

    return {
      outline,
      stats,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}
