// Playbooks, artist identity, catalog import and Money Found cases:
// MCP agent flow + website owner approval gate + engine follow-ups. No network, no model.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from './label-world-api-fixture.mjs'
const { createStudioMcp, mcpScopes, readScopes } = await import('../src/label-world/mcp/server.ts')
const { runEngine } = await import('../src/label-world/autonomy/engine.ts')
const { ascapClaimDeadline, suggestPlaybooks, PLAYBOOKS, STANDING_RULES } = await import('../src/label-world/autonomy/playbooks.ts')
const cases = await import('../src/label-world/autonomy/cases.ts')
const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client')

const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Aviator Music Group'),('lab-b','Other');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer');`)
const env = { DB: db, LLM_KEY_ENCRYPTION_SECRET: Buffer.alloc(32, 7).toString('base64') }

// ---------- verified facts ----------
assert.equal(ascapClaimDeadline('2024-10-01'), '2027-01-31') // official ASCAP example
assert.equal(ascapClaimDeadline('2025-09-30'), '2027-01-31')
assert.equal(ascapClaimDeadline('2024-10-15', 'publisher'), '2026-12-31')
assert.equal(ascapClaimDeadline('2025-11'), '2028-01-31')
assert.equal(ascapClaimDeadline('garbage'), null)
assert.equal(suggestPlaybooks('my song was on Baddies and I never got the cue sheet')[0].id, 'tv-cue-sheet')
assert.equal(suggestPlaybooks('another artist is using my name, I want a cease and desist')[0].id, 'name-dispute')
assert.equal(suggestPlaybooks('I only have 8 of my 60 songs registered with ASCAP')[0].id, 'register-songs')
assert.equal(suggestPlaybooks('does SoundExchange have money for me')[0].id, 'soundexchange-money')
assert.equal(suggestPlaybooks('the artist never paid me my percentage on the feature')[0].id, 'unpaid-split')
assert.ok(PLAYBOOKS.every(p => p.steps.length && p.summary && p.owner))
assert.ok(STANDING_RULES.some(r => /Ask before acting/.test(r)) && STANDING_RULES.some(r => /not a lawyer/.test(r)))
assert.ok(PLAYBOOKS.find(p => p.id === 'artwork').steps.join(' ').includes('3000×3000'))
assert.ok(PLAYBOOKS.find(p => p.id === 'soundexchange-money').facts.some(x => /3 years/.test(x)))
assert.ok(PLAYBOOKS.find(p => p.id === 'tv-cue-sheet').contacts.some(c => c.how.includes('tvcuesheet@ascap.com')))

// ---------- catalog lookup (mocked public APIs) ----------
const fake = async url => {
  if (url.includes('deezer.com/search/artist')) return { data: [{ id: 111, name: 'Aviator Keyz', nb_album: 4, nb_fan: 14, link: 'https://www.deezer.com/artist/111' }] }
  if (url.includes('itunes.apple.com/search')) return { results: [{ artistId: 222, artistName: 'Aviator Keys', primaryGenreName: 'Hip-Hop/Rap', artistLinkUrl: 'https://music.apple.com/x' }] }
  if (url.includes('deezer.com/artist/111/albums')) return { data: [{ id: 9, title: 'Heartbreak City', release_date: '2019-05-01' }] }
  if (url.includes('deezer.com/album/9/tracks')) return { data: [{ id: 1, title: '22', isrc: 'QZ85M1979735', duration: 196, explicit_lyrics: true, link: 'https://www.deezer.com/track/1', artist: { name: 'Aviator Keyz' } }, { id: 2, title: 'Night Drive', isrc: 'QZ85M1979736', duration: 180, artist: { name: 'Aviator Keyz' } }] }
  if (url.includes('itunes.apple.com/lookup')) return { results: [{ wrapperType: 'artist' }, { wrapperType: 'track', trackId: 5, trackName: 'Crash and Burn (feat. Aviator Keys)', artistName: 'Will2live', collectionName: 'Will2live', releaseDate: '2013-02-25T08:00:00Z', trackTimeMillis: 200000, trackViewUrl: 'https://music.apple.com/t' }] }
  throw new Error('unexpected ' + url)
}
const found = await cases.searchCatalog('Aviator Keys', fake)
assert.equal(found.artists[0].name, 'Aviator Keys'); assert.equal(found.artists[0].exact, true) // exact match ranked first
const tracks = [...await cases.artistTracks('deezer', '111', fake), ...await cases.artistTracks('itunes', '222', fake)]
assert.equal(tracks.length, 3); assert.ok(tracks.some(t => t.title.includes('feat. Aviator Keys'))) // features included
await assert.rejects(cases.artistTracks('deezer', '1;drop', fake), /artistId/)
await assert.rejects(cases.importTracks(db, 'lab-a', 3, tracks), /permission|Editing|viewer/i) // viewer cannot import
const imp = await cases.importTracks(db, 'lab-a', 1, tracks)
assert.equal(imp.added, 3); assert.equal(imp.songs, 3)
assert.equal((await cases.importTracks(db, 'lab-a', 1, tracks)).added, 0) // idempotent

// ---------- MCP agent session (Codex) ----------
async function connect(user, labels, scopes, name = 'Codex') {
  let valid = true
  const handler = createStudioMcp(db, { userId: user, grantId: 'g' + user, labelIds: labels, scopes, clientName: name }, async () => valid)
  const client = new Client({ name: 'test', version: '1' })
  await client.connect(new StreamableHTTPClientTransport(new URL('https://studio.invalid/label-world/mcp'), { fetch: (u, o) => handler.fetch(new Request(u, o)) }))
  const call = async (tool, args = {}) => { const r = await client.callTool({ name: 'studio2u_' + tool, arguments: args }); return r.isError ? { error: r.content[0].text } : r.structuredContent.data }
  return { client, call, close: async () => { await client.close(); await handler.close() } }
}
const ro = await connect(1, ['lab-a'], [...readScopes], 'Read only')
const roTools = (await ro.client.listTools()).tools.map(t => t.name)
assert.ok(roTools.includes('studio2u_list_playbooks') && roTools.includes('studio2u_list_cases'))
assert.ok(!roTools.includes('studio2u_open_case') && !roTools.includes('studio2u_draft_case_message') && !roTools.includes('studio2u_mark_draft_sent'))
await ro.close()

const a = await connect(1, ['lab-a'], [...mcpScopes])
const pb = await a.call('list_playbooks', { match: 'my song was on Baddies on Zeus and I never got paid, no cue sheet' })
assert.equal(pb.suggested[0].id, 'tv-cue-sheet'); assert.ok(pb.standingRules.length >= 6)
assert.ok((await a.call('get_playbook', { playbook: 'tv-cue-sheet' })).steps.length >= 6)
assert.ok((await a.call('save_artist_profile', { labelId: 'lab-b', artistName: 'X' })).error) // other label
const prof = await a.call('save_artist_profile', { labelId: 'lab-a', artistName: 'Aviator Keys', legalName: 'Mason Brown', aliases: ['Aviator Keyz'], pro: 'ASCAP', firstUsedYear: 2014, socials: { instagram: 'https://instagram.com/aviatorkeys' } })
assert.equal(prof.profile.artistName, 'Aviator Keys'); assert.equal(prof.profile.firstUsedYear, 2014)
assert.ok((await a.call('save_artist_profile', { labelId: 'lab-a', artistName: 'A', pro: 'FAKE' })).error)
const cat = await a.call('list_catalog', { labelId: 'lab-a' })
assert.equal(cat.tracks.length, 3)
const t22 = cat.tracks.find(t => t.title === '22')
assert.equal((await a.call('update_catalog_track', { labelId: 'lab-a', trackId: t22.id, proStatus: 'REGISTERED' })).proRegistered, 1)
assert.equal((await a.call('update_catalog_track', { labelId: 'lab-a', trackId: cat.tracks.find(t => t.title === 'Night Drive').id, proStatus: 'NOT_REGISTERED' })).proMissing, 1)

// Open a TV case from plain words; deadline computed from the air date.
const opened = await a.call('open_case', { labelId: 'lab-a', playbook: 'tv-cue-sheet', title: 'Baddies placement never paid', facts: { show: 'Baddies', network: 'Zeus', airDate: '2025-03', songTitle: '22' } })
const C = opened.case.id
assert.equal(opened.case.deadline, '2027-01-31'); assert.match(opened.case.deadlineNote, /ASCAP writer claim window/)
assert.equal(opened.case.status, 'WAITING_ON_YOU') // writers still needed
assert.ok(opened.stillNeeded.some(n => n.key === 'writers'))
assert.ok((await a.call('open_case', { labelId: 'lab-a', playbook: 'not-real' })).error)
assert.ok((await a.call('open_case', { labelId: 'lab-a', playbook: 'tv-cue-sheet', facts: { 'bad key!': 1 } })).error)
const up = await a.call('update_case', { labelId: 'lab-a', caseId: C, facts: { writers: 'Mason Brown 50% (ASCAP), producer 50%' }, status: 'OPEN', step: 2, note: 'Found production company in IMDb credits.' })
assert.equal(up.case.step, 2); assert.ok(!up.stillNeeded.some(n => n.key === 'writers'))
assert.ok(up.events.some(e => /IMDb/.test(e.body)))

// Draft → cannot send before approval → agent cannot approve.
const dr = await a.call('draft_case_message', { labelId: 'lab-a', caseId: C, kind: 'EMAIL', recipient: 'Baddies music department', recipientEmail: 'music@example.invalid', subject: 'Cue sheet request: Baddies', body: 'Hello, please file the cue sheet for "22"...' })
assert.equal(dr.status, 'DRAFT')
assert.ok((await a.call('draft_case_message', { labelId: 'lab-a', caseId: C, recipientEmail: 'not-an-email', body: 'x' })).error)
assert.match((await a.call('mark_draft_sent', { labelId: 'lab-a', draftId: dr.draftId })).error, /owner-approved/)
assert.equal((await a.call('list_approved_drafts', { labelId: 'lab-a' })).drafts.length, 0)
const toolNames = (await a.client.listTools()).tools.map(t => t.name)
assert.ok(!toolNames.some(n => /(^|_)(approve|decide|reject)(_|$)/.test(n.replace('studio2u_', '')))) // no MCP path to approval
assert.equal((await a.call('list_cases', { labelId: 'lab-a' })).cases[0].drafts_waiting, 1)

// ---------- website: owner approval gate ----------
const origin = 'https://studio.invalid'
const req = (path, method = 'GET', body, user = 1) => app.request(origin + path, { method, headers: { Cookie: `studio2u_session=test-session-${user}`, ...(method === 'POST' ? { 'Content-Type': 'application/json', Origin: origin } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }, env)
const board = await (await req('/api/label-world/labels/lab-a/cases')).json()
assert.equal(board.cases[0].id, C)
assert.equal((await req('/api/label-world/labels/lab-a/cases', 'GET', null, 2)).status, 404) // other tenant
assert.equal((await req(`/api/label-world/labels/lab-a/drafts/${dr.draftId}/decision`, 'POST', { decision: 'APPROVED' }, 3)).status, 403) // viewer
const approve = await req(`/api/label-world/labels/lab-a/drafts/${dr.draftId}/decision`, 'POST', { decision: 'APPROVED', body: 'Hello, please file the cue sheet for "22" (edited by owner).' })
assert.equal(approve.status, 200)
assert.equal((await req(`/api/label-world/labels/lab-a/drafts/${dr.draftId}/decision`, 'POST', { decision: 'APPROVED' })).status, 409)
const approved = (await a.call('list_approved_drafts', { labelId: 'lab-a' })).drafts
assert.equal(approved.length, 1); assert.match(approved[0].body, /edited by owner/)
const sent = await a.call('mark_draft_sent', { labelId: 'lab-a', draftId: dr.draftId, note: 'Sent from owner Gmail' })
assert.equal(sent.status, 'SENT'); assert.equal(sent.followUpInDays, 7)
const after = await (await req(`/api/label-world/labels/lab-a/cases/${C}`)).json()
assert.equal(after.case.status, 'WAITING_ON_THEM'); assert.ok(after.events.some(e => e.kind === 'SENT'))
assert.ok(after.playbook.standingRules.length)

// Website: profile, playbooks, catalog search route is reachable and validates.
assert.equal((await (await req('/api/label-world/labels/lab-a/artist-profile')).json()).profile.legalName, 'Mason Brown')
assert.equal((await (await req('/api/label-world/labels/lab-a/playbooks?match=soundexchange')).json()).suggested[0].id, 'soundexchange-money')
assert.equal((await req('/api/label-world/labels/lab-a/catalog/search?name=')).status, 400)
assert.equal((await req('/api/label-world/labels/lab-a/catalog/import', 'POST', { profiles: [] })).status, 400)
const web = await req('/api/label-world/labels/lab-a/cases', 'POST', { playbook: 'name-dispute', facts: { otherArtist: 'Aviator Keys (2nd)', firstUse: '2014' } })
assert.equal(web.status, 201)

// ---------- engine: due follow-up becomes one CASE_STEP task with the case context ----------
sqlite.prepare("UPDATE lw_cases SET next_follow_up_at='2000-01-01T00:00:00Z' WHERE id=?").run(C)
const s1 = await runEngine(env, { labelIds: ['lab-a'] }), s2 = await runEngine(env, { labelIds: ['lab-a'] })
assert.equal(s1.cases, 1); assert.equal(s2.cases, 0)
const claimed = await a.call('claim_next_task', { canControlScreen: false, kinds: ['CASE_STEP'] })
assert.equal(claimed.task.kind, 'CASE_STEP'); assert.equal(claimed.context.case.case.id, C)
assert.match(claimed.instructions, /never send until the owner approves/)
assert.ok(claimed.context.case.playbook.steps.length)
await a.close()
sqlite.close()
console.log('PASS playbooks: 8 label skills with verified facts (ASCAP cue-sheet retro deadline, SoundExchange 3-year expiry, 3000px art), plain-language playbook matching, artist identity, "Is this you?" catalog import incl. features, PRO/SoundExchange per-song tracking, Money Found cases from MCP and web, owner-only draft approval with edit, send-gate, follow-up scheduling, engine CASE_STEP tasks, tenant/viewer isolation.')
