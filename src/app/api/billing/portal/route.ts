/**
 * Stripe Customer Portal session creator — env-gated with stub fallback.
 *
 * POST { customerId?: string, userId?: string } -> { url, stub?: boolean }
 *
 * Returns a one-time URL for Stripe's hosted Customer Portal. The portal
 * lets a paid user cancel, change plan, update payment method, view
 * invoices — all without us building a custom UI.
 *
 * STUB MODE: when STRIPE_SECRET_KEY is unset (or no customerId can be
 * resolved), we return a stub URL pointing at /upgrade with a friendly
 * "portal not configured yet" param, so the Settings "Manage Subscription"
 * button works end-to-end before real Stripe wiring.
 *
 * iOS NOTE: this route is web/Electron-only. iOS subscription management
 * goes through Apple's own subscription settings (Settings → Apple ID →
 * Subscriptions), surfaced via the RevenueCat plugin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isStripeEnabled, STRIPE_SECRET_KEY } from '@/lib/billing/billing-gate';

export const runtime = 'nodejs';

interface PortalBody {
  /** Stripe Customer id (cus_...). Preferred. */
  customerId?: string;
  /** App user id — used to look up the customer when customerId is omitted. */
  userId?: string;
  returnUrl?: string;
}

export async function POST(req: NextRequest) {
  let body: PortalBody = {};
  try {
    body = (await req.json()) as PortalBody;
  } catch {
    body = {};
  }

  const origin =
    req.headers.get('origin') ||
    req.nextUrl.origin ||
    'http://localhost:9002';
  const returnUrl = body.returnUrl || `${origin}/`;

  if (!isStripeEnabled()) {
    // eslint-disable-next-line no-console
    console.warn(
      '[billing/portal] Stripe not configured — stubbing portal session.',
    );
    return NextResponse.json({
      url: `${origin}/upgrade?portal=stub`,
      stub: true,
      reason: 'STRIPE_SECRET_KEY unset',
    });
  }

  const customerId = body.customerId || '';
  if (!customerId) {
    // TODO: once the user → Stripe customer mapping lives in Clerk
    // publicMetadata, look it up by body.userId here. For v1 the client
    // passes customerId explicitly (read from RevenueCat / Clerk).
    return NextResponse.json({
      url: `${origin}/upgrade?portal=stub&reason=no-customer`,
      stub: true,
      reason: 'no_customer_mapping_yet',
    });
  }

  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(STRIPE_SECRET_KEY);

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Portal session failed.';
    // eslint-disable-next-line no-console
    console.error('[billing/portal] Stripe error:', message);
    return NextResponse.json(
      { error: 'stripe_error', message },
      { status: 502 },
    );
  }
}
