/**
 * Sentry client (browser) config for IdiamPro / SecondBrainWare.
 *
 * Runs in the user's browser (web build on Vercel and the renderer process
 * inside Electron when it loads the deployed web app). Captures unhandled
 * exceptions and unhandled promise rejections. Reports nothing on localhost
 * to keep development noise out of the project.
 *
 * DSN comes from the SENTRY_DSN env var (exposed via NEXT_PUBLIC_SENTRY_DSN
 * for client-side). The user provisions the real DSN later in Vercel /
 * .env.local — see CLAUDE.md.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Don't report development noise.
    enabled:
      process.env.NODE_ENV !== 'development' &&
      (typeof window === 'undefined' ||
        (window.location.hostname !== 'localhost' &&
          window.location.hostname !== '127.0.0.1')),
  });
}
