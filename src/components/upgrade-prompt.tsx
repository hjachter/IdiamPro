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
import { Crown, Sparkles } from 'lucide-react';
import {
  tierDisplayName,
  type SubscriptionTierId,
} from '@/lib/entitlements';

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

// Benefits shown per tier — mirrors the advertised pricing page
// (docs/outlines/IdiamPro-Marketing.idm). 'premium' is shown as "Power".
const TIER_BENEFITS: Record<SubscriptionTierId, string[]> = {
  free: [
    'Unlimited outlines & editing',
    'Local AI (Ollama) — unlimited',
    'Bring your own API key — unlimited',
  ],
  pro: [
    '100 outline generations / month',
    'Unlimited content expansions',
    'Cloud AI + premium AI features',
    'Premium website-export templates',
  ],
  premium: [
    'Unlimited AI generations',
    'Premium export & Universal Output formats',
    'Podcast generation',
    'Multi-LLM + priority processing',
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
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Checkout is coming soon — paid plans aren&apos;t purchasable in
              this build yet. We&apos;ll let you know the moment upgrading is
              available.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Maybe later
            </Button>
            {/* Placeholder CTA — task #22 (billing UI) will wire real checkout
                here. Until then it acknowledges intent without dead-ending. */}
            <Button onClick={() => setOpen(false)}>
              <Crown className="mr-2 h-4 w-4" />
              Upgrade ({tierLabel})
            </Button>
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
