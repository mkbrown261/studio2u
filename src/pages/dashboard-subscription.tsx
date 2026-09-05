import type { EngineerProfile } from '../lib/db-engineers'
import { TIERS } from '../lib/subscriptions'

export function DashboardSubscriptionPage({ profile, error }: { profile: EngineerProfile; error?: string }) {
  const currentTier = (profile.subscription_tier || 'free') as 'free' | 'pro' | 'elite'
  const tierConfig = TIERS[currentTier]
  const isDowngradeScheduled = profile.subscription_cancel_at_period_end === 1 && !!profile.pending_tier
  const periodEndLabel = profile.subscription_period_end
    ? new Date(profile.subscription_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  const storageUsedGb = profile.storage_used_bytes / (1024 * 1024 * 1024)
  const storagePct = Math.min(100, (storageUsedGb / tierConfig.storageLimitGb) * 100)

  return (
    <div class="max-w-3xl mx-auto px-5 py-12">
      <div class="mb-8">
        <a href="/dashboard" class="text-sm text-muted hover:text-gold transition"><i class="fa-solid fa-arrow-left mr-1"></i> Back to Dashboard</a>
        <h1 class="font-display text-3xl font-bold mt-4">Your Subscription</h1>
        <p class="text-muted mt-2">Manage your Studio2U plan, billing, and Project storage.</p>
      </div>

      {error && <div class="bg-wine/20 border border-wine/40 text-wine-light text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

      <div class="bg-surface border border-gold/10 rounded-2xl p-7 mb-6">
        <div class="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center text-gold text-lg">
              <i class="fa-solid fa-crown"></i>
            </div>
            <div>
              <h2 class="font-display text-xl font-bold flex items-center gap-2">
                {tierConfig.label} Plan
                {tierConfig.hasBadge && (
                  <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal/15 text-teal border border-teal/30">
                    <i class="fa-solid fa-shield-check mr-1"></i>Verified
                  </span>
                )}
              </h2>
              <p class="text-muted text-sm">{tierConfig.feePercent}% platform fee per session</p>
            </div>
          </div>
          <a href="/pricing" class="text-sm font-semibold border border-gold/30 hover:bg-gold/10 text-cream px-4 py-2 rounded-full transition">
            {currentTier === 'free' ? 'View Plans' : 'Change Plan'}
          </a>
        </div>

        {isDowngradeScheduled && periodEndLabel && (
          <div class="bg-gold/10 border border-gold/30 rounded-lg px-4 py-3 text-sm text-cream/90 mb-5">
            <i class="fa-solid fa-clock text-gold mr-1.5"></i>
            Your plan is changing to <strong class="capitalize">{profile.pending_tier}</strong> on {periodEndLabel}. You'll
            keep all {tierConfig.label} benefits until then.
          </div>
        )}

        {profile.stripe_customer_id && currentTier !== 'free' && (
          <form method="POST" action="/dashboard/subscription/portal">
            <button type="submit" class="text-sm font-semibold bg-gold hover:bg-gold-light text-ink px-5 py-2.5 rounded-full transition">
              <i class="fa-brands fa-stripe-s mr-1.5"></i>Manage Billing & Invoices
            </button>
          </form>
        )}
      </div>

      <div class="bg-surface border border-gold/10 rounded-2xl p-7">
        <h2 class="font-display text-lg font-bold mb-4">Project Storage</h2>
        <div class="flex items-center justify-between text-sm mb-2">
          <span class="text-muted">{storageUsedGb.toFixed(2)} GB used</span>
          <span class="text-muted">{tierConfig.storageLimitGb} GB included</span>
        </div>
        <div class="w-full h-2.5 bg-ink rounded-full overflow-hidden">
          <div
            class={`h-full rounded-full ${storagePct > 90 ? 'bg-wine' : 'bg-gold'}`}
            style={`width: ${storagePct}%`}
          ></div>
        </div>
        {storagePct > 90 && (
          <p class="text-xs text-wine-light mt-3">
            You're near your storage limit. Extra storage is billed at $0.10/GB — or{' '}
            <a href="/pricing" class="underline">upgrade your plan</a> for a much bigger included limit.
          </p>
        )}
        <p class="text-xs text-muted mt-3">
          Manage your session files under <a href="/dashboard/projects" class="text-gold hover:underline">Projects</a>.
        </p>
      </div>
    </div>
  )
}
