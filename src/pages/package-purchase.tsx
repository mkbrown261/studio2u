import type { EngineerProfile } from '../lib/db-engineers'
import type { PackageOffer } from '../lib/db-packages'

export function PackagePurchasePage({ engineer, offer, error }: { engineer: EngineerProfile; offer: PackageOffer; error?: string }) {
  const perHour = offer.price_cents / 100 / offer.total_hours

  return (
    <div class="max-w-xl mx-auto px-5 py-16">
      <a href={`/engineers/${engineer.id}`} class="text-sm text-muted hover:text-gold transition inline-block mb-6">
        <i class="fa-solid fa-arrow-left mr-1"></i> Back to {engineer.display_name}'s profile
      </a>

      <div class="text-center mb-10">
        <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">Session Package</p>
        <h1 class="font-display text-3xl md:text-4xl font-bold">{offer.title || `${offer.total_hours}h Package`}</h1>
        <p class="text-muted mt-3">with {engineer.display_name}</p>
      </div>

      <div class="bg-gold/10 border border-gold/30 rounded-2xl p-6 mb-8 text-center">
        <div class="text-3xl font-display font-bold text-gold mb-1">${(offer.price_cents / 100).toFixed(2)}</div>
        <div class="text-sm text-muted">{offer.total_hours} hours (${perHour.toFixed(2)}/hr) — use across as many future sessions as you like</div>
      </div>

      {error && <div class="bg-wine/20 border border-wine/40 text-wine-light text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

      <form method="POST" action={`/packages/${offer.id}`} class="bg-surface border border-gold/10 rounded-2xl p-6 md:p-8 space-y-5">
        <div>
          <label class="block text-sm font-medium text-muted mb-2">Full Name</label>
          <input type="text" name="customer_name" required class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
        </div>
        <div>
          <label class="block text-sm font-medium text-muted mb-2">Email</label>
          <input type="email" name="customer_email" required class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
        </div>
        <div>
          <label class="block text-sm font-medium text-muted mb-2">Phone Number</label>
          <input type="tel" name="customer_phone" required class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
        </div>
        <button type="submit" class="w-full bg-gold hover:bg-gold-light text-ink font-semibold py-3.5 rounded-full transition">
          Continue to Payment <i class="fa-solid fa-arrow-right ml-1"></i>
        </button>
      </form>

      <div class="flex items-start gap-3 text-xs text-muted mt-6 px-1">
        <i class="fa-solid fa-shield-halved text-gold mt-0.5"></i>
        <span>Payment is processed securely through Stripe. Once purchased, book sessions with {engineer.display_name.split(' ')[0]} as usual and choose "Use my package" to redeem hours instead of paying again.</span>
      </div>
    </div>
  )
}
