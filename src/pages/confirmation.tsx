import type { Booking } from '../types'

// Phase 3 M5: no more Cash App deposit step. The customer lands here straight from
// Stripe Checkout's success_url. Stripe's webhook (src/routes/stripe-webhook.ts) is
// what actually flips the booking to "confirmed" — usually within a second or two —
// so this page shows a short "confirming payment" state that self-refreshes if the
// webhook hasn't landed yet by the time the customer's browser redirects back.
export function ConfirmationPage({
  booking,
  engineerDisplay
}: {
  booking: Booking
  engineerDisplay: { name: string; cashappHandle: string | null; photoUrl: string | null }
}) {
  const paid = booking.status !== 'pending_payment'

  return (
    <div class="max-w-xl mx-auto px-5 py-16">
      <div class="text-center mb-8">
        <div class="w-14 h-14 rounded-full bg-gold/15 flex items-center justify-center text-gold text-2xl mx-auto mb-4">
          <i class={`fa-solid ${paid ? 'fa-circle-check' : 'fa-spinner fa-spin'}`}></i>
        </div>
        <h1 class="font-display text-3xl font-bold">{paid ? 'Booking Confirmed!' : 'Confirming Payment...'}</h1>
        <p class="text-muted mt-3">Booking #{booking.id} — {booking.session_date} @ {booking.session_time}</p>
        <p class="text-muted text-sm mt-1">with {engineerDisplay.name}</p>
      </div>

      {paid ? (
        <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-7 mb-8 text-center">
          <p class="text-emerald-400 font-semibold mb-2">
            <i class="fa-solid fa-check mr-2"></i>Payment received
          </p>
          <div class="text-2xl font-bold text-cream mb-1">${booking.price_amount}</div>
          <p class="text-xs text-muted mb-1">{booking.price_breakdown}</p>
          <p class="text-sm text-cream/70 mt-4">
            You're all set — {engineerDisplay.name.split(' ')[0]} has been notified and your session is confirmed.
          </p>
        </div>
      ) : (
        <div
          id="confirming-box"
          class="bg-gold/10 border border-gold/30 rounded-2xl p-7 mb-8 text-center"
          data-booking-id={booking.id}
        >
          <p class="text-cream/80 mb-2">
            <i class="fa-solid fa-clock mr-2 text-gold"></i>
            Stripe is finalizing your payment — this usually takes just a moment.
          </p>
          <div class="text-2xl font-bold text-cream mb-1">${booking.price_amount}</div>
          <p class="text-xs text-muted">{booking.price_breakdown}</p>
        </div>
      )}

      <div class="text-center text-sm text-muted">
        You can check your booking status anytime at{' '}
        <a href="/status" class="text-gold hover:underline">
          Studio2U → My Bookings
        </a>
      </div>

      {!paid && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
            // Poll our own status endpoint briefly in case the Stripe webhook hasn't
            // landed yet by the time the browser redirects back from Checkout.
            (function () {
              var box = document.getElementById('confirming-box')
              if (!box) return
              var bookingId = box.getAttribute('data-booking-id')
              var attempts = 0
              var interval = setInterval(function () {
                attempts++
                fetch('/api/bookings/' + bookingId + '/status')
                  .then(function (r) { return r.json() })
                  .then(function (data) {
                    if (data.status && data.status !== 'pending_payment') {
                      clearInterval(interval)
                      window.location.reload()
                    }
                  })
                  .catch(function () {})
                if (attempts >= 15) clearInterval(interval)
              }, 2000)
            })()
          `
          }}
        ></script>
      )}
    </div>
  )
}
