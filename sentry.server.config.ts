/**
 * Sentry server config for IdiamPro / SecondBrainWare.
 *
 * Runs in the Next.js Node.js server runtime (API routes, RSC, middleware
 * not on the edge). Captures unhandled exceptions and promise rejections.
 * Reports nothing in development to keep the project clean.
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
