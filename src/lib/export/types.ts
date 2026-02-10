import type { Outline, NodeMap } from '@/types';

export interface ExportOptions {
  /** Include node content (HTML body) in export */
  includeContent?: boolean;
  /** Maximum depth to export (undefined = all levels) */
  maxDepth?: number;
  /** Include metadata like tags, colors, timestamps */
  includeMetadata?: boolean;
  /** Flatten hierarchy for formats that don't support nesting */
  flattenStructure?: boolean;
  /** Include diagrams/visualizations */
  includeDiagrams?: boolean;
  /** Custom title override */
  title?: string;
}

export interface ExportResult {
  /** The exported data as Blob or string */
  data: Blob | string;
  /** Suggested filename with extension */
  filename: string;
  /** MIME type for the export */
  mimeType: string;
}

export interface ExporterContext {
  outline: Outline;
  rootNodeId?: string;
  nodes: NodeMap;
  options: ExportOptions;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeContent: true,
  includeMetadata: false,
  includeDiagrams: true,
};
