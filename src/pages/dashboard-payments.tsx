import type { EngineerProfile } from '../lib/db-engineers'

export function DashboardPaymentsPage({
  profile,
  error
}: {
  profile: EngineerProfile
  error?: string
}) {
  const connected = !!profile.stripe_account_id
  const chargesEnabled = profile.stripe_charges_enabled === 1

  return (
    <div class="max-w-2xl mx-auto px-5 py-12">
      <div class="mb-8">
        <a href="/dashboard" class="text-sm text-muted hover:text-gold transition"><i class="fa-solid fa-arrow-left mr-1"></i> Back to Dashboard</a>
        <h1 class="font-display text-3xl font-bold mt-4">Payments</h1>
        <p class="text-muted mt-2">
          Studio2U pays engineers automatically through Stripe. When a client books and pays,
          Stripe splits the charge instantly — the Studio2U Platform Fee stays with the platform, and
          the rest lands directly in your connected bank account. No manual invoicing, no Cash App.
        </p>
      </div>

      {error && <div class="bg-wine/20 border border-wine/40 text-wine-light text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

      <div class="bg-surface border border-gold/10 rounded-2xl p-7">
        {chargesEnabled ? (
          <>
            <div class="flex items-center gap-3 mb-4">
              <div class="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 text-lg">
                <i class="fa-solid fa-circle-check"></i>
              </div>
              <div>
                <h2 class="font-display text-xl font-bold">Stripe Connected</h2>
                <p class="text-emerald-400 text-sm font-semibold">You're all set to get paid</p>
              </div>
            </div>
            <p class="text-muted text-sm mb-5">
              Your account is active and ready to receive payouts. You're bookable on the public directory.
            </p>
            <a
              href="https://dashboard.stripe.com/express"
              target="_blank"
              class="inline-flex items-center gap-2 text-sm font-semibold border border-gold/30 hover:bg-gold/10 text-cream px-5 py-2.5 rounded-full transition"
            >
              View Stripe Dashboard <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
            </a>
          </>
        ) : connected ? (
          <>
            <div class="flex items-center gap-3 mb-4">
              <div class="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center text-gold text-lg">
                <i class="fa-solid fa-hourglass-half"></i>
              </div>
              <div>
                <h2 class="font-display text-xl font-bold">Onboarding Started</h2>
                <p class="text-gold text-sm font-semibold">Not finished yet</p>
              </div>
            </div>
            <p class="text-muted text-sm mb-5">
              You started connecting your Stripe account but haven't finished — usually this means
              Stripe still needs a bit more info (bank account, identity verification). Finish it now
              to start getting booked.
            </p>
            <form method="POST" action="/dashboard/payments/connect">
              <button type="submit" class="inline-flex items-center gap-2 text-sm font-semibold bg-gold hover:bg-gold-light text-ink px-5 py-2.5 rounded-full transition">
                Finish Stripe Onboarding <i class="fa-solid fa-arrow-right text-xs"></i>
              </button>
            </form>
          </>
        ) : (
          <>
            <div class="flex items-center gap-3 mb-4">
              <div class="w-11 h-11 rounded-xl bg-wine/15 flex items-center justify-center text-wine-light text-lg">
                <i class="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div>
                <h2 class="font-display text-xl font-bold">Not Connected</h2>
                <p class="text-wine-light text-sm font-semibold">You can't get booked yet</p>
              </div>
            </div>
            <p class="text-muted text-sm mb-5">
              Studio2U requires every engineer to connect a Stripe account before appearing on the
              public directory or accepting bookings. It takes a few minutes — Stripe will ask for
              your basic info, bank account, and identity verification.
            </p>
            <form method="POST" action="/dashboard/payments/connect">
              <button type="submit" class="inline-flex items-center gap-2 text-sm font-semibold bg-gold hover:bg-gold-light text-ink px-5 py-2.5 rounded-full transition">
                <i class="fa-brands fa-stripe-s"></i> Connect with Stripe
              </button>
            </form>
          </>
        )}
      </div>

      <div class="mt-6 bg-ink/50 border border-gold/10 rounded-xl p-5 text-sm text-muted">
        <p class="font-semibold text-cream mb-2"><i class="fa-solid fa-circle-info text-gold mr-1.5"></i>How the split works</p>
        <p>
          When a client pays for a session, Stripe automatically takes the Studio2U Platform Fee
          and sends the rest directly to your connected account. Payouts follow Stripe's normal payout
          schedule to your bank — no waiting on the platform to send money manually.
        </p>
      </div>
    </div>
  )
}
