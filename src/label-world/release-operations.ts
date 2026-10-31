export const releaseModes = ['FAST_RELEASE', 'MANAGED_RELEASE'] as const
export const organizations = ['PRO', 'MLC', 'SOUNDEXCHANGE', 'COPYRIGHT'] as const
export const rightsCategories = ['master', 'beat', 'samples', 'cover_interpolation', 'collaborators', 'ai_sources'] as const
export type RightsCategory = typeof rightsCategories[number]
export type Assertion = { status: 'CONFIRMED' | 'NOT_APPLICABLE' | 'UNKNOWN' | 'DISPUTED' | 'UNLICENSED'; source: 'USER_CONFIRMED' | 'UNKNOWN'; note: string }
export type RightsAssertions = Record<RightsCategory, Assertion>
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object')
  return value as Record<string, unknown>
}
export function text(value: unknown, limit = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error('Invalid text')
  return value.trim()
}
export function modeInput(value: unknown) {
  const mode = value ?? 'FAST_RELEASE'
  if (!releaseModes.includes(mode as typeof releaseModes[number])) throw new Error('Invalid release mode')
  return mode as typeof releaseModes[number]
}
export function rightsInput(value: unknown): RightsAssertions {
  const input = object(value), assertions = {} as RightsAssertions
  for (const key of rightsCategories) {
    const a = object(input[key])
    if (!['CONFIRMED', 'NOT_APPLICABLE', 'UNKNOWN', 'DISPUTED', 'UNLICENSED'].includes(String(a.status))) throw new Error(`Invalid ${key} status`)
    if (!['USER_CONFIRMED', 'UNKNOWN'].includes(String(a.source))) throw new Error(`Invalid ${key} provenance`)
    if (key === 'master' && a.status === 'NOT_APPLICABLE') throw new Error('Master authority is required')
    if (['CONFIRMED', 'NOT_APPLICABLE'].includes(String(a.status)) && a.source !== 'USER_CONFIRMED') throw new Error('Owner confirmation required')
    assertions[key] = { status: a.status as Assertion['status'], source: a.source as Assertion['source'], note: text(a.note, 2000) }
  }
  return assertions
}
export function rightsGate(assertions: RightsAssertions | null) {
  const checks = rightsCategories.map(category => {
    const a = assertions?.[category]
    return { category, result: !a || a.status === 'UNKNOWN' ? 'NEEDS_HUMAN_REVIEW' : ['DISPUTED', 'UNLICENSED'].includes(a.status) ? 'FAIL' : 'PASS', provenance: a?.source ?? 'UNKNOWN', note: a?.note ?? 'Owner attestation required' }
  })
  return { status: checks.every(c => c.result === 'PASS') ? 'OWNER_ATTESTED' : 'BLOCKED', checks, legalVerification: 'NOT_TESTED' }
}
export function registrationInput(value: unknown) {
  const v = object(value)
  if (!Number.isSafeInteger(v.revision) || Number(v.revision) < 1) throw new Error('Revision required')
  if (!['PENDING', 'PREPARED', 'AWAITING_APPROVAL', 'AWAITING_VERIFICATION', 'BLOCKED', 'NOT_APPLICABLE'].includes(String(v.status))) throw new Error('Official completion cannot be asserted through this endpoint')
  const reason = text(v.reason, 2000)
  const applicability = v.applicability ?? 'UNKNOWN'
  if (!['UNKNOWN', 'APPLICABLE', 'NOT_APPLICABLE'].includes(String(applicability))) throw new Error('Invalid applicability')
  if ((v.status === 'NOT_APPLICABLE') !== (applicability === 'NOT_APPLICABLE')) throw new Error('Applicability must match status')
  let nextReviewAt: string | null = null
  if (v.nextReviewAt) { const d = new Date(String(v.nextReviewAt)); if (Number.isNaN(d.getTime())) throw new Error('Invalid review date'); nextReviewAt = d.toISOString() }
  let receiptUrl: string | null = null
  if (v.receiptUrl) { const u = new URL(text(v.receiptUrl, 2000)); if (u.protocol !== 'https:' || u.username || u.password) throw new Error('Receipt must be an HTTPS URL'); receiptUrl = u.href }
  const reportedStatus = v.reportedStatus ?? null
  if (reportedStatus !== null && !['SUBMITTED', 'CONFIRMED'].includes(String(reportedStatus))) throw new Error('Invalid reported status')
  if (v.status === 'AWAITING_VERIFICATION' && (!receiptUrl || !reportedStatus)) throw new Error('Receipt and reported status required')
  if (v.status !== 'AWAITING_VERIFICATION' && reportedStatus !== null) throw new Error('Reported filing requires verification')
  return { revision: Number(v.revision), status: String(v.status), reason, applicability: String(applicability), nextReviewAt, receiptUrl, reportedStatus }
}
