/**
 * /app layout — SERVER-ENFORCED beta-approval gate.
 *
 * This is the real gate for the invite-only beta. It runs on the SERVER on
 * every request (force-dynamic, mirroring the /admin gate), so a signed-in
 * but UNAPPROVED account can no longer reach the outliner by disabling the
 * client gate:
 *
 *   - signed-out (auth on)          → redirect to /signin
 *   - signed-in but NOT approved    → redirect to /waiting
 *   - signed-in AND approved        → render the app
 *   - dev / stub (Clerk not set up) → render the app unchanged
 *
 * `AppGate` (the client component) stays wrapped inside as a nice UX layer —
 * it shows the quiet loading spinner and the same routing on the client — but
 * it is NO LONGER the security boundary. The server decision above is.
 *
 * Approval source: `resolveApproval()` → `isEmailAllowedAsync()`, the exact
 * same allowlist (INVITE_ALLOWLIST env var + Howard-approved applicants) the
 * client gate already used. No new source of truth.
 */

import { redirect } from 'next/navigation';
import AppGate from '@/components/app-gate';
import { resolveApproval } from '@/lib/access/approval-guard';

/**
 * Never statically cache /app: the server approval gate below must run on
 * every request so a stale prerender can never leak access to an unapproved
 * account. Same reasoning as the /admin layout.
 */
export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state } = await resolveApproval();

  // Auth ON and no session — send to sign-in. (The middleware auth-wall
  // normally catches this first; this is a defense-in-depth backstop.)
  if (state === 'signed-out') {
    redirect('/signin?redirect_url=/app');
  }

  // Auth ON, signed in, but not on the allowlist — the friendly waiting page.
  if (state === 'unapproved') {
    redirect('/waiting');
  }

  // 'approved' or 'stub' (dev) → render. AppGate remains as the client UX layer.
  return <AppGate>{children}</AppGate>;
}
