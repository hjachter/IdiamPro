/**
 * Account deletion endpoint — Apple App Store guideline 5.1.1(v) compliance.
 *
 * Apps that let users create an account MUST let them delete that account
 * (and its associated data) from inside the app. This route is the
 * server-side half of that flow:
 *
 *   1. Authenticate the caller via Clerk (server-side). We only ever act on
 *      the *currently signed-in* user's own id — a caller can never delete
 *      someone else's account.
 *   2. Best-effort delete every server-side record we hold that's tied to
 *      that user: their beta-applicant record (by email), their feedback
 *      (by user id), and their bug reports (by user id + email).
 *   3. Delete the Clerk account itself via Clerk's REST API. Once this
 *      succeeds the user is fully gone from our identity provider.
 *
 * The client (Settings → Delete Account) calls this route, then also clears
 * all local device data and signs out. See settings-dialog.tsx.
 *
 * Stub-safe: with auth disabled (no Clerk key) there is no account to
 * delete, so this returns a friendly "nothing to do" result instead of
 * erroring. The client still clears local data in that case.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthEnabled } from '@/lib/auth/auth-config';
import { deleteApplicantByEmail } from '@/lib/access/applicant-store';
import { deleteFeedbackByUserId } from '@/lib/access/feedback-store';
import { deleteBugsByUser } from '@/lib/access/bug-store';

// Node runtime — the stores may touch fs in the file-backed dev backend.
export const runtime = 'nodejs';

interface AuthIdentity {
  userId: string | null;
  email: string | null;
}

/** Resolve the currently signed-in Clerk user (id + primary email). */
async function resolveSignedInUser(): Promise<AuthIdentity> {
  if (!isAuthEnabled()) return { userId: null, email: null };
  try {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const clerkServer = require('@clerk/nextjs/server') as {
      auth?: () => Promise<{ userId?: string | null }> | { userId?: string | null };
      clerkClient?: () => Promise<{
        users: {
          getUser: (id: string) => Promise<{
            emailAddresses?: Array<{ emailAddress?: string }>;
          }>;
        };
      }>;
    };
    /* eslint-enable @typescript-eslint/no-var-requires */
    if (!clerkServer.auth) return { userId: null, email: null };
    const session = await Promise.resolve(clerkServer.auth());
    const userId = session.userId ?? null;
    if (!userId) return { userId: null, email: null };
    if (!clerkServer.clerkClient) return { userId, email: null };
    const client = await clerkServer.clerkClient();
    const user = await client.users.getUser(userId);
    const primary = user.emailAddresses?.find((e) => Boolean(e.emailAddress));
    return { userId, email: primary?.emailAddress ?? null };
  } catch {
    return { userId: null, email: null };
  }
}

/**
 * Delete the Clerk account via REST. A single authenticated fetch — no SDK
 * needed. Returns whether the account was actually removed.
 */
async function deleteClerkAccount(
  userId: string,
): Promise<{ ok: boolean; status: number; body?: string }> {
  const apiKey = (process.env.CLERK_SECRET_KEY ?? '').trim();
  if (apiKey.length === 0) {
    return { ok: false, status: 0, body: 'no-clerk-secret' };
  }
  try {
    const res = await fetch(
      `https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (res.ok) return { ok: true, status: res.status };
    const body = await res.text().catch(() => '');
    return { ok: false, status: res.status, body: body.slice(0, 200) };
  } catch (err) {
    return { ok: false, status: 0, body: String((err as Error)?.message ?? err) };
  }
}

export async function POST(_request: NextRequest) {
  // Auth disabled (no Clerk): nothing server-side to delete. The client
  // still wipes local data — report success so the UX flows cleanly.
  if (!isAuthEnabled()) {
    return NextResponse.json({
      ok: true,
      authEnabled: false,
      note: 'No server account to delete; local data handled on the client.',
    });
  }

  const { userId, email } = await resolveSignedInUser();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'not-signed-in' },
      { status: 401 },
    );
  }

  // 1. Erase server-side records tied to this user. Best-effort: a failure
  //    on any one store must not prevent the Clerk account deletion.
  const serverRecords = { applicant: false, feedback: false, bugs: 0 };
  try {
    if (email) serverRecords.applicant = await deleteApplicantByEmail(email);
  } catch (err) {
    console.error('[account-delete] applicant delete failed:', err);
  }
  try {
    serverRecords.feedback = await deleteFeedbackByUserId(userId);
  } catch (err) {
    console.error('[account-delete] feedback delete failed:', err);
  }
  try {
    serverRecords.bugs = await deleteBugsByUser({ userId, email });
  } catch (err) {
    console.error('[account-delete] bug delete failed:', err);
  }

  // 2. Delete the Clerk identity itself.
  const clerk = await deleteClerkAccount(userId);
  if (!clerk.ok) {
    console.error(
      `[account-delete] Clerk delete failed for ${userId}: status=${clerk.status} body=${clerk.body ?? ''}`,
    );
    return NextResponse.json(
      {
        ok: false,
        error: 'clerk-delete-failed',
        detail: clerk.body ?? `status ${clerk.status}`,
        serverRecords,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, deleted: true, serverRecords });
}
