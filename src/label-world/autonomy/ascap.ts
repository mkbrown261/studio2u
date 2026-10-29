// ASCAP work registration, built to match the Member Access "Register a Work" form
// section by section (layout confirmed from the user's screenshots, 2026-10-28):
//   Work Title (+ Alternative Title)
//   Writers & Publishers   writers total 50%, publishers total 50%
//     per writer: Search by Writer IPI or Name*, Role*, Share %*
//     per writer: Search by Publisher IPI or Name*, Territory* (WORLD), Share %*, or
//                 [ ] This writer has no Publisher on this work
//   Has this work been recorded? If not, skip.   Recording Artist*, Sound Recording Title, ISRC, Release Date MM/DD/YYYY
//   Has this work been performed? If not, skip.  Performer Name
//   Commercial, film or other Product? If not, skip.  Product Type*, Commercial/Product/Production Name*
//   Is this a concert work? If not, skip.
//   Does this work include a sample? If not, skip.  Title of Work Used*, Writer Name*, IPI (confirms permission)
//   Does this work use public domain elements? If not, skip.  Music / Lyrics / Both
//   Do you know the performance time? If not, skip.  HH:MM:SS (max 12 hours)
//   SUBMIT = the member confirms the information is accurate (Works Registration Terms). Human only.
// Official rules used (ascap.com/help/registering-your-music, checked 2026-10-28):
//  - writer splits add up to 50% and publisher splits add up to 50%
//  - if a co-writer already registered the work at ASCAP, don't register it again (check it is right)
//  - a co-writer at another PRO still needs the work registered at ASCAP for the ASCAP writer to be paid
//  - producers are credited as writers only if they contributed to the composition
//  - only completed songs; no beats alone, sound effects or comedy
//  - samples need permission from the master owner and the sampled writers/publishers, with agreed splits
import { ServiceError, memberRole, requireEditor } from './service'
import { intakePatch, applyPatch, hms, type Intake, type Writer } from './intake'

export const ASCAP_FORM_VERSION = '2026-10-28'
export type Item = { section: string; label: string; value: string | null; action: 'FILL' | 'SKIP' | 'ASK' | 'STOP' | 'HUMAN'; note?: string; key?: string }
export type WorkInput = {
  title: string; artistCredit?: string | null; releaseDate?: string | null; isrc?: string | null; durationSec?: number | null
  intake: Intake; released: boolean; featuredOnly?: boolean
}
const ROLE: Record<string, string> = { writer: 'Composer/Author', writer_producer: 'Composer/Author', composer: 'Composer', lyricist: 'Author' }
const mdy = (d?: string | null) => d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}` : null

/** Splits of 100 -> ASCAP shares of 50, rounded to 2 decimals so they always total exactly 50.00. */
export function halfShares(splits: number[]) {
  const raw = splits.map(s => s * 50), floor = raw.map(x => Math.floor(x) / 100)
  let left = Math.round(5000 - floor.reduce((a, b) => a + b * 100, 0))
  const order = raw.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r)
  for (const o of order) { if (left <= 0) break; floor[o.i] = Math.round((floor[o.i] + 0.01) * 100) / 100; left-- }
  return floor
}

/** Everything the agent types, in form order, plus what to ask and what stops the registration. */
export function ascapForm(w: WorkInput) {
  const i = w.intake, items: Item[] = [], writers: Writer[] = i.writers ?? []
  const add = (section: string, label: string, value: string | null, action: Item['action'], note?: string, key?: string) => items.push({ section, label, value, action, ...(note ? { note } : {}), ...(key ? { key } : {}) })
  const ask = (section: string, label: string, key: string, question: string) => add(section, label, null, 'ASK', question, key)

  // Work title
  add('Work Title', 'Work Title*', w.title, 'FILL', 'Exact title as released. No "feat.", no "prod. by", no version words unless they are part of the title.')
  for (const t of i.alternateTitles ?? []) add('Work Title', 'Alternative Title', t, 'FILL', 'Click "+ Alternative Title" for each.')

  // Writers & publishers
  const S = 'Writers & Publishers'
  const total = Math.round(writers.reduce((a, x) => a + x.split, 0) * 100) / 100
  if (!writers.length) ask(S, 'Writers', 'writers', w.featuredOnly
    ? 'You are featured on this song. Did you write your part, and what share did everyone agree on? The main artist may have registered it already, so we check the ASCAP repertory first.'
    : 'Who wrote this song (lyrics and music), and what percent did each person write? Producers count only if they helped write it. Please send a split sheet if you have one.')
  else if (total !== 100) add(S, 'Writer splits', `${total}%`, 'STOP', `Writer splits add up to ${total}%, not 100%. Fix the split (or sign a split sheet) before registering.`, 'writers')
  if (writers.length && total === 100) {
    const shares = halfShares(writers.map(x => x.split))
    writers.forEach((x, n) => {
      const who = `Writer ${n + 1}: ${x.legalName}`
      add(S, `${who} · Search by Writer IPI or Name*`, x.ipi ?? x.legalName, x.ipi ? 'FILL' : 'ASK', x.ipi ? 'Type the IPI and pick the matching name from the list.' : `What is ${x.legalName}'s IPI number? (Searching by name works but risks picking the wrong person.)`, 'writers')
      add(S, `${who} · Role*`, ROLE[x.role] ?? 'Composer/Author', 'FILL', 'Pick this option in the Role dropdown.')
      add(S, `${who} · Share %*`, String(shares[n]), 'FILL', `${x.split}% of the song = ${shares[n]}% on ASCAP's 50% writer side.`)
      if (x.pro && x.pro !== 'ASCAP') add(S, `${who} · PRO`, x.pro, 'FILL', `Still list ${x.legalName} with their share. ASCAP matches them to ${x.pro} by IPI.`)
      if (x.publisherName) {
        add(S, `${who} · Search by Publisher IPI or Name*`, x.publisherIpi ?? x.publisherName, 'FILL', x.publisherIpi ? 'Type the publisher IPI and pick it.' : 'Search the publisher name; confirm the right company appears.')
        add(S, `${who} · Territory*`, 'WORLD', 'FILL', 'Leave as WORLD unless the publishing deal says otherwise.')
        add(S, `${who} · Publisher Share %*`, String(shares[n]), 'FILL')
      } else if (x.noPublisher) {
        add(S, `${who} · [x] This writer has no Publisher on this work`, 'checked', 'FILL', 'Tick the box instead of searching a publisher.')
      } else ask(S, `${who} · Publisher`, 'writers', `Does ${x.legalName} have a publisher or their own publishing company at ASCAP? If not, we tick "This writer has no Publisher on this work". (ASCAP pays self-publishers both shares, so it may be worth setting one up later.)`)
      if (n < writers.length - 1) add(S, '+Add Writer', null, 'FILL', 'Click "+Add Writer" for the next person.')
    })
  }

  // Recorded
  const R = 'Has this work been recorded?'
  if (w.released || w.isrc || i.isrc) {
    add(R, 'Recording Artist*', w.artistCredit ?? null, w.artistCredit ? 'FILL' : 'ASK', 'Main artist as credited on streaming services.', 'artist')
    add(R, 'Sound Recording Title', i.recordingTitle ?? w.title, 'FILL')
    const isrc = i.isrc ?? w.isrc ?? null
    add(R, 'ISRC', isrc, isrc ? 'FILL' : 'SKIP', isrc ? 'Paste with no dashes.' : 'Optional. Leave blank if unknown; add it later.')
    const rd = mdy(i.releaseDate ?? w.releaseDate)
    add(R, 'Release Date MM/DD/YYYY', rd, rd ? 'FILL' : 'SKIP')
  } else add(R, 'Whole section', null, 'SKIP', 'Not recorded/released yet. Skip (add it once it is out).')

  // Performed
  const performers = i.performers?.length ? i.performers : w.released && w.artistCredit ? [w.artistCredit] : []
  if (performers.length) performers.forEach((p, n) => add('Has this work been performed?', n ? '+ Add Performer · Performer Name' : 'Performer Name', p, 'FILL'))
  else add('Has this work been performed?', 'Whole section', null, 'SKIP', 'Skip until it has been released or performed.')

  // Commercial / film / product
  if (i.commercialUse) {
    add('Commercial, film or other Product?', 'Product Type*', i.commercialUse.productType, 'FILL', 'Choose the closest option in the dropdown.')
    add('Commercial, film or other Product?', 'Commercial/Product/Production Name*', i.commercialUse.productionName, 'FILL')
  } else add('Commercial, film or other Product?', 'Whole section', null, 'SKIP', 'Skip unless the song was written for an ad, film, TV show or product. (TV placements of a released song go through cue sheets instead.)')

  add('Is this a concert work?', 'Whole section', null, 'SKIP', 'Skip. Concert works are classical/concert-hall pieces.')

  // Samples
  const SM = 'Does this work include a sample?'
  const samples = i.samples ?? []
  if (!samples.length) {
    if (i.containsThirdPartyAudio) ask(SM, 'Sample details', 'samples', 'The release says it contains outside audio. Is it a sample of another song? Which song, who wrote it, and was it cleared?')
    else add(SM, 'Whole section', null, 'SKIP', 'No samples on file. Skip.')
  }
  samples.forEach((s, n) => {
    if (!s.cleared) { add(SM, `Sample ${n + 1}`, s.description, 'STOP', 'Not cleared. Filling this section confirms you have permission. Clear it (and agree splits with the sampled writers/publishers) before registering.', 'samples'); return }
    add(SM, `Sample ${n + 1} · Title of Work Used*`, s.workTitle ?? null, s.workTitle ? 'FILL' : 'ASK', s.workTitle ? undefined : `What is the title of the song sampled in "${s.description}"?`, 'samples')
    const ws = s.writers ?? []
    if (!ws.length) ask(SM, `Sample ${n + 1} · Writer Name*, IPI`, 'samples', `Who wrote the sampled song in "${s.description}"? (Check ascap.com/repertory.)`)
    ws.forEach((x, j) => add(SM, `Sample ${n + 1} · ${j ? '+ Add Writer · ' : ''}Writer Name*, IPI`, x.ipi ? `${x.name}, ${x.ipi}` : x.name, 'FILL'))
  })

  // Public domain
  if (i.publicDomain) add('Does this work use public domain elements?', 'Music / Lyrics / Both', { music: 'Music', lyrics: 'Lyrics', both: 'Both' }[i.publicDomain], 'FILL')
  else add('Does this work use public domain elements?', 'Whole section', null, 'SKIP', 'Skip unless you arranged an old public-domain song.')

  // Performance time
  const dur = i.durationSec ?? w.durationSec ?? null
  if (dur) add('Do you know the performance time?', 'HH:MM:SS', hms(dur), 'FILL', i.durationSec ? undefined : 'From the streaming services; verify against the master if it differs.')
  else add('Do you know the performance time?', 'HH:MM:SS', null, 'SKIP', 'Optional. Skip if unknown.')

  add('Submit', 'Press SUBMIT', null, 'HUMAN', 'Clicking Submit confirms the information is accurate under the Works Registration Terms. Only you press it. The agent may press SAVE to keep a draft.')

  const asks = items.filter(x => x.action === 'ASK'), stops = items.filter(x => x.action === 'STOP')
  return {
    formVersion: ASCAP_FORM_VERSION, url: 'https://members.ascap.com (Works > Register a Work)',
    status: stops.length ? 'BLOCKED' : asks.length ? 'NEEDS_INFO' : 'READY' as 'BLOCKED' | 'NEEDS_INFO' | 'READY',
    items, asks, stops,
    say: asks.length ? `To register "${w.title}" with ASCAP I need: ${[...new Set(asks.map(a => a.note))].join(' ')}` : stops.length ? `I can't register "${w.title}" yet: ${stops.map(s => s.note).join(' ')}` : `"${w.title}" is ready. I'll fill the ASCAP form and stop on Submit for you.`
  }
}

// ---------------- public metadata check (free, no screen, no model) ----------------
type Fetcher = (url: string) => Promise<any>
const defaultFetch: Fetcher = async url => { const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Studio2U-LabelWorld/1.0' } }); if (!r.ok) throw new Error('lookup failed'); return r.json() }
const norm = (s = '') => s.toLowerCase().normalize('NFKD').replace(/\(.*?\)|\[.*?\]|feat\..*$|ft\..*$/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
/** Cross-check title, artist, ISRC, length and release date against Deezer + Apple. Conflicts are flagged, never auto-fixed. */
export async function checkMetadata(t: { title: string; artistCredit?: string | null; isrc?: string | null; durationSec?: number | null; releaseDate?: string | null }, fetcher: Fetcher = defaultFetch) {
  const seen: { source: string; title?: string; artist?: string; isrc?: string; durationSec?: number; releaseDate?: string; contributors?: string[] }[] = []
  if (t.isrc) try {
    const d = await fetcher(`https://api.deezer.com/track/isrc:${encodeURIComponent(t.isrc)}`)
    if (d && !d.error) seen.push({ source: 'Deezer (by ISRC)', title: d.title, artist: d.artist?.name, isrc: d.isrc, durationSec: d.duration, releaseDate: d.release_date ?? d.album?.release_date, contributors: (d.contributors ?? []).map((c: any) => c.name) })
  } catch { /* lookup is best effort */ }
  try {
    const d = await fetcher(`https://itunes.apple.com/search?term=${encodeURIComponent(`${t.title} ${t.artistCredit ?? ''}`.trim())}&entity=song&limit=5`)
    const hit = (d?.results ?? []).find((x: any) => norm(x.trackName) === norm(t.title))
    if (hit) seen.push({ source: 'Apple Music', title: hit.trackName, artist: hit.artistName, durationSec: hit.trackTimeMillis ? Math.round(hit.trackTimeMillis / 1000) : undefined, releaseDate: hit.releaseDate?.slice(0, 10) })
  } catch { /* best effort */ }
  const conflicts: string[] = []
  for (const s of seen) {
    if (s.title && norm(s.title) !== norm(t.title)) conflicts.push(`${s.source} title is "${s.title}" (we have "${t.title}").`)
    if (s.artist && t.artistCredit && norm(s.artist) !== norm(t.artistCredit)) conflicts.push(`${s.source} credits "${s.artist}" (we have "${t.artistCredit}").`)
    if (s.isrc && t.isrc && s.isrc !== t.isrc) conflicts.push(`${s.source} ISRC ${s.isrc} differs from ${t.isrc}.`)
    if (s.durationSec && t.durationSec && Math.abs(s.durationSec - t.durationSec) > 3) conflicts.push(`${s.source} length ${hms(s.durationSec)} vs ${hms(t.durationSec)}.`)
    if (s.releaseDate && t.releaseDate && s.releaseDate !== t.releaseDate) conflicts.push(`${s.source} release date ${s.releaseDate} vs ${t.releaseDate} (different albums/versions are common; use the original single date).`)
  }
  const durations = seen.map(s => s.durationSec).filter(Boolean) as number[]
  return { sources: seen.map(s => s.source), seen, conflicts, suggested: { durationSec: t.durationSec ?? durations[0] ?? null, featured: [...new Set(seen.flatMap(s => s.contributors ?? []))].filter(n => norm(n) !== norm(t.artistCredit ?? '')) }, verified: seen.length > 0 && !conflicts.length }
}

// ---------------- catalog songs (most of the 60 songs are not Studio2U releases) ----------------
const WORK_KEYS = new Set(['writers', 'alternateTitles', 'performers', 'durationSec', 'recordingTitle', 'commercialUse', 'publicDomain', 'samples', 'isrc', 'releaseDate', 'containsThirdPartyAudio'])
async function trackRow(db: any, label: string, id: string) {
  const t: any = await db.prepare('SELECT * FROM lw_catalog_tracks WHERE label_id=? AND id=?').bind(label, id).first()
  if (!t) throw new ServiceError('Song not found in catalog', 404)
  return t
}
const workOf = (t: any): Intake => { try { return JSON.parse(t.work_json || '{}') } catch { return {} } }
async function identity(db: any, label: string) { return db.prepare('SELECT artist_name,legal_name,aliases_json,pro,ipi FROM lw_label_identity WHERE label_id=?').bind(label).first() as Promise<any> }
function isFeaturedOnly(t: any, id: any) {
  if (!id) return false
  const names = [id.artist_name, ...JSON.parse(id.aliases_json || '[]')].map((n: string) => norm(n))
  return !names.includes(norm(t.artist_credit)) && /feat|ft\.|with/i.test(t.title + ' ' + t.artist_credit)
}
/** Fill writer IPI/PRO/publisher from saved parties or the artist identity, by exact legal name only. */
async function enrichWriters(db: any, label: string, work: Intake, id: any): Promise<Intake> {
  if (!work.writers?.length) return work
  const parties = (await db.prepare('SELECT legal_name,pro,ipi,publisher_name,publisher_ipi FROM lw_parties WHERE label_id=?').bind(label).all()).results as any[]
  const writers = work.writers.map(w => {
    const p = parties.find(x => norm(x.legal_name) === norm(w.legalName)), me = id && id.legal_name && norm(id.legal_name) === norm(w.legalName)
    return { ...w, ipi: w.ipi ?? p?.ipi ?? (me ? id.ipi : undefined) ?? undefined, pro: w.pro ?? p?.pro ?? (me ? id.pro : undefined) ?? undefined, publisherName: w.publisherName ?? p?.publisher_name ?? undefined, publisherIpi: w.publisherIpi ?? p?.publisher_ipi ?? undefined }
  })
  return { ...work, writers: writers.map(w => Object.fromEntries(Object.entries(w).filter(([, v]) => v != null))) as Writer[] }
}
export async function prepareTrack(db: any, label: string, actor: number, trackId: string, opts: { verify?: boolean; fetcher?: Fetcher } = {}) {
  if (!await memberRole(db, label, actor)) throw new ServiceError('Label not found', 404)
  const t = await trackRow(db, label, trackId), id = await identity(db, label)
  const work = await enrichWriters(db, label, workOf(t), id)
  const form = ascapForm({ title: t.title, artistCredit: t.artist_credit, releaseDate: t.release_date, isrc: t.isrc, durationSec: t.duration_sec, intake: work, released: Boolean(t.release_date || t.isrc || t.link), featuredOnly: isFeaturedOnly(t, id) })
  const metadata = opts.verify ? await checkMetadata({ title: t.title, artistCredit: t.artist_credit, isrc: work.isrc ?? t.isrc, durationSec: work.durationSec ?? t.duration_sec, releaseDate: work.releaseDate ?? t.release_date }, opts.fetcher) : null
  const before = [
    'Search ASCAP Member Access > Works (and ascap.com/repertory) for this title first. If it is already registered with you on it, report REGISTERED instead of registering again. If a co-writer registered it without you, do not re-register: draft a Work Record Update message for the owner to send.',
    ...(metadata?.conflicts.length ? [`Metadata conflicts to resolve with the owner first: ${metadata.conflicts.join(' ')}`] : [])
  ]
  return { song: { id: t.id, title: t.title, artist: t.artist_credit, isrc: t.isrc, releaseDate: t.release_date, durationSec: t.duration_sec, link: t.link, proStatus: t.pro_status, submittedAt: t.pro_submitted_at, ascapWorkId: t.pro_work_id }, before, ...form, metadata }
}
export async function saveTrackWork(db: any, label: string, actor: number, trackId: string, patch: any) {
  await requireEditor(db, label, actor)
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new ServiceError('work must be an object')
  for (const k of Object.keys(patch)) if (!WORK_KEYS.has(k)) throw new ServiceError(`Unknown song field: ${k}. Allowed: ${[...WORK_KEYS].join(', ')}`)
  let clean: Record<string, unknown>
  try { clean = intakePatch(patch) } catch (e) { throw new ServiceError((e as Error).message) }
  const t = await trackRow(db, label, trackId)
  const next = applyPatch(workOf(t), clean)
  await db.batch([
    db.prepare('UPDATE lw_catalog_tracks SET work_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(JSON.stringify(next), trackId),
    db.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, actor, 'catalog.work.saved', JSON.stringify({ trackId, fields: Object.keys(clean) }))
  ])
  return prepareTrack(db, label, actor, trackId)
}
/** SUBMITTED = the owner pressed Submit (agent saw the confirmation). REGISTERED = the work shows in ASCAP Works with evidence. */
export async function reportTrack(db: any, label: string, actor: number, trackId: string, b: any) {
  await requireEditor(db, label, actor)
  const t = await trackRow(db, label, trackId)
  const outcome = String(b?.outcome ?? ''), evidence = typeof b?.evidence === 'string' ? b.evidence.trim().slice(0, 1000) : ''
  const workId = b?.workId == null || b.workId === '' ? null : String(b.workId).replace(/[^\w-]/g, '').slice(0, 40) || null
  if (!['SUBMITTED', 'REGISTERED', 'ALREADY_REGISTERED', 'NOT_MINE'].includes(outcome)) throw new ServiceError('outcome must be SUBMITTED, REGISTERED, ALREADY_REGISTERED or NOT_MINE')
  if (outcome !== 'NOT_MINE' && !evidence) throw new ServiceError('Say what you saw on ASCAP (confirmation text, work ID, or the Works list entry).')
  if (outcome === 'SUBMITTED' && t.pro_status === 'REGISTERED') throw new ServiceError('Already registered', 409)
  const status = outcome === 'SUBMITTED' ? t.pro_status === 'UNKNOWN' ? 'NOT_REGISTERED' : t.pro_status : outcome === 'NOT_MINE' ? 'NOT_MINE' : 'REGISTERED'
  const note = `${new Date().toISOString().slice(0, 10)} ASCAP ${outcome.toLowerCase().replace('_', ' ')}${workId ? ` (work ${workId})` : ''}: ${evidence}`.slice(0, 1000)
  await db.batch([
    db.prepare(`UPDATE lw_catalog_tracks SET pro_status=?,pro_work_id=COALESCE(?,pro_work_id),pro_submitted_at=CASE WHEN ?='SUBMITTED' THEN CURRENT_TIMESTAMP ELSE pro_submitted_at END,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(status, workId, outcome, note, trackId),
    db.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, actor, 'catalog.ascap.reported', JSON.stringify({ trackId, outcome, workId, evidence }))
  ])
  return { trackId, outcome, proStatus: status }
}
/** Songs to register next: not registered first, then unchecked. Shows which are ready to fill right now. */
export async function registrationQueue(db: any, label: string, actor: number, limit = 25) {
  if (!await memberRole(db, label, actor)) throw new ServiceError('Label not found', 404)
  const rows = (await db.prepare(`SELECT id FROM lw_catalog_tracks WHERE label_id=? AND confirmed=1 AND pro_status IN ('NOT_REGISTERED','UNKNOWN')
    ORDER BY pro_status='NOT_REGISTERED' DESC, pro_submitted_at IS NOT NULL, release_date DESC LIMIT ?`).bind(label, Math.min(limit, 60)).all()).results as any[]
  const out = []
  for (const r of rows) { const p = await prepareTrack(db, label, actor, r.id); out.push({ trackId: r.id, title: p.song.title, artist: p.song.artist, proStatus: p.song.proStatus, submittedAt: p.song.submittedAt, status: p.status, needs: p.asks.map(a => a.note), stops: p.stops.map(s => s.note) }) }
  const sum: any = await db.prepare(`SELECT COUNT(*) AS songs, SUM(pro_status='REGISTERED') AS registered FROM lw_catalog_tracks WHERE label_id=? AND confirmed=1 AND pro_status<>'NOT_MINE'`).bind(label).first()
  return { progress: `${sum?.registered ?? 0} of ${sum?.songs ?? 0} registered`, ready: out.filter(x => x.status === 'READY' && !x.submittedAt).length, songs: out }
}
/** Engine: ready songs become screen tasks; submitted songs get a check-back. Owner still presses Submit. */
export async function queueRegistrations(db: any, enqueue: (t: any) => Promise<boolean>, labelIds?: string[]) {
  const labels = (await db.prepare(`SELECT label_id FROM lw_label_identity WHERE pro='ASCAP' AND (? IS NULL OR label_id IN (SELECT value FROM json_each(?)))`).bind(labelIds ? 1 : null, JSON.stringify(labelIds ?? [])).all()).results as any[]
  let n = 0
  for (const { label_id } of labels) {
    const tracks = (await db.prepare(`SELECT * FROM lw_catalog_tracks WHERE label_id=? AND confirmed=1 AND pro_status IN ('NOT_REGISTERED','UNKNOWN') AND work_json<>'{}' LIMIT 40`).bind(label_id).all()).results as any[]
    const id = await identity(db, label_id)
    for (const t of tracks) {
      const work = await enrichWriters(db, label_id, workOf(t), id)
      if (t.pro_submitted_at) {
        const ageDays = (Date.now() - Date.parse(t.pro_submitted_at.replace(' ', 'T') + 'Z')) / 86400000
        if (ageDays >= 10 && await enqueue({ label: label_id, kind: 'REGISTER_WORK', role: 'publishing_administrator', capability: 'SCREEN_CONTROL', title: `Check ASCAP shows "${t.title}" as registered`, input: { trackId: t.id, mode: 'VERIFY' }, dedupe: `ascap-verify:${t.id}:${new Date().toISOString().slice(0, 7)}` })) n++
        continue
      }
      const form = ascapForm({ title: t.title, artistCredit: t.artist_credit, releaseDate: t.release_date, isrc: t.isrc, durationSec: t.duration_sec, intake: work, released: true })
      if (form.status !== 'READY') continue
      const sig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(form.items.filter(x => x.action === 'FILL')))).then(b => [...new Uint8Array(b)].slice(0, 6).map(x => x.toString(16).padStart(2, '0')).join(''))
      if (await enqueue({ label: label_id, kind: 'REGISTER_WORK', role: 'publishing_administrator', capability: 'SCREEN_CONTROL', title: `Register "${t.title}" at ASCAP (you press Submit)`, input: { trackId: t.id, mode: 'FILL' }, dedupe: `ascap:${t.id}:${sig}` })) n++
    }
  }
  return n
}
