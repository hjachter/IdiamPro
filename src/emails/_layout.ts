/**
 * Shared email layout.
 *
 * The four onboarding emails share the same header / footer / CSS shell.
 * Each template calls `wrapEmail(...)` with its own subject + body content
 * (plain HTML fragment + matching plain-text version) and gets back a
 * complete HTML document plus a plain-text fallback.
 *
 * We deliberately do NOT import a third-party email-rendering library
 * (React Email, mjml, etc.). For four templates the indirection is not
 * worth a new dependency, and a hand-rolled table-free layout is
 * trivially mobile-responsive in 2026-era email clients.
 *
 * Brand color: IdiamPro's primary is iOS blue (#007AFF) — see globals.css.
 * Body font stack mirrors the app's UI: system font, no remote fonts (some
 * email clients block Google Fonts and we don't want a layout shift).
 */

export interface UnsubscribeLink {
  /** Fully-qualified https URL to the unsubscribe page, ready to render. */
  url: string;
}

export interface EmailLayoutInput {
  subject: string;
  preheader: string; // hidden preview text shown by Gmail / Apple Mail
  /** Inline body HTML — paragraphs, headings, CTA button. */
  bodyHtml: string;
  /** Plain-text equivalent of bodyHtml for accessibility / spam scoring. */
  bodyText: string;
  /** Per-user unsubscribe link. Required on every send (CAN-SPAM). */
  unsubscribe: UnsubscribeLink;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Brand colors — keep in sync with src/app/globals.css --primary. */
const BRAND_PRIMARY = '#007AFF';
const BRAND_PRIMARY_DARK = '#0062CC';
const TEXT_PRIMARY = '#111827';
const TEXT_MUTED = '#6B7280';
const BG_PAGE = '#F3F4F6';
const BG_CARD = '#FFFFFF';
const BORDER = '#E5E7EB';

/**
 * Reusable CTA button as inline-styled HTML. Embedded clients ignore
 * <style> blocks, so every paint property is on the element directly.
 */
export function ctaButton(label: string, href: string): string {
  return `<a href="${escapeAttr(href)}" style="display:inline-block;background:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;line-height:1;padding:14px 24px;border-radius:8px;border:1px solid ${BRAND_PRIMARY_DARK};">${escapeHtml(label)}</a>`;
}

/**
 * Wrap body content in the standard IdiamPro email shell.
 */
export function wrapEmail(input: EmailLayoutInput): RenderedEmail {
  const { subject, preheader, bodyHtml, bodyText, unsubscribe } = input;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BG_PAGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,'Helvetica Neue',sans-serif;color:${TEXT_PRIMARY};-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;color:${BG_PAGE};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="text-align:center;padding-bottom:24px;">
    <div style="font-size:22px;font-weight:700;letter-spacing:-0.01em;color:${BRAND_PRIMARY};">IdiamPro</div>
  </div>
  <div style="background:${BG_CARD};border:1px solid ${BORDER};border-radius:12px;padding:32px;font-size:16px;line-height:1.55;">
    ${bodyHtml}
  </div>
  <div style="text-align:center;padding-top:24px;font-size:12px;line-height:1.6;color:${TEXT_MUTED};">
    <div>IdiamPro &mdash; the premier idea developer.</div>
    <div style="padding-top:8px;">
      You're getting this because you signed up for IdiamPro.
      <a href="${escapeAttr(unsubscribe.url)}" style="color:${TEXT_MUTED};text-decoration:underline;">Unsubscribe</a>.
    </div>
  </div>
</div>
</body>
</html>`;

  const text = `${bodyText}

---
IdiamPro — the premier idea developer.

You're getting this because you signed up for IdiamPro.
To stop receiving these emails, open: ${unsubscribe.url}`;

  return { subject, html, text };
}

/** Minimal HTML escape for embedding text inside HTML element bodies. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape for use inside an attribute value (double-quoted). */
export function escapeAttr(s: string): string {
  return escapeHtml(s);
}

/**
 * Greeting helper — use the user's first name if we have one, otherwise
 * "Hi there" (never "Hi null" or "Hi undefined" — those leak in real
 * onboarding emails when name capture is sloppy).
 */
export function greeting(firstName?: string | null): string {
  const name = (firstName ?? '').trim();
  return name.length > 0 ? `Hi ${name}` : 'Hi there';
}
