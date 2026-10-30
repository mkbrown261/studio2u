// Merch with no inventory through the owner's own free Fourthwall shop. All network mocked:
// connect (owner only, key encrypted, never returned), PNG checks, upload/AI design with the
// owner's own OpenAI key (budget), brand/character block, approve needs rights confirmation,
// mockups on a HIDDEN product, owner-only Publish, profit math, sales, MCP ideas, isolation.
import assert from 'node:assert/strict'
import { fixture } from './label-world-api-fixture.mjs'
const merch = await import('../src/label-world/autonomy/merch.ts')
const { encryptKey, keyContext } = await import('../src/label-world/providers/vault.ts')
const { suggestPlaybooks } = await import('../src/label-world/autonomy/playbooks.ts')
const { createStudioMcp } = await import('../src/label-world/mcp/server.ts')
const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client')

const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Aviator Music Group'),('lab-b','Other');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer'),('lab-a',4,'editor');
INSERT INTO lw_label_identity(label_id,artist_name,legal_name,aliases_json,pro) VALUES ('lab-a','Aviator Keys','Mason Brown','[]','ASCAP');`)
const objects = new Map()
const R2 = { async put(k, b) { objects.set(k, new Uint8Array(b)) }, async get(k) { const b = objects.get(k); return b ? { arrayBuffer: async () => b.slice().buffer } : null } }
const env = { DB: db, R2, LLM_KEY_ENCRYPTION_SECRET: Buffer.alloc(32, 9).toString('base64') }

// PNG with an IHDR: width/height/colorType (6 = RGBA -> transparent)
const png = (w, h, ct = 6, extra = 200) => { const b = Buffer.alloc(33 + extra); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(b, 0); b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); b[24] = 8; b[25] = ct; return new Uint8Array(b) }
assert.deepEqual(merch.pngInfo(png(2250, 2700)), { width: 2250, height: 2700, transparent: true })
assert.equal(merch.pngInfo(png(800, 800, 2)).transparent, false)
assert.throws(() => merch.pngInfo(new Uint8Array(Buffer.from('GIF89a' + 'x'.repeat(40)))), /Upload a PNG/)
// profit math: $9.50 tee + $15 margin -> $24.50; card fee 2.9% + $0.30 = $1.01; keep $13.99
assert.deepEqual(merch.profitPerSale(9.5, 15), { price: 24.5, fee: 1.01, keep: 13.99 })

// ---------- mocked Fourthwall ----------
const calls = []
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fwFetch = async (url, init = {}) => {
  const auth = init.headers?.Authorization; calls.push({ url, method: init.method ?? 'GET', auth, body: init.body && typeof init.body === 'string' ? JSON.parse(init.body) : null })
  if (url.startsWith('https://upload.fourthwall.test/')) return new Response(null, { status: 200 })
  if (url.includes('/product-templates/')) return json(200, { name: 'Gildan Unisex Softstyle T-Shirt', priceFrom: { amount: 9.5 }, priceTo: { amount: 13.5 }, colorVariants: [{ available: true, color: { name: 'Black', hex: '#212121' } }, { available: true, color: { name: 'White', hex: '#ffffff' } }], customizableAreas: [{ regionId: 'front_large', dimensions: { pixelsWidth: 2250, pixelsHeight: 2700 } }] })
  if (auth !== 'Basic ' + Buffer.from('apiuser:apipass').toString('base64')) return json(401, { code: 'UNAUTHORIZED' })
  if (url.endsWith('/shops/current')) return json(200, { id: 'sh_1', name: 'Aviator Shop', domain: 'aviator.fourthwall.com', publicDomain: 'aviatorkeys.com', status: 'COMING_SOON' })
  if (url.endsWith('/media/upload-url')) return json(201, { uploadUrl: 'https://upload.fourthwall.test/put/1', fileUrl: 'https://cdn.fourthwall.test/f/1.png' })
  if (url.endsWith('/media/images')) return json(200, { id: 'img_1', uri: 'x', width: 2250, height: 2700, thumbnail: 't', preview: 'p' })
  if (url.endsWith('/products') && init.method === 'POST') return json(201, { productId: 'pr_1', customizationId: 'cu_1', images: [{ url: 'https://imgproxy.fourthwall.dev/m1.jpg', color: 'Black', width: 800, height: 800, style: 'flat' }, { url: 'https://evil.example.com/m2.jpg', color: 'White', width: 800, height: 800, style: 'model' }] })
  if (/\/products\/pr_1\/state$/.test(url)) return json(200, { id: 'pr_1' })
  if (url.includes('/order?')) return json(200, { results: [{ id: 'o1', friendlyId: 'A1', status: 'SHIPPED', createdAt: '2026-10-29', amounts: { total: { value: 30, currency: 'USD' } }, offers: [{ variant: { quantity: 2, unitPrice: { value: 24.5, currency: 'USD' }, unitCost: { value: 9.5, currency: 'USD' } } }] }, { id: 'o2', status: 'CANCELLED', offers: [{ variant: { quantity: 1, unitPrice: { value: 24.5 }, unitCost: { value: 9.5 } } }] }] })
  return json(404, { code: 'NOT_FOUND' })
}

// ---------- connect: owner only, key encrypted, never returned ----------
await assert.rejects(merch.connectShop(env, 'lab-a', 4, { username: 'apiuser', password: 'apipass' }, fwFetch), /Only the label owner/)
await assert.rejects(merch.connectShop(env, 'lab-a', 1, { username: 'apiuser', password: 'wrong' }, fwFetch), /rejected the API key/)
const con = await merch.connectShop(env, 'lab-a', 1, { username: 'apiuser', password: 'apipass' }, fwFetch)
assert.equal(con.shop.name, 'Aviator Shop'); assert.match(con.say, /coming soon/)
const stored = sqlite.prepare("SELECT encrypted_creds,shop_json FROM lw_merch_shops WHERE label_id='lab-a'").get()
assert.ok(!stored.encrypted_creds.includes('apipass')); assert.ok(!stored.shop_json.includes('apipass'))
let ov = await merch.merchOverview(env, 'lab-a', 3)
assert.equal(ov.shop.name, 'Aviator Shop'); assert.ok(!JSON.stringify(ov).includes('apipass')); assert.equal(ov.kinds.length, 6)

// ---------- designs ----------
await assert.rejects(merch.uploadDesign(env, 'lab-a', 3, png(2250, 2700), 'x'), /permission/i)
const up = await merch.uploadDesign(env, 'lab-a', 4, png(1000, 1000, 2), '22 tee')
assert.equal(up.warnings.length, 2) // not transparent + small
const good = await merch.uploadDesign(env, 'lab-a', 1, png(2250, 2700), '22 gold tee')
assert.equal(good.warnings.length, 0); assert.equal((await merch.designImage(env, 'lab-a', 3, good.id)).length, png(2250, 2700).length)
await assert.rejects(merch.designImage(env, 'lab-b', 2, good.id), /Not found/)
// ideas: brand block, nothing generated
await assert.rejects(merch.addIdea(db, 'lab-a', 1, { title: 'Swoosh tee', prompt: 'a Nike swoosh with my name' }, 'Codex'), /No other brands/)
const idea = await merch.addIdea(db, 'lab-a', 1, { title: 'Broken heart 22', prompt: 'Big gold "22" in graffiti letters with a broken heart, black and gold' }, 'Codex')
assert.equal(idea.status, 'IDEA')
// AI: needs owner's OpenAI key, respects budget, records spend, stores transparent PNG
await assert.rejects(merch.generateDesign(env, 'lab-a', 1, { ideaId: idea.id }, fwFetch), /Connect your OpenAI key/)
sqlite.prepare('INSERT INTO lw_provider_connections(user_id,provider,encrypted_key) VALUES (?,?,?)').run(1, 'openai', await encryptKey(env.LLM_KEY_ENCRYPTION_SECRET, 'sk-test', keyContext(1, 'openai', '{}')))
let sentPrompt = null
const ai = async (url, init) => { if (url.includes('api.openai.com/v1/images/generations')) { const b = JSON.parse(init.body); sentPrompt = b; assert.equal(init.headers.Authorization, 'Bearer sk-test'); return json(200, { data: [{ b64_json: Buffer.from(png(1600, 2000)).toString('base64') }] }) } return fwFetch(url, init) }
const gen = await merch.generateDesign(env, 'lab-a', 1, { ideaId: idea.id }, ai)
assert.equal(gen.id, idea.id); assert.equal(gen.width, 1600); assert.equal(gen.transparent, true)
assert.equal(sentPrompt.model, 'gpt-image-2.5-flare'); assert.equal(sentPrompt.background, 'transparent'); assert.match(sentPrompt.prompt, /Aviator Keys/); assert.match(sentPrompt.prompt, /No existing logos/)
assert.equal(sqlite.prepare('SELECT cost_micros FROM lw_ai_usage WHERE user_id=1').get().cost_micros, 100000)
sqlite.exec("INSERT INTO lw_ai_budgets(user_id,monthly_cap_cents) VALUES (1,5) ON CONFLICT(user_id) DO UPDATE SET monthly_cap_cents=5")
await assert.rejects(merch.generateDesign(env, 'lab-a', 1, { prompt: 'another one' }, ai), /budget reached/)
sqlite.exec('UPDATE lw_ai_budgets SET monthly_cap_cents=500 WHERE user_id=1')

// ---------- approve needs rights; product stays hidden; owner publishes ----------
await assert.rejects(merch.makeProduct(env, 'lab-a', 1, { designId: good.id, kind: 'tee' }, fwFetch), /Approve the design first/)
await assert.rejects(merch.decideDesign(db, 'lab-a', 1, good.id, { decision: 'APPROVED' }), /Confirm you own/)
assert.equal((await merch.decideDesign(db, 'lab-a', 1, good.id, { decision: 'APPROVED', ownsRights: true })).status, 'APPROVED')
await assert.rejects(merch.makeProduct(env, 'lab-a', 1, { designId: good.id, kind: 'spaceship' }, fwFetch), /kind must be/)
await assert.rejects(merch.makeProduct(env, 'lab-a', 1, { designId: good.id, kind: 'tee', profitMargin: 0 }, fwFetch), /between \$1 and \$200/)
const t = await merch.templateInfo('tee', fwFetch); assert.equal(t.base, 9.5); assert.equal(t.printArea, '2250x2700px'); assert.equal(t.colors.length, 2)
const prod = await merch.makeProduct(env, 'lab-a', 4, { designId: good.id, kind: 'tee', profitMargin: 15, colors: ['Black'], base: 9.5 }, fwFetch)
assert.equal(prod.state, 'HIDDEN'); assert.equal(prod.keep, 13.99); assert.equal(prod.mockups, 2)
const created = calls.find(c => c.url.endsWith('/products') && c.method === 'POST').body
assert.equal(created.type, 'design'); assert.equal(created.publishOnCreate, false); assert.equal(created.productTemplateId, 'pro_O7Dd4-6JTUuq48NSUd3TMg'); assert.equal(created.regions[0].region, 'front_large'); assert.equal(created.regions[0].imageId, 'img_1'); assert.equal(created.profitMargin, 15)
// second product re-uses the uploaded Fourthwall image (no re-upload)
const uploads = calls.filter(c => c.url.endsWith('/media/upload-url')).length
await merch.makeProduct(env, 'lab-a', 1, { designId: good.id, kind: 'hoodie' }, fwFetch)
assert.equal(calls.filter(c => c.url.endsWith('/media/upload-url')).length, uploads)
// mockups: proxied only from Fourthwall hosts
const mk = await merch.mockupImage(env, 'lab-a', 3, prod.id, 0, async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } }))
assert.equal(mk.type, 'image/jpeg')
await assert.rejects(merch.mockupImage(env, 'lab-a', 3, prod.id, 1, async () => new Response('x', { headers: { 'Content-Type': 'image/jpeg' } })), /Not found/)
// publish: owner only
await assert.rejects(merch.setProductState(env, 'lab-a', 4, prod.id, { state: 'PUBLIC' }, fwFetch), /Only the label owner/)
assert.equal((await merch.setProductState(env, 'lab-a', 1, prod.id, { state: 'PUBLIC' }, fwFetch)).state, 'PUBLIC')
assert.deepEqual(calls.filter(c => /state$/.test(c.url)).at(-1).body, { state: 'PUBLIC' })
assert.equal((await merch.setProductState(env, 'lab-a', 4, prod.id, { state: 'HIDDEN' }, fwFetch)).state, 'HIDDEN') // editor can hide
ov = await merch.merchOverview(env, 'lab-a', 1)
assert.equal(ov.products.length, 2); assert.equal(ov.designs.length, 3)

// ---------- sales ----------
const s = await merch.merchSales(env, 'lab-a', 1, fwFetch)
assert.deepEqual([s.orders, s.items, s.salesUsd, s.profitBeforeCardFeesUsd], [1, 2, 49, 30])
await assert.rejects(merch.merchSales(env, 'lab-b', 2, fwFetch), /Connect your free Fourthwall shop/)

// ---------- website routes ----------
const web = (path, user = 1, body, raw) => app.request('http://localhost/api/label-world/labels/lab-a' + path, { method: body || raw ? 'POST' : 'GET', headers: { Cookie: 'studio2u_session=test-session-' + user, Origin: 'http://localhost', 'Content-Type': raw ? 'image/png' : 'application/json', ...(raw ? { 'X-Title': 'Route%20upload' } : {}) }, body: raw ?? (body ? JSON.stringify(body) : undefined) }, env)
let r = await web('/merch', 3); assert.equal(r.status, 200); assert.equal((await r.json()).shop.name, 'Aviator Shop')
r = await web('/merch/designs/upload', 1, null, png(2400, 2400)); assert.equal(r.status, 201)
r = await web('/merch/designs/upload', 3, null, png(2400, 2400)); assert.equal(r.status, 403)
r = await web(`/merch/designs/${good.id}/image`, 3); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/png')
r = await web('/merch/designs/ideas', 1, { title: 'Hello Kitty 22', prompt: 'hello kitty holding a 22 sign' }); assert.equal(r.status, 400)

// ---------- playbook + MCP ----------
assert.equal(suggestPlaybooks('I want to put my logo on hoodies and sell them')[0].id, 'merch-drop')
const handler = createStudioMcp(db, { userId: 1, grantId: 'g1', labelIds: ['lab-a'], scopes: ['labels:read', 'releases:read', 'releases:write', 'tasks:read', 'tasks:write'], clientName: 'Codex', toolMode: 'core' }, async () => true)
const client = new Client({ name: 't', version: '1' })
await client.connect(new StreamableHTTPClientTransport(new URL('https://studio.invalid/label-world/mcp'), { fetch: (u, o) => handler.fetch(new Request(u, o)) }))
const guide = await client.callTool({ name: 'studio2u_guide', arguments: { topic: 'merch' } })
assert.match(guide.content[0].text, /add_merch_idea\(labelId, title, prompt/)
const run = async (tool, args) => { const x = await client.callTool({ name: 'studio2u_run', arguments: { tool, args } }); return x.isError ? { error: x.content[0].text } : JSON.parse(x.content[0].text) }
const mi = await run('add_merch_idea', { labelId: 'lab-a', title: 'Cover art hoodie', prompt: 'The 22 cover art as a big back print, gold on black' })
assert.equal((mi.data ?? mi).status, 'IDEA')
const ms = await run('merch_status', { labelId: 'lab-a' }); assert.ok(!JSON.stringify(ms).includes('apipass'))
assert.ok((await run('add_merch_idea', { labelId: 'lab-b', title: 'x', prompt: 'some idea here' })).error)
await client.close(); await handler.close()
console.log('PASS merch: Fourthwall connect (owner only, key encrypted, never returned), PNG checks + print warnings, AI design with the owner\'s own OpenAI key (transparent PNG, budget cap, spend recorded), brand/character block, approve needs rights confirmation, mockups on a HIDDEN product, image reused across products, Fourthwall-only mockup proxy, owner-only Publish, profit math (2.9% + $0.30), sales from orders, website + MCP ideas, viewer/tenant isolation')
