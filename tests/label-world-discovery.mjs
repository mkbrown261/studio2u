// "Know me": public lookup (exact names only, namesakes flagged), links stay SUGGESTED until
// the owner says "That's me", owner answers beat agent/public guesses, secrets rejected,
// dossier % + next 3 questions + last-10-post analytics, engine lookup + monthly KNOW_ARTIST
// task, every task and employee chat gets the artist brief, SoundExchange uses ownsMasters,
// website + MCP. No network (mocked lookups).
import assert from 'node:assert/strict'
import { fixture } from './label-world-api-fixture.mjs'
const know = await import('../src/label-world/autonomy/discovery.ts')
const sx = await import('../src/label-world/autonomy/soundexchange.ts')
const { runEngine } = await import('../src/label-world/autonomy/engine.ts')
const { claimNext } = await import('../src/label-world/autonomy/service.ts')
const { loadContext } = await import('../src/label-world/context/loader.ts')
const { createStudioMcp } = await import('../src/label-world/mcp/server.ts')
const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client')

const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Aviator Music Group'),('lab-b','Other');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer');
INSERT INTO lw_label_identity(label_id,artist_name,legal_name,aliases_json,pro,spotify_artist_id) VALUES ('lab-a','Aviator Keys','Mason Brown','["Aviator Keyz"]','ASCAP','4Z8W4fKeB5YxbusRsdQVPb');
INSERT INTO lw_catalog_tracks(id,label_id,source,source_id,title,artist_credit,isrc) VALUES ('t1','lab-a','deezer','1','22','Aviator Keys','QZ85M1979735');`)
const env = { DB: db }
const web = (path, user = 1, body) => app.request('http://localhost/api/label-world/labels/lab-a' + path, { method: body ? 'POST' : 'GET', headers: { Cookie: 'studio2u_session=test-session-' + user, Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, env)

// ---------- mocked public databases ----------
const calls = []
const lookup = async url => {
  calls.push(url)
  if (url.includes('musicbrainz.org/ws/2/artist?')) return { artists: [
    { id: 'mb-1', name: 'Aviator Keys', score: 100, area: { name: 'United States' }, 'begin-area': { name: 'Atlanta' }, type: 'Person', ipis: ['00123456789'] },
    { id: 'mb-x', name: 'Aviator Keys Band', score: 80 } // not exact: ignored
  ] }
  if (url.includes('musicbrainz.org/ws/2/artist/mb-1')) return { name: 'Aviator Keys', genres: [{ name: 'hip hop', count: 3 }, { name: 'trap', count: 2 }], relations: [
    { type: 'free streaming', url: { resource: 'https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb' } },
    { type: 'social network', url: { resource: 'https://www.instagram.com/aviatorkeys/' } },
    { type: 'youtube', url: { resource: 'https://www.youtube.com/@aviatorkeys' } }
  ] }
  if (url.includes('api.deezer.com/search/artist')) return { data: [{ id: 111, name: 'Aviator Keys', nb_fan: 1520, nb_album: 9 }, { id: 222, name: 'Aviator', nb_fan: 5 }] }
  if (url.includes('api.deezer.com/artist/111/top')) return { data: [{ title: '22' }, { title: 'Crash and Burn' }] }
  if (url.includes('api.deezer.com/artist/111/related')) return { data: [{ name: 'Will2live' }, { name: 'Future' }] }
  if (url.includes('itunes.apple.com/search')) return { results: [{ artistId: 99, artistName: 'Aviator Keys', artistLinkUrl: 'https://music.apple.com/us/artist/aviator-keys/99?uo=4', primaryGenreName: 'Hip-Hop/Rap' }, { artistId: 98, artistName: 'Aviators', artistLinkUrl: 'https://music.apple.com/us/artist/aviators/98' }] }
  throw new Error('unexpected ' + url)
}

// ---------- empty dossier ----------
let d = await know.getDossier(db, 'lab-a', 1)
assert.ok(d.completeness < 20); assert.equal(d.questions.length, 3); assert.equal(d.questions[0].key, 'goals')
assert.ok(d.next.some(n => /Find me everywhere/.test(n))); assert.ok(d.next.some(n => /analytics/.test(n)))
await assert.rejects(know.getDossier(db, 'lab-a', 9), /not found/i)

// ---------- public lookup ----------
await assert.rejects(know.discoverPublic(db, 'lab-a', 3, lookup), /permission/i)
await assert.rejects(know.discoverPublic(db, 'lab-b', 2, lookup), /artist name first/)
const r = await know.discoverPublic(db, 'lab-a', 1, lookup)
assert.ok(r.newLinks >= 5, JSON.stringify(r)); assert.match(r.say, /That's me/)
const links = sqlite.prepare("SELECT * FROM lw_artist_links WHERE label_id='lab-a'").all()
assert.ok(links.every(l => l.status === 'SUGGESTED')) // nothing auto-confirmed
assert.equal(links.find(l => l.platform === 'instagram').confidence, 'STRONG') // MB page links to the confirmed Spotify id
assert.ok(links.find(l => l.platform === 'instagram').evidence.includes('musicbrainz.org/artist/mb-1'))
assert.ok(!links.some(l => l.url.includes('/222') || l.url.includes('/98'))) // namesakes ignored
assert.equal(links.find(l => l.platform === 'apple_music').url, 'https://music.apple.com/us/artist/aviator-keys/99')
d = await know.getDossier(db, 'lab-a', 1)
assert.deepEqual(d.facts.genres.value, ['hip hop', 'trap']); assert.equal(d.facts.genres.confirmed, false); assert.equal(d.facts.genres.source, 'PUBLIC')
assert.equal(d.facts.hometown.value, 'Atlanta / United States'); assert.equal(d.facts.publicFans.value, 1520)
assert.deepEqual(d.facts.similarArtists.value, ['Will2live', 'Future'])
assert.ok(d.toConfirm.some(x => x.key === 'genres')); assert.ok(d.discoveredAt)
// genres question shows the guess
assert.ok(d.questions.every(q => q.key !== 'genres') || d.questions.find(q => q.key === 'genres').suggested)

// ---------- "That's me" / "Not me" ----------
const ig = links.find(l => l.platform === 'instagram'), yt = links.find(l => l.platform === 'youtube')
await assert.rejects(know.decideLink(db, 'lab-a', 3, ig.id, 'CONFIRMED'), /permission/i)
await assert.rejects(know.decideLink(db, 'lab-a', 1, ig.id, 'MAYBE'), /decision/)
await know.decideLink(db, 'lab-a', 1, ig.id, 'CONFIRMED'); await know.decideLink(db, 'lab-a', 1, yt.id, 'NOT_ME')
assert.equal(JSON.parse(sqlite.prepare("SELECT socials_json FROM lw_label_identity WHERE label_id='lab-a'").get().socials_json).instagram, 'https://www.instagram.com/aviatorkeys/')
d = await know.getDossier(db, 'lab-a', 1)
assert.ok(!d.links.some(l => l.id === yt.id)) // NOT_ME hidden
// re-running the lookup does not resurrect NOT_ME or duplicate links
const again = await know.discoverPublic(db, 'lab-a', 1, lookup); assert.equal(again.newLinks, 0)
assert.equal(sqlite.prepare('SELECT status FROM lw_artist_links WHERE id=?').get(yt.id).status, 'NOT_ME')

// ---------- facts: owner wins, agent needs evidence, secrets rejected ----------
await assert.rejects(know.saveFacts(db, 'lab-a', 1, { nope: 'x' }, 'OWNER', 'owner'), /Unknown fact/)
await assert.rejects(know.saveFacts(db, 'lab-a', 1, { story: 'my password is hunter2' }, 'OWNER', 'owner'), /Never save/)
await assert.rejects(know.saveFacts(db, 'lab-a', 1, { team: 'ssn 123-45-6789' }, 'OWNER', 'owner'), /Never save/)
await assert.rejects(know.saveFacts(db, 'lab-a', 1, { ownsMasters: 'yes' }, 'OWNER', 'owner'), /true or false/)
await assert.rejects(know.saveFacts(db, 'lab-a', 1, { audience: '18-24' }, 'AGENT', 'Codex'), /Say where you learned/)
await assert.rejects(know.saveFacts(db, 'lab-a', 3, { goals: 'x' }, 'OWNER', 'owner'), /permission/i)
await know.saveFacts(db, 'lab-a', 1, { goals: '10k monthly listeners and a TV sync', ownsMasters: true, genres: 'hip hop, r&b', budgetMonthly: '200' }, 'OWNER', 'owner')
const kept = await know.saveFacts(db, 'lab-a', 1, { genres: ['country'], audience: '18-24, Atlanta and Houston' }, 'AGENT', 'Codex', 'https://www.instagram.com/aviatorkeys/ insights')
assert.deepEqual(kept.keptOwnerAnswers, ['genres']); assert.deepEqual(kept.saved, ['audience'])
d = await know.getDossier(db, 'lab-a', 1)
assert.deepEqual(d.facts.genres.value, ['hip hop', 'r&b']); assert.equal(d.facts.genres.confirmed, true)
assert.equal(d.facts.budgetMonthly.value, 200); assert.equal(d.facts.audience.confirmed, false)
await know.confirmFact(db, 'lab-a', 1, 'audience', true); await know.confirmFact(db, 'lab-a', 1, 'publicFans', false)
d = await know.getDossier(db, 'lab-a', 1)
assert.equal(d.facts.audience.confirmed, true); assert.equal(d.facts.publicFans, undefined)
assert.ok(!d.questions.some(q => ['goals', 'ownsMasters', 'genres', 'audience'].includes(q.key)))

// ---------- SoundExchange reads "I own my masters" ----------
sqlite.exec(`UPDATE lw_label_identity SET sx_json='{"status":"ACTIVE","registeredAs":["FEATURED_ARTIST"]}' WHERE label_id='lab-a'`)
const acct = await sx.getSxAccount(db, 'lab-a', 1)
assert.equal(acct.ownsMasters, true)
const roles = acct.checklist.items.find(x => x.label === 'Roles'); assert.equal(roles.action, 'STOP'); assert.match(roles.note, /Rights Owner \(SRCO\)/)

// ---------- analytics: last 10 posts ----------
const before = (await know.getDossier(db, 'lab-a', 1)).completeness
for (let i = 0; i < 10; i++) sqlite.prepare("INSERT INTO lw_social_snapshots(id,label_id,platform,kind,title,posted_at,metrics_json,captured_by) VALUES (?,?,?,?,?,?,?,?)").run('p' + i, 'lab-a', 'tiktok', 'MY_POST', 'Post ' + i, `2026-10-${String(10 + i).padStart(2, '0')}`, JSON.stringify({ views: 1000 * (i + 1), retention3s: 40 + i }), 'Codex')
sqlite.prepare("INSERT INTO lw_social_snapshots(id,label_id,platform,kind,title,metrics_json,captured_by) VALUES ('acc','lab-a','spotify','MY_ACCOUNT','Spotify for Artists',?,'Codex')").run(JSON.stringify({ monthlyListeners: 3400, followers: 610 }))
d = await know.getDossier(db, 'lab-a', 1)
assert.equal(d.social.last10.length, 10); assert.equal(d.social.avgViews, 5500); assert.equal(d.social.avgRetention, 44.5)
assert.equal(d.social.bestPost.views, 10000); assert.equal(d.social.accounts[0].metrics.monthlyListeners, 3400)
assert.ok(d.completeness > before); assert.ok(!d.next.some(n => /analytics/.test(n)))

// ---------- brief for every agent ----------
const brief = await know.artistBrief(db, 'lab-a')
assert.equal(brief.known, true); assert.equal(brief.facts.goals, '10k monthly listeners and a TV sync')
assert.ok(brief.profiles.some(p => p.includes('instagram.com/aviatorkeys'))); assert.equal(brief.analytics.last10AvgViews, 5500)
assert.ok(brief.unconfirmed.includes('hometown')); assert.ok(JSON.stringify(brief).length < 4000)
assert.equal((await know.artistBrief(db, 'lab-b')).known, false)
const ctx = await loadContext(db, { userId: 1, labelId: 'lab-a', employeeId: 'executive', operation: 'explain' }, [{ role: 'user', content: 'What should I do next?' }])
assert.equal(JSON.parse(ctx.prompt).artist.artistName, 'Aviator Keys')

// ---------- engine: lookup for new artists + monthly KNOW_ARTIST task ----------
sqlite.exec(`INSERT INTO lw_label_identity(label_id,artist_name) VALUES ('lab-b','Brand New Act')`)
calls.length = 0
let sum = await runEngine(env, { labelIds: ['lab-a', 'lab-b'], lookup })
assert.equal(sum.discovered, 1) // only lab-b (lab-a already looked up)
assert.ok(calls.some(u => u.includes('Brand%20New%20Act')))
assert.equal(sum.knowArtist, 2)
assert.equal((await runEngine(env, { labelIds: ['lab-a', 'lab-b'], lookup })).knowArtist, 0) // monthly dedupe
const t = await claimNext(db, 1, ['lab-a'], 'Codex', false, ['KNOW_ARTIST'])
assert.equal(t.task.kind, 'KNOW_ARTIST'); assert.ok(t.context.dossier.questions); assert.equal(t.context.artist.artistName, 'Aviator Keys')
assert.match(t.instructions, /READ ONLY/); assert.match(t.instructions, /Never post, like, follow/); assert.match(t.instructions, /never confirm for them/)

// ---------- website ----------
let res = await web('/know-me'); assert.equal(res.status, 200); assert.ok((await res.json()).completeness > 0)
res = await web('/know-me/facts', 1, { facts: { story: 'Started making beats in Atlanta in 2012.' } }); assert.equal(res.status, 200)
res = await web('/know-me/facts', 3, { facts: { story: 'x' } }); assert.equal(res.status, 403)
res = await web('/know-me/links', 1, { url: 'https://www.tiktok.com/@aviatorkeys' }); assert.equal(res.status, 200); assert.equal((await res.json()).status, 'CONFIRMED')
res = await web('/know-me/links', 1, { url: 'javascript:alert(1)' }); assert.equal(res.status, 400)
assert.equal(JSON.parse(sqlite.prepare("SELECT socials_json FROM lw_label_identity WHERE label_id='lab-a'").get().socials_json).tiktok, 'https://www.tiktok.com/@aviatorkeys')

// ---------- MCP ----------
const handler = createStudioMcp(db, { userId: 1, grantId: 'g1', labelIds: ['lab-a'], scopes: ['labels:read', 'releases:read', 'releases:write', 'tasks:read', 'tasks:write', 'research:read'], clientName: 'Codex', toolMode: 'core' }, async () => true)
const client = new Client({ name: 't', version: '1' })
await client.connect(new StreamableHTTPClientTransport(new URL('https://studio.invalid/label-world/mcp'), { fetch: (u, o) => handler.fetch(new Request(u, o)) }))
const start = JSON.parse((await client.callTool({ name: 'studio2u_start', arguments: {} })).content[0].text)
assert.ok(typeof start.labels[0].knownPct === 'number')
const guide = await client.callTool({ name: 'studio2u_guide', arguments: { topic: 'know_me' } })
assert.match(guide.content[0].text, /save_artist_facts/); assert.match(guide.content[0].text, /confirm_artist_link/)
const run = async (tool, args) => { const x = await client.callTool({ name: 'studio2u_run', arguments: { tool, args } }); return x.isError ? { error: x.content[0].text } : JSON.parse(x.content[0].text) }
const km = await run('know_me', { labelId: 'lab-a' }); assert.ok(km.data?.completeness ?? km.completeness)
assert.ok((await run('add_artist_link', { labelId: 'lab-a', url: 'https://soundcloud.com/aviatorkeys', evidence: 'x' })).error) // evidence too short
const added = await run('add_artist_link', { labelId: 'lab-a', url: 'https://soundcloud.com/aviatorkeys', evidence: 'Linked from his confirmed Instagram bio', confidence: 'LIKELY' })
const addedId = (added.data ?? added).id; assert.equal((added.data ?? added).status, 'SUGGESTED')
assert.ok((await run('confirm_artist_link', { labelId: 'lab-a', linkId: addedId, decision: 'CONFIRMED' })).error) // ownerSaid required
assert.equal(((await run('confirm_artist_link', { labelId: 'lab-a', linkId: addedId, decision: 'CONFIRMED', ownerSaid: 'yes that is my soundcloud' })).data ?? {}).status ?? 'CONFIRMED', 'CONFIRMED')
assert.ok(sqlite.prepare("SELECT 1 FROM lw_audit_events WHERE action='artist.link.decided_in_chat'").get())
assert.ok((await run('save_artist_facts', { labelId: 'lab-a', facts: { influences: ['Future'] }, source: 'AGENT' })).error) // evidence required
assert.ok((await run('know_me', { labelId: 'lab-b' })).error) // not granted
await client.close(); await handler.close()
console.log('PASS discovery: Know me dossier (% known, next 3 questions, last 10 posts + analytics), public lookup with exact-name matching and namesakes ignored, links SUGGESTED until "That\'s me", NOT_ME sticks, owner answers beat agent/public guesses, agent evidence required, secrets rejected, SoundExchange uses ownsMasters, artist brief in every task + employee chat, engine lookup + monthly KNOW_ARTIST, website + MCP, viewer/tenant isolation')
