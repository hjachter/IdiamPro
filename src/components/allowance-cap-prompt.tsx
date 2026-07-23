'use client';

/**
 * Three-Door AI Allowance Cap Prompt.
 *
 * Shown when a VERIFIED PAID user reaches their monthly company-AI allowance
 * (enforced server-side by src/lib/billing/ai-usage-meter.ts). It is pleasant,
 * non-blocking, and NEVER a dead end — it always offers three ways forward:
 *
 *   (a) Bring your own API key (BYOK) — free to us, unlimited for them.
 *   (b) Buy an overage pack — more allowance this month. (PLACEHOLDER: the
 *       RevenueCat/Stripe overage SKUs aren't wired yet, so this door is
 *       clearly labeled "coming soon" and does not dead-end.)
 *   (c) Keep going on on-device AI — the free local Ollama/Gemma model.
 *
 * How it opens: it listens for the window CustomEvent
 * 'open-allowance-cap-prompt' (so any AI entry point that receives the
 * server's over-allowance signal can raise it) and also exposes a
 * useAllowanceCapPrompt() hook for direct callers. Because the meter's
 * "subscriptions verified" switch is OFF at launch, no real user can reach the
 * allowance yet — this UI is ready-but-dormant until paid subscriptions are
 * verified server-side.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { KeyRound, Cpu, PackagePlus, Sparkles } from 'lucide-react';

export interface AllowanceCapPromptOptions {
  /** Optional plain-language context, e.g. how many generations were included. */
  reason?: string;
  /** The tier's monthly allowance, for a friendly "X of Y used" style line. */
  limit?: number;
}

interface AllowanceCapContextValue {
  promptCap: (opts?: AllowanceCapPromptOptions) => void;
}

const AllowanceCapContext = createContext<AllowanceCapContextValue | null>(null);

/** Fire a window event other modules already understand, then close. */
function emit(eventName: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventName));
  }
}

export function AllowanceCapPromptProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<AllowanceCapPromptOptions | null>(null);

  const promptCap = useCallback((next?: AllowanceCapPromptOptions) => {
    setOpts(next ?? null);
    setOpen(true);
  }, []);

  // Allow any AI entry point to raise the prompt by dispatching a window event.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | AllowanceCapPromptOptions
        | undefined;
      promptCap(detail);
    };
    window.addEventListener('open-allowance-cap-prompt', handler);
    return () =>
      window.removeEventListener('open-allowance-cap-prompt', handler);
  }, [promptCap]);

  const value = useMemo<AllowanceCapContextValue>(
    () => ({ promptCap }),
    [promptCap],
  );

  const reason =
    opts?.reason ??
    "You've used this month's included AI generations. Here are three ways to keep going — pick whatever suits you.";

  return (
    <AllowanceCapContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              You&apos;ve reached this month&apos;s AI allowance
            </DialogTitle>
            <DialogDescription>{reason}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            {/* Door (a): BYOK — free to us, unlimited for them. */}
            <button
              type="button"
              onClick={() => {
                emit('open-ai-key-settings');
                setOpen(false);
              }}
              className="flex w-full items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-left transition hover:bg-emerald-500/10"
            >
              <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <span className="block text-sm font-semibold">
                  Use your own key
                </span>
                <span className="block text-xs text-muted-foreground">
                  Add your own AI key for unlimited use. You pay your provider
                  directly; we take nothing.
                </span>
              </span>
            </button>

            {/* Door (b): Overage pack — PLACEHOLDER until SKUs are wired. */}
            <button
              type="button"
              onClick={() => {
                emit('open-overage-packs');
                setOpen(false);
              }}
              className="flex w-full items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-left transition hover:bg-muted"
            >
              <PackagePlus className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  Add an overage pack
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    Coming soon
                  </span>
                </span>
                <span className="block text-xs text-muted-foreground">
                  Top up more generations this month at the same fair rate.
                  Available shortly.
                </span>
              </span>
            </button>

            {/* Door (c): On-device AI — always free. */}
            <button
              type="button"
              onClick={() => {
                emit('switch-to-on-device-ai');
                setOpen(false);
              }}
              className="flex w-full items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-left transition hover:bg-muted"
            >
              <Cpu className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
              <span>
                <span className="block text-sm font-semibold">
                  Keep going on-device
                </span>
                <span className="block text-xs text-muted-foreground">
                  Switch to the free on-device AI (Ollama/Gemma). Runs locally,
                  no allowance, no cost.
                </span>
              </span>
            </button>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Maybe later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AllowanceCapContext.Provider>
  );
}

export function useAllowanceCapPrompt(): AllowanceCapContextValue {
  const ctx = useContext(AllowanceCapContext);
  if (!ctx) {
    // Defensive no-op: never crash the app over a prompt if used outside the
    // provider.
    return { promptCap: () => undefined };
  }
  return ctx;
}
