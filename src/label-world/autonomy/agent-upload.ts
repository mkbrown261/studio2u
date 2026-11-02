// One-time upload links so the owner's own agent (Codex/Claude) can hand Studio2U an image it
// made with its OWN image tool. No Studio2U image key needed. The link is an HMAC-signed,
// 30-minute token bound to one label, one user and one MAKE_IMAGE task.
import { ServiceError, requireEditor } from './service'

const enc = new TextEncoder()
const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
async function sign(secret: string, msg: string) {
  if (!secret) throw new ServiceError('Secure storage is not configured on this deployment', 503)
  const k = await crypto.subtle.importKey('raw', enc.encode('studio2u:agent-upload:v1:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(msg)))
}
export async function uploadLink(env: any, label: string, actor: number, taskId: string, origin: string, now = Date.now()) {
  await requireEditor(env.DB, label, actor)
  const t: any = await env.DB.prepare("SELECT id,status,input_json FROM lw_tasks WHERE label_id=? AND id=? AND kind='MAKE_IMAGE'").bind(label, taskId).first()
  if (!t) throw new ServiceError('No image task with that id', 404)
  if (!['QUEUED', 'RUNNING'].includes(t.status)) throw new ServiceError('That image task is already finished', 409)
  const exp = Math.floor(now / 1000) + 1800
  const body = `${label}.${actor}.${taskId}.${exp}`
  const token = b64u(enc.encode(body)) + '.' + await sign(env.LLM_KEY_ENCRYPTION_SECRET, body)
  const url = `${origin}/label-world/agent-upload/${token}`
  return { url, expiresInSeconds: 1800, curl: `curl -sS -X POST -H 'Content-Type: image/png' --data-binary @image.png '${url}'`, say: 'POST the PNG bytes to url (Content-Type: image/png). One use, 30 minutes.' }
}
export async function readToken(env: any, token: string, now = Date.now()) {
  const [p, sig] = String(token).split('.')
  if (!p || !sig || p.length > 400) throw new ServiceError('Invalid link', 403)
  let body: string; try { body = atob(p.replace(/-/g, '+').replace(/_/g, '/')) } catch { throw new ServiceError('Invalid link', 403) }
  if (await sign(env.LLM_KEY_ENCRYPTION_SECRET, body) !== sig) throw new ServiceError('Invalid link', 403)
  const [label, user, taskId, exp] = body.split('.')
  if (!label || !taskId || !(Number(exp) * 1000 > now)) throw new ServiceError('This upload link expired. Ask for a new one.', 403)
  return { label, user: Number(user), taskId }
}
/** Save the agent's PNG where the task says (release artwork or merch design) and finish the task. */
export async function acceptUpload(env: any, token: string, bytes: Uint8Array, now = Date.now()) {
  const { label, user, taskId } = await readToken(env, token, now)
  const t: any = await env.DB.prepare("SELECT id,status,input_json FROM lw_tasks WHERE label_id=? AND id=? AND kind='MAKE_IMAGE'").bind(label, taskId).first()
  if (!t || !['QUEUED', 'RUNNING'].includes(t.status)) throw new ServiceError('That image task is already finished', 409)
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) throw new ServiceError('Send one PNG under 25 MB', 413)
  const input = JSON.parse(t.input_json || '{}')
  let saved: any
  if (input.kind === 'cover') { const { saveCover } = await import('./creative'); saved = await saveCover(env, label, user, input.releaseId, bytes, { provider: 'your agent', idea: null }) }
  else { const { saveAgentDesign } = await import('./merch'); saved = await saveAgentDesign(env, label, user, bytes, input.title ?? null, input.ideaId ?? null) }
  const done = await env.DB.prepare("UPDATE lw_tasks SET status='COMPLETED',result_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('QUEUED','RUNNING')").bind(JSON.stringify({ outcome: 'IMAGE_SAVED', ...saved }), taskId).run()
  if (done.meta.changes) await env.DB.prepare('INSERT INTO lw_task_events(label_id,task_id,status,payload_json) VALUES (?,?,?,?)').bind(label, taskId, 'COMPLETED', JSON.stringify({ by: 'agent-upload' })).run()
  return { saved: true, kind: input.kind, ...saved }
}
