'use client';

/**
 * Upgrade Success — Stripe redirects here after a completed Checkout.
 *
 * On mount: calls refreshTier() (forces a re-fetch from the entitlement
 * source) so the next time the user opens the app, their new tier is live.
 * Then shows a friendly confirmation and a link back into the app.
 *
 * If query string contains stub=1, we surface a small "stub mode" notice so
 * test/dev environments make it obvious nothing real was charged.
 */

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Crown, GraduationCap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { refreshTier, _seedPaidTierForTest } from '@/lib/tier-detection';
import { getLaunchPlan } from '@/config/billing-config';

function UpgradeSuccessInner() {
  const params = useSearchParams();
  const planParam = params.get('plan') || '';
  const isStub = params.get('stub') === '1';
  const plan = useMemo(() => getLaunchPlan(planParam), [planParam]);
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // STUB MODE: simulate the entitlement landing in localStorage so the
      // rest of the app behaves as if the user is now paid. In production
      // this is a no-op — RevenueCat (via the webhook) is the source of
      // truth and refreshTier picks it up on its own.
      if (isStub && plan) {
        _seedPaidTierForTest(plan.entitlement === 'pro' ? 'pro' : 'student');
      }
      await refreshTier({ force: true });
      if (!cancelled) setRefreshing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isStub, plan]);

  const planLabel = plan?.displayName || 'your new plan';

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-16 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10">
          <CheckCircle2 className="h-10 w-10 text-blue-500" />
        </div>

        <h1 className="text-3xl font-bold lg:text-4xl">
          You&apos;re all set!
        </h1>
        <p className="mt-3 text-base text-muted-foreground lg:text-lg">
          Welcome to <strong>{planLabel}</strong>. Your new generation cap and
          features are now active.
        </p>

        {plan?.entitlement === 'pro' && (
          <div className="mt-6 flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-50/40 px-4 py-2 dark:bg-amber-950/20">
            <Crown className="h-4 w-4 text-amber-500" />
            <span className="text-sm">
              Pro features unlocked: Podcast generation, image generation,
              priority AI.
            </span>
          </div>
        )}
        {plan?.entitlement === 'student' && (
          <div className="mt-6 flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-50/40 px-4 py-2 dark:bg-indigo-950/20">
            <GraduationCap className="h-4 w-4 text-indigo-500" />
            <span className="text-sm">
              Student plan active — 200 AI generations / month.
            </span>
          </div>
        )}

        {isStub && (
          <div className="mt-6 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-left text-sm">
            <strong>Stub mode.</strong> Stripe is not configured in this
            environment, so no real charge was made. The app has been seeded
            with the new tier locally so you can test the flow.
          </div>
        )}

        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Button asChild size="lg" className="min-w-[200px]">
            <Link href="/">Open IdiamPro</Link>
          </Button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          {refreshing ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Syncing your subscription...
            </span>
          ) : (
            <>A receipt has been sent to your email. Manage your subscription anytime in Settings.</>
          )}
        </p>
      </div>
    </div>
  );
}

export default function UpgradeSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <UpgradeSuccessInner />
    </Suspense>
  );
}
