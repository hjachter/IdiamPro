'use client';

/**
 * Upgrade Prompt — the ONE friendly gate-hit UX for Auth Phase 3.
 *
 * Whenever an entitlement gate or a monthly AI quota blocks something, the
 * app shows this instead of hard-blocking or silently failing. It is a
 * friendly modal: plain-language reason + the plan benefits + an "Upgrade"
 * CTA.
 *
 * The CTA is a deliberate PLACEHOLDER: billing/checkout UI is task #22 and
 * is not built yet, so "Upgrade" does NOT dead-end or crash — it just shows
 * a "checkout coming soon" note alongside the plan benefits.
 *
 * SAFETY: this only ever appears when isEnforcementActive() is true (the
 * gates that call useUpgradePrompt() are themselves no-ops when enforcement
 * is off), so with no auth/billing keys the user never sees this at all.
 *
 * Usage:
 *   const { promptUpgrade } = useUpgradePrompt();
 *   if (!quota.allowed) { promptUpgrade({ reason: '...', requiredTier: 'pro' }); return; }
 */

import React, {
  createContext,
  useCallback,
  useContext,
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
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Crown, Sparkles, KeyRound } from 'lucide-react';
import {
  tierDisplayName,
  type SubscriptionTierId,
} from '@/lib/entitlements';

// LAUNCH DECISION (2026-07, approved by Howard — see Decisions Log): on
// iOS/iPad we hide the paid-purchase CTA at launch because Apple in-app
// purchase isn't wired yet; a broken/absent purchase path = App Store
// rejection. iOS users get ONLY the free bring-your-own-key path here.
// Reverse by removing this helper's use once Apple IAP is live.
function isNativeIOS(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cap = typeof window !== 'undefined' ? (window as any).Capacitor : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
  return !!cap?.isNativePlatform?.() && !isElectron;
}

export interface UpgradePromptOptions {
  /** Plain-language reason, e.g. "This is a Pro feature" or a quota message. */
  reason: string;
  /** Tier the user needs ('pro' or 'premium'). Drives the headline + benefits. */
  requiredTier: SubscriptionTierId;
  /** Optional title override. */
  title?: string;
}

interface UpgradePromptContextValue {
  promptUpgrade: (opts: UpgradePromptOptions) => void;
}

const UpgradePromptContext = createContext<UpgradePromptContextValue | null>(
  null,
);

// Benefits shown per tier — mirrors the live /upgrade page (Free / Student /
// Pro). The legacy 'premium' tier id remains in the type union for back-compat
// with older gate callers, but its benefits intentionally fall back to Pro so
// the modal never surfaces a dead "Power" tier.
const TIER_BENEFITS: Record<SubscriptionTierId, string[]> = {
  free: [
    'Unlimited outlines and editing',
    'Bring your own AI key (Gemini, OpenAI, Anthropic, Mistral, Groq)',
    'Local Ollama AI — on-device, free',
    'All core outliner features and export formats',
  ],
  pro: [
    '1,000 AI generations / month',
    'AI included — no API key needed',
    'Podcast generation (Pro-only)',
    'Image generation and description (Pro-only)',
    'Priority AI processing and email support',
  ],
  // Kept only to satisfy the type union; gate callers should pass 'pro'.
  // If a legacy caller still passes 'premium' the user sees the Pro benefits.
  premium: [
    '1,000 AI generations / month',
    'AI included — no API key needed',
    'Podcast generation (Pro-only)',
    'Image generation and description (Pro-only)',
    'Priority AI processing and email support',
  ],
};


export function UpgradePromptProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<UpgradePromptOptions | null>(null);

  const promptUpgrade = useCallback((next: UpgradePromptOptions) => {
    setOpts(next);
    setOpen(true);
  }, []);

  const value = useMemo<UpgradePromptContextValue>(
    () => ({ promptUpgrade }),
    [promptUpgrade],
  );

  const tierLabel = opts ? tierDisplayName(opts.requiredTier) : '';
  const benefits = opts ? TIER_BENEFITS[opts.requiredTier] : [];
  // On iOS the paid path is hidden at launch; only BYOK is offered.
  const hidePaid = isNativeIOS();

  return (
    <UpgradePromptContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              {opts?.title ?? `Upgrade to ${tierLabel}`}
            </DialogTitle>
            <DialogDescription>{opts?.reason}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{tierLabel}</Badge>
              <span className="text-sm text-muted-foreground">
                includes:
              </span>
            </div>
            <ul className="space-y-1.5 text-sm">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            {/* Never leave the user cornered into paying: the free BYOK path
                is always offered as an equal alternative to upgrading. */}
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
              Or get unlimited AI free — bring your own key. You pay your
              provider directly.
            </div>
            {!hidePaid && (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                Secure checkout via Stripe. Cancel anytime from Settings.
              </p>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Maybe later
            </Button>
            {/* Free BYOK path — deep-links the user to the AI key settings so
                they can get unlimited AI at zero cost instead of paying. */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                    aria-label="Get unlimited AI free — plug in your own Gemini or OpenAI key. You pay your provider directly; IdeaM takes nothing."
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(
                          new CustomEvent('open-ai-key-settings'),
                        );
                      }
                      setOpen(false);
                    }}
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    Use own key
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Get unlimited AI free — plug in your own Gemini or OpenAI key.
                  You pay your provider directly; IdeaM takes nothing.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {/* Real CTA — routes to /upgrade where the user picks a plan
                (Student vs Pro monthly vs Pro annual) and goes through
                Stripe Checkout (web/Electron). HIDDEN on iOS at launch (see
                decision comment at top of file) — iOS users use BYOK only. */}
            {!hidePaid && (
              <Button
                onClick={() => {
                  setOpen(false);
                  if (typeof window !== 'undefined') {
                    window.location.href = '/upgrade';
                  }
                }}
              >
                <Crown className="mr-2 h-4 w-4" />
                See plans
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UpgradePromptContext.Provider>
  );
}

export function useUpgradePrompt(): UpgradePromptContextValue {
  const ctx = useContext(UpgradePromptContext);
  if (!ctx) {
    // Defensive no-op: if a caller is somehow outside the provider, never
    // crash the app over a gate prompt — just do nothing.
    return { promptUpgrade: () => undefined };
  }
  return ctx;
}
