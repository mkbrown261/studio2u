import type { EngineerProfile } from '../lib/db-engineers'

// Common genre chips shown as one-click filters. Engineers self-report genres as
// free text (comma-separated) on their profile, so this isn't a strict enum — it's
// just the fastest, most-requested categories to make browsing faster than typing.
// Clicking a chip does a normal case-insensitive substring match, same as before.
const GENRE_CHIPS = ['Hip Hop', 'R&B', 'Pop', 'Rock', 'Country', 'Gospel', 'Jazz', 'EDM', 'Podcast']

export function EngineersDirectoryPage({
  engineers,
  genre,
  q,
  remoteOnly,
  locationLabel,
  geocodeFailed,
  sessionDate,
  priceMin,
  priceMax,
  sort,
  distanceById,
  sessionCounts,
  waitlistSuccess,
  waitlistError
}: {
  engineers: EngineerProfile[]
  genre?: string
  q?: string
  remoteOnly?: boolean
  locationLabel?: string
  geocodeFailed?: boolean
  sessionDate?: string
  priceMin?: string
  priceMax?: string
  sort?: string
  distanceById: Map<number, number>
  sessionCounts: Map<number, number>
  waitlistSuccess?: boolean
  waitlistError?: string
}) {
  const hasActiveFilters = !!(genre || q || remoteOnly || locationLabel || sessionDate || priceMin || priceMax)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div class="max-w-6xl mx-auto px-5 py-16">
      <div class="text-center max-w-2xl mx-auto mb-10">
        <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">Engineer Directory</p>
        <h1 class="font-display text-3xl md:text-4xl font-bold">Find your engineer</h1>
        <p class="text-muted mt-4">Search by location and date to see who's actually available near you, then filter by price, genre, and rating.</p>
      </div>

      {/* SMART SEARCH BAR: location + date + price, all in one guided flow */}
      <form method="GET" action="/engineers" class="bg-surface border border-gold/10 rounded-2xl p-5 mb-6">
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div class="lg:col-span-2">
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">
              <i class="fa-solid fa-location-dot text-gold mr-1"></i> Your location
            </label>
            <input
              type="text"
              name="location"
              value={locationLabel || ''}
              placeholder="City or zip, e.g. Wilmington, DE"
              class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-2.5 text-cream text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">
              <i class="fa-regular fa-calendar text-gold mr-1"></i> Session date
            </label>
            <input
              type="date"
              name="date"
              value={sessionDate || ''}
              min={today}
              class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-2.5 text-cream text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">
              <i class="fa-solid fa-dollar-sign text-gold mr-1"></i> Budget ($/hr)
            </label>
            <div class="flex gap-2">
              <input
                type="number"
                name="priceMin"
                value={priceMin || ''}
                placeholder="Min"
                min="0"
                class="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2.5 text-cream text-sm focus:outline-none focus:border-gold"
              />
              <input
                type="number"
                name="priceMax"
                value={priceMax || ''}
                placeholder="Max"
                min="0"
                class="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2.5 text-cream text-sm focus:outline-none focus:border-gold"
              />
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-3 items-center mb-3">
          <input
            type="text"
            name="q"
            value={q || ''}
            placeholder="Search bio, mic, DAW (e.g. SM7B, Ableton)"
            class="bg-ink border border-gold/20 rounded-full px-4 py-2 text-cream text-sm focus:outline-none focus:border-gold flex-1 min-w-[220px]"
          />
          <label class="flex items-center gap-2 bg-ink border border-teal/30 rounded-full px-4 py-2 text-sm cursor-pointer">
            <input type="checkbox" name="remote" value="1" checked={remoteOnly} class="accent-teal" />
            <img src="/static/brand/icon-remote-64.png" alt="" class="w-4 h-4 object-contain" />
            <span class="text-teal font-semibold">Remote available</span>
          </label>
          <select name="sort" class="bg-ink border border-gold/20 rounded-full px-4 py-2 text-cream text-sm focus:outline-none focus:border-gold">
            <option value="" selected={!sort}>Sort: Best match</option>
            <option value="distance" selected={sort === 'distance'}>Sort: Distance</option>
            <option value="price" selected={sort === 'price'}>Sort: Price (low to high)</option>
            <option value="rating" selected={sort === 'rating'}>Sort: Rating</option>
          </select>
        </div>

        <div class="flex flex-wrap gap-2 items-center mb-1">
          <span class="text-[11px] font-semibold uppercase tracking-wide text-muted mr-1">Genre:</span>
          {GENRE_CHIPS.map((g) => {
            const active = (genre || '').toLowerCase() === g.toLowerCase()
            return (
              <button
                type="submit"
                name="genre"
                value={active ? '' : g}
                class={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                  active ? 'bg-gold text-ink border-gold' : 'bg-ink border-gold/20 text-muted hover:border-gold/50'
                }`}
              >
                {g}
              </button>
            )
          })}
        </div>

        <div class="flex flex-wrap gap-3 justify-center mt-4">
          <button type="submit" class="bg-gold hover:bg-gold-light text-ink font-semibold px-8 py-2.5 rounded-full transition text-sm">
            Search
          </button>
          {hasActiveFilters && (
            <a href="/engineers" class="border border-gold/30 hover:bg-gold/10 text-cream font-semibold px-6 py-2.5 rounded-full transition text-sm">
              Clear all
            </a>
          )}
        </div>
      </form>

      {geocodeFailed && (
        <div class="text-center text-sm text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-3 mb-8">
          <i class="fa-solid fa-triangle-exclamation mr-1.5"></i>
          We couldn't find "{locationLabel}" — showing all engineers instead. Try a city name or zip code.
        </div>
      )}

      {waitlistSuccess && (
        <div class="text-center text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 rounded-xl px-4 py-3 mb-8">
          <i class="fa-solid fa-circle-check mr-1.5"></i>
          You're on the list! We'll email you as soon as an engineer covers your area/date.
        </div>
      )}

      {engineers.length > 0 && (
        <div
          id="directory-map"
          class="w-full h-72 rounded-2xl overflow-hidden border border-gold/20 mb-12"
          data-engineers={JSON.stringify(
            engineers.map((e) => ({
              id: e.id,
              name: e.display_name,
              rate: e.hourly_rate,
              lat: e.lat,
              lng: e.lng,
              distance: distanceById.has(e.id) ? Math.round(distanceById.get(e.id)! * 10) / 10 : null
            }))
          )}
        ></div>
      )}

      {engineers.length === 0 ? (
        <div class="text-center py-16 text-muted bg-surface border border-gold/10 rounded-2xl px-6">
          <i class="fa-solid fa-user-slash text-3xl mb-4"></i>
          <p class="mb-6">
            No engineers matched your search{locationLabel ? ` near "${locationLabel}"` : ''}
            {sessionDate ? ` on ${sessionDate}` : ''} yet.
          </p>

          {!waitlistError && !waitlistSuccess ? (
            <>
              <p class="text-sm text-cream font-semibold mb-4">Want us to email you when someone covers this?</p>
              <form method="POST" action="/engineers/waitlist" class="max-w-md mx-auto flex flex-wrap gap-2 justify-center">
                <input type="hidden" name="location" value={locationLabel || ''} />
                <input type="hidden" name="date" value={sessionDate || ''} />
                <input type="hidden" name="genre" value={genre || ''} />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="you@email.com"
                  class="bg-ink border border-gold/20 rounded-full px-4 py-2.5 text-cream text-sm focus:outline-none focus:border-gold flex-1 min-w-[220px]"
                />
                <button type="submit" class="bg-gold hover:bg-gold-light text-ink font-semibold px-6 py-2.5 rounded-full transition text-sm">
                  Notify me
                </button>
              </form>
              {waitlistError && <p class="text-sm text-red-400 mt-3">{waitlistError}</p>}
            </>
          ) : null}
        </div>
      ) : (
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {engineers.map((e) => {
            const dist = distanceById.get(e.id)
            const completed = sessionCounts.get(e.id) || 0
            const memberSince = new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            return (
              <a href={`/engineers/${e.id}`} class="bg-surface border border-gold/10 hover:border-gold/40 rounded-2xl p-6 transition group block">
                <div class="flex items-center gap-4 mb-4">
                  <div class="w-16 h-16 rounded-full bg-gold/10 border border-gold/20 overflow-hidden flex items-center justify-center text-gold text-xl shrink-0">
                    {e.photo_url ? (
                      <img src={`/media/${e.photo_url}`} alt={e.display_name} class="w-full h-full object-cover" />
                    ) : (
                      <i class="fa-solid fa-microphone-lines"></i>
                    )}
                  </div>
                  <div>
                    <h3 class="font-display text-lg font-bold group-hover:text-gold transition flex items-center gap-1.5">
                      {e.display_name}
                      {(e.subscription_tier === 'pro' || e.subscription_tier === 'elite') && (
                        <img
                          src="/static/brand/icon-verified-32.png"
                          alt={e.subscription_tier === 'elite' ? 'Elite Verified' : 'Pro Verified'}
                          title={e.subscription_tier === 'elite' ? 'Elite Verified' : 'Pro Verified'}
                          class="w-4 h-4 object-contain shrink-0"
                        />
                      )}
                    </h3>
                    <div class="flex items-center gap-2 mt-1">
                      {e.is_new === 1 ? (
                        <span class="text-[10px] font-bold uppercase tracking-wider text-gold bg-gold/10 rounded-full px-2.5 py-0.5">New</span>
                      ) : (
                        <div class="flex items-center gap-1 text-xs text-muted">
                          <img src="/static/images/mic-rating.png" alt="rating" class="w-3.5 h-3.5" />
                          <span>{e.rating_avg.toFixed(1)} ({e.rating_count})</span>
                        </div>
                      )}
                      {e.offers_remote === 1 && (
                        <span class="text-[10px] font-bold uppercase tracking-wider text-teal bg-teal/10 border border-teal/30 rounded-full px-2.5 py-0.5">
                          Remote
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p class="text-sm text-muted leading-relaxed mb-4 line-clamp-2">{e.bio || 'Mobile recording engineer on Studio2You.'}</p>

                <div class="flex flex-wrap gap-1.5 mb-3 text-[10px] text-muted">
                  {completed > 0 && (
                    <span class="inline-flex items-center gap-1 bg-ink/60 rounded-full px-2.5 py-1">
                      <i class="fa-solid fa-circle-check text-gold"></i> {completed} completed
                    </span>
                  )}
                  <span class="inline-flex items-center gap-1 bg-ink/60 rounded-full px-2.5 py-1">
                    <i class="fa-regular fa-calendar text-gold"></i> Since {memberSince}
                  </span>
                </div>

                <div class="flex items-center justify-between text-sm border-t border-gold/10 pt-4">
                  <span class="text-gold font-semibold">${e.hourly_rate}/hr</span>
                  <span class="text-muted text-xs text-right">
                    {dist != null ? (
                      <span class="font-semibold text-cream">{dist < 1 ? '<1' : Math.round(dist * 10) / 10} mi away</span>
                    ) : (
                      <>{e.location_label || 'Location on request'} · {e.travel_radius_miles}mi radius</>
                    )}
                  </span>
                </div>
                {e.genres && (
                  <div class="flex flex-wrap gap-1.5 mt-3">
                    {e.genres.split(',').slice(0, 3).map((g) => (
                      <span class="text-[10px] font-medium text-cream/70 bg-ink/60 rounded-full px-2.5 py-1">{g.trim()}</span>
                    ))}
                  </div>
                )}
              </a>
            )
          })}
        </div>
      )}

      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script src="/static/directory-map.js"></script>
    </div>
  )
}
