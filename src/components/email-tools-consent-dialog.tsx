'use client';

/**
 * Email Tools consent / warning dialog (2026-07-22).
 *
 * Shown the FIRST time the user flips the master "Email tools" switch on
 * (and again on demand via the info affordance next to the switch). It lays
 * out — honestly, in plain friendly English — what email tools do, their
 * advantages, the things to know, and the privacy/control promise. Enabling
 * requires an explicit choice; only "Enable" proceeds.
 *
 * The copy below is intentionally kept as ONE clearly-scoped, editable block
 * (EMAIL_TOOLS_CONSENT_COPY) so the wording can be revised in one place
 * without touching the dialog's structure. Howard will review the wording.
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, Zap, Info, ShieldCheck } from 'lucide-react';

/**
 * EDITABLE CONSENT COPY — revise wording here.
 * Keep it honest and non-hypey; no dark patterns.
 */
export const EMAIL_TOOLS_CONSENT_COPY = {
  title: 'Turn on Email tools?',
  intro:
    'Email tools let you turn any branch of an outline into a ready-to-send email. They are OFF until you turn them on here, and IdeaM never sends email for you — you always review and hit send yourself.',
  whatItDoes: {
    heading: 'What it does',
    body:
      'Turn any outline branch into a real, ready-to-send email — a subject line and a readable body — then hand it off to Gmail, your default mail app, your clipboard, or a downloadable file. You review and send it yourself.',
  },
  advantages: {
    heading: 'Advantages',
    body:
      'Fast — a polished draft in one step. Works with any email provider. Drafts can sound like you.',
  },
  thingsToKnow: {
    heading: 'Things to know',
    body:
      'To draft the email, the AI reads the branch content you select — governed by your existing AI Provider setting. Inbound import also has the AI read the email or thread you bring in, to structure it into an outline. On-device AI (Gemma) stays fully private; cloud AI sends that content to the provider to process it. The "Open in Gmail" and "Open in Mail" hand-offs pre-fill PLAIN TEXT with a length cap, so long or richly-formatted emails come through best via Copy or Download.',
  },
  privacy: {
    heading: 'Privacy & control',
    body:
      'IdeaM NEVER sends email on your behalf and never touches your inbox automatically — you always review and hit send yourself. You can turn this off anytime in Settings → Professional Customization.',
  },
  enableLabel: 'Enable',
  cancelLabel: 'Cancel',
} as const;

interface EmailToolsConsentDialogProps {
  open: boolean;
  /** Fired when the user explicitly enables. */
  onEnable: () => void;
  /** Fired on Cancel / dismiss — enabling must NOT proceed. */
  onCancel: () => void;
  /** When true, this is a review-only view (from the info affordance): the
   *  primary button reads "Got it" and simply closes. */
  reviewOnly?: boolean;
}

export default function EmailToolsConsentDialog({
  open,
  onEnable,
  onCancel,
  reviewOnly = false,
}: EmailToolsConsentDialogProps) {
  const C = EMAIL_TOOLS_CONSENT_COPY;

  const Section = ({
    icon,
    heading,
    body,
  }: {
    icon: React.ReactNode;
    heading: string;
    body: string;
  }) => (
    <div className="flex items-start gap-3 rounded-lg bg-muted p-3">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div>
        <p className="text-sm font-medium">{heading}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-[540px]" data-testid="email-tools-consent-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {C.title}
          </DialogTitle>
          <DialogDescription>{C.intro}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <Section
            icon={<Mail className="h-4 w-4" />}
            heading={C.whatItDoes.heading}
            body={C.whatItDoes.body}
          />
          <Section
            icon={<Zap className="h-4 w-4" />}
            heading={C.advantages.heading}
            body={C.advantages.body}
          />
          <Section
            icon={<Info className="h-4 w-4" />}
            heading={C.thingsToKnow.heading}
            body={C.thingsToKnow.body}
          />
          <Section
            icon={<ShieldCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />}
            heading={C.privacy.heading}
            body={C.privacy.body}
          />
        </div>

        <div className="flex justify-end gap-2">
          {reviewOnly ? (
            <Button onClick={onCancel} data-testid="email-tools-consent-gotit">
              Got it
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onCancel} data-testid="email-tools-consent-cancel">
                {C.cancelLabel}
              </Button>
              <Button onClick={onEnable} data-testid="email-tools-consent-enable">
                {C.enableLabel}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
