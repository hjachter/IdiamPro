'use client';

import type { Outline, NodeMap, OutlineNode } from '@/types';
import type { ExportOptions, ExportResult } from './types';
import { DEFAULT_EXPORT_OPTIONS } from './types';

// Platform detection utilities
export function isCapacitorNative(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && (window as any).electronAPI?.isElectron === true;
}

export function hasFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window && !isElectron();
}

/**
 * Abstract base class for all exporters
 */
export abstract class BaseExporter {
  abstract formatId: string;
  abstract mimeType: string;
  abstract extension: string;

  /**
   * Convert outline to the target format
   */
  abstract convert(
    outline: Outline,
    rootNodeId?: string,
    options?: ExportOptions
  ): Promise<ExportResult>;

  /**
   * Main export method - converts and saves
   */
  async export(
    outline: Outline,
    rootNodeId?: string,
    options?: ExportOptions
  ): Promise<void> {
    const mergedOptions = { ...DEFAULT_EXPORT_OPTIONS, ...options };
    const result = await this.convert(outline, rootNodeId, mergedOptions);
    await this.save(result);
  }

  /**
   * Save export result to file using platform-appropriate method
   */
  async save(result: ExportResult): Promise<void> {
    const blob = result.data instanceof Blob
      ? result.data
      : new Blob([result.data], { type: result.mimeType });

    if (isCapacitorNative()) {
      await this.saveCapacitor(blob, result.filename, result.mimeType);
    } else if (isElectron()) {
      await this.saveElectron(blob, result.filename);
    } else if (hasFileSystemAccess()) {
      await this.saveFileSystemAccess(blob, result.filename, result.mimeType);
    } else {
      this.saveBrowserDownload(blob, result.filename);
    }
  }

  /**
   * Save using Capacitor Share API (iOS/Android)
   */
  protected async saveCapacitor(blob: Blob, filename: string, mimeType: string): Promise<void> {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    // Convert blob to base64
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove data URL prefix
      };
      reader.readAsDataURL(blob);
    });

    // Write to cache directory
    const result = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });

    // Share the file
    await Share.share({
      title: filename,
      url: result.uri,
    });
  }

  /**
   * Save using Electron's native file dialog
   */
  protected async saveElectron(blob: Blob, filename: string): Promise<void> {
    const electronAPI = (window as any).electronAPI;

    const filePath = await electronAPI.saveFileDialog({
      title: `Save ${this.formatId.toUpperCase()}`,
      defaultPath: filename,
      filters: [{ name: this.formatId.toUpperCase(), extensions: [this.extension.replace('.', '')] }],
    });

    if (!filePath) {
      // User cancelled
      return;
    }

    // Convert blob to array buffer then to base64 for Electron IPC
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    await electronAPI.writeFile(filePath, base64, { encoding: 'base64' });
  }

  /**
   * Save using File System Access API (Chrome/Edge)
   */
  protected async saveFileSystemAccess(blob: Blob, filename: string, mimeType: string): Promise<void> {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: this.formatId.toUpperCase(),
          accept: { [mimeType]: [this.extension] },
        }],
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User cancelled - that's OK
        return;
      }
      // Fall back to browser download
      console.warn('File System Access failed, falling back to download:', err);
      this.saveBrowserDownload(blob, filename);
    }
  }

  /**
   * Save using browser download (fallback for all platforms)
   */
  protected saveBrowserDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Utility methods for subclasses

  /**
   * Strip HTML tags from content, converting to plain text
   */
  protected stripHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Traverse nodes depth-first, calling callback for each
   */
  protected traverseDepthFirst(
    nodes: NodeMap,
    rootId: string,
    callback: (node: OutlineNode, depth: number, path: string[]) => void,
    maxDepth?: number
  ): void {
    const walk = (nodeId: string, depth: number, path: string[]) => {
      if (maxDepth !== undefined && depth > maxDepth) return;

      const node = nodes[nodeId];
      if (!node) return;

      callback(node, depth, path);

      if (node.childrenIds?.length > 0) {
        for (const childId of node.childrenIds) {
          walk(childId, depth + 1, [...path, node.name]);
        }
      }
    };

    walk(rootId, 0, []);
  }

  /**
   * Get path from root to a specific node
   */
  protected getNodePath(nodes: NodeMap, nodeId: string, rootId: string): string[] {
    const path: string[] = [];

    const findPath = (currentId: string, target: string, currentPath: string[]): boolean => {
      const node = nodes[currentId];
      if (!node) return false;

      if (currentId === target) {
        path.push(...currentPath, node.name);
        return true;
      }

      if (node.childrenIds) {
        for (const childId of node.childrenIds) {
          if (findPath(childId, target, [...currentPath, node.name])) {
            return true;
          }
        }
      }

      return false;
    };

    findPath(rootId, nodeId, []);
    return path;
  }

  /**
   * Sanitize filename for filesystem
   */
  protected sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 100); // Limit length
  }

  /**
   * Generate suggested filename from outline/node name
   */
  protected getSuggestedFilename(outline: Outline, rootNodeId?: string): string {
    const baseName = rootNodeId
      ? (outline.nodes[rootNodeId]?.name || outline.name)
      : outline.name;

    return `${this.sanitizeFilename(baseName)}${this.extension}`;
  }

  /**
   * Escape special characters for XML
   */
  protected escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Escape special characters for HTML
   */
  protected escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
