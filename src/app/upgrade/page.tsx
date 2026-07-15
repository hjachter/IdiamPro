'use client';

/**
 * Upgrade page — the canonical paid-tier comparison + purchase entry point
 * for web + Electron. iOS routes to the native RevenueCat purchase flow
 * instead (per App Store guideline 3.1.1, the iOS app cannot use Stripe).
 *
 * Three plans side-by-side: Free (BYOK) / Student / Pro. Pro shows monthly
 * AND annual pricing with a "save 25%" badge on the annual option. Clicking
 * any paid plan POSTs to /api/billing/checkout and redirects to Stripe
 * Checkout; on success Stripe redirects back to /upgrade/success.
 *
 * Mobile: three columns collapse to a single stacked column under md.
 *
 * Trust signals at the bottom: security badge ("payments processed by
 * Stripe — we never see your card"), money-back guarantee, App Store /
 * Web parity note. Real testimonials land post-launch; the slot reserves
 * the space.
 */

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, GraduationCap, Loader2, Shield, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getPlatformContext } from '@/lib/platform';
import type { LaunchPlanId } from '@/config/billing-config';

interface PlanCard {
  id: 'free' | 'student' | 'pro';
  badge?: string;
  name: string;
  tagline: string;
  monthlyPrice: string;
  monthlyPriceNote: string;
  annualPrice?: string;
  annualPriceNote?: string;
  primaryPlan?: LaunchPlanId;
  annualPlan?: LaunchPlanId;
  features: string[];
  cta: string;
  highlight?: boolean;
}

const PLANS: PlanCard[] = [
  {
    id: 'free',
    name: 'Free (BYOK)',
    tagline: 'Unlimited AI, free forever — bring your own key.',
    monthlyPrice: '$0',
    monthlyPriceNote: 'forever',
    features: [
      'Unlimited outlines and editing',
      'Bring your own AI key (Gemini, OpenAI, Anthropic, Mistral, Groq)',
      'Local Ollama AI (on-device, free)',
      'All core outliner features',
      'All export formats',
      'Mac, iPhone, web',
    ],
    cta: 'Use IDMPro Free',
  },
  {
    id: 'student',
    name: 'Student',
    tagline: '50% off for students. AI included.',
    monthlyPrice: '$4.99',
    monthlyPriceNote: '/month',
    primaryPlan: 'student-monthly',
    features: [
      'Everything in Free',
      'AI included — no API key needed',
      '200 AI generations / month',
      'Refresh from Web (citations)',
      'Translate (20+ languages)',
      'Email support',
      '.edu email + honor checkbox',
    ],
    cta: 'Get Student',
  },
  {
    id: 'pro',
    name: 'Pro',
    badge: 'Most popular',
    tagline: 'For serious researchers and teams.',
    monthlyPrice: '$9.99',
    monthlyPriceNote: '/month',
    annualPrice: '$89',
    annualPriceNote: '/year — save 25%',
    primaryPlan: 'pro-monthly',
    annualPlan: 'pro-annual',
    features: [
      'Everything in Student',
      '1,000 AI generations / month',
      'Podcast generation (Pro-only)',
      'Image generation & description (Pro-only)',
      'Priority AI processing',
      'Priority email support',
      'Team collaboration (coming soon)',
    ],
    cta: 'Upgrade to Pro',
    highlight: true,
  },
];

export default function UpgradePage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<LaunchPlanId | null>(null);

  const platform = useMemo(() => getPlatformContext(), []);
  const isIOSCapacitor = platform.runtime === 'capacitor-ios';

  const handleCheckout = useCallback(
    async (planId: LaunchPlanId) => {
      // iOS guideline 3.1.1: iOS app cannot use Stripe — route to the
      // native RevenueCat purchase flow instead. Today that flow is
      // stubbed; once the Capacitor plugin is wired, replace the toast
      // with a real `Purchases.purchasePackage(...)` call.
      if (isIOSCapacitor) {
        toast({
          title: 'In-app purchase',
          description:
            'On iOS, subscriptions go through Apple — opening the in-app purchase flow.',
        });
        // TODO (iOS phase): call the RevenueCat Capacitor plugin here.
        return;
      }
      setLoadingPlan(planId);
      try {
        const res = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(txt || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { url?: string; stub?: boolean };
        if (!data.url) throw new Error('No checkout URL returned.');
        // Stub paths route locally; real Stripe URLs are external.
        if (data.stub) {
          router.push(data.url.replace(/^https?:\/\/[^/]+/, ''));
        } else {
          window.location.href = data.url;
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not start checkout.';
        toast({
          title: 'Checkout error',
          description: message,
          variant: 'destructive',
        });
        setLoadingPlan(null);
      }
    },
    [isIOSCapacitor, router],
  );

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Back to IDMPro
          </Link>
          <h1 className="mt-4 text-3xl font-bold lg:text-5xl">
            Pick the plan that fits.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground lg:text-lg">
            Get unlimited AI, free forever — bring your own key and you pay your
            provider directly, we take nothing. Prefer AI included? Student and
            Pro add it in — cancel anytime.
          </p>
        </div>

        {/* Plan grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={
                'relative flex flex-col rounded-2xl border p-6 ' +
                (plan.highlight
                  ? 'border-amber-400/40 bg-amber-50/40 shadow-lg dark:bg-amber-950/20'
                  : 'border-border bg-card')
              }
            >
              {plan.badge && (
                <Badge
                  className="absolute -top-3 left-1/2 -translate-x-1/2"
                  variant="default"
                >
                  {plan.badge}
                </Badge>
              )}

              {/* Heading */}
              <div className="flex items-center gap-2">
                {plan.id === 'pro' && (
                  <Crown className="h-5 w-5 text-amber-500" />
                )}
                {plan.id === 'student' && (
                  <GraduationCap className="h-5 w-5 text-indigo-500" />
                )}
                {plan.id === 'free' && (
                  <Sparkles className="h-5 w-5 text-emerald-500" />
                )}
                <h2 className="text-xl font-semibold">{plan.name}</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.tagline}
              </p>

              {/* Price */}
              <div className="mt-5">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.monthlyPrice}</span>
                  <span className="text-sm text-muted-foreground">
                    {plan.monthlyPriceNote}
                  </span>
                </div>
                {plan.annualPrice && (
                  <div className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
                    or <strong>{plan.annualPrice}</strong>{' '}
                    {plan.annualPriceNote}
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="mt-5 space-y-2">
                {plan.id === 'free' ? (
                  <Button
                    asChild
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    <Link href="/">{plan.cta}</Link>
                  </Button>
                ) : isIOSCapacitor ? (
                  /* LAUNCH DECISION (2026-07, see Decisions Log): iOS hides
                     paid purchase buttons — Apple IAP isn't wired yet and a
                     broken purchase = rejection. iOS users are pointed to the
                     free BYOK path instead of a dead purchase button. */
                  <Button
                    asChild
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    <Link href="/">Use free with your own key</Link>
                  </Button>
                ) : (
                  <>
                    <Button
                      className="w-full"
                      size="lg"
                      variant={plan.highlight ? 'default' : 'outline'}
                      onClick={() =>
                        plan.primaryPlan && handleCheckout(plan.primaryPlan)
                      }
                      disabled={
                        !plan.primaryPlan ||
                        loadingPlan === plan.primaryPlan
                      }
                      data-testid={`cta-${plan.id}-primary`}
                    >
                      {loadingPlan === plan.primaryPlan ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {plan.cta}
                    </Button>
                    {plan.annualPlan && (
                      <Button
                        variant="ghost"
                        className="w-full"
                        size="sm"
                        onClick={() =>
                          plan.annualPlan && handleCheckout(plan.annualPlan)
                        }
                        disabled={loadingPlan === plan.annualPlan}
                        data-testid={`cta-${plan.id}-annual`}
                      >
                        {loadingPlan === plan.annualPlan ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Get annual ({plan.annualPrice}/yr — save 25%)
                      </Button>
                    )}
                  </>
                )}
              </div>

              {/* Features */}
              <ul className="mt-6 space-y-2.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Comparison table — compact, mobile-friendly */}
        <div className="mt-16">
          <h2 className="mb-4 text-center text-2xl font-semibold">
            Compare plans
          </h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left align-top">
                  <th className="p-3 font-medium w-[24%]">Feature</th>
                  <th className="p-3 font-medium">
                    <div className="font-semibold">Free trial</div>
                    <div className="text-xs font-normal text-muted-foreground mt-0.5">Try it, 25 AI uses</div>
                    <div className="text-xs font-normal mt-1">$0</div>
                  </th>
                  <th className="p-3 font-medium border-l">
                    <div className="font-semibold">Own it</div>
                    <div className="text-xs font-normal text-muted-foreground mt-0.5">Runs on your device &amp; your own key</div>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-normal">$29.99</span>
                      <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        $19.99 founder launch
                      </span>
                    </div>
                    <span className="mt-1 inline-flex items-center rounded-full border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Coming soon
                    </span>
                  </th>
                  <th className="p-3 font-medium border-l">
                    <div className="font-semibold">Pro</div>
                    <div className="text-xs font-normal text-muted-foreground mt-0.5">Premium cloud AI</div>
                    <div className="text-xs font-normal mt-1">$9.99/mo · $89/yr</div>
                  </th>
                  <th className="p-3 font-medium border-l">
                    <div className="font-semibold">BYOK</div>
                    <div className="text-xs font-normal text-muted-foreground mt-0.5">Your key, unlimited</div>
                    <div className="text-xs font-normal mt-1">Free</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  {
                    label: 'Core outlining',
                    sub: 'Unlimited outlines, drag-drop, tags & colors, search, export/share, backups, data protection',
                    cells: ['check', 'check', 'check', 'check'],
                  },
                  {
                    label: 'Everyday AI',
                    sub: 'Generate from a topic, reformat, translate, suggest tags, describe images, quick commands, Help chat',
                    cells: ['25 total', 'check', 'check', 'check'],
                  },
                  {
                    label: 'On-device / private AI',
                    sub: 'Notes never leave your device',
                    cells: ['—', 'check', 'check', 'check'],
                  },
                  {
                    label: 'Pro superpowers',
                    sub: 'Refresh from Web + citations, Research & Import, Transform Outline, Ask Your Outlines at scale, Podcast, Image generation, frontier cloud models',
                    cells: ['—', '—', 'check', '✓ with your key'],
                  },
                  {
                    label: 'Video / YouTube package',
                    sub: 'Turn outlines into video scripts and clips',
                    cells: ['—', '—', 'Coming soon (v1.1)', 'Coming soon'],
                  },
                  {
                    label: 'Generation caps / priority',
                    sub: 'How much AI you can run',
                    cells: ['25 total', 'Local / your key', 'High / unlimited + priority', 'Unlimited (your key)'],
                  },
                  {
                    label: 'Privacy',
                    sub: 'Where your data goes',
                    cells: ['Cloud trial', 'Stays on your device', 'Premium cloud, not trained on your data', 'Your provider, we never see it'],
                  },
                ].map((row, ri) => (
                  <tr key={ri} className="align-top">
                    <td className="p-3">
                      <div className="font-medium">{row.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{row.sub}</div>
                    </td>
                    {row.cells.map((cell, ci) => (
                      <td key={ci} className="p-3 border-l align-middle">
                        {cell === 'check' ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <span className={cell === '—' ? 'text-muted-foreground' : ''}>{cell}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            &ldquo;Own it&rdquo; one-time purchase is coming soon — start with the free trial or Pro today.
          </p>
        </div>

        {/* Trust signals */}
        <div className="mt-12 grid gap-4 text-center text-sm text-muted-foreground sm:grid-cols-3">
          <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4">
            <Shield className="h-5 w-5 text-emerald-500" />
            <strong className="text-foreground">Secure checkout</strong>
            <span>
              Payments processed by Stripe. We never see your card details.
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4">
            <Check className="h-5 w-5 text-emerald-500" />
            <strong className="text-foreground">Cancel anytime</strong>
            <span>
              Cancel from Settings &rarr; Manage Subscription. No questions
              asked.
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <strong className="text-foreground">Web + iOS + Mac</strong>
            <span>
              One subscription unlocks IDMPro everywhere you use it.
            </span>
          </div>
        </div>

        {/* iOS-only note */}
        {isIOSCapacitor && (
          <div className="mt-8 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm">
            <strong>On iPhone or iPad?</strong> IDMPro is free on iOS — bring
            your own AI key for unlimited AI at no cost. Paid plans (Student and
            Pro) are available on the web and Mac apps for now.
          </div>
        )}
      </div>
    </div>
  );
}
