'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Mail } from 'lucide-react';

/**
 * Invite management — stub for v1.1.
 *
 * V1 stores the allowlist in the INVITE_ALLOWLIST env var (comma-separated
 * emails). Editing requires a Vercel redeploy. This page is the extension
 * point for v1.1 when we add a database-backed allowlist + a real form
 * here for adding / removing emails without a redeploy.
 *
 * Access is enforced server-side by the /admin layout (a signed-in Clerk
 * user on the ADMIN_EMAILS allowlist) — there is no client flag to flip.
 */
export default function AdminInvitesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-500/30">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Invite management
              </h1>
              <p className="text-muted-foreground mt-1">
                Curate who can sign up for the invite-only beta.
              </p>
            </div>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Coming in v1.1</CardTitle>
            <CardDescription>
              A self-service dashboard for adding and removing approved emails
              ships in the next iteration.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p>
              For now, the allowlist lives in the{' '}
              <code className="text-xs px-1.5 py-0.5 rounded bg-muted">
                INVITE_ALLOWLIST
              </code>{' '}
              environment variable. To approve a new tester:
            </p>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Open the Vercel project settings.</li>
              <li>
                Edit the{' '}
                <code className="text-xs px-1.5 py-0.5 rounded bg-muted">
                  INVITE_ALLOWLIST
                </code>{' '}
                value (comma-separated emails, exact match,
                case-insensitive).
              </li>
              <li>Redeploy.</li>
              <li>Share the signup link with the new tester.</li>
            </ol>
            <p>
              Leaving the variable blank disables the gate entirely (everyone
              allowed). This matches the rest of IdeaM&apos;s stub-safe env
              pattern.
            </p>
          </CardContent>
        </Card>

        <footer className="mt-12 text-xs text-muted-foreground">
          v1 admin dashboard. Restricted to internal use. The data layer
          (isEmailAllowed / getAllowedEmails) already abstracts the storage
          so v1.1 can swap env-var reads for database reads without changing
          callers.
        </footer>
      </div>
    </div>
  );
}
