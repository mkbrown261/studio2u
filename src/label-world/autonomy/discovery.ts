// "Know me": your team can't help you until they know you.
// 1) Public lookup (MusicBrainz, Deezer, Apple) under every name you use. Only exact-name
//    matches count; links stay SUGGESTED until the owner says "That's me" (namesakes are common).
// 2) A short interview: the next 3 most useful questions, saved as OWNER facts (confirmed).
// 3) The owner's own agent (KNOW_ARTIST task) web-searches, reads the owner's analytics
//    read-only (account totals + last 10 posts), and saves facts/links WITH evidence. Agent and
//    public facts are unconfirmed until the owner confirms; they never overwrite what the owner said.
// Every agent task and every employee chat gets artistBrief() so nobody works blind.
// Never stored: passwords, tax IDs, bank details, DMs.
import { ServiceError, memberRole, requireEditor } from './service'

export const KNOW_ME_VERSION = '2026-10-29'
type Kind = 'text' | 'list' | 'bool' | 'num'
/** Every fact the team can know, in interview priority order. */
export const FACTS: { key: string; kind: Kind; q: string | null; weight: number }[] = [
  { key: 'goals', kind: 'text', weight: 3, q: 'What do you want the next 12 months to look like? (e.g. 10k monthly listeners, a TV placement, a tour, quit my job)' },
  { key: 'ownsMasters', kind: 'bool', weight: 2, q: 'Do you own your masters (self-released), or does a label own them?' },
  { key: 'distributor', kind: 'text', weight: 2, q: 'Who distributes your music? (UnitedMasters, DistroKid, TuneCore, a label...)' },
  { key: 'story', kind: 'text', weight: 3, q: 'Tell me your story in a few sentences: where you are from, how you started, what makes you different.' },
  { key: 'hometown', kind: 'text', weight: 1, q: 'Where are you from, and where are you based now?' },
  { key: 'genres', kind: 'list', weight: 2, q: 'How would you describe your sound? (genres, moods)' },
  { key: 'influences', kind: 'list', weight: 1, q: 'Who do you sound like, or who inspires you?' },
  { key: 'audience', kind: 'text', weight: 2, q: 'Who listens to you? (age, cities, what they are into)' },
  { key: 'strengths', kind: 'text', weight: 1, q: 'What is working best right now? (a song, a type of post, live shows...)' },
  { key: 'challenges', kind: 'text', weight: 2, q: 'What is the biggest thing holding you back?' },
  { key: 'upcomingRelease', kind: 'text', weight: 1, q: 'Anything dropping soon? Title and date.' },
  { key: 'releaseCadence', kind: 'text', weight: 1, q: 'How often do you release music, and how often do you post?' },
  { key: 'contentStyle', kind: 'text', weight: 1, q: 'What kind of content do you like making? (performance, studio, behind the scenes, skits, talking to camera)' },
  { key: 'brandWords', kind: 'list', weight: 1, q: 'Give me 3 words that describe you as an artist.' },
  { key: 'doNotDo', kind: 'text', weight: 1, q: 'Anything your team should never do, say or post?' },
  { key: 'budgetMonthly', kind: 'num', weight: 1, q: 'Monthly budget for promo and content in dollars (0 is fine).' },
  { key: 'team', kind: 'text', weight: 1, q: 'Who else is on your team? (manager, producer, DJ, videographer)' },
  { key: 'pastPlacements', kind: 'text', weight: 1, q: 'Any past wins? (TV/film placements, playlists, press, big shows)' },
  // Filled from public lookups or the agent's research, not asked:
  { key: 'similarArtists', kind: 'list', weight: 1, q: null },
  { key: 'topTracks', kind: 'list', weight: 0, q: null },
  { key: 'publicFans', kind: 'num', weight: 0, q: null },
  { key: 'ipiPublic', kind: 'list', weight: 0, q: null },
  { key: 'artistType', kind: 'text', weight: 0, q: null },
  { key: 'press', kind: 'list', weight: 1, q: null }
]
const FACT = new Map(FACTS.map(f => [f.key, f]))
const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'spotify', 'apple_music', 'soundcloud', 'x', 'facebook', 'bandcamp', 'genius', 'deezer', 'audiomack', 'website', 'press', 'discogs', 'musicbrainz', 'wikipedia', 'other'] as const
const SECRET = /(password|passcode|ssn|social security|tax.?id|\bein\b|routing|account.?number|iban|swift|bank)/i
const SSN = /\b\d{3}-\d{2}-\d{4}\b/
const str = (v: unknown, f: string, max: number) => { if (v == null || v === '') return null; if (typeof v !== 'string' || v.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)) throw new ServiceError(`Invalid ${f}`); return v.trim() || null }
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
export type Lookup = (url: string) => Promise<any>
const UA = 'Studio2U-LabelWorld/1.0 (https://studio2u.pages.dev)'
const defaultLookup: Lookup = async url => { const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } }); if (!r.ok) throw new Error('lookup ' + r.status); return r.json() }

// ---------------- facts ----------------
function cleanValue(key: string, v: unknown) {
  const f = FACT.get(key); if (!f) throw new ServiceError(`Unknown fact ${key}. Known: ${FACTS.map(x => x.key).join(', ')}`)
  if (f.kind === 'bool') { if (typeof v !== 'boolean') throw new ServiceError(`${key} must be true or false`); return v }
  if (f.kind === 'num') { const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > 1e12) throw new ServiceError(`${key} must be a number`); return n }
  if (f.kind === 'list') {
    const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : null
    if (!arr) throw new ServiceError(`${key} must be a list`)
    const out = arr.slice(0, 20).map((x, i) => str(typeof x === 'string' ? x : String(x), `${key}[${i}]`, 200)).filter(Boolean) as string[]
    if (out.some(x => SECRET.test(x) || SSN.test(x))) throw new ServiceError('Never save passwords, tax IDs or bank details.')
    return [...new Set(out)]
  }
  const s = str(v, key, 1500); if (!s) throw new ServiceError(`${key} is empty`)
  if (SECRET.test(s) || SSN.test(s)) throw new ServiceError('Never save passwords, tax IDs or bank details.')
  return s
}
/** OWNER facts are confirmed. AGENT/PUBLIC facts are suggestions and never overwrite an OWNER or confirmed fact. */
export async function saveFacts(db: any, label: string, actor: number, facts: Record<string, unknown>, source: 'OWNER' | 'AGENT' | 'PUBLIC', by: string, evidence?: string | null) {
  await requireEditor(db, label, actor)
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) throw new ServiceError('facts must be an object')
  const keys = Object.keys(facts); if (!keys.length || keys.length > 30) throw new ServiceError('Save 1-30 facts at a time')
  const ev = str(evidence, 'evidence', 500)
  if (source === 'AGENT' && !ev) throw new ServiceError('Say where you learned this (a link or "the owner told me in chat").')
  const saved: string[] = [], kept: string[] = []
  for (const k of keys) {
    const value = cleanValue(k, facts[k])
    if (source !== 'OWNER') {
      const cur: any = await db.prepare('SELECT source,confirmed FROM lw_artist_facts WHERE label_id=? AND key=?').bind(label, k).first()
      if (cur && (cur.source === 'OWNER' || cur.confirmed)) { kept.push(k); continue }
    }
    await db.prepare(`INSERT INTO lw_artist_facts(label_id,key,value_json,source,evidence,confirmed,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(label_id,key) DO UPDATE SET value_json=excluded.value_json,source=excluded.source,evidence=excluded.evidence,confirmed=excluded.confirmed,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`)
      .bind(label, k, JSON.stringify(value), source, ev, source === 'OWNER' ? 1 : 0, by.slice(0, 100)).run()
    saved.push(k)
  }
  await db.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, actor, 'artist.facts.saved', JSON.stringify({ source, by, saved, kept })).run()
  return { saved, keptOwnerAnswers: kept }
}
export async function confirmFact(db: any, label: string, actor: number, key: string, confirm: boolean) {
  await requireEditor(db, label, actor)
  if (!FACT.has(key)) throw new ServiceError('Unknown fact')
  const r = confirm
    ? await db.prepare('UPDATE lw_artist_facts SET confirmed=1,updated_at=CURRENT_TIMESTAMP WHERE label_id=? AND key=?').bind(label, key).run()
    : await db.prepare('DELETE FROM lw_artist_facts WHERE label_id=? AND key=?').bind(label, key).run()
  if (!r.meta.changes) throw new ServiceError('Fact not found', 404)
  return { key, confirmed: confirm }
}

// ---------------- links ("Is this you?") ----------------
export function platformOf(url: string): typeof PLATFORMS[number] {
  let h = ''; try { h = new URL(url).hostname.replace(/^www\.|^m\./, '') } catch { return 'other' }
  const map: [RegExp, typeof PLATFORMS[number]][] = [[/instagram\.com$/, 'instagram'], [/tiktok\.com$/, 'tiktok'], [/(youtube\.com|youtu\.be)$/, 'youtube'], [/spotify\.com$/, 'spotify'], [/(music|itunes)\.apple\.com$/, 'apple_music'], [/soundcloud\.com$/, 'soundcloud'], [/(twitter|x)\.com$/, 'x'], [/facebook\.com$/, 'facebook'], [/bandcamp\.com$/, 'bandcamp'], [/genius\.com$/, 'genius'], [/deezer\.com$/, 'deezer'], [/audiomack\.com$/, 'audiomack'], [/discogs\.com$/, 'discogs'], [/musicbrainz\.org$/, 'musicbrainz'], [/wikipedia\.org$/, 'wikipedia']]
  return map.find(([re]) => re.test(h))?.[1] ?? 'other'
}
const httpsUrl = (u: unknown, f = 'url') => { const s = str(u, f, 500); if (!s) throw new ServiceError(`${f} required`); let x: URL; try { x = new URL(s) } catch { throw new ServiceError(`${f} must be a web link`) } if (x.protocol !== 'https:' && x.protocol !== 'http:') throw new ServiceError(`${f} must be a web link`); x.hash = ''; return x.toString().replace(/^http:/, 'https:') }
export async function addLink(db: any, label: string, actor: number, b: any, source: 'MUSICBRAINZ' | 'DEEZER' | 'ITUNES' | 'AGENT' | 'OWNER', by: string) {
  await requireEditor(db, label, actor)
  const url = httpsUrl(b?.url), evidence = str(b?.evidence, 'evidence', 500)
  if (source === 'AGENT' && !evidence) throw new ServiceError('Say why you think this is them (link, matching photo, bio mentions a song, linked from their official site...).')
  const confidence = ['STRONG', 'LIKELY', 'POSSIBLE'].includes(b?.confidence) ? b.confidence : 'POSSIBLE'
  const platform = PLATFORMS.includes(b?.platform) ? b.platform : platformOf(url)
  const status = source === 'OWNER' ? 'CONFIRMED' : 'SUGGESTED'
  const id = crypto.randomUUID()
  const r = await db.prepare(`INSERT INTO lw_artist_links(id,label_id,platform,url,handle,source,confidence,status,evidence,found_by,metrics_json) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(label_id,url) DO NOTHING`)
    .bind(id, label, platform, url, str(b?.handle, 'handle', 120), source, confidence, status, evidence, by.slice(0, 100), JSON.stringify(b?.metrics && typeof b.metrics === 'object' ? b.metrics : {})).run()
  if (!r.meta.changes) { const cur: any = await db.prepare('SELECT id,status FROM lw_artist_links WHERE label_id=? AND url=?').bind(label, url).first(); return { id: cur.id, status: cur.status, duplicate: true } }
  if (status === 'CONFIRMED') await syncSocial(db, label, platform, url)
  return { id, status, platform }
}
async function syncSocial(db: any, label: string, platform: string, url: string) {
  const key = ({ instagram: 'instagram', tiktok: 'tiktok', youtube: 'youtube', spotify: 'spotify', apple_music: 'appleMusic', x: 'x' } as Record<string, string>)[platform]
  if (!key) return
  const row: any = await db.prepare('SELECT socials_json FROM lw_label_identity WHERE label_id=?').bind(label).first()
  if (!row) return
  const s = JSON.parse(row.socials_json || '{}'); if (s[key]) return
  s[key] = url
  await db.prepare('UPDATE lw_label_identity SET socials_json=?,updated_at=CURRENT_TIMESTAMP WHERE label_id=?').bind(JSON.stringify(s), label).run()
}
/** Owner only: "That's me" / "Not me". */
export async function decideLink(db: any, label: string, actor: number, id: string, decision: string) {
  await requireEditor(db, label, actor)
  if (!['CONFIRMED', 'NOT_ME'].includes(decision)) throw new ServiceError('decision must be CONFIRMED or NOT_ME')
  const l: any = await db.prepare('SELECT * FROM lw_artist_links WHERE label_id=? AND id=?').bind(label, id).first()
  if (!l) throw new ServiceError('Link not found', 404)
  await db.prepare('UPDATE lw_artist_links SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(decision, id).run()
  if (decision === 'CONFIRMED') await syncSocial(db, label, l.platform, l.url)
  return { id, status: decision }
}

// ---------------- public lookup ----------------
const MB_PLATFORM: Record<string, string> = { 'official homepage': 'website', 'free streaming': '', 'streaming': '', 'social network': '', 'youtube': 'youtube', 'soundcloud': 'soundcloud', 'bandcamp': 'bandcamp', 'discogs': 'discogs', 'wikidata': 'other', 'wikipedia': 'wikipedia', 'lyrics': 'genius', 'video channel': 'youtube' }
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
/** Searches public music databases for the artist's exact name (and aliases). Saves links as suggestions and facts as unconfirmed PUBLIC facts. */
export async function discoverPublic(db: any, label: string, actor: number, lookup: Lookup = defaultLookup) {
  await requireEditor(db, label, actor)
  const id: any = await db.prepare('SELECT artist_name,aliases_json,spotify_artist_id,apple_artist_id FROM lw_label_identity WHERE label_id=?').bind(label).first()
  if (!id) throw new ServiceError('Tell us your artist name first (Who I am).', 409)
  const throttle = lookup === defaultLookup ? () => wait(1100) : async () => {}
  const names = [id.artist_name, ...JSON.parse(id.aliases_json || '[]')].slice(0, 3) as string[]
  const targets = new Set(names.map(norm))
  const found: any[] = [], facts: Record<string, unknown> = {}, notes: string[] = []
  const add = (x: any) => { if (!found.some(f => f.url === x.url)) found.push(x) }
  const known = (u: string) => (id.spotify_artist_id && u.includes(id.spotify_artist_id)) || (id.apple_artist_id && u.includes(id.apple_artist_id))
  // MusicBrainz: official links, genres, area, IPI.
  for (const name of names.slice(0, 2)) {
    let res: any; try { res = await lookup(`https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(`artist:"${name}"`)}&limit=5&fmt=json`) } catch { notes.push('MusicBrainz did not answer.'); break }
    const exact = (res?.artists ?? []).filter((a: any) => (a.score ?? 0) >= 90 && (targets.has(norm(a.name)) || (a.aliases ?? []).some((x: any) => targets.has(norm(x.name)))))
    if (exact.length > 1) notes.push(`${exact.length} artists in MusicBrainz are named "${name}". Only confirm the links that are you.`)
    for (const a of exact.slice(0, 2)) {
      await throttle()
      let d: any; try { d = await lookup(`https://musicbrainz.org/ws/2/artist/${encodeURIComponent(a.id)}?inc=url-rels+genres&fmt=json`) } catch { continue }
      const rels = (d?.relations ?? []).filter((r: any) => r?.url?.resource).map((r: any) => ({ type: r.type, url: String(r.url.resource) }))
      const strong = rels.some((r: any) => known(r.url))
      const conf = strong ? 'STRONG' : exact.length === 1 ? 'LIKELY' : 'POSSIBLE'
      const mbUrl = `https://musicbrainz.org/artist/${a.id}`
      add({ url: mbUrl, platform: 'musicbrainz', source: 'MUSICBRAINZ', confidence: conf, evidence: `MusicBrainz artist "${d?.name ?? a.name}"${a.disambiguation ? ` (${a.disambiguation})` : ''}${a.area?.name ? `, ${a.area.name}` : ''}${strong ? '; links to your confirmed Spotify/Apple profile' : ''}` })
      for (const r of rels.slice(0, 25)) {
        const p = MB_PLATFORM[r.type] === '' || MB_PLATFORM[r.type] == null ? platformOf(r.url) : (MB_PLATFORM[r.type] as any)
        if (['other', 'discogs'].includes(p) && !/wikidata/.test(r.url)) { if (p === 'other') continue }
        add({ url: r.url, platform: p, source: 'MUSICBRAINZ', confidence: conf, evidence: `Listed on the MusicBrainz page ${mbUrl} (${r.type})` })
      }
      if (exact.length === 1 || strong) {
        const genres = (d?.genres ?? []).sort((x: any, y: any) => (y.count ?? 0) - (x.count ?? 0)).slice(0, 5).map((g: any) => g.name)
        if (genres.length) facts.genres = genres
        const area = [a['begin-area']?.name, a.area?.name].filter(Boolean)
        if (area.length) facts.hometown = [...new Set(area)].join(' / ')
        if (a.type) facts.artistType = a.type
        if (Array.isArray(a.ipis) && a.ipis.length) facts.ipiPublic = a.ipis.slice(0, 3)
      }
    }
    if (exact.length) break
    await throttle()
  }
  // Deezer: fans, top tracks, similar artists (only with a single exact match).
  try {
    const d = await lookup(`https://api.deezer.com/search/artist?q=${encodeURIComponent(names[0])}&limit=8`)
    const exact = (d?.data ?? []).filter((a: any) => targets.has(norm(a.name)))
    for (const a of exact.slice(0, 3)) add({ url: `https://www.deezer.com/artist/${a.id}`, platform: 'deezer', source: 'DEEZER', confidence: exact.length === 1 ? 'LIKELY' : 'POSSIBLE', evidence: `Deezer artist "${a.name}": ${a.nb_fan ?? 0} fans, ${a.nb_album ?? 0} releases`, metrics: { fans: a.nb_fan ?? null, releases: a.nb_album ?? null } })
    if (exact.length === 1) {
      const a = exact[0]; facts.publicFans = a.nb_fan ?? 0
      const top = await lookup(`https://api.deezer.com/artist/${a.id}/top?limit=5`).catch(() => null)
      const t = (top?.data ?? []).map((x: any) => x.title).filter(Boolean); if (t.length) facts.topTracks = t
      const rel = await lookup(`https://api.deezer.com/artist/${a.id}/related?limit=6`).catch(() => null)
      const r = (rel?.data ?? []).map((x: any) => x.name).filter(Boolean); if (r.length) facts.similarArtists = r
    } else if (exact.length > 1) notes.push(`${exact.length} Deezer artists are named "${names[0]}".`)
  } catch { notes.push('Deezer did not answer.') }
  // Apple Music profile(s).
  try {
    const d = await lookup(`https://itunes.apple.com/search?term=${encodeURIComponent(names[0])}&entity=musicArtist&limit=6`)
    const exact = (d?.results ?? []).filter((a: any) => targets.has(norm(a.artistName ?? '')))
    for (const a of exact.slice(0, 3)) if (a.artistLinkUrl) add({ url: String(a.artistLinkUrl).split('?')[0], platform: 'apple_music', source: 'ITUNES', confidence: id.apple_artist_id && String(a.artistId) === String(id.apple_artist_id) ? 'STRONG' : exact.length === 1 ? 'LIKELY' : 'POSSIBLE', evidence: `Apple Music artist "${a.artistName}"${a.primaryGenreName ? ` (${a.primaryGenreName})` : ''}` })
    if (!facts.genres && exact.length === 1 && exact[0].primaryGenreName) facts.genres = [exact[0].primaryGenreName]
  } catch { notes.push('Apple Music did not answer.') }

  let links = 0
  for (const f of found) { const r = await addLink(db, label, actor, f, f.source, 'public-lookup'); if (!r.duplicate) links++ }
  const saved = Object.keys(facts).length ? await saveFacts(db, label, actor, facts, 'PUBLIC', 'public-lookup', 'MusicBrainz / Deezer / Apple Music public data') : { saved: [], keptOwnerAnswers: [] }
  await db.prepare('UPDATE lw_label_identity SET discovered_at=CURRENT_TIMESTAMP WHERE label_id=?').bind(label).run()
  return { searched: names, newLinks: links, facts: saved.saved, notes, say: links ? `I found ${links} possible profile${links === 1 ? '' : 's'}. Tap "That's me" on the ones that are you.` : `I couldn't find "${names[0]}" in public music databases yet. Your agent will search the web and your socials next.` }
}

// ---------------- dossier + brief ----------------
function readFacts(rows: any[]) { const o: Record<string, any> = {}; for (const r of rows) o[r.key] = { value: JSON.parse(r.value_json), source: r.source, confirmed: Boolean(r.confirmed), evidence: r.evidence, updatedAt: r.updated_at }; return o }
async function socialSummary(db: any, label: string) {
  const posts = (await db.prepare(`SELECT platform,title,url,posted_at,metrics_json,captured_at FROM lw_social_snapshots WHERE label_id=? AND kind='MY_POST' ORDER BY COALESCE(posted_at,captured_at) DESC LIMIT 10`).bind(label).all()).results as any[]
  const accts = (await db.prepare(`SELECT s.platform,s.metrics_json,s.captured_at FROM lw_social_snapshots s WHERE s.label_id=? AND s.kind='MY_ACCOUNT' AND s.captured_at=(SELECT MAX(captured_at) FROM lw_social_snapshots x WHERE x.label_id=s.label_id AND x.platform=s.platform AND x.kind='MY_ACCOUNT')`).bind(label).all()).results as any[]
  const last10 = posts.map(p => ({ platform: p.platform, title: p.title.slice(0, 120), url: p.url, postedAt: p.posted_at, metrics: JSON.parse(p.metrics_json || '{}') }))
  const views = last10.map(p => Number(p.metrics.views)).filter(Number.isFinite)
  const best = last10.filter(p => Number.isFinite(Number(p.metrics.views))).sort((a, b) => Number(b.metrics.views) - Number(a.metrics.views))[0] ?? null
  const ret = last10.map(p => Number(p.metrics.retention3s ?? p.metrics.retention)).filter(Number.isFinite)
  return { accounts: accts.map(a => ({ platform: a.platform, metrics: JSON.parse(a.metrics_json || '{}'), capturedAt: a.captured_at })), last10, avgViews: views.length ? Math.round(views.reduce((s, v) => s + v, 0) / views.length) : null, avgRetention: ret.length ? Math.round(10 * ret.reduce((s, v) => s + v, 0) / ret.length) / 10 : null, bestPost: best ? { title: best.title, views: Number(best.metrics.views), url: best.url } : null }
}
export async function getDossier(db: any, label: string, actor: number) {
  if (!await memberRole(db, label, actor)) throw new ServiceError('Label not found', 404)
  const id: any = await db.prepare('SELECT * FROM lw_label_identity WHERE label_id=?').bind(label).first()
  const facts = readFacts((await db.prepare('SELECT * FROM lw_artist_facts WHERE label_id=?').bind(label).all()).results)
  const links = (await db.prepare(`SELECT id,platform,url,handle,source,confidence,status,evidence,metrics_json FROM lw_artist_links WHERE label_id=? AND status<>'NOT_ME' ORDER BY status='CONFIRMED' DESC, CASE confidence WHEN 'STRONG' THEN 0 WHEN 'LIKELY' THEN 1 ELSE 2 END, platform LIMIT 60`).bind(label).all()).results.map((l: any) => ({ ...l, metrics: JSON.parse(l.metrics_json || '{}'), metrics_json: undefined }))
  const songs: any = await db.prepare(`SELECT COUNT(*) n FROM lw_catalog_tracks WHERE label_id=? AND pro_status<>'NOT_MINE'`).bind(label).first()
  const social = await socialSummary(db, label)
  // Completeness: owner/confirmed facts count fully, unconfirmed half. Plus identity, links, songs, analytics.
  const checks: [string, number, number][] = [['Artist name', 2, id?.artist_name ? 1 : 0], ['Legal name', 1, id?.legal_name ? 1 : 0], ['PRO', 1, id?.pro ? 1 : 0], ['Your profiles confirmed', 3, Math.min(1, links.filter((l: any) => l.status === 'CONFIRMED').length / 3)], ['Your songs', 2, (songs?.n ?? 0) > 0 ? 1 : 0], ['Your analytics', 2, social.accounts.length ? 1 : 0], ['Your last 10 posts', 2, Math.min(1, social.last10.length / 10)]]
  for (const f of FACTS) if (f.weight) checks.push([f.key, f.weight, facts[f.key] ? (facts[f.key].confirmed ? 1 : 0.5) : 0])
  const total = checks.reduce((s, c) => s + c[1], 0), have = checks.reduce((s, c) => s + c[1] * c[2], 0)
  const questions = FACTS.filter(f => f.q && (!facts[f.key] || !facts[f.key].confirmed)).map(f => ({ key: f.key, kind: f.kind, question: f.q!, suggested: facts[f.key]?.value ?? null }))
  const toConfirm = Object.entries(facts).filter(([, v]) => !v.confirmed).map(([k, v]) => ({ key: k, value: v.value, source: v.source, evidence: v.evidence }))
  const next: string[] = []
  if (!id) next.push('Tell us your artist name (Who I am).')
  if (id && !id.discovered_at) next.push('Find me everywhere (public music databases).')
  if (links.some((l: any) => l.status === 'SUGGESTED')) next.push(`Confirm which profiles are you (${links.filter((l: any) => l.status === 'SUGGESTED').length} waiting).`)
  if (questions.length) next.push(`Answer a few questions (${questions.length} left).`)
  if (!social.accounts.length) next.push('Let your agent read your analytics (read-only): Spotify for Artists, YouTube Studio, TikTok and Instagram insights, your distributor.')
  return {
    version: KNOW_ME_VERSION, completeness: Math.round(100 * have / total), discoveredAt: id?.discovered_at ?? null,
    identity: id ? { artistName: id.artist_name, legalName: id.legal_name, aliases: JSON.parse(id.aliases_json || '[]'), pro: id.pro, ipi: id.ipi, socials: JSON.parse(id.socials_json || '{}') } : null,
    facts, links, songs: songs?.n ?? 0, social, questions: questions.slice(0, 3), questionsLeft: questions.length, toConfirm, next,
    missing: checks.filter(c => c[2] < 1 && c[1] >= 2).map(c => c[0])
  }
}
/** Compact "who you're working for" note given to every agent task and employee chat (~1-2k chars). */
export async function artistBrief(db: any, label: string) {
  const id: any = await db.prepare('SELECT artist_name,legal_name,aliases_json,pro,discovered_at FROM lw_label_identity WHERE label_id=?').bind(label).first().catch(() => null)
  if (!id) return { known: false, note: 'The team does not know this artist yet. Ask their artist name and run guide know_me before advising.' }
  const rows = (await db.prepare('SELECT key,value_json,source,confirmed FROM lw_artist_facts WHERE label_id=?').bind(label).all().catch(() => ({ results: [] }))).results as any[]
  const f: Record<string, any> = {}; const unconfirmed: string[] = []
  for (const r of rows) { const v = JSON.parse(r.value_json); f[r.key] = typeof v === 'string' ? v.slice(0, 300) : v; if (!r.confirmed) unconfirmed.push(r.key) }
  const links = (await db.prepare(`SELECT platform,url FROM lw_artist_links WHERE label_id=? AND status='CONFIRMED' LIMIT 12`).bind(label).all().catch(() => ({ results: [] }))).results as any[]
  const s = await socialSummary(db, label).catch(() => null)
  return {
    known: true, artistName: id.artist_name, legalName: id.legal_name, aliases: JSON.parse(id.aliases_json || '[]'), pro: id.pro,
    facts: f, unconfirmed, profiles: links.map(l => `${l.platform}: ${l.url}`),
    analytics: s && (s.accounts.length || s.last10.length) ? { accounts: s.accounts.map(a => ({ platform: a.platform, ...a.metrics })), last10AvgViews: s.avgViews, last10AvgRetention: s.avgRetention, bestPost: s.bestPost } : 'not read yet',
    note: 'Unconfirmed facts came from public data or agent research; say "it looks like" until the owner confirms. Tailor every suggestion to these goals, sound and audience.'
  }
}
/** Engine: labels with a name but no public lookup yet (max 3 per pass), and a monthly KNOW_ARTIST agent task while the dossier is thin. */
export async function queueDiscovery(db: any, enqueue: (t: any) => Promise<boolean>, labelIds?: string[], lookup?: Lookup) {
  const scope = [labelIds ? 1 : null, JSON.stringify(labelIds ?? [])]
  let lookedUp = 0, queued = 0
  const fresh = (await db.prepare(`SELECT i.label_id,(SELECT user_id FROM lw_memberships m WHERE m.label_id=i.label_id AND m.role='owner' LIMIT 1) owner FROM lw_label_identity i WHERE i.discovered_at IS NULL AND (? IS NULL OR i.label_id IN (SELECT value FROM json_each(?))) LIMIT 3`).bind(...scope).all()).results as any[]
  for (const l of fresh) if (l.owner) { try { await discoverPublic(db, l.label_id, l.owner, lookup); lookedUp++ } catch { await db.prepare('UPDATE lw_label_identity SET discovered_at=CURRENT_TIMESTAMP WHERE label_id=?').bind(l.label_id).run() } }
  const all = (await db.prepare(`SELECT i.label_id,i.artist_name,(SELECT user_id FROM lw_memberships m WHERE m.label_id=i.label_id AND m.role='owner' LIMIT 1) owner FROM lw_label_identity i WHERE (? IS NULL OR i.label_id IN (SELECT value FROM json_each(?))) LIMIT 200`).bind(...scope).all()).results as any[]
  for (const l of all) {
    if (!l.owner) continue
    const dedupe = `know:${l.label_id}:${new Date().toISOString().slice(0, 7)}`
    if (await db.prepare('SELECT 1 FROM lw_tasks WHERE label_id=? AND dedupe_key=?').bind(l.label_id, dedupe).first()) continue
    const d = await getDossier(db, l.label_id, l.owner)
    if (d.completeness >= 85) continue
    if (await enqueue({ label: l.label_id, kind: 'KNOW_ARTIST', role: 'researcher', capability: 'ANY', title: `Get to know ${l.artist_name} (${d.completeness}% known)`, input: { completeness: d.completeness, missing: d.missing }, dedupe })) queued++
  }
  return { lookedUp, queued }
}
