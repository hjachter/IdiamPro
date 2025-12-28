import type { Outline } from '@/types';

// IndexedDB database for storing directory handle
const DB_NAME = 'idiampro-storage';
const DB_VERSION = 1;
const STORE_NAME = 'directory-handles';

/**
 * Open IndexedDB to store directory handle
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Store directory handle in IndexedDB
 */
export async function storeDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.put(handle, 'userDataDir');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve directory handle from IndexedDB
 */
export async function getDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get('userDataDir');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get directory handle:', error);
    return null;
  }
}

/**
 * Check if we have permission to read/write to the directory
 */
export async function verifyDirectoryPermission(
  dirHandle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  const opts = { mode };

  // Check if permission was already granted
  if ((await dirHandle.queryPermission(opts)) === 'granted') {
    return true;
  }

  // Request permission
  if ((await dirHandle.requestPermission(opts)) === 'granted') {
    return true;
  }

  return false;
}

/**
 * Sanitize outline name for use as filename
 */
function sanitizeFileName(name: string): string {
  // Replace invalid filename characters with underscores
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

/**
 * Get file name for an outline
 */
function getOutlineFileName(outline: Outline): string {
  return `${sanitizeFileName(outline.name)}.json`;
}

/**
 * Save an outline to a file in the directory
 */
export async function saveOutlineToFile(
  dirHandle: FileSystemDirectoryHandle,
  outline: Outline
): Promise<void> {
  try {
    // Verify write permission
    const hasPermission = await verifyDirectoryPermission(dirHandle, 'readwrite');
    if (!hasPermission) {
      throw new Error('No write permission for directory');
    }

    const fileName = getOutlineFileName(outline);
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();

    const content = JSON.stringify(outline, null, 2);
    await writable.write(content);
    await writable.close();

    console.log(`Saved outline to file: ${fileName}`);
  } catch (error) {
    console.error('Failed to save outline to file:', error);
    throw error;
  }
}

/**
 * Load an outline from a file
 */
export async function loadOutlineFromFile(
  fileHandle: FileSystemFileHandle
): Promise<Outline> {
  try {
    const file = await fileHandle.getFile();
    const text = await file.text();
    const outline = JSON.parse(text) as Outline;
    return outline;
  } catch (error) {
    console.error('Failed to load outline from file:', error);
    throw error;
  }
}

/**
 * Load all outlines from the directory
 */
export async function loadOutlinesFromDirectory(
  dirHandle: FileSystemDirectoryHandle
): Promise<Outline[]> {
  try {
    // Verify read permission
    const hasPermission = await verifyDirectoryPermission(dirHandle, 'read');
    if (!hasPermission) {
      throw new Error('No read permission for directory');
    }

    const outlines: Outline[] = [];

    // Iterate through all files in the directory
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.json')) {
        try {
          const outline = await loadOutlineFromFile(entry as FileSystemFileHandle);
          outlines.push(outline);
        } catch (error) {
          console.error(`Failed to load ${entry.name}:`, error);
          // Continue loading other files even if one fails
        }
      }
    }

    return outlines;
  } catch (error) {
    console.error('Failed to load outlines from directory:', error);
    throw error;
  }
}

/**
 * Delete an outline file from the directory
 */
export async function deleteOutlineFile(
  dirHandle: FileSystemDirectoryHandle,
  outline: Outline
): Promise<void> {
  try {
    const hasPermission = await verifyDirectoryPermission(dirHandle, 'readwrite');
    if (!hasPermission) {
      throw new Error('No write permission for directory');
    }

    const fileName = getOutlineFileName(outline);
    await dirHandle.removeEntry(fileName);
    console.log(`Deleted outline file: ${fileName}`);
  } catch (error) {
    console.error('Failed to delete outline file:', error);
    throw error;
  }
}

/**
 * Rename an outline file (when outline name changes)
 */
export async function renameOutlineFile(
  dirHandle: FileSystemDirectoryHandle,
  oldName: string,
  newOutline: Outline
): Promise<void> {
  try {
    const hasPermission = await verifyDirectoryPermission(dirHandle, 'readwrite');
    if (!hasPermission) {
      throw new Error('No write permission for directory');
    }

    const oldFileName = `${sanitizeFileName(oldName)}.json`;
    const newFileName = getOutlineFileName(newOutline);

    // If names are the same, just update the file
    if (oldFileName === newFileName) {
      await saveOutlineToFile(dirHandle, newOutline);
      return;
    }

    // Delete old file and create new one
    try {
      await dirHandle.removeEntry(oldFileName);
    } catch (error) {
      console.warn('Could not delete old file:', error);
    }

    await saveOutlineToFile(dirHandle, newOutline);
    console.log(`Renamed outline file: ${oldFileName} -> ${newFileName}`);
  } catch (error) {
    console.error('Failed to rename outline file:', error);
    throw error;
  }
}

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}
