/**
 * Applicant approved email — sent to the user when Howard clicks "Approve"
 * in /admin/applicants. It reads as a personal note from Howard, not a
 * corporate auto-reply: warm greeting, a one-line acknowledgement of why
 * they applied (when they provided one), concrete next steps, and a
 * standing offer to reply directly.
 *
 * From: Howard at IDMPro <howard@2ndbrainware.com>
 * Reply-To: howard@2ndbrainware.com — clicking Reply lands in Howard's
 * inbox, not the noreply alias.
 *
 * Tone direction (2026-06-10): the email goes out FROM Howard
 * automatically when he hits Approve, so the body should sound like the
 * note he'd type himself. Plain English. No "as the founder of" puffery,
 * no emoji, no marketing speak. Howard reads every reply, and the email
 * has to make that promise plausible.
 */

import { escapeHtml, wrapEmail, type RenderedEmail } from './_layout';

export interface ApplicantApprovedProps {
  firstName?: string | null;
  unsubscribeUrl: string;
  /** Optional sign-in URL — defaults to the IDMPro sign-in page. */
  signInUrl?: string;
  /**
   * Optional: the "What brings you to IDMPro?" answer the applicant
   * supplied. When present and non-trivial we include a one-sentence
   * acknowledgement so the email reads as genuinely personalised rather
   * than mail-merged.
   */
  reason?: string | null;
}

/** Minimum characters of "reason" needed before we acknowledge it.  */
const MIN_REASON_LENGTH = 8;

/** Cap on how much we quote back, to keep the email short. */
const MAX_REASON_LENGTH = 220;

/**
 * Decide whether the reason is worth acknowledging. We skip empties,
 * whitespace-only strings, and ultra-short answers like "idk" — quoting
 * those back would feel mechanical rather than personal.
 */
function trimmedReason(reason?: string | null): string | null {
  const r = (reason ?? '').trim();
  if (r.length < MIN_REASON_LENGTH) return null;
  if (r.length <= MAX_REASON_LENGTH) return r;
  // Truncate on a word boundary, then add an ellipsis.
  const slice = r.slice(0, MAX_REASON_LENGTH);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > 60 ? slice.slice(0, lastSpace) : slice;
  return `${cut}…`;
}

export function renderApplicantApprovedEmail(
  props: ApplicantApprovedProps,
): RenderedEmail {
  const signInUrl = props.signInUrl ?? 'https://2ndbrainware.com/signin';
  const firstName = (props.firstName ?? '').trim();
  const hi = firstName.length > 0 ? `Hey ${firstName}` : 'Hey there';
  const reason = trimmedReason(props.reason);

  const subject = firstName.length > 0
    ? `You're in, ${firstName} — welcome to IDMPro`
    : "You're in — welcome to IDMPro";

  // ---- HTML body --------------------------------------------------------
  const greetingLine =
    `<p style="margin:0 0 16px;">${escapeHtml(hi)},</p>`;

  const introLine =
    `<p style="margin:0 0 16px;">Howard here — thanks for applying to the IDMPro beta. You're approved.</p>`;

  const reasonLineHtml = reason
    ? `<p style="margin:0 0 16px;">You mentioned: &ldquo;${escapeHtml(reason)}&rdquo; — that's exactly the kind of thing I built this for, and I'd love to hear how it lands once you've had a play. If it doesn't do what you need yet, write back and tell me what's missing.</p>`
    : '';

  const nextStepLine = `<p style="margin:0 0 16px;">Whenever you're ready, sign in at <a href="${escapeHtml(signInUrl)}" style="color:#007AFF;text-decoration:underline;">2ndbrainware.com</a> with the email you applied with. Your account will load straight into a starter outline.</p>`;

  const noteList = `<p style="margin:0 0 8px;">A few things to know:</p>
<ul style="margin:0 0 16px;padding-left:20px;">
  <li style="margin:0 0 6px;">The beta moves fast. You'll see updates ship most days.</li>
  <li style="margin:0 0 6px;">Your data is yours — I don't train models on it. The User Guide inside the app explains the privacy model in plain English.</li>
  <li style="margin:0 0 6px;">If you hit a bug, a confusing menu, or want a feature, just reply to this email. I read every reply, usually within a few hours.</li>
</ul>`;

  const signoff = `<p style="margin:0 0 4px;">Thanks for trying it,</p>
<p style="margin:0 0 2px;">Howard</p>
<p style="margin:0;color:#6B7280;font-size:14px;">Founder, IDMPro</p>`;

  const bodyHtml = `${greetingLine}${introLine}${reasonLineHtml}${nextStepLine}${noteList}${signoff}`;

  // ---- Plain-text body --------------------------------------------------
  const reasonLineText = reason
    ? `\nYou mentioned: "${reason}" — that's exactly the kind of thing I built this for, and I'd love to hear how it lands once you've had a play. If it doesn't do what you need yet, write back and tell me what's missing.\n`
    : '';

  const bodyText = `${hi},

Howard here — thanks for applying to the IDMPro beta. You're approved.
${reasonLineText}
Whenever you're ready, sign in at ${signInUrl} with the email you applied with. Your account will load straight into a starter outline.

A few things to know:
- The beta moves fast. You'll see updates ship most days.
- Your data is yours — I don't train models on it. The User Guide inside the app explains the privacy model in plain English.
- If you hit a bug, a confusing menu, or want a feature, just reply to this email. I read every reply, usually within a few hours.

Thanks for trying it,
Howard
Founder, IDMPro`;

  return wrapEmail({
    subject,
    preheader: "You're approved for the IDMPro beta — a quick note from Howard.",
    bodyHtml,
    bodyText,
    unsubscribe: { url: props.unsubscribeUrl },
  });
}
