'use client';

import type { Outline } from '@/types';
import type { ExportOptions, ExportResult } from './types';
import type { BaseExporter } from './base-exporter';

// Import exporters
import { MarkdownExporter } from './documents/markdown-exporter';
import { PlainTextExporter } from './documents/plain-text-exporter';
import { HtmlExporter } from './documents/html-exporter';
import { OpmlExporter } from './outliners/opml-exporter';
import { ObsidianExporter } from './note-apps/obsidian-exporter';
import { CsvExporter } from './data/csv-exporter';
import { JsonTreeExporter } from './data/json-tree-exporter';

// Exporter registry
const EXPORTERS: Record<string, BaseExporter> = {
  markdown: new MarkdownExporter(),
  'plain-text': new PlainTextExporter(),
  html: new HtmlExporter(),
  opml: new OpmlExporter(),
  obsidian: new ObsidianExporter(),
  csv: new CsvExporter(),
  'json-tree': new JsonTreeExporter(),
};

/**
 * Get an exporter by format ID
 */
export function getExporter(formatId: string): BaseExporter | undefined {
  return EXPORTERS[formatId];
}

/**
 * Check if a format has an exporter available
 */
export function hasExporter(formatId: string): boolean {
  return formatId in EXPORTERS;
}

/**
 * Get list of available exporter format IDs
 */
export function getAvailableExporters(): string[] {
  return Object.keys(EXPORTERS);
}

/**
 * Convert outline to specified format
 */
export async function convertOutline(
  formatId: string,
  outline: Outline,
  rootNodeId?: string,
  options?: ExportOptions
): Promise<ExportResult> {
  const exporter = EXPORTERS[formatId];
  if (!exporter) {
    throw new Error(`No exporter available for format: ${formatId}`);
  }
  return exporter.convert(outline, rootNodeId, options);
}

/**
 * Export outline to file in specified format
 */
export async function exportOutline(
  formatId: string,
  outline: Outline,
  rootNodeId?: string,
  options?: ExportOptions
): Promise<void> {
  const exporter = EXPORTERS[formatId];
  if (!exporter) {
    throw new Error(`No exporter available for format: ${formatId}`);
  }
  return exporter.export(outline, rootNodeId, options);
}

// Re-export types
export type { ExportOptions, ExportResult } from './types';
export { DEFAULT_EXPORT_OPTIONS } from './types';
export { BaseExporter } from './base-exporter';
