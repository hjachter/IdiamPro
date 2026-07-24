/**
 * "Is the current visitor an admin?" probe for client chrome.
 *
 * GET → { isAdmin: boolean }, decided ENTIRELY on the server via
 * `isAdminUser()` (a signed-in Clerk user whose email is on the ADMIN_EMAILS
 * allowlist — see src/lib/access/admin.ts). Unlike the other /api/admin/*
 * routes this does NOT use requireAdmin(): a non-admin (or signed-out) caller
 * gets a clean `{ isAdmin: false }` rather than a 401, so client UI can simply
 * hide the convenience "Internal" link without any error handling.
 *
 * This endpoint only reveals a single boolean about the caller's own session
 * — it exposes no admin data — so it is safe to leave un-gated. The real
 * security boundary stays server-side: the /admin layout and every admin API
 * route enforce `isAdminUser()` independently. This link is convenience only.
 *
 * Dev/stub (Clerk not configured): `isAdminUser()` returns true, so the link
 * shows locally, matching the rest of the app's env-gated stub behavior.
 */

import { NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/access/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const isAdmin = await isAdminUser();
  return NextResponse.json(
    { isAdmin },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
