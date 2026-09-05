import type { SessionUser } from '../lib/session'
import type { EngineerProfile } from '../lib/db-engineers'
import type { ReferralStats } from '../lib/db-referrals'

export function DashboardHomePage({
  user,
  engineerProfile,
  referralCode,
  referralStats,
  creditBalance
}: {
  user: SessionUser
  engineerProfile: EngineerProfile | null
  referralCode?: string
  referralStats?: ReferralStats
  creditBalance?: number
}) {
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

      {user.is_engineer === 1 && engineerProfile && engineerProfile.stripe_charges_enabled !== 1 && (
        <div class="mb-6 bg-wine/15 border border-wine/40 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-3">
            <i class="fa-solid fa-triangle-exclamation text-gold text-lg"></i>
            <p class="text-sm text-cream/90">
              <strong>Connect Stripe to get booked.</strong> Studio2U requires every engineer to finish Stripe
              onboarding before appearing in the directory or accepting bookings.
            </p>
          </div>
          <a href="/dashboard/payments" class="text-sm font-semibold bg-gold hover:bg-gold-light text-ink px-4 py-2 rounded-full transition whitespace-nowrap">
            Connect Now
          </a>
        </div>
      )}

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
                  <a href="/dashboard/availability" class="text-sm font-semibold border border-gold/30 hover:bg-gold/10 text-cream px-4 py-2.5 rounded-full transition">Manage Availability</a>
                  <a href="/dashboard/payments" class="text-sm font-semibold border border-gold/30 hover:bg-gold/10 text-cream px-4 py-2.5 rounded-full transition">
                    Payments
                    {engineerProfile.stripe_charges_enabled === 1 ? (
                      <i class="fa-solid fa-circle-check text-emerald-400 ml-1.5"></i>
                    ) : (
                      <i class="fa-solid fa-triangle-exclamation text-gold ml-1.5"></i>
                    )}
                  </a>
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

      {referralCode && (
        <div id="invite-earn" class="mt-8 bg-surface border border-gold/20 rounded-2xl p-7">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center text-gold text-lg">
              <i class="fa-solid fa-gift"></i>
            </div>
            <div>
              <h2 class="font-display text-xl font-bold">Invite &amp; Earn</h2>
              <p class="text-muted text-sm">
                {user.is_engineer === 1
                  ? 'Share your link — when someone you invite books their first completed session, you get a free month.'
                  : 'Share your link — when someone you invite books their first completed session, you both win.'}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 bg-ink border border-gold/20 rounded-lg px-4 py-3 mb-4">
            <code id="referral-link" class="text-sm text-gold flex-1 truncate">
              studio2u.pages.dev/signup?ref={referralCode}
            </code>
            <button
              type="button"
              onclick={`navigator.clipboard.writeText('https://studio2u.pages.dev/signup?ref=${referralCode}'); this.innerText='Copied!'; setTimeout(() => this.innerText='Copy', 1500)`}
              class="text-xs font-semibold bg-gold hover:bg-gold-light text-ink px-3 py-1.5 rounded-full transition shrink-0"
            >
              Copy
            </button>
          </div>

          <div class="grid grid-cols-3 gap-1.5 xs:gap-2 sm:gap-3 text-center">
            <div class="bg-ink rounded-xl px-1.5 sm:px-3 py-3">
              <div class="text-xl sm:text-2xl font-bold text-cream">{referralStats?.total_referred ?? 0}</div>
              <div class="text-[9px] sm:text-[11px] text-muted uppercase tracking-wide mt-1 leading-tight">Invited</div>
            </div>
            <div class="bg-ink rounded-xl px-1.5 sm:px-3 py-3">
              <div class="text-xl sm:text-2xl font-bold text-emerald-400">{referralStats?.total_rewards_credited ?? 0}</div>
              <div class="text-[9px] sm:text-[11px] text-muted uppercase tracking-wide mt-1 leading-tight">Rewards Earned</div>
            </div>
            <div class="bg-ink rounded-xl px-1.5 sm:px-3 py-3">
              <div class="text-xl sm:text-2xl font-bold text-gold">${(creditBalance ?? 0).toFixed(0)}</div>
              <div class="text-[9px] sm:text-[11px] text-muted uppercase tracking-wide mt-1 leading-tight">Credit Balance</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
