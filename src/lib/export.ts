import type { Outline } from '@/types';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const BACKUP_STORAGE_KEY = 'idiampro-backup';

/**
 * Check if running in Capacitor native app
 */
export function isCapacitorNative(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

/**
 * Check if running on mobile (no file picker available)
 */
function isMobileOrCapacitor(): boolean {
  // Check for Capacitor
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    return true;
  }
  // Check screen width as fallback
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return true;
  }
  return false;
}

/**
 * Backup all outlines to localStorage (for mobile)
 */
export function backupToLocalStorage(outlines: Outline[]): { success: boolean; count: number } {
  const userOutlines = outlines.filter(o => !o.isGuide);
  const backup = {
    timestamp: new Date().toISOString(),
    outlines: userOutlines,
  };
  try {
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(backup));
    return { success: true, count: userOutlines.length };
  } catch (error) {
    console.error('Failed to backup to localStorage:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Restore all outlines from localStorage (for mobile)
 */
export function restoreFromLocalStorage(): { outlines: Outline[]; timestamp: string } | null {
  try {
    const data = localStorage.getItem(BACKUP_STORAGE_KEY);
    if (!data) return null;
    const backup = JSON.parse(data);
    return {
      outlines: backup.outlines || [],
      timestamp: backup.timestamp || 'Unknown',
    };
  } catch (error) {
    console.error('Failed to restore from localStorage:', error);
    return null;
  }
}

/**
 * Check if a backup exists in localStorage
 */
export function hasLocalStorageBackup(): boolean {
  return localStorage.getItem(BACKUP_STORAGE_KEY) !== null;
}

export async function exportOutlineToJson(outline: Outline): Promise<void> {
  const dataStr = JSON.stringify(outline, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const defaultName = `${outline.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;

  // Try to use the File System Access API for folder selection
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: defaultName,
        types: [{
          description: 'JSON Files',
          accept: { 'application/json': ['.json'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: any) {
      // User cancelled or API not supported, fall back to download
      if (err.name === 'AbortError') return;
    }
  }

  // Fallback for browsers without File System Access API
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = defaultName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportAllOutlinesToJson(outlines: Outline[]): Promise<void> {
  // Filter out the guide outline
  const userOutlines = outlines.filter(o => !o.isGuide);

  const dataStr = JSON.stringify(userOutlines, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const defaultName = `idiampro_backup_${timestamp}.json`;

  // Try to use the File System Access API for folder selection
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: defaultName,
        types: [{
          description: 'JSON Files',
          accept: { 'application/json': ['.json'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: any) {
      // User cancelled or API not supported, fall back to download
      if (err.name === 'AbortError') return;
    }
  }

  // Fallback for browsers without File System Access API
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = defaultName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Share a single outline via iOS/Android share sheet (for Capacitor native apps)
 */
export async function shareOutlineFile(outline: Outline): Promise<{ success: boolean }> {
  const dataStr = JSON.stringify(outline, null, 2);
  const fileName = `${outline.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;

  try {
    // Write the file to the cache directory
    const result = await Filesystem.writeFile({
      path: fileName,
      data: dataStr,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    // Share the file
    await Share.share({
      title: outline.name,
      text: `IdiamPro outline: ${outline.name}`,
      url: result.uri,
      dialogTitle: 'Share Outline',
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to share outline file:', error);
    return { success: false };
  }
}

/**
 * Share backup file via iOS/Android share sheet (for Capacitor native apps)
 */
export async function shareBackupFile(outlines: Outline[]): Promise<{ success: boolean; count: number }> {
  const userOutlines = outlines.filter(o => !o.isGuide);
  const dataStr = JSON.stringify(userOutlines, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const fileName = `idiampro_backup_${timestamp}.json`;

  try {
    // Write the file to the cache directory
    const result = await Filesystem.writeFile({
      path: fileName,
      data: dataStr,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    // Share the file
    await Share.share({
      title: 'IdiamPro Backup',
      text: `Backup of ${userOutlines.length} outline${userOutlines.length !== 1 ? 's' : ''}`,
      url: result.uri,
      dialogTitle: 'Share Backup File',
    });

    // Also save to localStorage as a fallback
    backupToLocalStorage(outlines);

    return { success: true, count: userOutlines.length };
  } catch (error) {
    console.error('Failed to share backup file:', error);
    // Fall back to localStorage only
    return backupToLocalStorage(outlines);
  }
}
