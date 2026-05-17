/**
 * Stripe Webhook handler — env-gated.
 *
 * Stripe POSTs subscription lifecycle events here (checkout completed,
 * subscription updated/cancelled). We verify the signature, map the
 * purchased Stripe price back to a subscription tier, and (later phase)
 * persist that tier onto the user so Phase 1's tier resolution picks it up.
 *
 * GATING: when isStripeEnabled() is false (no STRIPE_SECRET_KEY) this
 * early-returns a clean 503 and the Stripe SDK is NEVER imported — zero
 * runtime change from today. The `stripe` package is dynamically imported
 * INSIDE the handler only on the enabled path. The signature is verified
 * with STRIPE_WEBHOOK_SECRET whenever Stripe is enabled.
 *
 * Phase 2: scaffolding. The tier is resolved and logged; persisting it to
 * the user record lands with the auth/billing wiring in a later phase.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isStripeEnabled,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
} from '@/lib/billing/billing-gate';
import { getTierForStripePrice } from '@/config/billing-config';

export const runtime = 'nodejs';
// Stripe signature verification needs the raw request body.
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isStripeEnabled()) {
    return NextResponse.json(
      {
        error: 'billing_not_configured',
        message: 'Billing is not configured.',
      },
      { status: 503 },
    );
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      {
        error: 'webhook_secret_missing',
        message: 'STRIPE_WEBHOOK_SECRET is not set.',
      },
      { status: 503 },
    );
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json(
      { error: 'missing_signature' },
      { status: 400 },
    );
  }

  const rawBody = await req.text();

  // Lazy, guarded import — only reached when Stripe is enabled.
  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(STRIPE_SECRET_KEY);

  let event: import('stripe').Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Signature verification failed.';
    return NextResponse.json(
      { error: 'invalid_signature', message },
      { status: 400 },
    );
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      // Extract the purchased price id from the event, then map -> tier.
      const obj = event.data.object as unknown as Record<string, unknown>;
      let priceId = '';
      const items = (obj?.items as { data?: Array<{ price?: { id?: string } }> })
        ?.data;
      if (items && items.length > 0) {
        priceId = items[0]?.price?.id || '';
      }
      const tier = getTierForStripePrice(priceId);
      // TODO (later phase): persist `tier` onto the user (Clerk
      // publicMetadata keyed by client_reference_id) so Phase 1's
      // resolveCurrentTier / resolveTierFromBilling returns it. For now we
      // resolve it to prove the mapping wiring is correct.
      void tier;
      break;
    }
    default:
      // Ignore unrelated event types.
      break;
  }

  return NextResponse.json({ received: true });
}
