import type { Booking } from '../types'

const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: 'no_show', label: 'Engineer did not show up' },
  { value: 'quality_issue', label: 'Quality issue with the session/recording' },
  { value: 'billing_issue', label: 'Billing / charge issue' },
  { value: 'other', label: 'Something else' }
]

export function DisputeFormPage({ booking, error }: { booking: Booking; error?: string }) {
  return (
    <div class="max-w-lg mx-auto px-5 py-16">
      <div class="text-center mb-8">
        <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">Booking #{booking.id}</p>
        <h1 class="font-display text-3xl font-bold">Report a Problem</h1>
        <p class="text-muted mt-3">
          Tell us what went wrong with your {booking.session_date} session — our team reviews every report and can issue a refund
          if warranted.
        </p>
      </div>

      {error && <div class="bg-wine/20 border border-wine/40 text-wine-light text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

      <form method="POST" action={`/disputes/new/${booking.id}`} class="bg-surface border border-gold/10 rounded-2xl p-7 space-y-6">
        <input type="hidden" name="email" value={booking.customer_email} />

        <div>
          <label class="block text-sm font-medium text-muted mb-2">What happened?</label>
          <div class="space-y-2">
            {REASON_OPTIONS.map((opt) => (
              <label class="flex items-center gap-3 bg-ink border border-gold/20 rounded-lg px-4 py-3 cursor-pointer hover:border-gold/40 transition">
                <input type="radio" name="reason" value={opt.value} required class="accent-gold" />
                <span class="text-sm text-cream">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-muted mb-2">Details</label>
          <textarea
            name="description"
            rows="5"
            required
            minlength={10}
            placeholder="Please describe what happened — the more detail, the faster we can help."
            class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold"
          ></textarea>
        </div>

        <button type="submit" class="w-full bg-gold hover:bg-gold-light text-ink font-semibold py-3.5 rounded-full transition">
          Submit Report
        </button>
      </form>
    </div>
  )
}
