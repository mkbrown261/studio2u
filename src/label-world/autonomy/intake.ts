// Structured release intake that agents (Claude, Codex, any MCP client) and the
// website both write to. Stored at lw_releases.metadata_json.intake so the
// existing reviewer `credits` field and other metadata keep working untouched.

export type Writer = {
  partyId?: string
  legalName: string
  role: 'writer' | 'composer' | 'lyricist' | 'writer_producer'
  split: number // percent of the composition, all writers sum to 100
  pro?: string
  ipi?: string
  publisherName?: string
  publisherIpi?: string
}
export type MasterOwner = {
  entityName: string
  basis: 'COPYRIGHT_OWNER' | 'AUTHORIZED_DESIGNEE'
  percent: number
  rightsBegin: string // 'INCEPTION' or YYYY-MM-DD
  rightsEnd: string // 'PERPETUITY' or YYYY-MM-DD
}
export type Intake = {
  genre?: string
  language?: string
  releaseDate?: string
  recordLabel?: string
  isRerelease?: boolean
  existingUpc?: string
  originalReleaseDate?: string
  explicit?: boolean
  radioEdit?: boolean
  instrumental?: boolean
  containsThirdPartyAudio?: boolean
  thirdPartyAudioLicense?: string
  coverArtThirdParty?: boolean
  coverArtLicense?: string
  isrc?: string
  upc?: string
  featuredArtists?: string[]
  producers?: string[]
  alternateTitles?: string[]
  writers?: Writer[]
  masterOwner?: MasterOwner
  samples?: { description: string; cleared: boolean }[]
  performedPublicly?: boolean
}

export const PROS = ['ASCAP', 'BMI', 'SESAC', 'GMR', 'SOCAN', 'PRS', 'OTHER', 'NONE'] as const
const DATE = /^\d{4}-\d{2}-\d{2}$/

function str(v: unknown, field: string, max = 200): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)) throw new Error(`Invalid ${field}`)
  return v.trim()
}
function bool(v: unknown, field: string): boolean {
  if (typeof v !== 'boolean') throw new Error(`${field} must be true or false`)
  return v
}
function date(v: unknown, field: string): string {
  const s = str(v, field, 10)
  if (!DATE.test(s) || Number.isNaN(Date.parse(s + 'T00:00:00Z'))) throw new Error(`${field} must be YYYY-MM-DD`)
  return s
}
function list(v: unknown, field: string, max = 20): string[] {
  if (!Array.isArray(v) || v.length > max) throw new Error(`${field} must be a list (max ${max})`)
  return [...new Set(v.map((x, i) => str(x, `${field}[${i}]`)))]
}
function percent(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > 100) throw new Error(`${field} must be a percentage between 0 and 100`)
  return Math.round(v * 100) / 100
}

/** Normalize an ISRC: 12 chars CCXXXYYNNNNN, dashes/spaces removed, uppercase. */
export function normalizeIsrc(v: string): string {
  const s = v.replace(/[-\s]/g, '').toUpperCase()
  if (!/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(s)) throw new Error('ISRC must be 12 characters like USABC2600001')
  return s
}
/** UPC (12 digits) or EAN (13 digits). */
export function normalizeUpc(v: string): string {
  const s = v.replace(/[-\s]/g, '')
  if (!/^\d{12,13}$/.test(s)) throw new Error('UPC/EAN must be 12 or 13 digits')
  return s
}
export function normalizeIpi(v: string): string {
  const s = v.replace(/[-\s.]/g, '')
  if (!/^\d{9,11}$/.test(s)) throw new Error('IPI/CAE must be 9 to 11 digits')
  return s
}

const keys = new Set(['genre', 'language', 'releaseDate', 'recordLabel', 'isRerelease', 'existingUpc', 'originalReleaseDate', 'explicit', 'radioEdit', 'instrumental', 'containsThirdPartyAudio', 'thirdPartyAudioLicense', 'coverArtThirdParty', 'coverArtLicense', 'isrc', 'upc', 'featuredArtists', 'producers', 'alternateTitles', 'writers', 'masterOwner', 'samples', 'performedPublicly'])

/**
 * Validate a partial intake patch. `null` clears a field. Unknown keys are rejected
 * so an agent cannot smuggle arbitrary data into the release record.
 */
export function intakePatch(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Patch must be an object')
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!keys.has(k)) throw new Error(`Unknown intake field: ${k}`)
    if (v === null) { out[k] = null; continue }
    switch (k) {
      case 'genre': case 'language': case 'recordLabel': out[k] = str(v, k, 100); break
      case 'thirdPartyAudioLicense': case 'coverArtLicense': out[k] = str(v, k, 2000); break
      case 'releaseDate': case 'originalReleaseDate': out[k] = date(v, k); break
      case 'isRerelease': case 'explicit': case 'radioEdit': case 'instrumental': case 'containsThirdPartyAudio': case 'coverArtThirdParty': case 'performedPublicly': out[k] = bool(v, k); break
      case 'isrc': out[k] = normalizeIsrc(str(v, k, 20)); break
      case 'upc': case 'existingUpc': out[k] = normalizeUpc(str(v, k, 20)); break
      case 'featuredArtists': case 'producers': case 'alternateTitles': out[k] = list(v, k); break
      case 'writers': {
        if (!Array.isArray(v) || v.length < 1 || v.length > 20) throw new Error('writers must list 1 to 20 people')
        out[k] = v.map((w: any, i: number) => {
          if (!w || typeof w !== 'object') throw new Error(`writers[${i}] must be an object`)
          const role = w.role ?? 'writer'
          if (!['writer', 'composer', 'lyricist', 'writer_producer'].includes(role)) throw new Error(`writers[${i}].role invalid`)
          const writer: Writer = { legalName: str(w.legalName, `writers[${i}].legalName`, 120), role, split: percent(w.split, `writers[${i}].split`) }
          if (w.partyId != null) writer.partyId = str(w.partyId, `writers[${i}].partyId`, 100)
          if (w.pro != null) { if (!PROS.includes(w.pro)) throw new Error(`writers[${i}].pro must be one of ${PROS.join(', ')}`); writer.pro = w.pro }
          if (w.ipi != null) writer.ipi = normalizeIpi(str(w.ipi, `writers[${i}].ipi`, 20))
          if (w.publisherName != null) writer.publisherName = str(w.publisherName, `writers[${i}].publisherName`, 120)
          if (w.publisherIpi != null) writer.publisherIpi = normalizeIpi(str(w.publisherIpi, `writers[${i}].publisherIpi`, 20))
          return writer
        })
        break
      }
      case 'masterOwner': {
        const m = v as any
        if (!m || typeof m !== 'object') throw new Error('masterOwner must be an object')
        const basis = m.basis ?? 'COPYRIGHT_OWNER'
        if (!['COPYRIGHT_OWNER', 'AUTHORIZED_DESIGNEE'].includes(basis)) throw new Error('masterOwner.basis invalid')
        const begin = m.rightsBegin ?? 'INCEPTION', end = m.rightsEnd ?? 'PERPETUITY'
        out[k] = {
          entityName: str(m.entityName, 'masterOwner.entityName', 120), basis,
          percent: percent(m.percent ?? 100, 'masterOwner.percent'),
          rightsBegin: begin === 'INCEPTION' ? begin : date(begin, 'masterOwner.rightsBegin'),
          rightsEnd: end === 'PERPETUITY' ? end : date(end, 'masterOwner.rightsEnd')
        } satisfies MasterOwner
        break
      }
      case 'samples': {
        if (!Array.isArray(v) || v.length > 20) throw new Error('samples must be a list (max 20)')
        out[k] = v.map((s: any, i: number) => ({ description: str(s?.description, `samples[${i}].description`, 500), cleared: bool(s?.cleared, `samples[${i}].cleared`) }))
        break
      }
    }
  }
  return out
}

export function applyPatch(current: Intake, patch: Record<string, unknown>): Intake {
  const next: Record<string, unknown> = { ...current }
  for (const [k, v] of Object.entries(patch)) { if (v === null) delete next[k]; else next[k] = v }
  return next as Intake
}
