/**
 * Unsubscribe state store — v1.
 *
 * Stores the set of userIds that have unsubscribed from onboarding emails.
 *
 * v1 strategy: a JSON file on disk under the project's writable data dir,
 * keyed by userId. This is fine for launch volume (we expect O(thousands)
 * of users at most for several months). The shape is intentionally trivial
 * so swapping to a real database post-launch (Vercel KV, Postgres, etc.)
 * is a one-file change — every consumer talks to the four exported
 * functions below.
 *
 * Storage location:
 *   - Set EMAIL_UNSUBSCRIBE_STORE_PATH to an absolute path to override.
 *   - Default: `.idiampro/unsubscribed.json` under the process cwd.
 *
 * Concurrency: we do an atomic-rename write (write to .tmp, then rename)
 * so a torn write can't corrupt the JSON. For the volumes we're talking
 * about, contention is a non-issue; if it ever becomes one, this is the
 * single file to harden.
 *
 * Edge runtime: this module uses fs and is therefore Node-runtime only.
 * The webhook + cron + unsubscribe routes all run on Node (we set
 * `export const runtime = 'nodejs'` on each one).
 */

import { promises as fs } from 'fs';
import { dirname, join } from 'path';

interface UnsubscribeRecord {
  userId: string;
  unsubscribedAt: string; // ISO 8601
}

interface UnsubscribeFile {
  version: 1;
  records: Record<string, UnsubscribeRecord>;
}

const FILE_VERSION = 1;

function resolveStorePath(): string {
  const override = (process.env.EMAIL_UNSUBSCRIBE_STORE_PATH ?? '').trim();
  if (override.length > 0) return override;
  return join(process.cwd(), '.idiampro', 'unsubscribed.json');
}

async function readFileSafe(path: string): Promise<UnsubscribeFile> {
  try {
    const raw = await fs.readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as UnsubscribeFile;
    if (parsed && parsed.version === FILE_VERSION && parsed.records) {
      return parsed;
    }
  } catch (err) {
    // ENOENT and JSON parse errors both fall through to a fresh file.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[email/unsubscribe-store] could not read existing store, starting fresh:', err);
    }
  }
  return { version: FILE_VERSION, records: {} };
}

async function writeFileAtomic(path: string, data: UnsubscribeFile): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, path);
}

/** Returns true if this user has unsubscribed. */
export async function isUnsubscribed(userId: string): Promise<boolean> {
  if (!userId) return false;
  const file = await readFileSafe(resolveStorePath());
  return Object.prototype.hasOwnProperty.call(file.records, userId);
}

/** Mark this user as unsubscribed (idempotent). */
export async function markUnsubscribed(userId: string): Promise<void> {
  if (!userId) return;
  const path = resolveStorePath();
  const file = await readFileSafe(path);
  if (!file.records[userId]) {
    file.records[userId] = { userId, unsubscribedAt: new Date().toISOString() };
    await writeFileAtomic(path, file);
  }
}

/** Re-subscribe (rarely needed; exported for completeness + tests). */
export async function markResubscribed(userId: string): Promise<void> {
  if (!userId) return;
  const path = resolveStorePath();
  const file = await readFileSafe(path);
  if (file.records[userId]) {
    delete file.records[userId];
    await writeFileAtomic(path, file);
  }
}

/**
 * Reset the store (test-only helper). Removes the file entirely.
 */
export async function _resetUnsubscribeStoreForTest(): Promise<void> {
  const path = resolveStorePath();
  try {
    await fs.unlink(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
