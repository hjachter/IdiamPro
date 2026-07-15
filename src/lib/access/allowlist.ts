/**
 * Invite allowlist — gates signup to a Howard-curated list of emails.
 *
 * IDMPro is in invite-only beta. Only emails Howard has explicitly
 * approved may complete signup. This module is the single source of
 * truth for "is this email allowed to sign up?", used by both the
 * pre-signup UX check (server action) and the post-signup Clerk webhook
 * (defense-in-depth).
 *
 * Two layered sources:
 *
 *   1. INVITE_ALLOWLIST env var (comma-separated emails) — Howard's
 *      hard-coded list, edited in Vercel project settings. Useful for
 *      pre-seeding addresses (his own, founding testers) before the
 *      applicant flow exists.
 *
 *   2. The applicant store (src/lib/access/applicant-store.ts) — every
 *      person Howard has clicked "Approve" on in /admin/applicants. This
 *      is the day-to-day source as the beta opens up.
 *
 * The two combine via getAllowedEmailsAsync() / isEmailAllowedAsync().
 * The legacy synchronous helpers (isEmailAllowed / getAllowedEmails)
 * still exist and read only the env-var layer — kept for compatibility
 * with any synchronous call site (none today, but cheap to preserve).
 *
 * Stub-safe: if INVITE_ALLOWLIST is unset AND there are no approved
 * applicants, the allowlist check is bypassed (everyone is allowed).
 * This matches the rest of IDMPro's env-gated layers (Sentry, Clerk,
 * Stripe, Resend) — zero runtime overhead and identical-to-today
 * behavior until Howard sets the env var or approves anyone.
 *
 * Matching is exact + case-insensitive on the full email. No wildcards
 * and no domain-level matching: those would let in random employees at
 * a partner company. If Howard ever needs broader rules, add them to
 * this helper and every consumer picks them up automatically.
 */

import { getApprovedApplicantEmails } from './applicant-store';

/** Normalize an email for comparison: trim + lowercase. */
function normalize(email: string): string {
  return (email ?? '').trim().toLowerCase();
}

let warnedAboutStub = false;

/**
 * Return the parsed allowlist (lowercased, trimmed, empties dropped).
 *
 * V1.1 extension point: replace the env-var read here with a database
 * fetch when the /admin/invites dashboard ships. Call sites stay
 * unchanged.
 */
export function getAllowedEmails(): string[] {
  const raw = (process.env.INVITE_ALLOWLIST ?? '').trim();
  if (raw.length === 0) return [];
  return raw
    .split(',')
    .map((s) => normalize(s))
    .filter((s) => s.length > 0 && s.indexOf('@') !== -1);
}

/**
 * True if the given email is allowed to sign up.
 *
 * Returns true (bypass) if the allowlist is empty / unset — this keeps
 * dev and stub deployments fully usable. Logs a single dev warning the
 * first time the bypass fires so it's never silently surprising.
 */
export function isEmailAllowed(email: string): boolean {
  const list = getAllowedEmails();
  if (list.length === 0) {
    if (!warnedAboutStub) {
      warnedAboutStub = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[invite-allowlist] INVITE_ALLOWLIST is not set — allowlist check is bypassed (dev/stub mode). Set INVITE_ALLOWLIST to a comma-separated list of emails to enable.',
      );
    }
    return true;
  }
  const candidate = normalize(email);
  if (candidate.length === 0 || candidate.indexOf('@') === -1) return false;
  return list.includes(candidate);
}

/**
 * Conversational gating message shown to users whose email isn't on the
 * list. Conventional UX (helpful) wins over conventional security (vague)
 * here: IDMPro is in friend-and-family beta, the cost of confirming
 * "your email isn't on the list" is low, and the contact email gives the
 * user a clear next step. If we ever want to harden this (e.g. against
 * email-enumeration attacks once the beta is wider), swap the message in
 * one place.
 */
export const GATE_MESSAGE =
  "IDMPro is in invite-only beta right now. Your email isn't on the invite list yet — drop us a note at hello@2ndbrainware.com and we'll get you in.";

/**
 * Async variant of getAllowedEmails: env-var list PLUS approved applicants
 * from the file store. This is the authoritative source post-applicant-flow.
 *
 * Returns a deduped, lowercased list. Order: env-var entries first, then
 * approved applicants in store order (callers should treat as a set).
 */
export async function getAllowedEmailsAsync(): Promise<string[]> {
  const envList = getAllowedEmails();
  let approved: string[] = [];
  try {
    // RESILIENCE (defense in depth): the applicant store reads Upstash/Vercel
    // KV. When that beta database is dead or stale in production, the read can
    // throw. If that throw escaped here, the whole approval check would fail
    // closed and lock out EVERYONE — including emails that ARE on the
    // INVITE_ALLOWLIST env var (e.g. the founder). A dead beta DB must degrade
    // to "env-var allowlist still works," never "everyone locked out." So on
    // ANY failure we log once and fall back to the env-var list only.
    approved = await getApprovedApplicantEmails();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[invite-allowlist] applicant store unavailable, falling back to INVITE_ALLOWLIST env var only:',
      err,
    );
    approved = [];
  }
  const set = new Set<string>([...envList, ...approved]);
  return Array.from(set);
}

/**
 * Async variant of isEmailAllowed: the authoritative gate that consults
 * BOTH the env-var allowlist AND the approved-applicants store.
 *
 * Returns true (bypass) only if both sources are empty — same stub-safe
 * behavior as the synchronous helper, just with a wider definition of
 * "allowed source has anything in it".
 */
export async function isEmailAllowedAsync(email: string): Promise<boolean> {
  const list = await getAllowedEmailsAsync();
  if (list.length === 0) {
    if (!warnedAboutStub) {
      warnedAboutStub = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[invite-allowlist] No approved emails (INVITE_ALLOWLIST unset and applicant store empty) — allowlist check is bypassed (dev/stub mode).',
      );
    }
    return true;
  }
  const candidate = normalize(email);
  if (candidate.length === 0 || candidate.indexOf('@') === -1) return false;
  return list.includes(candidate);
}

/** Test-only: reset the once-per-process warning flag. */
export function _resetAllowlistWarningForTest(): void {
  warnedAboutStub = false;
}
