// Creative work the team does for the owner:
//  - Cover art: made with whichever image AI the owner connected (the provider switch), saved as
//    the release artwork, then Eric reviews it like any upload.
//  - Release package: ONE zip with the actual master, artwork and a manifest (checksums).
//  - Creative tools (Suno, Higgsfield, Genjitsu): the owner logs in once; their own agent works
//    the site through screen control. Anything that spends money or publishes = a checkpoint.
//  - Brand kickoff: as soon as the artist is known, Ben studies the brand and starts making things.
import { zipSync, strToU8 } from 'fflate'
import { ServiceError, requireEditor } from './service'
import { checksum } from '../reviewer/inspect'
import { pngInfo } from './merch'

export const TOOLS = {
  suno: { name: 'Suno', url: 'https://suno.com/create', makes: 'songs, beats and instrumentals' },
  higgsfield: { name: 'Higgsfield', url: 'https://higgsfield.ai', makes: 'music videos, visualizers and short-form video' },
  genjitsu: { name: 'Genjitsu', url: 'https://genjitsu.ai', makes: 'video edits' }
} as const
export type Tool = keyof typeof TOOLS
const str = (v: unknown, f: string, max: number, req = false) => {
  if (v == null || v === '') { if (req) throw new ServiceError(`${f} is required`); return null }
  if (typeof v !== 'string' || v.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)) throw new ServiceError(`Invalid ${f}`)
  return v.trim() || null
}
async function release(db: any, label: string, id: string) {
  const r: any = await db.prepare('SELECT * FROM lw_releases WHERE label_id=? AND id=?').bind(label, id).first()
  if (!r) throw new ServiceError('Release not found', 404)
  return r
}

// ---------------- cover art ----------------
export function coverPrompt(r: any, idea: string | null, brand: { genres?: string[]; brandWords?: string[] }) {
  return [
    `Album cover art for the ${r.release_type} "${r.title}" by ${r.artist}.`,
    idea ? `Concept: ${idea}.` : 'Concept: a bold, original image that fits the song title and mood.',
    brand.genres?.length ? `Genre: ${brand.genres.join(', ')}.` : '',
    brand.brandWords?.length ? `Brand feel: ${brand.brandWords.join(', ')}.` : '',
    `Square composition. Put the text "${r.artist}" and "${r.title}" on it, spelled exactly, clean and legible.`,
    'Original artwork only: no existing logos, brands, trademarks, real celebrities or copyrighted characters. No borders, no mockup, no frame: the artwork fills the whole canvas.'
  ].filter(Boolean).join(' ')
}
export async function generateCover(env: any, label: string, actor: number, releaseId: string, b: any, fetcher?: typeof fetch) {
  await requireEditor(env.DB, label, actor)
  const r = await release(env.DB, label, releaseId)
  const idea = str(b?.prompt, 'idea', 1500)
  const facts = (await env.DB.prepare("SELECT key,value_json FROM lw_artist_facts WHERE label_id=? AND key IN ('genres','brandWords')").bind(label).all().catch(() => ({ results: [] }))).results as any[]
  const f: Record<string, any> = {}; for (const x of facts) f[x.key] = JSON.parse(x.value_json)
  const prompt = coverPrompt(r, idea, f)
  const { makeImage } = await import('../providers/images')
  let made: any
  try { made = await makeImage(env, actor, { prompt, provider: b?.provider ?? null, label, shape: 'square', needPng: true, hi: true }, fetcher) }
  catch (e: any) {
    // No image key? The owner's own agent (Codex/Claude) makes it with its own image tool and uploads it.
    if (e?.code === 'NO_KEY' || e?.code === 'KEY_FAILED') return imageTask(env.DB, label, { kind: 'cover', releaseId: r.id, prompt, title: `Cover for "${r.title}"`, why: e.code === 'KEY_FAILED' ? e.message : null })
    throw new ServiceError(e?.message ?? 'Image failed', e?.status ?? 502)
  }
  const saved = await saveCover(env, label, actor, r.id, made.bytes, { provider: made.provider, model: made.model, idea })
  return { ...saved, estimatedCostUsd: made.costMicros / 1e6 }
}
/** Store a PNG as the release artwork (from the image switch, or uploaded by the owner's agent). */
export async function saveCover(env: any, label: string, actor: number, releaseId: string, bytes: Uint8Array, meta: { provider: string; model?: string | null; idea?: string | null }) {
  await requireEditor(env.DB, label, actor)
  const r = await release(env.DB, label, releaseId)
  const info = pngInfo(bytes), id = crypto.randomUUID(), key = `label-world/private/${label}/${r.id}/${id}`, hash = await checksum(bytes)
  await env.R2.put(key, bytes, { httpMetadata: { contentType: 'image/png' } })
  await env.DB.batch([
    env.DB.prepare('INSERT INTO lw_assets(id,label_id,release_id,kind,original_name,object_key,byte_size,sha256,version,provenance_json) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(id, label, r.id, 'artwork', `${r.title}-cover-${meta.provider}.png`.replace(/[^\w.-]+/g, '-'), key, bytes.length, hash, r.version, JSON.stringify({ generatedBy: actor, provider: meta.provider, model: meta.model ?? null, idea: meta.idea ?? null })),
    env.DB.prepare('INSERT INTO lw_audit_events(id,label_id,release_id,actor_id,action,payload_json) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(), label, r.id, actor, 'artwork.generated', JSON.stringify({ assetId: id, provider: meta.provider, width: info.width }))
  ])
  const small = info.width < 3000 || info.height < 3000
  return { assetId: id, width: info.width, height: info.height, provider: meta.provider,
    say: small ? `Cover made with ${meta.provider} (${info.width}×${info.height}). Distributors want 3000×3000: switch to Gemini or OpenRouter (they make 4K), or upscale it before release.` : `Cover made with ${meta.provider} (${info.width}×${info.height}) and saved as this release's artwork. Ask Eric to review it.` }
}
/** Queue the image for the owner's own agent, which makes it with its own image tool (no key needed here). */
export async function imageTask(db: any, label: string, t: { kind: 'cover' | 'merch'; releaseId?: string | null; prompt: string; title: string; ideaId?: string | null; why?: string | null }) {
  const { enqueue } = await import('./engine')
  const queued = await enqueue(db, { label, release: t.releaseId ?? null, kind: 'MAKE_IMAGE', role: 'producer', capability: 'ANY', title: `Make image: ${t.title}`.slice(0, 200), input: t, dedupe: `img:${t.kind}:${t.releaseId ?? t.ideaId ?? ''}:${Date.now()}` })
  if (!queued) throw new ServiceError('Your agents are stopped (STOP is on). Tap Resume first.', 423)
  return { queued: true, say: `${t.why ? t.why + ' ' : ''}Your agent makes this with its own image tool (Codex/Claude already make images) and saves it here. It runs the next time your agent works ("do my Studio2U tasks").` }
}
export async function assetImage(env: any, label: string, releaseId: string, assetId: string) {
  const a: any = await env.DB.prepare("SELECT object_key FROM lw_assets WHERE label_id=? AND release_id=? AND id=? AND kind='artwork'").bind(label, releaseId, assetId).first()
  if (!a) throw new ServiceError('Artwork not found', 404)
  const o = await env.R2.get(a.object_key); if (!o) throw new ServiceError('Artwork file missing', 404)
  return new Uint8Array(await o.arrayBuffer())
}

// ---------------- release package (one zip) ----------------
export async function packageZip(env: any, label: string, releaseId: string) {
  const r = await release(env.DB, label, releaseId)
  const assets = (await env.DB.prepare("SELECT id,kind,original_name,object_key,byte_size,sha256,version,created_at FROM lw_assets WHERE label_id=? AND release_id=? AND kind IN ('master','artwork','document') ORDER BY created_at DESC,rowid DESC").bind(label, releaseId).all()).results as any[]
  const latest = ['master', 'artwork'].map(k => assets.find(a => a.kind === k)).filter(Boolean) as any[]
  if (!latest.length) throw new ServiceError('Upload the master WAV or artwork first; there is nothing to package yet.', 409)
  const files: Record<string, Uint8Array> = {}, listed: any[] = []
  for (const a of latest) {
    const o = await env.R2.get(a.object_key); if (!o) continue
    const ext = a.kind === 'master' ? 'wav' : 'png', name = `${a.kind === 'master' ? 'audio' : 'artwork'}/${(r.artist + ' - ' + r.title).replace(/[\\/:*?"<>|]+/g, '').trim()}.${ext}`
    files[name] = [new Uint8Array(await o.arrayBuffer()), { level: 0 }] as any
    listed.push({ path: name, kind: a.kind, originalName: a.original_name, bytes: a.byte_size, sha256: a.sha256, releaseVersion: a.version })
  }
  let meta: any = {}; try { meta = JSON.parse(r.metadata_json || '{}') } catch { /* keep empty */ }
  const approval: any = await env.DB.prepare("SELECT status,release_version FROM lw_approvals WHERE label_id=? AND release_id=? ORDER BY created_at DESC LIMIT 1").bind(label, releaseId).first()
  const manifest = { manifestVersion: 1, generatedAt: new Date().toISOString(), release: { id: r.id, title: r.title, artist: r.artist, type: r.release_type, mode: r.release_mode, distributor: r.target_distributor, version: r.version, state: r.state }, intake: meta.intake ?? {}, credits: meta.credits ?? [], files: listed, finalApproval: approval ? { status: approval.status, version: approval.release_version } : { status: 'NOT_REQUESTED' }, note: 'Checksums prove these are the exact files Studio2U stored and reviewed.' }
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
  files['README.txt'] = strToU8(`${r.artist} - ${r.title} (v${r.version})\n\naudio/     your master\nartwork/   your cover\nmanifest.json  release details, credits and SHA-256 checksums\n`)
  const zip = zipSync(files as any)
  return { bytes: zip, filename: `${(r.artist + '-' + r.title).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-v${r.version}.zip` }
}

// ---------------- creative tools via screen control ----------------
export async function creativeTask(db: any, label: string, actor: number, b: any, enqueueFn: (t: any) => Promise<boolean>) {
  await requireEditor(db, label, actor)
  const tool = String(b?.tool ?? '') as Tool
  if (!TOOLS[tool]) throw new ServiceError(`tool must be one of ${Object.keys(TOOLS).join(', ')}`)
  const goal = str(b?.goal, 'what to make', 1500, true)!
  const releaseId = b?.releaseId ? (await release(db, label, String(b.releaseId))).id : null
  const t = TOOLS[tool], stamp = Date.now()
  const queued = await enqueueFn({ label, release: releaseId, kind: 'CREATIVE_TOOL', role: 'producer', capability: 'SCREEN_CONTROL', title: `${t.name}: ${goal}`.slice(0, 200), input: { tool, toolName: t.name, url: t.url, goal }, dedupe: `creative:${tool}:${stamp}` })
  if (!queued) throw new ServiceError('Your agents are stopped (STOP is on). Tap Resume first.', 423)
  return { queued: true, say: `Queued for your agent: it opens ${t.name} in your browser (log in there once), makes it, saves the files and checks with you before spending credits or publishing. Open Codex/Claude and say "do my Studio2U tasks".` }
}

// ---------------- brand kickoff ----------------
export async function brandKickoff(db: any, label: string, actor: number | null, enqueueFn: (t: any) => Promise<boolean>, force = false) {
  if (actor != null) await requireEditor(db, label, actor)
  const id: any = await db.prepare('SELECT artist_name FROM lw_label_identity WHERE label_id=?').bind(label).first()
  if (!id?.artist_name) throw new ServiceError('Save your artist name first (Know me) so Ben knows whose brand to build.', 409)
  return enqueueFn({ label, kind: 'BRAND_KICKOFF', role: 'business_partner', capability: 'ANY', title: `Ben: build ${id.artist_name}'s brand and first merch`, input: { artist: id.artist_name }, dedupe: force ? `brand:${label}:${Date.now()}` : `brand:${label}` })
}
