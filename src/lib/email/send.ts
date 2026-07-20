/**
 * Email send wrapper — thin layer over an SMTP transport (nodemailer).
 *
 * Design notes:
 *
 * 1. SMTP TRANSPORT VIA NODEMAILER. Howard's PrivateEmail mailbox on
 *    Namecheap is the production sender. Resend was the previous backend
 *    but its DKIM verification path required swapping MX records, which
 *    the Namecheap Mail Settings UI made a lock-step migration we didn't
 *    want to take. SMTP through PrivateEmail "just works" with the same
 *    DNS we already have for inbox mail.
 *
 * 2. ENV-GATED. Every send is gated on SMTP_HOST + SMTP_USER + SMTP_PASS
 *    all being non-empty. With any of those missing the functions log
 *    "[email/send] SMTP not configured — skipping" and return
 *    successfully. This means signup, the webhook, and the cron job all
 *    keep working in dev with zero configuration — same stub-safe
 *    behaviour the old Resend wrapper had.
 *
 * 3. UNSUBSCRIBED USERS NEVER GET EMAILED. Every send pulls the user's
 *    unsubscribed flag from the local store before composing the message.
 *    The check happens here (not at each caller) so future callers can't
 *    accidentally bypass it.
 *
 * 4. TEST HOOK. Tests can replace the sender by calling
 *    `_setEmailTransportForTest(fn)` with a function that captures the
 *    payload. This avoids needing a real mailbox just to assert
 *    "we attempted to send the welcome email." The legacy
 *    `_setResendTransportForTest` name is re-exported as an alias so
 *    existing tests keep compiling.
 *
 * 5. TRANSPORTER REUSE. The nodemailer transporter is created lazily on
 *    first send and then cached at module scope — recreating per-message
 *    would re-do the TLS handshake on every email.
 */

import nodemailer, { type Transporter } from 'nodemailer';

import {
  isUnsubscribed,
} from '@/lib/email/unsubscribe-store';
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribe-token';
import { renderWelcomeEmail } from '@/emails/welcome-email';
import { renderDay3FeaturesEmail } from '@/emails/day-3-features';
import { renderDay7TipsEmail } from '@/emails/day-7-tips';
import { renderDay14UpgradeEmail } from '@/emails/day-14-upgrade';
import {
  renderApplicantNotification,
  type ApplicantNotificationProps,
} from '@/emails/applicant-notification';
import { renderApplicantApprovedEmail } from '@/emails/applicant-approved';
import {
  renderFeedbackNotification,
  type FeedbackNotificationProps,
} from '@/emails/feedback-notification';
import { renderFeedbackReminderEmail } from '@/emails/feedback-reminder';
import {
  renderBugNotification,
  type BugNotificationProps,
} from '@/emails/bug-notification';
import {
  renderStorageAlert,
  type StorageAlertProps,
} from '@/emails/storage-alert';
import {
  renderDependencyHealthAlert,
  type DependencyHealthAlertProps,
} from '@/emails/dependency-health-alert';

const DEFAULT_FROM = 'IdeaM Support <support@2ndbrainware.com>';

/**
 * Reply-To for every outgoing app email. Replies land in the shared support
 * desk (support@2ndbrainware.com), never in Howard's personal inbox. Override
 * with EMAIL_REPLY_TO without a code change if the support address ever moves.
 */
const DEFAULT_REPLY_TO = 'support@2ndbrainware.com';

/** Address that receives "new applicant" / internal notifications. */
const HOWARD_NOTIFY = 'howard@2ndbrainware.com';

export interface SendOutcome {
  /** "sent": SMTP server accepted the message. */
  /** "skipped-no-smtp": SMTP env vars missing (dev / not configured). */
  /** "skipped-no-key": legacy alias kept for callers checking the old string. */
  /** "skipped-unsubscribed": user has opted out. */
  /** "skipped-no-recipient": no `to` address. */
  /** "error": SMTP rejected the payload or network failed. */
  status: 'sent' | 'skipped-no-smtp' | 'skipped-no-key' | 'skipped-unsubscribed' | 'skipped-no-recipient' | 'error';
  /** Message id reported by the SMTP server, only present on status === 'sent'. */
  id?: string;
  /** Human-readable error description, present on status === 'error'. */
  error?: string;
}

export interface EmailTransport {
  (payload: EmailPayload): Promise<SendOutcome>;
}

export interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  /** Optional Reply-To address — used for applicant-approval emails. */
  replyTo?: string;
}

/** Legacy type aliases — kept so existing callers/tests keep compiling. */
export type ResendTransport = EmailTransport;
export type ResendPayload = EmailPayload;

// Module-level transport so tests can swap it without monkey-patching SMTP.
let activeTransport: EmailTransport = realSmtpTransport;

// Cached nodemailer transporter, built lazily on first real send.
let cachedTransporter: Transporter | null = null;
let cachedTransporterKey = '';

function buildTransporterKey(host: string, port: number, user: string): string {
  return `${host}:${port}:${user}`;
}

function getTransporter(host: string, port: number, user: string, pass: string): Transporter {
  const key = buildTransporterKey(host, port, user);
  if (cachedTransporter && cachedTransporterKey === key) {
    return cachedTransporter;
  }
  // Port 465 → implicit TLS. Port 587 (and anything else) → STARTTLS upgrade.
  const secure = port === 465;
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  cachedTransporterKey = key;
  return cachedTransporter;
}

async function realSmtpTransport(payload: EmailPayload): Promise<SendOutcome> {
  const host = (process.env.SMTP_HOST ?? '').trim();
  const user = (process.env.SMTP_USER ?? '').trim();
  const pass = (process.env.SMTP_PASS ?? '').trim();
  const portRaw = (process.env.SMTP_PORT ?? '465').trim();
  const port = Number.parseInt(portRaw, 10) || 465;

  if (host.length === 0 || user.length === 0 || pass.length === 0) {
    console.info('[email/send] SMTP not configured — skipping email send.');
    return { status: 'skipped-no-smtp' };
  }

  try {
    const transporter = getTransporter(host, port, user, pass);
    const info = await transporter.sendMail({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      headers: payload.headers ?? {},
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
    });
    return { status: 'sent', id: info.messageId };
  } catch (err) {
    return { status: 'error', error: String((err as Error)?.message ?? err) };
  }
}

/** Replace the active transport. Test-only. */
export function _setEmailTransportForTest(fn: EmailTransport | null): void {
  activeTransport = fn ?? realSmtpTransport;
}

/** Legacy alias — kept so existing tests that import the old name compile. */
export function _setResendTransportForTest(fn: EmailTransport | null): void {
  _setEmailTransportForTest(fn);
}

function getFromAddress(): string {
  const fromEnv = (process.env.EMAIL_FROM ?? '').trim();
  if (fromEnv.length > 0) return fromEnv;
  // Fall back to the SMTP_USER mailbox (RFC-recommended: the From address
  // should match an address the SMTP user is authorised to send from).
  const smtpUser = (process.env.SMTP_USER ?? '').trim();
  if (smtpUser.length > 0) return smtpUser;
  return DEFAULT_FROM;
}

/**
 * Reply-To for all app mail. Defaults to the shared support desk; override
 * via EMAIL_REPLY_TO. Safe regardless of the SMTP auth mailbox — Reply-To has
 * no authorisation requirement, so replies route to support even while the
 * From address is still the currently-authenticated mailbox.
 */
function getReplyToAddress(): string {
  const envOverride = (process.env.EMAIL_REPLY_TO ?? '').trim();
  if (envOverride.length > 0) return envOverride;
  return DEFAULT_REPLY_TO;
}

function getAdminNotifyAddress(): string {
  const envOverride = (process.env.EMAIL_TO_ADMIN ?? '').trim();
  if (envOverride.length > 0) return envOverride;
  const legacy = (process.env.BETA_NOTIFY_EMAIL ?? '').trim();
  if (legacy.length > 0) return legacy;
  return HOWARD_NOTIFY;
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
    replyTo: getReplyToAddress(),
  });
}

export type DripDay = 3 | 7 | 14;

interface SendDripArgs extends SendArgsBase {
  day: DripDay;
}

/**
 * Send the "new applicant" notification to Howard. This is internal staff
 * mail — it bypasses the unsubscribe store (Howard would never unsubscribe
 * himself from these and the bookkeeping cost would just slow signup).
 *
 * Stub-safe: with SMTP env vars unset, returns 'skipped-no-smtp' just like
 * every other send.
 */
export async function sendApplicantNotification(
  props: ApplicantNotificationProps,
  recipient?: string,
): Promise<SendOutcome> {
  const to = (recipient ?? getAdminNotifyAddress()).trim();
  if (!to || to.indexOf('@') === -1) {
    return { status: 'skipped-no-recipient' };
  }
  const rendered = renderApplicantNotification(props);
  return activeTransport({
    from: getFromAddress(),
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    replyTo: getReplyToAddress(),
  });
}

interface SendApplicantApprovedArgs extends SendArgsBase {
  /** Optional override; defaults to the IdeaM sign-in page. */
  signInUrl?: string;
  /**
   * Optional: the applicant's free-form answer to "What brings you to
   * IdeaM?" — used to personalise the welcome with a one-sentence
   * acknowledgement. Pass it straight through from the applicant record.
   */
  reason?: string | null;
}

/**
 * Send the "you're in" email to a newly-approved applicant.
 *
 * From: the app's configured sender (EMAIL_FROM / the authenticated SMTP
 * mailbox), never Howard's personal address. Reply-To: the shared support
 * desk, so a reply reaches the support team rather than a personal inbox.
 */
export async function sendApplicantApprovedEmail(
  args: SendApplicantApprovedArgs,
): Promise<SendOutcome> {
  const pre = await preflightOrSkip(args);
  if ('skip' in pre) return pre.skip;
  const rendered = renderApplicantApprovedEmail({
    firstName: args.firstName,
    unsubscribeUrl: pre.proceed.unsubscribeUrl,
    signInUrl: args.signInUrl,
    reason: args.reason,
  });
  return activeTransport({
    from: getFromAddress(),
    to: args.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers: { 'List-Unsubscribe': `<${pre.proceed.unsubscribeUrl}>` },
    replyTo: getReplyToAddress(),
  });
}

/**
 * Internal: alert Howard that the applicant store / KV backend is
 * unreachable. Bypasses the unsubscribe store — same rationale as
 * sendApplicantNotification (internal staff mail).
 *
 * Two triggers:
 *   - 'apply-degraded': a real application could not be persisted and now
 *     lives only in the notification email — this alert is the "don't lose
 *     it" flare.
 *   - 'health-check': the routine storage-health cron round-trip failed.
 *
 * Stub-safe: with SMTP env vars unset, returns 'skipped-no-smtp'.
 */
export async function sendStorageAlert(
  props: StorageAlertProps,
  recipient?: string,
): Promise<SendOutcome> {
  const to = (recipient ?? getAdminNotifyAddress()).trim();
  if (!to || to.indexOf('@') === -1) {
    return { status: 'skipped-no-recipient' };
  }
  const rendered = renderStorageAlert(props);
  return activeTransport({
    from: getFromAddress(),
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    replyTo: getReplyToAddress(),
  });
}

/**
 * Internal: alert Howard that one or more of the app's OWN third-party
 * dependencies failed the routine health sweep. Bypasses the unsubscribe
 * store — same rationale as sendApplicantNotification (internal staff mail).
 *
 * PRIVATE-FIRST: this is back-office mail to Howard only — it is never sent to
 * an end user and there is no user-facing status broadcast anywhere.
 *
 * Stub-safe: with SMTP env vars unset, returns 'skipped-no-smtp'.
 */
export async function sendDependencyHealthAlert(
  props: DependencyHealthAlertProps,
  recipient?: string,
): Promise<SendOutcome> {
  const to = (recipient ?? getAdminNotifyAddress()).trim();
  if (!to || to.indexOf('@') === -1) {
    return { status: 'skipped-no-recipient' };
  }
  const rendered = renderDependencyHealthAlert(props);
  return activeTransport({
    from: getFromAddress(),
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    replyTo: getReplyToAddress(),
  });
}

/**
 * Internal: send the bug-report notification to Howard. Bypasses the
 * unsubscribe store — same rationale as sendApplicantNotification.
 */
export async function sendBugNotification(
  props: BugNotificationProps,
  recipient?: string,
): Promise<SendOutcome> {
  const to = (recipient ?? getAdminNotifyAddress()).trim();
  if (!to || to.indexOf('@') === -1) {
    return { status: 'skipped-no-recipient' };
  }
  const rendered = renderBugNotification(props);
  return activeTransport({
    from: getFromAddress(),
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    replyTo: getReplyToAddress(),
  });
}

/**
 * Internal: send the beta-feedback notification to Howard. Bypasses the
 * unsubscribe store — same rationale as sendApplicantNotification.
 */
export async function sendFeedbackNotification(
  props: FeedbackNotificationProps,
  recipient?: string,
): Promise<SendOutcome> {
  const to = (recipient ?? getAdminNotifyAddress()).trim();
  if (!to || to.indexOf('@') === -1) {
    return { status: 'skipped-no-recipient' };
  }
  const rendered = renderFeedbackNotification(props);
  return activeTransport({
    from: getFromAddress(),
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    replyTo: getReplyToAddress(),
  });
}

interface SendFeedbackReminderArgs extends SendArgsBase {
  feedbackUrl?: string;
}

/**
 * Send the "two-week mark — fancy sharing feedback?" email to an approved
 * applicant. From the app's configured sender, reply-to the support desk, so
 * they can reply directly to the support team. Same
 * preflight as the other user-facing sends (unsubscribe respected, no-key
 * skip, etc.).
 */
export async function sendFeedbackReminderEmail(
  args: SendFeedbackReminderArgs,
): Promise<SendOutcome> {
  const pre = await preflightOrSkip(args);
  if ('skip' in pre) return pre.skip;
  const rendered = renderFeedbackReminderEmail({
    firstName: args.firstName,
    unsubscribeUrl: pre.proceed.unsubscribeUrl,
    feedbackUrl: args.feedbackUrl,
  });
  return activeTransport({
    from: getFromAddress(),
    to: args.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers: { 'List-Unsubscribe': `<${pre.proceed.unsubscribeUrl}>` },
    replyTo: getReplyToAddress(),
  });
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
    replyTo: getReplyToAddress(),
  });
}
