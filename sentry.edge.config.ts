/**
 * Sentry edge config for IdiamPro / SecondBrainWare.
 *
 * Runs in the Next.js edge runtime (edge middleware, edge route handlers).
 * Captures unhandled exceptions there. Reports nothing in development.
 *
 * DSN comes from the SENTRY_DSN env var — see CLAUDE.md.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

if (dsn && process.env.NODE_ENV !== 'development') {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
