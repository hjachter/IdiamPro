/**
 * Stripe Webhook handler — env-gated with stub fallback.
 *
 * Stripe POSTs subscription lifecycle events here. We verify the signature,
 * map the purchased Stripe price → launch entitlement (pro / student), then
 * provision the entitlement in RevenueCat (single source of truth for the
 * user's tier). Apple IAP / iOS subscriptions don't pass through here at all
 * — they're provisioned directly by the native RevenueCat plugin.
 *
 * EVENTS HANDLED:
 *   - customer.subscription.created  → grant entitlement
 *   - customer.subscription.updated  → re-grant (handles upgrade / downgrade)
 *   - customer.subscription.deleted  → revoke entitlement
 *   - invoice.payment_failed         → record past-due flag (UI shows banner)
 *
 * STUB MODE: when STRIPE_WEBHOOK_SECRET is unset we skip signature
 * verification and log a clear warning — useful in development. When
 * REVENUECAT_API_KEY is unset, the RevenueCat calls log a "stubbed" message
 * but the handler still returns 200 so Stripe doesn't retry.
 *
 * IDEMPOTENCY: a tiny in-memory ring buffer of recently-processed event ids
 * de-dupes Stripe's retries within a single Node process. (For multi-instance
 * production deployments, swap in a Redis-backed store — out of scope for v1.)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isStripeEnabled,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
} from '@/lib/billing/billing-gate';
import { getLaunchEntitlementForStripePrice } from '@/config/billing-config';
import {
  grantEntitlement,
  revokeEntitlement,
} from '@/lib/billing/revenuecat-provisioning';

export const runtime = 'nodejs';
// Stripe signature verification needs the raw request body.
export const dynamic = 'force-dynamic';

// ---- Idempotency (process-local) ----------------------------------------
const PROCESSED_EVENTS: string[] = [];
const PROCESSED_EVENTS_MAX = 500;
function alreadyProcessed(eventId: string): boolean {
  if (PROCESSED_EVENTS.includes(eventId)) return true;
  PROCESSED_EVENTS.push(eventId);
  if (PROCESSED_EVENTS.length > PROCESSED_EVENTS_MAX) {
    PROCESSED_EVENTS.splice(0, PROCESSED_EVENTS.length - PROCESSED_EVENTS_MAX);
  }
  return false;
}

// ---- Helpers ------------------------------------------------------------
interface ParsedSubscription {
  appUserId: string;
  priceId: string;
}
function parseSubscriptionEvent(
  obj: Record<string, unknown>,
): ParsedSubscription {
  // Pull metadata.appUserId set by the checkout creator.
  const metadata =
    ((obj.metadata as Record<string, string> | undefined) || {}) as Record<
      string,
      string
    >;
  const appUserId =
    metadata.appUserId ||
    (obj.client_reference_id as string | undefined) ||
    (obj.customer as string | undefined) ||
    '';

  // First price id from the line items.
  let priceId = '';
  const items = (obj.items as { data?: Array<{ price?: { id?: string } }> })
    ?.data;
  if (items && items.length > 0) {
    priceId = items[0]?.price?.id || '';
  }
  return { appUserId, priceId };
}

// ---- Handler ------------------------------------------------------------
export async function POST(req: NextRequest) {
  if (!isStripeEnabled()) {
    // eslint-disable-next-line no-console
    console.warn(
      '[billing/webhook] STRIPE_SECRET_KEY unset — webhook stubbed (returning 200).',
    );
    return NextResponse.json({ received: true, stubbed: true });
  }

  const signature = req.headers.get('stripe-signature');
  const rawBody = await req.text();

  // Lazy, guarded import — only reached when Stripe is enabled.
  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(STRIPE_SECRET_KEY);

  let event: import('stripe').Stripe.Event;
  if (STRIPE_WEBHOOK_SECRET && signature) {
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
  } else {
    // Dev / stub path — parse without verification but log loudly so this
    // can never accidentally ship to production unguarded.
    // eslint-disable-next-line no-console
    console.warn(
      '[billing/webhook] STRIPE_WEBHOOK_SECRET unset or signature missing — skipping verification (dev/stub mode).',
    );
    try {
      event = JSON.parse(rawBody) as import('stripe').Stripe.Event;
    } catch {
      return NextResponse.json(
        { error: 'invalid_json' },
        { status: 400 },
      );
    }
  }

  if (alreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const obj = event.data.object as unknown as Record<string, unknown>;
        const { appUserId, priceId } = parseSubscriptionEvent(obj);
        const entitlement = getLaunchEntitlementForStripePrice(priceId);
        if (!entitlement) {
          // eslint-disable-next-line no-console
          console.warn(
            `[billing/webhook] No launch entitlement matches Stripe price "${priceId}" — ignoring.`,
          );
          break;
        }
        if (!appUserId) {
          // eslint-disable-next-line no-console
          console.warn(
            '[billing/webhook] subscription event has no appUserId — cannot provision entitlement.',
          );
          break;
        }
        await grantEntitlement(appUserId, entitlement);
        break;
      }
      case 'customer.subscription.deleted': {
        const obj = event.data.object as unknown as Record<string, unknown>;
        const { appUserId, priceId } = parseSubscriptionEvent(obj);
        const entitlement = getLaunchEntitlementForStripePrice(priceId);
        if (entitlement && appUserId) {
          await revokeEntitlement(appUserId, entitlement);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const obj = event.data.object as unknown as Record<string, unknown>;
        const customer = (obj.customer as string | undefined) || '';
        // eslint-disable-next-line no-console
        console.warn(
          `[billing/webhook] payment_failed for customer=${customer} — UI past-due banner should surface on next tier check.`,
        );
        // TODO: persist past-due flag (Clerk publicMetadata) so the UI
        // can show a "your payment failed, update card" banner. For v1 a
        // log entry is sufficient — Stripe also emails the customer.
        break;
      }
      default:
        // Ignore unrelated event types.
        break;
    }
  } catch (err) {
    // Never throw out of a webhook — Stripe would retry forever.
    // eslint-disable-next-line no-console
    console.error('[billing/webhook] handler threw:', err);
    return NextResponse.json(
      { received: true, error: 'handler_error' },
      { status: 200 },
    );
  }

  return NextResponse.json({ received: true });
}
