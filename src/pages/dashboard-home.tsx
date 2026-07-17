import type { SessionUser } from '../lib/session'
import type { EngineerProfile } from '../lib/db-engineers'

export function DashboardHomePage({ user, engineerProfile }: { user: SessionUser; engineerProfile: EngineerProfile | null }) {
  return (
    <div class="max-w-4xl mx-auto px-5 py-12">
      <div class="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-2">Dashboard</p>
          <h1 class="font-display text-3xl font-bold">Hey, {user.name.split(' ')[0]}</h1>
        </div>
        <form method="POST" action="/logout">
          <button type="submit" class="text-sm text-muted hover:text-gold transition flex items-center gap-2">
            <i class="fa-solid fa-right-from-bracket"></i> Log out
          </button>
        </form>
      </div>

      <div class="grid md:grid-cols-2 gap-6">
        {user.is_engineer === 1 && (
          <div class="bg-surface border border-gold/10 rounded-2xl p-7">
            <div class="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center text-gold text-lg mb-4">
              <i class="fa-solid fa-microphone-lines"></i>
            </div>
            <h2 class="font-display text-xl font-bold mb-2">Your Engineer Profile</h2>
            {engineerProfile ? (
              <>
                <p class="text-muted text-sm mb-5">
                  Status:{' '}
                  {engineerProfile.is_suspended === 1 ? (
                    <span class="text-red-400 font-semibold">Suspended</span>
                  ) : (
                    <span class="text-emerald-400 font-semibold">Live</span>
                  )}
                  {engineerProfile.is_new === 1 && <span class="text-gold ml-2">· New</span>}
                </p>
                <div class="flex gap-3 flex-wrap">
                  <a href="/dashboard/profile" class="text-sm font-semibold bg-gold hover:bg-gold-light text-ink px-4 py-2.5 rounded-full transition">Edit Profile</a>
                  <a href="/dashboard/portfolio" class="text-sm font-semibold border border-gold/30 hover:bg-gold/10 text-cream px-4 py-2.5 rounded-full transition">Manage Portfolio</a>
                  <a href="/dashboard/bookings" class="text-sm font-semibold border border-gold/30 hover:bg-gold/10 text-cream px-4 py-2.5 rounded-full transition">My Bookings</a>
                  <a href={`/engineers/${engineerProfile.id}`} class="text-sm font-semibold border border-gold/30 hover:bg-gold/10 text-cream px-4 py-2.5 rounded-full transition">View Public Page</a>
                </div>
              </>
            ) : (
              <>
                <p class="text-muted text-sm mb-5">You haven't set up your engineer profile yet. Build it out and publish to start getting booked.</p>
                <a href="/dashboard/profile" class="inline-block text-sm font-semibold bg-gold hover:bg-gold-light text-ink px-5 py-2.5 rounded-full transition">Set Up Profile</a>
              </>
            )}
          </div>
        )}

        {user.is_artist === 1 && (
          <div class="bg-surface border border-gold/10 rounded-2xl p-7">
            <div class="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center text-gold text-lg mb-4">
              <i class="fa-solid fa-calendar-check"></i>
            </div>
            <h2 class="font-display text-xl font-bold mb-2">Your Sessions</h2>
            <p class="text-muted text-sm mb-5">View your booking history, check statuses, and leave reviews for completed sessions.</p>
            <a href={`/status?email=${encodeURIComponent(user.email)}`} class="inline-block text-sm font-semibold bg-gold hover:bg-gold-light text-ink px-5 py-2.5 rounded-full transition">View My Bookings</a>
          </div>
        )}
      </div>

      {!user.is_engineer && (
        <div class="mt-8 bg-wine/10 border border-wine/30 rounded-2xl p-6 text-center">
          <p class="text-cream/80 text-sm mb-3">Want to offer recording sessions on Studio2You?</p>
          <a href="/dashboard/become-engineer" class="inline-block text-sm font-semibold bg-gold hover:bg-gold-light text-ink px-5 py-2.5 rounded-full transition">Become an Engineer</a>
        </div>
      )}
    </div>
  )
}
