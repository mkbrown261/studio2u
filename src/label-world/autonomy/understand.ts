// Plain-language case intake. The owner talks; we fill the boxes.
// "my song 22 was on Baddies, the episode they went to Hawaii" ->
//   show Baddies Midwest, network Zeus, S1E19 "Aloha!" aired 2025-03-02, song 22.
// Free public lookups only (TVmaze for TV, the label's own catalog for songs). No AI tokens.
// Every guess carries its source so the owner can confirm in one word.
import { suggestPlaybooks, playbookById } from './playbooks'

export type Fetcher = (url: string) => Promise<any>
export type Found = { key: string; label: string; value: string; how: string; source?: string }
export type Understood = { playbook: string | null; facts: Record<string, any>; found: Found[]; confirm: string[]; ask: { key: string; question: string }[]; options?: string[] }

const defaultFetch: Fetcher = async url => { const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Studio2U-LabelWorld/1.0 (+https://studio2u.pages.dev)' } }); if (!r.ok) throw new Error('lookup failed'); return r.json() }
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim()
const STOP = new Set('the a an to of and in on at it its they them their there was were is be been went go going gone got get my me i we our us with for from that this these those when where episode ep season part show one who what which had have has did do does just like about some all into out up down over back first last time day night trip cast girls guys baddies'.split(' '))
const NETWORKS = ['Zeus', 'Netflix', 'Hulu', 'HBO', 'Max', 'Peacock', 'Prime Video', 'Amazon', 'Tubi', 'BET', 'BET+', 'VH1', 'MTV', 'Bravo', 'Oxygen', 'Fox', 'ABC', 'NBC', 'CBS', 'Starz', 'Showtime', 'Paramount+', 'TLC', 'Lifetime', 'WE tv', 'OWN', 'Apple TV+', 'Disney+', 'YouTube', 'Freeform', 'FX', 'AMC', 'E!']
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/** Pieces of a sentence that might be a show name: "on Baddies", "in Power Book II", quoted text. */
export function showCandidates(text: string, exclude: string[] = []) {
  const out: string[] = [], ex = exclude.map(norm)
  const push = (p: string) => { p = p.replace(/^(?:the|a|an)\s+/i, '').replace(/['’]s$/i, '').trim(); const n = norm(p); if (n.length >= 2 && p.split(/\s+/).length <= 6 && !ex.includes(n) && !/^(tv|television|a show|the show|tv show|my song|it|there|here|youtube|netflix|hulu|zeus|cable)$/i.test(p) && !out.some(o => norm(o) === n)) out.push(p) }
  for (const m of text.matchAll(/["“]([^"”]{2,60})["”]/g)) push(m[1])
  for (const m of text.matchAll(/\b(?:on|in|aired on|played on|used on|featured on|placed on|watching|show called|show named|show)\s+([^,.;!?\n()]{2,70})/gi)) {
    const head = m[1].split(/\s+(?:the episode|an episode|episode|ep\b|eps\b|season|seasons|s\d|when|where|and|but|on|at|that|which|last|this|back|around|during|from|for|like|with|it|they|i|my|was|were|aired|in \d{4})\b/i)[0]
    push(head)
  }
  return out.slice(0, 3)
}
export function episodeHints(text: string) {
  const se = /\bs(?:eason)?\s*(\d{1,2})\s*[,.\-x ]*\s*e(?:p(?:isode)?)?\.?\s*(\d{1,3})\b/i.exec(text)
  const words = new Set<string>()
  for (const m of text.matchAll(/\b(?:episode|ep\.?|the one)\s+(?:where|when|that|they|with)?\s*([^,.;!?\n]{2,80})/gi)) for (const w of norm(m[1]).split(' ')) if (w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)) words.add(w)
  for (const m of text.matchAll(/\b([A-Za-z][A-Za-z'-]{2,})\s+(?:episode|ep)\b/gi)) { const w = norm(m[1]); if (!STOP.has(w) && !['that', 'this', 'an', 'which', 'what', 'one', 'last', 'first', 'new', 'season', 'same'].includes(w)) words.add(w) }
  for (const m of text.matchAll(/\b(?:went to|go to|trip to|in|at)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/g)) for (const w of norm(m[1]).split(' ')) if (w.length >= 3 && !STOP.has(w)) words.add(w)
  return { season: se ? Number(se[1]) : null, number: se ? Number(se[2]) : null, words: [...words].slice(0, 6) }
}
export function networkHint(text: string) { for (const n of NETWORKS) if (new RegExp(`(^|[^a-z])${n.replace(/[+!]/g, '\\$&')}($|[^a-z])`, 'i').test(text)) return n; return null }
export function monthYear(text: string) {
  const iso = /\b(20\d{2}|19\d{2})-(0[1-9]|1[0-2])(?:-(\d{2}))?\b/.exec(text); if (iso) return iso[3] ? `${iso[1]}-${iso[2]}-${iso[3]}` : `${iso[1]}-${iso[2]}`
  const m = new RegExp(`\\b(${MONTHS.join('|')}|${MONTHS.map(x => x.slice(0, 3)).join('|')})\\.?\\s+(?:of\\s+)?(\\d{4})\\b`, 'i').exec(text)
  if (m) { const i = MONTHS.findIndex(x => x.startsWith(m[1].toLowerCase().slice(0, 3))); return `${m[2]}-${String(i + 1).padStart(2, '0')}` }
  return null
}
export function howUsed(text: string) {
  const t = text.toLowerCase()
  if (/\b(sang|singing|sung|performed|performing|perform|lip ?sync)/.test(t)) return 'Performed / sung on screen'
  if (/\b(theme|intro|opening)\b/.test(t)) return 'Theme / opening'
  if (/\b(trailer|promo|commercial|teaser|\bad\b)/.test(t)) return 'Trailer / promo'
  if (/\b(end credits|credits|outro)\b/.test(t)) return 'End credits'
  if (/\b(background|in the back|playing while|played while|at the party|in the club|in the car|during the scene|in a scene)\b/.test(t)) return 'Background'
  return null
}
export function licenseNote(text: string) {
  const t = text.toLowerCase()
  if (/(never signed|didn'?t sign|did not sign|no (sync )?licen[cs]e|nobody (asked|contacted|reached)|no one (asked|contacted|reached)|without (my )?permission|never asked|never contacted|never got paid|not paid|didn'?t get paid)/.test(t)) return 'No license signed and no upfront fee (per owner)'
  if (/(signed a|sync (fee|license|deal)|got paid upfront|upfront fee|they paid me|licensed it)/.test(t)) return text.trim().slice(0, 300)
  return null
}
export function writersFrom(text: string, me: { name: string; pro: string | null }) {
  const t = text.toLowerCase()
  if (/(just me|only me|all me|i wrote it (all|alone|myself|by myself)|wrote it myself|by myself|100 ?% (me|mine)|i'?m the only writer|solo|me alone|i wrote everything)/.test(t)) return `${me.name} 100%${me.pro ? ` (${me.pro})` : ''}`
  if (/\d{1,3}\s*%|\b\d{1,3}\s*\/\s*\d{1,3}\b|\bsplit\b|\bfifty\b|\bhalf\b/.test(t) && /(me|i |wrote|producer|writer|split|%)/.test(t)) return text.trim().slice(0, 500)
  return null
}
export function songFrom(text: string, titles: string[]) {
  const q = /["“]([^"”]{1,80})["”]/.exec(text)?.[1]
  const lower = ' ' + text.toLowerCase() + ' '
  const hits = titles.filter(Boolean).map(t => ({ t, n: t.toLowerCase().replace(/\s*\((feat|ft|with)[^)]*\)/, '').trim() })).filter(x => x.n.length >= 1).filter(x => {
    const esc = x.n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), re = new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i')
    if (!re.test(lower)) return false
    if (x.n.length <= 3 || /^\d+$/.test(x.n)) return new RegExp(`(song|track|record|single|called|titled|named)\\s+(?:(?:was|is|it'?s|called|titled|named)\\s+)?["“]?${esc}\\b`, 'i').test(text) || (q != null && norm(q) === norm(x.n))
    return true
  }).sort((a, b) => b.n.length - a.n.length)
  if (hits[0]) return { title: hits[0].t, inCatalog: true }
  const named = /\b(?:song|track|record|single)\s+(?:(?:was|is|it'?s)\s+)?(?:called|titled|named)?\s*["“]?([A-Za-z0-9][^,.;!?"”\n]{0,40}?)["”]?(?=\s+(?:was|got|is|on|in|played|aired|used)\b|[,.;!?]|$)/i.exec(text)
  if (q && !showCandidates(text).some(s => norm(s) === norm(q))) return { title: q.trim(), inCatalog: false }
  if (named && !/^(of mine|i made|i wrote|was|is|got)$/i.test(named[1].trim())) return { title: named[1].trim(), inCatalog: false }
  return null
}

type TvPick = { show: any; network: string | null; episode: any | null; alternatives: any[]; showOptions: string[]; networkGuess: string | null }
/** Resolve show + episode with TVmaze (free, no key). */
export async function resolveTv(text: string, fetcher: Fetcher, known: { showId?: number | null; exclude?: string[]; leading?: boolean } = {}): Promise<TvPick | null> {
  const ep = episodeHints(text), hint = networkHint(text)
  let shows: any[] = []
  if (known.showId) { const s = await fetcher(`https://api.tvmaze.com/shows/${known.showId}`).catch(() => null); if (s) shows = [s] }
  else for (const cand of (() => {
    const c = showCandidates(text, known.exclude ?? [])
    // Answering "what show?" in a case: the first words usually ARE the show ("Baddies, the Hawaii episode").
    if (known.leading) { const lead = text.split(/[,.;!?\n]|\s+(?:the|an?|when|where|episode|season)\s+/i)[0].replace(/^(?:it was|it's|its|on|the show)\s+/i, '').trim(); const ex = (known.exclude ?? []).map(norm); if (lead && lead.split(/\s+/).length <= 5 && !ex.includes(norm(lead)) && !c.some(x => norm(x) === norm(lead))) c.unshift(lead) }
    return c.slice(0, 3)
  })()) {
    const res = await fetcher(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(cand)}`).catch(() => [])
    const c = norm(cand)
    shows = (res ?? []).filter((r: any) => r?.show && r.score > 0.25 && (norm(r.show.name).includes(c) || c.includes(norm(r.show.name)))).map((r: any) => r.show).slice(0, 7)
    if (shows.length) break
  }
  if (!shows.length) return null
  const net = (s: any) => s?.webChannel?.name ?? s?.network?.name ?? null
  if (hint) { const f = shows.filter(s => norm(net(s) ?? '') === norm(hint) || norm(net(s) ?? '').includes(norm(hint))); if (f.length) shows = f }
  const counts: Record<string, number> = {}; for (const s of shows) { const n = net(s); if (n) counts[n] = (counts[n] ?? 0) + 1 }
  const networkGuess = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const pool = networkGuess && counts[networkGuess] > 1 ? shows.filter(s => net(s) === networkGuess) : shows
  let matches: { show: any; ep: any; hits: number }[] = []
  if (ep.season && ep.number) {
    for (const s of pool.slice(0, 3)) { const e = await fetcher(`https://api.tvmaze.com/shows/${s.id}/episodebynumber?season=${ep.season}&number=${ep.number}`).catch(() => null); if (e?.id) matches.push({ show: s, ep: e, hits: 9 }) }
  } else if (ep.words.length) {
    for (const s of pool.slice(0, 6)) {
      const eps = await fetcher(`https://api.tvmaze.com/shows/${s.id}/episodes`).catch(() => [])
      for (const e of eps ?? []) {
        const hay = norm(`${e.name ?? ''} ${String(e.summary ?? '').replace(/<[^>]+>/g, ' ')}`)
        const hits = ep.words.filter(w => new RegExp(`\\b${w}`).test(hay)).length
        if (hits) matches.push({ show: s, ep: e, hits })
      }
    }
  }
  matches.sort((a, b) => b.hits - a.hits || String(a.ep.airdate).localeCompare(String(b.ep.airdate)))
  const best = matches[0] ?? null
  const show = best?.show ?? (pool.length === 1 ? pool[0] : null)
  return {
    show, network: show ? net(show) : networkGuess, episode: best?.ep ?? null,
    alternatives: matches.slice(1, 4).filter(m => m.show.id === best?.show.id || m.hits === best?.hits).map(m => ({ show: m.show.name, season: m.ep.season, number: m.ep.number, name: m.ep.name, airdate: m.ep.airdate })),
    showOptions: show ? [] : pool.map(s => s.name).slice(0, 6), networkGuess
  }
}

const epLabel = (e: any) => `Season ${e.season}, Episode ${e.number}${e.name ? ` "${e.name}"` : ''}`

/**
 * Read what the owner said and fill as many case facts as possible.
 * ctx.facts = facts already on the case (answers fill only what is missing, or correct the episode).
 */
export async function understand(text: string, ctx: { playbook?: string | null; facts?: Record<string, any>; titles: string[]; me: { name: string; pro: string | null; writersFor?: (title: string) => string | null }; fetcher?: Fetcher }): Promise<Understood> {
  const fetcher = ctx.fetcher ?? defaultFetch, have = { ...(ctx.facts ?? {}) }
  const playbook = ctx.playbook ?? suggestPlaybooks(text, 1)[0]?.id ?? null
  const facts: Record<string, any> = {}, found: Found[] = [], confirm: string[] = []
  let options: string[] | undefined
  const set = (key: string, label: string, value: string | null, how: string, source?: string) => { if (value == null || value === '') return; facts[key] = value; found.push({ key, label, value, how, ...(source ? { source } : {}) }) }
  const pb = playbook ? playbookById(playbook) : null
  const song = songFrom(text, ctx.titles)
  if (song && !have.songTitle) set('songTitle', 'Song', song.title, song.inCatalog ? 'matched your catalog' : 'from what you said')

  if (playbook === 'tv-cue-sheet') {
    const reResolve = !have.show || Boolean(episodeHints(text).words.length || episodeHints(text).season) && Boolean(have.tvmazeShowId)
    if (reResolve) {
      const tv = await resolveTv(text, fetcher, { showId: have.tvmazeShowId ?? null, exclude: [song?.title ?? '', ...(ctx.titles ?? [])], leading: Boolean(ctx.facts) && !have.show }).catch(() => null)
      if (tv?.show) {
        if (!have.show) set('show', 'Show', tv.show.name, 'TVmaze', tv.show.url)
        facts.tvmazeShowId = tv.show.id
        if (tv.network && !have.network) set('network', 'Network / streamer', tv.network, `${tv.show.name} streams on ${tv.network} (TVmaze)`, tv.show.url)
        if (tv.episode) {
          set('episode', 'Episode', epLabel(tv.episode), `matched "${episodeHints(text).words.join(', ') || 'season/episode'}" in the episode guide`, tv.episode.url)
          if (tv.episode.airdate) set('airDate', 'First aired', tv.episode.airdate, 'episode guide', tv.episode.url)
          facts.episodeConfirmed = false
          confirm.push(`Is it ${tv.show.name} ${epLabel(tv.episode)}, aired ${tv.episode.airdate}?${tv.alternatives.length ? ` Other matches: ${tv.alternatives.map(a => `S${a.season}E${a.number} "${a.name}" (${a.airdate})`).join('; ')}.` : ''} Say "yes" or tell me which one.`)
        } else if (!have.episode) confirm.push(`Which season/episode of ${tv.show.name}? Describe it (e.g. "the one where they went to Hawaii") and I'll find it.`)
      } else if (tv && tv.showOptions.length > 1) {
        options = tv.showOptions
        if (tv.networkGuess && !have.network) set('network', 'Network / streamer', tv.networkGuess, `all of these stream on ${tv.networkGuess} (TVmaze)`)
        confirm.push(`Which one: ${tv.showOptions.join(', ')}?`)
      }
    }
    if (/^\s*(yes|yeah|yep|yup|correct|that'?s it|that'?s the one|right|exactly)\b/i.test(text) && have.episode && have.episodeConfirmed === false) { facts.episodeConfirmed = true; found.push({ key: 'episodeConfirmed', label: 'Episode', value: 'confirmed', how: 'you confirmed' }) }
    const net = networkHint(text); if (net && !have.network && !facts.network) set('network', 'Network / streamer', net, 'from what you said')
    if (!facts.airDate && !have.airDate) set('airDate', 'First aired', monthYear(text), 'from what you said')
    if (!have.howUsed) set('howUsed', 'How it was used', howUsed(text), 'from what you said')
    if (!have.license) set('license', 'License / upfront fee', licenseNote(text), 'from what you said')
  }
  if (playbook === 'merch-drop') {
    if (!have.idea && !ctx.facts) set('idea', 'What goes on it', text.trim().slice(0, 600), 'from what you said')
    const t = text.toLowerCase()
    if (!have.budget) set('budget', 'Route', /(no money|zero upfront|no upfront|don'?t want to pay|free|print on demand|no inventory|don'?t (want to )?(hold|carry|keep) (any )?inventory)/.test(t) ? 'Zero upfront: print on demand' : /(my own money|invest|bulk|pay upfront|buy (them|inventory))/.test(t) ? 'Own money: bulk run for bigger margins' : null, 'from what you said')
    if (!have.where) { const w = ['website', 'site', 'spotify', 'youtube', 'instagram', 'tiktok', 'shows', 'linktree'].filter(k => t.includes(k)); if (w.length) set('where', 'Where to sell', w.join(', '), 'from what you said') }
    if (!have.artOwnership && /(i (made|drew|designed|own) (it|the (logo|art))|my (own )?(logo|art|cover)|i paid (someone|a designer))/.test(t)) set('artOwnership', 'Art ownership', 'Owner says they own the art', 'from what you said')
  }
  const songTitle = facts.songTitle ?? have.songTitle
  if (pb?.needs.some(n => n.key === 'writers') && !have.writers) {
    const w = writersFrom(text, ctx.me) ?? (songTitle && ctx.me.writersFor ? ctx.me.writersFor(songTitle) : null)
    if (w) set('writers', 'Writers / splits', w, writersFrom(text, ctx.me) ? 'from what you said' : 'from the song\'s saved credits')
  }
  // Anything left: if exactly one required thing was missing, the whole answer is that thing.
  const all = { ...have, ...facts }
  let missing = (pb?.needs ?? []).filter(n => all[n.key] == null)
  if (ctx.facts && !found.length && missing.length) {
    const target = missing.find(n => n.required) ?? missing[0]
    if (target && text.trim().length >= 2 && !/^\s*(yes|no|ok|okay)\s*$/i.test(text)) { set(target.key, target.question.replace(/\?.*$/, ''), text.trim().slice(0, 1000), 'your answer'); missing = missing.filter(n => n !== target) }
  }
  if (!ctx.facts && text.trim()) facts.story = text.trim().slice(0, 2000)
  const ask = missing.filter(n => n.required || ['episode', 'howUsed', 'license'].includes(n.key)).filter(n => !(n.key === 'episode' && confirm.length)).map(n => ({ key: n.key, question: n.key === 'writers' && songTitle ? `Who wrote "${songTitle}" and what are the splits? If it was just you, say "just me".` : n.question + (n.required ? '' : ' (skip if you don\'t know)') }))
  return { playbook, facts, found, confirm, ask, ...(options ? { options } : {}) }
}

/** One chat message in plain words: what I figured out, what I still need. */
export function sayUnderstood(u: Understood, opened: { title: string; deadline: string | null; deadlineNote: string | null; reused?: boolean } | null) {
  const lines: string[] = []
  if (opened) lines.push(opened.reused ? `This is the case we already opened: "${opened.title}".` : `Got it. I opened a case: "${opened.title}".`)
  if (u.found.length) { lines.push('', 'Here\'s what I figured out:'); for (const f of u.found.filter(f => f.key !== 'episodeConfirmed')) lines.push(`• ${f.label}: ${f.value}${f.how && f.how !== 'from what you said' && f.how !== 'your answer' ? ` (${f.how})` : ''}`) }
  if (opened?.deadline) { const days = Math.ceil((Date.parse(opened.deadline + 'T23:59:59Z') - Date.now()) / 86400000); lines.push('', days >= 0 ? `⏳ ASCAP claim window closes ${opened.deadline}: ${days} days left.` : `The usual ASCAP claim window (${opened.deadline}) has passed; I'll still ask about late claims.`) }
  if (u.confirm.length) { lines.push(''); for (const c of u.confirm) lines.push(c) }
  if (u.ask.length) { lines.push('', u.ask.length === 1 ? 'One thing I still need:' : 'I still need:'); u.ask.forEach((a, i) => lines.push(`${u.ask.length === 1 ? '' : `${i + 1}. `}${a.question}`)) }
  if (u.confirm.length || u.ask.length) lines.push('', 'Answer right here, in your own words.')
  else lines.push('', 'That\'s everything I need. Your team takes it from here: finding who to contact and drafting the emails for you to approve.')
  return lines.join('\n').trim()
}
