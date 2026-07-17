import type { EngineerProfile } from '../lib/db-engineers'

export function EngineersDirectoryPage({ engineers, genre }: { engineers: EngineerProfile[]; genre?: string }) {
  return (
    <div class="max-w-6xl mx-auto px-5 py-16">
      <div class="text-center max-w-2xl mx-auto mb-12">
        <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">Engineer Directory</p>
        <h1 class="font-display text-3xl md:text-4xl font-bold">Find your engineer</h1>
        <p class="text-muted mt-4">Browse Studio2You's network of mobile recording engineers. Pick one, check their rate and reviews, then book.</p>
      </div>

      <form method="GET" action="/engineers" class="flex flex-wrap gap-3 justify-center mb-12">
        <input
          type="text"
          name="genre"
          value={genre || ''}
          placeholder="Filter by genre (e.g. Hip Hop)"
          class="bg-surface border border-gold/20 rounded-full px-5 py-3 text-cream text-sm focus:outline-none focus:border-gold w-64"
        />
        <button type="submit" class="bg-gold hover:bg-gold-light text-ink font-semibold px-6 py-3 rounded-full transition text-sm">
          Filter
        </button>
        {genre && (
          <a href="/engineers" class="border border-gold/30 hover:bg-gold/10 text-cream font-semibold px-6 py-3 rounded-full transition text-sm">
            Clear
          </a>
        )}
      </form>

      {engineers.length > 0 && (
        <div
          id="directory-map"
          class="w-full h-72 rounded-2xl overflow-hidden border border-gold/20 mb-12"
          data-engineers={JSON.stringify(
            engineers.map((e) => ({ id: e.id, name: e.display_name, rate: e.hourly_rate, lat: e.lat, lng: e.lng }))
          )}
        ></div>
      )}

      {engineers.length === 0 ? (
        <div class="text-center py-24 text-muted bg-surface border border-gold/10 rounded-2xl">
          <i class="fa-solid fa-user-slash text-3xl mb-4"></i>
          <p>No engineers found{genre ? ` for "${genre}"` : ''} yet. Check back soon.</p>
        </div>
      ) : (
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {engineers.map((e) => (
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
                  <h3 class="font-display text-lg font-bold group-hover:text-gold transition">{e.display_name}</h3>
                  <div class="flex items-center gap-2 mt-1">
                    {e.is_new === 1 ? (
                      <span class="text-[10px] font-bold uppercase tracking-wider text-gold bg-gold/10 rounded-full px-2.5 py-0.5">New</span>
                    ) : (
                      <div class="flex items-center gap-1 text-xs text-muted">
                        <img src="/static/images/mic-rating.png" alt="rating" class="w-3.5 h-3.5" />
                        <span>{e.rating_avg.toFixed(1)} ({e.rating_count})</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <p class="text-sm text-muted leading-relaxed mb-4 line-clamp-2">{e.bio || 'Mobile recording engineer on Studio2You.'}</p>
              <div class="flex items-center justify-between text-sm border-t border-gold/10 pt-4">
                <span class="text-gold font-semibold">${e.hourly_rate}/hr</span>
                <span class="text-muted text-xs">{e.location_label || 'Location on request'} · {e.travel_radius_miles}mi radius</span>
              </div>
              {e.genres && (
                <div class="flex flex-wrap gap-1.5 mt-3">
                  {e.genres.split(',').slice(0, 3).map((g) => (
                    <span class="text-[10px] font-medium text-cream/70 bg-ink/60 rounded-full px-2.5 py-1">{g.trim()}</span>
                  ))}
                </div>
              )}
            </a>
          ))}
        </div>
      )}

      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script src="/static/directory-map.js"></script>
    </div>
  )
}
