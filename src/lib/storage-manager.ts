import type { Outline } from '@/types';
import { v4 as uuidv4 } from 'uuid';
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
  electronLoadOutlineMetadataFromDirectory,
  electronLoadSingleOutline,
  electronSaveOutlineToFile,
  electronDeleteOutlineFile,
  electronRenameOutlineFile,
  electronOutlineFileExists,
  electronLoadExistingOutline,
  getElectronOutlineFileName,
  type LazyOutline,
} from './electron-storage';
import { fixDuplicateChildren } from './fix-duplicates';

const LOCAL_STORAGE_KEY = 'outline-pro-data';

export interface StorageData {
  outlines: Outline[];
  currentOutlineId: string;
  /** Number of outlines that had duplicate IDs fixed during load */
  fixedDuplicateCount?: number;
  /** Names of outlines that were fixed */
  fixedDuplicateNames?: string[];
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
 * Load outlines from file system (with lazy loading for large files)
 */
async function loadFromFileSystem(): Promise<Outline[]> {
  // Use Electron storage if available - with lazy loading
  if (isElectron()) {
    try {
      // Use lazy loading - large files won't be fully loaded until selected
      return await electronLoadOutlineMetadataFromDirectory();
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

// Separate key for currentOutlineId (used even with file system storage)
const CURRENT_OUTLINE_KEY = 'idiampro-current-outline-id';

/**
 * Load storage data (from file system or localStorage)
 */
/**
 * Repair any corrupt outlines (e.g., duplicate children)
 * Automatically saves fixed outlines back to storage
 */
async function repairCorruptOutlines(outlines: Outline[]): Promise<Outline[]> {
  console.log(`🔍 Checking ${outlines.length} outlines for corruption...`);
  const repairedOutlines: Outline[] = [];
  const fixedIds: string[] = [];

  for (const outline of outlines) {
    const result = fixDuplicateChildren(outline);

    if (result.fixed) {
      console.warn(`🔧 Repaired outline "${outline.name}" (${outline.id}):`);
      result.report.forEach(msg => console.warn(`  ${msg}`));
      repairedOutlines.push(result.outline);
      fixedIds.push(result.outline.id);
    } else {
      repairedOutlines.push(outline);
    }
  }

  // Save all repaired outlines at once
  if (fixedIds.length > 0) {
    console.log(`💾 Saving ${fixedIds.length} repaired outline(s)...`);
    for (const outline of repairedOutlines) {
      if (fixedIds.includes(outline.id)) {
        try {
          await saveOutline(outline, repairedOutlines);
          console.log(`  ✓ Saved "${outline.name}"`);
        } catch (error) {
          console.error(`  ✗ Failed to save repaired outline "${outline.name}":`, error);
        }
      }
    }
    console.log('✅ All outline repairs complete');
  } else {
    console.log('✅ No corrupt outlines found');
  }

  return repairedOutlines;
}

/**
 * Fix duplicate outline IDs by assigning new UUIDs to duplicates
 * Instead of deleting duplicates, we preserve them with new unique IDs
 * Returns the fixed list and outlines that need to be re-saved
 */
function fixDuplicateOutlineIds(outlines: Outline[]): {
  fixed: Outline[];
  needsSave: Outline[];
} {
  const seen = new Set<string>();
  const fixed: Outline[] = [];
  const needsSave: Outline[] = [];

  for (const outline of outlines) {
    if (seen.has(outline.id)) {
      // Duplicate ID found - assign a new UUID
      const newId = uuidv4();
      const fixedOutline: Outline = {
        ...outline,
        id: newId,
        lastModified: Date.now(),
      };
      fixed.push(fixedOutline);
      needsSave.push(fixedOutline);
      console.warn(`⚠️  Fixed duplicate ID: "${outline.name}" - changed ID from ${outline.id} to ${newId}`);
    } else {
      seen.add(outline.id);
      fixed.push(outline);
    }
  }

  if (needsSave.length > 0) {
    console.warn(`🔧 Fixed ${needsSave.length} outline(s) with duplicate IDs`);
  }

  return { fixed, needsSave };
}

export async function loadStorageData(): Promise<StorageData> {
  // Always read currentOutlineId from localStorage (works with all storage backends)
  const savedCurrentOutlineId = localStorage.getItem(CURRENT_OUTLINE_KEY) || '';

  // Try file system first
  const fileSystemAvailable = await isFileSystemStorageAvailable();

  if (fileSystemAvailable) {
    let fileOutlines = await loadFromFileSystem();

    // Fix duplicate IDs first (assign new UUIDs to duplicates)
    const { fixed, needsSave } = fixDuplicateOutlineIds(fileOutlines);
    fileOutlines = fixed;

    // Save outlines that had their IDs fixed
    if (needsSave.length > 0) {
      console.log(`💾 Saving ${needsSave.length} outline(s) with corrected IDs...`);
      for (const outline of needsSave) {
        try {
          await saveOutline(outline, fileOutlines);
          console.log(`  ✓ Saved "${outline.name}" with new ID ${outline.id}`);
        } catch (error) {
          console.error(`  ✗ Failed to save corrected outline "${outline.name}":`, error);
        }
      }
    }

    // Repair any corrupt outlines (e.g., duplicate children)
    fileOutlines = await repairCorruptOutlines(fileOutlines);

    // Use saved currentOutlineId, or fall back to first outline
    const currentOutlineId = savedCurrentOutlineId || fileOutlines[0]?.id || '';
    console.log('Using file system storage');
    return {
      outlines: fileOutlines,
      currentOutlineId,
      fixedDuplicateCount: needsSave.length,
      fixedDuplicateNames: needsSave.map(o => o.name),
    };
  }

  // Fall back to localStorage
  let localOutlines = loadFromLocalStorage();

  // Fix duplicate IDs
  const { fixed: fixedLocal, needsSave: needsSaveLocal } = fixDuplicateOutlineIds(localOutlines);
  localOutlines = fixedLocal;

  // Save corrected outlines back to localStorage
  if (needsSaveLocal.length > 0) {
    try {
      const dataToSave = JSON.stringify({
        outlines: localOutlines,
        currentOutlineId: savedCurrentOutlineId,
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, dataToSave);
      console.log(`💾 Saved ${needsSaveLocal.length} outline(s) with corrected IDs to localStorage`);
    } catch (error) {
      console.error('Failed to save corrected outlines to localStorage:', error);
    }
  }

  // Repair any corrupt outlines
  localOutlines = await repairCorruptOutlines(localOutlines);
  const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
  const currentOutlineId = savedCurrentOutlineId || (savedData ? JSON.parse(savedData).currentOutlineId || localOutlines[0]?.id || '' : '');
  console.log('Using localStorage');
  return {
    outlines: localOutlines,
    currentOutlineId,
    fixedDuplicateCount: needsSaveLocal.length,
    fixedDuplicateNames: needsSaveLocal.map(o => o.name),
  };
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
 * Validate outlines before saving - check for duplicate IDs
 * Returns true if valid, logs errors if not
 */
function validateOutlinesBeforeSave(outlines: Outline[]): boolean {
  const ids = new Set<string>();
  const duplicates: string[] = [];

  for (const outline of outlines) {
    if (ids.has(outline.id)) {
      duplicates.push(`"${outline.name}" (${outline.id})`);
    } else {
      ids.add(outline.id);
    }
  }

  if (duplicates.length > 0) {
    console.error(`🚨 DUPLICATE IDs DETECTED before save: ${duplicates.join(', ')}`);
    console.error('This should not happen - the app may have a bug. Please report this issue.');
    return false;
  }

  return true;
}

/**
 * Save all outlines to storage
 */
export async function saveAllOutlines(outlines: Outline[], currentOutlineId: string): Promise<void> {
  // Always save currentOutlineId to dedicated key (works with all storage backends)
  localStorage.setItem(CURRENT_OUTLINE_KEY, currentOutlineId);

  // Filter out the guide and lazy-loaded outlines (they have empty nodes and would corrupt the files)
  const userOutlines = outlines.filter(o => {
    if (o.isGuide) return false;
    // Skip lazy-loaded outlines - they have empty nodes and shouldn't be saved
    const lazyOutline = o as LazyOutline;
    if (lazyOutline._isLazyLoaded) {
      return false;
    }
    return true;
  });

  // Validate - warn but don't block save (we still want to persist data)
  validateOutlinesBeforeSave(userOutlines);

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

/**
 * Load a single outline fully on demand (for lazy-loaded outlines)
 * Returns the fully loaded outline, or null if loading fails
 */
export async function loadSingleOutlineOnDemand(fileName: string): Promise<Outline | null> {
  if (!isElectron()) {
    console.error('loadSingleOutlineOnDemand is only available in Electron');
    return null;
  }

  try {
    const outline = await electronLoadSingleOutline(fileName);
    if (outline) {
      console.log(`Fully loaded outline on demand: ${fileName}`);
      return outline;
    }
    return null;
  } catch (error) {
    console.error('Failed to load outline on demand:', error);
    return null;
  }
}

// Re-export isElectron and LazyOutline for use in other components
export { isElectron, type LazyOutline } from './electron-storage';
