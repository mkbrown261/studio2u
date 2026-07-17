import type { Booking } from '../types'
import type { EngineerProfile } from '../lib/db-engineers'

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

export function AdminDashboardPage({
  bookings,
  statusFilter,
  engineers,
  commissionPercent
}: {
  bookings: Booking[]
  statusFilter: string
  engineers: EngineerProfile[]
  commissionPercent: number
}) {
  const filters = ['all', 'pending_payment', 'pending_approval', 'confirmed', 'completed', 'cancelled', 'rejected']

  return (
    <div class="max-w-6xl mx-auto px-5 py-12">
      <div class="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-2">Admin</p>
          <h1 class="font-display text-3xl font-bold">Platform Oversight</h1>
        </div>
        <form method="POST" action="/admin/logout">
          <button type="submit" class="text-sm text-muted hover:text-gold transition flex items-center gap-2">
            <i class="fa-solid fa-right-from-bracket"></i> Log out
          </button>
        </form>
      </div>

      {/* ---------- Platform commission setting ---------- */}
      <section class="mb-14">
        <h2 class="font-display text-xl font-bold mb-4">Platform Commission</h2>
        <div class="bg-surface border border-gold/10 rounded-xl p-5">
          <p class="text-muted text-sm mb-4">
            Percentage the platform keeps from each booking (the rest is the engineer's payout via Stripe Connect).
            Change this any time — it applies to new bookings going forward.
          </p>
          <form method="POST" action="/admin/settings/commission" class="flex items-end gap-4 flex-wrap">
            <div>
              <label class="block text-xs text-muted uppercase tracking-wide mb-1.5" for="commission_percent">
                Commission %
              </label>
              <div class="relative">
                <input
                  type="number"
                  id="commission_percent"
                  name="commission_percent"
                  step="0.1"
                  min="0"
                  max="100"
                  value={commissionPercent}
                  class="bg-ink border border-gold/20 rounded-lg pl-4 pr-9 py-2.5 text-cream w-32 focus:outline-none focus:border-gold/50"
                  required
                />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">%</span>
              </div>
            </div>
            <button type="submit" class="text-sm font-semibold bg-gold text-ink rounded-full px-6 py-2.5 hover:bg-gold-light transition">
              <i class="fa-solid fa-floppy-disk mr-1.5"></i>Save
            </button>
            <span class="text-xs text-muted">
              e.g. on a $100 booking, platform keeps ${((100 * commissionPercent) / 100).toFixed(2)}, engineer gets $
              {(100 - (100 * commissionPercent) / 100).toFixed(2)}
            </span>
          </form>
        </div>
      </section>

      {/* ---------- Engineer kill switch ---------- */}
      <section class="mb-14">
        <h2 class="font-display text-xl font-bold mb-4">Engineers</h2>
        <p class="text-muted text-sm mb-5">
          Each engineer approves their own bookings and gets paid directly via their own Cash App. This panel is for
          platform oversight only — suspend an engineer to instantly pull them off the public directory.
        </p>
        {engineers.length === 0 ? (
          <div class="text-center py-10 text-muted bg-surface border border-gold/10 rounded-2xl text-sm">No engineers have signed up yet.</div>
        ) : (
          <div class="space-y-3">
            {engineers.map((e) => (
              <div class="bg-surface border border-gold/10 rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div class="flex items-center gap-3">
                    <span class="font-semibold text-cream">{e.display_name}</span>
                    {e.is_suspended === 1 ? (
                      <span class="text-xs font-semibold px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/15 text-red-400">Suspended</span>
                    ) : e.is_published === 1 ? (
                      <span class="text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-400">Live</span>
                    ) : (
                      <span class="text-xs font-semibold px-2.5 py-1 rounded-full border border-muted/30 bg-muted/10 text-muted">Draft</span>
                    )}
                    {e.is_new === 1 && <span class="text-xs font-semibold px-2.5 py-1 rounded-full border border-gold/30 bg-gold/10 text-gold">New</span>}
                  </div>
                  <div class="text-xs text-muted mt-1">${e.hourly_rate}/hr · {e.rating_count} review{e.rating_count !== 1 ? 's' : ''}</div>
                </div>
                <div class="flex items-center gap-3">
                  <a href={`/engineers/${e.id}`} target="_blank" class="text-xs font-semibold text-gold hover:underline">View Profile</a>
                  <form method="POST" action={`/admin/engineers/${e.id}/suspend`}>
                    <input type="hidden" name="suspended" value={e.is_suspended === 1 ? '0' : '1'} />
                    {e.is_suspended === 1 ? (
                      <button type="submit" class="text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full px-4 py-2 hover:bg-emerald-500/25 transition">
                        <i class="fa-solid fa-play mr-1"></i>Reactivate
                      </button>
                    ) : (
                      <button type="submit" class="text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 rounded-full px-4 py-2 hover:bg-red-500/25 transition">
                        <i class="fa-solid fa-ban mr-1"></i>Suspend
                      </button>
                    )}
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <h2 class="font-display text-xl font-bold mb-4">All Bookings</h2>
      <div class="flex gap-2 mb-8 overflow-x-auto pb-2">
        {filters.map((f) => (
          <a
            href={`/admin?status=${f}`}
            class={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition ${
              statusFilter === f ? 'bg-gold text-ink border-gold' : 'border-gold/20 text-muted hover:border-gold/40'
            }`}
          >
            {f === 'all' ? 'All' : STATUS_LABELS[f]}
          </a>
        ))}
      </div>

      {bookings.length === 0 ? (
        <div class="text-center py-24 text-muted">
          <i class="fa-solid fa-calendar-xmark text-3xl mb-4"></i>
          <p>No bookings in this view yet.</p>
        </div>
      ) : (
        <div class="space-y-4">
          {bookings.map((b) => (
            <div class="bg-surface border border-gold/10 rounded-2xl p-6">
              <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <div class="flex items-center gap-3 mb-1">
                    <h3 class="font-display text-lg font-bold">{b.customer_name}</h3>
                    <span class={`text-xs font-semibold px-3 py-1 rounded-full border ${STATUS_STYLES[b.status]}`}>
                      {STATUS_LABELS[b.status]}
                    </span>
                    {b.is_custom_time_request === 1 && (
                      <span class="text-xs font-semibold px-3 py-1 rounded-full border border-gold/40 text-gold bg-gold/10">
                        <i class="fa-solid fa-triangle-exclamation mr-1"></i>Special Time Request
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
                    <a
                      href={`/admin/proof/${b.id}`}
                      target="_blank"
                      class="inline-flex items-center gap-2 text-gold hover:underline font-medium"
                    >
                      <i class="fa-solid fa-receipt"></i> View Payment Proof
                    </a>
                  )}
                  {b.payment_transaction_id && (
                    <span class="text-muted">TXN: {b.payment_transaction_id}</span>
                  )}
                  {!b.payment_proof_url && !b.payment_transaction_id && (
                    <span class="text-muted italic">No payment proof submitted yet</span>
                  )}
                </div>

                <form method="POST" action={`/admin/bookings/${b.id}/status`} class="flex gap-2 flex-wrap">
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
                  {(b.status === 'pending_payment') && (
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
