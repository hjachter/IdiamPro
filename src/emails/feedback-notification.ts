/**
 * Beta feedback notification — internal email that goes to Howard each time
 * someone submits the beta-feedback form (/feedback). Contains the entire
 * submission rendered in a readable way plus a deep link to the admin page.
 *
 * Like applicant-notification, this is internal staff mail: it bypasses the
 * unsubscribe store (Howard never unsubscribes from his own feedback queue).
 */

import { escapeHtml, wrapEmail, type RenderedEmail } from './_layout';
import {
  FEEDBACK_FEATURE_KEYS,
  FEEDBACK_FEATURE_LABELS,
  type FeedbackRecord,
} from '@/lib/access/feedback-store';

export interface FeedbackNotificationProps {
  feedback: FeedbackRecord;
  /** Fully-qualified admin URL — e.g. https://2ndbrainware.com/admin/feedback?focus=[id]. */
  adminUrl: string;
}

function stars(n: number | null | undefined, max = 5): string {
  if (n === null || n === undefined) return '—';
  const filled = '★'.repeat(Math.max(0, Math.min(max, Math.round(n))));
  const empty = '☆'.repeat(Math.max(0, max - Math.round(n)));
  return `${filled}${empty}`;
}

function frequencyLabel(key?: string): string {
  switch (key) {
    case 'every_day':
      return 'Every day';
    case 'most_days':
      return 'Most days';
    case 'few_times':
      return 'A few times';
    case 'once_or_twice':
      return 'Once or twice';
    case 'havent_opened':
      return "Haven't opened it";
    default:
      return key ?? '—';
  }
}

function attributionLabel(key?: string): string {
  switch (key) {
    case 'full_name_title':
      return 'Full name + title';
    case 'first_name_role':
      return 'First name + role only';
    case 'initials_only':
      return 'Initials only';
    case 'anonymous':
      return 'Anonymous (no quote)';
    default:
      return '—';
  }
}

export function renderFeedbackNotification(
  props: FeedbackNotificationProps,
): RenderedEmail {
  const f = props.feedback;
  const firstName = f.name.split(' ')[0] ?? f.name;
  const subject = `Beta feedback: ${firstName} gave ${f.nps} / 10`;

  // ---- Per-feature ratings table ---------------------------------------
  const featureRows = FEEDBACK_FEATURE_KEYS.map((key) => {
    const row = f.featureRatings[key];
    if (!row) return null;
    const label = FEEDBACK_FEATURE_LABELS[key]?.label ?? key;
    const s = row.stars === null ? "Didn't try yet" : stars(row.stars);
    const comment = row.comment ? `<div style="color:#6B7280;font-size:14px;">${escapeHtml(row.comment)}</div>` : '';
    return `<tr>
  <td style="padding:6px 12px 6px 0;vertical-align:top;width:50%;">${escapeHtml(label)}</td>
  <td style="padding:6px 0;vertical-align:top;">${escapeHtml(s)}${comment}</td>
</tr>`;
  }).filter(Boolean).join('');

  const featureTable = featureRows.length > 0
    ? `<table style="width:100%;border-collapse:collapse;font-size:15px;line-height:1.45;margin:0 0 16px;">${featureRows}</table>`
    : '<p style="margin:0 0 16px;color:#6B7280;">No per-feature ratings were left.</p>';

  // ---- Sections ---------------------------------------------------------
  const sections: string[] = [];

  sections.push(
    `<p style="margin:0 0 8px;"><strong>${escapeHtml(f.name)}</strong> &lt;${escapeHtml(f.email)}&gt; submitted feedback on ${escapeHtml(new Date(f.submittedAt).toUTCString())}.</p>`,
  );

  sections.push(
    `<table style="width:100%;border-collapse:collapse;font-size:16px;margin:0 0 16px;">
  <tr><td style="padding:4px 12px 4px 0;width:50%;">NPS</td><td style="padding:4px 0;"><strong>${f.nps} / 10</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;">Overall stars</td><td style="padding:4px 0;"><strong>${stars(f.overallStars)}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;">How often this week</td><td style="padding:4px 0;">${escapeHtml(frequencyLabel(f.usageFrequency))}</td></tr>
</table>`,
  );

  sections.push(`<h2 style="font-size:18px;margin:24px 0 8px;">Feature ratings</h2>${featureTable}`);

  if (f.bestThing) {
    sections.push(`<h2 style="font-size:18px;margin:24px 0 8px;">Best thing about IDMPro</h2><blockquote style="margin:0 0 16px;padding:8px 12px;border-left:3px solid #007AFF;color:#374151;">${escapeHtml(f.bestThing)}</blockquote>`);
  }
  if (f.biggestWish) {
    sections.push(`<h2 style="font-size:18px;margin:24px 0 8px;">Biggest wish for change</h2><blockquote style="margin:0 0 16px;padding:8px 12px;border-left:3px solid #F59E0B;color:#374151;">${escapeHtml(f.biggestWish)}</blockquote>`);
  }
  if (f.frictionNotes) {
    sections.push(`<h2 style="font-size:18px;margin:24px 0 8px;">Anything confusing or broken</h2><blockquote style="margin:0 0 16px;padding:8px 12px;border-left:3px solid #EF4444;color:#374151;">${escapeHtml(f.frictionNotes)}</blockquote>`);
  }

  if (f.toolsBeforeIdiampro || f.workType) {
    const lines: string[] = [];
    if (f.toolsBeforeIdiampro) lines.push(`<li>Was using before: ${escapeHtml(f.toolsBeforeIdiampro)}</li>`);
    if (f.workType) lines.push(`<li>Kind of work: ${escapeHtml(f.workType)}</li>`);
    sections.push(`<h2 style="font-size:18px;margin:24px 0 8px;">Workflow context</h2><ul style="margin:0 0 16px;padding-left:20px;">${lines.join('')}</ul>`);
  }

  if (f.testimonialConsent) {
    sections.push(`<h2 style="font-size:18px;margin:24px 0 8px;">Testimonial consent</h2>
<ul style="margin:0 0 16px;padding-left:20px;">
  <li>Quote OK: <strong>Yes</strong></li>
  <li>Attribution: ${escapeHtml(attributionLabel(f.testimonialAttribution))}</li>
  <li>Photo uploaded: ${f.testimonialPhotoUploaded ? 'Yes' : 'No'}</li>
  <li>Video uploaded: ${f.testimonialVideoUploaded ? 'Yes — Founding User badge granted.' : 'No'}</li>
</ul>`);
  }

  if (f.followUpOk) {
    sections.push(`<p style="margin:0 0 16px;color:#374151;">User said it's OK to email a follow-up question.</p>`);
  }

  sections.push(
    `<p style="margin:24px 0 8px;"><a href="${escapeHtml(props.adminUrl)}" style="display:inline-block;background:#007AFF;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:10px 18px;border-radius:8px;">Open in admin dashboard</a></p>`,
  );

  const bodyHtml = sections.join('');

  // ---- Plain-text version ----------------------------------------------
  const txt: string[] = [];
  txt.push(`${f.name} <${f.email}> submitted feedback on ${new Date(f.submittedAt).toUTCString()}.`);
  txt.push('');
  txt.push(`NPS:           ${f.nps} / 10`);
  txt.push(`Overall stars: ${f.overallStars} / 5`);
  txt.push(`Usage:         ${frequencyLabel(f.usageFrequency)}`);
  txt.push('');
  txt.push('FEATURE RATINGS');
  for (const key of FEEDBACK_FEATURE_KEYS) {
    const row = f.featureRatings[key];
    if (!row) continue;
    const label = FEEDBACK_FEATURE_LABELS[key]?.label ?? key;
    const s = row.stars === null ? "Didn't try yet" : `${row.stars} / 5`;
    txt.push(`- ${label}: ${s}${row.comment ? `  — "${row.comment}"` : ''}`);
  }
  if (f.bestThing) txt.push('', 'BEST THING', f.bestThing);
  if (f.biggestWish) txt.push('', 'BIGGEST WISH', f.biggestWish);
  if (f.frictionNotes) txt.push('', 'FRICTION / BROKEN', f.frictionNotes);
  if (f.toolsBeforeIdiampro) txt.push('', `Tools before IDMPro: ${f.toolsBeforeIdiampro}`);
  if (f.workType) txt.push(`Work type: ${f.workType}`);
  if (f.testimonialConsent) {
    txt.push('', 'TESTIMONIAL CONSENT: yes');
    txt.push(`Attribution: ${attributionLabel(f.testimonialAttribution)}`);
    txt.push(`Photo: ${f.testimonialPhotoUploaded ? 'uploaded' : 'no'}`);
    txt.push(`Video: ${f.testimonialVideoUploaded ? 'uploaded — Founding User badge granted' : 'no'}`);
  }
  if (f.followUpOk) txt.push('', 'OK to email a follow-up question.');
  txt.push('', `Admin dashboard: ${props.adminUrl}`);

  return wrapEmail({
    subject,
    preheader: `Beta feedback: ${firstName} gave ${f.nps} / 10`,
    bodyHtml,
    bodyText: txt.join('\n'),
    unsubscribe: { url: props.adminUrl },
  });
}
