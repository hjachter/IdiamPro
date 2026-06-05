/**
 * Email send wrapper — thin layer over the Resend HTTP API.
 *
 * Design notes:
 *
 * 1. NO SDK DEPENDENCY. We hit Resend's REST endpoint directly with fetch.
 *    This keeps the dependency footprint at zero new packages and means
 *    `npm install` is not required for this feature to ship. Swap in the
 *    official `resend` SDK later if we ever need streaming / batch APIs.
 *
 * 2. ENV-GATED. Every send is gated on RESEND_API_KEY being non-empty.
 *    With no key set the functions log "[email/send] Resend not configured
 *    — skipping" and return successfully. This means signup, the webhook,
 *    and the cron job all keep working in dev with zero configuration.
 *
 * 3. UNSUBSCRIBED USERS NEVER GET EMAILED. Every send pulls the user's
 *    unsubscribed flag from the local store before composing the message.
 *    The check happens here (not at each caller) so future callers can't
 *    accidentally bypass it.
 *
 * 4. TEST HOOK. Tests can replace the sender by calling
 *    `_setResendTransportForTest(fn)` with a function that captures the
 *    payload. This avoids needing a real Resend account just to assert
 *    "we attempted to send the welcome email."
 */

import {
  isUnsubscribed,
} from '@/lib/email/unsubscribe-store';
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribe-token';
import { renderWelcomeEmail } from '@/emails/welcome-email';
import { renderDay3FeaturesEmail } from '@/emails/day-3-features';
import { renderDay7TipsEmail } from '@/emails/day-7-tips';
import { renderDay14UpgradeEmail } from '@/emails/day-14-upgrade';

const DEFAULT_FROM = 'IdiamPro <welcome@2ndbrainware.com>';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export interface SendOutcome {
  /** "sent": Resend accepted the payload. */
  /** "skipped-no-key": RESEND_API_KEY missing (dev / not configured). */
  /** "skipped-unsubscribed": user has opted out. */
  /** "skipped-no-recipient": no `to` address. */
  /** "error": Resend rejected the payload or network failed. */
  status: 'sent' | 'skipped-no-key' | 'skipped-unsubscribed' | 'skipped-no-recipient' | 'error';
  /** Resend's message id, only present on status === 'sent'. */
  id?: string;
  /** Human-readable error description, present on status === 'error'. */
  error?: string;
}

export interface ResendTransport {
  (payload: ResendPayload): Promise<SendOutcome>;
}

export interface ResendPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

// Module-level transport so tests can swap it without monkey-patching fetch.
let activeTransport: ResendTransport = realResendTransport;

async function realResendTransport(payload: ResendPayload): Promise<SendOutcome> {
  const apiKey = (process.env.RESEND_API_KEY ?? '').trim();
  if (apiKey.length === 0) {
    console.info('[email/send] Resend not configured — skipping email send.');
    return { status: 'skipped-no-key' };
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        headers: payload.headers ?? {},
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { status: 'error', error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { status: 'sent', id: json.id };
  } catch (err) {
    return { status: 'error', error: String((err as Error)?.message ?? err) };
  }
}

/** Replace the active transport. Test-only. */
export function _setResendTransportForTest(fn: ResendTransport | null): void {
  activeTransport = fn ?? realResendTransport;
}

function getFromAddress(): string {
  const fromEnv = (process.env.EMAIL_FROM ?? '').trim();
  return fromEnv.length > 0 ? fromEnv : DEFAULT_FROM;
}

interface SendArgsBase {
  to: string;
  firstName?: string | null;
  userId: string;
}

/**
 * Shared pre-flight: confirm we have a recipient, confirm the user hasn't
 * unsubscribed, build the unsubscribe URL.
 */
async function preflightOrSkip(args: SendArgsBase): Promise<
  | { skip: SendOutcome }
  | { proceed: { unsubscribeUrl: string } }
> {
  if (!args.to || args.to.indexOf('@') === -1) {
    return { skip: { status: 'skipped-no-recipient' } };
  }
  if (await isUnsubscribed(args.userId)) {
    return { skip: { status: 'skipped-unsubscribed' } };
  }
  return { proceed: { unsubscribeUrl: buildUnsubscribeUrl(args.userId) } };
}

/** Send the welcome email (on signup). */
export async function sendWelcomeEmail(args: SendArgsBase): Promise<SendOutcome> {
  const pre = await preflightOrSkip(args);
  if ('skip' in pre) return pre.skip;
  const rendered = renderWelcomeEmail({
    firstName: args.firstName,
    unsubscribeUrl: pre.proceed.unsubscribeUrl,
  });
  return activeTransport({
    from: getFromAddress(),
    to: args.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers: { 'List-Unsubscribe': `<${pre.proceed.unsubscribeUrl}>` },
  });
}

export type DripDay = 3 | 7 | 14;

interface SendDripArgs extends SendArgsBase {
  day: DripDay;
}

/** Send the appropriate drip email for day 3, 7, or 14. */
export async function sendDripEmail(args: SendDripArgs): Promise<SendOutcome> {
  const pre = await preflightOrSkip(args);
  if ('skip' in pre) return pre.skip;

  const renderer =
    args.day === 3 ? renderDay3FeaturesEmail
    : args.day === 7 ? renderDay7TipsEmail
    : renderDay14UpgradeEmail;

  const rendered = renderer({
    firstName: args.firstName,
    unsubscribeUrl: pre.proceed.unsubscribeUrl,
  });

  return activeTransport({
    from: getFromAddress(),
    to: args.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers: { 'List-Unsubscribe': `<${pre.proceed.unsubscribeUrl}>` },
  });
}
