/**
 * Feedback reminder email — sent ~14 days after a beta applicant was
 * approved, asking them to fill out the feedback form. Personal tone, from
 * Howard (reply-to Howard), low-pressure copy.
 *
 * Triggered by /api/cron/feedback-reminder (runs daily). Only sends to users
 * who have NOT yet submitted feedback and have not been reminded before.
 */

import { escapeHtml, wrapEmail, type RenderedEmail } from './_layout';

export interface FeedbackReminderProps {
  firstName?: string | null;
  unsubscribeUrl: string;
  /** Fully-qualified URL to /feedback. Defaults to the live site. */
  feedbackUrl?: string;
}

export function renderFeedbackReminderEmail(
  props: FeedbackReminderProps,
): RenderedEmail {
  const url = props.feedbackUrl ?? 'https://2ndbrainware.com/feedback';
  const firstName = (props.firstName ?? '').trim();
  const hi = firstName.length > 0 ? `Hey ${firstName}` : 'Hey there';
  const subject = firstName.length > 0
    ? `Hey ${firstName} — mind sharing five minutes of feedback?`
    : 'Mind sharing five minutes of feedback?';

  const bodyHtml = `<p style="margin:0 0 16px;">${escapeHtml(hi)},</p>
<p style="margin:0 0 16px;">Howard here. It's been about two weeks since you got into the IDMPro beta — long enough to form an opinion. Mind sharing five minutes of feedback?</p>
<p style="margin:0 0 16px;">Filling it out earns you a year of Pro features at no charge. Same Pro feature set as paying customers; the only catch is you bring your own AI API key so the usage cost stays with you, not me. No credit card, nothing to sign up for.</p>
<p style="margin:0 0 24px;text-align:center;">
  <a href="${escapeHtml(url)}" style="display:inline-block;background:#007AFF;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;line-height:1;padding:14px 24px;border-radius:8px;border:1px solid #0062CC;">Share your feedback</a>
</p>
<p style="margin:0 0 16px;color:#374151;">If you're up for a public quote on the IDMPro website, there's a section on the form for that — and a Founding User badge inside the app if you record a quick video.</p>
<p style="margin:0 0 16px;color:#374151;">If it's not the right moment, no worries. The beta access is yours either way.</p>
<p style="margin:0 0 4px;">Thanks,</p>
<p style="margin:0 0 2px;">Howard</p>
<p style="margin:0;color:#6B7280;font-size:14px;">Founder, IDMPro</p>`;

  const bodyText = `${hi},

Howard here. It's been about two weeks since you got into the IDMPro beta — long enough to form an opinion. Mind sharing five minutes of feedback?

Filling it out earns you a year of Pro features at no charge. Same Pro feature set as paying customers; the only catch is you bring your own AI API key so the usage cost stays with you, not me. No credit card, nothing to sign up for.

Share your feedback: ${url}

If you're up for a public quote on the IDMPro website, there's a section on the form for that — and a Founding User badge inside the app if you record a quick video.

If it's not the right moment, no worries. The beta access is yours either way.

Thanks,
Howard
Founder, IDMPro`;

  return wrapEmail({
    subject,
    preheader: 'Five minutes of feedback earns you a year of Pro features.',
    bodyHtml,
    bodyText,
    unsubscribe: { url: props.unsubscribeUrl },
  });
}
