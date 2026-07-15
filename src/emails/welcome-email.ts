/**
 * Welcome email — sent immediately when a new user signs up.
 *
 * This is the ONE onboarding email that must work on launch day. The three
 * drip emails (day-3-features, day-7-tips, day-14-upgrade) are scaffolded
 * but are fired by a Vercel Cron post-launch.
 */

import { ctaButton, escapeHtml, greeting, wrapEmail, type RenderedEmail } from './_layout';

export interface WelcomeEmailProps {
  firstName?: string | null;
  unsubscribeUrl: string;
  /** Optional CTA URL — defaults to the IdiamPro app home. */
  appUrl?: string;
  /** Optional intro-video URL. Falls back to the app URL until the video exists. */
  introVideoUrl?: string;
}

export function renderWelcomeEmail(props: WelcomeEmailProps): RenderedEmail {
  const appUrl = props.appUrl ?? 'https://2ndbrainware.com';
  const introVideoUrl = props.introVideoUrl ?? appUrl;
  const hello = greeting(props.firstName);

  const bodyHtml = `
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;">Welcome to IdiamPro</h1>
<p style="margin:0 0 16px;">${escapeHtml(hello)} &mdash; thanks for joining. IdiamPro turns scattered notes, videos, PDFs, and half-formed ideas into structured outlines you can actually use.</p>
<p style="margin:0 0 16px;">Here's a quick three-step way to get going:</p>
<ol style="margin:0 0 24px;padding-left:20px;">
  <li style="margin-bottom:8px;"><strong>Create your first outline.</strong> Open the sidebar, click the plus, and give it a name. Press Enter to add children, Tab to indent.</li>
  <li style="margin-bottom:8px;"><strong>Try Smart Tools.</strong> Click the sparkles icon in the toolbar. Generate a branch from a topic, refresh a section against the latest web sources, or ask your own outlines a question.</li>
  <li style="margin-bottom:8px;"><strong>Watch the two-minute intro.</strong> A guided tour of the features people use most.</li>
</ol>
<p style="margin:0 0 24px;text-align:center;">
  ${ctaButton('Open IdiamPro', appUrl)}
</p>
<p style="margin:0 0 8px;color:#6B7280;font-size:14px;">Want the tour first?</p>
<p style="margin:0 0 24px;font-size:14px;"><a href="${introVideoUrl}" style="color:#007AFF;">Watch the two-minute intro</a></p>
<p style="margin:0 0 16px;color:#374151;font-size:14px;">Around the two-week mark I'll send a short feedback form. Filling it out earns you a year of Pro features free — same Pro feature set as paying customers, you just bring your own AI API key so usage costs stay with you. Sharing a quote we can put on the website also earns a Founding User badge inside the app. No pressure either way; the beta access is yours regardless.</p>
`;

  const bodyText = `${hello} — thanks for joining IdiamPro.

IdiamPro turns scattered notes, videos, PDFs, and half-formed ideas into structured outlines you can actually use.

Three quick ways to get going:

1. Create your first outline. Open the sidebar, click the plus, give it a name. Enter adds children, Tab indents.

2. Try Smart Tools. Click the sparkles icon in the toolbar. Generate a branch from a topic, refresh a section against the latest web sources, or ask your own outlines a question.

3. Watch the two-minute intro: ${introVideoUrl}

Open IdiamPro: ${appUrl}

Around the two-week mark I'll send a short feedback form. Filling it out earns you a year of Pro features free — same Pro feature set as paying customers, you just bring your own AI API key so usage costs stay with you. Sharing a quote we can put on the website also earns a Founding User badge inside the app. No pressure either way; the beta access is yours regardless.`;

  return wrapEmail({
    subject: 'Welcome to IdiamPro',
    preheader: 'Three quick ways to get started with your outlines.',
    bodyHtml,
    bodyText,
    unsubscribe: { url: props.unsubscribeUrl },
  });
}
