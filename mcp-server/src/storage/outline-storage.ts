import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

// ============================================
// Types
// ============================================

export type NodeType =
  | 'root'
  | 'chapter'
  | 'document'
  | 'note'
  | 'task'
  | 'link'
  | 'code'
  | 'quote'
  | 'date'
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'youtube'
  | 'spreadsheet'
  | 'database'
  | 'app'
  | 'map'
  | 'canvas';

export type NodeColor =
  | 'default'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink';

export interface OutlineNode {
  id: string;
  name: string;
  content: string;
  type: NodeType;
  parentId: string | null;
  childrenIds: string[];
  isCollapsed?: boolean;
  prefix: string;
  metadata?: {
    tags?: string[];
    color?: NodeColor;
    isPinned?: boolean;
    isCompleted?: boolean;
    codeLanguage?: string;
    url?: string;
    dueDate?: number;
    createdAt?: number;
    updatedAt?: number;
  };
}

export type NodeMap = Record<string, OutlineNode>;

export interface Outline {
  id: string;
  name: string;
  rootNodeId: string;
  nodes: NodeMap;
  prefix?: string;
  isGuide?: boolean;
  createdAt?: string;
  lastModified?: number | string;
}

export interface OutlineSummary {
  id: string;
  name: string;
  fileName: string;
  nodeCount: number;
  lastModified: string;
}

export interface SearchResult {
  fileName: string;
  outlineName: string;
  nodeId: string;
  nodeName: string;
  matchContext: string;
  matchField: 'name' | 'content';
}

export interface SearchOptions {
  fileName?: string;
  searchNames?: boolean;
  searchContent?: boolean;
}

// ============================================
// Helpers
// ============================================

const DEFAULT_OUTLINE_DIR = join(homedir(), 'Documents', 'IDM Outlines');

/**
 * Strip HTML tags from a string, returning plain text.
 */
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================
// OutlineStorage
// ============================================

export class OutlineStorage {
  private outlineDir: string;

  constructor(outlineDir?: string) {
    this.outlineDir = outlineDir ?? DEFAULT_OUTLINE_DIR;
  }

  /**
   * List all .idm outline files with summary info.
   */
  async listOutlines(): Promise<OutlineSummary[]> {
    const entries = await readdir(this.outlineDir).catch(() => []);
    const idmFiles = entries.filter((f) => f.endsWith('.idm'));

    const summaries: OutlineSummary[] = [];

    for (const fileName of idmFiles) {
      try {
        const filePath = join(this.outlineDir, fileName);
        const [fileStat, outline] = await Promise.all([
          stat(filePath),
          this.readOutlineFile(filePath),
        ]);

        summaries.push({
          id: outline.id,
          name: outline.name,
          fileName,
          nodeCount: Object.keys(outline.nodes).length,
          lastModified: outline.lastModified
            ? typeof outline.lastModified === 'number'
              ? new Date(outline.lastModified).toISOString()
              : outline.lastModified
            : fileStat.mtime.toISOString(),
        });
      } catch {
        // Skip files that can't be read or parsed
      }
    }

    return summaries;
  }

  /**
   * Read and parse a full outline by file name.
   */
  async getOutline(fileName: string): Promise<Outline> {
    const filePath = join(this.outlineDir, fileName);
    return this.readOutlineFile(filePath);
  }

  /**
   * Get a single node from an outline.
   */
  async getNode(fileName: string, nodeId: string): Promise<OutlineNode | null> {
    const outline = await this.getOutline(fileName);
    return outline.nodes[nodeId] ?? null;
  }

  /**
   * Write an outline back to disk.
   */
  async saveOutline(fileName: string, outline: Outline): Promise<void> {
    const filePath = join(this.outlineDir, fileName);
    const json = JSON.stringify(outline, null, 2);
    await writeFile(filePath, json, 'utf-8');
  }

  /**
   * Search across outlines for nodes matching a query string.
   * Searches node names and/or content (with HTML stripped).
   */
  async searchNodes(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      fileName: targetFile,
      searchNames = true,
      searchContent = true,
    } = options;

    const queryLower = query.toLowerCase();
    const results: SearchResult[] = [];

    // Determine which files to search
    let fileNames: string[];
    if (targetFile) {
      fileNames = [targetFile];
    } else {
      const entries = await readdir(this.outlineDir).catch(() => []);
      fileNames = entries.filter((f) => f.endsWith('.idm'));
    }

    for (const file of fileNames) {
      let outline: Outline;
      try {
        outline = await this.getOutline(file);
      } catch {
        continue;
      }

      for (const node of Object.values(outline.nodes)) {
        // Search node name
        if (searchNames && node.name.toLowerCase().includes(queryLower)) {
          results.push({
            fileName: file,
            outlineName: outline.name,
            nodeId: node.id,
            nodeName: node.name,
            matchContext: node.name,
            matchField: 'name',
          });
        }

        // Search node content (strip HTML first)
        if (searchContent && node.content) {
          const plainContent = stripHtml(node.content);
          const idx = plainContent.toLowerCase().indexOf(queryLower);
          if (idx !== -1) {
            // Extract a snippet around the match
            const snippetStart = Math.max(0, idx - 60);
            const snippetEnd = Math.min(plainContent.length, idx + query.length + 60);
            const snippet =
              (snippetStart > 0 ? '...' : '') +
              plainContent.slice(snippetStart, snippetEnd) +
              (snippetEnd < plainContent.length ? '...' : '');

            results.push({
              fileName: file,
              outlineName: outline.name,
              nodeId: node.id,
              nodeName: node.name,
              matchContext: snippet,
              matchField: 'content',
            });
          }
        }
      }
    }

    return results;
  }

  // ============================================
  // Private helpers
  // ============================================

  private async readOutlineFile(filePath: string): Promise<Outline> {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Outline;

    if (!parsed.id || !parsed.name || !parsed.rootNodeId || !parsed.nodes) {
      throw new Error(`Invalid outline file: missing required fields in ${filePath}`);
    }

    return parsed;
  }
}
