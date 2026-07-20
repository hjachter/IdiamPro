import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { isAdminUser } from '@/lib/access/admin';

export const metadata: Metadata = {
  title: 'Admin — IdeaM',
  description: 'Internal admin tools for IdeaM.',
  robots: { index: false, follow: false },
};

/**
 * Never statically cache the admin section: the server-side admin gate below
 * must run on every request so a stale prerender can never leak access.
 */
export const dynamic = 'force-dynamic';

/**
 * Admin section layout.
 *
 * SERVER-ENFORCED GATE: every /admin/* page passes through here. We check
 * `isAdminUser()` on the server (a signed-in Clerk user whose email is on
 * the ADMIN_EMAILS allowlist). Non-admins are redirected to /signin — there
 * is no client flag to flip. In local dev (Clerk not configured) the check
 * passes so admin surfaces stay usable, matching the rest of the app's
 * env-gated stub behavior.
 *
 * DISTINCT LOOK: a persistent amber "ADMIN CONSOLE" bar sits above every
 * admin page so this internal tooling can never be confused with the live
 * green/emerald app. Amber is reserved for admin; the main app uses green.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await isAdminUser();
  if (!admin) {
    redirect('/signin?redirect_url=/admin');
  }

  return (
    // The root <html>/<body> are locked to `h-full overflow-hidden` for the
    // outline editor (which manages its own scroll). Every other page must
    // therefore supply its own scroll container, or tall content is clipped
    // and unreachable. This admin shell is that scroll container: it fills the
    // locked viewport (`h-full`) and scrolls vertically (`overflow-y-auto`),
    // with momentum/touch scrolling on iOS/iPad via Capacitor. The sticky
    // banner below sticks to THIS container, so it stays pinned while the
    // page scrolls.
    <div
      className="h-full overflow-y-auto overflow-x-hidden bg-background"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Persistent amber admin banner — visible on every admin page. */}
      <div className="sticky top-0 z-50 border-b border-amber-500/40 bg-amber-500 text-amber-950 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 sm:px-6">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-widest sm:text-sm">
            Admin Console
          </span>
          <span className="ml-auto truncate text-[11px] font-medium text-amber-900/80 sm:text-xs">
            Internal · restricted access
          </span>
        </div>
      </div>
      {/* Amber accent rail keeps the admin theme distinct from the app. */}
      <div className="border-t-2 border-amber-500/60">{children}</div>
    </div>
  );
}
