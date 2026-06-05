/**
 * Drip 1 — sent on day 3.
 *
 * Highlights one underused feature (Refresh from Web, internal name LIVE
 * BOOKS). The goal is a single concrete "try this" — not a feature dump.
 */

import { ctaButton, escapeHtml, greeting, wrapEmail, type RenderedEmail } from './_layout';

export interface Day3EmailProps {
  firstName?: string | null;
  unsubscribeUrl: string;
  appUrl?: string;
}

export function renderDay3FeaturesEmail(props: Day3EmailProps): RenderedEmail {
  const appUrl = props.appUrl ?? 'https://2ndbrainware.com';
  const hello = greeting(props.firstName);

  const bodyHtml = `
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;">Outlines that don't go stale</h1>
<p style="margin:0 0 16px;">${escapeHtml(hello)}. Quick tip you might've missed.</p>
<p style="margin:0 0 16px;">One of the most useful things IdiamPro can do is take an outline you wrote weeks ago and bring it up to date against the live web. We call it <strong>Refresh from Web</strong>.</p>
<p style="margin:0 0 16px;">Pick any node, open Smart Tools (sparkles in the toolbar), choose <em>Refresh from Web</em>. Every change is shown side-by-side so you can accept or reject each one &mdash; nothing is overwritten without your say-so. Nodes you've edited by hand are auto-skipped so your writing stays put.</p>
<p style="margin:0 0 16px;">It's the easiest way to stop maintaining living documents by hand.</p>
<p style="margin:0 0 24px;text-align:center;">
  ${ctaButton('Try Refresh from Web', appUrl)}
</p>
`;

  const bodyText = `${hello}. Quick tip you might've missed.

One of the most useful things IdiamPro can do is take an outline you wrote weeks ago and bring it up to date against the live web. We call it Refresh from Web.

Pick any node, open Smart Tools (sparkles in the toolbar), choose Refresh from Web. Every change is shown side-by-side so you can accept or reject each one — nothing is overwritten without your say-so. Nodes you've edited by hand are auto-skipped so your writing stays put.

It's the easiest way to stop maintaining living documents by hand.

Try it: ${appUrl}`;

  return wrapEmail({
    subject: 'Stop maintaining documents by hand',
    preheader: 'Refresh from Web brings any outline up to date in seconds.',
    bodyHtml,
    bodyText,
    unsubscribe: { url: props.unsubscribeUrl },
  });
}
