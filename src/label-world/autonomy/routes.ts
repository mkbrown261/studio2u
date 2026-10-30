// Website API for the autonomy features. Mounted inside labelWorldRoutes, so the
// session check and per-label membership/viewer-write middleware already ran.
import { ServiceError, completeTask, getIntake, getPacket, listNotifications, listParties, listSubmissions, queueOverview, reportSubmission, saveParty, updateIntake } from './service'
import { runEngine, ROUTINE_URL } from './engine'
import { encryptKey } from '../providers/vault'
import { SHIFT_PROMPT } from './mcp-tools'
import * as cases from './cases'
import * as office from './office'
import * as agr from './agreements'
import * as content from './content'
import * as ascap from './ascap'
import * as outreach from './outreach'
import * as sx from './soundexchange'
import * as know from './discovery'
import { talk } from './talk'
import * as merch from './merch'
import * as partner from './partner'
import * as shows from './shows'
import { approvalStatus, approvalAction } from './approval'
import { enqueue } from './engine'

const base = '/api/label-world/labels/:labelId'
const wrap = (fn: (c: any) => Promise<Response>) => async (c: any) => {
  try { return await fn(c) } catch (e) {
    if (e instanceof ServiceError) return c.json({ error: e.message }, e.status)
    return c.json({ error: 'Request failed' }, 500)
  }
}
const body = async (c: any) => { try { return await c.req.json() } catch { throw new ServiceError('JSON body required') } }

export function installAutonomyRoutes(app: any) {
  // ---- artist identity, catalog ("Is this you?") and Money Found cases ----
  const L = (c: any) => c.req.param('labelId'), U = (c: any) => c.get('lwUser').id
  app.get(base + '/artist-profile', wrap(async c => c.json({ profile: await cases.getProfile(c.env.DB, L(c)), catalog: await cases.catalogSummary(c.env.DB, L(c)) })))
  app.post(base + '/artist-profile', wrap(async c => {
    const profile = await cases.saveProfile(c.env.DB, L(c), U(c), await body(c))
    // Get to know them right away (free public lookups, no AI tokens), not on the next engine pass.
    const job = know.discoverPublic(c.env.DB, L(c), U(c)).catch(() => null)
    try { c.executionCtx.waitUntil(job) } catch { await job }
    return c.json({ profile, discovering: true })
  }))
  app.get(base + '/catalog/search', wrap(async c => c.json(await cases.searchCatalog(c.req.query('name') ?? ''))))
  app.post(base + '/catalog/import', wrap(async c => {
    const b = await body(c), profiles = Array.isArray(b.profiles) ? b.profiles.slice(0, 5) : []
    if (!profiles.length) throw new ServiceError('Choose at least one profile that is you')
    const all: any[] = []
    for (const p of profiles) all.push(...await cases.artistTracks(String(p.source), String(p.artistId)))
    if (!all.length) throw new ServiceError('No songs found on those profiles')
    return c.json(await cases.importTracks(c.env.DB, L(c), U(c), all.slice(0, 400)))
  }))
  app.get(base + '/catalog', wrap(async c => c.json({ summary: await cases.catalogSummary(c.env.DB, L(c)), tracks: await cases.listCatalog(c.env.DB, L(c)) })))
  // ---- Know me ----
  app.get(base + '/know-me', wrap(async c => c.json(await know.getDossier(c.env.DB, L(c), U(c)))))
  app.post(base + '/know-me/discover', wrap(async c => c.json(await know.discoverPublic(c.env.DB, L(c), U(c)))))
  app.post(base + '/know-me/facts', wrap(async c => c.json(await know.saveFacts(c.env.DB, L(c), U(c), (await body(c)).facts, 'OWNER', 'owner'))))
  app.post(base + '/know-me/facts/:key/confirm', wrap(async c => c.json(await know.confirmFact(c.env.DB, L(c), U(c), c.req.param('key'), Boolean((await body(c)).confirm)))))
  app.post(base + '/know-me/links', wrap(async c => c.json(await know.addLink(c.env.DB, L(c), U(c), await body(c), 'OWNER', 'owner'))))
  app.post(base + '/know-me/links/:id', wrap(async c => c.json(await know.decideLink(c.env.DB, L(c), U(c), c.req.param('id'), String((await body(c)).decision ?? '')))))
  app.get(base + '/soundexchange', wrap(async c => c.json({ ...(await sx.getSxAccount(c.env.DB, L(c), U(c))), queue: await sx.sxQueue(c.env.DB, L(c), U(c), 60) })))
  app.post(base + '/soundexchange/account', wrap(async c => c.json(await sx.saveSxAccount(c.env.DB, L(c), U(c), await body(c)))))
  app.post(base + '/soundexchange/contact-update', wrap(async c => c.json(await sx.prepareContactUpdate(c.env.DB, L(c), U(c), await body(c)))))
  app.get(base + '/catalog/:trackId/soundexchange', wrap(async c => c.json(await sx.prepareSx(c.env.DB, L(c), U(c), c.req.param('trackId')))))
  app.post(base + '/catalog/:trackId/soundexchange', wrap(async c => c.json(await sx.saveSxWork(c.env.DB, L(c), U(c), c.req.param('trackId'), (await body(c)).work))))
  app.post(base + '/catalog/:trackId/soundexchange/report', wrap(async c => c.json(await sx.reportSx(c.env.DB, L(c), U(c), c.req.param('trackId'), await body(c)))))
  app.get(base + '/registrations/ascap', wrap(async c => c.json(await ascap.registrationQueue(c.env.DB, L(c), U(c), 60))))
  app.get(base + '/catalog/:trackId/ascap', wrap(async c => c.json(await ascap.prepareTrack(c.env.DB, L(c), U(c), c.req.param('trackId'), { verify: c.req.query('verify') === '1' }))))
  app.post(base + '/catalog/:trackId/work', wrap(async c => c.json(await ascap.saveTrackWork(c.env.DB, L(c), U(c), c.req.param('trackId'), (await body(c)).work))))
  app.post(base + '/catalog/:trackId/ascap/report', wrap(async c => c.json(await ascap.reportTrack(c.env.DB, L(c), U(c), c.req.param('trackId'), await body(c)))))
  app.post(base + '/catalog/:trackId', wrap(async c => c.json(await cases.updateTrack(c.env.DB, L(c), U(c), c.req.param('trackId'), await body(c)))))
  app.get(base + '/playbooks', wrap(async c => c.json({ standingRules: cases.STANDING_RULES, playbooks: cases.PLAYBOOKS.map(p => ({ id: p.id, name: p.name, owner: p.owner, summary: p.summary, needs: p.needs })), suggested: c.req.query('match') ? cases.suggestPlaybooks(c.req.query('match')!) : [] })))
  // ---- Merch (no inventory): the owner's own free Fourthwall shop ----
  const E = (c: any) => c.env
  app.get(base + '/merch', wrap(async c => c.json(await merch.merchOverview(E(c), L(c), U(c)))))
  app.post(base + '/merch/shop', wrap(async c => c.json(await merch.connectShop(E(c), L(c), U(c), await body(c)))))
  app.post(base + '/merch/shop/disconnect', wrap(async c => c.json(await merch.disconnectShop(E(c), L(c), U(c)))))
  app.get(base + '/merch/template/:kind', wrap(async c => c.json(await merch.templateInfo(c.req.param('kind')))))
  app.post(base + '/merch/designs/upload', wrap(async c => {
    const declared = Number(c.req.header('Content-Length')); if (declared > 20 * 1024 * 1024) throw new ServiceError('PNG must be under 20 MB', 413)
    const reader = c.req.raw.body?.getReader(); if (!reader) throw new ServiceError('File bytes required')
    const chunks: Uint8Array[] = []; let n = 0
    for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; if (n > 20 * 1024 * 1024) { await reader.cancel(); throw new ServiceError('PNG must be under 20 MB', 413) } chunks.push(value) }
    const bytes = new Uint8Array(n); let o = 0; for (const ch of chunks) { bytes.set(ch, o); o += ch.length }
    return c.json(await merch.uploadDesign(E(c), L(c), U(c), bytes, c.req.header('X-Title') ? decodeURIComponent(c.req.header('X-Title')) : null), 201)
  }))
  app.post(base + '/merch/designs/ideas', wrap(async c => c.json(await merch.addIdea(c.env.DB, L(c), U(c), await body(c), 'owner'), 201)))
  app.post(base + '/merch/designs/generate', wrap(async c => c.json(await merch.generateDesign(E(c), L(c), U(c), await body(c)), 201)))
  app.post(base + '/merch/designs/:id/decision', wrap(async c => c.json(await merch.decideDesign(c.env.DB, L(c), U(c), c.req.param('id'), await body(c)))))
  app.get(base + '/merch/designs/:id/image', wrap(async c => new Response(await merch.designImage(E(c), L(c), U(c), c.req.param('id')), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' } })))
  app.post(base + '/merch/products', wrap(async c => c.json(await merch.makeProduct(E(c), L(c), U(c), await body(c)), 201)))
  app.post(base + '/merch/products/:id/state', wrap(async c => c.json(await merch.setProductState(E(c), L(c), U(c), c.req.param('id'), await body(c)))))
  app.get(base + '/merch/products/:id/mockups/:i', wrap(async c => { const m = await merch.mockupImage(E(c), L(c), U(c), c.req.param('id'), Number(c.req.param('i'))); return new Response(m.bytes, { headers: { 'Content-Type': m.type, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' } }) }))
  // ---- Business Partner: approve-once weekly plan, autopilot, Stop, accounts, money desk ----
  app.get(base + '/partner', wrap(async c => c.json(await partner.partnerOverview(c.env.DB, L(c), U(c)))))
  app.post(base + '/partner/settings', wrap(async c => c.json(await partner.savePartnerSettings(c.env.DB, L(c), U(c), await body(c)))))
  app.post(base + '/partner/stop', wrap(async c => c.json(await partner.stopPartner(c.env.DB, L(c), U(c)))))
  app.post(base + '/partner/streams', wrap(async c => c.json(await partner.saveStreams(c.env.DB, L(c), U(c), await body(c)))))
  app.post(base + '/partner/channels', wrap(async c => c.json(await partner.saveChannel(c.env.DB, L(c), U(c), await body(c), (t: any) => enqueue(c.env.DB, t)))))
  app.post(base + '/partner/plans', wrap(async c => c.json(await partner.createPlan(c.env.DB, L(c), U(c), await body(c), 'owner'), 201)))
  app.post(base + '/partner/plans/:id/decision', wrap(async c => c.json(await partner.decidePlan(c.env.DB, L(c), U(c), c.req.param('id'), await body(c)))))
  app.post(base + '/partner/posts/:id', wrap(async c => c.json(await partner.markPost(c.env.DB, L(c), U(c), c.req.param('id'), await body(c), 'web'))))
  app.get(base + '/shows', wrap(async c => c.json({ shows: await shows.listShows(c.env.DB, L(c), U(c)) })))
  app.post(base + '/shows', wrap(async c => c.json(await shows.saveShow(c.env.DB, L(c), U(c), await body(c)), 201)))
  app.post(base + '/shows/:id/status', wrap(async c => c.json(await shows.setShowStatus(c.env.DB, L(c), U(c), c.req.param('id'), await body(c)))))
  app.get(base + '/shows/:id/qr.svg', wrap(async c => { const s = await shows.getShow(c.env.DB, L(c), c.req.param('id')); return new Response(shows.qrSvg(s.url + '?src=qr'), { headers: { 'Content-Type': 'image/svg+xml', 'Content-Disposition': `inline; filename="${s.slug}-qr.svg"`, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' } }) }))
  app.post(base + '/partner/checkin', wrap(async c => c.json({ text: await partner.postCheckin(E(c), L(c), U(c)) })))
  app.get(base + '/merch/sales', wrap(async c => c.json(await merch.merchSales(E(c), L(c), U(c)))))
  // Plain-language intake: talk, we fill the boxes and answer in the same box.
  app.post(base + '/talk', wrap(async c => c.json(await talk(c.env.DB, L(c), U(c), await body(c)))))
  app.get(base + '/cases', wrap(async c => c.json({ cases: await cases.listCases(c.env.DB, L(c), U(c)) })))
  app.post(base + '/cases', wrap(async c => c.json(await cases.openCase(c.env.DB, L(c), U(c), await body(c), 'owner'), 201)))
  app.get(base + '/cases/:caseId', wrap(async c => c.json(await cases.getCase(c.env.DB, L(c), U(c), c.req.param('caseId')))))
  app.post(base + '/cases/:caseId', wrap(async c => c.json(await cases.updateCase(c.env.DB, L(c), U(c), c.req.param('caseId'), await body(c), 'owner'))))
  // Only a signed-in human can approve or reject drafts; MCP clients cannot reach these routes.
  app.post(base + '/drafts/:draftId/decision', wrap(async c => { const b = await body(c); return c.json(await cases.decideDraft(c.env.DB, L(c), U(c), c.req.param('draftId'), b.decision, b)) }))
  app.get(base + '/cases/:caseId/contacts', wrap(async c => c.json({ contacts: await outreach.listContacts(c.env.DB, L(c), U(c), c.req.param('caseId')) })))
  app.post(base + '/cases/:caseId/contacts', wrap(async c => c.json(await outreach.saveContact(c.env.DB, L(c), U(c), c.req.param('caseId'), await body(c), 'owner'), 201)))
  app.post(base + '/contacts/:contactId', wrap(async c => c.json(await outreach.updateContact(c.env.DB, L(c), U(c), c.req.param('contactId'), await body(c), 'owner'))))
  app.post(base + '/drafts/:draftId/reply', wrap(async c => c.json(await outreach.recordReply(c.env.DB, L(c), U(c), c.req.param('draftId'), (await body(c)).summary, 'owner'))))
  app.post(base + '/drafts/:draftId/sent', wrap(async c => c.json(await cases.markSent(c.env.DB, L(c), U(c), c.req.param('draftId'), (await body(c)).note, 'owner'))))

  // ---- Label Office: statements, Monday report, split sheets, content studio ----
  const origin = (c: any) => new URL(c.req.url).origin
  app.post(base + '/statements/preview', wrap(async c => c.json(office.previewStatement((await body(c)).csv))))
  app.post(base + '/statements', wrap(async c => c.json(await office.importStatement(c.env.DB, L(c), U(c), await body(c)), 201)))
  app.get(base + '/statements', wrap(async c => c.json(await office.listStatements(c.env.DB, L(c), U(c)))))
  app.post(base + '/statements/:id/delete', wrap(async c => c.json(await office.deleteStatement(c.env.DB, L(c), U(c), c.req.param('id')))))
  app.get(base + '/reports', wrap(async c => c.json(await office.listReports(c.env.DB, L(c), U(c)))))
  app.post(base + '/reports/generate', wrap(async c => { await cases.requireEditorFor(c.env.DB, L(c), U(c)); return c.json(await office.generateReport(c.env.DB, L(c), 'MANUAL')) }))
  app.post(base + '/report-settings', wrap(async c => c.json(await office.saveSettings(c.env.DB, L(c), U(c), await body(c)))))
  app.get(base + '/agreements', wrap(async c => c.json({ agreements: await agr.listAgreements(c.env.DB, L(c), U(c)) })))
  app.post(base + '/agreements/precheck', wrap(async c => c.json(agr.attorneyPrecheck(agr.validateTerms(await body(c))))))
  app.post(base + '/agreements', wrap(async c => c.json(await agr.createAgreement(c.env.DB, L(c), U(c), await body(c), origin(c)), 201)))
  app.get(base + '/agreements/:id', wrap(async c => c.json(await agr.getAgreement(c.env.DB, L(c), U(c), c.req.param('id')))))
  app.post(base + '/agreements/:id/revise', wrap(async c => c.json(await agr.reviseAgreement(c.env.DB, L(c), U(c), c.req.param('id'), await body(c), origin(c)))))
  app.post(base + '/agreements/:id/void', wrap(async c => c.json(await agr.voidAgreement(c.env.DB, L(c), U(c), c.req.param('id'), (await body(c)).reason))))
  app.post(base + '/agreements/:id/parties/:partyId/link', wrap(async c => c.json(await agr.newLink(c.env.DB, L(c), U(c), c.req.param('id'), c.req.param('partyId'), origin(c)))))
  app.get(base + '/agreements/:id/copy', wrap(async c => { const f = await agr.signedCopyForLabel(c.env.DB, L(c), U(c), c.req.param('id')); return c.body(f.text, 200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${f.filename}"` }) }))
  app.get(base + '/campaigns', wrap(async c => c.json({ campaigns: await content.listCampaigns(c.env.DB, L(c), U(c)) })))
  app.post(base + '/campaigns', wrap(async c => c.json(await content.createCampaign(c.env.DB, L(c), U(c), await body(c)), 201)))
  app.get(base + '/campaigns/:id', wrap(async c => c.json(await content.getCampaign(c.env.DB, L(c), U(c), c.req.param('id')))))
  app.post(base + '/campaigns/:id/concepts', wrap(async c => c.json(await content.addConcept(c.env.DB, L(c), U(c), c.req.param('id'), await body(c), 'owner'), 201)))
  app.post(base + '/concepts/:id/status', wrap(async c => c.json(await content.setConceptStatus(c.env.DB, L(c), U(c), c.req.param('id'), String((await body(c)).status), 'owner'))))

  app.get(base + '/releases/:releaseId/intake', wrap(async c => c.json(await getIntake(c.env.DB, c.req.param('labelId'), c.req.param('releaseId')))))
  app.post(base + '/releases/:releaseId/intake/patch', wrap(async c => {
    const b = await body(c)
    return c.json(await updateIntake(c.env.DB, c.req.param('labelId'), c.req.param('releaseId'), c.get('lwUser').id, b.patch, b.expectedVersion, 'web'))
  }))
  app.get(base + '/releases/:releaseId/approval', wrap(async c => c.json(await approvalStatus(c.env.DB, L(c), c.req.param('releaseId'), U(c)))))
  app.post(base + '/releases/:releaseId/approval', wrap(async c => c.json(await approvalAction(c.env.DB, L(c), c.req.param('releaseId'), U(c), await body(c)))))
  app.get(base + '/releases/:releaseId/submissions', wrap(async c => c.json({ submissions: await listSubmissions(c.env.DB, c.req.param('labelId'), c.req.param('releaseId')) })))
  app.get(base + '/releases/:releaseId/submissions/:target', wrap(async c => c.json(await getPacket(c.env.DB, c.req.param('labelId'), c.req.param('releaseId'), c.req.param('target').toUpperCase()))))
  app.post(base + '/releases/:releaseId/submissions/report', wrap(async c => c.json(await reportSubmission(c.env.DB, c.req.param('labelId'), c.req.param('releaseId'), c.get('lwUser').id, await body(c), 'web'))))
  app.get(base + '/parties', wrap(async c => c.json({ parties: await listParties(c.env.DB, c.req.param('labelId')) })))
  app.post(base + '/parties', wrap(async c => c.json(await saveParty(c.env.DB, c.req.param('labelId'), c.get('lwUser').id, await body(c), 'web'), 201)))
  app.get(base + '/queue', wrap(async c => c.json(await queueOverview(c.env.DB, [c.req.param('labelId')]))))
  app.post(base + '/queue/:taskId/answer', wrap(async c => {
    // A human can close a waiting task from the website (e.g. "I answered in the intake form").
    const label = c.req.param('labelId'), id = c.req.param('taskId'), db = c.env.DB
    const t = await db.prepare("SELECT id FROM lw_tasks WHERE label_id=? AND id=? AND status IN ('QUEUED','BLOCKED','FAILED')").bind(label, id).first()
    if (!t) throw new ServiceError('Task not found or already running', 404)
    await db.prepare("UPDATE lw_tasks SET status='RUNNING',claimed_by='web',lease_until=datetime('now','+1 minute') WHERE id=?").bind(id).run()
    const b = await body(c)
    return c.json(await completeTask(db, c.get('lwUser').id, [label], { taskId: id, outcome: b.outcome ?? 'COMPLETED', summary: b.summary ?? 'Resolved on the website' }, 'web'))
  }))
  app.get(base + '/label-notifications', wrap(async c => c.json({ notifications: await listNotifications(c.env.DB, c.req.param('labelId'), c.get('lwUser').id, c.req.query('unread') === '1') })))
  app.post(base + '/label-notifications/:id/read', wrap(async c => {
    await c.env.DB.prepare('UPDATE lw_notifications SET read_at=CURRENT_TIMESTAMP WHERE label_id=? AND id=? AND (user_id=? OR user_id IS NULL)').bind(c.req.param('labelId'), c.req.param('id'), c.get('lwUser').id).run()
    return c.json({ ok: true })
  }))
  // Owner-triggered engine pass for this label only (the cron worker runs all labels).
  app.post(base + '/engine/run', wrap(async c => {
    if (c.get('lwRole') !== 'owner') throw new ServiceError('Owner permission required', 403)
    return c.json({ summary: await runEngine(c.env, { labelIds: [c.req.param('labelId')], maxReleases: 50 }) })
  }))
  // Agent setup: connector URL, ready-made prompts, and optional Claude scheduled-task wake hook.
  app.get(base + '/agents/setup', wrap(async c => {
    const origin = new URL(c.req.url).origin, label = c.req.param('labelId')
    const hook = await c.env.DB.prepare("SELECT updated_at FROM lw_label_secrets WHERE label_id=? AND name='claude_routine'").bind(label).first()
    return c.json({
      mcpUrl: origin + '/label-world/mcp', shiftPrompt: SHIFT_PROMPT,
      claudeRoutineConfigured: Boolean(hook), claudeRoutineUpdatedAt: hook?.updated_at ?? null,
      commands: {
        codex: `codex mcp add studio2u --url ${origin}/label-world/mcp`,
        claudeCode: `claude mcp add --transport http studio2u ${origin}/label-world/mcp`,
        claudeConnector: `Claude (web/desktop): Settings > Connectors > Add custom connector > ${origin}/label-world/mcp`
      }
    })
  }))
  app.post(base + '/agents/claude-routine', wrap(async c => {
    if (c.get('lwRole') !== 'owner') throw new ServiceError('Owner permission required', 403)
    const b = await body(c), label = c.req.param('labelId'), db = c.env.DB
    if (b.remove === true) { await db.prepare("DELETE FROM lw_label_secrets WHERE label_id=? AND name='claude_routine'").bind(label).run(); return c.json({ configured: false }) }
    const url = String(b.url ?? '').trim(), token = String(b.token ?? '').trim()
    if (!ROUTINE_URL.test(url)) throw new ServiceError('Paste the API trigger URL from claude.ai/code/routines (https://api.anthropic.com/v1/claude_code/routines/trig_.../fire)')
    if (!/^sk-ant-oat01-[A-Za-z0-9_-]{10,300}$/.test(token)) throw new ServiceError('Paste the scheduled-task API token (starts with sk-ant-oat01-). It only lets Studio2U start that one task.')
    const value = await encryptKey(c.env.LLM_KEY_ENCRYPTION_SECRET, JSON.stringify({ url, token }), `studio2u:routine:v1:${label}`)
    await db.batch([
      db.prepare("INSERT INTO lw_label_secrets(label_id,name,value,created_by) VALUES (?,?,?,?) ON CONFLICT(label_id,name) DO UPDATE SET value=excluded.value,created_by=excluded.created_by,updated_at=CURRENT_TIMESTAMP").bind(label, 'claude_routine', value, c.get('lwUser').id),
      db.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, c.get('lwUser').id, 'agents.claude_routine.configured', JSON.stringify({ url }))
    ])
    return c.json({ configured: true })
  }))
}
