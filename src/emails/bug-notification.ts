/**
 * Bug notification — sent to Howard whenever a beta user submits an
 * in-app "Report Issue". Internal staff mail; no unsubscribe path.
 *
 * Mirrors the applicant-notification + feedback-notification templates so
 * Howard's inbox treats all three the same way.
 */

import { ctaButton, escapeHtml, wrapEmail, type RenderedEmail } from './_layout';
import type { BugRecord, BugSeverity } from '@/lib/access/bug-store';

export interface BugNotificationProps {
  bug: BugRecord;
  /** Deep link to /admin/bugs?focus=<id>. */
  adminUrl: string;
}

const SEVERITY_LABELS: Record<BugSeverity, string> = {
  fyi: 'FYI',
  annoying: 'Annoying',
  blocking: 'Blocking',
};

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

function descriptionPreview(s: string, max = 60): string {
  const trimmed = s.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trimEnd() + '...';
}

export function renderBugNotification(
  props: BugNotificationProps,
): RenderedEmail {
  const { bug, adminUrl } = props;
  const severityLabel = SEVERITY_LABELS[bug.severity];
  const when = formatPacific(bug.createdAt);
  const preview = descriptionPreview(bug.description, 60);

  const contextBlock = bug.context
    ? `<p style="margin:0 0 8px;color:#6B7280;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">What they were trying to do</p>
       <p style="margin:0 0 24px;padding:12px 16px;background:#F9FAFB;border-left:3px solid #007AFF;border-radius:4px;white-space:pre-wrap;">${escapeHtml(bug.context)}</p>`
    : '';

  const screenshotNote = bug.screenshotBase64
    ? '<li style="margin-bottom:4px;"><strong>Screenshot:</strong> attached (view in admin)</li>'
    : '';

  const bodyHtml = `
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;">New bug report</h1>
<p style="margin:0 0 16px;"><strong>Severity:</strong> ${escapeHtml(severityLabel)}</p>
<p style="margin:0 0 8px;color:#6B7280;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">What's not working</p>
<p style="margin:0 0 24px;padding:12px 16px;background:#F9FAFB;border-left:3px solid #007AFF;border-radius:4px;white-space:pre-wrap;">${escapeHtml(bug.description)}</p>
${contextBlock}
<ul style="margin:0 0 24px;padding-left:20px;list-style:none;">
  <li style="margin-bottom:4px;"><strong>From:</strong> ${escapeHtml(bug.userEmail ?? 'unknown user')}</li>
  <li style="margin-bottom:4px;"><strong>When:</strong> ${escapeHtml(when)} (Pacific)</li>
  <li style="margin-bottom:4px;"><strong>Page:</strong> ${escapeHtml(bug.metadata.url)}</li>
  ${bug.metadata.outlineName ? `<li style="margin-bottom:4px;"><strong>Outline open:</strong> ${escapeHtml(bug.metadata.outlineName)}</li>` : ''}
  <li style="margin-bottom:4px;"><strong>Browser:</strong> ${escapeHtml(bug.metadata.userAgent)}</li>
  ${screenshotNote}
</ul>
<p style="margin:0 0 24px;text-align:center;">
  ${ctaButton('Open in admin', adminUrl)}
</p>
`;

  const bodyText = `New bug report from a beta user.

Severity: ${severityLabel}
From: ${bug.userEmail ?? 'unknown user'}
When: ${when} (Pacific)
Page: ${bug.metadata.url}
${bug.metadata.outlineName ? `Outline open: ${bug.metadata.outlineName}\n` : ''}Browser: ${bug.metadata.userAgent}
${bug.screenshotBase64 ? 'Screenshot: attached (view in admin)\n' : ''}
What's not working:
${bug.description}
${bug.context ? `\nWhat they were trying to do:\n${bug.context}\n` : ''}
Open admin: ${adminUrl}`;

  return wrapEmail({
    subject: `[IDMPro Bug] (${severityLabel}) ${preview}`,
    preheader: `New bug report from ${bug.userEmail ?? 'a beta user'}.`,
    bodyHtml,
    bodyText,
    unsubscribe: { url: adminUrl },
  });
}
