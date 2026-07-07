/**
 * Storage-alert notification — sent to Howard when the applicant store /
 * KV backend is unreachable. Two flavors:
 *
 *   - 'apply-degraded': a real beta application just came in but could NOT
 *     be persisted. The full-detail notification email is now the ONLY copy
 *     of that applicant, so this alert screams "do not lose this."
 *   - 'health-check': the routine storage-health cron round-trip failed.
 *     No applicant attached — just a "your store is down, go fix it" ping.
 *
 * This is internal staff mail — no real unsubscribe (the shared layout still
 * expects one, so we pass the admin dashboard URL as a no-op, same as the
 * applicant-notification template).
 */

import { ctaButton, escapeHtml, wrapEmail, type RenderedEmail } from './_layout';

export interface StorageAlertProps {
  kind: 'apply-degraded' | 'health-check';
  /** ISO 8601 string — when the outage was detected. */
  detectedAt: string;
  /** Present for 'apply-degraded': the applicant that could only be emailed. */
  applicant?: { name: string; email: string; reason?: string };
  /** Present for 'health-check': the backend label the probe saw. */
  backend?: string;
  /** Optional extra context. */
  note?: string;
  /** Optional deep link to the admin dashboard for the CTA. */
  adminUrl?: string;
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

export function renderStorageAlert(props: StorageAlertProps): RenderedEmail {
  const when = formatPacific(props.detectedAt);
  const adminUrl = props.adminUrl && props.adminUrl.length > 0 ? props.adminUrl : '#';
  const backend = props.backend ?? 'unknown';

  const subject =
    props.kind === 'apply-degraded'
      ? `⚠ Applicant storage DOWN — application from ${props.applicant?.name ?? 'someone'} saved to email only`
      : `⚠ Applicant storage unreachable`;

  const reconnect =
    'Reconnect Vercel KV / Upstash in the Vercel Storage tab and redeploy.';

  let situationHtml: string;
  let situationText: string;

  if (props.kind === 'apply-degraded') {
    const name = props.applicant?.name ?? '(unknown)';
    const email = props.applicant?.email ?? '(unknown)';
    const reason = props.applicant?.reason;
    const reasonBlock = reason
      ? `<p style="margin:0 0 8px;color:#6B7280;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">What brings them here</p>
         <p style="margin:0 0 24px;padding:12px 16px;background:#F9FAFB;border-left:3px solid #007AFF;border-radius:4px;white-space:pre-wrap;">${escapeHtml(reason)}</p>`
      : `<p style="margin:0 0 24px;color:#6B7280;font-style:italic;">No reason given.</p>`;

    situationHtml = `
<p style="margin:0 0 16px;">A beta application arrived at <strong>${escapeHtml(when)} (Pacific)</strong>, but the applicant store could not save it.</p>
<ul style="margin:0 0 24px;padding-left:20px;list-style:none;">
  <li style="margin-bottom:4px;"><strong>Name:</strong> ${escapeHtml(name)}</li>
  <li style="margin-bottom:4px;"><strong>Email:</strong> ${escapeHtml(email)}</li>
</ul>
${reasonBlock}
<p style="margin:0 0 24px;padding:12px 16px;background:#FEF2F2;border-left:3px solid #DC2626;border-radius:4px;font-weight:600;">This application exists ONLY in this email chain until the store is reconnected — do not lose it.</p>`;

    situationText = `A beta application arrived at ${when} (Pacific), but the applicant store could not save it.

Name: ${name}
Email: ${email}
What brings them here:
${reason ?? '(no reason given)'}

This application exists ONLY in this email chain until the store is reconnected — do not lose it.`;
  } else {
    situationHtml = `
<p style="margin:0 0 16px;">A routine health check could not reach the applicant store (backend: <strong>${escapeHtml(backend)}</strong>) as of <strong>${escapeHtml(when)} (Pacific)</strong>.</p>
<p style="margin:0 0 24px;">New signups will be captured to email only until this is fixed.</p>`;

    situationText = `A routine health check could not reach the applicant store (backend: ${backend}) as of ${when} (Pacific).

New signups will be captured to email only until this is fixed.`;
  }

  const noteHtml = props.note
    ? `<p style="margin:0 0 24px;color:#6B7280;">${escapeHtml(props.note)}</p>`
    : '';
  const noteText = props.note ? `\n${props.note}\n` : '';

  const bodyHtml = `
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:#DC2626;">⚠ Applicant storage is unreachable</h1>
${situationHtml}
${noteHtml}
<p style="margin:0 0 24px;">${escapeHtml(reconnect)}</p>
<p style="margin:0 0 24px;text-align:center;">
  ${ctaButton('Open admin dashboard', adminUrl)}
</p>
`;

  const bodyText = `⚠ Applicant storage is unreachable.

${situationText}
${noteText}
${reconnect}

Admin dashboard: ${adminUrl}`;

  return wrapEmail({
    subject,
    preheader:
      props.kind === 'apply-degraded'
        ? 'A beta application was saved to email only — the store is down.'
        : 'The applicant store failed a routine health check.',
    bodyHtml,
    bodyText,
    unsubscribe: { url: adminUrl },
  });
}
