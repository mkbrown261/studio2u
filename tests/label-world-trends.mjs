// Carla's trends: free public charts (Deezer, Apple/iTunes, YouTube most-popular), songs merged
// across charts, compilation channels dropped, lane detection, emerging artists -> watchlist,
// saved as a report + observations, answered in Carla's chat without an AI key, 60-min cache,
// daily engine pass answers waiting "what's hot" questions. No network: all mocked.
import assert from 'node:assert/strict'
import { fixture } from './label-world-api-fixture.mjs'
const tr = await import('../src/label-world/research/trends.ts')
const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Aviator Music Group'),('lab-b','Other');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer');
INSERT INTO lw_label_identity(label_id,artist_name,aliases_json) VALUES ('lab-a','AVIATORKEYZ','[]');`)
const objects = new Map(); const R2 = { async put(k, b) { objects.set(k, b) }, async get() { return null } }
const env = { DB: db, R2, YOUTUBE_DATA_API_KEY: 'yt-key' }
const J = b => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } })
const recent = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)
let calls = []
const charts = async (url, init) => {
  calls.push(url)
  if (url.includes('api.deezer.com/chart/0/')) return J({ data: [{ position: 1, title: 'Dracula (with JENNIE)', link: 'https://deezer/1', artist: { id: 1, name: 'Tame Impala' } }, { position: 2, title: 'Janice STFU', link: 'https://deezer/2', artist: { id: 2, name: 'Drake' } }] })
  if (url.includes('api.deezer.com/chart/116/')) return J({ data: [{ position: 1, title: 'Janice STFU', link: 'https://deezer/2', artist: { id: 2, name: 'Drake' } }, { position: 2, title: 'Anxiety', link: 'https://deezer/3', artist: { id: 3, name: 'Doechii' } }, { position: 3, title: 'Up Next', link: 'https://deezer/4', artist: { id: 4, name: 'New Kid' } }] })
  if (url.includes('api.deezer.com/chart/165/')) return J({ data: [{ position: 1, title: 'Folded', link: 'https://deezer/5', artist: { id: 5, name: 'Kehlani' } }] })
  if (url.includes('api.deezer.com/artist/3')) return J({ nb_fan: 155000, link: 'https://deezer/a3' })
  if (url.includes('api.deezer.com/artist/4')) return J({ nb_fan: 12000, link: 'https://deezer/a4' })
  if (url.includes('api.deezer.com/artist/5')) return J({ nb_fan: 5000000, link: 'https://deezer/a5' })
  if (url.includes('rss.marketingtools.apple.com')) return J({ feed: { results: [{ name: 'Janice STFU', artistName: 'Drake', url: 'https://apple/2', releaseDate: recent, genres: [{ name: 'Hip-Hop/Rap' }, { name: 'Music' }] }] } })
  if (url.includes('itunes.apple.com/us/rss/topsongs') && url.includes('genre=18')) return J({ feed: { entry: [{ 'im:name': { label: 'Anxiety' }, 'im:artist': { label: 'Doechii' }, id: { label: 'https://apple/3' }, category: { attributes: { label: 'Hip-Hop/Rap' } } }, { 'im:name': { label: 'A Nightmare On My Street' }, 'im:artist': { label: 'DJ Jazzy Jeff & The Fresh Prince' }, id: { label: 'https://apple/9' }, 'im:releaseDate': { label: '1988-03-29T00:00:00-07:00' }, category: { attributes: { label: 'Hip-Hop/Rap' } } }] } })
  if (url.includes('itunes.apple.com/us/rss/topsongs')) return J({ feed: { entry: [] } })
  if (url.includes('googleapis.com/youtube/v3/videos')) { assert.equal(init.headers['X-Goog-Api-Key'], 'yt-key'); assert.ok(url.includes('chart=mostPopular')); return J({ items: [
    { id: 'aaaaaaaaaaa', snippet: { title: 'Drake - Janice STFU (Official Video)', channelTitle: 'DrakeVEVO', publishedAt: new Date(Date.now() - 2 * 86400000).toISOString() }, statistics: { viewCount: '4000000' } },
    { id: 'bbbbbbbbbbb', snippet: { title: 'Best HipHop Music 2026 Mix', channelTitle: 'Best HipHop Music', publishedAt: new Date().toISOString() }, statistics: { viewCount: '9000000' } }] }) }
  throw new Error('unexpected ' + url)
}

// lanes + intent
assert.deepEqual(tr.lanesFor('CARLA WHATS THE HOTTEST HIP HOP RNB TREND'), ['hiphop', 'rnb'])
assert.deepEqual(tr.lanesFor('', ['country']), ['country'])
assert.ok(tr.TREND_INTENT.test('CARLA I NEED YOU TO FIND OUT WHATS THE HOTTEST TREND RIGHT NOW'))
assert.ok(!tr.TREND_INTENT.test('can you review my split sheet'))

// collect
const t = await tr.collectTrends({ lanes: ['hiphop', 'rnb'], youtubeKey: 'yt-key', fetcher: charts })
const top = t.songs[0]
assert.equal(top.title, 'Janice STFU'); assert.ok(top.charts.length >= 4) // Deezer Top, Deezer rap, Apple, YouTube
assert.ok(!t.rows.some(r => /Best HipHop/.test(r.artist + r.title))) // compilation channel dropped
assert.equal(t.youtube[0].artist, 'Drake'); assert.equal(t.youtube[0].title, 'Janice STFU'); assert.ok(t.youtube[0].viewsPerDay > 1e6)
assert.deepEqual(t.emerging.map(e => e.artist), ['Doechii', 'New Kid']) // Kehlani has 5M fans: not emerging
assert.equal(t.fresh[0].title, 'Janice STFU')
assert.ok(!t.songs.some(x => /Nightmare/.test(x.title))); assert.equal(t.oldies[0].title, 'A Nightmare On My Street') // 1988 song is not a trend
const said = tr.sayTrends(t, { artist: 'AVIATORKEYZ', lanes: ['hiphop', 'rnb'] })
assert.match(said, /1\. Drake – Janice STFU \(on \d charts, best #1\)/); assert.match(said, /In your lane/); assert.match(said, /views\/day/); assert.match(said, /watchlist/); assert.match(said, /TikTok/); assert.match(said, /Older songs back on the charts/); assert.ok(!/In your lane[^\n]*Nightmare/.test(said))

// one source down: still answers and says which one failed
const partial = await tr.collectTrends({ lanes: ['hiphop'], fetcher: async (u, i) => u.includes('apple.com') ? new Response('', { status: 503 }) : charts(u, i) })
assert.ok(partial.rows.length > 0); assert.ok(partial.failed.some(x => /Apple/.test(x)))

// run: report + observations + watchlist + Carla's reply, cached for an hour
calls = []
const r1 = await tr.runTrends(env, 'lab-a', 1, { text: 'hottest trend', fetcher: charts })
assert.equal(r1.watchlistAdded, 2); assert.equal(r1.cached, false)
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM lw_research_reports WHERE label_id='lab-a' AND source='trends'").get().n, 1)
assert.ok(sqlite.prepare("SELECT COUNT(*) n FROM lw_source_observations WHERE report_id=?").get(r1.reportId).n >= 8)
assert.deepEqual(sqlite.prepare("SELECT title FROM lw_research_records WHERE label_id='lab-a' AND kind='watchlist' ORDER BY title").all().map(x => x.title), ['Doechii', 'New Kid'])
const reply = sqlite.prepare("SELECT content,research_report_id FROM lw_employee_messages WHERE label_id='lab-a' AND agent_id='researcher' AND role='assistant'").get()
assert.match(reply.content, /Here's what's hot right now/); assert.equal(reply.research_report_id, r1.reportId)
assert.equal(sqlite.prepare("SELECT requests FROM lw_source_limits WHERE scope='youtube:lab-a'").get().requests, 1)
const n = calls.length
const r2 = await tr.runTrends(env, 'lab-a', 1, { text: 'what is hot', fetcher: charts })
assert.equal(r2.cached, true); assert.equal(calls.length, n); assert.equal(r2.reportId, r1.reportId)

// Carla's chat: "what's hot" answered instantly with NO AI key (no WAITING_FOR_PROVIDER)
sqlite.exec("DELETE FROM lw_research_reports WHERE label_id='lab-a'")
const realFetch = globalThis.fetch; globalThis.fetch = charts
const res = await app.request('http://localhost/api/label-world/labels/lab-a/inbox/researcher/messages', { method: 'POST', headers: { Cookie: 'studio2u_session=test-session-1', Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'CARLA I NEED YOU TO FIND OUT WHATS THE HOTTEST TREND RIGHT NOW', messageId: crypto.randomUUID() }) }, env)
globalThis.fetch = realFetch
assert.equal(res.status, 201); const body = await res.json()
assert.equal(body.status, 'COMPLETED'); assert.match(body.messages.at(-1).content, /Janice STFU/)
assert.equal(body.messages.at(-2).status, 'COMPLETED') // the question no longer shows as waiting
// non-trend message to Carla still goes to the model path (waits for a provider)
const res2 = await app.request('http://localhost/api/label-world/labels/lab-a/inbox/researcher/messages', { method: 'POST', headers: { Cookie: 'studio2u_session=test-session-1', Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'can you look at my split sheet', messageId: crypto.randomUUID() }) }, env)
assert.equal((await res2.json()).status, 'WAITING_FOR_PROVIDER')

// daily engine pass: answers an old waiting trend question, once a day
sqlite.exec(`DELETE FROM lw_research_reports WHERE label_id='lab-a'; INSERT INTO lw_employee_messages(id,label_id,user_id,agent_id,role,content,status) VALUES ('old-q','lab-a',1,'researcher','user','whats trending right now?','WAITING_FOR_PROVIDER')`)
const d1 = await tr.dailyTrends(env, ['lab-a'], charts)
assert.deepEqual(d1, { ran: 1, answered: 1 })
assert.ok(sqlite.prepare("SELECT 1 FROM lw_employee_messages WHERE reply_to='old-q'").get())
assert.equal(sqlite.prepare("SELECT status FROM lw_employee_messages WHERE id='old-q'").get().status, 'COMPLETED')
assert.deepEqual(await tr.dailyTrends(env, ['lab-a'], charts), { ran: 0, answered: 0 })

// website: viewer can read latest; another label can't
let w = await app.request('http://localhost/api/label-world/labels/lab-a/research/trends/latest', { headers: { Cookie: 'studio2u_session=test-session-3' } }, env)
assert.equal(w.status, 200); const latest = await w.json(); assert.ok(latest.report.summary.includes('Janice STFU')); assert.ok(latest.rows.length > 0)
w = await app.request('http://localhost/api/label-world/labels/lab-a/research/trends/latest', { headers: { Cookie: 'studio2u_session=test-session-2' } }, env)
assert.notEqual(w.status, 200)
console.log('PASS trends: Carla reads free public charts (Deezer overall + your lane, Apple Most Played, iTunes genre, YouTube most-popular), merges songs across charts, drops compilation channels, finds emerging artists -> watchlist, saves report + observations, answers "what\'s hot" in chat with no AI key, 60-min cache, YouTube quota guard, daily engine pass answers waiting questions once a day, viewer/tenant isolation')
