/**
 * Applicant store — file-based JSON record of every beta applicant.
 *
 * IdiamPro's beta is invite-only: prospective users submit an application
 * at /signup, Howard reviews each one in the /admin/applicants dashboard,
 * and the act of clicking "Approve" both adds the email to the allowlist
 * AND triggers a welcome email. This module is the durable storage layer.
 *
 * v1 storage: a JSON file written atomically (write to .tmp, then rename),
 * keyed by applicant id. Same pattern as src/lib/email/unsubscribe-store.ts
 * — proven, zero new dependencies, swappable to a real DB later without
 * touching any caller (every caller talks to the exported functions).
 *
 * Storage location:
 *   - Set IDIAMPRO_APPLICANT_STORE_PATH to an absolute path to override.
 *   - Default: `.idiampro/applicants.json` under the process cwd.
 *
 * The allowlist (src/lib/access/allowlist.ts) is still the single source
 * of truth for "is this email allowed to sign up?". When Howard approves
 * an applicant, two things happen: we set the record's status to "approved"
 * here, AND we add the email to the dynamic allowlist (allowlist.ts learns
 * about approved emails via getApprovedApplicantEmails()).
 */

import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

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
}

interface ApplicantFile {
  version: 1;
  records: Record<string, ApplicantRecord>;
}

const FILE_VERSION = 1;

function resolveStorePath(): string {
  const override = (process.env.IDIAMPRO_APPLICANT_STORE_PATH ?? '').trim();
  if (override.length > 0) return override;
  return join(process.cwd(), '.idiampro', 'applicants.json');
}

function normalizeEmail(email: string): string {
  return (email ?? '').trim().toLowerCase();
}

async function readFileSafe(path: string): Promise<ApplicantFile> {
  try {
    const raw = await fs.readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as ApplicantFile;
    if (parsed && parsed.version === FILE_VERSION && parsed.records) {
      return parsed;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      // eslint-disable-next-line no-console
      console.warn(
        '[applicant-store] could not read existing store, starting fresh:',
        err,
      );
    }
  }
  return { version: FILE_VERSION, records: {} };
}

async function writeFileAtomic(
  path: string,
  data: ApplicantFile,
): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, path);
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

  const path = resolveStorePath();
  const file = await readFileSafe(path);

  // Dedupe by email — if we already have a record for this address, return it
  // rather than creating a parallel pending entry.
  for (const existing of Object.values(file.records)) {
    if (normalizeEmail(existing.email) === email) {
      return existing;
    }
  }

  const record: ApplicantRecord = {
    id: randomUUID(),
    name,
    email,
    signupDate: new Date().toISOString(),
    status: 'pending',
    reason: args.reason && args.reason.trim().length > 0 ? args.reason.trim() : undefined,
    ip: args.ip && args.ip.trim().length > 0 ? args.ip.trim() : undefined,
    referrer: args.referrer && args.referrer.trim().length > 0 ? args.referrer.trim() : undefined,
  };

  file.records[record.id] = record;
  await writeFileAtomic(path, file);
  return record;
}

/** Get a single applicant by id, or null if not found. */
export async function getApplicantById(
  id: string,
): Promise<ApplicantRecord | null> {
  if (!id) return null;
  const file = await readFileSafe(resolveStorePath());
  return file.records[id] ?? null;
}

/** Get a single applicant by email, or null if not found. */
export async function getApplicantByEmail(
  email: string,
): Promise<ApplicantRecord | null> {
  const target = normalizeEmail(email);
  if (!target) return null;
  const file = await readFileSafe(resolveStorePath());
  for (const r of Object.values(file.records)) {
    if (normalizeEmail(r.email) === target) return r;
  }
  return null;
}

/** Return every applicant record (any status). Newest-first. */
export async function listApplicants(): Promise<ApplicantRecord[]> {
  const file = await readFileSafe(resolveStorePath());
  return Object.values(file.records).sort((a, b) =>
    b.signupDate.localeCompare(a.signupDate),
  );
}

/**
 * Approve an applicant. Sets status to 'approved' and stamps approvedDate.
 * No-op if already approved. Returns the updated record (or null if id
 * doesn't exist).
 */
export async function approveApplicant(
  id: string,
): Promise<ApplicantRecord | null> {
  const path = resolveStorePath();
  const file = await readFileSafe(path);
  const record = file.records[id];
  if (!record) return null;
  if (record.status === 'approved') return record;
  record.status = 'approved';
  record.approvedDate = new Date().toISOString();
  file.records[id] = record;
  await writeFileAtomic(path, file);
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
  const path = resolveStorePath();
  const file = await readFileSafe(path);
  const record = file.records[id];
  if (!record) return null;
  if (record.status === 'rejected') return record;
  record.status = 'rejected';
  file.records[id] = record;
  await writeFileAtomic(path, file);
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
  const path = resolveStorePath();
  const file = await readFileSafe(path);
  const record = file.records[id];
  if (!record) return null;
  const trimmed = (notes ?? '').trim();
  record.notes = trimmed.length > 0 ? trimmed : undefined;
  file.records[id] = record;
  await writeFileAtomic(path, file);
  return record;
}

/**
 * Return the emails of every approved applicant — used by allowlist.ts to
 * extend the static INVITE_ALLOWLIST env var with dynamically-approved
 * users. Lowercased + deduped.
 */
export async function getApprovedApplicantEmails(): Promise<string[]> {
  const file = await readFileSafe(resolveStorePath());
  const set = new Set<string>();
  for (const r of Object.values(file.records)) {
    if (r.status === 'approved') {
      const e = normalizeEmail(r.email);
      if (e) set.add(e);
    }
  }
  return Array.from(set);
}

/** Test-only: blow away the store. */
export async function _resetApplicantStoreForTest(): Promise<void> {
  const path = resolveStorePath();
  try {
    await fs.unlink(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
