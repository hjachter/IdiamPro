/**
 * Unsubscribe state store.
 *
 * Stores the set of userIds that have unsubscribed from onboarding emails.
 *
 * Storage routes through `src/lib/storage/adapter.ts`. In production
 * (Vercel) that's Vercel KV / Upstash Redis when `KV_REST_API_URL` +
 * `KV_REST_API_TOKEN` are set. In Electron / dev / test it's atomic-write
 * JSON files under `.idiampro/`. Same public API either way; the four
 * exported functions are the only seam consumers touch.
 *
 * Key layout:
 *   - `unsubscribe:<userId>`     one record { userId, unsubscribedAt }
 *   - `unsubscribes:all`         set/index of unsubscribed user ids
 *
 * Edge runtime: this module talks to the storage adapter (which may use fs
 * or @vercel/kv). All consumer routes already run on the Node runtime
 * (`export const runtime = 'nodejs'`).
 */

import { getStorage } from '../storage/adapter';

interface UnsubscribeRecord {
  userId: string;
  unsubscribedAt: string; // ISO 8601
}

const KEY_RECORD = (userId: string) => `unsubscribe:${userId}`;
const KEY_INDEX = 'unsubscribes:all';

/** Returns true if this user has unsubscribed. */
export async function isUnsubscribed(userId: string): Promise<boolean> {
  if (!userId) return false;
  const record = await getStorage().get<UnsubscribeRecord>(KEY_RECORD(userId));
  return record !== null;
}

/** Mark this user as unsubscribed (idempotent). */
export async function markUnsubscribed(userId: string): Promise<void> {
  if (!userId) return;
  const storage = getStorage();
  const existing = await storage.get<UnsubscribeRecord>(KEY_RECORD(userId));
  if (existing) return;
  const record: UnsubscribeRecord = {
    userId,
    unsubscribedAt: new Date().toISOString(),
  };
  await storage.set(KEY_RECORD(userId), record);
  await storage.setAdd(KEY_INDEX, userId);
}

/** Re-subscribe (rarely needed; exported for completeness + tests). */
export async function markResubscribed(userId: string): Promise<void> {
  if (!userId) return;
  const storage = getStorage();
  await storage.delete(KEY_RECORD(userId));
  await storage.setRemove(KEY_INDEX, userId);
}

/**
 * Reset the store (test-only helper). Removes every record + clears the index.
 */
export async function _resetUnsubscribeStoreForTest(): Promise<void> {
  const storage = getStorage();
  const ids = await storage.setMembers(KEY_INDEX);
  for (const id of ids) {
    await storage.delete(KEY_RECORD(id));
    await storage.setRemove(KEY_INDEX, id);
  }
}
