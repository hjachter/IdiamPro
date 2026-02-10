'use client';

import type { ImportOptions, ImportResult, ParsedNode } from '../types';
import { BaseImporter } from '../base-importer';

/**
 * Import OPML (Outline Processor Markup Language) files
 * Standard format for outline interchange
 */
export class OpmlImporter extends BaseImporter {
  formatId = 'opml';
  supportedExtensions = ['.opml', '.xml'];
  supportedMimeTypes = ['text/x-opml', 'application/xml', 'text/xml'];

  async parse(
    content: string,
    filename: string,
    options?: ImportOptions
  ): Promise<ImportResult> {
    const text = this.normalizeText(content as string);
    const warnings: string[] = [];

    // Parse XML
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Invalid OPML file: ' + parseError.textContent);
    }

    // Get title from head
    const titleEl = doc.querySelector('head > title');
    const title = titleEl?.textContent?.trim() ||
                  options?.outlineName ||
                  this.getOutlineNameFromFilename(filename);

    // Get body
    const body = doc.querySelector('body');
    if (!body) {
      throw new Error('Invalid OPML: no body element found');
    }

    // Parse outline elements
    const root: ParsedNode = {
      name: title,
      children: [],
    };

    const topLevelOutlines = body.querySelectorAll(':scope > outline');
    for (const outline of topLevelOutlines) {
      const parsed = this.parseOutlineElement(outline);
      if (parsed) {
        root.children!.push(parsed);
      }
    }

    if (root.children?.length === 0) {
      warnings.push('No outline elements found in OPML file.');
    }

    const { outline, stats } = this.buildOutlineFromTree(root, title);

    return {
      outline,
      stats,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private parseOutlineElement(element: Element): ParsedNode | null {
    // Get text attribute (required)
    const text = element.getAttribute('text');
    if (!text) {
      return null;
    }

    const node: ParsedNode = {
      name: text,
    };

    // Get note/content if available
    const note = element.getAttribute('_note') || element.getAttribute('note');
    if (note) {
      node.content = note;
    }

    // Parse children
    const childOutlines = element.querySelectorAll(':scope > outline');
    if (childOutlines.length > 0) {
      node.children = [];
      for (const child of childOutlines) {
        const parsed = this.parseOutlineElement(child);
        if (parsed) {
          node.children.push(parsed);
        }
      }
    }

    return node;
  }
}
