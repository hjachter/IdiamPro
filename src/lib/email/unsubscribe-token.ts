/**
 * Unsubscribe URL signing.
 *
 * A user-facing unsubscribe URL embeds the userId so the unsubscribe page
 * knows who to remove from future sends. We sign that userId with an HMAC
 * so a malicious actor can't generate unsubscribe URLs for other users
 * just by guessing user ids.
 *
 * The signing key is read from EMAIL_UNSUBSCRIBE_SECRET. If unset, we fall
 * back to a deterministic-but-weak literal so dev/local works out of the
 * box. Production MUST set this env var (warned at runtime via console).
 *
 * URL shape: /unsubscribe?u=<userId>&t=<hexHmac>
 *
 * This is intentionally lightweight — not a JWT, no expiry, no payload
 * encryption. An unsubscribe link is "I no longer want emails from you";
 * if a malicious actor unsubscribes a user, the user can simply re-opt-in
 * by signing in. The cost of getting it wrong is low; the cost of dragging
 * in a JWT library is not.
 */

import { createHmac, timingSafeEqual } from 'crypto';

const DEV_FALLBACK_SECRET = 'idiampro-dev-unsubscribe-secret-do-not-use-in-prod';

function getSecret(): string {
  const fromEnv = (process.env.EMAIL_UNSUBSCRIBE_SECRET ?? '').trim();
  if (fromEnv.length > 0) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    // Warn once per process — production must configure this.
    console.warn(
      '[email/unsubscribe-token] EMAIL_UNSUBSCRIBE_SECRET is not set; using insecure dev fallback. Set this in your environment.',
    );
  }
  return DEV_FALLBACK_SECRET;
}

/** Compute the unsubscribe token for a given user id. */
export function signUnsubscribeToken(userId: string): string {
  const h = createHmac('sha256', getSecret());
  h.update(`unsubscribe:${userId}`);
  return h.digest('hex');
}

/** Constant-time verify of an unsubscribe token. */
export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  try {
    const expected = signUnsubscribeToken(userId);
    if (expected.length !== token.length) return false;
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Build a fully-qualified unsubscribe URL.
 *
 * @param baseUrl - The site origin, e.g. "https://2ndbrainware.com".
 *                  Falls back to NEXT_PUBLIC_APP_URL, then a sensible default.
 */
export function buildUnsubscribeUrl(userId: string, baseUrl?: string): string {
  const base =
    (baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://2ndbrainware.com').replace(
      /\/$/,
      '',
    );
  const token = signUnsubscribeToken(userId);
  return `${base}/unsubscribe?u=${encodeURIComponent(userId)}&t=${token}`;
}
