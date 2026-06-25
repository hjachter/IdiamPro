/**
 * Bug store — durable record of every in-app "Report Issue" submission.
 *
 * Beta users hit the Report Issue button in the app toolbar to send a quick
 * bug/issue report from inside the running app. Each submission persists
 * here and Howard reviews them in /admin/bugs (mirror of /admin/applicants
 * and /admin/feedback).
 *
 * Storage routes through `src/lib/storage/adapter.ts`. In production
 * (Vercel) that's Upstash KV when KV_REST_API_URL + KV_REST_API_TOKEN are
 * set. In Electron / dev / test it's atomic-write JSON files under
 * `.idiampro/`. Same public API either way.
 *
 * Key layout:
 *   - `bug:<id>`              one BugRecord per id (includes screenshot)
 *   - `bugs:all`              set/index of all bug ids
 */
import { randomUUID } from 'crypto';
import { getStorage } from '../storage/adapter';

export type BugSeverity = 'fyi' | 'annoying' | 'blocking';
export type BugStatus = 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'wont_fix';

export const BUG_STATUSES: BugStatus[] = [
  'new',
  'acknowledged',
  'in_progress',
  'resolved',
  'wont_fix',
];

export interface BugMetadata {
  /** Page URL the user was on when they reported (e.g. /app). */
  url: string;
  /** Raw user agent. Helpful for platform/browser triage. */
  userAgent: string;
  /** Outline name the user had open, if any. */
  outlineName: string | null;
  /** ISO 8601 timestamp captured client-side at the moment of submission. */
  timestamp: string;
}

export interface BugRecord {
  id: string;
  /** ISO 8601 string. Server-stamped on create — independent of client clock. */
  createdAt: string;
  /** Free-form description (10-5000 chars, validated). */
  description: string;
  /** Optional "what were you trying to do" context. */
  context?: string;
  severity: BugSeverity;
  /** Reporting user's email (pulled server-side from Clerk if available). */
  userEmail: string | null;
  /** Reporting user's Clerk user id (if signed in). */
  userId: string | null;
  /** Base64-encoded screenshot bytes (may be null). */
  screenshotBase64: string | null;
  metadata: BugMetadata;
  status: BugStatus;
  /** Howard's notes. Empty unless he's added something. */
  notes?: string;
  /**
   * Internal-only progress notes. Howard tracks "what I've looked at so
   * far / next steps / known blockers" here. NEVER returned by user-facing
   * APIs, NEVER shown to the reporter — only the admin UI reads or writes
   * this field. `stripForUser()` removes it from any record before it
   * leaves the server.
   */
  progressNotes?: string;
}

const KEY_BUG = (id: string) => `bug:${id}`;
const KEY_INDEX = 'bugs:all';

export interface CreateBugArgs {
  description: string;
  context?: string;
  severity: BugSeverity;
  userEmail: string | null;
  userId: string | null;
  screenshotBase64: string | null;
  metadata: BugMetadata;
}

/** Create + persist a new bug. Returns the saved record. */
export async function createBug(args: CreateBugArgs): Promise<BugRecord> {
  const description = (args.description ?? '').trim();
  if (description.length < 10) {
    throw new Error('Add a few more words describing what you saw.');
  }
  if (description.length > 5000) {
    throw new Error('That description is a bit long — please keep it under 5000 characters.');
  }
  const context = (args.context ?? '').trim();
  const record: BugRecord = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    description,
    context: context.length > 0 ? context : undefined,
    severity: args.severity,
    userEmail: args.userEmail,
    userId: args.userId,
    screenshotBase64: args.screenshotBase64,
    metadata: args.metadata,
    status: 'new',
  };
  const storage = getStorage();
  await storage.set(KEY_BUG(record.id), record);
  await storage.setAdd(KEY_INDEX, record.id);
  return record;
}

/** Get a single bug by id. */
export async function getBugById(id: string): Promise<BugRecord | null> {
  if (!id) return null;
  return getStorage().get<BugRecord>(KEY_BUG(id));
}

/** List every bug, newest first. Caller may want to strip screenshots. */
export async function listBugs(): Promise<BugRecord[]> {
  const storage = getStorage();
  const ids = await storage.setMembers(KEY_INDEX);
  if (ids.length === 0) return [];
  const records: BugRecord[] = [];
  for (const id of ids) {
    const r = await storage.get<BugRecord>(KEY_BUG(id));
    if (r) records.push(r);
  }
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Return the bug record with screenshotBase64 dropped, for list views. */
export function stripScreenshot(bug: BugRecord): Omit<BugRecord, 'screenshotBase64'> & { hasScreenshot: boolean } {
  const { screenshotBase64, ...rest } = bug;
  return { ...rest, hasScreenshot: Boolean(screenshotBase64) };
}

/**
 * Update internal progress notes on a bug. Admin-only. The reporter never
 * sees this field (no user-facing API returns it). Pass an empty string
 * to clear. Returns the updated record (or null if id missing).
 */
export async function setBugProgressNotes(
  id: string,
  notes: string,
): Promise<BugRecord | null> {
  const storage = getStorage();
  const record = await storage.get<BugRecord>(KEY_BUG(id));
  if (!record) return null;
  const next = (notes ?? '').toString();
  if ((record.progressNotes ?? '') === next) return record;
  record.progressNotes = next;
  await storage.set(KEY_BUG(id), record);
  return record;
}

/** Update a bug's status. Returns the updated record (or null if id missing). */
export async function setBugStatus(
  id: string,
  status: BugStatus,
): Promise<BugRecord | null> {
  if (!BUG_STATUSES.includes(status)) {
    throw new Error(`Unknown bug status: ${status}`);
  }
  const storage = getStorage();
  const record = await storage.get<BugRecord>(KEY_BUG(id));
  if (!record) return null;
  if (record.status === status) return record;
  record.status = status;
  await storage.set(KEY_BUG(id), record);
  return record;
}

/** Test-only: wipe the store. */
export async function _resetBugStoreForTest(): Promise<void> {
  const storage = getStorage();
  const ids = await storage.setMembers(KEY_INDEX);
  for (const id of ids) {
    await storage.delete(KEY_BUG(id));
    await storage.setRemove(KEY_INDEX, id);
  }
}
