import type { PortfolioItem } from '../lib/db-engineers'

export function DashboardPortfolioPage({ items, error }: { items: PortfolioItem[]; error?: string }) {
  return (
    <div class="max-w-2xl mx-auto px-5 py-12">
      <div class="mb-8">
        <a href="/dashboard" class="text-sm text-muted hover:text-gold transition"><i class="fa-solid fa-arrow-left mr-1"></i> Back to Dashboard</a>
        <h1 class="font-display text-3xl font-bold mt-4">Your Portfolio</h1>
        <p class="text-muted mt-2">Add links to work you've recorded, mixed, or mastered — SoundCloud, YouTube, or Spotify.</p>
      </div>

      {error && <div class="bg-wine/20 border border-wine/40 text-wine-light text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

      <form method="POST" action="/dashboard/portfolio" class="bg-surface border border-gold/10 rounded-2xl p-7 space-y-4 mb-8">
        <div>
          <label class="block text-sm font-medium text-muted mb-2">Title</label>
          <input type="text" name="title" required placeholder="e.g. 'Midnight Drive' — Mixed & Mastered" class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
        </div>
        <div>
          <label class="block text-sm font-medium text-muted mb-2">Link (SoundCloud, YouTube, or Spotify)</label>
          <input type="url" name="embed_url" required placeholder="https://soundcloud.com/..." class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
        </div>
        <button type="submit" class="bg-gold hover:bg-gold-light text-ink font-semibold px-6 py-3 rounded-full transition">
          <i class="fa-solid fa-plus mr-1"></i> Add to Portfolio
        </button>
      </form>

      {items.length === 0 ? (
        <div class="text-center py-16 text-muted bg-surface border border-gold/10 rounded-2xl">
          <i class="fa-solid fa-music text-3xl mb-4"></i>
          <p>No portfolio items yet. Add your first one above.</p>
        </div>
      ) : (
        <div class="space-y-3">
          {items.map((item) => (
            <div class="bg-surface border border-gold/10 rounded-xl p-5 flex items-center justify-between gap-4">
              <div>
                <div class="font-semibold text-cream">{item.title}</div>
                <a href={item.embed_url} target="_blank" class="text-xs text-gold hover:underline break-all">{item.embed_url}</a>
              </div>
              <form method="POST" action={`/dashboard/portfolio/${item.id}/delete`}>
                <button type="submit" class="text-sm text-wine-light hover:text-red-400 transition px-3 py-2">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
