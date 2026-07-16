import type { Booking, Engineer } from '../types'

export function ConfirmationPage({ booking, engineer }: { booking: Booking; engineer: Engineer | null }) {
  const cashapp = engineer?.cashapp_handle || '$KEYZGMG'

  return (
    <div class="max-w-xl mx-auto px-5 py-16">
      <div class="text-center mb-8">
        <div class="w-14 h-14 rounded-full bg-gold/15 flex items-center justify-center text-gold text-2xl mx-auto mb-4">
          <i class="fa-solid fa-calendar-check"></i>
        </div>
        <h1 class="font-display text-3xl font-bold">Booking Received!</h1>
        <p class="text-muted mt-3">Booking #{booking.id} — {booking.session_date} @ {booking.session_time}</p>
      </div>

      {booking.is_custom_time_request === 1 && (
        <div class="bg-wine/15 border border-wine/40 rounded-xl px-5 py-4 mb-6 text-sm text-cream/90">
          <i class="fa-solid fa-triangle-exclamation text-gold mr-2"></i>
          Your requested time is outside our standard Mon–Fri, 11am–11pm availability. We'll reach out directly to confirm this time works before your deposit is required.
        </div>
      )}

      <div class="bg-gold/10 border border-gold/30 rounded-2xl p-7 mb-8 text-center">
        <p class="text-cream/80 mb-4 font-semibold">
          <i class="fa-solid fa-clock mr-2"></i>Deposit Required
        </p>
        <p class="text-sm text-cream/70 mb-4">Please send your deposit using Cash App:</p>
        <div class="text-4xl font-display font-bold text-gold mb-4">{cashapp}</div>
        <div class="text-2xl font-bold text-cream mb-1">${booking.price_amount}</div>
        <p class="text-xs text-muted mb-6">{booking.price_breakdown}</p>
        <p class="text-sm text-cream/70 mb-5">Once payment is received, your booking will be confirmed.</p>
        <a
          href={`/book/pay/${booking.id}`}
          class="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-ink font-semibold px-6 py-3 rounded-full transition"
        >
          Upload Payment Confirmation <i class="fa-solid fa-arrow-right text-xs"></i>
        </a>
      </div>

      <div class="text-center text-sm text-muted">
        You can check your booking status anytime at{' '}
        <a href="/status" class="text-gold hover:underline">
          Studio2U → My Bookings
        </a>
      </div>
    </div>
  )
}
