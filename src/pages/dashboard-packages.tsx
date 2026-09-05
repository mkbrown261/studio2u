import type { PackageOffer, PackagePurchase } from '../lib/db-packages'

export function DashboardPackagesPage({
  offers,
  purchases
}: {
  offers: PackageOffer[]
  purchases: PackagePurchase[]
}) {
  return (
    <div class="max-w-3xl mx-auto px-5 py-12">
      <div class="mb-8">
        <a href="/dashboard" class="text-sm text-muted hover:text-gold transition"><i class="fa-solid fa-arrow-left mr-1"></i> Back to Dashboard</a>
        <h1 class="font-display text-3xl font-bold mt-4">Your Packages</h1>
        <p class="text-muted mt-2">
          Sell a bundle of hours at a discounted rate — clients pay upfront (you're paid instantly, same as any
          booking) and can spend the hours across multiple future sessions with you, mixing durations however they like.
        </p>
      </div>

      <form method="POST" action="/dashboard/packages" class="bg-surface border border-gold/10 rounded-2xl p-7 space-y-4 mb-8">
        <h2 class="font-display text-lg font-bold">New Package Offer</h2>
        <div>
          <label class="block text-sm font-medium text-muted mb-2">Title (optional)</label>
          <input
            type="text"
            name="title"
            placeholder="e.g. '10-Hour Session Pack'"
            class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold"
          />
          <p class="text-xs text-muted mt-1.5">Leave blank and we'll just show "{'{hours}'}h Package".</p>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-muted mb-2">Total Hours</label>
            <input
              type="number"
              name="total_hours"
              min="1"
              step="0.5"
              required
              placeholder="e.g. 10"
              class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-muted mb-2">Bundle Price ($)</label>
            <input
              type="number"
              name="price_dollars"
              min="1"
              step="0.01"
              required
              placeholder="e.g. 400"
              class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold"
            />
          </div>
        </div>
        <button type="submit" class="bg-gold hover:bg-gold-light text-ink font-semibold px-6 py-3 rounded-full transition">
          <i class="fa-solid fa-plus mr-1"></i> Create Package Offer
        </button>
      </form>

      <h2 class="font-display text-lg font-bold mb-4">Your Offers</h2>
      {offers.length === 0 ? (
        <div class="text-center py-12 text-muted bg-surface border border-gold/10 rounded-2xl mb-10">
          <i class="fa-solid fa-boxes-stacked text-3xl mb-4"></i>
          <p>No package offers yet. Create one above to start selling bundled hours.</p>
        </div>
      ) : (
        <div class="space-y-3 mb-10">
          {offers.map((o) => (
            <div class="bg-surface border border-gold/10 rounded-xl p-5 flex items-center justify-between gap-4">
              <div>
                <div class="font-semibold text-cream">
                  {o.title || `${o.total_hours}h Package`}
                  {!o.active && <span class="ml-2 text-[10px] font-bold uppercase tracking-wider text-muted bg-ink/60 rounded-full px-2 py-0.5">Paused</span>}
                </div>
                <div class="text-xs text-muted mt-1">{o.total_hours} hours for ${(o.price_cents / 100).toFixed(2)}</div>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <form method="POST" action={`/dashboard/packages/${o.id}/toggle`}>
                  <input type="hidden" name="active" value={o.active ? '0' : '1'} />
                  <button type="submit" class="text-sm text-gold hover:underline">
                    {o.active ? 'Pause' : 'Activate'}
                  </button>
                </form>
                <form method="POST" action={`/dashboard/packages/${o.id}/delete`} onsubmit="return confirm('Delete this offer? Existing customer purchases are unaffected.')">
                  <button type="submit" class="text-sm text-wine-light hover:text-red-400 transition">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 class="font-display text-lg font-bold mb-4">Purchases</h2>
      {purchases.length === 0 ? (
        <div class="text-center py-12 text-muted bg-surface border border-gold/10 rounded-2xl">
          <i class="fa-solid fa-receipt text-3xl mb-4"></i>
          <p>No one has bought a package yet.</p>
        </div>
      ) : (
        <div class="space-y-3">
          {purchases.map((p) => (
            <div class="bg-surface border border-gold/10 rounded-xl p-5">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <div class="font-semibold text-cream">{p.customer_name}</div>
                  <div class="text-xs text-muted mt-1">
                    {p.hours_remaining} / {p.hours_total} hours left · ${(p.price_paid_cents / 100).toFixed(2)} paid
                  </div>
                </div>
                <span
                  class={`text-[10px] font-bold uppercase tracking-wider rounded-full px-3 py-1 ${
                    p.status === 'active'
                      ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                      : p.status === 'depleted'
                        ? 'text-muted bg-ink/60'
                        : p.status === 'pending_payment'
                          ? 'text-gold bg-gold/10 border border-gold/30'
                          : 'text-wine-light bg-wine/10 border border-wine/30'
                  }`}
                >
                  {p.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
