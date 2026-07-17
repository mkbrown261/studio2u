import type { Booking } from '../types'

export function PayPage({
  booking,
  engineerDisplay,
  error
}: {
  booking: Booking
  engineerDisplay: { name: string; cashappHandle: string | null; photoUrl: string | null }
  error?: string
}) {
  const cashapp = engineerDisplay.cashappHandle || '$KEYZGMG'

  return (
    <div class="max-w-xl mx-auto px-5 py-16">
      <div class="text-center mb-8">
        <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">Booking #{booking.id}</p>
        <h1 class="font-display text-3xl font-bold">Deposit Required</h1>
        <p class="text-muted text-sm mt-2">with {engineerDisplay.name}</p>
      </div>

      <div class="bg-gold/10 border border-gold/30 rounded-2xl p-7 mb-8 text-center">
        <p class="text-cream/80 mb-4">Please send your deposit using Cash App:</p>
        <div class="text-4xl font-display font-bold text-gold mb-4">{cashapp}</div>
        <div class="text-2xl font-bold text-cream mb-1">${booking.price_amount}</div>
        <p class="text-xs text-muted">{booking.price_breakdown}</p>
      </div>

      <p class="text-center text-muted text-sm mb-8">
        Once payment is received, upload your confirmation below. Your booking stays <strong class="text-cream">pending</strong> until {engineerDisplay.name.split(' ')[0]} approves it.
      </p>

      {error && (
        <div class="bg-wine/20 border border-wine/40 text-wine-light text-sm rounded-lg px-4 py-3 mb-6">{error}</div>
      )}

      <form method="POST" action={`/book/pay/${booking.id}`} enctype="multipart/form-data" class="bg-surface border border-gold/10 rounded-2xl p-7 space-y-5">
        <div>
          <label class="block text-sm font-medium text-muted mb-2">Payment Screenshot (PNG, JPEG, or PDF)</label>
          <input
            type="file"
            name="proof"
            accept="image/png,image/jpeg,application/pdf"
            class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream text-sm focus:outline-none focus:border-gold file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-gold file:text-ink file:font-semibold"
          />
        </div>
        <div class="text-center text-muted text-xs">— OR —</div>
        <div>
          <label class="block text-sm font-medium text-muted mb-2">Cash App Transaction ID</label>
          <input
            type="text"
            name="transaction_id"
            placeholder="e.g. 1234567890"
            class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold"
          />
        </div>
        <button type="submit" class="w-full bg-gold hover:bg-gold-light text-ink font-semibold py-3.5 rounded-full transition">
          Submit Payment Confirmation
        </button>
      </form>
    </div>
  )
}
