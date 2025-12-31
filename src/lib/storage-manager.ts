import type { Outline } from '@/types';
import {
  getDirectoryHandle,
  verifyDirectoryPermission,
  saveOutlineToFile,
  loadOutlinesFromDirectory,
  deleteOutlineFile,
  renameOutlineFile,
  outlineFileExists,
  loadExistingOutline,
  getOutlineFileName,
} from './file-storage';
import {
  isElectron,
  isElectronStorageAvailable,
  electronLoadOutlinesFromDirectory,
  electronSaveOutlineToFile,
  electronDeleteOutlineFile,
  electronRenameOutlineFile,
  electronOutlineFileExists,
  electronLoadExistingOutline,
  getElectronOutlineFileName,
} from './electron-storage';

const LOCAL_STORAGE_KEY = 'outline-pro-data';

export interface StorageData {
  outlines: Outline[];
  currentOutlineId: string;
}

/**
 * Check if file system storage is available and has permission
 */
export async function isFileSystemStorageAvailable(): Promise<boolean> {
  // Check Electron storage first
  if (isElectron()) {
    return isElectronStorageAvailable();
  }

  // Fall back to File System Access API
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
  // Use Electron storage if available
  if (isElectron()) {
    try {
      return await electronLoadOutlinesFromDirectory();
    } catch (error) {
      console.error('Failed to load from Electron storage:', error);
      return [];
    }
  }

  // Fall back to File System Access API
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
  // Try Electron storage first
  if (isElectron() && await isElectronStorageAvailable()) {
    try {
      await electronSaveOutlineToFile(outline);
      console.log('Saved outline to Electron storage:', outline.name);
      return;
    } catch (error) {
      console.error('Failed to save to Electron storage, falling back to localStorage:', error);
    }
  }

  // Try File System Access API
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

  // Try Electron storage first
  if (isElectron() && await isElectronStorageAvailable()) {
    try {
      await Promise.all(userOutlines.map(outline => electronSaveOutlineToFile(outline)));
      console.log('Saved all outlines to Electron storage');
      return;
    } catch (error) {
      console.error('Failed to save to Electron storage, falling back to localStorage:', error);
    }
  }

  // Try File System Access API
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
  // Try Electron storage first
  if (isElectron() && await isElectronStorageAvailable()) {
    try {
      await electronDeleteOutlineFile(outline);
      console.log('Deleted outline from Electron storage:', outline.name);
      return;
    } catch (error) {
      console.error('Failed to delete from Electron storage, falling back to localStorage:', error);
    }
  }

  // Try File System Access API
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
  // Try Electron storage first
  if (isElectron() && await isElectronStorageAvailable()) {
    try {
      await electronRenameOutlineFile(oldName, newOutline);
      console.log('Renamed outline in Electron storage:', oldName, '->', newOutline.name);
      return;
    } catch (error) {
      console.error('Failed to rename in Electron storage, falling back to localStorage:', error);
    }
  }

  // Try File System Access API
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
 * Conflict resolution options
 */
export type ConflictResolution = 'overwrite' | 'keep_existing' | 'keep_both';

/**
 * Conflict info passed to resolver
 */
export interface MigrationConflict {
  localOutline: Outline;
  existingOutline: Outline;
  fileName: string;
}

/**
 * Conflict resolver callback type
 */
export type ConflictResolver = (conflict: MigrationConflict) => Promise<ConflictResolution>;

/**
 * Migrate localStorage data to file system with conflict resolution
 */
export async function migrateToFileSystem(
  onConflict?: ConflictResolver
): Promise<void> {
  // Load outlines from localStorage
  const localOutlines = loadFromLocalStorage();

  if (localOutlines.length === 0) {
    console.log('No outlines to migrate');
    return;
  }

  // Use Electron storage if available
  if (isElectron()) {
    try {
      for (const outline of localOutlines) {
        const exists = await electronOutlineFileExists(outline);

        if (exists && onConflict) {
          const existingOutline = await electronLoadExistingOutline(outline);

          if (existingOutline) {
            const conflict: MigrationConflict = {
              localOutline: outline,
              existingOutline,
              fileName: getElectronOutlineFileName(outline),
            };

            const resolution = await onConflict(conflict);

            switch (resolution) {
              case 'overwrite':
                await electronSaveOutlineToFile(outline);
                console.log('Overwrote ' + conflict.fileName + ' with local version');
                break;
              case 'keep_existing':
                console.log('Kept existing ' + conflict.fileName);
                break;
              case 'keep_both':
                const renamedOutline = {
                  ...outline,
                  name: outline.name + ' (migrated)',
                };
                await electronSaveOutlineToFile(renamedOutline);
                console.log('Saved as ' + getElectronOutlineFileName(renamedOutline));
                break;
            }
          }
        } else if (!exists) {
          await electronSaveOutlineToFile(outline);
          console.log('Migrated ' + getElectronOutlineFileName(outline));
        }
      }

      console.log('Migration complete (Electron)');
      return;
    } catch (error) {
      console.error('Failed to migrate to Electron storage:', error);
      throw error;
    }
  }

  // Fall back to File System Access API
  try {
    const dirHandle = await getDirectoryHandle();
    if (!dirHandle) {
      throw new Error('No directory handle available');
    }

    const hasPermission = await verifyDirectoryPermission(dirHandle, 'readwrite');
    if (!hasPermission) {
      throw new Error('No write permission for directory');
    }

    // Process each outline, checking for conflicts
    for (const outline of localOutlines) {
      const exists = await outlineFileExists(dirHandle, outline);

      if (exists && onConflict) {
        // File exists - need to resolve conflict
        const existingOutline = await loadExistingOutline(dirHandle, outline);

        if (existingOutline) {
          const conflict: MigrationConflict = {
            localOutline: outline,
            existingOutline,
            fileName: getOutlineFileName(outline),
          };

          const resolution = await onConflict(conflict);

          switch (resolution) {
            case 'overwrite':
              // Overwrite with local version
              await saveOutlineToFile(dirHandle, outline);
              console.log('Overwrote ' + conflict.fileName + ' with local version');
              break;
            case 'keep_existing':
              // Skip - keep the existing file
              console.log('Kept existing ' + conflict.fileName);
              break;
            case 'keep_both':
              // Rename local outline and save both
              const renamedOutline = {
                ...outline,
                name: outline.name + ' (migrated)',
              };
              await saveOutlineToFile(dirHandle, renamedOutline);
              console.log('Saved as ' + getOutlineFileName(renamedOutline));
              break;
          }
        }
      } else if (!exists) {
        // No conflict - just save
        await saveOutlineToFile(dirHandle, outline);
        console.log('Migrated ' + getOutlineFileName(outline));
      }
    }

    console.log('Migration complete');
  } catch (error) {
    console.error('Failed to migrate to file system:', error);
    throw error;
  }
}

// Re-export isElectron for use in other components
export { isElectron } from './electron-storage';
