import type { Outline } from '@/types';

// Extended outline type with lazy loading metadata
export interface LazyOutline extends Outline {
  _fileSize?: number;
  _fileName?: string;
  _isLazyLoaded?: boolean;
  _estimatedNodeCount?: number;
}

// Unmerge backup data persisted to disk
export interface UnmergeBackupData {
  outlineId: string;
  outlineName: string;
  snapshot: Outline;
  timestamp: number;
}

// Type definition for the Electron API exposed via preload
interface ElectronAPI {
  isElectron: boolean;
  selectDirectory: () => Promise<string | null>;
  getStoredDirectoryPath: () => Promise<string | null>;
  readOutlinesFromDirectory: (dirPath: string) => Promise<{ success: boolean; outlines?: Outline[]; error?: string }>;
  readOutlineMetadataFromDirectory: (dirPath: string) => Promise<{ success: boolean; outlines?: LazyOutline[]; error?: string }>;
  loadSingleOutline: (dirPath: string, fileName: string) => Promise<{ success: boolean; outline?: LazyOutline; error?: string }>;
  saveOutlineToFile: (dirPath: string, outline: Outline) => Promise<{ success: boolean; error?: string }>;
  deleteOutlineFile: (dirPath: string, fileName: string) => Promise<{ success: boolean; error?: string }>;
  renameOutlineFile: (dirPath: string, oldFileName: string, newOutline: Outline) => Promise<{ success: boolean; error?: string }>;
  checkOutlineExists: (dirPath: string, fileName: string) => Promise<boolean>;
  loadOutlineFromFile: (dirPath: string, fileName: string) => Promise<{ success: boolean; outline?: Outline; error?: string }>;
  getOutlineMtime: (dirPath: string, fileName: string) => Promise<{ success: boolean; mtimeMs?: number; error?: string }>;
  onWindowFocus?: (callback: (...args: unknown[]) => void) => void;
  removeWindowFocusListener?: (callback: (...args: unknown[]) => void) => void;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  // Pending imports recovery
  checkPendingImports?: () => Promise<{ success: boolean; pendingImports?: Array<{ outline: Outline; summary: string; sourcesProcessed: number; createdAt: number; outlineName: string; fileName: string }>; error?: string }>;
  deletePendingImport?: (fileName: string) => Promise<{ success: boolean; error?: string }>;
  clearAllPendingImports?: () => Promise<{ success: boolean; deleted?: number; error?: string }>;
  // Knowledge base (superoutline)
  buildKnowledgeBase?: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
  readKnowledgeBase?: (dirPath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  // Unmerge backup persistence
  saveUnmergeBackup?: (backupData: UnmergeBackupData) => Promise<{ success: boolean; error?: string }>;
  loadUnmergeBackup?: () => Promise<{ success: boolean; backup?: UnmergeBackupData | null; error?: string }>;
  deleteUnmergeBackup?: () => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

/**
 * Check if running in Electron
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electronAPI?.isElectron === true;
}

/**
 * Open a URL in the system's default browser
 * In Electron, this uses shell.openExternal to open in the real browser with address bar
 * In web, this uses window.open
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isElectron() && window.electronAPI?.openExternal) {
    await window.electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank');
  }
}

/**
 * Get the Electron API (throws if not in Electron)
 */
function getElectronAPI(): ElectronAPI {
  if (!window.electronAPI) {
    throw new Error('Not running in Electron');
  }
  return window.electronAPI;
}

/**
 * Sanitize filename (same as file-storage.ts)
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

/**
 * Get outline filename
 */
export function getElectronOutlineFileName(outline: Outline): string {
  return sanitizeFileName(outline.name) + '.idm';
}

/**
 * Select a directory using native Electron dialog
 */
export async function electronSelectDirectory(): Promise<string | null> {
  const api = getElectronAPI();
  return api.selectDirectory();
}

/**
 * Get the stored directory path
 */
export async function electronGetStoredDirectoryPath(): Promise<string | null> {
  const api = getElectronAPI();
  return api.getStoredDirectoryPath();
}

/**
 * Check if Electron file system storage is available
 */
export async function isElectronStorageAvailable(): Promise<boolean> {
  if (!isElectron()) return false;
  const dirPath = await electronGetStoredDirectoryPath();
  return dirPath !== null;
}

/**
 * Load outlines from directory via Electron IPC
 */
export async function electronLoadOutlinesFromDirectory(): Promise<Outline[]> {
  const api = getElectronAPI();
  const dirPath = await api.getStoredDirectoryPath();

  if (!dirPath) {
    return [];
  }

  const result = await api.readOutlinesFromDirectory(dirPath);

  if (result.success && result.outlines) {
    console.log('Loaded ' + result.outlines.length + ' outlines from Electron storage');
    return result.outlines;
  }

  console.error('Failed to load outlines:', result.error);
  return [];
}

/**
 * Load outline metadata only (for lazy loading - fast startup)
 * Large outlines (>1MB) are not fully loaded - only metadata is returned
 */
export async function electronLoadOutlineMetadataFromDirectory(): Promise<LazyOutline[]> {
  const api = getElectronAPI();
  const dirPath = await api.getStoredDirectoryPath();

  if (!dirPath) {
    return [];
  }

  const result = await api.readOutlineMetadataFromDirectory(dirPath);

  if (result.success && result.outlines) {
    const lazyCount = result.outlines.filter(o => o._isLazyLoaded).length;
    console.log(`Loaded ${result.outlines.length} outlines (${lazyCount} deferred for lazy loading)`);
    return result.outlines;
  }

  console.error('Failed to load outline metadata:', result.error);
  return [];
}

/**
 * Load a single outline fully (for lazy-loaded outlines)
 */
export async function electronLoadSingleOutline(fileName: string): Promise<LazyOutline | null> {
  const api = getElectronAPI();
  const dirPath = await api.getStoredDirectoryPath();

  if (!dirPath) {
    return null;
  }

  const result = await api.loadSingleOutline(dirPath, fileName);

  if (result.success && result.outline) {
    console.log(`Fully loaded outline: ${fileName} (${Object.keys(result.outline.nodes || {}).length} nodes)`);
    return result.outline;
  }

  console.error('Failed to load single outline:', result.error);
  return null;
}

/**
 * Save outline to file via Electron IPC
 */
export async function electronSaveOutlineToFile(outline: Outline): Promise<void> {
  const api = getElectronAPI();
  const dirPath = await api.getStoredDirectoryPath();

  if (!dirPath) {
    throw new Error('No directory configured');
  }

  const result = await api.saveOutlineToFile(dirPath, outline);

  if (!result.success) {
    throw new Error(result.error || 'Failed to save outline');
  }
}

/**
 * Delete outline file via Electron IPC
 */
export async function electronDeleteOutlineFile(outline: Outline): Promise<void> {
  const api = getElectronAPI();
  const dirPath = await api.getStoredDirectoryPath();

  if (!dirPath) {
    throw new Error('No directory configured');
  }

  const fileName = getElectronOutlineFileName(outline);
  const result = await api.deleteOutlineFile(dirPath, fileName);

  if (!result.success) {
    throw new Error(result.error || 'Failed to delete outline');
  }
}

/**
 * Rename outline file via Electron IPC
 */
export async function electronRenameOutlineFile(oldName: string, newOutline: Outline): Promise<void> {
  const api = getElectronAPI();
  const dirPath = await api.getStoredDirectoryPath();

  if (!dirPath) {
    throw new Error('No directory configured');
  }

  const oldFileName = sanitizeFileName(oldName) + '.idm';
  const result = await api.renameOutlineFile(dirPath, oldFileName, newOutline);

  if (!result.success) {
    throw new Error(result.error || 'Failed to rename outline');
  }
}

/**
 * Check if outline file exists via Electron IPC
 */
export async function electronOutlineFileExists(outline: Outline): Promise<boolean> {
  const api = getElectronAPI();
  const dirPath = await api.getStoredDirectoryPath();

  if (!dirPath) {
    return false;
  }

  const fileName = getElectronOutlineFileName(outline);
  return api.checkOutlineExists(dirPath, fileName);
}

/**
 * Load existing outline from file via Electron IPC
 */
export async function electronLoadExistingOutline(outline: Outline): Promise<Outline | null> {
  const api = getElectronAPI();
  const dirPath = await api.getStoredDirectoryPath();

  if (!dirPath) {
    return null;
  }

  const fileName = getElectronOutlineFileName(outline);
  const result = await api.loadOutlineFromFile(dirPath, fileName);

  if (result.success && result.outline) {
    return result.outline;
  }

  return null;
}

/**
 * Get the modification time of an outline file via Electron IPC.
 * Used to detect external file modifications.
 */
export async function electronGetOutlineMtime(outline: Outline): Promise<number | null> {
  const api = getElectronAPI();
  const dirPath = await api.getStoredDirectoryPath();

  if (!dirPath) {
    return null;
  }

  const fileName = getElectronOutlineFileName(outline);
  const result = await api.getOutlineMtime(dirPath, fileName);

  if (result.success && result.mtimeMs !== undefined) {
    return result.mtimeMs;
  }

  return null;
}

/**
 * Register a callback for when the Electron window regains focus.
 * Returns an unsubscribe function for useEffect cleanup.
 */
export function onElectronWindowFocus(callback: () => void): (() => void) | null {
  if (!isElectron() || !window.electronAPI?.onWindowFocus) return null;
  const handler = () => callback();
  window.electronAPI.onWindowFocus(handler);
  return () => {
    window.electronAPI?.removeWindowFocusListener?.(handler);
  };
}

/**
 * Pending import result structure
 */
export interface PendingImportResult {
  outline: Outline;
  summary: string;
  sourcesProcessed: number;
  createdAt: number;
  outlineName: string;
  fileName: string;
  // Merge context for proper recovery
  mergeContext?: {
    includeExistingContent: boolean;
    targetOutlineId?: string;
  };
}

/**
 * Check for and load pending import results
 * Returns list of pending imports that can be recovered
 */
export async function electronCheckPendingImports(): Promise<PendingImportResult[]> {
  const api = getElectronAPI();
  if (!api.checkPendingImports) {
    console.log('[Pending] checkPendingImports not available');
    return [];
  }

  const result = await api.checkPendingImports();
  if (result.success && result.pendingImports) {
    console.log(`[Pending] Found ${result.pendingImports.length} pending import(s)`);
    return result.pendingImports;
  }

  return [];
}

/**
 * Delete a pending import file after it's been processed
 */
export async function electronDeletePendingImport(fileName: string): Promise<void> {
  const api = getElectronAPI();
  if (!api.deletePendingImport) {
    console.log('[Pending] deletePendingImport not available');
    return;
  }

  const result = await api.deletePendingImport(fileName);
  if (!result.success) {
    console.error('[Pending] Failed to delete pending import:', result.error);
  }
}

/**
 * Clear all pending import files (after a successful import reaches the client)
 */
export async function electronClearAllPendingImports(): Promise<void> {
  const api = getElectronAPI();
  if (!api.clearAllPendingImports) return;

  try {
    await api.clearAllPendingImports();
  } catch (e) {
    console.error('[Pending] Failed to clear pending imports:', e);
  }
}

/**
 * Force rebuild the knowledge base (superoutline)
 */
export async function electronBuildKnowledgeBase(): Promise<boolean> {
  const api = getElectronAPI();
  if (!api.buildKnowledgeBase) return false;

  const dirPath = await api.getStoredDirectoryPath();
  if (!dirPath) return false;

  const result = await api.buildKnowledgeBase(dirPath);
  return result.success;
}

/**
 * Read the knowledge base (superoutline) content
 */
export async function electronReadKnowledgeBase(): Promise<string | null> {
  const api = getElectronAPI();
  if (!api.readKnowledgeBase) return null;

  const dirPath = await api.getStoredDirectoryPath();
  if (!dirPath) return null;

  const result = await api.readKnowledgeBase(dirPath);
  if (result.success && result.content !== undefined) {
    return result.content;
  }
  return null;
}

/**
 * Save an unmerge backup to disk via Electron IPC
 */
export async function electronSaveUnmergeBackup(backup: UnmergeBackupData): Promise<void> {
  const api = getElectronAPI();
  if (!api.saveUnmergeBackup) return;

  const result = await api.saveUnmergeBackup(backup);
  if (!result.success) {
    console.error('[Unmerge] Failed to save backup:', result.error);
  }
}

/**
 * Load the unmerge backup from disk via Electron IPC
 */
export async function electronLoadUnmergeBackup(): Promise<UnmergeBackupData | null> {
  const api = getElectronAPI();
  if (!api.loadUnmergeBackup) return null;

  const result = await api.loadUnmergeBackup();
  if (result.success && result.backup) {
    return result.backup;
  }
  return null;
}

/**
 * Delete the unmerge backup from disk via Electron IPC
 */
export async function electronDeleteUnmergeBackup(): Promise<void> {
  const api = getElectronAPI();
  if (!api.deleteUnmergeBackup) return;

  const result = await api.deleteUnmergeBackup();
  if (!result.success) {
    console.error('[Unmerge] Failed to delete backup:', result.error);
  }
}
