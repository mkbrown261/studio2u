import type { SessionUser } from '../lib/session'
import type { EngineerProfile } from '../lib/db-engineers'
import { TIERS } from '../lib/subscriptions'

// Engineer Subscription Tiers pricing page — Free / Pro / Elite. Public (anyone can
// see it, matches the existing customer-facing "Pricing" section on the homepage
// which is about booking rates, not this), but the Subscribe buttons require an
// engineer login and POST straight to /dashboard/subscription/checkout.
export function PricingPage({ user, profile }: { user: SessionUser | null; profile: EngineerProfile | null }) {
  const currentTier = profile?.subscription_tier || 'free'

  return (
    <div class="max-w-6xl mx-auto px-5 py-16">
      <div class="text-center max-w-2xl mx-auto mb-14">
        <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">Engineer Plans</p>
        <h1 class="font-display text-3xl md:text-4xl font-bold">Keep more of what you earn</h1>
        <p class="text-muted mt-4">
          Every Studio2U engineer starts on Free. Upgrade any time to cut your platform fee, unlock way more Project
          storage for your session files, and get seen first in the directory.
        </p>
      </div>

      <div id="pricing-toggle" class="flex items-center justify-center gap-3 mb-12">
        <button
          data-period-btn="monthly"
          class="period-btn text-sm font-semibold px-5 py-2.5 rounded-full border border-gold bg-gold text-ink transition"
        >
          Monthly
        </button>
        <button
          data-period-btn="annual"
          class="period-btn text-sm font-semibold px-5 py-2.5 rounded-full border border-gold/30 text-cream hover:bg-gold/10 transition"
        >
          Annual <span class="text-gold">· 2 months free</span>
        </button>
      </div>

      <div class="grid md:grid-cols-3 gap-6">
        {(['free', 'pro', 'elite'] as const).map((tierKey) => {
          const tier = TIERS[tierKey]
          const isCurrent = currentTier === tierKey
          const isElite = tierKey === 'elite'
          return (
            <div
              class={`relative rounded-2xl p-7 flex flex-col ${
                isElite
                  ? 'bg-gradient-to-br from-wine/30 to-surface border-2 border-gold'
                  : 'bg-surface border border-gold/15'
              }`}
            >
              {isElite && (
                <span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-ink text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full whitespace-nowrap">
                  Power User
                </span>
              )}
              <h3 class="font-display text-2xl font-bold mb-1 mt-2">{tier.label}</h3>
              <div class="mb-1">
                <span class="period-price" data-monthly={`$${tier.priceMonthly}`} data-annual={`$${tier.priceAnnual}`}>
                  ${tier.priceMonthly}
                </span>
                <span class="text-muted text-sm period-suffix" data-monthly="/mo" data-annual="/yr">
                  {tier.priceMonthly === 0 ? '' : '/mo'}
                </span>
              </div>
              <p class="text-gold text-sm font-semibold mb-6">{tier.feePercent}% platform fee per session</p>

              <ul class="space-y-3 text-sm text-muted mb-8 flex-1">
                {tier.perks.map((perk) => (
                  <li class="flex items-start gap-2">
                    <i class="fa-solid fa-check text-gold mt-0.5"></i>
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <span class="text-center text-sm font-semibold border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 rounded-full px-5 py-2.5">
                  <i class="fa-solid fa-circle-check mr-1.5"></i>Your Current Plan
                </span>
              ) : tierKey === 'free' ? (
                user ? (
                  <a
                    href="/dashboard/subscription"
                    class="text-center text-sm font-semibold border border-gold/30 hover:bg-gold/10 text-cream rounded-full px-5 py-2.5"
                  >
                    Manage Plan
                  </a>
                ) : (
                  <a
                    href="/signup?role=engineer"
                    class="text-center text-sm font-semibold border border-gold/30 hover:bg-gold/10 text-cream rounded-full px-5 py-2.5"
                  >
                    Start Free
                  </a>
                )
              ) : user && user.is_engineer === 1 ? (
                <form method="POST" action="/dashboard/subscription/checkout">
                  <input type="hidden" name="tier" value={tierKey} />
                  <input type="hidden" name="period" value="monthly" class="checkout-period-input" />
                  <button
                    type="submit"
                    class={`w-full text-sm font-semibold rounded-full px-5 py-2.5 transition ${
                      isElite ? 'bg-gold hover:bg-gold-light text-ink' : 'border border-gold/30 hover:bg-gold/10 text-cream'
                    }`}
                  >
                    Upgrade to {tier.label}
                  </button>
                </form>
              ) : (
                <a
                  href={user ? '/dashboard/become-engineer' : '/signup?role=engineer'}
                  class={`text-center text-sm font-semibold rounded-full px-5 py-2.5 transition ${
                    isElite ? 'bg-gold hover:bg-gold-light text-ink' : 'border border-gold/30 hover:bg-gold/10 text-cream'
                  }`}
                >
                  Become an Engineer
                </a>
              )}
            </div>
          )
        })}
      </div>

      <div class="mt-14 max-w-3xl mx-auto bg-ink/50 border border-gold/10 rounded-xl p-6 text-sm text-muted">
        <p class="font-semibold text-cream mb-2"><i class="fa-solid fa-circle-info text-gold mr-1.5"></i>How upgrading/downgrading works</p>
        <p class="mb-2">
          Your fee rate for a booking is locked in the moment you create it — upgrading or downgrading later never
          changes what you already booked, only bookings created after the change.
        </p>
        <p>
          If you cancel or downgrade, you keep your current plan's fee rate, storage, badge, and directory placement
          until the end of your paid billing period — no benefits are pulled early.
        </p>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
          (function() {
            var periodBtns = document.querySelectorAll('[data-period-btn]');
            var priceEls = document.querySelectorAll('.period-price');
            var suffixEls = document.querySelectorAll('.period-suffix');
            var periodInputs = document.querySelectorAll('.checkout-period-input');
            function setPeriod(period) {
              periodBtns.forEach(function(btn) {
                var active = btn.getAttribute('data-period-btn') === period;
                btn.classList.toggle('bg-gold', active);
                btn.classList.toggle('text-ink', active);
                btn.classList.toggle('border-gold', active);
                btn.classList.toggle('border-gold/30', !active);
                btn.classList.toggle('text-cream', !active);
              });
              priceEls.forEach(function(el) {
                var val = el.getAttribute('data-' + period);
                if (val) el.textContent = val;
              });
              suffixEls.forEach(function(el) {
                var val = el.getAttribute('data-' + period);
                var priceEl = el.previousElementSibling;
                var isFree = priceEl && (priceEl.getAttribute('data-monthly') === '$0');
                el.textContent = isFree ? '' : val;
              });
              periodInputs.forEach(function(el) { el.value = period; });
            }
            periodBtns.forEach(function(btn) {
              btn.addEventListener('click', function() { setPeriod(btn.getAttribute('data-period-btn')); });
            });
          })();
        `
        }}
      ></script>
    </div>
  )
}
