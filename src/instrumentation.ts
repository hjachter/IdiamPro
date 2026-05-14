/**
 * Next.js instrumentation hook — initializes Sentry on the server runtimes.
 *
 * The `register` function runs once when the Next.js server boots. We
 * conditionally import the matching Sentry runtime config based on
 * NEXT_RUNTIME so that Node.js builds don't accidentally pull in edge code
 * and vice versa. Browser/client init is handled separately by
 * `sentry.client.config.ts`.
 *
 * DSN comes from the SENTRY_DSN env var — see CLAUDE.md.
 */
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

// Captures errors thrown from nested React Server Components.
export const onRequestError = Sentry.captureRequestError;
