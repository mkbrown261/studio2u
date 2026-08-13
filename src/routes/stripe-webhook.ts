// Stripe webhook handler — Phase 3 M5.
//
// This is what actually confirms a booking now that Cash App's manual
// "screenshot -> engineer eyeballs it -> approves" step is gone. Stripe calls this
// endpoint the moment a Checkout Session finishes (checkout.session.completed) or a
// PaymentIntent succeeds; we verify the signature, look up the booking by its stored
// Checkout Session id, and flip it straight to 'confirmed'.
//
// Raw body handling: signature verification needs the exact bytes Stripe signed, so
// this route reads the body with c.req.text() BEFORE anything else touches it (per
// Hono's own Stripe webhook example) — never c.req.json() first.

import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { getStripeClient } from '../lib/stripe'
import { getBookingByCheckoutSessionId, markBookingPaid } from '../lib/db'

export const stripeWebhookRoutes = new Hono<AppEnv>()

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
        const session = event.data.object as { id: string; payment_intent: string | null; payment_status: string }
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
        }
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
