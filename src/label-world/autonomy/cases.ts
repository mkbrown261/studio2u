// Money Found cases, artist identity and catalog import. Shared by the website
// routes and MCP tools so a case opened in chat, by Codex, or by Claude is the
// same record with the same rules.
import { ServiceError, memberRole, requireEditor } from './service'
import { PLAYBOOKS, STANDING_RULES, ascapClaimDeadline, playbookById, suggestPlaybooks } from './playbooks'
import { PROS, normalizeIpi } from './intake'

const day = 86400000
const iso = (ms = 0) => new Date(Date.now() + ms).toISOString()
const clean = (v: unknown, field: string, max = 200, required = true): string | null => {
  if (v == null || v === '') { if (required) throw new ServiceError(`${field} required`); return null }
  if (typeof v !== 'string' || v.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)) throw new ServiceError(`Invalid ${field}`)
  const s = v.trim(); if (!s && required) throw new ServiceError(`${field} required`); return s || null
}
const event = (db: any, label: string, caseId: string, actor: string, kind: string, body: string) =>
  db.prepare('INSERT INTO lw_case_events(label_id,case_id,actor,kind,body) VALUES (?,?,?,?,?)').bind(label, caseId, actor.slice(0, 100), kind, body.slice(0, 4000))
export const requireEditorFor = (db: any, label: string, user: number) => requireEditor(db, label, user)
async function requireMember(db: any, label: string, user: number) { if (!await memberRole(db, label, user)) throw new ServiceError('Label not found', 404) }

// ---------------- artist profile ----------------
export async function getProfile(db: any, label: string) {
  const r: any = await db.prepare('SELECT * FROM lw_label_identity WHERE label_id=?').bind(label).first()
  if (!r) return null
  return { artistName: r.artist_name, legalName: r.legal_name, spotifyArtistId: r.spotify_artist_id ?? null, appleArtistId: r.apple_artist_id ?? null, aliases: JSON.parse(r.aliases_json), pro: r.pro, ipi: r.ipi, firstUsedYear: r.first_used_year, socials: JSON.parse(r.socials_json), updatedAt: r.updated_at }
}
export async function saveProfile(db: any, label: string, actor: number, b: any) {
  await requireEditor(db, label, actor)
  const artist = clean(b?.artistName, 'artistName', 120)!, legal = clean(b?.legalName, 'legalName', 120, false)
  const aliases = Array.isArray(b?.aliases) ? b.aliases.slice(0, 20).map((a: unknown) => clean(a, 'alias', 120)).filter(Boolean) : []
  if (b?.pro != null && b.pro !== '' && !PROS.includes(b.pro)) throw new ServiceError(`pro must be one of ${PROS.join(', ')}`)
  let ipi: string | null = null; try { ipi = b?.ipi ? normalizeIpi(String(b.ipi)) : null } catch (e) { throw new ServiceError((e as Error).message) }
  const year = b?.firstUsedYear == null || b.firstUsedYear === '' ? null : Number(b.firstUsedYear)
  if (year !== null && (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear())) throw new ServiceError('firstUsedYear invalid')
  const socials: Record<string, string> = {}
  for (const k of ['instagram', 'tiktok', 'youtube', 'spotify', 'appleMusic', 'x']) { const v = clean(b?.socials?.[k], k, 300, false); if (v) socials[k] = v }
  const spotify = typeof b?.spotifyArtistUrl === 'string' ? (/(?:artist[/:])([A-Za-z0-9]{22})/.exec(b.spotifyArtistUrl)?.[1] ?? null) : null
  const apple = typeof b?.appleArtistUrl === 'string' ? (/(?:artist\/[^/]*\/|\bid=?)(\d{5,15})/.exec(b.appleArtistUrl)?.[1] ?? /(\d{6,15})(?:\?.*)?$/.exec(b.appleArtistUrl)?.[1] ?? null) : null
  if (b?.spotifyArtistUrl && !spotify) throw new ServiceError('That does not look like a Spotify artist link (open.spotify.com/artist/...).')
  if (b?.appleArtistUrl && !apple) throw new ServiceError('That does not look like an Apple Music artist link (music.apple.com/.../artist/...).')
  await db.prepare(`INSERT INTO lw_label_identity(label_id,artist_name,legal_name,aliases_json,pro,ipi,first_used_year,socials_json,updated_at) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(label_id) DO UPDATE SET artist_name=excluded.artist_name,legal_name=excluded.legal_name,aliases_json=excluded.aliases_json,pro=excluded.pro,ipi=excluded.ipi,first_used_year=excluded.first_used_year,socials_json=excluded.socials_json,updated_at=CURRENT_TIMESTAMP`)
    .bind(label, artist, legal, JSON.stringify(aliases), b?.pro || null, ipi, year, JSON.stringify(socials)).run()
  if (spotify || apple) await db.prepare('UPDATE lw_label_identity SET spotify_artist_id=COALESCE(?,spotify_artist_id),apple_artist_id=COALESCE(?,apple_artist_id) WHERE label_id=?').bind(spotify, apple, label).run()
  return getProfile(db, label)
}

// ---------------- catalog ("Is this you?") ----------------
type Candidate = { source: 'deezer' | 'itunes'; sourceId: string; title: string; artistCredit: string; album?: string; isrc?: string; releaseDate?: string; durationSec?: number; explicit?: boolean; link?: string; artwork?: string }
export type Fetcher = (url: string) => Promise<any>
const defaultFetch: Fetcher = async url => { const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Studio2U-LabelWorld/1.0' } }); if (!r.ok) throw new Error('lookup failed'); return r.json() }
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim()

/** Public catalog lookup (Deezer + Apple iTunes Search; no keys). Returns artists grouped with sample tracks. */
export async function searchCatalog(name: string, fetcher: Fetcher = defaultFetch) {
  const q = clean(name, 'name', 120)!, target = norm(q)
  const artists: any[] = []
  try {
    const d = await fetcher(`https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=6`)
    for (const a of d?.data ?? []) artists.push({ source: 'deezer', artistId: String(a.id), name: a.name, picture: a.picture_medium, albums: a.nb_album, fans: a.nb_fan, link: a.link, exact: norm(a.name) === target })
  } catch {}
  try {
    const d = await fetcher(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=musicArtist&limit=6`)
    for (const a of d?.results ?? []) artists.push({ source: 'itunes', artistId: String(a.artistId), name: a.artistName, genre: a.primaryGenreName, link: a.artistLinkUrl, exact: norm(a.artistName) === target })
  } catch {}
  artists.sort((a, b) => Number(b.exact) - Number(a.exact))
  return { query: q, artists: artists.slice(0, 10), note: 'Similar names are common. Only import the artist profiles that are really you.' }
}

/** Tracks for one chosen artist profile. Includes songs where the artist is featured (iTunes). */
export async function artistTracks(source: string, artistId: string, fetcher: Fetcher = defaultFetch): Promise<Candidate[]> {
  if (!/^\d{1,20}$/.test(artistId)) throw new ServiceError('artistId invalid')
  const out: Candidate[] = []
  if (source === 'deezer') {
    const albums = await fetcher(`https://api.deezer.com/artist/${artistId}/albums?limit=50`)
    for (const al of (albums?.data ?? []).slice(0, 25)) {
      const t = await fetcher(`https://api.deezer.com/album/${al.id}/tracks?limit=100`).catch(() => null)
      for (const tr of t?.data ?? []) out.push({ source: 'deezer', sourceId: String(tr.id), title: tr.title, artistCredit: tr.artist?.name ?? '', album: al.title, isrc: tr.isrc, releaseDate: al.release_date, durationSec: tr.duration, explicit: Boolean(tr.explicit_lyrics), link: tr.link, artwork: al.cover_medium })
    }
  } else if (source === 'itunes') {
    const d = await fetcher(`https://itunes.apple.com/lookup?id=${artistId}&entity=song&limit=200`)
    for (const tr of (d?.results ?? []).filter((x: any) => x.wrapperType === 'track')) out.push({ source: 'itunes', sourceId: String(tr.trackId), title: tr.trackName, artistCredit: tr.artistName, album: tr.collectionName, releaseDate: tr.releaseDate?.slice(0, 10), durationSec: tr.trackTimeMillis ? Math.round(tr.trackTimeMillis / 1000) : undefined, explicit: tr.trackExplicitness === 'explicit', link: tr.trackViewUrl, artwork: tr.artworkUrl100 })
  } else throw new ServiceError('source must be deezer or itunes')
  return out.slice(0, 400)
}

export async function importTracks(db: any, label: string, actor: number, tracks: any[]) {
  await requireEditor(db, label, actor)
  if (!Array.isArray(tracks) || !tracks.length || tracks.length > 400) throw new ServiceError('tracks must be 1-400 items')
  let added = 0
  for (const t of tracks) {
    const source = ['deezer', 'itunes', 'manual', 'agent'].includes(t?.source) ? t.source : null
    if (!source) throw new ServiceError('track source invalid')
    const title = clean(t.title, 'title', 300)!, credit = clean(t.artistCredit, 'artistCredit', 300)!
    const isrc = t.isrc && /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(String(t.isrc).replace(/-/g, '')) ? String(t.isrc).replace(/-/g, '').toUpperCase() : null
    const date = t.releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(t.releaseDate) ? t.releaseDate : null
    const link = typeof t.link === 'string' && /^https:\/\//.test(t.link) && t.link.length < 500 ? t.link : null
    const r = await db.prepare(`INSERT INTO lw_catalog_tracks(id,label_id,source,source_id,title,artist_credit,album,isrc,release_date,duration_sec,explicit,link)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`).bind(crypto.randomUUID(), label, source, t.sourceId ? String(t.sourceId).slice(0, 40) : null, title, credit, clean(t.album, 'album', 300, false), isrc, date,
      Number.isFinite(t.durationSec) ? Math.round(t.durationSec) : null, t.explicit == null ? null : t.explicit ? 1 : 0, link).run()
    added += r.meta.changes
  }
  // Same recording often appears on several albums/sources: keep one row per ISRC as the primary.
  return { added, ...(await catalogSummary(db, label)) }
}

export async function catalogSummary(db: any, label: string) {
  const r: any = await db.prepare(`SELECT COUNT(DISTINCT COALESCE(isrc, lower(title))) AS songs,
    COUNT(DISTINCT CASE WHEN pro_status='REGISTERED' THEN COALESCE(isrc, lower(title)) END) AS pro_registered,
    COUNT(DISTINCT CASE WHEN pro_status='NOT_REGISTERED' THEN COALESCE(isrc, lower(title)) END) AS pro_missing,
    COUNT(DISTINCT CASE WHEN sx_status='CLAIMED' THEN COALESCE(isrc, lower(title)) END) AS sx_claimed
    FROM lw_catalog_tracks WHERE label_id=? AND pro_status<>'NOT_MINE' AND sx_status<>'NOT_MINE'`).bind(label).first()
  return { songs: r?.songs ?? 0, proRegistered: r?.pro_registered ?? 0, proMissing: r?.pro_missing ?? 0, sxClaimed: r?.sx_claimed ?? 0 }
}
export async function listCatalog(db: any, label: string, limit = 400) {
  return (await db.prepare(`SELECT id,source,title,artist_credit,album,isrc,release_date,link,pro_status,sx_status,notes FROM lw_catalog_tracks WHERE label_id=? ORDER BY release_date DESC, title LIMIT ?`).bind(label, Math.min(limit, 400)).all()).results
}
export async function updateTrack(db: any, label: string, actor: number, id: string, b: any) {
  await requireEditor(db, label, actor)
  const sets: string[] = [], vals: any[] = []
  if (b?.proStatus != null) { if (!['UNKNOWN', 'REGISTERED', 'NOT_REGISTERED', 'NOT_MINE'].includes(b.proStatus)) throw new ServiceError('proStatus invalid'); sets.push('pro_status=?'); vals.push(b.proStatus) }
  if (b?.sxStatus != null) { if (!['UNKNOWN', 'CLAIMED', 'NOT_CLAIMED', 'NOT_MINE'].includes(b.sxStatus)) throw new ServiceError('sxStatus invalid'); sets.push('sx_status=?'); vals.push(b.sxStatus) }
  if (b?.notes !== undefined) { sets.push('notes=?'); vals.push(clean(b.notes, 'notes', 1000, false)) }
  if (!sets.length) throw new ServiceError('Nothing to update')
  const r = await db.prepare(`UPDATE lw_catalog_tracks SET ${sets.join(',')},updated_at=CURRENT_TIMESTAMP WHERE label_id=? AND id=?`).bind(...vals, label, id).run()
  if (!r.meta.changes) throw new ServiceError('Track not found', 404)
  return catalogSummary(db, label)
}

// ---------------- cases ----------------
function computeDeadline(playbook: string, facts: Record<string, any>) {
  if (playbook === 'tv-cue-sheet' && typeof facts.airDate === 'string') {
    const d = ascapClaimDeadline(facts.airDate.slice(0, 10))
    if (d) return { deadline: d, note: `ASCAP writer claim window for a ${facts.airDate} air date closes ${d} (publishers: one month earlier). Check ascap.com before relying on it; BMI/SESAC rules differ.` }
  }
  if (playbook === 'soundexchange-money') return { deadline: null, note: 'SoundExchange releases unclaimed royalties after 3 years. Every month of delay can age out the oldest money.' }
  return { deadline: null, note: null }
}

export async function openCase(db: any, label: string, actor: number, b: any, by: string) {
  await requireEditor(db, label, actor)
  const pb = playbookById(String(b?.playbook ?? ''))
  if (!pb) throw new ServiceError(`playbook must be one of ${PLAYBOOKS.map(p => p.id).join(', ')}`)
  const title = clean(b?.title ?? pb.name, 'title', 200)!
  const facts = sanitizeFacts(b?.facts)
  const { deadline, note } = computeDeadline(pb.id, facts)
  const id = crypto.randomUUID(), missing = pb.needs.filter(n => n.required && facts[n.key] == null)
  await db.batch([
    db.prepare(`INSERT INTO lw_cases(id,label_id,playbook,playbook_version,title,status,facts_json,deadline,deadline_note,created_by,next_follow_up_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, label, pb.id, pb.version, title, missing.length ? 'WAITING_ON_YOU' : 'OPEN', JSON.stringify(facts), deadline, note, actor, iso(day)),
    event(db, label, id, by, 'OPENED', `Case opened with playbook "${pb.name}".${missing.length ? ' Still need: ' + missing.map(m => m.question).join(' ') : ''}`)
  ])
  return getCase(db, label, actor, id)
}

function sanitizeFacts(f: any): Record<string, any> {
  if (f == null) return {}
  if (typeof f !== 'object' || Array.isArray(f)) throw new ServiceError('facts must be an object')
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(f).slice(0, 40)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(k)) throw new ServiceError(`fact key "${k}" invalid`)
    if (v == null) continue
    const s = typeof v === 'string' ? v : JSON.stringify(v)
    if (s.length > 2000) throw new ServiceError(`fact "${k}" too long`)
    out[k] = typeof v === 'string' ? v.trim() : v
  }
  return out
}

export async function updateCase(db: any, label: string, actor: number, id: string, b: any, by: string) {
  await requireEditor(db, label, actor)
  const c: any = await db.prepare('SELECT * FROM lw_cases WHERE label_id=? AND id=?').bind(label, id).first()
  if (!c) throw new ServiceError('Case not found', 404)
  const facts = { ...JSON.parse(c.facts_json), ...sanitizeFacts(b?.facts) }
  const status = b?.status ?? c.status
  if (!['OPEN', 'WAITING_ON_YOU', 'WAITING_ON_THEM', 'RESOLVED', 'CLOSED'].includes(status)) throw new ServiceError('status invalid')
  const step = b?.step == null ? c.step : Number(b.step)
  if (!Number.isInteger(step) || step < 0 || step > 50) throw new ServiceError('step invalid')
  const money = b?.moneyEstimate === undefined ? c.money_estimate : clean(b.moneyEstimate, 'moneyEstimate', 100, false)
  const { deadline, note } = b?.facts ? computeDeadline(c.playbook, facts) : { deadline: c.deadline, note: c.deadline_note }
  const followDays = b?.followUpInDays == null ? null : Number(b.followUpInDays)
  if (followDays !== null && (!Number.isFinite(followDays) || followDays < 0 || followDays > 365)) throw new ServiceError('followUpInDays invalid')
  const next = ['RESOLVED', 'CLOSED'].includes(status) ? null : followDays !== null ? iso(followDays * day) : c.next_follow_up_at
  const stmts = [db.prepare('UPDATE lw_cases SET facts_json=?,status=?,step=?,money_estimate=?,deadline=COALESCE(?,deadline),deadline_note=COALESCE(?,deadline_note),next_follow_up_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .bind(JSON.stringify(facts), status, step, money, deadline, note, next, id)]
  const summary = clean(b?.note, 'note', 4000, false)
  stmts.push(event(db, label, id, by, b?.kind && /^[A-Z_]{2,30}$/.test(b.kind) ? b.kind : 'STEP', summary ?? `Updated case${status !== c.status ? ' → ' + status : ''}.`))
  await db.batch(stmts)
  return getCase(db, label, actor, id)
}

export async function listCases(db: any, label: string, actor: number) {
  await requireMember(db, label, actor)
  const rows = (await db.prepare(`SELECT c.id,c.playbook,c.title,c.status,c.step,c.deadline,c.deadline_note,c.money_estimate,c.next_follow_up_at,c.updated_at,
     (SELECT COUNT(*) FROM lw_case_drafts d WHERE d.case_id=c.id AND d.status='DRAFT') AS drafts_waiting
     FROM lw_cases c WHERE c.label_id=? ORDER BY CASE c.status WHEN 'WAITING_ON_YOU' THEN 0 WHEN 'OPEN' THEN 1 WHEN 'WAITING_ON_THEM' THEN 2 ELSE 3 END, c.deadline IS NULL, c.deadline, c.updated_at DESC LIMIT 100`).bind(label).all()).results
  return rows.map((r: any) => ({ ...r, playbookName: playbookById(r.playbook)?.name ?? r.playbook }))
}

export async function getCase(db: any, label: string, actor: number, id: string) {
  await requireMember(db, label, actor)
  const c: any = await db.prepare('SELECT * FROM lw_cases WHERE label_id=? AND id=?').bind(label, id).first()
  if (!c) throw new ServiceError('Case not found', 404)
  const pb = playbookById(c.playbook)!
  const facts = JSON.parse(c.facts_json)
  const [events, drafts] = await Promise.all([
    db.prepare('SELECT actor,kind,body,created_at FROM lw_case_events WHERE case_id=? ORDER BY cursor DESC LIMIT 60').bind(id).all(),
    db.prepare('SELECT id,kind,recipient,recipient_email,subject,body,status,written_by,approved_at,sent_at,sent_note,created_at FROM lw_case_drafts WHERE case_id=? ORDER BY created_at DESC LIMIT 30').bind(id).all()
  ])
  return {
    case: { id: c.id, playbook: c.playbook, title: c.title, status: c.status, step: c.step, deadline: c.deadline, deadlineNote: c.deadline_note, moneyEstimate: c.money_estimate, nextFollowUpAt: c.next_follow_up_at, createdAt: c.created_at, updatedAt: c.updated_at, facts },
    playbook: { ...pb, standingRules: STANDING_RULES },
    stillNeeded: pb.needs.filter(n => facts[n.key] == null).map(n => ({ ...n })),
    events: events.results, drafts: drafts.results
  }
}

// ---------------- drafts (human approval gate) ----------------
export async function saveDraft(db: any, label: string, actor: number, caseId: string, b: any, by: string) {
  await requireEditor(db, label, actor)
  const c = await db.prepare('SELECT id FROM lw_cases WHERE label_id=? AND id=?').bind(label, caseId).first()
  if (!c) throw new ServiceError('Case not found', 404)
  const kind = b?.kind ?? 'EMAIL'
  if (!['EMAIL', 'LETTER', 'FORM_NOTES', 'CONTRACT', 'POST'].includes(kind)) throw new ServiceError('kind invalid')
  const email = clean(b?.recipientEmail, 'recipientEmail', 200, false)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ServiceError('recipientEmail invalid')
  const body = clean(b?.body, 'body', 20000)!
  const id = crypto.randomUUID()
  await db.batch([
    db.prepare('INSERT INTO lw_case_drafts(id,label_id,case_id,kind,recipient,recipient_email,subject,body,written_by) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(id, label, caseId, kind, clean(b?.recipient, 'recipient', 200, false), email, clean(b?.subject, 'subject', 300, false), body, by.slice(0, 100)),
    db.prepare("UPDATE lw_cases SET status=CASE WHEN status IN ('RESOLVED','CLOSED') THEN status ELSE 'WAITING_ON_YOU' END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(caseId),
    event(db, label, caseId, by, 'DRAFT', `Drafted ${kind.toLowerCase()}${b?.recipient ? ' to ' + b.recipient : ''} for your approval.`)
  ])
  return { draftId: id, status: 'DRAFT', note: 'Waiting for the owner to approve on the Money Found board. Do not send until status is APPROVED.' }
}

/** Only a human session (website) can approve or reject. */
export async function decideDraft(db: any, label: string, actor: number, draftId: string, decision: string, edits?: { subject?: string; body?: string }) {
  await requireEditor(db, label, actor)
  const d: any = await db.prepare('SELECT * FROM lw_case_drafts WHERE label_id=? AND id=?').bind(label, draftId).first()
  if (!d) throw new ServiceError('Draft not found', 404)
  if (d.status !== 'DRAFT') throw new ServiceError(`Draft is already ${d.status}`, 409)
  if (!['APPROVED', 'REJECTED'].includes(decision)) throw new ServiceError('decision must be APPROVED or REJECTED')
  const body = edits?.body != null ? clean(edits.body, 'body', 20000)! : d.body, subject = edits?.subject != null ? clean(edits.subject, 'subject', 300, false) : d.subject
  await db.batch([
    db.prepare('UPDATE lw_case_drafts SET status=?,body=?,subject=?,approved_by=?,approved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(decision, body, subject, actor, draftId),
    event(db, label, d.case_id, 'owner', decision === 'APPROVED' ? 'APPROVED' : 'REJECTED', decision === 'APPROVED' ? `Owner approved the ${d.kind.toLowerCase()}${d.recipient ? ' to ' + d.recipient : ''}. Agent may send it.` : 'Owner rejected the draft.'),
    db.prepare("UPDATE lw_cases SET status=CASE WHEN status='WAITING_ON_YOU' THEN 'OPEN' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(d.case_id)
  ])
  return { draftId, status: decision }
}

export async function markSent(db: any, label: string, actor: number, draftId: string, note: string | undefined, by: string) {
  await requireEditor(db, label, actor)
  const d: any = await db.prepare('SELECT * FROM lw_case_drafts WHERE label_id=? AND id=?').bind(label, draftId).first()
  if (!d) throw new ServiceError('Draft not found', 404)
  if (d.status !== 'APPROVED') throw new ServiceError('Only owner-approved drafts can be sent. Ask the owner to approve it on the Money Found board first.', 409)
  const pb = playbookById((await db.prepare('SELECT playbook FROM lw_cases WHERE id=?').bind(d.case_id).first())?.playbook)
  const followDays = pb?.followUpDays?.[0] ?? 14
  await db.batch([
    db.prepare("UPDATE lw_case_drafts SET status='SENT',sent_at=CURRENT_TIMESTAMP,sent_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(clean(note, 'note', 500, false), draftId),
    db.prepare("UPDATE lw_cases SET status=CASE WHEN status IN ('RESOLVED','CLOSED') THEN status ELSE 'WAITING_ON_THEM' END,next_follow_up_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(iso(followDays * day), d.case_id),
    event(db, label, d.case_id, by, 'SENT', `Sent ${d.kind.toLowerCase()}${d.recipient ? ' to ' + d.recipient : ''}${note ? ' (' + note + ')' : ''}. Follow-up in ${followDays} days.`)
  ])
  return { draftId, status: 'SENT', followUpInDays: followDays }
}

/** Engine hook: cases whose follow-up date passed become agent work. */
export async function dueCases(db: any, labelIds?: string[]) {
  return (await db.prepare(`SELECT id,label_id,playbook,title,status FROM lw_cases WHERE status IN ('OPEN','WAITING_ON_THEM') AND next_follow_up_at IS NOT NULL AND next_follow_up_at<=?
    AND (? IS NULL OR label_id IN (SELECT value FROM json_each(?))) LIMIT 200`).bind(iso(), labelIds ? 1 : null, JSON.stringify(labelIds ?? [])).all()).results as any[]
}

export { suggestPlaybooks, PLAYBOOKS, STANDING_RULES }
