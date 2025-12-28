import type { Outline } from '@/types';
import {
  getDirectoryHandle,
  verifyDirectoryPermission,
  saveOutlineToFile,
  loadOutlinesFromDirectory,
  deleteOutlineFile,
  renameOutlineFile,
} from './file-storage';

const LOCAL_STORAGE_KEY = 'outline-pro-data';

export interface StorageData {
  outlines: Outline[];
  currentOutlineId: string;
}

/**
 * Check if file system storage is available and has permission
 */
export async function isFileSystemStorageAvailable(): Promise<boolean> {
  try {
    const dirHandle = await getDirectoryHandle();
    if (!dirHandle) return false;

    const hasPermission = await verifyDirectoryPermission(dirHandle, 'readwrite');
    return hasPermission;
  } catch (error) {
    console.error('Error checking file system storage:', error);
    return false;
  }
}

/**
 * Load outlines from file system
 */
async function loadFromFileSystem(): Promise<Outline[]> {
  try {
    const dirHandle = await getDirectoryHandle();
    if (!dirHandle) return [];

    const hasPermission = await verifyDirectoryPermission(dirHandle, 'read');
    if (!hasPermission) return [];

    const outlines = await loadOutlinesFromDirectory(dirHandle);
    console.log(`Loaded ${outlines.length} outlines from file system`);
    return outlines;
  } catch (error) {
    console.error('Failed to load from file system:', error);
    return [];
  }
}

/**
 * Load outlines from localStorage
 */
function loadFromLocalStorage(): Outline[] {
  try {
    const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!savedData) return [];

    const parsedData = JSON.parse(savedData);
    return parsedData.outlines || [];
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return [];
  }
}

/**
 * Load storage data (from file system or localStorage)
 */
export async function loadStorageData(): Promise<StorageData> {
  // Try file system first
  const fileSystemAvailable = await isFileSystemStorageAvailable();

  if (fileSystemAvailable) {
    const fileOutlines = await loadFromFileSystem();
    const currentOutlineId = fileOutlines[0]?.id || '';
    console.log('Using file system storage');
    return { outlines: fileOutlines, currentOutlineId };
  }

  // Fall back to localStorage
  const localOutlines = loadFromLocalStorage();
  const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
  const currentOutlineId = savedData ? JSON.parse(savedData).currentOutlineId || localOutlines[0]?.id || '' : '';
  console.log('Using localStorage');
  return { outlines: localOutlines, currentOutlineId };
}

/**
 * Save an outline to storage (file system or localStorage)
 */
export async function saveOutline(outline: Outline, allOutlines: Outline[]): Promise<void> {
  // Try file system first
  const fileSystemAvailable = await isFileSystemStorageAvailable();

  if (fileSystemAvailable) {
    try {
      const dirHandle = await getDirectoryHandle();
      if (dirHandle) {
        await saveOutlineToFile(dirHandle, outline);
        console.log('Saved outline to file system:', outline.name);
        return;
      }
    } catch (error) {
      console.error('Failed to save to file system, falling back to localStorage:', error);
    }
  }

  // Fall back to localStorage
  try {
    const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    const existingData = savedData ? JSON.parse(savedData) : { outlines: [], currentOutlineId: '' };

    // Update or add the outline
    const outlineIndex = existingData.outlines.findIndex((o: Outline) => o.id === outline.id);
    if (outlineIndex >= 0) {
      existingData.outlines[outlineIndex] = outline;
    } else {
      existingData.outlines.push(outline);
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existingData));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

/**
 * Save all outlines to storage
 */
export async function saveAllOutlines(outlines: Outline[], currentOutlineId: string): Promise<void> {
  // Filter out the guide
  const userOutlines = outlines.filter(o => !o.isGuide);

  // Try file system first
  const fileSystemAvailable = await isFileSystemStorageAvailable();

  if (fileSystemAvailable) {
    try {
      const dirHandle = await getDirectoryHandle();
      if (dirHandle) {
        // Save each outline to a file
        await Promise.all(userOutlines.map(outline => saveOutlineToFile(dirHandle, outline)));
        console.log('Saved all outlines to file system');
        return;
      }
    } catch (error) {
      console.error('Failed to save to file system, falling back to localStorage:', error);
    }
  }

  // Fall back to localStorage
  try {
    const dataToSave = JSON.stringify({
      outlines: userOutlines,
      currentOutlineId,
    });
    localStorage.setItem(LOCAL_STORAGE_KEY, dataToSave);
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

/**
 * Delete an outline from storage
 */
export async function deleteOutline(outline: Outline): Promise<void> {
  // Try file system first
  const fileSystemAvailable = await isFileSystemStorageAvailable();

  if (fileSystemAvailable) {
    try {
      const dirHandle = await getDirectoryHandle();
      if (dirHandle) {
        await deleteOutlineFile(dirHandle, outline);
        console.log('Deleted outline from file system:', outline.name);
        return;
      }
    } catch (error) {
      console.error('Failed to delete from file system, falling back to localStorage:', error);
    }
  }

  // Fall back to localStorage
  try {
    const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedData) {
      const existingData = JSON.parse(savedData);
      existingData.outlines = existingData.outlines.filter((o: Outline) => o.id !== outline.id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existingData));
    }
  } catch (error) {
    console.error('Failed to delete from localStorage:', error);
  }
}

/**
 * Rename an outline in storage
 */
export async function renameOutline(oldName: string, newOutline: Outline): Promise<void> {
  // Try file system first
  const fileSystemAvailable = await isFileSystemStorageAvailable();

  if (fileSystemAvailable) {
    try {
      const dirHandle = await getDirectoryHandle();
      if (dirHandle) {
        await renameOutlineFile(dirHandle, oldName, newOutline);
        console.log('Renamed outline in file system:', oldName, '->', newOutline.name);
        return;
      }
    } catch (error) {
      console.error('Failed to rename in file system, falling back to localStorage:', error);
    }
  }

  // Fall back to localStorage - just save the updated outline
  await saveOutline(newOutline, [newOutline]);
}

/**
 * Migrate localStorage data to file system
 */
export async function migrateToFileSystem(): Promise<void> {
  try {
    const dirHandle = await getDirectoryHandle();
    if (!dirHandle) {
      throw new Error('No directory handle available');
    }

    const hasPermission = await verifyDirectoryPermission(dirHandle, 'readwrite');
    if (!hasPermission) {
      throw new Error('No write permission for directory');
    }

    // Load outlines from localStorage
    const localOutlines = loadFromLocalStorage();

    if (localOutlines.length === 0) {
      console.log('No outlines to migrate');
      return;
    }

    // Save each outline to file system
    await Promise.all(localOutlines.map(outline => saveOutlineToFile(dirHandle, outline)));

    console.log(`Migrated ${localOutlines.length} outlines to file system`);
  } catch (error) {
    console.error('Failed to migrate to file system:', error);
    throw error;
  }
}
