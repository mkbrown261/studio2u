// "Know me": find the artist everywhere from free public sources, no AI tokens.
//  - Deezer: profile, fans, releases, photo, top songs, similar artists
//  - Apple Music (iTunes Search): profile + genre
//  - MusicBrainz: official links (Spotify, Instagram, TikTok, YouTube, X, website), home area, genres
//  - Spotify public artist page: monthly listeners (only the number shown publicly)
// Every fact keeps its source link and the date it was read. Ambiguous names are NOT
// guessed: we return candidates and the owner taps the one that is them.
// Logged-in analytics (TikTok Studio, Instagram Insights, Spotify for Artists, last 10 posts,
// retention) need the owner's own screen: queued as a KNOW_ME task for their agent.
import { ServiceError, memberRole, requireEditor } from './service'

export type Fetcher = (url: string, opts?: { text?: boolean }) => Promise<any>
const UA = 'Studio2U-LabelWorld/1.0 (+https://studio2u.pages.dev)'
const defaultFetch: Fetcher = async (url, opts) => {
  const r = await fetch(url, { headers: { Accept: opts?.text ? 'text/html' : 'application/json', 'User-Agent': opts?.text ? 'Mozilla/5.0 (compatible; Studio2U/1.0)' : UA } })
  if (!r.ok) throw new Error('lookup failed')
  return opts?.text ? (await r.text()).slice(0, 400000) : r.json()
}
const norm = (s: string) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim()
const today = () => new Date().toISOString().slice(0, 10)
const SOCIAL: [RegExp, string][] = [
  [/open\.spotify\.com\/artist\/([A-Za-z0-9]{22})/, 'spotify'], [/instagram\.com\/([A-Za-z0-9_.]{1,40})/, 'instagram'], [/tiktok\.com\/@([A-Za-z0-9_.]{1,40})/, 'tiktok'],
  [/(?:youtube\.com\/(?:channel\/|c\/|user\/|@)|youtu\.be\/)([A-Za-z0-9_@.-]{2,60})/, 'youtube'], [/(?:twitter|x)\.com\/([A-Za-z0-9_]{1,30})/, 'x'], [/soundcloud\.com\/([A-Za-z0-9_-]{1,60})/, 'soundcloud'],
  [/music\.apple\.com\/.*artist\/[^/]*\/?(\d+)/, 'appleMusic'], [/facebook\.com\/([A-Za-z0-9_.-]{2,60})/, 'facebook'], [/genius\.com\/artists\/([A-Za-z0-9_-]+)/, 'genius']
]

export type Candidate = { key: string; name: string; picture: string | null; fans: number | null; releases: number | null; deezerId: string | null; link: string | null; exact: boolean; topSong: string | null }
export type Discovery = {
  version: 1; readAt: string; name: string; confirmedDeezerId: string | null
  photo: string | null; fans: number | null; releases: number | null; genres: string[]; area: string | null; activeSince: string | null
  monthlyListeners: number | null; links: Record<string, string>; topSongs: { title: string; link: string | null; rank: number | null }[]
  similar: { name: string; link: string | null; fans: number | null }[]
  sources: { what: string; url: string; readAt: string }[]
  needsScreen: string[]; summary: string
}

/** Candidates for "is this you?" (owner taps one). */
export async function findCandidates(name: string, fetcher: Fetcher = defaultFetch): Promise<Candidate[]> {
  const q = String(name ?? '').trim().slice(0, 120); if (!q) throw new ServiceError('Artist name required')
  const d = await fetcher(`https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=6`).catch(() => null)
  const out: Candidate[] = []
  for (const a of d?.data ?? []) out.push({ key: 'deezer:' + a.id, name: a.name, picture: a.picture_medium ?? null, fans: a.nb_fan ?? null, releases: a.nb_album ?? null, deezerId: String(a.id), link: a.link ?? null, exact: norm(a.name) === norm(q), topSong: null })
  // A short "known for" helps tell same-name artists apart.
  for (const c of out.slice(0, 4)) { const t = await fetcher(`https://api.deezer.com/artist/${c.deezerId}/top?limit=1`).catch(() => null); c.topSong = t?.data?.[0]?.title ?? null }
  return out.sort((a, b) => Number(b.exact) - Number(a.exact) || (b.fans ?? 0) - (a.fans ?? 0))
}

/** Read everything public about one confirmed artist. */
export async function discoverArtist(input: { name: string; deezerId?: string | null; spotifyId?: string | null; appleId?: string | null; aliases?: string[] }, fetcher: Fetcher = defaultFetch): Promise<Discovery> {
  const at = today(), sources: Discovery['sources'] = [], links: Record<string, string> = {}
  const src = (what: string, url: string) => sources.push({ what, url, readAt: at })
  let deezerId = input.deezerId && /^\d{1,20}$/.test(input.deezerId) ? input.deezerId : null
  let name = input.name, photo: string | null = null, fans: number | null = null, releases: number | null = null
  const genres = new Set<string>(); let area: string | null = null, activeSince: string | null = null, monthlyListeners: number | null = null
  const topSongs: Discovery['topSongs'] = [], similar: Discovery['similar'] = []
  if (!deezerId) { const c = await findCandidates(name, fetcher).catch(() => []); const exact = c.filter(x => x.exact); if (exact.length === 1) deezerId = exact[0].deezerId }
  if (deezerId) {
    const a = await fetcher(`https://api.deezer.com/artist/${deezerId}`).catch(() => null)
    if (a?.id) { name = a.name ?? name; photo = a.picture_xl ?? a.picture_big ?? null; fans = a.nb_fan ?? null; releases = a.nb_album ?? null; links.deezer = a.link; src('Deezer profile (fans, releases, photo)', a.link) }
    const top = await fetcher(`https://api.deezer.com/artist/${deezerId}/top?limit=10`).catch(() => null)
    for (const t of top?.data ?? []) topSongs.push({ title: t.title, link: t.link ?? null, rank: t.rank ?? null })
    const rel = await fetcher(`https://api.deezer.com/artist/${deezerId}/related?limit=12`).catch(() => null)
    for (const r of rel?.data ?? []) similar.push({ name: r.name, link: r.link ?? null, fans: r.nb_fan ?? null })
    if (rel?.data?.length) src('Deezer similar artists', `https://www.deezer.com/artist/${deezerId}/related_artist`)
  }
  // Apple Music
  const it = await fetcher(`https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=5`).catch(() => null)
  const apple = (it?.results ?? []).find((x: any) => input.appleId ? String(x.artistId) === input.appleId : norm(x.artistName) === norm(name))
  if (apple) { links.appleMusic = apple.artistLinkUrl; if (apple.primaryGenreName) genres.add(apple.primaryGenreName); src('Apple Music profile', apple.artistLinkUrl) }
  // MusicBrainz: official links. Find the MB artist through the Deezer URL first (exact), else by exact name.
  let mbid: string | null = null
  if (links.deezer) { const u = await fetcher(`https://musicbrainz.org/ws/2/url?resource=${encodeURIComponent(links.deezer.replace('http://', 'https://'))}&inc=artist-rels&fmt=json`).catch(() => null); mbid = u?.relations?.find((r: any) => r.artist)?.artist?.id ?? null }
  if (!mbid) { const s = await fetcher(`https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(`artist:"${name}"`)}&limit=3&fmt=json`).catch(() => null); const ex = (s?.artists ?? []).filter((x: any) => norm(x.name) === norm(name) && x.score >= 95); if (ex.length === 1) mbid = ex[0].id }
  if (mbid) {
    const mb = await fetcher(`https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels+genres&fmt=json`).catch(() => null)
    if (mb?.id) {
      for (const r of mb.relations ?? []) { const url = r?.url?.resource; if (!url) continue; for (const [re, k] of SOCIAL) if (re.test(url) && !links[k]) links[k] = url; if (r.type === 'official homepage' && !links.website) links.website = url }
      for (const g of mb.genres ?? []) if (g?.name) genres.add(g.name)
      area = mb.area?.name ?? mb['begin-area']?.name ?? null; activeSince = mb['life-span']?.begin ?? null
      src('MusicBrainz (official links, area, genres)', `https://musicbrainz.org/artist/${mbid}`)
    }
  }
  const spotifyId = input.spotifyId ?? (links.spotify ? /artist\/([A-Za-z0-9]{22})/.exec(links.spotify)?.[1] ?? null : null)
  if (spotifyId) {
    const url = `https://open.spotify.com/artist/${spotifyId}`; links.spotify = url
    const html: string = await fetcher(url, { text: true }).catch(() => '')
    const m = /og:description" content="[^"]*?([\d.,]+)\s*([KMB]?)\s*monthly listeners/i.exec(html)
    if (m) { const n = parseFloat(m[1].replace(/,/g, '')) * ({ K: 1e3, M: 1e6, B: 1e9 } as any)[m[2].toUpperCase() || 'X'] || parseFloat(m[1].replace(/,/g, '')); monthlyListeners = Math.round(n); src('Spotify public page (monthly listeners)', url) }
  }
  const needsScreen = [
    !links.instagram ? 'Instagram handle (not listed publicly)' : null, !links.tiktok ? 'TikTok handle (not listed publicly)' : null, !links.spotify ? 'Spotify artist link' : null,
    'Last 10 posts on TikTok/Instagram/YouTube with views, avg watch time, where people drop off (your agent reads your own logged-in analytics, read-only)',
    'Spotify for Artists: listeners by city, top songs by streams, saves'
  ].filter(Boolean) as string[]
  const fmt = (n: number | null) => n == null ? null : n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K` : String(n)
  const bits = [monthlyListeners != null ? `${fmt(monthlyListeners)} monthly listeners on Spotify` : null, fans != null ? `${fmt(fans)} Deezer fans` : null, releases != null ? `${releases} releases` : null, genres.size ? [...genres].slice(0, 3).join(', ') : null, area ? `from ${area}` : null].filter(Boolean)
  return {
    version: 1, readAt: at, name, confirmedDeezerId: deezerId, photo, fans, releases, genres: [...genres].slice(0, 8), area, activeSince, monthlyListeners, links, topSongs, similar: similar.slice(0, 12), sources, needsScreen,
    summary: `${name}${bits.length ? ': ' + bits.join(' · ') : ''}. Found on ${Object.keys(links).length} platform${Object.keys(links).length === 1 ? '' : 's'}.`
  }
}

/** Run discovery for a label, save it, fill Carla's watchlist with similar artists, queue the screen read. */
export async function runDiscovery(db: any, label: string, actor: number | null, b: { deezerId?: string | null } = {}, fetcher: Fetcher = defaultFetch, enqueue?: (t: any) => Promise<boolean>) {
  if (actor != null) await requireEditor(db, label, actor)
  const row: any = await db.prepare('SELECT artist_name,aliases_json,spotify_artist_id,apple_artist_id,socials_json,discovery_json FROM lw_label_identity WHERE label_id=?').bind(label).first()
  if (!row) throw new ServiceError('Tell us your artist name first', 409)
  const prev = JSON.parse(row.discovery_json || '{}')
  if (b.deezerId != null && !/^\d{1,20}$/.test(String(b.deezerId))) throw new ServiceError('deezerId invalid')
  const d = await discoverArtist({ name: row.artist_name, deezerId: b.deezerId ?? prev.confirmedDeezerId ?? null, spotifyId: row.spotify_artist_id, appleId: row.apple_artist_id, aliases: JSON.parse(row.aliases_json || '[]') }, fetcher)
  // Owner-entered socials always win; fill blanks from what we found.
  const socials = JSON.parse(row.socials_json || '{}'); for (const k of ['instagram', 'tiktok', 'youtube', 'spotify', 'appleMusic', 'x']) if (!socials[k] && d.links[k]) socials[k] = d.links[k]
  const spotifyId = d.links.spotify ? /artist\/([A-Za-z0-9]{22})/.exec(d.links.spotify)?.[1] ?? null : null
  await db.batch([
    db.prepare('UPDATE lw_label_identity SET discovery_json=?,discovered_at=CURRENT_TIMESTAMP,socials_json=?,spotify_artist_id=COALESCE(spotify_artist_id,?),updated_at=CURRENT_TIMESTAMP WHERE label_id=?').bind(JSON.stringify(d), JSON.stringify(socials), spotifyId, label),
    db.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, actor, 'identity.discovered', JSON.stringify({ sources: d.sources.length, links: Object.keys(d.links) }))
  ])
  // Carla's watchlist: similar artists, added once each, with the source link.
  let watch = 0
  const owner: any = actor ?? (await db.prepare("SELECT user_id FROM lw_memberships WHERE label_id=? AND role='owner' LIMIT 1").bind(label).first())?.user_id
  if (owner) for (const s of d.similar.slice(0, 8)) {
    const exists = await db.prepare("SELECT 1 FROM lw_research_records WHERE label_id=? AND kind='watchlist' AND lower(title)=lower(?)").bind(label, s.name).first()
    if (exists) continue
    await db.prepare("INSERT INTO lw_research_records(id,label_id,kind,title,content,source_url,created_by) VALUES (?,?,'watchlist',?,?,?,?)").bind(crypto.randomUUID(), label, s.name, `Similar to ${d.name} (Deezer related artists${s.fans != null ? `, ${s.fans} fans` : ''}, read ${d.readAt}). Added by Carla.`, s.link, owner).run(); watch++
  }
  let queued = false
  if (enqueue) queued = await enqueue({ label, kind: 'KNOW_ME', role: 'researcher', capability: 'SCREEN_CONTROL', title: `Get to know ${d.name}: read your socials + analytics (read-only)`, input: { mode: 'SCREEN', links: d.links }, dedupe: `knowme:${label}:${new Date().toISOString().slice(0, 7)}` }).catch(() => false)
  return { discovery: d, watchlistAdded: watch, screenTaskQueued: queued }
}

export async function getKnowMe(db: any, label: string, actor: number) {
  if (!await memberRole(db, label, actor)) throw new ServiceError('Label not found', 404)
  const row: any = await db.prepare('SELECT artist_name,discovery_json,discovered_at FROM lw_label_identity WHERE label_id=?').bind(label).first()
  if (!row) return { status: 'NO_IDENTITY', discovery: null, snapshots: [] }
  const snaps = (await db.prepare("SELECT platform,kind,title,url,posted_at,metrics_json,captured_at FROM lw_social_snapshots WHERE label_id=? AND kind IN ('MY_POST','MY_ACCOUNT') ORDER BY captured_at DESC LIMIT 30").bind(label).all()).results.map((s: any) => ({ ...s, metrics: JSON.parse(s.metrics_json || '{}'), metrics_json: undefined }))
  const d = JSON.parse(row.discovery_json || '{}')
  return { status: d.version ? 'FOUND' : 'NOT_RUN', artistName: row.artist_name, discoveredAt: row.discovered_at, discovery: d.version ? d : null, snapshots: snaps }
}

/** Compact profile every agent reads first (kept tiny for token cost). */
export function knowMeBrief(d: any, artist: string) {
  if (!d?.version) return { artist, known: false, note: 'Discovery not run yet. Run find_me_everywhere first.' }
  return { artist: d.name, known: true, summary: d.summary, genres: d.genres, area: d.area, monthlyListeners: d.monthlyListeners, fans: d.fans, links: d.links, topSongs: d.topSongs.slice(0, 5).map((t: any) => t.title), similar: d.similar.slice(0, 5).map((s: any) => s.name), readAt: d.readAt, stillUnknown: d.needsScreen }
}

/** Engine: labels with an identity but no (or stale, >14 days) discovery. Bounded. */
export async function staleDiscoveries(db: any, labelIds?: string[], limit = 3) {
  return ((await db.prepare(`SELECT label_id FROM lw_label_identity WHERE (discovered_at IS NULL OR discovered_at<datetime('now','-14 days')) AND (? IS NULL OR label_id IN (SELECT value FROM json_each(?))) LIMIT ?`).bind(labelIds ? 1 : null, JSON.stringify(labelIds ?? []), limit).all()).results as any[]).map(r => r.label_id as string)
}
