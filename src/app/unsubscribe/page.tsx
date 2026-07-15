/**
 * Public unsubscribe page.
 *
 * Links in every onboarding email point here with `?u=<userId>&t=<token>`.
 * The page is a Server Component: it verifies the token + flips the
 * unsubscribe flag on the server, then renders a friendly confirmation.
 * No client-side state, no JavaScript needed — the action happens during
 * render so the user sees the result on the first paint.
 *
 * If the token is missing or invalid, we still render a friendly page
 * (never raw error text) and tell the user to try the link from their
 * email again. We never leak which user id was attempted.
 */

import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token';
import { markUnsubscribed, isUnsubscribed } from '@/lib/email/unsubscribe-store';

// Force dynamic rendering so each visit re-evaluates the params.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PageProps {
  searchParams: Promise<{ u?: string; t?: string }>;
}

type Result =
  | { kind: 'success'; alreadyUnsubbed: boolean }
  | { kind: 'invalid' }
  | { kind: 'missing' };

async function processUnsubscribe(u: string, t: string): Promise<Result> {
  if (!u || !t) return { kind: 'missing' };
  if (!verifyUnsubscribeToken(u, t)) return { kind: 'invalid' };
  const already = await isUnsubscribed(u);
  if (!already) {
    await markUnsubscribed(u);
  }
  return { kind: 'success', alreadyUnsubbed: already };
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const u = (params.u ?? '').trim();
  const t = (params.t ?? '').trim();
  const result = await processUnsubscribe(u, t);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F3F4F6',
        padding: '24px',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
        color: '#111827',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '32px',
          textAlign: 'center',
        }}
      >
        <div style={{ color: '#007AFF', fontWeight: 700, fontSize: '20px', marginBottom: '16px' }}>
          IDMPro
        </div>

        {result.kind === 'success' && !result.alreadyUnsubbed && (
          <>
            <h1 style={{ fontSize: '22px', margin: '0 0 12px' }}>You&rsquo;re unsubscribed</h1>
            <p style={{ margin: 0, color: '#374151', lineHeight: 1.6 }}>
              We won&rsquo;t send you any more onboarding emails. You can keep using IDMPro the same as
              before &mdash; this only affects the welcome series.
            </p>
          </>
        )}

        {result.kind === 'success' && result.alreadyUnsubbed && (
          <>
            <h1 style={{ fontSize: '22px', margin: '0 0 12px' }}>You&rsquo;re already unsubscribed</h1>
            <p style={{ margin: 0, color: '#374151', lineHeight: 1.6 }}>
              No further onboarding emails will go out. Nothing else to do.
            </p>
          </>
        )}

        {result.kind === 'invalid' && (
          <>
            <h1 style={{ fontSize: '22px', margin: '0 0 12px' }}>This link didn&rsquo;t check out</h1>
            <p style={{ margin: 0, color: '#374151', lineHeight: 1.6 }}>
              The unsubscribe link looks like it&rsquo;s been edited or has expired. Try opening the
              original link from the email again. If that still doesn&rsquo;t work, reply to any
              IDMPro email and we&rsquo;ll take you off the list by hand.
            </p>
          </>
        )}

        {result.kind === 'missing' && (
          <>
            <h1 style={{ fontSize: '22px', margin: '0 0 12px' }}>Open this link from your email</h1>
            <p style={{ margin: 0, color: '#374151', lineHeight: 1.6 }}>
              This page only works when opened from the unsubscribe link in one of our emails.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
