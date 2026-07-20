/**
 * Drip 2 — sent on day 7.
 *
 * Three short "pro tips from power users" — keep the volume low, the
 * specificity high.
 */

import { ctaButton, escapeHtml, greeting, wrapEmail, type RenderedEmail } from './_layout';

export interface Day7EmailProps {
  firstName?: string | null;
  unsubscribeUrl: string;
  appUrl?: string;
}

export function renderDay7TipsEmail(props: Day7EmailProps): RenderedEmail {
  const appUrl = props.appUrl ?? 'https://2ndbrainware.com';
  const hello = greeting(props.firstName);

  const bodyHtml = `
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;">Three power-user tips</h1>
<p style="margin:0 0 16px;">${escapeHtml(hello)}. A week in &mdash; here are three things long-time users swear by.</p>

<p style="margin:24px 0 8px;font-weight:600;">1. Quick Capture, from anywhere</p>
<p style="margin:0 0 16px;">Hit Cmd+Shift+I (Ctrl+Shift+I on Windows). A floating box appears. Type or paste any thought, press Enter. It lands in a "Inbox" section at the top of Second Brain. You don't have to be inside any outline. Use it during meetings.</p>

<p style="margin:24px 0 8px;font-weight:600;">2. Research &amp; Import &mdash; combine many sources at once</p>
<p style="margin:0 0 16px;">Click the book-down icon in the toolbar, choose <em>Research &amp; Import</em>. Add a stack of YouTube videos, PDFs, web pages, audio recordings. IdeaM synthesises all of them into one structured outline with the connections drawn for you. People use this for study guides, meeting roll-ups, and competitive analysis.</p>

<p style="margin:24px 0 8px;font-weight:600;">3. Ask your outlines</p>
<p style="margin:0 0 16px;">Open Smart Tools &gt; <em>Ask Your Outlines</em>. Type a question in plain English. The AI answers based only on what's in your outlines &mdash; not the wider internet. Great for "what did I write about X six months ago".</p>

<p style="margin:24px 0 24px;text-align:center;">
  ${ctaButton('Open IdeaM', appUrl)}
</p>
`;

  const bodyText = `${hello}. A week in — here are three things long-time users swear by.

1. Quick Capture, from anywhere.
   Hit Cmd+Shift+I (Ctrl+Shift+I on Windows). A floating box appears. Type or paste any thought, press Enter. It lands in an Inbox section at the top of Second Brain. You don't have to be inside any outline. Use it during meetings.

2. Research & Import — combine many sources at once.
   Click the book-down icon in the toolbar, choose Research & Import. Add a stack of YouTube videos, PDFs, web pages, audio recordings. IdeaM synthesises all of them into one structured outline with the connections drawn for you. People use this for study guides, meeting roll-ups, and competitive analysis.

3. Ask your outlines.
   Open Smart Tools > Ask Your Outlines. Type a question in plain English. The AI answers based only on what's in your outlines — not the wider internet. Great for "what did I write about X six months ago".

Open IdeaM: ${appUrl}`;

  return wrapEmail({
    subject: 'Three power-user tips for IdeaM',
    preheader: 'Quick Capture, Research & Import, Ask Your Outlines.',
    bodyHtml,
    bodyText,
    unsubscribe: { url: props.unsubscribeUrl },
  });
}
