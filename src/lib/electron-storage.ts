import type { Outline } from '@/types';

// Type definition for the Electron API exposed via preload
interface ElectronAPI {
  isElectron: boolean;
  selectDirectory: () => Promise<string | null>;
  getStoredDirectoryPath: () => Promise<string | null>;
  readOutlinesFromDirectory: (dirPath: string) => Promise<{ success: boolean; outlines?: Outline[]; error?: string }>;
  saveOutlineToFile: (dirPath: string, outline: Outline) => Promise<{ success: boolean; error?: string }>;
  deleteOutlineFile: (dirPath: string, fileName: string) => Promise<{ success: boolean; error?: string }>;
  renameOutlineFile: (dirPath: string, oldFileName: string, newOutline: Outline) => Promise<{ success: boolean; error?: string }>;
  checkOutlineExists: (dirPath: string, fileName: string) => Promise<boolean>;
  loadOutlineFromFile: (dirPath: string, fileName: string) => Promise<{ success: boolean; outline?: Outline; error?: string }>;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
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
