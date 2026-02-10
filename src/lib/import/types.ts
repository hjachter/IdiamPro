import type { Outline, NodeMap, NodeType } from '@/types';

export interface ImportOptions {
  /** Keep original IDs if present in source */
  preserveIds?: boolean;
  /** How to handle import: replace current, append, or merge */
  mergeStrategy?: 'replace' | 'append' | 'merge';
  /** Convert URLs to link nodes */
  parseLinks?: boolean;
  /** Name for the imported outline (if creating new) */
  outlineName?: string;
}

export interface ImportResult {
  /** The imported outline */
  outline: Outline;
  /** Non-fatal warnings during import */
  warnings?: string[];
  /** Import statistics */
  stats: {
    nodesImported: number;
    maxDepth: number;
  };
}

export interface ParsedNode {
  name: string;
  content?: string;
  type?: NodeType;
  children?: ParsedNode[];
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  preserveIds: false,
  mergeStrategy: 'replace',
  parseLinks: true,
};
