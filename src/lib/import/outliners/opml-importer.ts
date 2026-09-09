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
      const parsed = this.parseOutlineElement(outline, warnings);
      if (parsed) {
        root.children!.push(parsed);
      }
    }

    if (root.children?.length === 0) {
      warnings.push('No outline elements found in OPML file.');
    }

    // If the file has exactly ONE top-level outline element (the shape our own
    // exporter writes — the outline's root node), use it directly as the root
    // instead of nesting it under a synthetic wrapper. Without this, an
    // IdeaM → OPML → IdeaM round-trip silently pushed every node one level
    // deeper under a duplicate root.
    const effectiveRoot =
      root.children && root.children.length === 1 ? root.children[0] : root;

    const { outline, stats } = this.buildOutlineFromTree(effectiveRoot, title);

    return {
      outline,
      stats,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /** Node types we recognize when reading a `_type` attribute back in. */
  private static readonly KNOWN_TYPES = new Set([
    'root', 'chapter', 'document', 'note', 'task', 'link', 'outline-link',
    'code', 'quote', 'date', 'image', 'video', 'audio', 'pdf', 'youtube',
    'spreadsheet', 'database', 'app', 'map', 'canvas',
  ]);

  /** Colors we recognize when reading a `_color` attribute back in. */
  private static readonly KNOWN_COLORS = new Set([
    'default', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink',
  ]);

  private parseOutlineElement(element: Element, warnings: string[]): ParsedNode | null {
    // Get text attribute. The OPML spec requires it, but a missing or empty
    // one must NEVER silently swallow the node (and its whole subtree) —
    // import it with an empty name and tell the user.
    const text = element.getAttribute('text');
    if (text === null) {
      warnings.push('An outline item had no "text" attribute; imported with an empty name.');
    }

    const node: ParsedNode = {
      name: text ?? '',
    };

    // Get note/content if available
    const note = element.getAttribute('_note') || element.getAttribute('note');
    if (note) {
      node.content = note;
    }

    // Read back the node type our exporter writes (silently ignored before —
    // that made an IdeaM → OPML → IdeaM round-trip lose every node type).
    const type = element.getAttribute('_type');
    if (type && OpmlImporter.KNOWN_TYPES.has(type)) {
      node.type = type as ParsedNode['type'];
    }

    // Read back metadata attributes (tags, color, completion) — written by
    // our exporter when "Include metadata" is on; harmless if absent.
    const tagsAttr = element.getAttribute('_tags');
    const colorAttr = element.getAttribute('_color');
    const completedAttr = element.getAttribute('_completed');
    if (tagsAttr || colorAttr || completedAttr !== null) {
      node.metadata = {};
      if (tagsAttr) {
        const tags = tagsAttr.split(',').map(t => t.trim()).filter(Boolean);
        if (tags.length > 0) node.metadata.tags = tags;
      }
      if (colorAttr && OpmlImporter.KNOWN_COLORS.has(colorAttr)) {
        node.metadata.color = colorAttr;
      }
      if (completedAttr !== null) {
        node.metadata.isCompleted = completedAttr === 'true';
      }
    }

    // Parse children
    const childOutlines = element.querySelectorAll(':scope > outline');
    if (childOutlines.length > 0) {
      node.children = [];
      for (const child of childOutlines) {
        const parsed = this.parseOutlineElement(child, warnings);
        if (parsed) {
          node.children.push(parsed);
        }
      }
    }

    return node;
  }
}
