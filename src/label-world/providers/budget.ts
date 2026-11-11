// Monthly AI spend cap per user (laptop-closed mode runs on the user's own key).
// Costs are estimated from the provider's reported token usage x published prices.
import { ProviderError, costMicros, type Provider } from './adapters'
const month = () => new Date().toISOString().slice(0, 7)
export async function budgetStatus(db: any, user: number) {
  const b: any = await db.prepare('SELECT monthly_cap_cents FROM lw_ai_budgets WHERE user_id=?').bind(user).first()
  const u: any = await db.prepare('SELECT calls,input_tokens,output_tokens,cost_micros,estimated FROM lw_ai_usage WHERE user_id=? AND month=?').bind(user, month()).first()
  const capCents = b?.monthly_cap_cents ?? 500, spentMicros = u?.cost_micros ?? 0
  return { month: month(), capUsd: capCents / 100, spentUsd: Math.round(spentMicros / 10000) / 100, calls: u?.calls ?? 0, tokens: { input: u?.input_tokens ?? 0, output: u?.output_tokens ?? 0 }, includesEstimates: Boolean(u?.estimated), remainingUsd: Math.max(0, Math.round((capCents * 10000 - spentMicros) / 10000) / 100) }
}
export async function setBudget(db: any, user: number, capUsd: unknown) {
  const n = Number(capUsd)
  if (!Number.isFinite(n) || n < 0 || n > 1000) throw new ProviderError('Monthly cap must be between $0 and $1000', 400)
  await db.prepare('INSERT INTO lw_ai_budgets(user_id,monthly_cap_cents) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET monthly_cap_cents=excluded.monthly_cap_cents,updated_at=CURRENT_TIMESTAMP').bind(user, Math.round(n * 100)).run()
  return budgetStatus(db, user)
}
/** Throws before calling the provider if this month's cap is used up. */
export async function spendGuard(db: any, user: number) {
  const s = await budgetStatus(db, user)
  if (s.spentUsd >= s.capUsd) throw new ProviderError(`Monthly AI budget reached ($${s.spentUsd.toFixed(2)} of $${s.capUsd.toFixed(2)}). Raise it in AI setup, or let Codex/Claude handle it.`, 402)
  return s
}
export async function recordSpend(db: any, user: number, provider: Provider, model: string, usage: Record<string, number>) {
  const c = costMicros(provider, model, usage)
  await db.prepare(`INSERT INTO lw_ai_usage(user_id,month,calls,input_tokens,output_tokens,cost_micros,estimated) VALUES (?,?,1,?,?,?,?)
    ON CONFLICT(user_id,month) DO UPDATE SET calls=calls+1,input_tokens=input_tokens+excluded.input_tokens,output_tokens=output_tokens+excluded.output_tokens,cost_micros=cost_micros+excluded.cost_micros,estimated=MAX(estimated,excluded.estimated)`)
    .bind(user, month(), c.input, c.output, c.micros, c.estimated ? 1 : 0).run()
  return c
}
