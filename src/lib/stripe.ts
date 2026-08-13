// Stripe Connect (Express) integration — Phase 3 M5.
//
// Model: Studio2U is the "platform" Stripe account. Each engineer gets their own
// Connect Express account (Stripe hosts all the identity/bank-account onboarding —
// we never touch that data). Customers pay through a Stripe Checkout Session for the
// full booking price; Stripe automatically splits the charge at settlement:
//   - platform_fee (application_fee_amount) stays with the Studio2U platform account
//   - the remainder (engineer_payout) is transferred straight to the engineer's
//     connected account via transfer_data.destination
// No manual "upload a screenshot, engineer eyeballs it" step anymore — a webhook
// (see src/routes/stripe-webhook.ts) confirms payment and auto-confirms the booking.
//
// Uses the Stripe Node SDK's native Cloudflare Workers build (stripe.esm.worker.js,
// selected automatically via the package's "workerd" export condition) — fetch-based
// HTTP client + Web Crypto, no Node APIs.

import Stripe from 'stripe'

export function getStripeClient(secretKey: string): Stripe {
  // No explicit apiVersion override — uses the version pinned by the installed
  // stripe-node SDK itself (see node_modules/stripe/.../apiVersion.js), which is
  // the version this integration was written/tested against.
  return new Stripe(secretKey)
}

// ---------- Connect onboarding ----------

// Creates a new Express connected account for an engineer who doesn't have one yet.
// Express = Stripe hosts the entire onboarding form (identity, bank account, TOS).
export async function createConnectAccount(
  stripe: Stripe,
  params: { email: string; name: string }
): Promise<string> {
  const account = await stripe.accounts.create({
    type: 'express',
    email: params.email,
    business_type: 'individual',
    business_profile: {
      // "Recording engineer" services rendered through the Studio2U marketplace —
      // helps Stripe's risk review match declared activity to actual charge volume.
      product_description: 'Mobile audio recording engineering services booked through the Studio2U marketplace'
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true }
    }
  })
  return account.id
}

// Generates a fresh, single-use onboarding link. Must be called every time the
// engineer clicks "Connect with Stripe" (or "Finish onboarding") — links expire
// after a short time and can't be reused.
export async function createAccountOnboardingLink(
  stripe: Stripe,
  accountId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    return_url: returnUrl,
    refresh_url: refreshUrl
  })
  return link.url
}

// Re-checks the live status of a connected account against Stripe (call this when
// the engineer lands back on /dashboard/payments after onboarding, since Stripe
// doesn't push a webhook for every intermediate onboarding step).
export async function getAccountStatus(
  stripe: Stripe,
  accountId: string
): Promise<{ chargesEnabled: boolean; detailsSubmitted: boolean }> {
  const account = await stripe.accounts.retrieve(accountId)
  return {
    chargesEnabled: !!account.charges_enabled,
    detailsSubmitted: !!account.details_submitted
  }
}

// ---------- Checkout ----------

// Creates a Checkout Session for a booking's full price. Stripe collects the full
// amount from the customer, then automatically:
//   - keeps `platformFeeCents` for the Studio2U platform account
//   - transfers the remainder to the engineer's connected account (transfer_data.destination)
// This happens atomically at charge time — no manual payout step, no risk of the
// platform forgetting to pay an engineer out.
export async function createBookingCheckoutSession(
  stripe: Stripe,
  params: {
    bookingId: number
    engineerStripeAccountId: string
    grossAmountCents: number
    platformFeeCents: number
    customerEmail: string
    description: string
    successUrl: string
    cancelUrl: string
  }
): Promise<{ sessionId: string; url: string }> {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: params.customerEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: params.grossAmountCents,
          product_data: {
            name: 'Studio2U Recording Session',
            description: params.description
          }
        },
        quantity: 1
      }
    ],
    payment_intent_data: {
      application_fee_amount: params.platformFeeCents,
      transfer_data: {
        destination: params.engineerStripeAccountId
      },
      metadata: {
        booking_id: String(params.bookingId)
      }
    },
    metadata: {
      booking_id: String(params.bookingId)
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl
  })

  if (!session.url) {
    throw new Error('Stripe did not return a Checkout URL.')
  }

  return { sessionId: session.id, url: session.url }
}

// Dollars -> integer cents, the unit Stripe's API requires everywhere.
export function toCents(amountDollars: number): number {
  return Math.round(amountDollars * 100)
}
