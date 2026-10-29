// Talk, don't fill forms: plain words -> case facts (TVmaze show/network/episode/air date,
// catalog song, how used, license, writers), reply in the same chat box, "yes" confirms,
// no duplicate cases, casual chat stays chat, merch playbook, Spotify listeners + Carla's
// watchlist from discovery, MCP tell_case. No network: every lookup is mocked.
import assert from 'node:assert/strict'
import { fixture } from './label-world-api-fixture.mjs'
const u = await import('../src/label-world/autonomy/understand.ts')
const { talk } = await import('../src/label-world/autonomy/talk.ts')
const cases = await import('../src/label-world/autonomy/cases.ts')
const know = await import('../src/label-world/autonomy/discovery.ts')
const { playbookById, suggestPlaybooks } = await import('../src/label-world/autonomy/playbooks.ts')
const { createStudioMcp } = await import('../src/label-world/mcp/server.ts')
const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client')

const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Aviator Music Group'),('lab-b','Other');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer');
INSERT INTO lw_label_identity(label_id,artist_name,legal_name,aliases_json,pro,ipi) VALUES ('lab-a','Aviator Keys','Mason Brown','[]','ASCAP','00123456789');
INSERT INTO lw_catalog_tracks(id,label_id,source,source_id,title,artist_credit,isrc,release_date) VALUES ('t1','lab-a','deezer','1','22','Aviator Keys','QZ85M1979735','2019-05-01'),('t2','lab-a','deezer','2','Crash and Burn','Aviator Keys',NULL,'2013-02-25');`)
const env = { DB: db }
const web = (path, user = 1, body) => app.request('http://localhost/api/label-world/labels/lab-a' + path, { method: body ? 'POST' : 'GET', headers: { Cookie: 'studio2u_session=test-session-' + user, Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, env)

// ---------- mocked TVmaze ----------
const show = (id, name, ch) => ({ id, name, url: `https://www.tvmaze.com/shows/${id}`, webChannel: ch ? { name: ch } : null, network: null })
const SHOWS = [show(92999, 'Baddies', 'TVNZ+'), show(72035, 'Baddies East', 'Zeus'), show(80601, 'Baddies Midwest', 'Zeus'), show(56282, 'Baddies ATL', 'Zeus')]
const EPS = { 80601: [{ id: 1, season: 1, number: 18, name: 'Chicago Nights', airdate: '2025-02-23', summary: '<p>Drama in Chicago.</p>', url: 'https://www.tvmaze.com/episodes/1' }, { id: 2, season: 1, number: 19, name: 'Aloha!', airdate: '2025-03-02', summary: '<p>The Baddies head to Hawaii where tension continues.</p>', url: 'https://www.tvmaze.com/episodes/2' }], 72035: [{ id: 3, season: 1, number: 2, name: 'Arrival', airdate: '2023-09-24', summary: '<p>New house.</p>', url: 'https://www.tvmaze.com/episodes/3' }] }
const calls = []
const tv = async url => {
  calls.push(url)
  if (url.includes('/search/shows')) return /baddies/i.test(decodeURIComponent(url)) ? SHOWS.map((s, i) => ({ score: 0.8 - i * 0.05, show: s })) : []
  const m = /shows\/(\d+)\/episodes$/.exec(url); if (m) return EPS[m[1]] ?? []
  const one = /shows\/(\d+)$/.exec(url); if (one) return SHOWS.find(s => String(s.id) === one[1]) ?? null
  throw new Error('unexpected ' + url)
}

// ---------- the exact sentence from the owner ----------
const said = 'My song 22 was on Baddies, the episode where they went to Hawaii. Nobody asked me and I never got paid. It was playing in the background at the party. I wrote it myself.'
const und = await u.understand(said, { playbook: 'tv-cue-sheet', titles: ['22', 'Crash and Burn'], me: { name: 'Mason Brown', pro: 'ASCAP' }, fetcher: tv })
assert.equal(und.facts.songTitle, '22'); assert.equal(und.facts.show, 'Baddies Midwest'); assert.equal(und.facts.network, 'Zeus')
assert.equal(und.facts.episode, 'Season 1, Episode 19 "Aloha!"'); assert.equal(und.facts.airDate, '2025-03-02')
assert.equal(und.facts.howUsed, 'Background'); assert.match(und.facts.license, /No license/); assert.equal(und.facts.writers, 'Mason Brown 100% (ASCAP)')
assert.equal(und.ask.length, 0); assert.match(und.confirm[0], /Is it Baddies Midwest Season 1, Episode 19/)
// helpers
assert.equal(u.monthYear('it aired in March 2025'), '2025-03'); assert.equal(u.networkHint('it was on netflix'), 'Netflix')
assert.deepEqual(u.episodeHints('season 2 episode 5'), { season: 2, number: 5, words: [] })
assert.equal(u.howUsed('they were singing it in the car'), 'Performed / sung on screen')

// ---------- talk opens ONE case, replies in the employee chat ----------
await assert.rejects(talk(db, 'lab-a', 3, { text: said }, tv), /permission/i)
let t = await talk(db, 'lab-a', 1, { text: said, agent: 'executive' }, tv)
assert.equal(t.handled, true); assert.equal(t.opened, true)
assert.equal(t.case.title, '"22" on Baddies Midwest (S1E19)'); assert.equal(t.case.deadline, '2027-01-31')
assert.match(t.reply, /Here's what I figured out/); assert.match(t.reply, /Zeus/); assert.match(t.reply, /claim window closes 2027-01-31/); assert.match(t.reply, /Say "yes"/)
const msgs = sqlite.prepare("SELECT role,content FROM lw_employee_messages WHERE label_id='lab-a' AND agent_id='executive' ORDER BY rowid").all()
assert.equal(msgs.length, 2); assert.equal(msgs[0].role, 'user'); assert.match(msgs[1].content, /Baddies Midwest/)
const C = t.caseId
let c = await cases.getCase(db, 'lab-a', 1, C)
assert.equal(c.case.facts.network, 'Zeus'); assert.equal(c.stillNeeded.filter(n => n.required).length, 0); assert.equal(c.case.status, 'OPEN')

// "yes" confirms the episode on the same case
t = await talk(db, 'lab-a', 1, { text: 'yes', caseId: C, agent: 'executive' }, tv)
assert.equal(t.caseId, C); assert.equal(t.opened, false)
assert.equal((await cases.getCase(db, 'lab-a', 1, C)).case.facts.episodeConfirmed, true)

// tapping the playbook again / retelling = same case, never a duplicate
const again = await cases.openCase(db, 'lab-a', 1, { playbook: 'tv-cue-sheet', facts: { story: 'my song was on tv' } }, 'owner')
assert.equal(again.reused, true); assert.equal(again.case.id, C)
const t2 = await talk(db, 'lab-a', 1, { text: 'My song 22 was on Baddies and I never got paid', playbook: 'tv-cue-sheet' }, tv)
assert.equal(t2.caseId, C)
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM lw_cases WHERE label_id='lab-a' AND playbook='tv-cue-sheet'").get().n, 1)
// a different song is a different case
const t3 = await talk(db, 'lab-a', 1, { text: 'Also my song Crash and Burn was on Baddies East and I never got paid', playbook: 'tv-cue-sheet' }, tv)
assert.notEqual(t3.caseId, C)

// partial story -> asks only what it can't figure out; a one-line answer fills the one gap
sqlite.exec("DELETE FROM lw_cases WHERE label_id='lab-a'")
t = await talk(db, 'lab-a', 1, { text: 'my song got used on some tv show and I never got paid' }, tv)
assert.equal(t.handled, true); assert.ok(t.ask.some(a => a.key === 'show'))
const t4 = await talk(db, 'lab-a', 1, { text: 'Baddies, the Hawaii episode. The song was 22, just me on it', caseId: t.caseId }, tv)
c = await cases.getCase(db, 'lab-a', 1, t.caseId)
assert.equal(c.case.facts.show, 'Baddies Midwest'); assert.equal(c.case.facts.songTitle, '22'); assert.equal(c.case.facts.writers, 'Mason Brown 100% (ASCAP)')
assert.match(t4.reply, /Aloha!/)

// casual chat stays chat (no case, no network)
const n0 = calls.length
assert.equal((await talk(db, 'lab-a', 1, { text: 'hey what do you think about my new single' }, tv)).handled, false)
assert.equal(calls.length, n0)
await assert.rejects(talk(db, 'lab-a', 1, { text: '' }, tv), /Say what happened/)

// ---------- merch ----------
assert.ok(playbookById('merch-drop')); assert.equal(suggestPlaybooks('I want to sell shirts and hoodies with my logo')[0].id, 'merch-drop')
let r = await web('/talk', 1, { text: 'I want to sell shirts with my own logo on my website and Spotify, no upfront money, I dont want to hold inventory' })
assert.equal(r.status, 200); let j = await r.json()
assert.equal(j.handled, true); assert.equal(j.case.title, 'Sell merch with my brand (no inventory)')
c = await cases.getCase(db, 'lab-a', 1, j.caseId)
assert.equal(c.case.facts.budget, 'Zero upfront: print on demand'); assert.match(c.case.facts.where, /website/); assert.equal(c.case.facts.artOwnership, 'Owner says they own the art')
assert.ok(playbookById('merch-drop').rules.some(x => /never touch payment/.test(x)))
r = await web('/talk', 3, { text: 'sell shirts' }); assert.equal(r.status, 403)

// ---------- discovery: Spotify monthly listeners + Carla's watchlist fills itself ----------
const mb = async url => {
  if (url.includes('musicbrainz.org/ws/2/artist?query')) return { artists: [{ id: 'mb1', name: 'Aviator Keys', score: 100 }] }
  if (url.includes('musicbrainz.org/ws/2/artist/mb1')) return { name: 'Aviator Keys', relations: [{ type: 'free streaming', url: { resource: 'https://open.spotify.com/artist/0123456789abcdefghijkl' } }], genres: [{ name: 'hip hop', count: 3 }] }
  if (url.includes('api.deezer.com/search/artist')) return { data: [{ id: 5, name: 'Aviator Keys', nb_fan: 120, nb_album: 4 }] }
  if (url.includes('/artist/5/top')) return { data: [{ title: '22' }] }
  if (url.includes('/artist/5/related')) return { data: [{ name: 'Sim One' }, { name: 'Sim Two' }] }
  if (url.includes('itunes.apple.com')) return { results: [] }
  throw new Error('unexpected ' + url)
}
const disc = await know.discoverPublic(db, 'lab-a', 1, mb, async () => '<meta property="og:description" content="Artist · 1,234 monthly listeners.">')
assert.equal(disc.watchlistAdded, 2)
assert.equal(JSON.parse(sqlite.prepare("SELECT value_json FROM lw_artist_facts WHERE label_id='lab-a' AND key='monthlyListeners'").get().value_json), 1234)
assert.deepEqual(sqlite.prepare("SELECT title FROM lw_research_records WHERE label_id='lab-a' AND kind='watchlist' ORDER BY title").all().map(x => x.title), ['Sim One', 'Sim Two'])
assert.equal((await know.discoverPublic(db, 'lab-a', 1, mb, async () => '')).watchlistAdded, 0) // no duplicates

// ---------- MCP ----------
const handler = createStudioMcp(db, { userId: 1, grantId: 'g1', labelIds: ['lab-a'], scopes: ['labels:read', 'releases:read', 'releases:write', 'tasks:read', 'tasks:write'], clientName: 'Codex', toolMode: 'core' }, async () => true)
const client = new Client({ name: 't', version: '1' })
await client.connect(new StreamableHTTPClientTransport(new URL('https://studio.invalid/label-world/mcp'), { fetch: (u2, o) => handler.fetch(new Request(u2, o)) }))
const guide = await client.callTool({ name: 'studio2u_guide', arguments: { topic: 'cases' } })
assert.match(guide.content[0].text, /tell_case\(labelId, text/)
const run = async (tool, args) => { const x = await client.callTool({ name: 'studio2u_run', arguments: { tool, args } }); return x.isError ? { error: x.content[0].text } : JSON.parse(x.content[0].text) }
const mt = await run('tell_case', { labelId: 'lab-a', text: 'I want to sell hoodies with my cover art' })
assert.equal((mt.data ?? mt).handled, true)
assert.ok((await run('tell_case', { labelId: 'lab-b', text: 'sell shirts' })).error)
await client.close(); await handler.close()
console.log('PASS talk: owner\'s own words -> show/network/episode/air date (TVmaze), song from catalog, how used, license, writers; one case, reply in the same chat box, "yes" confirms, no duplicates on re-tap, different song = new case, only asks what it can\'t figure out, casual chat stays chat, merch (no-inventory) playbook, Spotify monthly listeners + self-filling watchlist, MCP tell_case, viewer/tenant isolation')
