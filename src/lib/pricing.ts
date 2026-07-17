// Studio2U pricing logic — Phase 2: rate + first-time discount are per-engineer now
// (each engineer sets their own hourly rate and can optionally offer their own
// first-time discount). "First time" means first COMPLETED-or-any booking with THAT
// SPECIFIC engineer, not a platform-wide flag.

export interface PriceResult {
  amount: number
  breakdown: string
  isFirstTimeRate: boolean
}

export interface EngineerRateInfo {
  hourlyRate: number
  firstTimeDiscountAmount: number | null // null = engineer offers no intro discount
  firstTimeDiscountHours: number | null
}

export function calculatePrice(
  durationHours: number,
  isFirstTimeWithThisEngineer: boolean,
  rate: EngineerRateInfo
): PriceResult {
  const hasDiscount = rate.firstTimeDiscountAmount != null && rate.firstTimeDiscountHours != null

  if (isFirstTimeWithThisEngineer && hasDiscount) {
    const flatRate = rate.firstTimeDiscountAmount as number
    const includedHours = rate.firstTimeDiscountHours as number

    if (durationHours <= includedHours) {
      return {
        amount: flatRate,
        breakdown: `First session special: $${flatRate} flat (covers up to ${includedHours} hours)`,
        isFirstTimeRate: true
      }
    }
    const extraHours = durationHours - includedHours
    const extraCost = extraHours * rate.hourlyRate
    const total = flatRate + extraCost
    return {
      amount: total,
      breakdown: `First session special: $${flatRate} (first ${includedHours} hrs) + $${rate.hourlyRate}/hr x ${extraHours} extra hr${extraHours !== 1 ? 's' : ''} = $${total}`,
      isFirstTimeRate: true
    }
  }

  const total = durationHours * rate.hourlyRate
  return {
    amount: total,
    breakdown: `Standard rate: $${rate.hourlyRate}/hour x ${durationHours} hour${durationHours !== 1 ? 's' : ''} = $${total}`,
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
