'use client';

import type { ImportOptions, ImportResult, ParsedNode } from '../types';
import { BaseImporter } from '../base-importer';

/**
 * Import plain text files with indentation-based hierarchy
 * Each line's indentation level determines its depth
 */
export class PlainTextImporter extends BaseImporter {
  formatId = 'plain-text';
  supportedExtensions = ['.txt'];
  supportedMimeTypes = ['text/plain'];

  async parse(
    content: string,
    filename: string,
    options?: ImportOptions
  ): Promise<ImportResult> {
    const text = this.normalizeText(content as string);
    const lines = text.split('\n').filter(line => line.trim());
    const warnings: string[] = [];

    if (lines.length === 0) {
      warnings.push('Empty file imported.');
      const emptyRoot: ParsedNode = {
        name: options?.outlineName || this.getOutlineNameFromFilename(filename),
        children: [],
      };
      const { outline, stats } = this.buildOutlineFromTree(emptyRoot, emptyRoot.name);
      return { outline, stats, warnings };
    }

    // Detect indentation style (tabs or spaces, and how many)
    const indentInfo = this.detectIndentation(lines);

    // Parse into tree
    const root: ParsedNode = {
      name: options?.outlineName || this.getOutlineNameFromFilename(filename),
      children: [],
    };

    // Stack: { node, level }
    const stack: { node: ParsedNode; level: number }[] = [{ node: root, level: -1 }];

    for (const line of lines) {
      const trimmed = line.trimStart();
      const indentLength = line.length - trimmed.length;
      const level = this.calculateLevel(indentLength, indentInfo);

      // Remove common prefixes like "- ", "* ", "• ", numbers
      const cleanName = this.cleanNodeName(trimmed);

      const newNode: ParsedNode = {
        name: cleanName,
        children: [],
      };

      // Find parent
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      // Add to parent
      const parent = stack[stack.length - 1].node;
      if (!parent.children) parent.children = [];
      parent.children.push(newNode);

      stack.push({ node: newNode, level });
    }

    const { outline, stats } = this.buildOutlineFromTree(root, root.name);

    return {
      outline,
      stats,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private detectIndentation(lines: string[]): { useTabs: boolean; spacesPerLevel: number } {
    let minSpaces = Infinity;
    let hasTabs = false;

    for (const line of lines) {
      const match = line.match(/^(\s+)/);
      if (match) {
        const indent = match[1];
        if (indent.includes('\t')) {
          hasTabs = true;
        } else {
          minSpaces = Math.min(minSpaces, indent.length);
        }
      }
    }

    if (hasTabs) {
      return { useTabs: true, spacesPerLevel: 1 };
    }

    // Common indentation levels: 2 or 4 spaces
    const spacesPerLevel = minSpaces === Infinity ? 2 : (minSpaces <= 2 ? 2 : 4);
    return { useTabs: false, spacesPerLevel };
  }

  private calculateLevel(
    indentLength: number,
    info: { useTabs: boolean; spacesPerLevel: number }
  ): number {
    if (info.useTabs) {
      // Count tabs
      return indentLength;
    }
    return Math.floor(indentLength / info.spacesPerLevel);
  }

  private cleanNodeName(text: string): string {
    // Remove common list prefixes
    return text
      .replace(/^[-*•]\s+/, '')           // Bullet points
      .replace(/^\d+[.)]\s+/, '')          // Numbered lists
      .replace(/^\[[xX\s]\]\s+/, '')       // Checkboxes
      .trim();
  }
}
