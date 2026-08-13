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

// Creates a new connected account for an engineer who doesn't have one yet, using
// Stripe's Accounts v2 API (/v2/core/accounts) — the current, non-deprecated way to
// create Connect accounts (v1 stripe.accounts.create() is blocked by Stripe for any
// brand-new Connect platform: "Stripe no longer recommends Accounts v1 for new
// Connect integrations. Create connected accounts with POST /v2/core/accounts
// instead.").
//
// Studio2U only ever charges customers directly on the platform account and then
// moves money to the engineer via Checkout's transfer_data.destination — it never
// creates direct charges or destination charges with on_behalf_of, and it never
// needs the connected account to accept card payments itself. That means the engineer
// only needs the `recipient` configuration (receive transfers into their Stripe
// balance), not `merchant` (which is for accounts that themselves process card
// payments). See https://docs.stripe.com/connect/marketplace/tasks/create.
//
// dashboard: 'express' gives the engineer the same hosted Express Dashboard UX as
// before. Because Studio2U (the platform), not the engineer, absorbs Stripe's fees
// and any negative-balance risk, both responsibilities must be 'application'
// (Express dashboards require this pairing — see error
// account_controller_express_dash_without_application_losses_or_fees).
export async function createConnectAccount(
  stripe: Stripe,
  params: { email: string; name: string }
): Promise<string> {
  const account = await stripe.v2.core.accounts.create({
    contact_email: params.email,
    display_name: params.name,
    dashboard: 'express',
    identity: {
      country: 'us'
    },
    defaults: {
      responsibilities: {
        fees_collector: 'application',
        losses_collector: 'application'
      }
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { requested: true }
          }
        }
      }
    },
    include: ['configuration.recipient', 'identity', 'requirements']
  })
  return account.id
}

// Generates a fresh, single-use onboarding link. Must be called every time the
// engineer clicks "Connect with Stripe" (or "Finish onboarding") — links expire
// after a short time and can't be reused. Uses the v2 account_links endpoint
// (/v2/core/account_links), the v2 counterpart of v1's stripe.accountLinks.create().
export async function createAccountOnboardingLink(
  stripe: Stripe,
  accountId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<string> {
  const link = await stripe.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: 'account_onboarding',
      account_onboarding: {
        // Must match the configuration(s) actually enabled on the account above.
        configurations: ['recipient'],
        return_url: returnUrl,
        refresh_url: refreshUrl
      }
    }
  })
  return link.url
}

// Re-checks the live status of a connected account against Stripe (call this when
// the engineer lands back on /dashboard/payments after onboarding, since Stripe
// doesn't push a webhook for every intermediate onboarding step).
//
// v2 accounts don't have v1's flat charges_enabled/details_submitted booleans.
// Instead, the recipient configuration's transfer capability has its own status
// ('active' | 'pending' | 'restricted' | 'unsupported'), and outstanding onboarding
// items show up as entries in `requirements.entries`. See
// https://docs.stripe.com/connect/end-to-end-marketplace — "check if
// configuration.recipient.capabilities.stripe_balance.stripe_transfers.status is
// active... if status_details.code is requirements_past_due, prompt the user to
// continue onboarding."
//
// We map that back onto the same two-boolean shape the rest of the app (D1 columns
// stripe_charges_enabled / stripe_onboarding_complete, updateEngineerStripeStatus())
// already expects, so no downstream code needs to change:
//   - chargesEnabled  -> transfers capability status is 'active'
//   - detailsSubmitted -> no outstanding requirement entries left
export async function getAccountStatus(
  stripe: Stripe,
  accountId: string
): Promise<{ chargesEnabled: boolean; detailsSubmitted: boolean }> {
  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ['configuration.recipient', 'requirements']
  })
  const transfersStatus = account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status
  const chargesEnabled = transfersStatus === 'active'
  const hasOutstandingRequirements = (account.requirements?.entries ?? []).length > 0
  return {
    chargesEnabled,
    detailsSubmitted: !hasOutstandingRequirements
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
