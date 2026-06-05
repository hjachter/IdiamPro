/**
 * Drip 3 — sent on day 14.
 *
 * Soft upgrade pitch for Pro ($9.99/mo). Conversational, not pushy.
 * Mentions the BYOK escape hatch up front so the user never feels cornered.
 */

import { ctaButton, escapeHtml, greeting, wrapEmail, type RenderedEmail } from './_layout';

export interface Day14EmailProps {
  firstName?: string | null;
  unsubscribeUrl: string;
  appUrl?: string;
  /** Optional checkout / upgrade URL. Falls back to the app pricing page. */
  upgradeUrl?: string;
}

export function renderDay14UpgradeEmail(props: Day14EmailProps): RenderedEmail {
  const appUrl = props.appUrl ?? 'https://2ndbrainware.com';
  const upgradeUrl = props.upgradeUrl ?? `${appUrl}/upgrade`;
  const hello = greeting(props.firstName);

  const bodyHtml = `
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;">Two weeks in</h1>
<p style="margin:0 0 16px;">${escapeHtml(hello)}. No sales pitch &mdash; just a quick heads-up on what's behind the Pro tier in case it's useful.</p>

<p style="margin:0 0 16px;"><strong>Pro is $9.99/month.</strong> Here's what it gets you:</p>
<ul style="margin:0 0 16px;padding-left:20px;">
  <li style="margin-bottom:6px;"><strong>1,000 AI generations a month</strong> (vs. the free 25-total trial).</li>
  <li style="margin-bottom:6px;"><strong>Podcast generation</strong> &mdash; turn any subtree into a hosted-style audio episode.</li>
  <li style="margin-bottom:6px;"><strong>Image generation</strong> (rolling out post-launch).</li>
  <li style="margin-bottom:6px;"><strong>Priority support</strong> &mdash; questions answered first.</li>
</ul>
<p style="margin:0 0 16px;">If you'd rather stay free forever, the <strong>BYOK</strong> path is always there: drop your own Gemini, OpenAI, or other provider key into Settings and the cap simply doesn't apply. You're paying the provider directly; we don't charge anything for that.</p>
<p style="margin:0 0 24px;">Either way works &mdash; do whatever fits.</p>
<p style="margin:0 0 24px;text-align:center;">
  ${ctaButton('See Pro details', upgradeUrl)}
</p>
`;

  const bodyText = `${hello}. No sales pitch — just a quick heads-up on what's behind the Pro tier in case it's useful.

Pro is $9.99/month. Here's what it gets you:
- 1,000 AI generations a month (vs. the free 25-total trial).
- Podcast generation — turn any subtree into a hosted-style audio episode.
- Image generation (rolling out post-launch).
- Priority support — questions answered first.

If you'd rather stay free forever, the BYOK path is always there: drop your own Gemini, OpenAI, or other provider key into Settings and the cap simply doesn't apply. You're paying the provider directly; we don't charge anything for that.

Either way works — do whatever fits.

See Pro details: ${upgradeUrl}`;

  return wrapEmail({
    subject: 'Two weeks in — a quick note on Pro',
    preheader: 'What you get for $9.99, and the always-free BYOK alternative.',
    bodyHtml,
    bodyText,
    unsubscribe: { url: props.unsubscribeUrl },
  });
}
