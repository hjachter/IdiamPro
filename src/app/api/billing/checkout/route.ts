/**
 * Stripe Checkout Session creator — env-gated with stub fallback.
 *
 * POST { planId: LaunchPlanId, userId?: string } -> { url, stub?: boolean }
 *
 * The client receives a Stripe-hosted Checkout URL it should redirect to.
 * Payment + subscription provisioning happens on Stripe's side; our webhook
 * (src/app/api/billing/webhook/route.ts) then provisions the entitlement
 * inside RevenueCat (single source of truth for tier).
 *
 * GATING / STUB MODE:
 *   - When STRIPE_SECRET_KEY is unset OR the plan's Stripe price id is unset,
 *     the route logs a clear "Stripe not configured — stubbing response"
 *     message and returns a mocked success URL (`/upgrade/success?stub=1`).
 *     This lets the rest of the launch infrastructure (the /upgrade page,
 *     the success/cancel pages, the Settings "Manage Subscription" button)
 *     work end-to-end before Howard wires the real Stripe keys.
 *   - When configured, the `stripe` package is dynamically imported INSIDE
 *     the handler so a missing key can never throw at module load.
 *
 * iOS REMINDER (App Store guideline 3.1.1): the iOS app must NOT call this
 * route. iOS purchases go through RevenueCat → Apple IAP. This route is for
 * web + Electron (desktop) only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isStripeEnabled, STRIPE_SECRET_KEY } from '@/lib/billing/billing-gate';
import {
  getLaunchPlan,
  STRIPE_PUBLISHABLE_KEY,
} from '@/config/billing-config';

export const runtime = 'nodejs';

interface CheckoutBody {
  planId?: string;
  userId?: string;
  /** Optional success/cancel overrides (used by tests). */
  successUrl?: string;
  cancelUrl?: string;
}

function stubResponse(planId: string, origin: string, reason: string) {
  // eslint-disable-next-line no-console
  console.warn(
    `[billing/checkout] Stripe not configured (${reason}) — stubbing response for plan "${planId}".`,
  );
  return NextResponse.json({
    url: `${origin}/upgrade/success?stub=1&plan=${encodeURIComponent(planId)}`,
    stub: true,
    reason,
  });
}

export async function POST(req: NextRequest) {
  let body: CheckoutBody = {};
  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    body = {};
  }

  const planId = (body.planId || '').toString();
  const plan = getLaunchPlan(planId);
  if (!plan) {
    return NextResponse.json(
      {
        error: 'invalid_plan',
        message:
          'planId must be one of: pro-monthly, pro-annual, student-monthly.',
      },
      { status: 400 },
    );
  }

  const origin =
    req.headers.get('origin') ||
    req.nextUrl.origin ||
    'http://localhost:9002';

  // Stub paths — keep the rest of the launch UX working before real keys.
  if (!isStripeEnabled()) {
    return stubResponse(plan.id, origin, 'STRIPE_SECRET_KEY unset');
  }
  if (!plan.stripePriceId) {
    return stubResponse(
      plan.id,
      origin,
      `price id env var unset for ${plan.id}`,
    );
  }

  // Lazy, guarded import — only reached when Stripe is enabled.
  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(STRIPE_SECRET_KEY);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url:
        body.successUrl ||
        `${origin}/upgrade/success?session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(plan.id)}`,
      cancel_url: body.cancelUrl || `${origin}/upgrade/cancel`,
      // client_reference_id is what the webhook uses to map the payment back
      // to the app user when it provisions the RevenueCat entitlement.
      client_reference_id: body.userId || undefined,
      metadata: {
        planId: plan.id,
        entitlement: plan.entitlement,
        appUserId: body.userId || '',
      },
      subscription_data: {
        metadata: {
          planId: plan.id,
          entitlement: plan.entitlement,
          appUserId: body.userId || '',
        },
      },
      // Apple Pay + Google Pay surface automatically when Stripe is
      // configured for them — no extra wiring needed.
      allow_promotion_codes: true,
    });
    return NextResponse.json({
      url: session.url,
      publishableKey: STRIPE_PUBLISHABLE_KEY,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Stripe checkout failed.';
    // eslint-disable-next-line no-console
    console.error('[billing/checkout] Stripe error:', message);
    return NextResponse.json(
      { error: 'stripe_error', message },
      { status: 502 },
    );
  }
}
