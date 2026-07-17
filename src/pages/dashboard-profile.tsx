import type { EngineerProfile } from '../lib/db-engineers'

export function DashboardProfilePage({ profile, error, success }: { profile: EngineerProfile | null; error?: string; success?: string }) {
  return (
    <div class="max-w-2xl mx-auto px-5 py-12">
      <div class="mb-8">
        <a href="/dashboard" class="text-sm text-muted hover:text-gold transition"><i class="fa-solid fa-arrow-left mr-1"></i> Back to Dashboard</a>
        <h1 class="font-display text-3xl font-bold mt-4">Build Your Profile</h1>
        <p class="text-muted mt-2">This publishes instantly when you save. You can edit it anytime.</p>
      </div>

      {error && <div class="bg-wine/20 border border-wine/40 text-wine-light text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}
      {success && <div class="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm rounded-lg px-4 py-3 mb-6">{success}</div>}

      <form method="POST" action="/dashboard/profile" enctype="multipart/form-data" class="bg-surface border border-gold/10 rounded-2xl p-7 space-y-6">
        <div>
          <label class="block text-sm font-medium text-muted mb-2">Display Name</label>
          <input type="text" name="display_name" required value={profile?.display_name || ''} class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
        </div>

        <div>
          <label class="block text-sm font-medium text-muted mb-2">Bio</label>
          <textarea name="bio" rows="4" required class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold">{profile?.bio || ''}</textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-muted mb-2">Profile Photo</label>
          <input type="file" name="photo" accept="image/png,image/jpeg" class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream text-sm focus:outline-none focus:border-gold file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-gold file:text-ink file:font-semibold" />
          {profile?.photo_url && <p class="text-xs text-muted mt-1.5">Current photo on file — upload a new one to replace it.</p>}
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-muted mb-2">Hourly Rate ($)</label>
            <input type="number" name="hourly_rate" min="1" step="1" required value={profile?.hourly_rate ?? 40} class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
          </div>
          <div>
            <label class="block text-sm font-medium text-muted mb-2">Travel Radius (miles)</label>
            <input type="number" name="travel_radius_miles" min="1" step="1" required value={profile?.travel_radius_miles ?? 30} class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
          </div>
        </div>

        <div class="bg-ink/50 rounded-xl p-5">
          <label class="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              id="offer-discount-toggle"
              name="offer_discount"
              value="1"
              checked={profile?.first_time_discount_amount != null}
              class="accent-gold"
            />
            <span class="text-sm font-medium text-cream">Offer a first-time client discount</span>
          </label>
          <div id="discount-fields" class={`grid sm:grid-cols-2 gap-4 ${profile?.first_time_discount_amount != null ? '' : 'hidden'}`}>
            <div>
              <label class="block text-xs text-muted mb-1.5">Flat Rate ($)</label>
              <input type="number" name="discount_amount" min="1" step="1" value={profile?.first_time_discount_amount ?? 100} class="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2.5 text-cream focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label class="block text-xs text-muted mb-1.5">Included Hours</label>
              <input type="number" name="discount_hours" min="1" step="0.5" value={profile?.first_time_discount_hours ?? 3} class="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2.5 text-cream focus:outline-none focus:border-gold" />
            </div>
          </div>
          <p class="text-xs text-muted mt-2">Applies the first time a specific client books with you. After that, they pay your standard hourly rate.</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-muted mb-2">Genres (comma-separated)</label>
          <input type="text" name="genres" placeholder="Hip Hop, R&B, Pop" value={profile?.genres || ''} class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
        </div>

        <div class="bg-ink/50 rounded-xl p-5 space-y-4">
          <p class="text-sm font-medium text-cream -mb-1">Equipment</p>
          <p class="text-xs text-muted -mt-3">Shown on your public profile next to a matching icon for each field.</p>

          <div>
            <label class="flex items-center gap-2 text-sm font-medium text-muted mb-2">
              <img src="/static/brand/icon-mic-64.png" alt="" class="w-5 h-5 object-contain" />
              Microphone
            </label>
            <input type="text" name="mic_spec" placeholder="e.g. Neumann TLM 103" value={profile?.mic_spec || ''} class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
          </div>

          <div>
            <label class="flex items-center gap-2 text-sm font-medium text-muted mb-2">
              <img src="/static/brand/icon-daw-64.png" alt="" class="w-5 h-5 object-contain" />
              DAW
            </label>
            <input type="text" name="daw_spec" placeholder="e.g. Pro Tools, Logic Pro, Ableton" value={profile?.daw_spec || ''} class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
          </div>

          <div>
            <label class="flex items-center gap-2 text-sm font-medium text-muted mb-2">
              <img src="/static/brand/icon-interface-64.png" alt="" class="w-5 h-5 object-contain" />
              Audio Interface
            </label>
            <input type="text" name="interface_spec" placeholder="e.g. Universal Audio Apollo Twin" value={profile?.interface_spec || ''} class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-muted mb-2">Equipment Photo (optional)</label>
          <input type="file" name="equipment_photo" accept="image/png,image/jpeg" class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream text-sm focus:outline-none focus:border-gold file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-gold file:text-ink file:font-semibold" />
          {profile?.equipment_photo_url && <p class="text-xs text-muted mt-1.5">Current photo on file — upload a new one to replace it.</p>}
        </div>

        <div>
          <label class="block text-sm font-medium text-muted mb-2">Cash App Handle</label>
          <input type="text" name="cashapp_handle" required placeholder="$YourCashApp" value={profile?.cashapp_handle || ''} class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
        </div>

        <div>
          <label class="block text-sm font-medium text-muted mb-2">Location (City, State or Zip)</label>
          <input type="text" name="location_label" required placeholder="e.g. Atlanta, GA" value={profile?.location_label || ''} class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
          <p class="text-xs text-muted mt-1.5">We only show a rough, fuzzed pin on the map (1-2 miles off) — never your exact address.</p>
        </div>

        <button type="submit" class="w-full bg-gold hover:bg-gold-light text-ink font-semibold py-3.5 rounded-full transition">
          {profile ? 'Update & Publish Profile' : 'Publish Profile'}
        </button>
      </form>

      <script
        dangerouslySetInnerHTML={{
          __html: `
          document.getElementById('offer-discount-toggle').addEventListener('change', function(e) {
            document.getElementById('discount-fields').classList.toggle('hidden', !e.target.checked)
          })
        `
        }}
      ></script>
    </div>
  )
}
