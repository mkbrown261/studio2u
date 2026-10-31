// Live end-to-end check against a running Studio2U (local wrangler or deployed).
// Simulates exactly what Claude Code / Codex do: OAuth (DCR + PKCE + consent),
// then MCP tool calls with the official SDK client. Creates synthetic QA data only.
//   node tools/label-world-live-agent-check.mjs http://localhost:3000
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

const origin = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '')
const resource = origin + '/label-world/mcp', redirect = 'http://127.0.0.1:53682/callback'
let cookie = ''
async function http(path, { method = 'GET', form, json, headers = {}, manual = true } = {}) {
  const h = { ...headers, ...(cookie ? { Cookie: cookie } : {}) }
  let body
  if (form) { body = new URLSearchParams(form); h['Content-Type'] = 'application/x-www-form-urlencoded'; h.Origin = origin }
  if (json) { body = JSON.stringify(json); h['Content-Type'] = 'application/json'; h.Origin = origin }
  const r = await fetch(origin + path, { method, headers: h, body, redirect: manual ? 'manual' : 'follow' })
  const set = r.headers.getSetCookie?.() ?? []
  for (const c of set) if (c.startsWith('studio2u_session=')) cookie = c.split(';')[0]
  return r
}
const email = `qa+${Date.now()}@example.invalid`, password = 'QA-' + randomBytes(9).toString('hex')
let r = await http('/signup', { method: 'POST', form: { name: 'QA Agent Owner', email, phone: '5555550100', password, role_artist: '1', terms_accepted: '1' } })
assert.ok(cookie, 'signup should set a session cookie (status ' + r.status + ')')
const label = await (await http('/api/label-world/labels', { method: 'POST', json: { name: 'QA Live Label' } })).json()
assert.ok(label.id)

// --- OAuth exactly like an MCP client ---
const meta = await (await http('/.well-known/oauth-authorization-server')).json()
const reg = await (await fetch(meta.registration_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'Claude Code (live check)', redirect_uris: [redirect], token_endpoint_auth_method: 'none' }) })).json()
const verifier = randomBytes(32).toString('hex'), challenge = createHash('sha256').update(verifier).digest('base64url')
const scope = 'labels:read releases:read reviews:read tasks:read knowledge:read releases:write submissions:write tasks:write offline_access'
const q = new URLSearchParams({ client_id: reg.client_id, redirect_uri: redirect, resource, response_type: 'code', state: 's1', code_challenge: challenge, code_challenge_method: 'S256', scope })
r = await http('/label-world/oauth/authorize?' + q)
// Signed-in users get the consent page directly; signed-out users are sent to login first.
const consentPage = r.status === 200 ? await r.text() : await (await http(new URL(r.headers.get('Location'), origin).searchParams.get('returnTo'))).text()
assert.ok(consentPage.includes('releases:write'), 'consent shows write permission')
const rid = consentPage.match(/name="request" value="([a-f0-9]+)"/)[1], csrf = consentPage.match(/name="csrf" value="([a-f0-9]+)"/)[1]
const form = new URLSearchParams({ request: rid, csrf, label: label.id, decision: 'allow' }); for (const s of scope.split(' ')) form.append('scope', s)
r = await fetch(origin + '/label-world/oauth/consent', { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form, redirect: 'manual' })
const code = new URL(r.headers.get('Location')).searchParams.get('code'); assert.ok(code)
const tok = await (await fetch(meta.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: reg.client_id, redirect_uri: redirect, resource }) })).json()
assert.ok(tok.access_token && tok.refresh_token)

// --- MCP session ---
const client = new Client({ name: 'live-check', version: '1' })
await client.connect(new StreamableHTTPClientTransport(new URL(resource), { requestInit: { headers: { Authorization: 'Bearer ' + tok.access_token } } }))
const tools = (await client.listTools()).tools.map(t => t.name)
const call = async (n, a = {}) => { const x = await client.callTool({ name: 'studio2u_' + n, arguments: a }); if (x.isError) throw new Error(n + ': ' + x.content[0].text); return x.structuredContent.data }
const rel = await call('create_release', { labelId: label.id, artist: 'QA Artist', title: 'Live Check Single' })
const task = await call('claim_next_task', { canControlScreen: false })
await call('update_intake', { labelId: label.id, releaseId: rel.id, patch: { genre: 'R&B', explicit: false, radioEdit: false, instrumental: false, isRerelease: false, coverArtThirdParty: false, containsThirdPartyAudio: false, writers: [{ legalName: 'Qa Artist Legal', role: 'writer', split: 100, pro: 'ASCAP', ipi: '123456789' }], masterOwner: { entityName: 'QA Music LLC' } } })
await call('complete_task', { taskId: task.task.id, outcome: 'COMPLETED', summary: 'Collected intake from artist (synthetic)' })
const ascap = await call('get_submission_packet', { labelId: label.id, releaseId: rel.id, target: 'ASCAP' })
const um = await call('get_submission_packet', { labelId: label.id, releaseId: rel.id, target: 'UNITEDMASTERS' })
const queue = await call('queue_status')
const engine = await (await http(`/api/label-world/labels/${label.id}/engine/run`, { method: 'POST', json: {} })).json()
await client.close()
console.log(JSON.stringify({
  ok: true, origin, tools: tools.length, writeTools: tools.filter(t => /^studio2u_(create|update|save|report|claim|complete)_/.test(t)),
  firstTask: task.task.kind, ascapStatus: ascap.status, unitedMastersStillNeeds: um.packet.missing.map(m => m.key),
  openTasks: queue.open.map(t => `${t.kind}/${t.capability}/${t.status}`), engine: engine.summary
}, null, 1))
