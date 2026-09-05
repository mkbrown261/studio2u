import type { PackagePurchase } from '../lib/db-packages'

// Mirrors pages/confirmation.tsx's poll-until-paid pattern for a package purchase.
export function PackageConfirmationPage({ purchase, engineerName }: { purchase: PackagePurchase; engineerName: string }) {
  const paid = purchase.status !== 'pending_payment'

  return (
    <div class="max-w-xl mx-auto px-5 py-16">
      <div class="text-center mb-8">
        <div class="w-14 h-14 rounded-full bg-gold/15 flex items-center justify-center text-gold text-2xl mx-auto mb-4">
          <i class={`fa-solid ${paid ? 'fa-circle-check' : 'fa-spinner fa-spin'}`}></i>
        </div>
        <h1 class="font-display text-3xl font-bold">{paid ? 'Package Purchased!' : 'Confirming Payment...'}</h1>
        <p class="text-muted mt-3">with {engineerName}</p>
      </div>

      {paid ? (
        <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-7 mb-8 text-center">
          <p class="text-emerald-400 font-semibold mb-2">
            <i class="fa-solid fa-check mr-2"></i>Payment received
          </p>
          <div class="text-2xl font-bold text-cream mb-1">{purchase.hours_total} hours</div>
          <p class="text-xs text-muted mb-1">${(purchase.price_paid_cents / 100).toFixed(2)} paid</p>
          <p class="text-sm text-cream/70 mt-4">
            You're all set — book a session with {engineerName.split(' ')[0]} anytime and choose "Use my package" to redeem hours.
          </p>
        </div>
      ) : (
        <div
          id="confirming-box"
          class="bg-gold/10 border border-gold/30 rounded-2xl p-7 mb-8 text-center"
          data-purchase-id={purchase.id}
        >
          <p class="text-cream/80 mb-2">
            <i class="fa-solid fa-clock mr-2 text-gold"></i>
            Stripe is finalizing your payment — this usually takes just a moment.
          </p>
          <div class="text-2xl font-bold text-cream mb-1">${(purchase.price_paid_cents / 100).toFixed(2)}</div>
          <p class="text-xs text-muted">{purchase.hours_total} hours</p>
        </div>
      )}

      <div class="text-center text-sm text-muted">
        You can check your bookings anytime at{' '}
        <a href="/status" class="text-gold hover:underline">
          Studio2U → My Bookings
        </a>
      </div>

      {!paid && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
            (function () {
              var box = document.getElementById('confirming-box')
              if (!box) return
              var purchaseId = box.getAttribute('data-purchase-id')
              var attempts = 0
              var interval = setInterval(function () {
                attempts++
                fetch('/api/package-purchases/' + purchaseId + '/status')
                  .then(function (r) { return r.json() })
                  .then(function (data) {
                    if (data.status && data.status !== 'pending_payment') {
                      clearInterval(interval)
                      window.location.reload()
                    }
                  })
                  .catch(function () {})
                if (attempts >= 15) clearInterval(interval)
              }, 2000)
            })()
          `
          }}
        ></script>
      )}
    </div>
  )
}
