// Business Partner: approve-once weekly plan, autopilot ON/OFF, Stop pauses everything,
// owner creates accounts and hands them over, posting only approved posts with a public link,
// daily money check-in in his chat, engine pass, website routes, MCP topic, isolation.
import assert from 'node:assert/strict'
import { fixture } from './label-world-api-fixture.mjs'
const pt = await import('../src/label-world/autonomy/partner.ts')
const { enqueue, runEngine, taskKinds } = await import('../src/label-world/autonomy/engine.ts')
const { claimNext, instructionsFor } = await import('../src/label-world/autonomy/service.ts')
const { createStudioMcp } = await import('../src/label-world/mcp/server.ts')
const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client')

const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Aviator Music Group'),('lab-b','Other');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer'),('lab-a',4,'editor');
INSERT INTO lw_label_identity(label_id,artist_name,legal_name,aliases_json,pro) VALUES ('lab-a','Aviator Keyz','Mason Brown','[]','ASCAP');
INSERT INTO lw_catalog_tracks(id,label_id,source,title,artist_credit,link) VALUES ('t1','lab-a','deezer','22','Aviator Keyz','https://www.deezer.com/track/1');`)
const env = { DB: db, LLM_KEY_ENCRYPTION_SECRET: Buffer.alloc(32, 9).toString('base64') }
const q = (t) => enqueue(db, t)
assert.ok(taskKinds.includes('PARTNER_POST') && taskKinds.includes('PARTNER_SETUP'))

// ---------- the chat table accepts the partner (migration 0035) ----------
sqlite.prepare("INSERT INTO lw_employee_messages(id,label_id,user_id,agent_id,role,content,status) VALUES ('m0','lab-a',1,'partner','user','hi','COMPLETED')").run()
assert.throws(() => sqlite.prepare("INSERT INTO lw_employee_messages(id,label_id,user_id,agent_id,role,content,status) VALUES ('m1','lab-a',1,'intern','user','hi','COMPLETED')").run(), /CHECK/)

// ---------- settings: defaults, owner-only autopilot/cap ----------
let s = await pt.getPartnerSettings(db, 'lab-a')
assert.deepEqual([s.autopilot, s.spendCapCents, s.postsPerDay, s.checkinHour], ['OFF', 0, 1, 9])
await assert.rejects(pt.savePartnerSettings(db, 'lab-a', 4, { autopilot: 'ON' }), /Only the label owner/)
await assert.rejects(pt.savePartnerSettings(db, 'lab-a', 1, { spendCapUsd: 9000 }), /\$0 to \$5,000/)
await assert.rejects(pt.savePartnerSettings(db, 'lab-a', 1, { autopilot: 'PAUSED' }), /use Stop/)
s = await pt.savePartnerSettings(db, 'lab-a', 1, { spendCapUsd: 50, checkinHour: 0 })
assert.equal(s.spendCapCents, 5000)

// ---------- accounts: owner creates, hands over; setup task queued ----------
let ch = await pt.listChannels(db, 'lab-a'); assert.equal(ch.length, 6); assert.ok(ch.every(c => c.status === 'NEEDS_ACCOUNT' && c.signup.startsWith('https://')))
await assert.rejects(pt.createPlan(db, 'lab-a', 1, {}, 'owner'), /at least one account/)
await assert.rejects(pt.saveChannel(db, 'lab-a', 4, { platform: 'instagram', handle: 'aviatorkeyz', status: 'READY' }, q), /Only the label owner/)
await assert.rejects(pt.saveChannel(db, 'lab-a', 3, { platform: 'instagram', handle: 'aviatorkeyz' }, q), /permission/i)
await assert.rejects(pt.saveChannel(db, 'lab-a', 1, { platform: 'myspace', handle: 'x' }, q), /platform must be/)
await assert.rejects(pt.saveChannel(db, 'lab-a', 1, { platform: 'x', handle: 'bad handle!' }, q), /Handle can only/)
await assert.rejects(pt.saveChannel(db, 'lab-a', 1, { platform: 'x', handle: 'a', method: 'OFFICIAL_API' }, q), /method must be/)
const ig = await pt.saveChannel(db, 'lab-a', 1, { platform: 'instagram', handle: '@aviatorkeyz', status: 'READY' }, q)
assert.deepEqual([ig.handle, ig.status, ig.setupQueued], ['aviatorkeyz', 'READY', true])
assert.equal((await pt.saveChannel(db, 'lab-a', 1, { platform: 'instagram', handle: 'aviatorkeyz', status: 'READY' }, q)).setupQueued, false) // once
await pt.saveChannel(db, 'lab-a', 1, { platform: 'x', handle: 'aviatorkeyz', status: 'READY' }, q)
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM lw_tasks WHERE kind='PARTNER_SETUP'").get().n, 2)

// ---------- weekly plan: starter draft, limits, approve once ----------
const plan = await pt.createPlan(db, 'lab-a', 4, {}, 'owner') // editors may draft
const today = (await import('../src/label-world/autonomy/office.ts')).localParts('America/New_York').date
assert.equal(plan.plan.week_start, pt.mondayOf(today)); assert.equal(plan.plan.status, 'DRAFT')
assert.equal(plan.posts.length, 14) // 7 days x 2 READY accounts x 1/day
assert.ok(plan.posts.some(p => p.kind === 'song' && /"22" by Aviator Keyz/.test(p.caption)))
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM lw_notifications WHERE kind='PARTNER_PLAN'").get().n, 1)
const wk = plan.plan.week_start
await assert.rejects(pt.createPlan(db, 'lab-a', 1, { weekStart: wk, posts: [{ day: pt.addDays(wk, 9), platform: 'x', kind: 'song', caption: 'x' }] }, 'owner'), /inside the week/)
await assert.rejects(pt.createPlan(db, 'lab-a', 1, { weekStart: wk, posts: [{ day: wk, platform: 'x', kind: 'song', caption: 'a' }, { day: wk, platform: 'x', kind: 'song', caption: 'b' }] }, 'owner'), /owner's limit/)
await assert.rejects(pt.createPlan(db, 'lab-a', 1, { weekStart: wk, posts: [{ day: wk, platform: 'x', kind: 'song', caption: 'a', link: 'http://insecure.example' }] }, 'owner'), /https/)
await assert.rejects(pt.createPlan(db, 'lab-a', 1, { weekStart: '2020-01-06' }, 'owner'), /already over/)
// a custom plan for today replaces the earlier draft
const custom = await pt.createPlan(db, 'lab-a', 1, { weekStart: wk, posts: [{ day: today, platform: 'x', kind: 'song', caption: 'Run "22" back tonight', link: 'https://www.deezer.com/track/1' }, { day: today, platform: 'instagram', kind: 'merch', caption: 'Tee drop', media: { needs: 'OWNER_CLIP', hint: 'try-on clip' } }, { day: pt.addDays(today, 1) > pt.addDays(wk, 6) ? today : pt.addDays(today, 1), platform: 'instagram', kind: 'question', caption: 'Hoodie or hat next?' }].filter((p, i, a) => a.findIndex(x => x.day === p.day && x.platform === p.platform) === i) }, 'owner')
assert.equal(sqlite.prepare('SELECT status FROM lw_partner_plans WHERE id=?').get(plan.plan.id).status, 'REPLACED')
await assert.rejects(pt.decidePlan(db, 'lab-a', 4, custom.plan.id, { decision: 'APPROVED' }), /Only the label owner/)
await assert.rejects(pt.decidePlan(db, 'lab-a', 1, plan.plan.id, { decision: 'APPROVED' }), /REPLACED/)
// due posts: nothing until approved
assert.equal((await pt.duePosts(db, 'lab-a')).posts.length, 0)
const xPost = custom.posts.find(p => p.platform === 'x')
const ok = await pt.decidePlan(db, 'lab-a', 1, custom.plan.id, { decision: 'APPROVED', edits: [{ id: xPost.id, caption: 'Run "22" back tonight (owner edit)' }] })
assert.equal(ok.plan.status, 'APPROVED'); assert.match(ok.say, /Turn autopilot on/)
assert.equal(ok.posts.find(p => p.id === xPost.id).caption, 'Run "22" back tonight (owner edit)')
await assert.rejects(pt.decidePlan(db, 'lab-a', 1, custom.plan.id, { decision: 'APPROVED' }), /APPROVED/)

// ---------- autopilot OFF: posts are due but blocked; engine queues nothing ----------
let due = await pt.duePosts(db, 'lab-a')
assert.ok(due.posts.length >= 2 && due.posts.every(p => !p.canPostNow && /Autopilot is OFF/.test(p.blockedBy)))
let pass = await pt.partnerPass(env, q, ['lab-a'])
assert.equal(pass.queued, 0); assert.equal(pass.checkins, 1) // check-in hour 0 -> due today
assert.equal((await pt.partnerPass(env, q, ['lab-a'])).checkins, 0) // once a day
const checkin = sqlite.prepare("SELECT content FROM lw_employee_messages WHERE agent_id='partner' AND model='daily-checkin'").get().content
assert.match(checkin, /Money check-in/); assert.match(checkin, /no shop connected/); assert.match(checkin, /Autopilot: OFF/)
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM lw_notifications WHERE kind='PARTNER_CHECKIN'").get().n, 1)

// ---------- autopilot ON: only postable, approved posts become screen tasks ----------
await pt.savePartnerSettings(db, 'lab-a', 1, { autopilot: 'ON' })
due = await pt.duePosts(db, 'lab-a')
const xDue = due.posts.find(p => p.platform === 'x'), igDue = due.posts.find(p => p.platform === 'instagram' && p.day === today)
assert.equal(xDue.canPostNow, true); assert.match(igDue.blockedBy, /Needs a clip from the owner/)
pass = await pt.partnerPass(env, q, ['lab-a']); assert.equal(pass.queued, 1)
assert.equal((await pt.partnerPass(env, q, ['lab-a'])).queued, 0) // one task per post
const task = sqlite.prepare("SELECT * FROM lw_tasks WHERE kind='PARTNER_POST'").get()
assert.equal(task.capability, 'SCREEN_CONTROL'); assert.equal(JSON.parse(task.input_json).partnerPostId, xPost.id)
// the agent's view
assert.match(instructionsFor('PARTNER_POST'), /ONLY thing you may publish: never DM, follow, like/)
assert.match(instructionsFor('PARTNER_SETUP'), /Never change the password/)
assert.equal(await claimNext(db, 1, ['lab-a'], 'codex', false, ['PARTNER_POST']), null) // needs a screen
const claimed = await claimNext(db, 1, ['lab-a'], 'codex', true, ['PARTNER_POST'])
assert.equal(claimed.context.partner.post.id, xPost.id); assert.equal(claimed.context.partner.channel.handle, 'aviatorkeyz'); assert.equal(claimed.context.partner.settings.autopilot, 'ON')

// ---------- mark posted: needs the public link on that platform ----------
await assert.rejects(pt.markPost(db, 'lab-a', 1, xPost.id, { outcome: 'POSTED' }, 'mcp', 'codex'), /public https link/)
await assert.rejects(pt.markPost(db, 'lab-a', 1, xPost.id, { outcome: 'POSTED', postedUrl: 'https://instagram.com/p/1' }, 'mcp', 'codex'), /on X/)
await assert.rejects(pt.markPost(db, 'lab-a', 3, xPost.id, { outcome: 'POSTED', postedUrl: 'https://x.com/aviatorkeyz/status/1' }, 'web'), /permission/i)
const posted = await pt.markPost(db, 'lab-a', 1, xPost.id, { outcome: 'POSTED', postedUrl: 'https://x.com/aviatorkeyz/status/123' }, 'mcp', 'codex')
assert.equal(posted.status, 'POSTED')
await assert.rejects(pt.markPost(db, 'lab-a', 1, xPost.id, { outcome: 'POSTED', postedUrl: 'https://x.com/aviatorkeyz/status/123' }, 'mcp'), /Already posted/)
assert.match(sqlite.prepare('SELECT posted_via FROM lw_partner_posts WHERE id=?').get(xPost.id).posted_via, /^agent:codex/)
// owner posts the blocked one themselves
await pt.markPost(db, 'lab-a', 1, igDue.id, { outcome: 'POSTED', postedUrl: 'https://www.instagram.com/p/abc/' }, 'web')
// unapproved posts can never be marked
const draftPost = plan.posts[0]
await assert.rejects(pt.markPost(db, 'lab-a', 1, draftPost.id, { outcome: 'POSTED', postedUrl: 'https://x.com/a/status/1' }, 'web'), /approved plan/)

// ---------- STOP: anyone on the team; cancels queued posting; agents refused; only owner resumes ----------
await enqueue(db, { label: 'lab-a', kind: 'PARTNER_POST', role: 'business_partner', capability: 'SCREEN_CONTROL', title: 'x', input: { partnerPostId: 'zz' }, dedupe: 'ppost:zz' })
await assert.rejects(pt.stopPartner(db, 'lab-a', 3), /permission/i)
const stop = await pt.stopPartner(db, 'lab-a', 4)
assert.equal(stop.autopilot, 'PAUSED'); assert.ok(stop.cancelledTasks >= 1)
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM lw_tasks WHERE kind IN ('PARTNER_POST','PARTNER_SETUP') AND status='QUEUED'").get().n, 0)
const remaining = (await pt.duePosts(db, 'lab-a')).posts
if (remaining[0]) await assert.rejects(pt.markPost(db, 'lab-a', 1, remaining[0].id, { outcome: 'POSTED', postedUrl: 'https://www.instagram.com/p/z/' }, 'mcp'), /Autopilot is not ON/)
assert.deepEqual(await pt.partnerPass(env, q, ['lab-a']), { queued: 0, checkins: 0, drafted: 0 }) // paused = silent
await assert.rejects(pt.savePartnerSettings(db, 'lab-a', 4, { autopilot: 'ON' }), /Only the label owner/)

// ---------- streams: verified Amazon / ticket facts, owner picks ----------
const ov = await pt.partnerOverview(db, 'lab-a', 3)
assert.ok(ov.streams.amazon.SELLER_CENTRAL.facts.some(x => /\$0\.99 per item/.test(x) && true) && ov.streams.amazon.SELLER_CENTRAL.facts.some(x => /\$39\.99 per month/.test(x)))
assert.ok(ov.streams.tickets.EVENTBRITE.facts.some(x => /3\.7% \+ \$1\.79/.test(x) && /2\.9%/.test(x)))
assert.ok(ov.rules.some(r => /Never handles passwords, card or bank details/.test(r)))
assert.equal(ov.week.posted, 2)
await assert.rejects(pt.saveStreams(db, 'lab-a', 4, { amazon: 'MERCH_ON_DEMAND' }), /Only the label owner/)
await assert.rejects(pt.saveStreams(db, 'lab-a', 1, { amazon: 'EBAY' }), /amazon must be/)
assert.deepEqual(await pt.saveStreams(db, 'lab-a', 1, { amazon: 'MERCH_ON_DEMAND', amazonStatus: 'APPLIED', tickets: 'EVENTBRITE' }), { amazon: 'MERCH_ON_DEMAND', amazonStatus: 'APPLIED', tickets: 'EVENTBRITE' })

// ---------- website routes + instant chat answer ----------
const web = (path, user = 1, body) => app.request('http://localhost/api/label-world/labels/lab-a' + path, { method: body ? 'POST' : 'GET', headers: { Cookie: 'studio2u_session=test-session-' + user, Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, env)
let r = await web('/partner', 3); assert.equal(r.status, 200); assert.equal((await r.json()).settings.autopilot, 'PAUSED')
r = await web('/partner/settings', 4, { autopilot: 'ON' }); assert.equal(r.status, 403)
r = await web('/partner/settings', 1, { autopilot: 'ON' }); assert.equal(r.status, 200)
r = await web('/partner/stop', 3, {}); assert.equal(r.status, 403) // viewers blocked by the label middleware
r = await web('/partner/stop', 1, {}); assert.equal((await r.json()).autopilot, 'PAUSED')
r = await web('/partner/channels', 1, { platform: 'tiktok', handle: 'aviatorkeyz', status: 'READY' }); assert.equal((await r.json()).setupQueued, true)
r = await web('/inbox/partner/messages', 1, { content: 'how much money did we make this week?', messageId: crypto.randomUUID() })
assert.equal(r.status, 201); const chat = await r.json()
assert.equal(chat.status, 'COMPLETED'); assert.match(chat.messages.at(-1).content, /Money check-in/)
r = await web('/inbox/partner/messages', 1); assert.equal(r.status, 200)
for (const page of ['/label-world/agents/partner']) { const p = await app.request('http://localhost' + page, {}, env); assert.notEqual(p.status, 404, page) }
// isolation: other label sees nothing of lab-a
await assert.rejects(pt.partnerOverview(db, 'lab-a', 2), /Label not found/)

// ---------- engine integration ----------
const summary = await runEngine(env, { labelIds: ['lab-a'] })
assert.ok('partnerPosts' in summary && 'partnerCheckins' in summary)

// ---------- MCP partner topic ----------
const handler = createStudioMcp(db, { userId: 1, grantId: 'g1', labelIds: ['lab-a'], scopes: ['labels:read', 'releases:read', 'releases:write', 'tasks:read', 'tasks:write', 'messages:read'], clientName: 'Codex', toolMode: 'core' }, async () => true)
const client = new Client({ name: 't', version: '1' })
await client.connect(new StreamableHTTPClientTransport(new URL('https://studio.invalid/label-world/mcp'), { fetch: (u, o) => handler.fetch(new Request(u, o)) }))
const guide = await client.callTool({ name: 'studio2u_guide', arguments: { topic: 'partner' } })
assert.match(guide.content[0].text, /propose_week_plan\(labelId/); assert.match(guide.content[0].text, /mark_post\(labelId, postId, outcome:POSTED\|FAILED\|SKIPPED/)
const run = async (tool, args) => { const x = await client.callTool({ name: 'studio2u_run', arguments: { tool, args } }); return x.isError ? { error: x.content[0].text } : JSON.parse(x.content[0].text) }
const st = await run('partner_status', { labelId: 'lab-a' }); assert.equal((st.data ?? st).settings.autopilot, 'PAUSED')
const nextWeek = pt.addDays(wk, 7)
const prop = await run('propose_week_plan', { labelId: 'lab-a', weekStart: nextWeek, posts: [{ day: nextWeek, platform: 'tiktok', kind: 'song', caption: '22 challenge: show me your best two-step' }] })
assert.equal((prop.data ?? prop).plan.created_by, 'Codex')
assert.ok((await run('propose_week_plan', { labelId: 'lab-b' })).error)
assert.ok((await run('save_partner_account', { labelId: 'lab-a', platform: 'youtube', handle: 'aviatorkeyz' })).data ?? true)
assert.equal(sqlite.prepare("SELECT status FROM lw_partner_channels WHERE label_id='lab-a' AND platform='youtube'").get().status, 'NEEDS_ACCOUNT') // agents can't hand over
const unread = await run('list_unanswered_messages', { labelId: 'lab-a', employeeId: 'partner' }); assert.ok(!unread.error)
await client.close(); await handler.close()
console.log('PASS partner: 5th employee chat (0035), owner-only autopilot + spend cap, Stop by any editor cancels queued posting and silences the engine, owner creates accounts and hands them over (setup task once), starter week plan from songs/merch, per-account daily limit, approve once with edits, nothing posts unapproved, autopilot OFF blocks, ON queues one screen task per postable post, agent instructions forbid DMs/follows/likes, POSTED needs the public link on that platform, owner can post blocked ones, daily money check-in once a day, verified Amazon/Eventbrite fees, routes, instant chat answer, engine summary, MCP partner topic, isolation')
