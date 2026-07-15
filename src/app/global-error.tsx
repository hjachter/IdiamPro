'use client';

/**
 * Top-level Next.js error boundary — catches errors that propagate ALL the way
 * up to and including the root layout. Must include its own <html>/<body> tags
 * because it replaces the entire document when it fires.
 *
 * Without this file, a crash at the root layout level would show the Next.js
 * default crash overlay (in dev) or a generic browser error (in prod). With
 * this file, the user always sees a friendly recovery screen.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', backgroundColor: '#0a0a0a', color: '#f4f4f5', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '480px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: '1rem', color: '#a1a1aa', marginBottom: '2rem', lineHeight: 1.5 }}>
              IdiamPro hit an unexpected error and couldn't recover. Your outlines are safe — they're stored locally. You can try again, or reload the app.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => reset()}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}
              >
                Try again
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: 'transparent', color: '#f4f4f5', border: '1px solid #3f3f46', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}
              >
                Go to homepage
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '2rem' }}>
              If this keeps happening, email <a href="mailto:support@2ndbrainware.com" style={{ color: '#a78bfa' }}>support@2ndbrainware.com</a> with what you were doing when it crashed.
            </p>
            {error?.digest && (
              <p style={{ fontSize: '0.625rem', color: '#52525b', marginTop: '1rem', fontFamily: 'monospace' }}>
                Reference: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
