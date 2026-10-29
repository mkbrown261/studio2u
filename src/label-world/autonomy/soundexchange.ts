// SoundExchange, done the way SoundExchange documents it (official pages checked 2026-10-29):
//  - soundexchange.com/digital-performance-royalties: 45% to featured artists, 50% to the
//    sound recording copyright owner (SRCO), 5% to a fund for non-featured musicians/vocalists.
//  - "Mastering My Catalog: A Guide to Submit Recordings": My Catalog > Submit Recordings,
//    pick the SRCO entity, then 1) ISRC Recording Information (Artist, Song Title, ISRC: 12
//    characters, no dashes), 2) Recording Claim Information (Basis of Claim: Copyright Owner or
//    Authorized Collection Designee; Percentage Claimed; Rights Begin / Inception; Rights End /
//    Perpetuity), 3) Releases (Artist, Album Title, UPC/EAN, Release Label; self-released = SRCO
//    entity name). Go to top and Review; red "invalid" markers must be fixed; Submit Recordings.
//    Appears in Associated Recordings or Search & Claim a day or two later. Bulk: ISRC Ingest Form.
//  - "Letters of Direction - Signature Requirements": a Featured Artist directs part of their
//    performance royalties to a producer/mixer/engineer. Signed by EACH performer on the
//    featured artist (or their authorized LOD Signatory). E-signatures need the signature
//    service's Certificate of Completion with the signer's name and unredacted email.
//  - Contact Information Update Form (12-02-2022): account name, payee ID, last 4 of tax ID,
//    address; new name/address/phone/email; a name change needs a W-9 (US) or W-8 uploaded in
//    SXDirect > Contact > Upload a Document; a new representative needs an Account
//    Authorization Form signed by the performer. Online alternative: sxdirect.soundexchange.com.
// Never stored here: passwords, tax IDs, bank details. The owner logs in, signs and submits.
import { ServiceError, memberRole, requireEditor } from './service'
import { trackRow, workOf, type Item } from './ascap'
import { intakePatch, applyPatch, type Intake } from './intake'

export const SX_FACTS_VERSION = '2026-10-29'
export const SX = {
  login: 'https://sxdirect.soundexchange.com', register: 'https://register.soundexchange.com', phone: '1-800-961-2091',
  lods: 'https://www.soundexchange.com/what-we-do/for-artists-labels-and-producers/letters-of-direction/',
  submitGuide: 'https://www.soundexchange.com/2019/11/04/mastering-my-catalog-a-guide-to-submit-recordings/',
  lodSignatures: 'https://www.soundexchange.com/2025/09/30/letters-of-direction-signature-requirements/'
}
const STATUSES = ['UNKNOWN', 'NOT_REGISTERED', 'LOCKED_OUT', 'ACTIVE'] as const
const ROLES = ['FEATURED_ARTIST', 'SRCO'] as const
const SECRET = /(tax|ssn|ein|itin|bank|routing|iban|swift|password|passcode|pin\b|account.?number|social)/i
const EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,180}\.[a-z]{2,24}$/i
const str = (v: unknown, f: string, max: number) => { if (v == null || v === '') return null; if (typeof v !== 'string' || v.length > max || /[\x00-\x1f]/.test(v)) throw new ServiceError(`Invalid ${f}`); return v.trim() || null }

// ---------------- account (status + roles; no secrets) ----------------
export type SxAccount = { status: typeof STATUSES[number]; registeredAs: string[]; srcoEntity: string | null; accountName: string | null; payeeId: string | null; loginEmail: string | null; signedToLabel: boolean | null; notes: string | null }
const readSx = (row: any): SxAccount => { let j: any = {}; try { j = JSON.parse(row?.sx_json || '{}') } catch { /* empty */ } return { status: j.status ?? 'UNKNOWN', registeredAs: j.registeredAs ?? [], srcoEntity: j.srcoEntity ?? null, accountName: j.accountName ?? null, payeeId: j.payeeId ?? null, loginEmail: j.loginEmail ?? null, signedToLabel: j.signedToLabel ?? null, notes: j.notes ?? null } }
export async function getSxAccount(db: any, label: string, actor: number) {
  if (!await memberRole(db, label, actor)) throw new ServiceError('Label not found', 404)
  const row: any = await db.prepare('SELECT artist_name,legal_name,aliases_json,sx_json FROM lw_label_identity WHERE label_id=?').bind(label).first()
  const acct = readSx(row)
  return { account: acct, checklist: accountChecklist(acct, row ? { artistName: row.artist_name, legalName: row.legal_name, aliases: JSON.parse(row.aliases_json || '[]') } : null) }
}
export async function saveSxAccount(db: any, label: string, actor: number, b: any) {
  await requireEditor(db, label, actor)
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new ServiceError('account must be an object')
  for (const k of Object.keys(b)) if (SECRET.test(k) && k !== 'payeeId') throw new ServiceError('Never save passwords, tax IDs or bank details. You enter those yourself on SoundExchange.')
  for (const v of Object.values(b)) if (typeof v === 'string' && /\b\d{3}-?\d{2}-?\d{4}\b/.test(v)) throw new ServiceError('That looks like a Social Security number. Never save it here.')
  const row: any = await db.prepare('SELECT sx_json FROM lw_label_identity WHERE label_id=?').bind(label).first()
  if (!row) throw new ServiceError('Save your artist identity (Who I am) first', 409)
  const cur = readSx(row), next: any = { ...cur }
  if (b.status != null) { if (!STATUSES.includes(b.status)) throw new ServiceError(`status must be one of ${STATUSES.join(', ')}`); next.status = b.status }
  if (b.registeredAs != null) { if (!Array.isArray(b.registeredAs) || b.registeredAs.some((r: any) => !ROLES.includes(r))) throw new ServiceError('registeredAs must list FEATURED_ARTIST and/or SRCO'); next.registeredAs = [...new Set(b.registeredAs)] }
  if (b.srcoEntity !== undefined) next.srcoEntity = str(b.srcoEntity, 'srcoEntity', 160)
  if (b.accountName !== undefined) next.accountName = str(b.accountName, 'accountName', 160)
  if (b.payeeId !== undefined) { const p = str(b.payeeId, 'payeeId', 30); if (p && !/^[A-Za-z0-9-]{3,30}$/.test(p)) throw new ServiceError('payeeId looks wrong'); next.payeeId = p }
  if (b.loginEmail !== undefined) { const e = str(b.loginEmail, 'loginEmail', 254)?.toLowerCase() ?? null; if (e && !EMAIL.test(e)) throw new ServiceError('loginEmail looks wrong'); next.loginEmail = e }
  if (b.signedToLabel !== undefined) next.signedToLabel = b.signedToLabel == null ? null : Boolean(b.signedToLabel)
  if (b.notes !== undefined) next.notes = str(b.notes, 'notes', 1000)
  await db.batch([
    db.prepare('UPDATE lw_label_identity SET sx_json=?,updated_at=CURRENT_TIMESTAMP WHERE label_id=?').bind(JSON.stringify(next), label),
    db.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, actor, 'soundexchange.account.saved', JSON.stringify({ fields: Object.keys(b) }))
  ])
  return getSxAccount(db, label, actor)
}

/** Which roles to hold: self-released (you own masters) = Featured Artist AND Rights Owner (SRCO). */
export function roleAdvice(ownsMasters: boolean | null, signedToLabel: boolean | null) {
  if (ownsMasters) return { roles: ['FEATURED_ARTIST', 'SRCO'], why: 'You own your masters, so you collect both shares: 45% as featured artist and 50% as the rights owner (SRCO). With only the artist role, the owner half is not paid to you.' }
  if (signedToLabel || ownsMasters === false) return { roles: ['FEATURED_ARTIST'], why: 'Your label owns the masters and claims the 50% owner share. You collect the 45% featured artist share.' }
  return { roles: null, why: 'Do you own your masters (self-released through UnitedMasters, DistroKid etc.), or does a label own them?' }
}

export function accountChecklist(a: SxAccount, me: { artistName: string; legalName: string | null; aliases: string[] } | null) {
  const items: Item[] = [], S = 'Account'
  const add = (label: string, value: string | null, action: Item['action'], note?: string) => items.push({ section: S, label, value, action, ...(note ? { note } : {}) })
  if (a.status === 'LOCKED_OUT') add('Reset your password', SX.login, 'HUMAN', `Open ${SX.login}, click "Forgot password" and enter ${a.loginEmail ?? 'the email you signed up with'}. Reset it from that email yourself. If you no longer have that email, call SoundExchange at ${SX.phone} (9am-6pm ET, Mon-Fri). Your agent can open the page; it never sees or types your password.`)
  else if (a.status === 'NOT_REGISTERED') add('Register (free)', SX.register, 'HUMAN', 'You enter your legal name, artist name, contact info, tax form (W-9 in the US) and direct deposit yourself.')
  else if (a.status === 'UNKNOWN') add('Account', null, 'ASK', 'Do you already have a SoundExchange account? If yes, can you log in, or did you forget the password?')
  const ownsMasters = a.registeredAs.includes('SRCO') || Boolean(a.srcoEntity)
  const advice = roleAdvice(a.registeredAs.length || a.srcoEntity ? ownsMasters : null, a.signedToLabel)
  if (!advice.roles) add('Roles', null, 'ASK', advice.why)
  else {
    const missing = advice.roles.filter(r => !a.registeredAs.includes(r))
    if (missing.length && a.status === 'ACTIVE') add('Roles', missing.join(' + '), 'STOP', `Add ${missing.map(r => r === 'SRCO' ? 'the Rights Owner (SRCO)' : 'the Featured Artist').join(' and ')} role. ${advice.why}`)
    else add('Roles', advice.roles.map(r => r === 'SRCO' ? 'Rights Owner (SRCO)' : 'Featured Artist').join(' + '), 'FILL', advice.why)
  }
  if (me) add('Names on the account', [me.artistName, ...me.aliases].join(', '), 'FILL', 'List every name you released under (old spellings too) so plays under any of them reach you.')
  add('Tax form and direct deposit', null, 'HUMAN', 'Done by you inside SXDirect. Never by email, never through your agent.')
  return { status: items.some(i => i.action === 'STOP') ? 'FIX' : items.some(i => i.action === 'ASK') ? 'NEEDS_INFO' : a.status === 'ACTIVE' ? 'READY' : 'WAITING_ON_YOU', items }
}

// ---------------- one recording: claim as artist + (if you own it) Submit Recordings ----------------
export type SxInput = { title: string; artistCredit: string | null; isrc: string | null; releaseDate: string | null; work: Intake; account: SxAccount }
export function sxRecordingForm(w: SxInput) {
  const i = w.work, a = w.account, items: Item[] = []
  const add = (section: string, label: string, value: string | null, action: Item['action'], note?: string, key?: string) => items.push({ section, label, value, action, ...(note ? { note } : {}), ...(key ? { key } : {}) })
  const isrc = i.isrc ?? w.isrc ?? null
  const owns = Boolean(i.masterOwner) || a.registeredAs.includes('SRCO')
  const artists = [w.artistCredit, ...(i.featuredArtists ?? [])].filter(Boolean) as string[]

  if (a.status !== 'ACTIVE') add('Before you start', 'Account', null, 'STOP', a.status === 'LOCKED_OUT' ? 'Reset your SoundExchange password first (Forgot password on sxdirect.soundexchange.com).' : 'Log in to SoundExchange first (or register, free).', 'account')
  if (!isrc) add('ISRC', null, 'ASK', `What is the ISRC for "${w.title}"? It is mandatory at SoundExchange. Your distributor shows it on the release page (12 characters, like QZ85M1979735).`, 'isrc')

  // A) Search & Claim (artist share)
  const A = 'A. My Catalog > Search & Claim (your 45% artist share)'
  add(A, 'Search', isrc ?? `${w.title} ${w.artistCredit ?? ''}`.trim(), isrc ? 'FILL' : 'SKIP', 'Search by ISRC first; title + artist if the ISRC finds nothing.')
  add(A, 'Claim as an artist', null, 'FILL', 'If it is listed: click "Claim as an artist" and confirm the performer share. If it already shows under your account, report ALREADY_CLAIMED.')

  // B) Submit Recordings (owner share), only if you own the master
  const B1 = 'B1. Submit Recordings · ISRC Recording Information', B2 = 'B2. Recording Claim Information', B3 = 'B3. Releases'
  if (!owns) add('B. Submit Recordings (owner share)', 'Whole section', null, 'SKIP', a.signedToLabel ? 'Your label owns the master, so the label submits it. You only claim as artist (A).' : 'Only the master owner submits recordings. If you own your masters, add the Rights Owner role and tell me the owner name (you or your company).')
  else {
    const m = i.masterOwner, entity = m?.entityName ?? a.srcoEntity
    add(B1, 'SRCO entity', entity, entity ? 'FILL' : 'ASK', entity ? 'Pick this entity at the top of Submit Recordings.' : 'Who owns the master: you personally, or your company (exact name)?', 'masterOwner')
    add(B1, 'Artist', artists.join(', ') || null, artists.length ? 'FILL' : 'ASK', 'List all featured artists.', 'featuredArtists')
    add(B1, 'Song Title', i.recordingTitle ?? w.title, 'FILL')
    add(B1, 'ISRC', isrc, isrc ? 'FILL' : 'ASK', '12 characters, no dashes.', 'isrc')
    add(B2, 'Basis of Claim', m?.basis === 'AUTHORIZED_DESIGNEE' ? 'Authorized Collection Designee' : 'Copyright Owner', 'FILL', 'Copyright Owner = you own the master. Authorized Collection Designee = you collect for the owner.')
    add(B2, 'Percentage Claimed', String(m?.percent ?? 100), m ? 'FILL' : 'ASK', 'Your share of master OWNERSHIP (not the song split). 100 if you own it all.', 'masterOwner')
    add(B2, 'Rights Begin', !m || m.rightsBegin === 'INCEPTION' ? 'Inception' : m.rightsBegin, 'FILL', 'Inception = from first release.')
    add(B2, 'Rights End', !m || m.rightsEnd === 'PERPETUITY' ? 'Perpetuity' : m.rightsEnd, 'FILL')
    add(B3, 'Artist', w.artistCredit, w.artistCredit ? 'FILL' : 'ASK', 'Release artist ("Various Artists" for compilations).')
    add(B3, 'Album Title', i.albumTitle ?? w.title, 'FILL', i.albumTitle ? undefined : 'Single title if it came out as a single. Add every release it appeared on (single, album, deluxe).')
    add(B3, 'UPC/EAN', i.upc ?? null, i.upc ? 'FILL' : 'ASK', `What is the UPC for the release "${i.albumTitle ?? w.title}"? Your distributor shows it next to the ISRC.`, 'upc')
    add(B3, 'Release Label', i.recordLabel ?? entity ?? null, (i.recordLabel ?? entity) ? 'FILL' : 'ASK', 'Self-released = your SRCO entity name.', 'recordLabel')
    add('B4. Review', 'Go to top and Review', null, 'FILL', 'Fix any red "invalid" markers before continuing.')
    add('B5. Submit', 'Press Submit Recordings', null, 'HUMAN', 'Only you press it. It shows up to claim a day or two later; then do A.')
  }
  const asks = items.filter(x => x.action === 'ASK'), stops = items.filter(x => x.action === 'STOP')
  return {
    factsVersion: SX_FACTS_VERSION, url: SX.login, ownsMaster: owns,
    status: stops.length ? 'BLOCKED' : asks.length ? 'NEEDS_INFO' : 'READY' as 'BLOCKED' | 'NEEDS_INFO' | 'READY',
    items, asks, stops,
    say: stops.length ? stops.map(s => s.note).join(' ') : asks.length ? `For "${w.title}" at SoundExchange I need: ${[...new Set(asks.map(x => x.note))].join(' ')}` : `"${w.title}" is ready: I'll ${owns ? 'submit it as the owner, then ' : ''}claim it as the artist. You press Submit.`
  }
}
async function accountRow(db: any, label: string) { const r: any = await db.prepare('SELECT sx_json FROM lw_label_identity WHERE label_id=?').bind(label).first(); return readSx(r) }
export async function prepareSx(db: any, label: string, actor: number, trackId: string) {
  if (!await memberRole(db, label, actor)) throw new ServiceError('Label not found', 404)
  const t = await trackRow(db, label, trackId), acct = await accountRow(db, label)
  const form = sxRecordingForm({ title: t.title, artistCredit: t.artist_credit, isrc: t.isrc, releaseDate: t.release_date, work: workOf(t), account: acct })
  return { song: { id: t.id, title: t.title, artist: t.artist_credit, isrc: t.isrc, sxStatus: t.sx_status, submittedAt: t.sx_submitted_at, ref: t.sx_ref }, ...form }
}
export async function saveSxWork(db: any, label: string, actor: number, trackId: string, patch: any) {
  await requireEditor(db, label, actor)
  const allowed = ['masterOwner', 'upc', 'featuredArtists', 'recordLabel', 'albumTitle', 'isrc', 'recordingTitle']
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new ServiceError('work must be an object')
  for (const k of Object.keys(patch)) if (!allowed.includes(k)) throw new ServiceError(`Unknown field ${k}. Allowed: ${allowed.join(', ')}`)
  let clean: Record<string, unknown>; try { clean = intakePatch(patch) } catch (e) { throw new ServiceError((e as Error).message) }
  const t = await trackRow(db, label, trackId)
  await db.prepare('UPDATE lw_catalog_tracks SET work_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(JSON.stringify(applyPatch(workOf(t), clean)), trackId).run()
  return prepareSx(db, label, actor, trackId)
}
/** SUBMITTED = owner pressed Submit Recordings. CLAIMED = seen under Associated Recordings / claimed as artist. */
export async function reportSx(db: any, label: string, actor: number, trackId: string, b: any) {
  await requireEditor(db, label, actor)
  const t = await trackRow(db, label, trackId)
  const outcome = String(b?.outcome ?? ''), evidence = typeof b?.evidence === 'string' ? b.evidence.trim().slice(0, 1000) : ''
  if (!['SUBMITTED', 'CLAIMED', 'ALREADY_CLAIMED', 'NOT_MINE'].includes(outcome)) throw new ServiceError('outcome must be SUBMITTED, CLAIMED, ALREADY_CLAIMED or NOT_MINE')
  if (outcome !== 'NOT_MINE' && !evidence) throw new ServiceError('Say what you saw on SoundExchange (confirmation, Upload History row, or the Associated Recordings entry).')
  const ref = b?.ref ? String(b.ref).replace(/[^\w-]/g, '').slice(0, 40) || null : null
  const status = outcome === 'NOT_MINE' ? 'NOT_MINE' : outcome === 'SUBMITTED' ? (t.sx_status === 'CLAIMED' ? 'CLAIMED' : 'NOT_CLAIMED') : 'CLAIMED'
  await db.batch([
    db.prepare(`UPDATE lw_catalog_tracks SET sx_status=?,sx_ref=COALESCE(?,sx_ref),sx_submitted_at=CASE WHEN ?='SUBMITTED' THEN CURRENT_TIMESTAMP ELSE sx_submitted_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(status, ref, outcome, trackId),
    db.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, actor, 'catalog.soundexchange.reported', JSON.stringify({ trackId, outcome, ref, evidence }))
  ])
  return { trackId, outcome, sxStatus: status, next: outcome === 'SUBMITTED' ? 'Check My Catalog in 1-2 days, then Claim as an artist.' : null }
}
export async function sxQueue(db: any, label: string, actor: number, limit = 25) {
  if (!await memberRole(db, label, actor)) throw new ServiceError('Label not found', 404)
  const acct = await accountRow(db, label)
  const rows = (await db.prepare(`SELECT * FROM lw_catalog_tracks WHERE label_id=? AND confirmed=1 AND sx_status IN ('UNKNOWN','NOT_CLAIMED') ORDER BY sx_status='NOT_CLAIMED' DESC, release_date DESC LIMIT ?`).bind(label, Math.min(limit, 60)).all()).results as any[]
  const songs = rows.map(t => { const f = sxRecordingForm({ title: t.title, artistCredit: t.artist_credit, isrc: t.isrc, releaseDate: t.release_date, work: workOf(t), account: acct }); return { trackId: t.id, title: t.title, isrc: t.isrc, submittedAt: t.sx_submitted_at, status: f.status, needs: f.asks.map(x => x.note) } })
  const sum: any = await db.prepare(`SELECT COUNT(*) AS songs, SUM(sx_status='CLAIMED') AS claimed FROM lw_catalog_tracks WHERE label_id=? AND confirmed=1 AND sx_status<>'NOT_MINE'`).bind(label).first()
  return { account: acct.status, progress: `${sum?.claimed ?? 0} of ${sum?.songs ?? 0} claimed at SoundExchange`, ready: songs.filter(s => s.status === 'READY' && !s.submittedAt).length, songs }
}
/** Engine: only when the owner can log in. Ready songs -> one screen task each; submitted songs -> check after 2 days. */
export async function queueSx(db: any, enqueue: (t: any) => Promise<boolean>, labelIds?: string[]) {
  const labels = (await db.prepare(`SELECT label_id,sx_json FROM lw_label_identity WHERE json_extract(sx_json,'$.status')='ACTIVE' AND (? IS NULL OR label_id IN (SELECT value FROM json_each(?)))`).bind(labelIds ? 1 : null, JSON.stringify(labelIds ?? [])).all()).results as any[]
  let n = 0
  for (const l of labels) {
    const acct = readSx(l)
    const tracks = (await db.prepare(`SELECT * FROM lw_catalog_tracks WHERE label_id=? AND confirmed=1 AND sx_status IN ('UNKNOWN','NOT_CLAIMED') LIMIT 40`).bind(l.label_id).all()).results as any[]
    for (const t of tracks) {
      if (t.sx_submitted_at) {
        const age = (Date.now() - Date.parse(String(t.sx_submitted_at).replace(' ', 'T') + 'Z')) / 86400000
        if (age >= 2 && await enqueue({ label: l.label_id, kind: 'SX_RECORDING', role: 'royalty_admin', capability: 'SCREEN_CONTROL', title: `Claim "${t.title}" as artist at SoundExchange`, input: { trackId: t.id, mode: 'CLAIM' }, dedupe: `sx-claim:${t.id}:${new Date().toISOString().slice(0, 7)}` })) n++
        continue
      }
      const f = sxRecordingForm({ title: t.title, artistCredit: t.artist_credit, isrc: t.isrc, releaseDate: t.release_date, work: workOf(t), account: acct })
      if (f.status === 'READY' && await enqueue({ label: l.label_id, kind: 'SX_RECORDING', role: 'royalty_admin', capability: 'SCREEN_CONTROL', title: `SoundExchange: ${f.ownsMaster ? 'submit + ' : ''}claim "${t.title}" (you press Submit)`, input: { trackId: t.id, mode: 'FILL' }, dedupe: `sx:${t.id}:${t.isrc ?? ''}` })) n++
    }
  }
  return n
}
/** 10+ songs: rows to copy into SoundExchange's ISRC Ingest Form (download it at My Catalog > Submit Recordings). */
export async function sxBulkRows(db: any, label: string, actor: number) {
  const q = await sxQueue(db, label, actor, 60), acct = await accountRow(db, label)
  const rows: any[] = []
  for (const s of q.songs.filter(x => x.status === 'READY')) {
    const t = await trackRow(db, label, s.trackId), i = workOf(t), m = i.masterOwner
    if (!m && !acct.registeredAs.includes('SRCO')) continue
    rows.push({ artist: [t.artist_credit, ...(i.featuredArtists ?? [])].join(', '), songTitle: i.recordingTitle ?? t.title, isrc: i.isrc ?? t.isrc, basisOfClaim: m?.basis === 'AUTHORIZED_DESIGNEE' ? 'Authorized Collection Designee' : 'Copyright Owner', percentageClaimed: m?.percent ?? 100, rightsBegin: !m || m.rightsBegin === 'INCEPTION' ? 'Inception' : m.rightsBegin, rightsEnd: !m || m.rightsEnd === 'PERPETUITY' ? 'Perpetuity' : m.rightsEnd, releaseArtist: t.artist_credit, albumTitle: i.albumTitle ?? t.title, upc: i.upc, releaseLabel: i.recordLabel ?? m?.entityName ?? acct.srcoEntity })
  }
  return { rows, note: 'Copy into the ISRC Ingest Form from My Catalog > Submit Recordings. Its column names may differ; match by meaning. Only songs you own the master for.' }
}

// ---------------- Contact Information Update Form ----------------
export function contactUpdateForm(b: any, acct: SxAccount, me: { legalName: string | null } | null) {
  const items: Item[] = []
  const add = (section: string, label: string, value: string | null, action: Item['action'], note?: string) => items.push({ section, label, value, action, ...(note ? { note } : {}) })
  const ch = b?.changes ?? {}, filler = b?.filler ?? {}
  const v = (x: unknown, f: string, max = 200) => str(x, f, max)
  const S1 = "Who's filling out this form?", S2 = 'Existing Account Detail Verification', S3 = 'New Payment Contact Information', S4 = 'Tax Information', S5 = 'Signature'
  const fName = v(filler.name, 'filler.name') ?? me?.legalName ?? null
  add(S1, 'Name', fName, fName ? 'FILL' : 'ASK', fName ? undefined : 'Your name.')
  add(S1, 'Phone', v(filler.phone, 'filler.phone', 40), v(filler.phone, 'filler.phone', 40) ? 'FILL' : 'ASK', 'Best phone for SoundExchange to reach you.')
  add(S1, 'Email', v(filler.email, 'filler.email', 254) ?? acct.loginEmail, (v(filler.email, 'filler.email', 254) ?? acct.loginEmail) ? 'FILL' : 'ASK')
  add(S2, '*SoundExchange Account Name', acct.accountName, acct.accountName ? 'FILL' : 'ASK', 'Exactly as payments are made out today (check an old payment or SXDirect).')
  add(S2, 'SoundExchange Payee ID', acct.payeeId, acct.payeeId ? 'FILL' : 'SKIP', 'Optional if unknown.')
  add(S2, '*Last 4 Digits of Tax ID Number', null, 'HUMAN', 'You write this yourself. Your agent never sees or stores tax IDs.')
  const curAddr = v(b?.currentAddress, 'currentAddress', 300)
  add(S2, '*Address (as on the account now)', curAddr, curAddr ? 'FILL' : 'ASK', 'The address SoundExchange has on file now (include any attn, c/o or dba).')
  const na = (x: unknown, f: string, max = 200) => v(x, f, max) ?? 'N/A'
  add(S3, 'New SoundExchange Account Name', na(ch.accountName, 'changes.accountName', 160), 'FILL', 'N/A if the name stays the same.')
  add(S3, 'Address', na(ch.address, 'changes.address', 300), 'FILL')
  add(S3, 'Phone', na(ch.phone, 'changes.phone', 40), 'FILL')
  add(S3, 'Email', na(ch.email, 'changes.email', 254), 'FILL')
  const nameChange = Boolean(v(ch.accountName, 'changes.accountName', 160))
  if (nameChange) add(S4, 'W-9 (US) or W-8BEN / W-8BEN-E', null, 'HUMAN', 'Required because the account name changes. Download from irs.gov and upload it yourself in SXDirect > Contact > Topic: Upload a Document > Document Type: W9 or W8 Form. Never email tax forms.')
  else add(S4, 'Tax form', null, 'SKIP', 'Not needed: the account name is not changing.')
  if (b?.newRepresentative) add(S3, 'Account Authorization Form – Primary Contact', null, 'HUMAN', 'Needed because a new representative is being added. The performer signs it.')
  add(S5, '*Name of Person Signing', fName, fName ? 'FILL' : 'ASK')
  add(S5, '*Signature', null, 'HUMAN', 'You sign.')
  add(S5, '*Date', null, 'HUMAN', 'Date you sign.')
  const asks = items.filter(x => x.action === 'ASK')
  return {
    items, asks, needsTaxForm: nameChange, needsAuthorizationForm: Boolean(b?.newRepresentative),
    status: asks.length ? 'NEEDS_INFO' : 'READY',
    routes: [
      { route: 'ONLINE', how: `Best: log in to ${SX.login} and update the contact info there (no tax digits in email). Agent fills, you submit.` },
      { route: 'EMAIL', how: 'If SoundExchange asked for this form back: the agent fills a copy on your computer, you add the last 4 tax digits and sign, then the agent replies in the same SoundExchange thread with it attached after you approve.' }
    ]
  }
}
export async function prepareContactUpdate(db: any, label: string, actor: number, b: any) {
  if (!await memberRole(db, label, actor)) throw new ServiceError('Label not found', 404)
  const row: any = await db.prepare('SELECT legal_name,sx_json FROM lw_label_identity WHERE label_id=?').bind(label).first()
  return contactUpdateForm(b, readSx(row), row ? { legalName: row.legal_name } : null)
}

// ---------------- Letter of Direction (pay a producer/mixer/engineer from your artist share) ----------------
export function lodPrep(b: any) {
  const performers = Array.isArray(b?.performers) ? b.performers.map((p: any, i: number) => str(p, `performers[${i}]`, 120)).filter(Boolean) : []
  if (!performers.length) throw new ServiceError('List every performer on the featured artist (each one signs)')
  const participant = b?.participant ?? {}
  const pname = str(participant.name, 'participant.name', 120); if (!pname) throw new ServiceError('participant.name required')
  const role = String(participant.role ?? 'producer').toLowerCase()
  if (!['producer', 'mixer', 'engineer', 'other'].includes(role)) throw new ServiceError('participant.role must be producer, mixer, engineer or other')
  const pct = Number(b?.percent)
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) throw new ServiceError('percent must be more than 0 and at most 100 (of your featured artist share)')
  const tracks = Array.isArray(b?.tracks) ? b.tracks.slice(0, 200) : []
  if (!tracks.length) throw new ServiceError('List the recordings (title + ISRC) for the repertoire chart')
  const chart = tracks.map((t: any, i: number) => { const title = str(t?.title, `tracks[${i}].title`, 200); if (!title) throw new ServiceError(`tracks[${i}].title required`); const isrc = t?.isrc ? String(t.isrc).replace(/[-\s]/g, '').toUpperCase() : null; if (isrc && !/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc)) throw new ServiceError(`tracks[${i}].isrc invalid`); return { featuredArtist: str(b?.featuredArtist, 'featuredArtist', 160) ?? performers.join(' & '), title, isrc, percent: pct } })
  const featuring = Boolean(b?.otherFeaturedArtists?.length)
  return {
    form: { performers, featuredArtist: chart[0].featuredArtist, participant: { name: pname, role, email: str(participant.email, 'participant.email', 254) }, percentOfArtistShare: pct },
    repertoireChart: chart,
    requirements: [
      `Download the current LOD form and Repertoire Chart from ${SX.lods}.`,
      'Every performer on the featured artist signs (a group = each member who performed), or their authorized LOD Signatory on file with SoundExchange. Power of attorney alone is not accepted.',
      ...(featuring ? ['For "A featuring B" tracks, the participant gets B\'s share only if B (or B\'s LOD Signatory) signs too.'] : []),
      'Signatures: ink (scanned) matching the ID on file, or an e-signature service. E-signed LODs must include the Certificate of Completion showing the signer\'s name and unredacted email.',
      'Performers under 18: a parent/legal guardian signs.',
      'The percent comes out of your 45% featured artist share, not the owner share. Producer points in a split sheet are not automatically the LOD percent: confirm the number in the producer agreement.',
      `Questions: SoundExchange support via SXDirect or ${SX.phone}.`
    ],
    sources: [SX.lods, SX.lodSignatures]
  }
}
