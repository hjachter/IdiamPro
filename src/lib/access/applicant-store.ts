/**
 * Applicant store — durable record of every beta applicant.
 *
 * IdiamPro's beta is invite-only: prospective users submit an application
 * at /signup, Howard reviews each one in the /admin/applicants dashboard,
 * and the act of clicking "Approve" both adds the email to the allowlist
 * AND triggers a welcome email. This module is the durable storage layer.
 *
 * Storage: routes through `src/lib/storage/adapter.ts`. In production
 * (Vercel) that's Vercel KV / Upstash Redis when `KV_REST_API_URL` +
 * `KV_REST_API_TOKEN` are set. In Electron / dev / test it's atomic-write
 * JSON files under `.idiampro/`. Same public API either way; callers don't
 * know or care which backend serves the request.
 *
 * Key layout:
 *   - `applicant:<id>`           one ApplicantRecord per id
 *   - `applicants:all`           set/index of all applicant ids
 *   - `applicant-email:<email>`  reverse-lookup id by normalized email
 *
 * The allowlist (src/lib/access/allowlist.ts) is still the single source
 * of truth for "is this email allowed to sign up?". When Howard approves
 * an applicant, two things happen: we set the record's status to "approved"
 * here, AND the allowlist learns about approved emails via
 * getApprovedApplicantEmails().
 */

import { randomUUID } from 'crypto';
import { getStorage } from '../storage/adapter';

export type ApplicantStatus = 'pending' | 'approved' | 'rejected';

export interface ApplicantRecord {
  id: string;
  name: string;
  email: string;
  /** ISO 8601 string. */
  signupDate: string;
  status: ApplicantStatus;
  /** Optional: what brings you to IdiamPro? Free-form text. */
  reason?: string;
  /** Best-effort: caller's IP (from x-forwarded-for / x-real-ip). */
  ip?: string;
  /** Optional: HTTP Referer header at signup, if present. */
  referrer?: string;
  /** ISO 8601 string. Set when status flips to 'approved'. */
  approvedDate?: string;
  /** Howard's free-form notes — only visible in the admin dashboard. */
  notes?: string;
  /** ISO 8601 string. Set when the 14-day feedback-reminder cron sends the
   * "mind sharing 5 minutes" email, so we never double-send. */
  feedbackReminderSentAt?: string;
}

const KEY_APPLICANT = (id: string) => `applicant:${id}`;
const KEY_INDEX = 'applicants:all';
const KEY_EMAIL_LOOKUP = (email: string) => `applicant-email:${email}`;

function normalizeEmail(email: string): string {
  return (email ?? '').trim().toLowerCase();
}

export interface CreateApplicantArgs {
  name: string;
  email: string;
  reason?: string;
  ip?: string;
  referrer?: string;
}

/**
 * Create a new pending applicant. Returns the new record.
 *
 * If an applicant with the same email already exists, returns the existing
 * record unchanged (idempotent — re-submitting a form doesn't create dupes).
 */
export async function createApplicant(
  args: CreateApplicantArgs,
): Promise<ApplicantRecord> {
  const email = normalizeEmail(args.email);
  if (!email || email.indexOf('@') === -1) {
    throw new Error('A valid email is required.');
  }
  const name = (args.name ?? '').trim();
  if (!name) {
    throw new Error('A name is required.');
  }

  const storage = getStorage();

  // Dedupe by email — fast path via the reverse-lookup key.
  const existingId = await storage.get<string>(KEY_EMAIL_LOOKUP(email));
  if (existingId) {
    const existing = await storage.get<ApplicantRecord>(KEY_APPLICANT(existingId));
    if (existing) return existing;
  }

  const record: ApplicantRecord = {
    id: randomUUID(),
    name,
    email,
    signupDate: new Date().toISOString(),
    status: 'pending',
    reason: args.reason && args.reason.trim().length > 0 ? args.reason.trim() : undefined,
    ip: args.ip && args.ip.trim().length > 0 ? args.ip.trim() : undefined,
    referrer:
      args.referrer && args.referrer.trim().length > 0 ? args.referrer.trim() : undefined,
  };

  await storage.set(KEY_APPLICANT(record.id), record);
  await storage.set(KEY_EMAIL_LOOKUP(email), record.id);
  await storage.setAdd(KEY_INDEX, record.id);
  return record;
}

/** Get a single applicant by id, or null if not found. */
export async function getApplicantById(
  id: string,
): Promise<ApplicantRecord | null> {
  if (!id) return null;
  return getStorage().get<ApplicantRecord>(KEY_APPLICANT(id));
}

/** Get a single applicant by email, or null if not found. */
export async function getApplicantByEmail(
  email: string,
): Promise<ApplicantRecord | null> {
  const target = normalizeEmail(email);
  if (!target) return null;
  const storage = getStorage();
  const id = await storage.get<string>(KEY_EMAIL_LOOKUP(target));
  if (!id) return null;
  return storage.get<ApplicantRecord>(KEY_APPLICANT(id));
}

/** Return every applicant record (any status). Newest-first. */
export async function listApplicants(): Promise<ApplicantRecord[]> {
  const storage = getStorage();
  const ids = await storage.setMembers(KEY_INDEX);
  if (ids.length === 0) return [];
  const records: ApplicantRecord[] = [];
  for (const id of ids) {
    const rec = await storage.get<ApplicantRecord>(KEY_APPLICANT(id));
    if (rec) records.push(rec);
  }
  return records.sort((a, b) => b.signupDate.localeCompare(a.signupDate));
}

/**
 * Approve an applicant. Sets status to 'approved' and stamps approvedDate.
 * No-op if already approved. Returns the updated record (or null if id
 * doesn't exist).
 */
export async function approveApplicant(
  id: string,
): Promise<ApplicantRecord | null> {
  const storage = getStorage();
  const record = await storage.get<ApplicantRecord>(KEY_APPLICANT(id));
  if (!record) return null;
  if (record.status === 'approved') return record;
  record.status = 'approved';
  record.approvedDate = new Date().toISOString();
  await storage.set(KEY_APPLICANT(id), record);
  return record;
}

/**
 * Reject an applicant. Sets status to 'rejected'. Does NOT email the
 * applicant — rejected applicants are simply moved to a separate list in
 * the admin view. Returns the updated record (or null if id missing).
 */
export async function rejectApplicant(
  id: string,
): Promise<ApplicantRecord | null> {
  const storage = getStorage();
  const record = await storage.get<ApplicantRecord>(KEY_APPLICANT(id));
  if (!record) return null;
  if (record.status === 'rejected') return record;
  record.status = 'rejected';
  await storage.set(KEY_APPLICANT(id), record);
  return record;
}

/**
 * Set Howard's personal notes on an applicant. Empty string clears them.
 * Returns the updated record (or null if id missing).
 */
export async function setApplicantNotes(
  id: string,
  notes: string,
): Promise<ApplicantRecord | null> {
  const storage = getStorage();
  const record = await storage.get<ApplicantRecord>(KEY_APPLICANT(id));
  if (!record) return null;
  const trimmed = (notes ?? '').trim();
  record.notes = trimmed.length > 0 ? trimmed : undefined;
  await storage.set(KEY_APPLICANT(id), record);
  return record;
}

/**
 * Mark the 14-day feedback reminder as sent for an applicant. Idempotent on
 * the timestamp — calling twice keeps the first send-date.
 */
export async function markFeedbackReminderSent(
  id: string,
): Promise<ApplicantRecord | null> {
  const storage = getStorage();
  const record = await storage.get<ApplicantRecord>(KEY_APPLICANT(id));
  if (!record) return null;
  if (record.feedbackReminderSentAt) return record;
  record.feedbackReminderSentAt = new Date().toISOString();
  await storage.set(KEY_APPLICANT(id), record);
  return record;
}

/**
 * Return the emails of every approved applicant — used by allowlist.ts to
 * extend the static INVITE_ALLOWLIST env var with dynamically-approved
 * users. Lowercased + deduped.
 */
export async function getApprovedApplicantEmails(): Promise<string[]> {
  const records = await listApplicants();
  const set = new Set<string>();
  for (const r of records) {
    if (r.status === 'approved') {
      const e = normalizeEmail(r.email);
      if (e) set.add(e);
    }
  }
  return Array.from(set);
}

/**
 * Delete the applicant record tied to an email address (if any).
 *
 * Used by the in-app "Delete Account" flow so that when a user erases their
 * account we also erase the durable beta-applicant record we hold for them.
 * Best-effort and idempotent: returns true if a record was found + removed,
 * false if there was nothing to delete.
 */
export async function deleteApplicantByEmail(email: string): Promise<boolean> {
  const target = normalizeEmail(email);
  if (!target) return false;
  const storage = getStorage();
  const id = await storage.get<string>(KEY_EMAIL_LOOKUP(target));
  if (!id) return false;
  await storage.delete(KEY_APPLICANT(id));
  await storage.delete(KEY_EMAIL_LOOKUP(target));
  await storage.setRemove(KEY_INDEX, id);
  return true;
}

/** Test-only: blow away every applicant record + index. */
export async function _resetApplicantStoreForTest(): Promise<void> {
  const storage = getStorage();
  const ids = await storage.setMembers(KEY_INDEX);
  for (const id of ids) {
    const rec = await storage.get<ApplicantRecord>(KEY_APPLICANT(id));
    if (rec) {
      await storage.delete(KEY_EMAIL_LOOKUP(normalizeEmail(rec.email)));
    }
    await storage.delete(KEY_APPLICANT(id));
    await storage.setRemove(KEY_INDEX, id);
  }
}
