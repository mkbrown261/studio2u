import { DAY_NAMES, DAY_SHORT, ALL_HOURS, type WeeklyTemplate } from '../lib/db-availability'

function formatHour(h: number): string {
  const period = h >= 12 ? 'PM' : 'AM'
  let display = h % 12
  if (display === 0) display = 12
  return `${display} ${period}`
}

// Mon-Sun order for display (JS Date.getDay() is Sun-first, but the UI reads Mon-Sun)
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export function DashboardAvailabilityPage({
  weekly,
  overrideDate,
  overrideHours,
  upcomingOverrideDates,
  success,
  error
}: {
  weekly: WeeklyTemplate
  overrideDate: string
  overrideHours: Set<number>
  upcomingOverrideDates: string[]
  success?: string
  error?: string
}) {
  return (
    <div class="max-w-3xl mx-auto px-5 py-12">
      <div class="mb-8">
        <a href="/dashboard" class="text-sm text-muted hover:text-gold transition"><i class="fa-solid fa-arrow-left mr-1"></i> Back to Dashboard</a>
        <h1 class="font-display text-3xl font-bold mt-4">Manage Your Availability</h1>
        <p class="text-muted mt-2">
          Set the hours you're normally open to book each day of the week. Customers can only pick slots you've opened —
          and any slot gets auto-blocked the moment it's booked.
        </p>
      </div>

      {error && <div class="bg-wine/20 border border-wine/40 text-wine-light text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}
      {success && <div class="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm rounded-lg px-4 py-3 mb-6">{success}</div>}

      <form method="POST" action="/dashboard/availability" class="bg-surface border border-gold/10 rounded-2xl p-6 md:p-7 mb-8">
        <h2 class="font-display text-xl font-bold mb-1">Weekly Schedule</h2>
        <p class="text-xs text-muted mb-5">Click a day to open its hours, then toggle the ones you're available.</p>

        <div class="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
          {DISPLAY_ORDER.map((day) => (
            <span class="text-center text-[10px] sm:text-xs font-semibold text-gold uppercase tracking-wide">{DAY_SHORT[day]}</span>
          ))}
        </div>

        <div class="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
          {DISPLAY_ORDER.map((day) => {
            const openCount = (weekly[day] || []).length
            return (
              <details class="day-details group" data-day={day}>
                <summary class="cursor-pointer list-none">
                  <div
                    class={`aspect-square rounded-xl border flex flex-col items-center justify-center transition ${
                      openCount > 0 ? 'bg-gold/15 border-gold/40 text-gold' : 'bg-ink/50 border-gold/10 text-muted'
                    } group-open:ring-2 group-open:ring-gold`}
                  >
                    <i class="fa-solid fa-clock text-sm sm:text-base mb-1"></i>
                    <span class="text-[10px] sm:text-xs font-semibold">{openCount}h</span>
                  </div>
                </summary>
              </details>
            )
          })}
        </div>

        {DISPLAY_ORDER.map((day) => (
          <div class="day-panel hidden bg-ink/40 rounded-xl p-4 mb-3" data-day-panel={day}>
            <p class="text-sm font-semibold text-cream mb-3">{DAY_NAMES[day]}</p>
            <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {ALL_HOURS.map((h) => {
                const checked = (weekly[day] || []).includes(h)
                return (
                  <label class="slot-chip-label">
                    <input type="checkbox" name="slot" value={`${day}-${h}`} checked={checked} class="hidden slot-chip-input" />
                    <span class="slot-chip block text-center text-xs py-2 rounded-lg border cursor-pointer transition select-none border-gold/20 text-muted hover:border-gold/50">
                      {formatHour(h)}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}

        <button type="submit" class="w-full bg-gold hover:bg-gold-light text-ink font-semibold py-3.5 rounded-full transition mt-3">
          Save Weekly Availability
        </button>
      </form>

      <div class="bg-surface border border-gold/10 rounded-2xl p-6 md:p-7 mb-8">
        <h2 class="font-display text-xl font-bold mb-1">One-Off Date Overrides</h2>
        <p class="text-xs text-muted mb-5">
          Close a specific date (vacation, holiday) or open extra hours beyond your normal weekly schedule — without changing your recurring template.
        </p>

        <form method="GET" action="/dashboard/availability" class="flex flex-wrap gap-3 mb-5">
          <input
            type="date"
            name="override_date"
            value={overrideDate}
            min={new Date().toISOString().split('T')[0]}
            required
            class="bg-ink border border-gold/20 rounded-lg px-4 py-2.5 text-cream focus:outline-none focus:border-gold"
          />
          <button type="submit" class="text-sm font-semibold border border-gold/30 hover:bg-gold/10 text-cream px-5 py-2.5 rounded-full transition">
            Load Date
          </button>
        </form>

        {overrideDate && (
          <form method="POST" action="/dashboard/availability/override" class="bg-ink/40 rounded-xl p-4 mb-5">
            <input type="hidden" name="override_date" value={overrideDate} />
            <p class="text-sm font-semibold text-cream mb-3">
              {new Date(`${overrideDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <div class="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-4">
              {ALL_HOURS.map((h) => {
                const checked = overrideHours.has(h)
                return (
                  <label class="slot-chip-label">
                    <input type="checkbox" name="ohour" value={h} checked={checked} class="hidden slot-chip-input" />
                    <span class="slot-chip block text-center text-xs py-2 rounded-lg border cursor-pointer transition select-none border-gold/20 text-muted hover:border-gold/50">
                      {formatHour(h)}
                    </span>
                  </label>
                )
              })}
            </div>
            <button type="submit" class="w-full bg-gold hover:bg-gold-light text-ink font-semibold py-3 rounded-full transition">
              Save Overrides for This Date
            </button>
          </form>
        )}

        {upcomingOverrideDates.length > 0 && (
          <div>
            <p class="text-xs text-muted uppercase tracking-wide mb-2">Dates With Overrides</p>
            <div class="space-y-2">
              {upcomingOverrideDates.map((d) => (
                <div class="flex items-center justify-between bg-ink/40 rounded-lg px-4 py-2.5">
                  <span class="text-sm">{new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <div class="flex items-center gap-3">
                    <a href={`/dashboard/availability?override_date=${d}`} class="text-xs text-gold hover:underline">Edit</a>
                    <form method="POST" action="/dashboard/availability/override/delete">
                      <input type="hidden" name="override_date" value={d} />
                      <button type="submit" class="text-xs text-wine-light hover:text-red-400 transition">Reset to Default</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
          // Toggle chip visuals when checkbox state changes
          document.querySelectorAll('.slot-chip-input').forEach(function (input) {
            function refresh() {
              var chip = input.nextElementSibling
              if (input.checked) {
                chip.classList.add('bg-gold', 'text-ink', 'border-gold', 'font-semibold')
                chip.classList.remove('border-gold/20', 'text-muted')
              } else {
                chip.classList.remove('bg-gold', 'text-ink', 'border-gold', 'font-semibold')
                chip.classList.add('border-gold/20', 'text-muted')
              }
            }
            input.addEventListener('change', refresh)
            refresh()
          })
          document.querySelectorAll('.slot-chip-label').forEach(function (label) {
            label.addEventListener('click', function (e) {
              e.preventDefault()
              var input = label.querySelector('.slot-chip-input')
              input.checked = !input.checked
              input.dispatchEvent(new Event('change'))
            })
          })
          // Day box click opens/closes its hour panel (accordion-style, only one open at a time)
          document.querySelectorAll('.day-details').forEach(function (details) {
            details.querySelector('summary').addEventListener('click', function (e) {
              e.preventDefault()
              var day = details.getAttribute('data-day')
              var panel = document.querySelector('[data-day-panel="' + day + '"]')
              var isOpen = !panel.classList.contains('hidden')
              document.querySelectorAll('.day-panel').forEach(function (p) { p.classList.add('hidden') })
              document.querySelectorAll('.day-details').forEach(function (d) { d.removeAttribute('open') })
              if (!isOpen) {
                panel.classList.remove('hidden')
                details.setAttribute('open', '')
              }
            })
          })
        `
        }}
      ></script>
    </div>
  )
}
