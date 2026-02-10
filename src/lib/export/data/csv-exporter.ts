'use client';

import type { Outline } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to CSV format
 * Flattened tabular structure with level, prefix, name, content columns
 */
export class CsvExporter extends BaseExporter {
  formatId = 'csv';
  mimeType = 'text/csv';
  extension = '.csv';

  async convert(
    outline: Outline,
    rootNodeId?: string,
    options?: ExportOptions
  ): Promise<ExportResult> {
    const rows: string[][] = [];
    const root = rootNodeId || outline.rootNodeId;
    const nodes = outline.nodes;
    const includeContent = options?.includeContent ?? true;
    const maxDepth = options?.maxDepth;

    // Header row
    const headers = ['Level', 'Prefix', 'Name', 'Path'];
    if (includeContent) {
      headers.push('Content');
    }
    if (options?.includeMetadata) {
      headers.push('Type', 'ID');
    }
    rows.push(headers);

    // Data rows
    this.traverseDepthFirst(nodes, root, (node, depth, path) => {
      const row: string[] = [
        String(depth),
        node.prefix || '',
        node.name,
        path.join(' > '),
      ];

      if (includeContent) {
        const content = this.stripHtml(node.content || '');
        row.push(content);
      }

      if (options?.includeMetadata) {
        row.push(node.type || 'default');
        row.push(node.id);
      }

      rows.push(row);
    }, maxDepth);

    // Convert to CSV string
    const csv = rows.map(row =>
      row.map(cell => this.escapeCsvCell(cell)).join(',')
    ).join('\n');

    return {
      data: csv,
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }

  private escapeCsvCell(value: string): string {
    // If contains comma, newline, or quote, wrap in quotes
    if (/[,\n\r"]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
