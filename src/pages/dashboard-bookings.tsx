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

export function DashboardBookingsPage({ bookings }: { bookings: Booking[] }) {
  return (
    <div class="max-w-4xl mx-auto px-5 py-12">
      <div class="mb-8">
        <a href="/dashboard" class="text-sm text-muted hover:text-gold transition"><i class="fa-solid fa-arrow-left mr-1"></i> Back to Dashboard</a>
        <h1 class="font-display text-3xl font-bold mt-4">Your Bookings</h1>
        <p class="text-muted mt-2">Review payment proof and approve or reject bookings for your sessions.</p>
      </div>

      {bookings.length === 0 ? (
        <div class="text-center py-24 text-muted bg-surface border border-gold/10 rounded-2xl">
          <i class="fa-solid fa-calendar-xmark text-3xl mb-4"></i>
          <p>No bookings yet.</p>
        </div>
      ) : (
        <div class="space-y-4">
          {bookings.map((b) => (
            <div class="bg-surface border border-gold/10 rounded-2xl p-6">
              <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <div class="flex items-center gap-3 mb-1">
                    <h3 class="font-display text-lg font-bold">{b.customer_name}</h3>
                    <span class={`text-xs font-semibold px-3 py-1 rounded-full border ${STATUS_STYLES[b.status]}`}>{STATUS_LABELS[b.status]}</span>
                    {b.is_custom_time_request === 1 && (
                      <span class="text-xs font-semibold px-3 py-1 rounded-full border border-gold/40 text-gold bg-gold/10">
                        <i class="fa-solid fa-triangle-exclamation mr-1"></i>Special Time
                      </span>
                    )}
                  </div>
                  <div class="text-sm text-muted flex flex-wrap gap-x-4 gap-y-1">
                    <span><i class="fa-solid fa-envelope mr-1"></i>{b.customer_email}</span>
                    <span><i class="fa-solid fa-phone mr-1"></i>{b.customer_phone}</span>
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-2xl font-display font-bold text-gold">${b.price_amount}</div>
                  <div class="text-xs text-muted">{b.is_first_time_rate ? 'First-time rate' : 'Standard rate'}</div>
                </div>
              </div>

              <div class="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4 border-t border-gold/10 pt-4">
                <div>
                  <div class="text-muted text-xs uppercase tracking-wide mb-1">Date & Time</div>
                  <div>{b.session_date} @ {b.session_time}</div>
                </div>
                <div>
                  <div class="text-muted text-xs uppercase tracking-wide mb-1">Duration</div>
                  <div>{b.duration_hours} hours</div>
                </div>
                <div>
                  <div class="text-muted text-xs uppercase tracking-wide mb-1">Location</div>
                  <div class="capitalize">{b.location_type}{b.location_address ? ` — ${b.location_address}` : ''}</div>
                </div>
                <div>
                  <div class="text-muted text-xs uppercase tracking-wide mb-1">Genre / Songs</div>
                  <div>{b.genre || '—'} {b.song_count ? `· ${b.song_count} songs` : ''}</div>
                </div>
              </div>

              {b.special_notes && (
                <div class="text-sm text-muted bg-ink/50 rounded-lg px-4 py-3 mb-4">
                  <span class="text-cream font-medium">Notes: </span>{b.special_notes}
                </div>
              )}

              <div class="flex flex-wrap items-center justify-between gap-4 border-t border-gold/10 pt-4">
                <div class="flex items-center gap-3 text-sm">
                  {b.payment_proof_url && (
                    <a href={`/dashboard/bookings/${b.id}/proof`} target="_blank" class="inline-flex items-center gap-2 text-gold hover:underline font-medium">
                      <i class="fa-solid fa-receipt"></i> View Payment Proof
                    </a>
                  )}
                  {b.payment_transaction_id && <span class="text-muted">TXN: {b.payment_transaction_id}</span>}
                  {!b.payment_proof_url && !b.payment_transaction_id && <span class="text-muted italic">No payment proof submitted yet</span>}
                </div>

                <form method="POST" action={`/dashboard/bookings/${b.id}/status`} class="flex gap-2 flex-wrap">
                  {b.status === 'pending_approval' && (
                    <>
                      <button name="status" value="confirmed" class="text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full px-4 py-2 hover:bg-emerald-500/25 transition">
                        <i class="fa-solid fa-check mr-1"></i>Approve
                      </button>
                      <button name="status" value="rejected" class="text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 rounded-full px-4 py-2 hover:bg-red-500/25 transition">
                        <i class="fa-solid fa-xmark mr-1"></i>Reject
                      </button>
                    </>
                  )}
                  {b.status === 'confirmed' && (
                    <>
                      <button name="status" value="completed" class="text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-full px-4 py-2 hover:bg-blue-500/25 transition">
                        <i class="fa-solid fa-flag-checkered mr-1"></i>Mark Completed
                      </button>
                      <button name="status" value="cancelled" class="text-xs font-semibold bg-wine/15 text-wine-light border border-wine/30 rounded-full px-4 py-2 hover:bg-wine/25 transition">
                        Cancel
                      </button>
                    </>
                  )}
                  {b.status === 'pending_payment' && (
                    <button name="status" value="cancelled" class="text-xs font-semibold bg-wine/15 text-wine-light border border-wine/30 rounded-full px-4 py-2 hover:bg-wine/25 transition">
                      Cancel
                    </button>
                  )}
                </form>
              </div>

              <div class="text-xs text-muted mt-3">Booking #{b.id} · Created {new Date(b.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
