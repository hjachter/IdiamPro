'use client';

/**
 * Privacy & Data — GDPR/CCPA-compliant export and delete flows.
 *
 * Today, IdiamPro/SecondBrainWare stores all user data locally on the
 * user's device. There is no server-side account, so "all my data"
 * means everything in the app's local scope: outlines, localStorage
 * keys, AI consent state, settings, API keys, etc.
 *
 * This module provides two top-level operations:
 *
 *   exportAllUserData() — bundles every piece of locally-stored data
 *     into a single .zip archive and prompts the user to save it
 *     (Electron native dialog, browser download, or iOS Share sheet).
 *
 *   deleteAllUserData() — wipes outlines from whichever storage backend
 *     is active (Electron file system, File System Access API directory,
 *     or localStorage), clears every app-related localStorage key, and
 *     reloads the page so the app returns to a fresh-install state.
 *
 * Neither operation touches anything outside the app's data scope.
 */

import JSZip from 'jszip';
import type { Outline } from '@/types';
import { loadStorageData, deleteOutline, isElectron } from './storage-manager';
import {
  electronLoadSingleOutline,
  electronLoadOutlinesFromDirectory,
  type LazyOutline,
} from './electron-storage';
import { getDirectoryHandle, verifyDirectoryPermission } from './file-storage';

// --- Platform helpers ----------------------------------------------------

function isCapacitorNative(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

// --- localStorage keys ---------------------------------------------------

/**
 * Known IdiamPro localStorage keys. Anything not in this list is
 * preserved on delete and exported under "unknown_keys" so we don't
 * accidentally touch keys owned by other apps on the same origin.
 */
const KNOWN_LOCAL_STORAGE_KEYS: readonly string[] = [
  // outline data
  'outline-pro-data',
  'idiampro-current-outline-id',
  'idiampro-unmerge-backup',
  'idiampro-backup',
  // settings / preferences
  'confirmDelete',
  'aiDataConsent',
  'aiDepth',
  'aiLevel',
  'aiTone',
  'aiProvider',
  'ollamaModel',
  'idiampro-sidebar-width',
  'idiampro-outline-panel-size',
  'idiampro-welcomed',
  'idiampro-diagram-type',
  'idiampro-generate-placement',
  'idiampro-generate-source',
  'idiampro-include-diagram',
  'idiampro-podcast-voices',
  'knowledgeChatInitMode',
  'outline-pro-ai-plan',
  // theme (next-themes)
  'theme',
];

/**
 * Prefixes for keys whose exact name we can't predict but that
 * belong to IdiamPro (e.g. per-provider API keys).
 */
const KNOWN_LOCAL_STORAGE_PREFIXES: readonly string[] = [
  'apiKey_', // per-provider AI keys
  'idiampro-', // any other namespaced keys
];

function isAppKey(key: string): boolean {
  if (KNOWN_LOCAL_STORAGE_KEYS.includes(key)) return true;
  return KNOWN_LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

// --- Export --------------------------------------------------------------

interface ExportManifest {
  exportedAt: string;
  app: string;
  schemaVersion: number;
  platform: {
    electron: boolean;
    capacitor: boolean;
    userAgent: string;
  };
  outlineCount: number;
  localStorageKeyCount: number;
  notes: string;
}

/**
 * Sanitize a string into a safe filename component.
 */
function safeFileName(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'untitled'
  );
}

/**
 * Load every outline, ensuring lazy-loaded outlines are fully hydrated
 * so the export contains real node data, not metadata stubs.
 */
async function loadAllOutlinesForExport(): Promise<Outline[]> {
  // Try to read fully-hydrated outlines from Electron if available.
  if (isElectron()) {
    try {
      const full = await electronLoadOutlinesFromDirectory();
      if (full.length > 0) return full;
    } catch (err) {
      console.warn('[Privacy] Electron full-load failed, falling back:', err);
    }
  }

  const { outlines } = await loadStorageData();

  // Hydrate any lazy-loaded outlines (Electron metadata-only loads).
  const hydrated = await Promise.all(
    outlines.map(async (o) => {
      const lazy = o as LazyOutline;
      if (lazy._isLazyLoaded && lazy._fileName && isElectron()) {
        try {
          const full = await electronLoadSingleOutline(lazy._fileName);
          if (full) return full as Outline;
        } catch (err) {
          console.warn('[Privacy] Could not hydrate outline for export:', lazy.name, err);
        }
      }
      return o;
    })
  );

  return hydrated;
}

/**
 * Snapshot every relevant localStorage key as a plain object.
 */
function snapshotLocalStorage(): {
  known: Record<string, string>;
  unknown: Record<string, string>;
} {
  const known: Record<string, string> = {};
  const unknown: Record<string, string> = {};

  if (typeof localStorage === 'undefined') return { known, unknown };

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const value = localStorage.getItem(key);
    if (value === null) continue;
    if (isAppKey(key)) {
      known[key] = value;
    } else {
      unknown[key] = value;
    }
  }

  return { known, unknown };
}

/**
 * Build the export archive in memory.
 */
async function buildExportZip(): Promise<{ blob: Blob; filename: string }> {
  const zip = new JSZip();

  // 1. Outlines (one .idm file each, in the outlines/ folder)
  const outlines = await loadAllOutlinesForExport();
  const outlinesFolder = zip.folder('outlines');
  if (outlinesFolder) {
    const usedNames = new Set<string>();
    for (const outline of outlines) {
      let base = safeFileName(outline.name || 'outline');
      let candidate = `${base}.idm`;
      let n = 1;
      while (usedNames.has(candidate)) {
        candidate = `${base} (${n++}).idm`;
      }
      usedNames.add(candidate);
      // .idm is JSON-serialized Outline
      outlinesFolder.file(candidate, JSON.stringify(outline, null, 2));
    }
  }

  // 2. localStorage snapshot
  const { known, unknown } = snapshotLocalStorage();
  zip.file(
    'settings/localStorage.json',
    JSON.stringify(
      {
        app_keys: known,
        other_keys: unknown,
        note:
          'app_keys are IdiamPro/SecondBrainWare keys. other_keys are unrelated keys present on the same origin and are included for completeness only.',
      },
      null,
      2
    )
  );

  // 3. AI consent state (extracted for convenience)
  const aiConsent = typeof localStorage !== 'undefined' ? localStorage.getItem('aiDataConsent') : null;
  zip.file(
    'settings/ai-consent.json',
    JSON.stringify(
      {
        aiDataConsent: aiConsent,
        recordedAt: new Date().toISOString(),
        explanation:
          "Either 'granted' or 'revoked' (or null if never set). This controls whether AI features may transmit outline content to third-party providers.",
      },
      null,
      2
    )
  );

  // 4. Manifest
  const manifest: ExportManifest = {
    exportedAt: new Date().toISOString(),
    app: 'IdiamPro / SecondBrainWare',
    schemaVersion: 1,
    platform: {
      electron: isElectron(),
      capacitor: isCapacitorNative(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    },
    outlineCount: outlines.length,
    localStorageKeyCount: Object.keys(known).length,
    notes:
      'This archive contains all data IdiamPro stores locally on your device. There is no server-side account today, so this is a complete export. Outlines are in outlines/*.idm (JSON). Settings and AI consent are in settings/.',
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // 5. Human-readable README
  zip.file(
    'README.txt',
    [
      'IdiamPro / SecondBrainWare — Personal Data Export',
      '',
      `Generated: ${manifest.exportedAt}`,
      `Outlines: ${manifest.outlineCount}`,
      `Settings keys: ${manifest.localStorageKeyCount}`,
      '',
      'CONTENTS',
      '  manifest.json              metadata about this export',
      '  outlines/*.idm             your outline files (JSON format)',
      '  settings/localStorage.json all local app preferences and API keys',
      '  settings/ai-consent.json   your AI data processing consent state',
      '',
      'You own this data. Keep it safe — the API keys inside are plaintext',
      'and grant access to your paid AI accounts.',
      '',
      'To restore: open IdiamPro and use the admin menu > "Restore All',
      'Outlines" with an unzipped folder, or import individual .idm files.',
    ].join('\n')
  );

  const blob = await zip.generateAsync({ type: 'blob' });

  const ts = new Date()
    .toISOString()
    .replace(/[:T]/g, '-')
    .replace(/\.\d+Z$/, 'Z');
  const filename = `idiampro-data-export-${ts}.zip`;

  return { blob, filename };
}

/**
 * Trigger a save of the archive using the right platform mechanism.
 */
async function saveExportZip(blob: Blob, filename: string): Promise<'saved' | 'cancelled'> {
  // Electron — native save dialog.
  if (isElectron()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).electronAPI;
    if (api?.saveFileDialog && api?.writeFile) {
      const filePath = await api.saveFileDialog({
        title: 'Export IdiamPro Data',
        defaultPath: filename,
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
      });
      if (!filePath) return 'cancelled';

      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(i, i + chunkSize))
        );
      }
      const base64 = btoa(binary);
      await api.writeFile(filePath, base64, 'base64');
      return 'saved';
    }
  }

  // Capacitor (iOS) — write to cache and trigger the Share sheet so the
  // user can save to Files, AirDrop, email, etc.
  if (isCapacitorNative()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const idx = result.indexOf(',');
        resolve(idx >= 0 ? result.slice(idx + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

    const written = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });

    await Share.share({
      title: 'IdiamPro Data Export',
      text: 'Your IdiamPro data archive',
      url: written.uri,
      dialogTitle: 'Save your IdiamPro export',
    });

    return 'saved';
  }

  // Web — try File System Access API, fall back to anchor download.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'Zip Archive',
            accept: { 'application/zip': ['.zip'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.name === 'AbortError') return 'cancelled';
      // fall through to anchor download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}

/**
 * Public entry point — generates and saves the full export archive.
 */
export async function exportAllUserData(): Promise<{
  status: 'saved' | 'cancelled';
  outlineCount: number;
  filename: string;
}> {
  const { blob, filename } = await buildExportZip();
  // Read outline count from the zip's manifest by recomputing (cheap).
  const outlines = await loadAllOutlinesForExport();
  const status = await saveExportZip(blob, filename);
  return { status, outlineCount: outlines.length, filename };
}

// --- Delete --------------------------------------------------------------

/**
 * Best-effort deletion of all outlines from whichever storage backend
 * is currently active. Errors on individual outlines are logged but do
 * not abort the overall wipe.
 */
async function deleteAllOutlinesFromStorage(): Promise<number> {
  let deletedCount = 0;

  // Load metadata first so we can issue deletes per outline.
  let outlines: Outline[] = [];
  try {
    const data = await loadStorageData();
    outlines = data.outlines.filter((o) => !o.isGuide);
  } catch (err) {
    console.error('[Privacy] Failed to load outline list for deletion:', err);
  }

  for (const outline of outlines) {
    try {
      await deleteOutline(outline);
      deletedCount += 1;
    } catch (err) {
      console.error('[Privacy] Failed to delete outline:', outline.name, err);
    }
  }

  // Also clear the localStorage outline blob in case the file-system
  // backend isn't the only place outlines were persisted.
  try {
    localStorage.removeItem('outline-pro-data');
  } catch {
    // ignore
  }

  return deletedCount;
}

/**
 * Remove every IdiamPro-owned localStorage key. Unknown keys are left
 * untouched so we don't trample on anything outside the app's scope.
 */
function clearAppLocalStorage(): number {
  if (typeof localStorage === 'undefined') return 0;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (isAppKey(key)) toRemove.push(key);
  }
  for (const key of toRemove) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn('[Privacy] Failed to clear localStorage key:', key, err);
    }
  }
  return toRemove.length;
}

/**
 * Clear sessionStorage entirely — it's all transient app state.
 */
function clearSessionStorage(): void {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  } catch {
    // ignore
  }
}

/**
 * Reload the app to return it to a fresh-install state.
 */
function reloadApp(): void {
  // Small timeout lets any in-flight toast render before the reload.
  setTimeout(() => {
    try {
      window.location.reload();
    } catch {
      // ignore — best effort
    }
  }, 250);
}

/**
 * Public entry point — wipes all locally-stored user data and reloads
 * the app. Callers MUST gate this behind their own confirmation UI.
 */
export async function deleteAllUserData(): Promise<{
  outlinesDeleted: number;
  localStorageKeysCleared: number;
}> {
  const outlinesDeleted = await deleteAllOutlinesFromStorage();

  // Note: we do not revoke File System Access API directory handles
  // stored in IndexedDB — those just point to a folder; the user
  // retains ownership of the folder itself, and the outline files
  // inside have already been deleted above.

  const localStorageKeysCleared = clearAppLocalStorage();
  clearSessionStorage();

  reloadApp();

  return { outlinesDeleted, localStorageKeysCleared };
}

// --- Optional helper for callers that want to disclose what we touch ----

/**
 * Inspect (without modifying) what would be cleared, for UI disclosure.
 */
export async function inspectUserDataScope(): Promise<{
  outlines: number;
  appKeys: string[];
}> {
  let outlineCount = 0;
  try {
    const { outlines } = await loadStorageData();
    outlineCount = outlines.filter((o) => !o.isGuide).length;
  } catch {
    // ignore
  }

  const appKeys: string[] = [];
  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && isAppKey(key)) appKeys.push(key);
    }
  }

  return { outlines: outlineCount, appKeys };
}

// Re-export for callers that just want the platform helpers.
export { isCapacitorNative };

// Keep the file-storage import "live" even when unused at runtime so
// future maintainers know this module is aware of FSA-backed setups.
void getDirectoryHandle;
void verifyDirectoryPermission;
