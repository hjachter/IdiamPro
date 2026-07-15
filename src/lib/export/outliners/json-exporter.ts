'use client';

import type { Outline } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to native IdiamPro JSON (.idm) format
 * Re-exports the outline in its native format for sharing/backup
 */
export class JsonExporter extends BaseExporter {
  formatId = 'json';
  mimeType = 'application/json';
  extension = '.idm';

  async convert(
    outline: Outline,
    rootNodeId?: string,
    options?: ExportOptions
  ): Promise<ExportResult> {
    // If exporting a subtree, create a new outline rooted at that node
    if (rootNodeId && rootNodeId !== outline.rootNodeId) {
      const subOutline = this.buildSubOutline(outline, rootNodeId);
      return {
        data: JSON.stringify(subOutline, null, 2),
        filename: this.getSuggestedFilename(outline, rootNodeId),
        mimeType: this.mimeType,
      };
    }

    // Full outline export
    return {
      data: JSON.stringify(outline, null, 2),
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }

  private buildSubOutline(outline: Outline, rootNodeId: string): Outline {
    const nodes: Record<string, any> = {};

    // Collect all nodes in the subtree
    const collect = (nodeId: string) => {
      const node = outline.nodes[nodeId];
      if (!node) return;
      nodes[nodeId] = { ...node };
      if (node.childrenIds) {
        for (const childId of node.childrenIds) {
          collect(childId);
        }
      }
    };

    collect(rootNodeId);

    const rootNode = outline.nodes[rootNodeId];
    return {
      ...outline,
      name: rootNode?.name || outline.name,
      rootNodeId,
      nodes: nodes as any,
    };
  }
}
