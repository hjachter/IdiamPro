/**
 * Applicant approved email — sent to the user when Howard clicks "Approve"
 * in /admin/applicants. Tells them they're in, where to sign in, and that
 * they can reply directly to Howard.
 *
 * Reply-To is set to howard@2ndbrainware.com so the conversational tone of
 * "Reply to this email and Howard will read it" actually works — they hit
 * Reply in their mail client and the message routes straight to Howard
 * rather than into the noreply abyss.
 */

import { ctaButton, escapeHtml, greeting, wrapEmail, type RenderedEmail } from './_layout';

export interface ApplicantApprovedProps {
  firstName?: string | null;
  unsubscribeUrl: string;
  /** Optional sign-in URL — defaults to the IdiamPro sign-in page. */
  signInUrl?: string;
}

export function renderApplicantApprovedEmail(
  props: ApplicantApprovedProps,
): RenderedEmail {
  const signInUrl = props.signInUrl ?? 'https://2ndbrainware.com/signin';
  const hello = greeting(props.firstName);

  const bodyHtml = `
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;">You're in.</h1>
<p style="margin:0 0 16px;">${escapeHtml(hello)} &mdash; your IdiamPro beta access is active.</p>
<p style="margin:0 0 16px;">Sign in with the email you applied with, and your account will load straight into your first outline. IdiamPro turns scattered notes, videos, PDFs, and half-formed ideas into structured outlines you can actually use — give it a try with whatever's on your plate this week.</p>
<p style="margin:0 0 24px;text-align:center;">
  ${ctaButton('Sign in to IdiamPro', signInUrl)}
</p>
<p style="margin:0 0 8px;color:#6B7280;font-size:14px;">Questions, suggestions, anything weird?</p>
<p style="margin:0;font-size:14px;">Hit Reply to this email — Howard reads every one personally.</p>
`;

  const bodyText = `${hello} — your IdiamPro beta access is active.

Sign in with the email you applied with, and your account will load straight into your first outline. IdiamPro turns scattered notes, videos, PDFs, and half-formed ideas into structured outlines you can actually use — give it a try with whatever's on your plate this week.

Sign in: ${signInUrl}

Questions, suggestions, anything weird? Hit Reply to this email — Howard reads every one personally.`;

  return wrapEmail({
    subject: "You're in! Your IdiamPro beta access is active",
    preheader: 'Your IdiamPro beta access is active. Sign in to get started.',
    bodyHtml,
    bodyText,
    unsubscribe: { url: props.unsubscribeUrl },
  });
}
