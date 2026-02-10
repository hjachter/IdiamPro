'use client';

import type { ImportOptions, ImportResult } from './types';
import type { BaseImporter } from './base-importer';

// Import importers
import { MarkdownImporter } from './documents/markdown-importer';
import { PlainTextImporter } from './documents/plain-text-importer';
import { OpmlImporter } from './outliners/opml-importer';

// Importer registry
const IMPORTERS: BaseImporter[] = [
  new MarkdownImporter(),
  new PlainTextImporter(),
  new OpmlImporter(),
];

/**
 * Get all registered importers
 */
export function getImporters(): BaseImporter[] {
  return IMPORTERS;
}

/**
 * Get an importer by format ID
 */
export function getImporter(formatId: string): BaseImporter | undefined {
  return IMPORTERS.find(i => i.formatId === formatId);
}

/**
 * Check if a format has an importer available
 */
export function hasImporter(formatId: string): boolean {
  return IMPORTERS.some(i => i.formatId === formatId);
}

/**
 * Find an importer that can handle the given file
 */
export function findImporterForFile(file: File): BaseImporter | undefined {
  return IMPORTERS.find(i => i.canHandle(file));
}

/**
 * Get list of available importer format IDs
 */
export function getAvailableImporters(): string[] {
  return IMPORTERS.map(i => i.formatId);
}

/**
 * Get all supported file extensions for import
 */
export function getSupportedImportExtensions(): string[] {
  const extensions = new Set<string>();
  for (const importer of IMPORTERS) {
    for (const ext of importer.supportedExtensions) {
      extensions.add(ext);
    }
  }
  return Array.from(extensions);
}

/**
 * Import a file using the appropriate importer
 */
export async function importFile(
  file: File,
  options?: ImportOptions
): Promise<ImportResult> {
  const importer = findImporterForFile(file);
  if (!importer) {
    throw new Error(`No importer available for file type: ${file.name}`);
  }
  return importer.import(file, options);
}

/**
 * Import content with a specific format
 */
export async function importContent(
  formatId: string,
  content: string,
  filename: string,
  options?: ImportOptions
): Promise<ImportResult> {
  const importer = getImporter(formatId);
  if (!importer) {
    throw new Error(`No importer available for format: ${formatId}`);
  }
  return importer.parse(content, filename, options);
}

// Re-export types
export type { ImportOptions, ImportResult, ParsedNode } from './types';
export { DEFAULT_IMPORT_OPTIONS } from './types';
export { BaseImporter } from './base-importer';
