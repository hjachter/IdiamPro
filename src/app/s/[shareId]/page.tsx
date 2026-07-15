/**
 * Public, read-only view of a published outline snapshot: `/s/<shareId>`.
 *
 * Hosted entirely on OUR OWN infrastructure — no third party. Requires no
 * login to view (it's a public share link). Unknown or revoked ids render a
 * clean "no longer shared" page rather than crashing.
 *
 * XSS containment: the stored page is rendered inside a SANDBOXED iframe with
 * NO `allow-scripts` and NO `allow-same-origin`. That means any script in the
 * snapshot (whether from our template or maliciously crafted) simply cannot
 * run, and the framed document is treated as an opaque origin that can never
 * touch our cookies or DOM. This is belt-and-suspenders on top of the
 * content sanitization done at publish time.
 */

import type { Metadata } from 'next';
import { getShare } from '@/lib/sharing/share-store';

export const dynamic = 'force-dynamic';

type Params = Promise<{ shareId: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { shareId } = await Promise.resolve(params);
  const doc = await getShare(shareId);
  return {
    title: doc ? doc.title : 'Shared page not found',
    robots: { index: false, follow: false },
  };
}

function NotShared() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem',
        background: '#0f172a',
        color: '#e2e8f0',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔒</div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
        This page is no longer shared
      </h1>
      <p style={{ maxWidth: 420, opacity: 0.8, lineHeight: 1.5 }}>
        The link may have been unpublished by its owner, or it never existed.
        Ask whoever sent it to you for an updated link.
      </p>
      <a
        href="/"
        style={{
          marginTop: '1.5rem',
          color: '#818cf8',
          textDecoration: 'none',
          fontWeight: 500,
        }}
      >
        Learn about IdiamPro →
      </a>
    </div>
  );
}

export default async function SharePage({ params }: { params: Params }) {
  const { shareId } = await Promise.resolve(params);
  const doc = await getShare(shareId);

  if (!doc) {
    return <NotShared />;
  }

  return (
    <iframe
      title={doc.title}
      srcDoc={doc.html}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 'none',
        background: '#ffffff',
      }}
    />
  );
}
