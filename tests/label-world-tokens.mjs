// Token budget + compact tool surface + UnitedMasters lint + social snapshots + agent status.
// The tool list is re-sent to the model every turn, so we enforce a hard budget.
import assert from 'node:assert/strict'
import { fixture } from './label-world-api-fixture.mjs'
const { createStudioMcp, mcpScopes, readScopes } = await import('../src/label-world/mcp/server.ts')
const { lintRelease } = await import('../src/label-world/autonomy/lint.ts')
const { suggestPlaybooks, SCREEN_POLICY, PLAYBOOKS } = await import('../src/label-world/autonomy/playbooks.ts')
const { SHIFT_PROMPT } = await import('../src/label-world/autonomy/mcp-tools.ts')
const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client')

const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('L','Aviator'),('X','Other');INSERT INTO lw_memberships VALUES ('L',1,'owner'),('X',2,'owner'),('L',3,'viewer');
INSERT INTO lw_employee_messages(id,label_id,user_id,agent_id,role,content,status) VALUES ('m1','L',1,'executive','user','Can you hear me','WAITING_FOR_PROVIDER');
INSERT INTO lw_releases(id,label_id,title,artist,release_type,metadata_json) VALUES ('r1','L','Night Drive (feat. Que Banz) [Official Audio]','Aviator Keys','single','{"intake":{"featuredArtists":["prod. by Mike","A & B"],"recordLabel":"Atlantic Records","containsThirdPartyAudio":true,"releaseDate":"2026-10-30"}}');`)
async function connect(user, labels, scopes, toolMode, name = 'Codex') {
  const h = createStudioMcp(db, { userId: user, grantId: 'g' + user, labelIds: labels, scopes, clientName: name, toolMode }, async () => true)
  const c = new Client({ name: 't', version: '1' }); await c.connect(new StreamableHTTPClientTransport(new URL('https://studio.invalid/label-world/mcp'), { fetch: (u, o) => h.fetch(new Request(u, o)) }))
  return { c, close: async () => { await c.close(); await h.close() } }
}
const tok = s => Math.round(JSON.stringify(s).length / 3.6)

// ---------- budget ----------
const core = await connect(1, ['L'], [...mcpScopes, 'offline_access'], 'core')
const coreTools = (await core.c.listTools()).tools
assert.deepEqual(coreTools.map(t => t.name).sort(), ['studio2u_guide', 'studio2u_run', 'studio2u_start'])
const perTurn = tok(coreTools)
assert.ok(perTurn < 600, `core tool list must stay under 600 tokens/turn, got ${perTurn}`)
const full = await connect(1, ['L'], [...mcpScopes, 'offline_access'], 'all')
const fullTokens = tok((await full.c.listTools()).tools)
assert.ok(fullTokens > perTurn * 8, 'compact surface should be >8x smaller than the full list')
assert.ok((await full.c.listTools()).tools.every(t => !t.outputSchema), 'no outputSchema bloat in full mode either')
await full.close()

// start: one call with everything needed
const start = JSON.parse((await core.c.callTool({ name: 'studio2u_start', arguments: {} })).content[0].text)
assert.equal(start.labels[0].unansweredMessages, 1); assert.ok(start.next[0].includes('inbox')); assert.ok(start.rules.length)
assert.ok(tok(start) < 700)
assert.ok(!start.labels.some(l => l.labelId === 'X'), 'only authorized labels')

// guide: compact signatures, each topic small
for (const t of ['inbox', 'cases', 'catalog', 'releases', 'submissions', 'queue', 'research', 'account']) {
  const g = await core.c.callTool({ name: 'studio2u_guide', arguments: { topic: t } })
  assert.ok(!g.isError, t); assert.ok(tok(g.content[0].text) < 700, `${t} guide too big`)
}
assert.match((await core.c.callTool({ name: 'studio2u_guide', arguments: { topic: 'inbox' } })).content[0].text, /reply_to_message\(labelId, messageId, reply\)/)
assert.ok((await core.c.callTool({ name: 'studio2u_guide', arguments: { topic: 'nope' } })).isError)
const pb = await core.c.callTool({ name: 'studio2u_guide', arguments: { topic: 'playbook:release-check' } })
assert.match(pb.content[0].text, /lint_release/); assert.match(pb.content[0].text, /screenPolicy/)

// run: validation, permissions, compact output
const run = (tool, args) => core.c.callTool({ name: 'studio2u_run', arguments: { tool, args } })
assert.match((await run('reply_to_message', { labelId: 'L' })).content[0].text, /Invalid args for reply_to_message/)
assert.ok((await run('studio2u_start', {})).isError)
assert.ok((await run('does_not_exist', {})).isError)
assert.ok((await run('list_unanswered_messages', { labelId: 'X' })).isError) // other tenant
const listed = JSON.parse((await run('list_unanswered_messages', { labelId: 'L' })).content[0].text)
assert.equal(listed.messages[0].id, 'm1')
const replied = await run('reply_to_message', { labelId: 'L', messageId: 'm1', reply: 'Yes, I hear you. Here is the plan.' })
assert.ok(!replied.isError)
assert.equal(sqlite.prepare("SELECT status FROM lw_employee_messages WHERE id='m1'").get().status, 'COMPLETED')

// read-only connection: run cannot reach write tools
const ro = await connect(1, ['L'], [...readScopes], 'core', 'RO')
assert.ok((await ro.c.callTool({ name: 'studio2u_run', arguments: { tool: 'reply_to_message', args: { labelId: 'L', messageId: 'm1', reply: 'x' } } })).isError)
assert.match((await ro.c.callTool({ name: 'studio2u_guide', arguments: { topic: 'inbox' } })).content[0].text, /list_unanswered_messages/)
assert.doesNotMatch((await ro.c.callTool({ name: 'studio2u_guide', arguments: { topic: 'inbox' } })).content[0].text, /reply_to_message/)
await ro.close()

// ---------- UnitedMasters lint ----------
const lint = JSON.parse((await run('lint_release', { labelId: 'L', releaseId: 'r1' })).content[0].text)
const has = (field, re) => lint.issues.some(i => i.field === field && re.test(i.problem))
assert.equal(lint.ok, false)
assert.ok(has('Release title', /Official Audio|feat/))
assert.ok(lint.issues.some(i => i.field === 'Featured artists' && /role word/.test(i.problem)))
assert.ok(lint.issues.some(i => i.field === 'Featured artists' && /several names/.test(i.problem)))
assert.ok(lint.issues.some(i => i.field === 'Label' && i.severity === 'BLOCKER'))
assert.ok(lint.issues.some(i => i.field === 'Beat / samples' && i.severity === 'BLOCKER'))
assert.ok(lint.issues.some(i => i.field === 'Release date'))
assert.ok(lint.issues.some(i => i.field === 'Artist profiles'))
assert.ok(lint.issues.some(i => i.field === 'Cover art' && i.severity === 'BLOCKER'))
const clean = lintRelease({ title: 'Night Drive', artist: 'Aviator Keys', release_type: 'single' }, { recordLabel: 'Aviator Music Group', releaseDate: '2027-02-01', explicit: true, featuredArtists: ['Que Banz'] }, { artwork: true, artworkCheck: 'PASS', master: true }, { spotifyArtistId: 'abc' })
assert.equal(clean.ok, true, JSON.stringify(clean.issues))
assert.ok(lintRelease({ title: 'F**k It', artist: 'A', release_type: 'single' }, {}, { artwork: true, master: true }).issues.some(i => /censored/.test(i.problem)))
assert.ok(!lintRelease({ title: 'Night Drive (Remix)', artist: 'A', release_type: 'single' }, {}, { artwork: true, master: true }).issues.some(i => i.field === 'Release title'))

// ---------- social snapshots (read-only intel) ----------
const saved = await run('save_social_snapshot', { labelId: 'L', items: [{ platform: 'instagram', kind: 'MY_POST', title: 'Studio clip', metrics: { views: 12000, skipRate: 0.31, avgWatchSec: 6.2 } }, { platform: 'youtube_charts', kind: 'CHART', title: 'Top song', metrics: { rank: 1 } }] })
assert.ok(!saved.isError, saved.content[0].text)
const snaps = JSON.parse((await run('list_social_snapshots', { labelId: 'L', platform: 'instagram' })).content[0].text)
assert.equal(snaps.items[0].metrics.views, 12000); assert.equal(snaps.items.length, 1)
const viewer = await connect(3, ['L'], [...mcpScopes], 'core', 'V')
assert.ok((await viewer.c.callTool({ name: 'studio2u_run', arguments: { tool: 'save_social_snapshot', args: { labelId: 'L', items: [{ platform: 'tiktok', kind: 'MY_POST', title: 'x' }] } } })).isError)
await viewer.close()

// ---------- playbooks / prompt ----------
for (const [q, id] of [['show me my instagram retention', 'social-intel'], ['what is trending on youtube right now', 'trend-scout'], ['my release got rejected by unitedmasters', 'release-check'], ['my song was on a tv show and I never got paid', 'tv-cue-sheet']]) assert.equal(suggestPlaybooks(q)[0].id, id, q)
assert.ok(SCREEN_POLICY.some(r => /only when there is no API/.test(r)) && SCREEN_POLICY.some(r => /Never post, like/.test(r)))
assert.ok(PLAYBOOKS.find(p => p.id === 'social-intel').followUpDays[0] >= 14) // not daily
assert.ok(SHIFT_PROMPT.includes('studio2u_start') && SHIFT_PROMPT.length < 1400)
await core.close()

// ---------- website: agent status + Spotify/Apple links ----------
const origin = 'https://studio.invalid', req = (p, m = 'GET', b, u = 1) => app.request(origin + p, { method: m, headers: { Cookie: `studio2u_session=test-session-${u}`, ...(m === 'POST' ? { 'Content-Type': 'application/json', Origin: origin } : {}) }, ...(b ? { body: JSON.stringify(b) } : {}) }, { DB: db })
assert.equal((await (await req('/api/label-world/agent-status?labelId=L')).json()).state, 'NO_AGENT')
sqlite.exec(`INSERT INTO lw_mcp_clients(id,name,redirects_json) VALUES ('c1','Codex','[]');INSERT INTO lw_mcp_grants(id,client_id,user_id,resource,labels_json,scopes_json,expires_at) VALUES ('gr1','c1',1,'r','["L"]','[]','2099-01-01T00:00:00Z')`)
const s1 = await (await req('/api/label-world/agent-status?labelId=L')).json()
assert.equal(s1.state, 'LOGGED_IN_NEVER_USED'); assert.equal(s1.client, 'Codex')
sqlite.prepare("UPDATE lw_mcp_grants SET last_used_at=? WHERE id='gr1'").run(new Date().toISOString())
assert.equal((await (await req('/api/label-world/agent-status?labelId=L')).json()).state, 'AGENT_ACTIVE')
assert.equal((await (await req('/api/label-world/agent-status?labelId=L', 'GET', null, 2)).json()).state, 'NO_AGENT') // not another user's grant
const prof = await (await req('/api/label-world/labels/L/artist-profile', 'POST', { artistName: 'Aviator Keys', spotifyArtistUrl: 'https://open.spotify.com/artist/6qxpnaukVayrQn6ViNvu9I?si=x', appleArtistUrl: 'https://music.apple.com/us/artist/aviator-keys/657923276' })).json()
assert.equal(prof.profile.spotifyArtistId, '6qxpnaukVayrQn6ViNvu9I'); assert.equal(prof.profile.appleArtistId, '657923276')
assert.equal((await req('/api/label-world/labels/L/artist-profile', 'POST', { artistName: 'A', spotifyArtistUrl: 'https://example.com/x' })).status, 400)
sqlite.close()
console.log(`PASS tokens: compact MCP surface ${perTurn} tok/turn vs ${fullTokens} full (budget <600), start/guide/run with validation + permissions + tenant isolation, compact results; UnitedMasters lint (titles, credits, label, samples, art, date, profile links); read-only social snapshots; screen-use policy; social/trend/release playbooks; agent status (NO_AGENT → LOGGED_IN_NEVER_USED → AGENT_ACTIVE); Spotify/Apple profile links.`)
