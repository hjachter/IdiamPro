/**
 * Outline snapshot storage — Backup / Restore feature (2026-06-10).
 *
 * This is the second protective layer in the outline-data-protection model:
 *   1. Undo (Cmd+Z) — in-memory, unified across every operation.
 *   2. Disk snapshots — survive app crash, undo-stack overflow, etc.
 *   3. Derivative-by-default for content-altering AI transforms (coming).
 *
 * A snapshot is a complete .idm JSON dump of one outline at a single moment,
 * written to [outlines-dir]/.backups/[safe-outline-name]/[YYYY-MM-DD-HHmmss]-[label].idm.
 * Retention cap: 20 newest snapshots per outline, enforced by the main
 * process. Older snapshots are deleted as new ones arrive.
 *
 * Two trigger paths:
 *   • Manual — the toolbar Backup button opens a tiny label dialog and writes
 *     a snapshot tagged kind='manual'.
 *   • Auto — every AI transform (Reformat, Translate, Transform Outline,
 *     Refresh from Web, Restore) calls snapshotBeforeTransform() at apply-time
 *     to write a kind='auto-transform' snapshot. Honors the Settings toggle
 *     for opt-out.
 *
 * All file IO is delegated to the Electron main process via IPC; the renderer
 * never touches the filesystem directly. Web builds silently no-op (no
 * snapshots — the feature is desktop-only for now).
 */

import type { Outline } from '@/types';
import { isElectron } from './electron-storage';

export type SnapshotKind = 'manual' | 'auto-transform' | 'auto-restore';

export interface SnapshotMeta {
  fileName: string;
  size: number;
  createdAt: number;
  label: string;
  kind: SnapshotKind;
}

interface SnapshotAPI {
  snapshotCreate: (args: { outline: Outline; label?: string; kind?: SnapshotKind }) =>
    Promise<{ success: boolean; snapshot?: SnapshotMeta; error?: string }>;
  snapshotList: (args: { outlineName: string }) =>
    Promise<{ success: boolean; snapshots?: SnapshotMeta[]; error?: string }>;
  snapshotRead: (args: { outlineName: string; fileName: string }) =>
    Promise<{ success: boolean; outline?: Outline; error?: string }>;
  snapshotDelete: (args: { outlineName: string; fileName: string }) =>
    Promise<{ success: boolean; error?: string }>;
  snapshotShowFolder: () =>
    Promise<{ success: boolean; path?: string; error?: string }>;
}

function getSnapshotAPI(): SnapshotAPI | null {
  if (!isElectron()) return null;
  const api = (window as unknown as { electronAPI?: Partial<SnapshotAPI> }).electronAPI;
  if (!api || typeof api.snapshotCreate !== 'function') return null;
  return api as SnapshotAPI;
}

/**
 * Write a snapshot of the given outline to disk. Returns the snapshot
 * metadata on success, or null on failure (the caller logs but does not
 * surface — snapshots are belt-and-suspenders, not a blocking step).
 */
export async function createSnapshot(
  outline: Outline,
  options: { label?: string; kind?: SnapshotKind } = {},
): Promise<SnapshotMeta | null> {
  const api = getSnapshotAPI();
  if (!api) return null;
  try {
    const result = await api.snapshotCreate({
      outline,
      label: options.label,
      kind: options.kind || 'manual',
    });
    if (result.success && result.snapshot) return result.snapshot;
    console.warn('[Snapshot] create failed:', result.error);
    return null;
  } catch (err) {
    console.warn('[Snapshot] create threw:', err);
    return null;
  }
}

/**
 * List all snapshots for the given outline, newest first.
 */
export async function listSnapshots(outlineName: string): Promise<SnapshotMeta[]> {
  const api = getSnapshotAPI();
  if (!api) return [];
  try {
    const result = await api.snapshotList({ outlineName });
    if (result.success && result.snapshots) return result.snapshots;
    return [];
  } catch (err) {
    console.warn('[Snapshot] list threw:', err);
    return [];
  }
}

/**
 * Read a snapshot's full outline JSON.
 */
export async function readSnapshot(
  outlineName: string,
  fileName: string,
): Promise<Outline | null> {
  const api = getSnapshotAPI();
  if (!api) return null;
  try {
    const result = await api.snapshotRead({ outlineName, fileName });
    if (result.success && result.outline) return result.outline;
    return null;
  } catch (err) {
    console.warn('[Snapshot] read threw:', err);
    return null;
  }
}

/**
 * Delete a single snapshot.
 */
export async function deleteSnapshot(
  outlineName: string,
  fileName: string,
): Promise<boolean> {
  const api = getSnapshotAPI();
  if (!api) return false;
  try {
    const result = await api.snapshotDelete({ outlineName, fileName });
    return !!result.success;
  } catch {
    return false;
  }
}

/**
 * Open the backups folder in Finder / file explorer (Electron only).
 * Returns the absolute path so the web build can display it as text.
 */
export async function showSnapshotsFolder(): Promise<string | null> {
  const api = getSnapshotAPI();
  if (!api) return null;
  try {
    const result = await api.snapshotShowFolder();
    return result.success ? (result.path || null) : null;
  } catch {
    return null;
  }
}

// ── Settings: auto-snapshot opt-out ────────────────────────────────────────
// Two toggles, both default ON. Persisted to localStorage so they survive
// reloads without a round-trip to disk.

const AUTO_TRANSFORM_KEY = 'backup.autoBeforeTransform';
const AUTO_RESTORE_KEY = 'backup.autoBeforeRestore';

function readBoolFlag(key: string, defaultValue: boolean): boolean {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return raw === 'true';
  } catch {
    return defaultValue;
  }
}

function writeBoolFlag(key: string, value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value ? 'true' : 'false');
  } catch {
    // private mode — ignore
  }
}

export function getAutoSnapshotBeforeTransform(): boolean {
  return readBoolFlag(AUTO_TRANSFORM_KEY, true);
}

export function setAutoSnapshotBeforeTransform(value: boolean): void {
  writeBoolFlag(AUTO_TRANSFORM_KEY, value);
}

export function getAutoSnapshotBeforeRestore(): boolean {
  return readBoolFlag(AUTO_RESTORE_KEY, true);
}

export function setAutoSnapshotBeforeRestore(value: boolean): void {
  writeBoolFlag(AUTO_RESTORE_KEY, value);
}

/**
 * Auto-snapshot helper for AI transform apply-time. Call this BEFORE applying
 * an AI transform to a user's outline. No-ops when the user has opted out via
 * Settings or when not running in Electron. Never throws — snapshots are
 * fire-and-forget protection.
 *
 * Label format: "auto: before [transformName]".
 */
export async function snapshotBeforeTransform(
  outline: Outline | null | undefined,
  transformName: string,
): Promise<void> {
  if (!outline) return;
  if (!getAutoSnapshotBeforeTransform()) return;
  await createSnapshot(outline, {
    label: 'auto: before ' + transformName,
    kind: 'auto-transform',
  });
}

/**
 * Auto-snapshot helper for the Restore action. Always writes a snapshot of
 * the CURRENT state before replacing it with a previous snapshot. Honors the
 * "Auto-backup before Restore" Setting (defaults ON).
 */
export async function snapshotBeforeRestore(
  outline: Outline | null | undefined,
): Promise<void> {
  if (!outline) return;
  if (!getAutoSnapshotBeforeRestore()) return;
  await createSnapshot(outline, {
    label: 'auto: before restore',
    kind: 'auto-restore',
  });
}

/**
 * Format a snapshot timestamp for display ("Today at 3:42 PM", "Yesterday at
 * 10:15 AM", or "Jun 8 at 11:02 AM").
 */
export function formatSnapshotTimestamp(createdAt: number): string {
  const date = new Date(createdAt);
  const now = new Date();
  const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isSameDay) return 'Today at ' + timeStr;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return 'Yesterday at ' + timeStr;
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return dateStr + ' at ' + timeStr;
}

/**
 * Format file size for display (KB / MB).
 */
export function formatSnapshotSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
