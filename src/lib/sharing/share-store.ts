/**
 * Server-side store for "Publish to a shareable link".
 *
 * A published share is a SNAPSHOT of an outline rendered to a self-contained
 * HTML page (via the existing Website generator) and hosted on OUR OWN
 * infrastructure — never a third party. It is served read-only at `/s/<id>`.
 *
 * Storage reuses the project's storage adapter (Vercel KV / Upstash in
 * production, file backend in Electron/dev, no-op stub when neither is
 * available). Two keys per user:
 *   - `share:<shareId>`     → one ShareDoc (owner, title, template, html, ts)
 *   - `shares:<ownerId>`    → SET of that owner's active shareIds (for listing
 *                             + free-tier quota counting)
 *
 * Cost safety: publishing/hosting costs us a little, so NEW links are gated by
 * a modest free allowance enforced SERVER-SIDE (see FREE_SHARE_LINK_LIMIT).
 * Re-publishing (updating) an existing link never consumes allowance.
 */

import { getStorage } from '@/lib/storage/adapter';

/**
 * How many ACTIVE published links a FREE account may keep at once. Premium
 * accounts are unlimited. Kept as a single easily-changed constant so the
 * owner can dial the allowance up or down without hunting through code.
 */
export const FREE_SHARE_LINK_LIMIT = 3;

/**
 * Hard cap on the size of a single published page. Guards against a runaway
 * outline turning into a multi-megabyte hosting cost. ~2 MB of HTML is far
 * larger than any reasonable rendered outline page.
 */
export const MAX_SHARE_HTML_BYTES = 2_000_000;

/** The set of Website templates a share may use (mirrors the free ones). */
export const ALLOWED_SHARE_TEMPLATES = [
  'marketing',
  'informational',
  'documentation',
] as const;
export type ShareTemplate = (typeof ALLOWED_SHARE_TEMPLATES)[number];

export interface ShareDoc {
  shareId: string;
  ownerId: string;
  title: string;
  template: string;
  /** The fully-rendered, self-contained HTML page for this snapshot. */
  html: string;
  createdAt: number;
  updatedAt: number;
}

/** Metadata-only view of a share (no HTML) — safe to list to the client. */
export interface ShareSummary {
  shareId: string;
  title: string;
  template: string;
  createdAt: number;
  updatedAt: number;
}

function shareDocKey(shareId: string): string {
  return `share:${shareId}`;
}

function ownerSetKey(ownerId: string): string {
  return `shares:${ownerId}`;
}

/** Generate an unguessable share id (128 bits of randomness, hex). */
export function newShareId(): string {
  // crypto.randomUUID is available in Node 18+ and the Edge runtime.
  return globalThis.crypto.randomUUID().replace(/-/g, '');
}

/** Fetch a full share doc (including HTML) by id, or null if absent/revoked. */
export async function getShare(shareId: string): Promise<ShareDoc | null> {
  if (!shareId || !/^[a-f0-9]{16,64}$/i.test(shareId)) return null;
  try {
    return await getStorage().get<ShareDoc>(shareDocKey(shareId));
  } catch {
    return null;
  }
}

/** The ids of an owner's currently-active shares. */
export async function listOwnerShareIds(ownerId: string): Promise<string[]> {
  try {
    return await getStorage().setMembers(ownerSetKey(ownerId));
  } catch {
    return [];
  }
}

/** Metadata for all of an owner's active shares, newest first. */
export async function listOwnerShares(ownerId: string): Promise<ShareSummary[]> {
  const ids = await listOwnerShareIds(ownerId);
  const docs = await Promise.all(ids.map((id) => getShare(id)));
  return docs
    .filter((d): d is ShareDoc => d !== null && d.ownerId === ownerId)
    .map((d) => ({
      shareId: d.shareId,
      title: d.title,
      template: d.template,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Create a brand-new published share and index it under the owner. */
export async function createShare(input: {
  ownerId: string;
  title: string;
  template: string;
  html: string;
}): Promise<ShareDoc> {
  const now = Date.now();
  const doc: ShareDoc = {
    shareId: newShareId(),
    ownerId: input.ownerId,
    title: input.title,
    template: input.template,
    html: input.html,
    createdAt: now,
    updatedAt: now,
  };
  const store = getStorage();
  await store.set(shareDocKey(doc.shareId), doc);
  await store.setAdd(ownerSetKey(doc.ownerId), doc.shareId);
  return doc;
}

/**
 * Overwrite an existing share's snapshot. Returns null if the share does not
 * exist or is not owned by `ownerId` (ownership is enforced by the caller too).
 */
export async function updateShare(input: {
  ownerId: string;
  shareId: string;
  title: string;
  template: string;
  html: string;
}): Promise<ShareDoc | null> {
  const existing = await getShare(input.shareId);
  if (!existing || existing.ownerId !== input.ownerId) return null;
  const doc: ShareDoc = {
    ...existing,
    title: input.title,
    template: input.template,
    html: input.html,
    updatedAt: Date.now(),
  };
  await getStorage().set(shareDocKey(doc.shareId), doc);
  return doc;
}

/**
 * Revoke a share: delete the snapshot and de-index it. The public link stops
 * resolving immediately. Only succeeds when `ownerId` owns the share.
 */
export async function deleteShare(
  ownerId: string,
  shareId: string,
): Promise<boolean> {
  const existing = await getShare(shareId);
  if (!existing || existing.ownerId !== ownerId) return false;
  const store = getStorage();
  await store.delete(shareDocKey(shareId));
  await store.setRemove(ownerSetKey(ownerId), shareId);
  return true;
}
