'use client';

import type { Outline, OutlineNode } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

interface JsonTreeNode {
  name: string;
  prefix?: string;
  content?: string;
  type?: string;
  children?: JsonTreeNode[];
}

/**
 * Export outline to hierarchical JSON structure
 * Clean tree format suitable for data processing
 */
export class JsonTreeExporter extends BaseExporter {
  formatId = 'json-tree';
  mimeType = 'application/json';
  extension = '.json';

  async convert(
    outline: Outline,
    rootNodeId?: string,
    options?: ExportOptions
  ): Promise<ExportResult> {
    const root = rootNodeId || outline.rootNodeId;
    const nodes = outline.nodes;
    const includeContent = options?.includeContent ?? true;
    const maxDepth = options?.maxDepth;

    const tree = this.buildTree(nodes, root, includeContent, options?.includeMetadata, maxDepth, 0);

    const result = {
      name: outline.name,
      exportedAt: new Date().toISOString(),
      source: 'IdiamPro',
      root: tree,
    };

    const json = JSON.stringify(result, null, 2);

    return {
      data: json,
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }

  private buildTree(
    nodes: Record<string, OutlineNode>,
    nodeId: string,
    includeContent: boolean,
    includeMetadata?: boolean,
    maxDepth?: number,
    depth: number = 0
  ): JsonTreeNode | null {
    if (maxDepth !== undefined && depth > maxDepth) return null;

    const node = nodes[nodeId];
    if (!node) return null;

    const treeNode: JsonTreeNode = {
      name: node.name,
    };

    if (node.prefix) {
      treeNode.prefix = node.prefix;
    }

    if (includeContent && node.content) {
      treeNode.content = this.stripHtml(node.content);
    }

    if (includeMetadata && node.type && node.type !== 'default') {
      treeNode.type = node.type;
    }

    if (node.childrenIds && node.childrenIds.length > 0) {
      const children: JsonTreeNode[] = [];
      for (const childId of node.childrenIds) {
        const childTree = this.buildTree(nodes, childId, includeContent, includeMetadata, maxDepth, depth + 1);
        if (childTree) {
          children.push(childTree);
        }
      }
      if (children.length > 0) {
        treeNode.children = children;
      }
    }

    return treeNode;
  }
}
