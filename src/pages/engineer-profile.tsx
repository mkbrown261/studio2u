import type { EngineerProfile, PortfolioItem, Review } from '../lib/db-engineers'
import { getPortfolioEmbed } from '../lib/embed'

export function EngineerProfilePage({
  profile,
  portfolio,
  reviews
}: {
  profile: EngineerProfile
  portfolio: PortfolioItem[]
  reviews: Review[]
}) {
  const genres = (profile.genres || '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)

  return (
    <div class="max-w-5xl mx-auto px-5 py-16">
      <a href="/engineers" class="text-sm text-muted hover:text-gold transition inline-block mb-8">
        <i class="fa-solid fa-arrow-left mr-1"></i> Back to Directory
      </a>

      <div class="grid md:grid-cols-3 gap-10 mb-14">
        <div class="md:col-span-1">
          <div class="w-32 h-32 rounded-2xl bg-gold/10 border border-gold/20 overflow-hidden flex items-center justify-center text-gold text-4xl mb-5">
            {profile.photo_url ? (
              <img src={`/media/${profile.photo_url}`} alt={profile.display_name} class="w-full h-full object-cover" />
            ) : (
              <i class="fa-solid fa-microphone-lines"></i>
            )}
          </div>
          {profile.is_new === 1 ? (
            <span class="inline-block text-[10px] font-bold uppercase tracking-wider text-gold bg-gold/10 rounded-full px-3 py-1 mb-3">New Engineer</span>
          ) : (
            <div class="flex items-center gap-2 mb-3 text-sm">
              <img src="/static/images/mic-rating.png" alt="rating" class="w-4 h-4" />
              <span class="font-semibold">{profile.rating_avg.toFixed(1)}</span>
              <span class="text-muted">({profile.rating_count} review{profile.rating_count !== 1 ? 's' : ''})</span>
            </div>
          )}
          <h1 class="font-display text-2xl font-bold mb-1">{profile.display_name}</h1>
          <div class="text-muted text-sm mb-5">{profile.location_label || 'Location on request'} · {profile.travel_radius_miles}mi radius</div>

          <div id="engineer-map" class="w-full h-40 rounded-xl overflow-hidden border border-gold/20 mb-5" data-lat={profile.lat ?? ''} data-lng={profile.lng ?? ''} data-name={profile.display_name}></div>

          <div class="bg-surface border border-gold/10 rounded-xl p-5 mb-5">
            <div class="text-2xl font-display font-bold text-gold mb-1">${profile.hourly_rate}<span class="text-sm text-muted font-sans">/hr</span></div>
            {profile.first_time_discount_amount != null && (
              <div class="text-xs text-emerald-400 mb-3">
                <i class="fa-solid fa-gift mr-1"></i>
                First session: ${profile.first_time_discount_amount} flat (up to {profile.first_time_discount_hours} hrs)
              </div>
            )}
            <a
              href={`/book/${profile.id}`}
              class="block text-center bg-gold hover:bg-gold-light text-ink font-semibold py-3 rounded-full transition text-sm"
            >
              Book {profile.display_name.split(' ')[0]}
            </a>
          </div>

          {genres.length > 0 && (
            <div class="flex flex-wrap gap-1.5">
              {genres.map((g) => (
                <span class="text-[10px] font-medium text-cream/70 bg-ink/60 rounded-full px-2.5 py-1">{g}</span>
              ))}
            </div>
          )}
        </div>

        <div class="md:col-span-2">
          <h2 class="font-display text-xl font-bold mb-3">About</h2>
          <p class="text-muted leading-relaxed mb-8 whitespace-pre-line">{profile.bio}</p>

          {profile.equipment_text && (
            <>
              <h2 class="font-display text-xl font-bold mb-3">Equipment</h2>
              <p class="text-muted leading-relaxed mb-4 whitespace-pre-line">{profile.equipment_text}</p>
              {profile.equipment_photo_url && (
                <img src={`/media/${profile.equipment_photo_url}`} alt="Equipment" class="rounded-xl border border-gold/20 mb-8 max-h-72 object-cover" />
              )}
            </>
          )}
        </div>
      </div>

      {/* PORTFOLIO */}
      <section class="mb-14">
        <h2 class="font-display text-2xl font-bold mb-6">Portfolio</h2>
        {portfolio.length === 0 ? (
          <p class="text-muted text-sm">No portfolio items yet.</p>
        ) : (
          <div class="grid md:grid-cols-2 gap-6">
            {portfolio.map((item) => {
              const embed = getPortfolioEmbed(item.embed_url)
              return (
                <div class="bg-surface border border-gold/10 rounded-2xl p-5">
                  <h3 class="font-semibold text-cream mb-3">{item.title}</h3>
                  {embed ? (
                    <iframe
                      src={embed.iframeSrc}
                      width="100%"
                      height={embed.height}
                      frameborder="0"
                      allow="autoplay; encrypted-media"
                      loading="lazy"
                      class="rounded-lg"
                    ></iframe>
                  ) : (
                    <a href={item.embed_url} target="_blank" class="text-gold hover:underline text-sm break-all">{item.embed_url}</a>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* REVIEWS */}
      <section>
        <h2 class="font-display text-2xl font-bold mb-6">Reviews</h2>
        {reviews.length === 0 ? (
          <p class="text-muted text-sm">No reviews yet — be the first to book and leave one.</p>
        ) : (
          <div class="space-y-4">
            {reviews.map((r) => (
              <div class="bg-surface border border-gold/10 rounded-xl p-5">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-semibold text-cream text-sm">{r.customer_name}</span>
                  <div class="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <img src={n <= r.mic_rating ? '/static/images/mic-rating.png' : '/static/images/mic-rating-empty.png'} alt="mic" class="w-4 h-4" />
                    ))}
                  </div>
                </div>
                {r.comment && <p class="text-muted text-sm leading-relaxed">{r.comment}</p>}
                <div class="text-xs text-muted mt-2">{new Date(r.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script src="/static/engineer-map.js"></script>
    </div>
  )
}
