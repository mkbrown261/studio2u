// Carla's trends: what's actually hot right now, from free public charts (no AI tokens).
//  - Deezer charts (overall + your lane: Rap/Hip-Hop 116, R&B 165, Pop 132, ...)
//  - Apple Music "Most Played" (US) and iTunes top songs per genre
//  - YouTube most-popular music videos (US) when the YouTube key is configured
// Songs on 2+ charts rank highest. Compilation/playlist channels are dropped. Every row keeps
// its chart, position, link and the date it was read. Emerging artists in your lane go to the
// watchlist automatically. Saved as a research report so Carla's chat and the Trends tab use it.
export type Fetch = (url: string, init?: RequestInit) => Promise<Response>
const getJson = async (f: Fetch, url: string, headers: Record<string, string> = {}) => { const r = await f(url, { headers: { Accept: 'application/json', 'User-Agent': 'Studio2U-LabelWorld/1.0', ...headers }, signal: AbortSignal.timeout(12000) }); if (!r.ok) throw new Error('source ' + r.status); return r.json() as any }
const norm = (s: string) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s*[([](feat|ft|with|prod)[^)\]]*[)\]]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
export const LANES: Record<string, { label: string; deezer: number; itunes: number; words: RegExp }> = {
  hiphop: { label: 'Hip-Hop/Rap', deezer: 116, itunes: 18, words: /(hip.?hop|rap|trap|drill|street)/i },
  rnb: { label: 'R&B', deezer: 165, itunes: 15, words: /(r&b|rnb|r and b|soul)/i },
  pop: { label: 'Pop', deezer: 132, itunes: 14, words: /\bpop\b/i },
  latin: { label: 'Latin', deezer: 122, itunes: 12, words: /(latin|reggaeton|latino)/i },
  country: { label: 'Country', deezer: 84, itunes: 6, words: /country/i },
  dance: { label: 'Dance/Electronic', deezer: 113, itunes: 17, words: /(dance|edm|electronic|house)/i }
}
export function lanesFor(text: string, genres: string[] = []) {
  const hay = `${text} ${genres.join(' ')}`
  const hit = Object.entries(LANES).filter(([, l]) => l.words.test(hay)).map(([k]) => k)
  return (hit.length ? hit : ['hiphop', 'rnb']).slice(0, 2)
}
export const TREND_INTENT = /(trend|trending|hot+est|what'?s hot|popping|viral|charts?\b|top songs|blowing up|what'?s (big|new|working)|what people (are )?listening)/i
const COMPILATION = /(\bbest\b.*\b(songs|music|hits|mix)|\bmix\b|playlist|compilation|non.?stop|\btop \d+|\b\d+ hours?\b|\bhits 20\d\d|music 20\d\d|\bfull album\b|lyrics? video compilation)/i

export type Row = { chart: string; source: 'deezer_chart' | 'apple_chart' | 'youtube_trending'; position: number; title: string; artist: string; url: string | null; releaseDate?: string | null; artistId?: string | null; views?: number | null; viewsPerDay?: number | null; channel?: string | null; genre?: string | null }
export type Trends = { readAt: string; lanes: string[]; rows: Row[]; songs: { title: string; artist: string; charts: string[]; best: number; url: string | null; score: number }[]; oldies: { title: string; artist: string; released: string | null }[]; hotArtists: { artist: string; charts: number; songs: number }[]; fresh: Row[]; youtube: Row[]; genres: [string, number][]; emerging: { artist: string; fans: number | null; chart: string; position: number; url: string | null }[]; failed: string[] }

export async function collectTrends(opts: { lanes: string[]; youtubeKey?: string | null; region?: string; fetcher?: Fetch }): Promise<Trends> {
  const f = opts.fetcher ?? fetch, rows: Row[] = [], failed: string[] = [], region = (opts.region ?? 'US').toUpperCase()
  const deezer = async (id: number, chart: string) => { try { const d = await getJson(f, `https://api.deezer.com/chart/${id}/tracks?limit=20`); (d?.data ?? []).forEach((t: any, i: number) => rows.push({ chart, source: 'deezer_chart', position: t.position ?? i + 1, title: t.title, artist: t.artist?.name ?? '', url: t.link ?? null, artistId: t.artist?.id ? String(t.artist.id) : null })) } catch { failed.push(chart) } }
  await deezer(0, 'Deezer Top')
  for (const l of opts.lanes) await deezer(LANES[l].deezer, `Deezer ${LANES[l].label}`)
  try {
    const d = await getJson(f, `https://rss.marketingtools.apple.com/api/v2/${region.toLowerCase()}/music/most-played/25/songs.json`)
    ;(d?.feed?.results ?? []).forEach((s: any, i: number) => rows.push({ chart: `Apple Music Top (${region})`, source: 'apple_chart', position: i + 1, title: s.name, artist: s.artistName, url: s.url ?? null, releaseDate: s.releaseDate ?? null, genre: (s.genres ?? []).map((g: any) => g.name).find((g: string) => g !== 'Music') ?? null }))
  } catch { failed.push('Apple Music Top') }
  for (const l of opts.lanes) {
    try {
      const d = await getJson(f, `https://itunes.apple.com/${region.toLowerCase()}/rss/topsongs/limit=20/genre=${LANES[l].itunes}/json`)
      ;(d?.feed?.entry ?? []).forEach((e: any, i: number) => rows.push({ chart: `iTunes ${LANES[l].label}`, source: 'apple_chart', position: i + 1, title: e['im:name']?.label ?? '', artist: e['im:artist']?.label ?? '', url: e.id?.label ?? null, releaseDate: e['im:releaseDate']?.label?.slice(0, 10) ?? null, genre: e.category?.attributes?.label ?? null }))
    } catch { failed.push(`iTunes ${LANES[l].label}`) }
  }
  if (opts.youtubeKey) {
    try {
      const d = await getJson(f, `https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({ part: 'snippet,statistics', chart: 'mostPopular', videoCategoryId: '10', regionCode: region, maxResults: '25' })}`, { 'X-Goog-Api-Key': opts.youtubeKey })
      let pos = 0
      for (const v of d?.items ?? []) {
        const title = String(v.snippet?.title ?? ''), channel = String(v.snippet?.channelTitle ?? '')
        if (COMPILATION.test(title) || COMPILATION.test(channel)) continue
        const views = Number(v.statistics?.viewCount ?? NaN), days = Math.max(1, (Date.now() - Date.parse(v.snippet?.publishedAt)) / 86400000)
        const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(title)
        rows.push({ chart: `YouTube Trending Music (${region})`, source: 'youtube_trending', position: ++pos, title: m ? m[2].replace(/\s*[([](official|music|lyric|audio|video|visualizer)[^)\]]*[)\]]/gi, '').trim() : title, artist: m ? m[1].trim() : channel.replace(/\s*-\s*Topic$|VEVO$/i, '').trim(), url: `https://www.youtube.com/watch?v=${v.id}`, views: Number.isFinite(views) ? views : null, viewsPerDay: Number.isFinite(views) ? Math.round(views / days) : null, channel, releaseDate: String(v.snippet?.publishedAt ?? '').slice(0, 10) || null })
      }
    } catch { failed.push('YouTube Trending') }
  }
  // Merge the same song across charts.
  const map = new Map<string, { title: string; artist: string; charts: string[]; best: number; url: string | null; score: number; released: string | null }>()
  for (const r of rows) {
    const lead = norm(r.artist).split(' ').slice(0, 2).join(' '), k = `${lead}|${norm(r.title)}`
    const cur = map.get(k) ?? { title: r.title, artist: r.artist, charts: [], best: 99, url: r.url, score: 0, released: null }
    if (!cur.charts.includes(r.chart)) cur.charts.push(r.chart)
    if (r.releaseDate && (!cur.released || r.releaseDate < cur.released)) cur.released = r.releaseDate
    cur.best = Math.min(cur.best, r.position); cur.score += Math.max(1, 26 - r.position); map.set(k, cur)
  }
  // Old songs back on the charts (Halloween, holidays, a viral moment) are not "what's new": shown separately.
  const oldCut = new Date(Date.now() - 2 * 365 * 86400000).toISOString().slice(0, 10)
  const all = [...map.values()].map(s => ({ ...s, catalog: Boolean(s.released && s.released < oldCut), score: s.score * s.charts.length })).sort((a, b) => b.score - a.score)
  const songs = all.filter(s => !s.catalog), oldies = all.filter(s => s.catalog).slice(0, 5)
  const byArtist = new Map<string, { artist: string; charts: Set<string>; songs: number }>()
  for (const s of songs) { const a = s.artist.split(/,|&| feat| x | and /i)[0].trim(); const k = norm(a); const cur = byArtist.get(k) ?? { artist: a, charts: new Set<string>(), songs: 0 }; s.charts.forEach(c => cur.charts.add(c)); cur.songs++; byArtist.set(k, cur) }
  const hotArtists = [...byArtist.values()].map(a => ({ artist: a.artist, charts: a.charts.size, songs: a.songs })).sort((a, b) => b.charts - a.charts || b.songs - a.songs).slice(0, 10)
  const cutoff = Date.now() - 21 * 86400000
  const fresh = rows.filter(r => r.source === 'apple_chart' && r.releaseDate && Date.parse(r.releaseDate) >= cutoff).sort((a, b) => a.position - b.position).filter((r, i, all) => all.findIndex(x => norm(x.title) === norm(r.title)) === i).slice(0, 6)
  const youtube = rows.filter(r => r.source === 'youtube_trending').sort((a, b) => (b.viewsPerDay ?? 0) - (a.viewsPerDay ?? 0)).slice(0, 5)
  const g = new Map<string, number>(); for (const r of rows) if (r.genre) g.set(r.genre, (g.get(r.genre) ?? 0) + 1)
  const genres = [...g.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  // Emerging: on your lane's Deezer chart, not on the overall chart, and under 2M fans.
  const overall = new Set(rows.filter(r => r.chart === 'Deezer Top').map(r => norm(r.artist)))
  const laneRows = rows.filter(r => r.source === 'deezer_chart' && r.chart !== 'Deezer Top' && r.artistId && !overall.has(norm(r.artist)))
  const emerging: Trends['emerging'] = []
  for (const r of laneRows.filter((r, i, all) => all.findIndex(x => x.artistId === r.artistId) === i).slice(0, 8)) {
    const a = await getJson(f, `https://api.deezer.com/artist/${r.artistId}`).catch(() => null)
    const fans = Number.isFinite(a?.nb_fan) ? a.nb_fan : null
    if (fans != null && fans < 600_000) emerging.push({ artist: r.artist, fans, chart: r.chart, position: r.position, url: a?.link ?? null })
    if (emerging.length >= 5) break
  }
  return { readAt: new Date().toISOString(), lanes: opts.lanes, rows, songs: songs.slice(0, 15), oldies: oldies.map(o => ({ title: o.title, artist: o.artist, released: o.released })), hotArtists, fresh, youtube, genres, emerging, failed }
}

const k = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n)
/** Carla's plain-English answer. */
export function sayTrends(t: Trends, me: { artist: string | null; lanes: string[] }) {
  const day = new Date(t.readAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const L: string[] = [`Here's what's hot right now (${day}, from ${[...new Set(t.rows.map(r => r.chart.split(' (')[0].replace(/ (Hip-Hop\/Rap|R&B|Pop|Latin|Country|Dance\/Electronic)$/, '')))].join(', ')}):`]
  t.songs.slice(0, 8).forEach((s, i) => L.push(`${i + 1}. ${s.artist} – ${s.title}${s.charts.length > 1 ? ` (on ${s.charts.length} charts, best #${s.best})` : ` (#${s.best} ${s.charts[0]})`}`))
  const multi = t.hotArtists.filter(a => a.charts >= 3)
  if (multi.length) L.push('', `Everywhere at once: ${multi.slice(0, 5).map(a => a.artist).join(', ')}.`)
  const lane = t.songs.filter(s => s.charts.some(c => me.lanes.some(l => c.includes(LANES[l].label)))).slice(0, 5)
  if (lane.length) L.push('', `In your lane (${me.lanes.map(l => LANES[l].label).join(' + ')}): ${lane.map(s => `${s.artist} – ${s.title}`).join('; ')}.`)
  if (t.fresh.length) L.push('', `New this month and already charting: ${t.fresh.slice(0, 4).map(r => `${r.artist} – ${r.title}`).join('; ')}.`)
  if (t.youtube.length) L.push('', `Fastest on YouTube: ${t.youtube.slice(0, 3).map(r => `${r.artist} – ${r.title} (${k(r.viewsPerDay ?? 0)} views/day)`).join('; ')}.`)
  if (t.oldies?.length) L.push('', `Older songs back on the charts (seasonal or a viral moment, not new trends): ${t.oldies.slice(0, 3).map(o => `${o.artist} – ${o.title}${o.released ? ` (${o.released.slice(0, 4)})` : ''}`).join('; ')}.`)
  if (t.genres.length) L.push('', `Most-charting styles: ${t.genres.slice(0, 3).map(([g, n]) => `${g} (${n})`).join(', ')}.`)
  if (t.emerging.length) L.push('', `Rising artists I added to your watchlist: ${t.emerging.map(e => `${e.artist} (${k(e.fans ?? 0)} fans, #${e.position} ${e.chart.replace('Deezer ', '')})`).join(', ')}.`)
  L.push('', 'What this means for you:')
  if (lane.length) L.push(`• Study the top ${LANES[me.lanes[0]].label} records above: tempo, hook in the first 10 seconds, and how they're being clipped on TikTok/Reels.`)
  if (t.fresh.length) L.push('• New songs are breaking through within weeks, so a release now can still catch this wave.')
  L.push(`• I can't see TikTok sound trends from here. Your agent can read TikTok Creative Center on screen (read-only) if you want sounds too.`)
  if (t.failed.length) L.push('', `(Didn't answer this time: ${t.failed.join(', ')}.)`)
  return L.join('\n')
}

/** Run, save as a research report (Trends tab + Carla's context), fill the watchlist, reply. Cached for 60 minutes. */
export async function runTrends(env: any, label: string, actor: number, opts: { text?: string; fetcher?: Fetch; replyTo?: string | null; agent?: string } = {}) {
  const db = env.DB
  const recent: any = await db.prepare("SELECT id,query_json FROM lw_research_reports WHERE label_id=? AND source='trends' AND observed_at>=? ORDER BY observed_at DESC LIMIT 1").bind(label, new Date(Date.now() - 3600000).toISOString()).first()
  let summary: string, reportId: string, watch = 0
  if (recent) { const q = JSON.parse(recent.query_json); summary = q.summary; reportId = recent.id }
  else {
    const id: any = await db.prepare('SELECT artist_name FROM lw_label_identity WHERE label_id=?').bind(label).first()
    const facts = (await db.prepare("SELECT value_json FROM lw_artist_facts WHERE label_id=? AND key='genres'").bind(label).first().catch(() => null)) as any
    const genres: string[] = facts ? JSON.parse(facts.value_json) : []
    const links = (await db.prepare("SELECT evidence FROM lw_artist_links WHERE label_id=? AND platform='apple_music' AND status<>'NOT_ME' LIMIT 3").bind(label).all().catch(() => ({ results: [] }))).results as any[]
    const lanes = lanesFor(opts.text ?? '', [...genres, ...links.map(l => String(l.evidence ?? ''))])
    // YouTube quota guard (shared with manual searches).
    let ytKey: string | null = env.YOUTUBE_DATA_API_KEY ?? null
    if (ytKey) { const dayKey = new Date().toISOString().slice(0, 10); const ok = await db.prepare("INSERT INTO lw_source_limits(scope,day,requests) VALUES (?,?,1) ON CONFLICT(scope,day) DO UPDATE SET requests=requests+1 WHERE requests<? RETURNING requests").bind('youtube:' + label, dayKey, 8).first().catch(() => null); if (!ok) ytKey = null }
    const t = await collectTrends({ lanes, youtubeKey: ytKey, fetcher: opts.fetcher })
    if (!t.rows.length) throw new Error('No chart answered. Try again in a few minutes.')
    summary = sayTrends(t, { artist: id?.artist_name ?? null, lanes })
    reportId = crypto.randomUUID()
    const task = crypto.randomUUID(), now = t.readAt, expires = new Date(Date.now() + 28 * 86400000).toISOString()
    const content = JSON.stringify({ schemaVersion: 1, reportId, source: 'trends', observedAt: now, expiresAt: expires, lanes, rows: t.rows, songs: t.songs, emerging: t.emerging, failed: t.failed, limitations: ['Public chart positions and YouTube public view counts on the read date. Charts measure plays/sales on those services, not TikTok usage.'] }, null, 2)
    const bytes = new TextEncoder().encode(content), key = `label-world/youtube/${label}/${reportId}.json`
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('')
    if (env.R2) await env.R2.put(key, bytes, { httpMetadata: { contentType: 'application/json' } })
    const obs = t.rows.slice(0, 80).map(r => ({ id: crypto.randomUUID(), source: r.source, sourceId: null, channelId: null, creator: r.channel ?? r.chart, artist: r.artist, track: r.title, sourceUrl: r.url ?? 'https://www.deezer.com', publishedAt: r.releaseDate ?? null, observedAt: now, period: r.chart, metrics: { position: r.position, chart: r.chart, ...(r.views != null ? { views: String(r.views), viewsPerDay: r.viewsPerDay } : {}) }, status: 'COLLECTED' }))
    await db.batch([
      db.prepare("INSERT INTO lw_tasks(id,label_id,agent_role,status,input_json,kind,title) VALUES (?,?,'researcher','COMPLETED',?,'GENERIC','Trends')").bind(task, label, JSON.stringify({ userId: actor, kind: 'TRENDS' })),
      db.prepare('INSERT INTO lw_research_reports(id,label_id,user_id,task_id,source,object_key,sha256,byte_size,query_json,observed_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(reportId, label, actor, task, 'trends', key, hash, bytes.length, JSON.stringify({ query: 'What\'s hot right now', lanes, collected: obs.length, duplicates: 0, summary }), now, expires),
      db.prepare("INSERT INTO lw_source_observations(id,label_id,report_id,source,source_id,channel_id,creator,artist,track,source_url,published_at,observed_at,period,metrics_json,status) SELECT json_extract(value,'$.id'),?,?,json_extract(value,'$.source'),NULL,NULL,json_extract(value,'$.creator'),json_extract(value,'$.artist'),json_extract(value,'$.track'),json_extract(value,'$.sourceUrl'),json_extract(value,'$.publishedAt'),json_extract(value,'$.observedAt'),json_extract(value,'$.period'),json_extract(value,'$.metrics'),'COLLECTED' FROM json_each(?)").bind(label, reportId, JSON.stringify(obs))
    ])
    for (const e of t.emerging) {
      if (await db.prepare("SELECT 1 FROM lw_research_records WHERE label_id=? AND kind='watchlist' AND lower(title)=lower(?)").bind(label, e.artist).first()) continue
      await db.prepare("INSERT INTO lw_research_records(id,label_id,kind,title,content,source_url,created_by) VALUES (?,?,'watchlist',?,?,?,?)").bind(crypto.randomUUID(), label, e.artist, `Rising: #${e.position} on ${e.chart}${e.fans != null ? `, ${e.fans.toLocaleString()} Deezer fans` : ''} (read ${now.slice(0, 10)}). Added by Carla.`, e.url, actor).run(); watch++
    }
  }
  const agent = opts.agent ?? 'researcher'
  await db.prepare("INSERT INTO lw_employee_messages(id,label_id,user_id,agent_id,role,content,status,reply_to,research_report_id,provider,model) VALUES (?,?,?,?,'assistant',?,'COMPLETED',?,?,'studio2u','charts')").bind(crypto.randomUUID(), label, actor, agent, summary, opts.replyTo ?? null, reportId).run()
  if (opts.replyTo) await db.prepare("UPDATE lw_employee_messages SET status='COMPLETED' WHERE id=? AND label_id=?").bind(opts.replyTo, label).run()
  return { reportId, summary, watchlistAdded: watch, cached: Boolean(recent) }
}

/** Engine: once a day per label, refresh trends and answer any unanswered "what's hot" questions to Carla. */
export async function dailyTrends(env: any, labelIds?: string[], fetcher?: Fetch, limit = 5) {
  const db = env.DB, today = new Date().toISOString().slice(0, 10)
  const labels = (await db.prepare(`SELECT i.label_id,(SELECT user_id FROM lw_memberships m WHERE m.label_id=i.label_id AND m.role='owner' LIMIT 1) owner FROM lw_label_identity i
     WHERE (? IS NULL OR i.label_id IN (SELECT value FROM json_each(?)))
       AND NOT EXISTS (SELECT 1 FROM lw_research_reports r WHERE r.label_id=i.label_id AND r.source='trends' AND substr(r.observed_at,1,10)=?) LIMIT ?`).bind(labelIds ? 1 : null, JSON.stringify(labelIds ?? []), today, limit).all()).results as any[]
  let ran = 0, answered = 0
  for (const l of labels) {
    if (!l.owner) continue
    const waiting = (await db.prepare("SELECT id,user_id,content FROM lw_employee_messages m WHERE label_id=? AND agent_id='researcher' AND role='user' AND status IN ('WAITING_FOR_PROVIDER','FAILED') AND NOT EXISTS (SELECT 1 FROM lw_employee_messages a WHERE a.reply_to=m.id) ORDER BY created_at DESC LIMIT 3").bind(l.label_id).all()).results as any[]
    const ask = waiting.find(w => TREND_INTENT.test(w.content))
    try { await runTrends(env, l.label_id, ask?.user_id ?? l.owner, { text: ask?.content ?? '', fetcher, replyTo: ask?.id ?? null }); ran++; if (ask) answered++ } catch { /* try again next pass */ }
  }
  return { ran, answered }
}
