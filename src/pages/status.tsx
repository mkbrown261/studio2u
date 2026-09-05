import type { Booking } from '../types'

const STATUS_STYLES: Record<string, string> = {
  pending_payment: 'bg-muted/20 text-muted border-muted/30',
  pending_approval: 'bg-gold/15 text-gold border-gold/30',
  confirmed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  completed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  cancelled: 'bg-wine/15 text-wine-light border-wine/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30'
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Pending Payment',
  pending_approval: 'Pending Approval',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected'
}

export function StatusPage({ bookings, email, searched }: { bookings: Booking[]; email?: string; searched?: boolean }) {
  return (
    <div class="max-w-3xl mx-auto px-5 py-16">
      <div class="text-center mb-10">
        <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">My Bookings</p>
        <h1 class="font-display text-3xl md:text-4xl font-bold">Check your session status</h1>
        <p class="text-muted mt-3">Enter the email you used when booking.</p>
      </div>

      <form method="GET" action="/status" class="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="email"
          name="email"
          required
          value={email || ''}
          placeholder="you@example.com"
          class="flex-1 min-w-0 w-full bg-surface border border-gold/20 rounded-full px-5 py-3 text-cream focus:outline-none focus:border-gold"
        />
        <button type="submit" class="bg-gold hover:bg-gold-light text-ink font-semibold px-6 py-3 rounded-full transition shrink-0 sm:w-auto w-full">
          Search
        </button>
      </form>

      <div class="flex items-start gap-3 text-xs text-muted bg-surface border border-gold/10 rounded-xl px-4 py-3 mb-10">
        <i class="fa-solid fa-shield-halved text-gold mt-0.5"></i>
        <span>Every session booked through Studio2U is covered by our <a href="/refund-policy" class="text-gold hover:underline">Refund &amp; Cancellation Policy</a> — payment is held securely and only released per that policy, whether or not anything goes as planned.</span>
      </div>

      {searched && bookings.length === 0 && (
        <div class="text-center py-16 text-muted bg-surface border border-gold/10 rounded-2xl">
          <i class="fa-solid fa-magnifying-glass text-3xl mb-4"></i>
          <p>No bookings found for that email.</p>
        </div>
      )}

      {bookings.length > 0 && (
        <div class="space-y-4">
          {bookings.map((b) => (
            <div class="bg-surface border border-gold/10 rounded-2xl p-6">
              <div class="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div class="font-display text-lg font-bold">{b.session_date} @ {b.session_time}</div>
                  <div class="text-sm text-muted mt-1">{b.duration_hours} hours · <span class="capitalize">{b.location_type}</span></div>
                </div>
                <span class={`text-xs font-semibold px-3 py-1 rounded-full border whitespace-nowrap ${STATUS_STYLES[b.status]}`}>
                  {STATUS_LABELS[b.status]}
                </span>
              </div>

              {b.status === 'pending_payment' && (
                <div class="text-sm text-muted bg-ink/50 rounded-xl px-4 py-3 mt-3">
                  <i class="fa-solid fa-hourglass-half mr-2 text-gold"></i>
                  Waiting on payment for this booking (${b.price_amount}). If you closed the Stripe checkout page before finishing, check your email for the payment link or contact us to resend it.
                </div>
              )}

              {b.status === 'pending_approval' && (
                <div class="text-sm text-muted bg-ink/50 rounded-xl px-4 py-3 mt-3">
                  <i class="fa-solid fa-hourglass-half mr-2 text-gold"></i>
                  We've received your payment proof — your booking will be confirmed shortly.
                </div>
              )}

              {b.status === 'confirmed' && (
                <div class="text-sm text-emerald-400 bg-emerald-500/10 rounded-xl px-4 py-3 mt-3">
                  <i class="fa-solid fa-circle-check mr-2"></i>
                  You're all set! Your engineer will see you on {b.session_date} at {b.session_time}.
                </div>
              )}

              {b.status === 'completed' && b.reviewed !== 1 && b.engineer_profile_id != null && (
                <div class="bg-gold/10 border border-gold/30 rounded-xl px-5 py-4 mt-3">
                  <p class="text-sm text-cream/80 mb-3">
                    <i class="fa-solid fa-microphone-lines text-gold mr-1"></i> How did your session go? Leave a review for your engineer.
                  </p>
                  <a
                    href={`/review/${b.id}?email=${encodeURIComponent(b.customer_email)}`}
                    class="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-ink font-semibold text-sm px-5 py-2.5 rounded-full transition"
                  >
                    Leave a Review <i class="fa-solid fa-arrow-right text-xs"></i>
                  </a>
                </div>
              )}

              {b.status === 'completed' && b.engineer_profile_id != null && (
                <div class="mt-3">
                  <a
                    href={`/book/${b.engineer_profile_id}`}
                    class="inline-flex items-center gap-2 border border-gold/30 hover:bg-gold/10 text-cream font-semibold text-sm px-5 py-2.5 rounded-full transition"
                  >
                    <i class="fa-solid fa-rotate-right text-xs"></i> Book This Engineer Again
                  </a>
                </div>
              )}

              {(b.status === 'confirmed' || b.status === 'completed') && (
                <div class="mt-3">
                  <a
                    href={`/disputes/new/${b.id}?email=${encodeURIComponent(b.customer_email)}`}
                    class="inline-flex items-center gap-1.5 text-xs text-muted hover:text-gold transition"
                  >
                    <i class="fa-solid fa-flag text-[10px]"></i> Report a Problem
                  </a>
                </div>
              )}

              <div class="text-xs text-muted mt-3">Booking #{b.id} · ${b.price_amount} · {b.genre || 'No genre specified'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
