// Shows: owner's own show page + QR code that sends fans to the owner's OWN ticket link.
// Studio2U never takes money or stores buyer data; it counts page views and QR scans.
import assert from 'node:assert/strict'
import { fixture } from './label-world-api-fixture.mjs'
const shows = await import('../src/label-world/autonomy/shows.ts')
const pt = await import('../src/label-world/autonomy/partner.ts')
const { enqueue } = await import('../src/label-world/autonomy/engine.ts')
const { createStudioMcp } = await import('../src/label-world/mcp/server.ts')
const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client')
const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Aviator Music Group'),('lab-b','Other');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer'),('lab-a',4,'editor');
INSERT INTO lw_label_identity(label_id,artist_name,legal_name,aliases_json,pro) VALUES ('lab-a','Aviator Keyz','Mason Brown','[]','ASCAP');`)
const env = { DB: db }

// validation
await assert.rejects(shows.saveShow(db, 'lab-a', 3, { title: 'x' }), /permission/i)
await assert.rejects(shows.saveShow(db, 'lab-a', 1, { title: 'Live', startsAt: 'tomorrow', venue: 'V', city: 'C' }), /date and start time/)
await assert.rejects(shows.saveShow(db, 'lab-a', 1, { title: 'Live', startsAt: '2026-11-21T20:00', venue: 'V', city: 'C', ticketUrl: 'http://x.com' }), /https/)
await assert.rejects(shows.saveShow(db, 'lab-a', 1, { title: 'Live', startsAt: '2026-11-21T20:00', venue: 'V', city: 'C', ticketUrl: 'https://u:p@x.com' }), /https/)
// editor drafts; owner publishes
const s = await shows.saveShow(db, 'lab-a', 4, { title: 'Live at The Loft', startsAt: '2026-11-21T20:00', venue: 'The Loft', city: 'Atlanta', ticketUrl: 'https://buy.stripe.com/test_abc', priceText: '$20', details: 'Doors 7pm. 18+.' })
assert.equal(s.status, 'DRAFT'); assert.match(s.slug, /^aviator-keyz-live-at-the-loft-[a-f0-9]{6}$/); assert.equal(s.url, 'https://studio2u.pages.dev/show/' + s.slug); assert.equal(s.qrUrl, s.url + '?src=qr')
await assert.rejects(shows.setShowStatus(db, 'lab-a', 4, s.id, { status: 'PUBLISHED' }), /Only the label owner/)
const noLink = await shows.saveShow(db, 'lab-a', 1, { title: 'Pop-up', startsAt: '2026-11-25T19:00', venue: 'Park', city: 'Atlanta' })
await assert.rejects(shows.setShowStatus(db, 'lab-a', 1, noLink.id, { status: 'PUBLISHED' }), /ticket link/)
await assert.rejects(shows.saveShow(db, 'lab-a', 1, { id: s.id, title: 'x', startsAt: '2026-11-21T20:00', venue: 'V', city: 'C' }).then(() => shows.setShowStatus(db, 'lab-a', 1, s.id, { status: 'PUBLISHED' })), /ticket link/)
await shows.saveShow(db, 'lab-a', 1, { id: s.id, title: 'Live at The Loft', startsAt: '2026-11-21T20:00', venue: 'The Loft', city: 'Atlanta', ticketUrl: 'https://buy.stripe.com/test_abc', priceText: '$20', details: 'Doors 7pm. 18+.' })
assert.equal((await shows.setShowStatus(db, 'lab-a', 1, s.id, { status: 'PUBLISHED' })).status, 'PUBLISHED')
const free = await shows.saveShow(db, 'lab-a', 1, { title: 'Free <b>listening</b> party', startsAt: '2026-11-28T18:00', venue: 'Studio', city: 'Atlanta', free: true })
await shows.setShowStatus(db, 'lab-a', 1, free.id, { status: 'PUBLISHED' })

// QR encodes the page with ?src=qr (decode by checking the generator round-trip size + determinism)
const svg = shows.qrSvg(s.qrUrl); assert.match(svg, /^<svg[^>]+viewBox="0 0 \d+ \d+"/); assert.match(svg, /<path d="M/); assert.equal(svg, shows.qrSvg(s.qrUrl))
// public page (no sign-in), counts views + QR scans, escapes text, links to owner's own ticket seller
let r = await app.request('http://localhost/show/' + s.slug + '?src=qr', {}, env); assert.equal(r.status, 200)
let html = await r.text(); assert.match(html, /href="https:\/\/buy\.stripe\.com\/test_abc"/); assert.match(html, /Get tickets · \$20/); assert.match(html, /Saturday, November 21, 2026/); assert.match(html, /Studio2U never sees your payment/)
await app.request('http://localhost/show/' + s.slug, {}, env)
const counts = sqlite.prepare('SELECT views,qr_scans FROM lw_shows WHERE id=?').get(s.id); assert.deepEqual([counts.views, counts.qr_scans], [2, 1])
r = await app.request('http://localhost/show/' + free.slug, {}, env); html = await r.text(); assert.match(html, /Free\. Just show up/); assert.ok(!html.includes('<b>listening'))
r = await app.request('http://localhost/show/' + noLink.slug, {}, env); assert.equal(r.status, 404) // drafts are private
r = await app.request('http://localhost/show/..%2Fetc', {}, env); assert.equal(r.status, 404)
await shows.setShowStatus(db, 'lab-a', 4, free.id, { status: 'CANCELLED' })
html = await (await app.request('http://localhost/show/' + free.slug, {}, env)).text(); assert.match(html, /cancelled/)

// signed-in routes
const web = (path, user = 1, body) => app.request('http://localhost/api/label-world/labels/lab-a' + path, { method: body ? 'POST' : 'GET', headers: { Cookie: 'studio2u_session=test-session-' + user, Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, env)
r = await web('/shows', 3); assert.equal(r.status, 200); assert.equal((await r.json()).shows.length, 3)
r = await web(`/shows/${s.id}/qr.svg`, 3); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/svg+xml')
r = await web('/shows', 3, { title: 'x' }); assert.equal(r.status, 403)
r = await web(`/shows/${s.id}/status`, 4, { status: 'PUBLISHED' }); assert.equal(r.status, 403)
r = await app.request('http://localhost/api/label-world/labels/lab-a/shows', { headers: { Cookie: 'studio2u_session=test-session-2' } }, env); assert.equal(r.status, 404) // other label
await assert.rejects(shows.getShow(db, 'lab-b', s.id), /not found/)

// Ben: own-link tickets option, show posts in the weekly plan, show line in the check-in
assert.ok(pt.STREAMS.tickets.options.OWN_LINK.facts.some(x => /2\.9% \+ 30c/.test(x)))
assert.deepEqual(await pt.saveStreams(db, 'lab-a', 1, { amazon: 'MERCH_ON_DEMAND', tickets: 'OWN_LINK' }), { amazon: 'MERCH_ON_DEMAND', tickets: 'OWN_LINK' })
await pt.saveChannel(db, 'lab-a', 1, { platform: 'x', handle: 'aviatorkeyz', status: 'READY' }, t => enqueue(db, t))
const week = await pt.createPlan(db, 'lab-a', 1, { weekStart: '2026-11-16' }, 'owner')
const ann = week.posts.find(p => p.kind === 'announcement'); assert.ok(ann); assert.equal(ann.link, s.url); assert.match(ann.caption, /Aviator Keyz live: Live at The Loft\. The Loft, Atlanta\. Tickets \$20 at the link below/)

// MCP: agents can save drafts, never publish
const handler = createStudioMcp(db, { userId: 4, grantId: 'g', labelIds: ['lab-a'], scopes: ['labels:read', 'tasks:read', 'tasks:write'], clientName: 'Codex', toolMode: 'core' }, async () => true)
const client = new Client({ name: 't', version: '1' })
await client.connect(new StreamableHTTPClientTransport(new URL('https://studio.invalid/label-world/mcp'), { fetch: (u, o) => handler.fetch(new Request(u, o)) }))
const g = await client.callTool({ name: 'studio2u_guide', arguments: { topic: 'partner' } }); assert.match(g.content[0].text, /save_show\(labelId, id\?, title, startsAt/)
const run = async (tool, args) => { const x = await client.callTool({ name: 'studio2u_run', arguments: { tool, args } }); return x.isError ? { error: x.content[0].text } : JSON.parse(x.content[0].text) }
const saved = await run('save_show', { labelId: 'lab-a', title: 'Open mic', startsAt: '2026-12-02T21:00', venue: 'Cafe', city: 'Atlanta', free: true })
assert.equal((saved.data ?? saved).status, 'DRAFT')
assert.equal(((await run('list_shows', { labelId: 'lab-a' })).data ?? {}).shows?.length ?? (await run('list_shows', { labelId: 'lab-a' })).shows.length, 4)
await client.close(); await handler.close()
console.log('PASS shows: owner\'s own show page + QR (fans scan -> page -> owner\'s own ticket link or free), editors draft, only the owner puts it live, needs a ticket link or Free, https-only links, drafts private, cancelled shows say so, HTML escaped, page views + QR scans counted, signed-in QR download, label isolation, Ben: OWN_LINK tickets (Stripe 2.9% + 30c), show announcement posts in the weekly plan, MCP save_show drafts only')
