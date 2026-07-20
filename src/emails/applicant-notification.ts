/**
 * Applicant notification — sent to Howard whenever a new beta application
 * arrives. This is the "you've got mail" ping that lets him approve people
 * in near-real-time without polling /admin/applicants.
 *
 * Sent to: howard@2ndbrainware.com (or process.env.BETA_NOTIFY_EMAIL).
 * From: the same EMAIL_FROM the rest of the app uses.
 *
 * No unsubscribe link — this is internal staff mail, not a marketing list.
 * The shared layout still expects one; we pass the admin dashboard URL
 * as a no-op so the email shell stays consistent.
 */

import { ctaButton, escapeHtml, wrapEmail, type RenderedEmail } from './_layout';

export interface ApplicantNotificationProps {
  applicantId: string;
  name: string;
  email: string;
  /** ISO 8601 string from createApplicant(). */
  signupDate: string;
  /** Free-form text from the applicant; may be empty. */
  reason?: string;
  /** Best-effort caller IP. */
  ip?: string;
  /** HTTP Referer header at signup, if present. */
  referrer?: string;
  /** Deep link to /admin/applicants?focus=[id]. */
  adminUrl: string;
}

function formatPacific(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function renderApplicantNotification(
  props: ApplicantNotificationProps,
): RenderedEmail {
  const when = formatPacific(props.signupDate);
  const reasonBlock = props.reason
    ? `<p style="margin:0 0 8px;color:#6B7280;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">What brings them here</p>
       <p style="margin:0 0 24px;padding:12px 16px;background:#F9FAFB;border-left:3px solid #007AFF;border-radius:4px;white-space:pre-wrap;">${escapeHtml(props.reason)}</p>`
    : `<p style="margin:0 0 24px;color:#6B7280;font-style:italic;">No reason given.</p>`;

  const ipLine = props.ip
    ? `<li style="margin-bottom:4px;"><strong>IP:</strong> ${escapeHtml(props.ip)}</li>`
    : '';
  const refLine = props.referrer
    ? `<li style="margin-bottom:4px;"><strong>Referrer:</strong> ${escapeHtml(props.referrer)}</li>`
    : '';

  const bodyHtml = `
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;">New beta applicant</h1>
<p style="margin:0 0 24px;">Someone just applied to try IdeaM. Review them in the admin dashboard.</p>
<ul style="margin:0 0 24px;padding-left:20px;list-style:none;">
  <li style="margin-bottom:4px;"><strong>Name:</strong> ${escapeHtml(props.name)}</li>
  <li style="margin-bottom:4px;"><strong>Email:</strong> ${escapeHtml(props.email)}</li>
  <li style="margin-bottom:4px;"><strong>Signed up:</strong> ${escapeHtml(when)} (Pacific)</li>
  ${ipLine}
  ${refLine}
</ul>
${reasonBlock}
<p style="margin:0 0 24px;text-align:center;">
  ${ctaButton('Review in admin', props.adminUrl)}
</p>
`;

  const bodyText = `New beta applicant for IdeaM.

Name: ${props.name}
Email: ${props.email}
Signed up: ${when} (Pacific)
${props.ip ? `IP: ${props.ip}\n` : ''}${props.referrer ? `Referrer: ${props.referrer}\n` : ''}
What brings them here:
${props.reason ?? '(no reason given)'}

Review and approve at: ${props.adminUrl}`;

  return wrapEmail({
    subject: `Beta applicant: ${props.name} — ${props.email}`,
    preheader: `New beta application from ${props.name}.`,
    bodyHtml,
    bodyText,
    unsubscribe: { url: props.adminUrl },
  });
}
