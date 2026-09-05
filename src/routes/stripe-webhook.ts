// Stripe webhook handler — Phase 3 M5.
//
// This is what actually confirms a booking now that Cash App's manual
// "screenshot -> engineer eyeballs it -> approves" step is gone. Stripe calls this
// endpoint the moment a Checkout Session finishes (checkout.session.completed) or a
// PaymentIntent succeeds; we verify the signature, look up the booking by its stored
// Checkout Session id, and flip it straight to 'confirmed'.
//
// Also handles the ENGINEER SUBSCRIPTION (Free/Pro/Elite) lifecycle — see
// lib/subscriptions.ts and lib/stripe.ts's createSubscriptionCheckoutSession. This is a
// separate mode='subscription' Checkout flow on the platform's own Stripe account (not
// Connect), so it gets its own event cases below rather than being folded into the
// booking-payment case.
//
// Raw body handling: signature verification needs the exact bytes Stripe signed, so
// this route reads the body with c.req.text() BEFORE anything else touches it (per
// Hono's own Stripe webhook example) — never c.req.json() first.

import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { getStripeClient } from '../lib/stripe'
import { getBookingByCheckoutSessionId, markBookingPaid } from '../lib/db'
import {
  getEngineerByStripeSubscriptionId,
  setEngineerSubscription,
  scheduleSubscriptionDowngrade
} from '../lib/db-engineers'
import { debitAccountCreditForBooking } from '../lib/db-referrals'

export const stripeWebhookRoutes = new Hono<AppEnv>()

// Stripe's API version pinned by this SDK build (2026-07-29.dahlia) moved
// current_period_end off the top-level Subscription object and onto each
// subscription item instead (multi-item subscriptions can each have their own
// billing period). We only ever put one item on a subscription, so item[0] is it.
function currentPeriodEndIso(subscription: {
  items?: { data?: Array<{ current_period_end?: number }> }
}): string | null {
  const unixSeconds = subscription.items?.data?.[0]?.current_period_end
  return typeof unixSeconds === 'number' ? new Date(unixSeconds * 1000).toISOString() : null
}

stripeWebhookRoutes.post('/api/stripe/webhook', async (c) => {
  const secretKey = c.env.STRIPE_SECRET_KEY
  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET

  if (!secretKey || !webhookSecret) {
    console.error('Stripe webhook received but STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET not configured.')
    return c.text('Stripe not configured', 500)
  }

  const signature = c.req.header('stripe-signature')
  if (!signature) {
    return c.text('Missing stripe-signature header', 400)
  }

  const stripe = getStripeClient(secretKey)
  const body = await c.req.text()

  let event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('Stripe webhook signature verification failed', err)
    return c.text('Invalid signature', 400)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as {
          id: string
          mode: string
          payment_intent: string | null
          payment_status: string
          subscription: string | null
          metadata: Record<string, string> | null
        }

        // Two totally different Checkout flows share this one event type — branch on
        // `mode` first. mode='payment' is a booking; mode='subscription' is an
        // engineer Pro/Elite subscription purchase.
        if (session.mode === 'subscription') {
          // Don't act on the tier here at all — customer.subscription.updated fires
          // right alongside this with the authoritative, fully-populated Subscription
          // object (status, current_period_end, etc). Acting on BOTH events would just
          // mean duplicate work for no benefit, so subscription tier changes are
          // handled entirely in the 'customer.subscription.updated' case below.
          break
        }

        if (session.payment_status !== 'paid') break

        const booking = await getBookingByCheckoutSessionId(c.env.DB, session.id)
        if (!booking) {
          console.error(`Stripe webhook: no booking found for checkout session ${session.id}`)
          break
        }
        // Idempotent — a Stripe webhook can legitimately be redelivered.
        if (booking.status === 'pending_payment') {
          await markBookingPaid(c.env.DB, booking.id, {
            paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : ''
          })

          // Debit the customer's account_credits ledger now that payment is confirmed —
          // never at booking-creation time, so an abandoned/cancelled checkout never
          // actually spends the credit (mirrors why markBookingPaid() itself only fires
          // here). credit_applied_cents was locked onto the booking row at creation time
          // (see /api/bookings in index.tsx) and customer_user_id must be present since
          // guest checkout can't apply credit in the first place.
          if (booking.credit_applied_cents > 0 && booking.customer_user_id) {
            await debitAccountCreditForBooking(c.env.DB, {
              userId: booking.customer_user_id,
              bookingId: booking.id,
              amountCents: booking.credit_applied_cents
            })
          }
        }
        break
      }

      // Fires on subscription creation AND every later change (renewal, plan swap,
      // Billing Portal cancel-at-period-end toggle). This is the single source of
      // truth for "what tier is this engineer on right now" — we deliberately don't
      // try to infer anything from checkout.session.completed for subscriptions (see
      // above).
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as {
          id: string
          status: string
          cancel_at_period_end: boolean
          metadata: Record<string, string> | null
          items?: { data?: Array<{ current_period_end?: number }> }
        }

        const engineerProfileId = subscription.metadata?.engineer_profile_id
          ? parseInt(subscription.metadata.engineer_profile_id, 10)
          : null
        if (!engineerProfileId || Number.isNaN(engineerProfileId)) {
          console.error(`Stripe webhook: subscription ${subscription.id} has no engineer_profile_id metadata`)
          break
        }

        const tier = subscription.metadata?.tier === 'elite' ? 'elite' : subscription.metadata?.tier === 'pro' ? 'pro' : null
        const period = subscription.metadata?.period === 'annual' ? 'annual' : 'monthly'
        const periodEnd = currentPeriodEndIso(subscription)

        if (!tier) {
          console.error(`Stripe webhook: subscription ${subscription.id} metadata missing/invalid tier`)
          break
        }

        if (subscription.cancel_at_period_end) {
          // Portal cancellation: keep current (paid) tier's benefits active until
          // period end, then drop to Free. We do NOT flip subscription_tier here —
          // scheduleSubscriptionDowngrade only sets the pending_tier + cancel flag;
          // the actual downgrade happens via customer.subscription.deleted (below) or
          // the lazy applyScheduledDowngradeIfDue safety net on dashboard load.
          await scheduleSubscriptionDowngrade(c.env.DB, engineerProfileId, {
            pendingTier: 'free',
            periodEnd
          })
        } else if (subscription.status === 'active' || subscription.status === 'trialing') {
          await setEngineerSubscription(c.env.DB, engineerProfileId, {
            tier,
            billingPeriod: period,
            status: subscription.status,
            subscriptionId: subscription.id,
            periodEnd
          })
        } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
          // Payment failing — keep the tier as-is (Stripe/the Portal will keep retrying
          // per the platform's dunning settings) but record the status so it's visible
          // on the engineer's own subscription page if we ever want to surface it.
          await setEngineerSubscription(c.env.DB, engineerProfileId, {
            tier,
            billingPeriod: period,
            status: subscription.status,
            subscriptionId: subscription.id,
            periodEnd
          })
        }
        break
      }

      // Stripe itself has fully ended the subscription (final state after
      // cancel-at-period-end actually elapses, or an immediate admin-side cancel).
      // Drop straight to Free now rather than waiting on the lazy dashboard-load
      // safety net.
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as { id: string; metadata: Record<string, string> | null }
        const metaId = subscription.metadata?.engineer_profile_id
          ? parseInt(subscription.metadata.engineer_profile_id, 10)
          : null

        // Prefer metadata (cheap, no extra lookup); fall back to matching by the
        // stored stripe_subscription_id in case metadata is ever missing.
        let targetId: number | null = metaId && !Number.isNaN(metaId) ? metaId : null
        if (!targetId) {
          const profile = await getEngineerByStripeSubscriptionId(c.env.DB, subscription.id)
          targetId = profile?.id ?? null
        }
        if (!targetId) {
          console.error(`Stripe webhook: subscription.deleted ${subscription.id} — could not resolve engineer_profile_id`)
          break
        }

        await setEngineerSubscription(c.env.DB, targetId, {
          tier: 'free',
          billingPeriod: null,
          status: null,
          subscriptionId: null,
          periodEnd: null
        })
        break
      }

      default:
        break
    }
    return c.text('', 200)
  } catch (err) {
    console.error('Stripe webhook handler error', err)
    // Return 200 anyway once signature is verified — a handler bug shouldn't make
    // Stripe retry forever; we log it above for investigation instead.
    return c.text('', 200)
  }
})
