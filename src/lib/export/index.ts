'use client';

import type { Outline } from '@/types';
import type { ExportOptions, ExportResult } from './types';
import type { BaseExporter } from './base-exporter';

// Dynamic import factories — each exporter is only loaded when first used
const EXPORTER_LOADERS: Record<string, () => Promise<BaseExporter>> = {
  // Documents
  markdown: () => import('./documents/markdown-exporter').then(m => new m.MarkdownExporter()),
  'plain-text': () => import('./documents/plain-text-exporter').then(m => new m.PlainTextExporter()),
  html: () => import('./documents/html-exporter').then(m => new m.HtmlExporter()),
  docx: () => import('./documents/docx-exporter').then(m => new m.DocxExporter()),
  latex: () => import('./documents/latex-exporter').then(m => new m.LatexExporter()),
  epub: () => import('./documents/epub-exporter').then(m => new m.EpubExporter()),
  'blog-html': () => import('./documents/blog-html-exporter').then(m => new m.BlogHtmlExporter()),
  'interactive-outline': () => import('./documents/interactive-outline-exporter').then(m => new m.InteractiveOutlineExporter()),
  website: () => import('./documents/website-exporter').then(m => new m.WebsiteExporter()),
  // Outliners
  opml: () => import('./outliners/opml-exporter').then(m => new m.OpmlExporter()),
  json: () => import('./outliners/json-exporter').then(m => new m.JsonExporter()),
  'org-mode': () => import('./outliners/org-mode-exporter').then(m => new m.OrgModeExporter()),
  taskpaper: () => import('./outliners/taskpaper-exporter').then(m => new m.TaskPaperExporter()),
  // Note Apps
  obsidian: () => import('./note-apps/obsidian-exporter').then(m => new m.ObsidianExporter()),
  notion: () => import('./note-apps/notion-exporter').then(m => new m.NotionExporter()),
  evernote: () => import('./note-apps/evernote-exporter').then(m => new m.EvernoteExporter()),
  // Mind Maps
  freemind: () => import('./mind-maps/freemind-exporter').then(m => new m.FreeMindExporter()),
  xmind: () => import('./mind-maps/xmind-exporter').then(m => new m.XMindExporter()),
  // Data
  csv: () => import('./data/csv-exporter').then(m => new m.CsvExporter()),
  'json-tree': () => import('./data/json-tree-exporter').then(m => new m.JsonTreeExporter()),
  // Presentations
  revealjs: () => import('./presentations/revealjs-exporter').then(m => new m.RevealjsExporter()),
  teleprompter: () => import('./presentations/teleprompter-exporter').then(m => new m.TeleprompterExporter()),
  // Social
  'twitter-thread': () => import('./social/twitter-thread-exporter').then(m => new m.TwitterThreadExporter()),
};

// Cache of instantiated exporters
const exporterCache: Record<string, BaseExporter> = {};

/**
 * Get an exporter by format ID (lazy-loaded via dynamic import)
 */
export async function getExporter(formatId: string): Promise<BaseExporter | undefined> {
  if (!(formatId in EXPORTER_LOADERS)) return undefined;
  if (!exporterCache[formatId]) {
    exporterCache[formatId] = await EXPORTER_LOADERS[formatId]();
  }
  return exporterCache[formatId];
}

/**
 * Check if a format has an exporter available
 */
export function hasExporter(formatId: string): boolean {
  return formatId in EXPORTER_LOADERS;
}

/**
 * Get list of available exporter format IDs
 */
export function getAvailableExporters(): string[] {
  return Object.keys(EXPORTER_LOADERS);
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
  const exporter = await getExporter(formatId);
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
  const exporter = await getExporter(formatId);
  if (!exporter) {
    throw new Error(`No exporter available for format: ${formatId}`);
  }
  return exporter.export(outline, rootNodeId, options);
}

// Re-export types
export type { ExportOptions, ExportResult } from './types';
export { DEFAULT_EXPORT_OPTIONS } from './types';
export { BaseExporter } from './base-exporter';
