import { Hono } from 'hono'
import { html, raw } from 'hono/html'
import type { AppEnv } from '../types'
import type { SessionUser } from '../lib/session'
import { getSessionUser } from '../lib/session'
import { installLabelLogin } from '../label-world/login'
import { installWorkspaceRoutes } from '../label-world/workspace-services'
import { installProviderRoutes } from '../label-world/providers/routes'
import { releaseInput } from '../label-world/contracts'
import { modeInput, organizations, rightsInput, rightsGate, registrationInput, text } from '../label-world/release-operations'

export const labelWorldRoutes = new Hono<AppEnv & { Variables: { lwUser: SessionUser; lwRole: string } }>()
// Mounted after global CSRF/security middleware, before the HTML renderer.
labelWorldRoutes.use('/api/label-world/*', async (c, next) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.json({ error: 'Sign in required' }, 401)
  c.set('lwUser', user)
  await next()
})
labelWorldRoutes.get('/api/label-world/labels', async c => {
  const user = c.get('lwUser')
  const result = await c.env.DB.prepare('SELECT l.id,l.name,m.role FROM lw_labels l JOIN lw_memberships m ON m.label_id=l.id WHERE m.user_id=?').bind(user.id).all()
  return c.json({ labels: result.results })
})
labelWorldRoutes.post('/api/label-world/labels', async c => {
  const user = c.get('lwUser')
  const body = await c.req.json().catch(() => null)
  if (typeof body?.name !== 'string' || !body.name.trim() || body.name.length > 100) return c.json({ error: 'Label name must be 1–100 characters' }, 400)
  const id = crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO lw_labels(id,name) VALUES (?,?)').bind(id, body.name.trim()),
    c.env.DB.prepare("INSERT INTO lw_memberships(label_id,user_id,role) VALUES (?,?,'owner')").bind(id, user.id)
  ])
  return c.json({ id, name: body.name.trim(), role: 'owner' }, 201)
})
labelWorldRoutes.use('/api/label-world/labels/:labelId/*', async (c, next) => {
  const user = c.get('lwUser')
  const member = await c.env.DB.prepare('SELECT role FROM lw_memberships WHERE label_id=? AND user_id=?').bind(c.req.param('labelId'), user.id).first<{ role: string }>()
  if (!member) return c.json({ error: 'Label not found' }, 404)
  if (c.req.method !== 'GET' && member.role === 'viewer') return c.json({ error: 'Editing permission required' }, 403)
  c.set('lwRole', member.role)
  await next()
})
labelWorldRoutes.get('/api/label-world/labels/:labelId/releases', async c => {
  const result = await c.env.DB.prepare('SELECT id,artist,title,release_type,state,workflow_state,release_mode,target_distributor,version FROM lw_releases WHERE label_id=? ORDER BY created_at DESC,id').bind(c.req.param('labelId')).all()
  return c.json({ releases: result.results })
})
labelWorldRoutes.post('/api/label-world/labels/:labelId/releases', async c => {
  let input: ReturnType<typeof releaseInput>
  let mode: ReturnType<typeof modeInput>, distributor: string
  try { const body = await c.req.json(); input = releaseInput(body); mode = modeInput(body.releaseMode); distributor = text(body.targetDistributor ?? 'UnitedMasters') } catch { return c.json({ error: 'Provide artist, title, valid release type/mode and distributor' }, 400) }
  const id = crypto.randomUUID(), label = c.req.param('labelId'), db = c.env.DB
  await db.batch([
    db.prepare('INSERT INTO lw_releases(id,label_id,artist,title,release_type,release_mode,target_distributor) VALUES (?,?,?,?,?,?,?)').bind(id,label,input.artist,input.title,input.releaseType,mode,distributor),
    ...organizations.map(org => db.prepare('INSERT INTO lw_registration_tasks(id,label_id,release_id,organization,owner_role) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),label,id,org,org==='PRO'?'publishing_admin':org==='COPYRIGHT'?'rights_admin':'royalty_admin')),
    db.prepare('INSERT INTO lw_audit_events(id,label_id,release_id,actor_id,action,payload_json) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),label,id,c.get('lwUser').id,'release.created',JSON.stringify({ releaseMode: mode, targetDistributor: distributor, followUp: organizations }))
  ])
  return c.json({ id, ...input, releaseMode: mode, targetDistributor: distributor, state: 'DRAFT', workflowState: 'INTAKE_PENDING', version: 1 }, 201)
})
labelWorldRoutes.get('/api/label-world/labels/:labelId/settings', async c => {
  const label = await c.env.DB.prepare('SELECT id,name,headquarters_json FROM lw_labels WHERE id=?').bind(c.req.param('labelId')).first()
  return c.json({ label })
})
labelWorldRoutes.post('/api/label-world/labels/:labelId/settings', async c => {
  if (c.get('lwRole') !== 'owner') return c.json({ error: 'Owner permission required' }, 403)
  let name: string, theme: string
  try { const b = await c.req.json(); name = text(b.name,100); theme = text(b.theme,40); if (!['charcoal_gold','midnight_cyan','violet_gold'].includes(theme)) throw new Error('Invalid theme') } catch { return c.json({ error: 'Provide label name and supported theme' },400) }
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE lw_labels SET name=?,headquarters_json=? WHERE id=?').bind(name,JSON.stringify({ theme, plaqueText: name }),c.req.param('labelId')),
    c.env.DB.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),c.req.param('labelId'),c.get('lwUser').id,'label.brand.updated',JSON.stringify({ name,theme }))
  ])
  return c.json({ name,theme })
})
labelWorldRoutes.get('/api/label-world/labels/:labelId/artists', async c => c.json({ artists: (await c.env.DB.prepare('SELECT id,display_name,profile_json FROM lw_artist_profiles WHERE label_id=?').bind(c.req.param('labelId')).all()).results }))
labelWorldRoutes.post('/api/label-world/labels/:labelId/artists', async c => {
  let name: string
  try { name = text((await c.req.json()).displayName) } catch { return c.json({ error: 'Artist display name required' },400) }
  const id = crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO lw_artist_profiles(id,label_id,display_name) VALUES (?,?,?)').bind(id,c.req.param('labelId'),name),
    c.env.DB.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),c.req.param('labelId'),c.get('lwUser').id,'artist.profile.created',JSON.stringify({ id,displayName:name }))
  ])
  return c.json({ id,displayName: name },201)
})
labelWorldRoutes.post('/api/label-world/labels/:labelId/releases/:releaseId/intake', async c => {
  let input: ReturnType<typeof releaseInput>, mode: ReturnType<typeof modeInput>, distributor: string, version: number
  try { const b = await c.req.json(); input = releaseInput(b); mode = modeInput(b.releaseMode); distributor = text(b.targetDistributor); version = b.version; if (!Number.isSafeInteger(version) || version < 1) throw new Error('Version required') } catch { return c.json({ error: 'Valid intake and current version required' },400) }
  const db = c.env.DB, label = c.req.param('labelId'), id = c.req.param('releaseId')
  const exists = await db.prepare('SELECT version FROM lw_releases WHERE label_id=? AND id=?').bind(label,id).first()
  if (!exists) return c.json({ error: 'Release not found' },404)
  const result = await db.batch([
    db.prepare('UPDATE lw_releases SET artist=?,title=?,release_type=?,release_mode=?,target_distributor=?,version=version+1,state=\'DRAFT\',workflow_state=\'INTAKE_PENDING\',updated_at=CURRENT_TIMESTAMP WHERE label_id=? AND id=? AND version=?').bind(input.artist,input.title,input.releaseType,mode,distributor,label,id,version),
    db.prepare('INSERT INTO lw_audit_events(id,label_id,release_id,actor_id,action,payload_json) SELECT ?,?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),label,id,c.get('lwUser').id,'release.intake.updated',JSON.stringify({ ...input,releaseMode: mode,targetDistributor: distributor,previousVersion: version })),
    db.prepare("UPDATE lw_approvals SET status='INVALIDATED' WHERE label_id=? AND release_id=? AND release_version<? AND status IN ('PENDING','APPROVED') AND changes()>0").bind(label,id,version+1)
  ])
  if (!result[0].meta.changes) return c.json({ error: 'Release changed; reload before saving' },409)
  return c.json({ version: version+1, ...input, releaseMode: mode })
})
labelWorldRoutes.post('/api/label-world/labels/:labelId/releases/:releaseId/rights', async c => {
  if (c.get('lwRole') !== 'owner') return c.json({ error: 'Only the owner may attest rights' },403)
  let assertions: ReturnType<typeof rightsInput>, version: number
  try { const b = await c.req.json(); assertions = rightsInput(b.assertions); version = b.version; if (!Number.isSafeInteger(version) || version<1) throw new Error('Version required') } catch { return c.json({ error: 'Complete rights assertions, owner provenance, notes and version required' },400) }
  const db=c.env.DB,label=c.req.param('labelId'),release=c.req.param('releaseId'),id=crypto.randomUUID(),actor=c.get('lwUser').id
  const current = await db.prepare('SELECT version FROM lw_releases WHERE label_id=? AND id=?').bind(label,release).first<{version:number}>()
  if (!current) return c.json({ error: 'Release not found' },404)
  if (current.version !== version) return c.json({ error: 'Release changed; review the current version' },409)
  try {
    const result = await db.batch([
      db.prepare('INSERT INTO lw_rights_reviews(id,label_id,release_id,release_version,assertions_json,attested_by) SELECT ?,?,?,?,?,? FROM lw_releases WHERE label_id=? AND id=? AND version=?').bind(id,label,release,version,JSON.stringify(assertions),actor,label,release,version),
      db.prepare('INSERT INTO lw_audit_events(id,label_id,release_id,actor_id,action,payload_json) SELECT ?,?,?,?,?,? FROM lw_rights_reviews WHERE id=?').bind(crypto.randomUUID(),label,release,actor,'rights.owner.attested',JSON.stringify({ version,assertions }),id)
    ])
    if (!result[0].meta.changes) return c.json({ error: 'Release changed; reload' },409)
  } catch { return c.json({ error: 'Rights already recorded for this version; revise intake to create a new snapshot' },409) }
  return c.json({ reviewId:id, rights: rightsGate(assertions) },201)
})
labelWorldRoutes.get('/api/label-world/labels/:labelId/releases/:releaseId/workflow', async c => {
  const db=c.env.DB,label=c.req.param('labelId'),id=c.req.param('releaseId')
  const release=await db.prepare('SELECT * FROM lw_releases WHERE label_id=? AND id=?').bind(label,id).first<{version:number}>()
  if (!release) return c.json({ error:'Release not found' },404)
  const review=await db.prepare('SELECT assertions_json FROM lw_rights_reviews WHERE label_id=? AND release_id=? AND release_version=?').bind(label,id,release.version).first<{assertions_json:string}>()
  const rights=rightsGate(review ? JSON.parse(review.assertions_json) : null)
  const registrations=(await db.prepare('SELECT * FROM lw_registration_tasks WHERE label_id=? AND release_id=? ORDER BY organization').bind(label,id).all()).results
  return c.json({ release,rights,rightsReviewRecorded:Boolean(review),registrations,readiness:{ status: rights.status==='BLOCKED'?'BLOCKED':'INCOMPLETE', checks:[{check:'audio_and_artwork',result:'NOT_TESTED'},{check:'current_distributor_rules',result:'NOT_TESTED'},{check:'package_integrity',result:'NOT_TESTED'},{check:'owner_delivery_approval',result:'NOT_TESTED'}] },distribution:{ capability:'UNVERIFIED', submission:'UNAVAILABLE', handoff:'PREPARATION_ONLY' } })
})
labelWorldRoutes.get('/api/label-world/labels/:labelId/registrations', async c => {
  const result=await c.env.DB.prepare('SELECT t.*,r.title,r.artist FROM lw_registration_tasks t JOIN lw_releases r ON r.label_id=t.label_id AND r.id=t.release_id WHERE t.label_id=? ORDER BY t.created_at,t.organization').bind(c.req.param('labelId')).all()
  return c.json({ registrations:result.results,automaticReminders:'NOT_IMPLEMENTED' })
})
labelWorldRoutes.post('/api/label-world/labels/:labelId/registrations/:taskId', async c => {
  if (c.get('lwRole') !== 'owner') return c.json({ error:'Owner permission required for registration declarations' },403)
  let input: ReturnType<typeof registrationInput>
  try { input=registrationInput(await c.req.json()) } catch(e) { return c.json({ error:(e as Error).message },400) }
  const db=c.env.DB,label=c.req.param('labelId'),id=c.req.param('taskId'),mutation=crypto.randomUUID()
  const task=await db.prepare('SELECT release_id FROM lw_registration_tasks WHERE label_id=? AND id=?').bind(label,id).first<{release_id:string}>()
  if (!task) return c.json({ error:'Task not found' },404)
  const result=await db.batch([
    db.prepare('UPDATE lw_registration_tasks SET status=?,applicability=?,reason=?,next_review_at=?,receipt_url=?,reported_status=?,evidence_status=?,revision=revision+1,last_mutation=?,updated_at=CURRENT_TIMESTAMP WHERE label_id=? AND id=? AND revision=?').bind(input.status,input.applicability,input.reason,input.nextReviewAt,input.receiptUrl,input.reportedStatus,input.status==='AWAITING_VERIFICATION'?'UNVERIFIED':'USER_CONFIRMED',mutation,label,id,input.revision),
    db.prepare('INSERT INTO lw_audit_events(id,label_id,release_id,actor_id,action,payload_json) SELECT ?,?,?,?,?,? FROM lw_registration_tasks WHERE label_id=? AND id=? AND last_mutation=?').bind(crypto.randomUUID(),label,task.release_id,c.get('lwUser').id,'registration.task.updated',JSON.stringify({ taskId:id,...input }),label,id,mutation)
  ])
  if (!result[0].meta.changes) return c.json({ error:'Task changed; reload before updating' },409)
  return c.json({ ...input, revision:input.revision+1,verification:input.status==='AWAITING_VERIFICATION'?'UNVERIFIED':'USER_CONFIRMED' })
})
labelWorldRoutes.get('/api/label-world/labels/:labelId/events', async c => {
  const after = Number(c.req.query('after') ?? 0)
  if (!Number.isSafeInteger(after) || after < 0) return c.json({ error: 'Invalid cursor' }, 400)
  const result = await c.env.DB.prepare('SELECT cursor,task_id,status,payload_json,created_at FROM lw_task_events WHERE label_id=? AND cursor>? ORDER BY cursor LIMIT 100').bind(c.req.param('labelId'),after).all()
  return c.json({ events: result.results })
})

installProviderRoutes(labelWorldRoutes)
installWorkspaceRoutes(labelWorldRoutes)
installLabelLogin(labelWorldRoutes)

labelWorldRoutes.get('/label-world/dashboard', async c => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/label-world/login?returnTo=%2Flabel-world%2Fdashboard')
  return c.html(html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Label World Dashboard · Studio2U</title>
  <style>[hidden]{display:none!important}body{margin:0;background:#101018;color:#eee;font:16px system-ui}main{max-width:900px;margin:auto;padding:48px 24px}a{color:#e8bf6b}h1{font-size:44px}section{padding:24px;background:#1c1b28;border:1px solid #393244;border-radius:16px;margin:24px 0}input,select,button{padding:12px;border-radius:8px;margin:6px;border:1px solid #5b5066;background:#252233;color:#fff}button{background:#d6b567;color:#15111d;cursor:pointer}button:disabled{opacity:.4}label{display:inline-block}li{padding:10px}#lw-message{min-height:24px;color:#e8bf6b}.status{color:#bcb1ce;line-height:1.7}</style></head><body><main id="label-world">
  <a href="/label-world">Headquarters &amp; employee dashboards</a> · <a href="/">Studio2U</a><h1>Your label starts here.</h1><p>Welcome, ${user.name}. Create a label workspace and your first release draft.</p>
  <p class="status">Foundation preview: workspaces and release drafts are available. The 3D headquarters and employee workspaces are available from the headquarters. Uploads, background agent execution and release ZIP generation remain unfinished.</p>
  <p id="lw-message" role="status"></p>
  <section><h2>Label workspace</h2><label>Current label <select id="lw-labels"></select></label><form id="lw-label-form"><label>New label name <input name="name" maxlength="100" required></label><button>Create label</button></form></section>
  <section><h2>Release drafts</h2><ul id="lw-releases"></ul><form id="lw-release-form"><label>Artist <input name="artist" maxlength="200" required></label><label>Title <input name="title" maxlength="200" required></label><label>Type <select name="releaseType"><option value="single">Single</option><option value="ep">EP</option><option value="album">Album</option></select></label><label>Workflow <select name="releaseMode"><option value="FAST_RELEASE">Fast Release</option><option value="MANAGED_RELEASE">Managed Release</option></select></label><label>Distributor <input name="targetDistributor" value="UnitedMasters" maxlength="200" required></label><button id="lw-release-submit" disabled>Create release</button><button id="lw-cancel-edit" type="button" hidden>Cancel revision</button></form><p class="status">Both workflows require rights review. Distribution, PRO, MLC, SoundExchange and copyright are separate processes. No external submissions are enabled.</p></section>
  <section><h2>Rights and release readiness</h2><p id="lw-workflow-summary">Select a release to review.</p><form id="lw-rights-form" hidden><div id="lw-rights-fields"></div><label><input name="attest" type="checkbox" required>I am the label owner and confirm these declarations for this release version.</label><button>Record owner attestation</button></form><p class="status">Attestation is an owner statement, not independent legal verification. Changing intake creates a new version requiring renewed review. Audio inspection, packaging and current distributor rules remain not tested.</p></section>
  <section><h2>Registration follow-up</h2><p class="status">Tasks persist even with zero streams. Uploaded receipt links remain unverified. Automatic reminders and external registration connections are not enabled.</p><ul id="lw-registrations"></ul></section>
  <section><h2>Agent reasoning provider</h2><p>Connect your own API account and choose the model to use. Your keys are personal; other label members cannot use them. Provider API usage is billed by your provider.</p><p id="lw-provider-status" role="status"></p>
  <form id="lw-provider-connect"><label>Provider <select id="lw-provider" name="provider"><option value="openai">OpenAI</option><option value="anthropic">Claude / Anthropic</option><option value="kimi">Kimi</option><option value="qwen">Qwen</option><option value="openrouter">OpenRouter</option></select></label><label>API key <input type="password" name="apiKey" autocomplete="off" maxlength="4096" required></label><div id="lw-qwen-config" hidden><label>Qwen region <select name="region"><option value="us">US / Virginia</option><option value="singapore">Singapore</option><option value="beijing">Beijing</option><option value="hongkong">Hong Kong</option><option value="tokyo">Tokyo</option></select></label><label>Workspace ID <input name="workspace" maxlength="80"></label></div><button>Save API key</button><button type="button" id="lw-provider-disconnect">Disconnect</button></form>
  <button type="button" id="lw-refresh-models">Refresh available models</button><form id="lw-model-form"><label>Available models <select id="lw-models" name="model"></select></label><label id="lw-qwen-model-label" hidden>Qwen model ID <input name="qwenModel" maxlength="200" placeholder="Exact ID from Model Studio"></label><button>Save model choice</button></form>
  <form id="lw-reasoning-test"><label>Test message <input name="prompt" maxlength="8000" required placeholder="Ask a question to test your selected model"></label><button>Send test message</button></form><pre id="lw-reasoning-output" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre><p class="status">This tests the provider connection. Employee workflows and business tools are still being built. Test messages are sent to your selected provider.</p></section>
  <section><h2>Your first team</h2><p>Researcher · A&amp;R and sourced requirements</p><p>Reviewer · File and metadata quality assurance</p><p class="status">Character modeling follows your supplied references. No agent jobs are running in this preview.</p></section>
  </main><script src="/label-world.js" defer></script></body></html>`)
})

// Public shared-art headquarters; all label/user data continues to require session membership.
async function headquartersPage(c:any, requireSession=false){
  c.header('Cache-Control','no-store')
  const user=await getSessionUser(c.env.DB,c.req.raw)
  if(requireSession&&!user)return c.redirect('/label-world/login?returnTo='+encodeURIComponent(new URL(c.req.url).pathname))
  c.header('Cache-Control','no-store')
  const bootstrap=JSON.stringify({authenticated:Boolean(user),userName:user?.name||null}).replace(/</g,'\\u003c')
  return c.html(html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Studio2U · Label World Headquarters</title><link rel="stylesheet" href="/label-world-ui.css"><link rel="stylesheet" href="/label-world-hq.css"></head><body><div id="label-world-app"><p style="padding:32px;color:#e8bd6b;background:#080d12">Loading Studio2U headquarters…</p></div><script id="label-world-bootstrap" type="application/json">${raw(bootstrap)}</script><script type="module" src="/label-world/app/main.js"></script><noscript><p>JavaScript is required for 3D headquarters. <a href="/label-world/dashboard">Open accessible release dashboard</a>.</p></noscript></body></html>`)
}
labelWorldRoutes.get('/label-world',c=>headquartersPage(c))
labelWorldRoutes.get('/label-world/agents/:agent',c=>{
  if(!['researcher','reviewer','executive','builder'].includes(c.req.param('agent')))return c.notFound()
  return headquartersPage(c,true)
})
