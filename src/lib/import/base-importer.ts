'use client';

import { v4 as uuidv4 } from 'uuid';
import type { Outline, OutlineNode, NodeMap, NodeType } from '@/types';
import type { ImportOptions, ImportResult, ParsedNode } from './types';
import { DEFAULT_IMPORT_OPTIONS } from './types';

/**
 * Abstract base class for all importers
 */
export abstract class BaseImporter {
  abstract formatId: string;
  abstract supportedExtensions: string[];
  abstract supportedMimeTypes: string[];

  /**
   * Check if this importer can handle the given file
   */
  canHandle(file: File): boolean {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (this.supportedExtensions.includes(ext)) {
      return true;
    }
    if (this.supportedMimeTypes.includes(file.type)) {
      return true;
    }
    return false;
  }

  /**
   * Parse file content into an outline
   */
  abstract parse(
    content: string | ArrayBuffer,
    filename: string,
    options?: ImportOptions
  ): Promise<ImportResult>;

  /**
   * Import a file (reads and parses)
   */
  async import(file: File, options?: ImportOptions): Promise<ImportResult> {
    const mergedOptions = { ...DEFAULT_IMPORT_OPTIONS, ...options };
    const content = await this.readFile(file);
    return this.parse(content, file.name, mergedOptions);
  }

  /**
   * Read file as text or array buffer
   */
  protected async readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Build outline from parsed node tree
   */
  protected buildOutlineFromTree(
    rootNode: ParsedNode,
    outlineName: string
  ): { outline: Outline; stats: { nodesImported: number; maxDepth: number } } {
    const nodes: NodeMap = {};
    let nodeCount = 0;
    let maxDepth = 0;

    const buildNode = (
      parsed: ParsedNode,
      parentId: string | null,
      depth: number,
      siblingIndex: number,
      parentPrefix: string
    ): string => {
      const id = uuidv4();
      nodeCount++;
      maxDepth = Math.max(maxDepth, depth);

      const prefix = parentPrefix
        ? `${parentPrefix}.${siblingIndex + 1}`
        : `${siblingIndex + 1}`;

      const node: OutlineNode = {
        id,
        name: parsed.name,
        content: parsed.content || '',
        type: parsed.type || 'default',
        prefix,
        parentId,
        childrenIds: [],
      };

      nodes[id] = node;

      if (parsed.children && parsed.children.length > 0) {
        node.childrenIds = parsed.children.map((child, idx) =>
          buildNode(child, id, depth + 1, idx, prefix)
        );
      }

      return id;
    };

    const rootId = buildNode(rootNode, null, 0, 0, '');

    const outline: Outline = {
      id: uuidv4(),
      name: outlineName,
      rootNodeId: rootId,
      nodes,
    };

    return {
      outline,
      stats: {
        nodesImported: nodeCount,
        maxDepth,
      },
    };
  }

  /**
   * Generate a unique ID
   */
  protected generateId(): string {
    return uuidv4();
  }

  /**
   * Clean and normalize text
   */
  protected normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  }

  /**
   * Extract outline name from filename
   */
  protected getOutlineNameFromFilename(filename: string): string {
    return filename
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[_-]/g, ' ')    // Convert separators to spaces
      .replace(/\s+/g, ' ')     // Normalize spaces
      .trim();
  }
}
