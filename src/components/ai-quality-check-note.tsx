'use client';

/**
 * AiQualityCheckNote — the shared, conservative, PROMISE-FREE note shown near
 * every factual AI draft (Export Email, Share to Social, Summarize, Import
 * Email). It states the fact that an automatic check runs and puts the review
 * responsibility on the user — with NO efficacy / success-rate claim.
 *
 * When the always-on hallucination verifier flags source-unsupported claims,
 * this also renders the "please review these" flag list, and (when a corrected
 * version is offered and the parent wired an accept handler) a "Use corrected
 * version" button. Flag-and-suggest — the human always stays in control.
 */

import React from 'react';
import { ShieldCheck, AlertTriangle, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VerifyResult } from '@/lib/ai/hallucination-verifier';

/** The exact, owner-approved, promise-free product copy. */
export const AI_QUALITY_CHECK_COPY =
  'Every AI draft runs through an automatic quality check. AI can still make mistakes, so please review before you send or publish.';

interface AiQualityCheckNoteProps {
  /** The automated check is currently running. */
  verifying: boolean;
  /** The verifier result, or null before it has run. */
  result: VerifyResult | null;
  /** Optional: apply the corrected version (shown only when both are present). */
  onAcceptCorrection?: (text: string) => void;
  className?: string;
}

export default function AiQualityCheckNote({
  verifying,
  result,
  onAcceptCorrection,
  className,
}: AiQualityCheckNoteProps) {
  const flagged = !!result?.ran && result.suspectClaims.length > 0;

  return (
    <div className={`space-y-2 ${className ?? ''}`} data-testid="ai-quality-check-note">
      {/* Always-shown conservative, promise-free note. */}
      <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/40 p-2.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500 dark:text-emerald-400" />
        <span data-testid="ai-quality-check-copy">
          {AI_QUALITY_CHECK_COPY}
          {verifying && (
            <span className="ml-1 inline-flex items-center gap-1 align-middle">
              <Loader2 className="h-3 w-3 animate-spin" />
              Checking…
            </span>
          )}
        </span>
      </div>

      {/* Flag-and-suggest: the verifier surfaced possibly-unsupported claims. */}
      {flagged && (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs"
          data-testid="ai-quality-check-flags"
        >
          <div className="mb-1 flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Please review these — your source may not support them:
          </div>
          <ul className="list-disc space-y-1 pl-4">
            {result!.suspectClaims.map((c, i) => (
              <li key={i}>
                <span className="text-foreground">{c.claim}</span>
                {c.reason ? <span className="text-muted-foreground"> — {c.reason}</span> : null}
              </li>
            ))}
          </ul>
          {result!.correctedText && onAcceptCorrection && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-7 text-xs"
              data-testid="ai-quality-accept"
              onClick={() => onAcceptCorrection(result!.correctedText!)}
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              Use corrected version
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
