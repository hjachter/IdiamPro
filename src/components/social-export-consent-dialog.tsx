'use client';

/**
 * Social export consent / note dialog (2026-07-22).
 *
 * Shown the FIRST time the user flips the master "Social export" switch on
 * (and again on demand via the info affordance). Deliberately SHORTER and
 * lighter than the Email tools consent — social export is lower-stakes: it only
 * ever drafts content the user reviews and posts themselves. Three short points:
 * what it does, how the AI reads the branch (per the AI Provider setting), and
 * the never-auto-post promise. Enabling requires an explicit choice.
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
import { Share2, Cpu, ShieldCheck } from 'lucide-react';

/** EDITABLE CONSENT COPY — revise wording here. Honest, non-hypey. */
export const SOCIAL_EXPORT_CONSENT_COPY = {
  title: 'Turn on Social export?',
  intro:
    'Social export turns a branch of your outline into ready-to-post social content that you review and post yourself. It’s OFF until you turn it on here.',
  whatItDoes: {
    heading: 'What it does',
    body:
      'Turn any outline branch into ready-to-post social content — a thread or a single post — then copy it, open a prefilled compose window, or download it. You always review and post it yourself.',
  },
  thingsToKnow: {
    heading: 'How your content is handled',
    body:
      'To draft the post, the AI reads the branch you select — governed by your existing AI Provider setting. On-device AI stays fully private; cloud AI sends that content to the provider to process it.',
  },
  privacy: {
    heading: 'IdeaM never posts for you',
    body:
      'IdeaM never posts anything automatically and never connects to your social accounts — you always review and post yourself. Turn this off anytime in Settings → Professional Customization.',
  },
  enableLabel: 'Enable',
  cancelLabel: 'Cancel',
} as const;

interface SocialExportConsentDialogProps {
  open: boolean;
  /** Fired when the user explicitly enables. */
  onEnable: () => void;
  /** Fired on Cancel / dismiss — enabling must NOT proceed. */
  onCancel: () => void;
  /** Review-only view (from the info affordance): primary button reads "Got it". */
  reviewOnly?: boolean;
}

export default function SocialExportConsentDialog({
  open,
  onEnable,
  onCancel,
  reviewOnly = false,
}: SocialExportConsentDialogProps) {
  const C = SOCIAL_EXPORT_CONSENT_COPY;

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
      <DialogContent className="sm:max-w-[500px]" data-testid="social-export-consent-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {C.title}
          </DialogTitle>
          <DialogDescription>{C.intro}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <Section
            icon={<Share2 className="h-4 w-4" />}
            heading={C.whatItDoes.heading}
            body={C.whatItDoes.body}
          />
          <Section
            icon={<Cpu className="h-4 w-4" />}
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
            <Button onClick={onCancel} data-testid="social-export-consent-gotit">
              Got it
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onCancel} data-testid="social-export-consent-cancel">
                {C.cancelLabel}
              </Button>
              <Button onClick={onEnable} data-testid="social-export-consent-enable">
                {C.enableLabel}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
