// Platform-wide settings — simple key/value table (see migrations/0004). Currently just
// the marketplace commission percentage, but built as generic key/value so future Phase 3
// settings (e.g. Stripe mode flags) can reuse it without another migration.

const DEFAULT_COMMISSION_PERCENT = 10

export async function getCommissionPercent(db: D1Database): Promise<number> {
  const row = await db
    .prepare(`SELECT value FROM platform_settings WHERE key = 'commission_percent'`)
    .first<{ value: string }>()
  if (!row) return DEFAULT_COMMISSION_PERCENT
  const parsed = parseFloat(row.value)
  return Number.isFinite(parsed) ? parsed : DEFAULT_COMMISSION_PERCENT
}

export async function setCommissionPercent(db: D1Database, percent: number): Promise<void> {
  const clamped = Math.min(100, Math.max(0, percent))
  await db
    .prepare(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES ('commission_percent', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
    )
    .bind(String(clamped))
    .run()
}

// Given a gross booking price, split it into what the platform keeps and what the
// engineer is owed. Used once Stripe Connect (M5) is wired up for application_fee_amount;
// exposed now so M1's admin UI can show a live preview of what a $X booking nets out to.
export function splitCommission(grossAmount: number, commissionPercent: number) {
  const platformFee = Math.round(grossAmount * (commissionPercent / 100) * 100) / 100
  const engineerPayout = Math.round((grossAmount - platformFee) * 100) / 100
  return { platformFee, engineerPayout }
}
