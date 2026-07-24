'use client';

/**
 * Admin-only "Internal" convenience link for the marketing chrome.
 *
 * Renders a small link to the internal /admin index — but ONLY for a visitor
 * whose own server session is on the ADMIN_EMAILS allowlist. It asks the
 * server (`GET /api/admin/is-admin`, which decides via `isAdminUser()`) and
 * shows nothing until/unless that returns true. Signed-out and non-admin
 * visitors never see it.
 *
 * SECURITY NOTE: this is convenience only, not a security boundary. Even if a
 * non-admin forced this link to render, the /admin layout and every admin API
 * route independently enforce `isAdminUser()` server-side, so hidden pages
 * stay locked. We deliberately do NOT trust any client localStorage flag.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';

export function AdminNavLink({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/is-admin', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { isAdmin: false }))
      .then((data: { isAdmin?: boolean }) => {
        if (!cancelled) setIsAdmin(Boolean(data?.isAdmin));
      })
      .catch(() => {
        /* non-admin / offline → stay hidden */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAdmin) return null;

  return (
    <Link
      href="/admin"
      onClick={onClick}
      title="Internal / developer tools — admins only"
      className={
        className ??
        'inline-flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 transition-colors'
      }
    >
      <Lock className="w-3.5 h-3.5" aria-hidden="true" />
      Internal
    </Link>
  );
}
