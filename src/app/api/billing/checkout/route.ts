/**
 * Stripe Checkout Session creator — env-gated.
 *
 * POST { tier: 'pro' | 'premium' } -> { url } (Stripe-hosted checkout).
 *
 * GATING: when isStripeEnabled() is false (no STRIPE_SECRET_KEY) this
 * early-returns a clean 503 "billing not configured" and the Stripe SDK is
 * NEVER imported — there is zero runtime change from today. The `stripe`
 * package is dynamically imported INSIDE the handler only on the enabled
 * path, so a missing key can never throw at module load.
 *
 * Phase 2: no UI calls this yet (pricing/checkout UI is task #22). This
 * route exists so the billing wiring is in place and verifiable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isStripeEnabled, STRIPE_SECRET_KEY } from '@/lib/billing/billing-gate';
import {
  getStripePriceForTier,
  STRIPE_PUBLISHABLE_KEY,
} from '@/config/billing-config';
import type { SubscriptionTierId } from '@/config/subscription-tiers';

export const runtime = 'nodejs';

function billingDisabledResponse() {
  return NextResponse.json(
    { error: 'billing_not_configured', message: 'Billing is not configured.' },
    { status: 503 },
  );
}

export async function POST(req: NextRequest) {
  if (!isStripeEnabled()) {
    return billingDisabledResponse();
  }

  let body: { tier?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const tier = (body.tier || '') as SubscriptionTierId;
  if (tier !== 'pro' && tier !== 'premium') {
    return NextResponse.json(
      { error: 'invalid_tier', message: 'tier must be "pro" or "premium".' },
      { status: 400 },
    );
  }

  const priceId = getStripePriceForTier(tier);
  if (!priceId) {
    // Stripe is enabled but this tier's price id env var is unset.
    return NextResponse.json(
      {
        error: 'price_not_configured',
        message: `No Stripe price configured for tier "${tier}".`,
      },
      { status: 503 },
    );
  }

  // Lazy, guarded import — only reached when Stripe is enabled.
  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(STRIPE_SECRET_KEY);

  const origin =
    req.headers.get('origin') ||
    req.nextUrl.origin ||
    'http://localhost:9002';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?billing=success`,
      cancel_url: `${origin}/?billing=cancelled`,
      // TODO (later phase): set client_reference_id / customer to the
      // signed-in Clerk user id so the webhook can map the payment back to
      // the user and update their tier metadata.
    });
    return NextResponse.json({
      url: session.url,
      publishableKey: STRIPE_PUBLISHABLE_KEY,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Stripe checkout failed.';
    return NextResponse.json(
      { error: 'stripe_error', message },
      { status: 502 },
    );
  }
}
