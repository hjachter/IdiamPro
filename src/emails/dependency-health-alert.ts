/**
 * Dependency-health alert — sent PRIVATELY to Howard when the hourly
 * dependency-health sweep finds one or more of the app's own third-party
 * dependencies 'down' or 'degraded'.
 *
 * This is internal staff mail — it never reaches an end user. The shared email
 * layout still expects an unsubscribe link, so (like the applicant/storage
 * alerts) we pass the admin dashboard URL as a no-op.
 */

import { ctaButton, escapeHtml, wrapEmail, type RenderedEmail } from './_layout';

export interface DependencyHealthAlertItem {
  name: string;
  category: string;
  status: 'degraded' | 'down';
  latencyMs: number;
  detail: string;
}

export interface DependencyHealthAlertProps {
  /** ISO 8601 string — when the sweep ran. */
  detectedAt: string;
  /** The dependencies that came back bad. Always non-empty when we alert. */
  problems: DependencyHealthAlertItem[];
  /** Optional deep link to the admin health board for the CTA. */
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

function statusLabel(status: 'degraded' | 'down'): string {
  return status === 'down' ? 'DOWN' : 'DEGRADED';
}

export function renderDependencyHealthAlert(
  props: DependencyHealthAlertProps,
): RenderedEmail {
  const when = formatPacific(props.detectedAt);
  const adminUrl = props.adminUrl && props.adminUrl.length > 0 ? props.adminUrl : '#';

  const downCount = props.problems.filter((p) => p.status === 'down').length;
  const degradedCount = props.problems.length - downCount;

  const summaryBits: string[] = [];
  if (downCount > 0) summaryBits.push(`${downCount} down`);
  if (degradedCount > 0) summaryBits.push(`${degradedCount} degraded`);
  const summary = summaryBits.join(', ');

  const subject = `⚠ Dependency health: ${summary}`;

  const rowsHtml = props.problems
    .map((p) => {
      const color = p.status === 'down' ? '#DC2626' : '#D97706';
      return `<li style="margin-bottom:12px;padding:12px 16px;background:#F9FAFB;border-left:3px solid ${color};border-radius:4px;">
        <div style="font-weight:600;color:${color};">${escapeHtml(p.name)} — ${statusLabel(p.status)}</div>
        <div style="color:#6B7280;font-size:13px;margin-top:2px;">${escapeHtml(p.category)} · ${p.latencyMs}ms</div>
        <div style="margin-top:6px;">${escapeHtml(p.detail)}</div>
      </li>`;
    })
    .join('\n');

  const rowsText = props.problems
    .map((p) => `• ${p.name} — ${statusLabel(p.status)} (${p.category}, ${p.latencyMs}ms)\n  ${p.detail}`)
    .join('\n');

  const bodyHtml = `
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:#DC2626;">⚠ A dependency needs attention</h1>
<p style="margin:0 0 16px;">The hourly health sweep at <strong>${escapeHtml(when)} (Pacific)</strong> found ${escapeHtml(summary)}:</p>
<ul style="margin:0 0 24px;padding-left:0;list-style:none;">
${rowsHtml}
</ul>
<p style="margin:0 0 24px;color:#6B7280;">You only get this note when the set of unhealthy dependencies changes — no hourly repeats for the same ongoing outage.</p>
<p style="margin:0 0 24px;text-align:center;">
  ${ctaButton('Open health board', adminUrl)}
</p>
`;

  const bodyText = `⚠ A dependency needs attention.

The hourly health sweep at ${when} (Pacific) found ${summary}:

${rowsText}

You only get this note when the set of unhealthy dependencies changes — no hourly repeats for the same ongoing outage.

Health board: ${adminUrl}`;

  return wrapEmail({
    subject,
    preheader: `${summary} — checked ${when} Pacific.`,
    bodyHtml,
    bodyText,
    unsubscribe: { url: adminUrl },
  });
}
