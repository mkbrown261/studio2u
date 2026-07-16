// Studio2U pricing logic
// First-time clients: $100 flat for up to 3 hours. Extra hours beyond 3 (even for
// first-timers) bill at the standard $40/hr rate. Returning clients: straight $40/hr.

export interface PriceResult {
  amount: number
  breakdown: string
  isFirstTimeRate: boolean
}

const FIRST_TIME_FLAT_RATE = 100
const FIRST_TIME_INCLUDED_HOURS = 3
const STANDARD_HOURLY_RATE = 40

export function calculatePrice(durationHours: number, isFirstTime: boolean): PriceResult {
  if (isFirstTime) {
    if (durationHours <= FIRST_TIME_INCLUDED_HOURS) {
      return {
        amount: FIRST_TIME_FLAT_RATE,
        breakdown: `First session special: $${FIRST_TIME_FLAT_RATE} flat (covers up to ${FIRST_TIME_INCLUDED_HOURS} hours)`,
        isFirstTimeRate: true
      }
    }
    const extraHours = durationHours - FIRST_TIME_INCLUDED_HOURS
    const extraCost = extraHours * STANDARD_HOURLY_RATE
    const total = FIRST_TIME_FLAT_RATE + extraCost
    return {
      amount: total,
      breakdown: `First session special: $${FIRST_TIME_FLAT_RATE} (first ${FIRST_TIME_INCLUDED_HOURS} hrs) + $${STANDARD_HOURLY_RATE}/hr x ${extraHours} extra hr${extraHours !== 1 ? 's' : ''} = $${total}`,
      isFirstTimeRate: true
    }
  }

  const total = durationHours * STANDARD_HOURLY_RATE
  return {
    amount: total,
    breakdown: `Standard rate: $${STANDARD_HOURLY_RATE}/hour x ${durationHours} hour${durationHours !== 1 ? 's' : ''} = $${total}`,
    isFirstTimeRate: false
  }
}

// Availability window: Mon-Fri, 11:00-23:00. Anything outside is flagged as a
// special request that requires manual confirmation rather than auto-accepting.
export function isWithinStandardAvailability(dateStr: string, timeStr: string): boolean {
  const date = new Date(`${dateStr}T00:00:00`)
  const dayOfWeek = date.getDay() // 0 = Sunday, 6 = Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) return false

  const [hourStr] = timeStr.split(':')
  const hour = parseInt(hourStr, 10)
  if (Number.isNaN(hour)) return false

  // Session must start between 11:00 and 22:59 (last hour starting before 11pm)
  return hour >= 11 && hour < 23
}
