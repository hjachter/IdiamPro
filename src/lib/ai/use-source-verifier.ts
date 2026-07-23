'use client';

/**
 * useSourceVerifier — client hook that runs the ALWAYS-ON hallucination
 * verifier after a factual AI generation and exposes its state to the wizard
 * dialogs (Export Email, Share to Social, Summarize, Import Email).
 *
 * The verify runs on-device (Ollama/Gemma) via verifyGenerationAction — $0 and
 * off the cloud meter — and degrades gracefully when on-device AI is absent.
 * A sequence guard makes sure a stale run can't overwrite a newer one.
 */

import { useCallback, useRef, useState } from 'react';
import { verifyGenerationAction } from '@/ai/flows/verify-against-source';
import type { VerifyResult } from '@/lib/ai/hallucination-verifier';

export function useSourceVerifier() {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const seq = useRef(0);

  const run = useCallback(
    async (source: string, output: string, kind?: string) => {
      const id = ++seq.current;
      setResult(null);
      setVerifying(true);
      try {
        const r = await verifyGenerationAction({ source, output, kind });
        if (seq.current === id) setResult(r);
      } catch {
        // Never let a verify error break the flow — just show the reminder.
        if (seq.current === id) {
          setResult({ ran: false, skippedReason: 'error', suspectClaims: [] });
        }
      } finally {
        if (seq.current === id) setVerifying(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    seq.current++;
    setResult(null);
    setVerifying(false);
  }, []);

  return { verifying, result, run, reset };
}
