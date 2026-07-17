import type { EngineerProfile } from '../lib/db-engineers'

export function AdminEngineersPage({ engineers }: { engineers: EngineerProfile[] }) {
  return (
    <div class="max-w-6xl mx-auto px-5 py-12">
      <div class="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-2">Admin</p>
          <h1 class="font-display text-3xl font-bold">Engineers</h1>
          <p class="text-muted text-sm mt-2">Platform oversight — suspend an engineer to instantly remove them from the public directory and block new bookings.</p>
        </div>
        <div class="flex gap-3">
          <a href="/admin" class="text-sm text-muted hover:text-gold transition">Bookings</a>
          <form method="POST" action="/admin/logout">
            <button type="submit" class="text-sm text-muted hover:text-gold transition flex items-center gap-2">
              <i class="fa-solid fa-right-from-bracket"></i> Log out
            </button>
          </form>
        </div>
      </div>

      {engineers.length === 0 ? (
        <div class="text-center py-24 text-muted">
          <i class="fa-solid fa-microphone-lines text-3xl mb-4"></i>
          <p>No engineers have signed up yet.</p>
        </div>
      ) : (
        <div class="space-y-4">
          {engineers.map((e) => (
            <div class="bg-surface border border-gold/10 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div class="flex items-center gap-3 mb-1">
                  <h3 class="font-display text-lg font-bold">{e.display_name}</h3>
                  {e.is_suspended === 1 ? (
                    <span class="text-xs font-semibold px-3 py-1 rounded-full border border-red-500/30 text-red-400 bg-red-500/15">Suspended</span>
                  ) : (
                    <span class="text-xs font-semibold px-3 py-1 rounded-full border border-emerald-500/30 text-emerald-400 bg-emerald-500/15">Live</span>
                  )}
                  {e.is_new === 1 && <span class="text-xs font-semibold text-gold bg-gold/10 rounded-full px-3 py-1">New</span>}
                </div>
                <div class="text-sm text-muted">
                  ${e.hourly_rate}/hr · {e.rating_avg.toFixed(1)} ({e.rating_count} reviews) · {e.location_label || 'No location set'}
                </div>
              </div>
              <div class="flex items-center gap-3">
                <a href={`/engineers/${e.id}`} target="_blank" class="text-sm text-gold hover:underline">View Profile</a>
                <form method="POST" action={`/admin/engineers/${e.id}/suspend`}>
                  <input type="hidden" name="suspend" value={e.is_suspended === 1 ? '0' : '1'} />
                  <button
                    type="submit"
                    class={`text-xs font-semibold px-4 py-2 rounded-full border transition ${
                      e.is_suspended === 1
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                        : 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25'
                    }`}
                  >
                    {e.is_suspended === 1 ? 'Reactivate' : 'Suspend'}
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
