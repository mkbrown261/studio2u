// One image switch for the whole label: uses whichever image-capable key the owner connected
// (OpenAI, Google Gemini, xAI Grok, OpenRouter), or the one they pick. Spend is checked against
// the owner's monthly AI budget first and recorded after (estimated per image).
// Endpoints checked 2026-10-30: platform.openai.com images/generations; docs.x.ai images/generation
// (grok-imagine-image-2.0, response_format b64_json); ai.google.dev image-generation (Nano Banana,
// v1beta/interactions); openrouter.ai/docs image-generation (POST /api/v1/images, base64 output).
import { decryptKey, keyContext } from './vault'
import { spendGuard } from './budget'

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>
export const IMAGE_PROVIDERS = ['openai', 'gemini', 'xai', 'openrouter'] as const
export type ImageProvider = typeof IMAGE_PROVIDERS[number]
export const IMAGE_INFO: Record<ImageProvider, { name: string; model: string; costMicros: number; transparent: boolean }> = {
  openai: { name: 'OpenAI', model: 'gpt-image-2.5-flare', costMicros: 100000, transparent: true },
  gemini: { name: 'Google Gemini (Nano Banana)', model: 'gemini-nano-banana-2.1', costMicros: 70000, transparent: false },
  xai: { name: 'xAI Grok Imagine', model: 'grok-imagine-image-2.0', costMicros: 70000, transparent: false },
  openrouter: { name: 'OpenRouter', model: 'openai/gpt-image-2', costMicros: 130000, transparent: true }
}
export class ImageError extends Error { status: number; code: string | null; constructor(m: string, s = 400, code: string | null = null) { super(m); this.status = s; this.code = code } }

/** Which image providers this user has keys for, and which one "Auto" will use. */
export async function imageProviders(db: any, user: number, label?: string) {
  const rows = (await db.prepare('SELECT provider FROM lw_provider_connections WHERE user_id=?').bind(user).all()).results as { provider: string }[]
  const have = IMAGE_PROVIDERS.filter(p => rows.some(r => r.provider === p))
  let preferred: string | null = null
  if (label) { const pref: any = await db.prepare('SELECT provider FROM lw_reasoning_preferences WHERE label_id=? AND user_id=?').bind(label, user).first().catch(() => null); preferred = pref?.provider ?? null }
  const auto = (have as string[]).includes(preferred ?? '') ? preferred as ImageProvider : have[0] ?? null
  return { available: have.map(p => ({ id: p, ...IMAGE_INFO[p] })), auto, chatOnly: rows.map(r => r.provider).filter(p => !(IMAGE_PROVIDERS as readonly string[]).includes(p)) }
}

/** Find base64 image bytes in any provider's JSON (b64_json, inlineData, data+mime, data: URLs, nested outputs). */
export function findImage(v: any, depth = 0): { b64: string; mime: string | null } | null {
  if (!v || depth > 8) return null
  if (typeof v === 'string') { const m = /^data:(image\/[a-z+]+);base64,(.+)$/s.exec(v); return m ? { b64: m[2], mime: m[1] } : null }
  if (Array.isArray(v)) { for (const x of v) { const r = findImage(x, depth + 1); if (r) return r } return null }
  if (typeof v === 'object') {
    if (typeof v.b64_json === 'string') return { b64: v.b64_json, mime: v.mime_type ?? v.media_type ?? null }
    if (v.inlineData?.data) return { b64: v.inlineData.data, mime: v.inlineData.mimeType ?? null }
    if (v.inline_data?.data) return { b64: v.inline_data.data, mime: v.inline_data.mime_type ?? null }
    const mime = v.mime_type ?? v.mimeType ?? v.media_type
    if (typeof v.data === 'string' && v.data.length > 100 && (!mime || /^image\//.test(mime))) return { b64: v.data.replace(/^data:image\/[a-z+]+;base64,/, ''), mime: mime ?? null }
    for (const k of ['data', 'output_image', 'outputs', 'output', 'images', 'image', 'image_url', 'url', 'candidates', 'content', 'parts', 'choices', 'message']) if (k in v) { const r = findImage(v[k], depth + 1); if (r) return r }
  }
  return null
}
export const isPng = (b: Uint8Array) => b.length > 8 && b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71
const b64bytes = (s: string) => { const bin = atob(s), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out }

async function call(p: ImageProvider, key: string, prompt: string, o: { shape: 'square' | 'portrait'; transparent: boolean; hi?: boolean }, f: Fetch): Promise<Response> {
  const json = (url: string, body: unknown, headers: Record<string, string>) => f(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(150000) })
  const bearer = { Authorization: 'Bearer ' + key }
  if (p === 'openai') {
    const size = o.shape === 'square' ? '2048x2048' : '1600x2000', small = o.shape === 'square' ? '1024x1024' : '1024x1536'
    const body = (s: string) => ({ model: IMAGE_INFO.openai.model, prompt, size: s, quality: 'medium', ...(o.transparent ? { background: 'transparent' } : {}), output_format: 'png', n: 1 })
    const r = await json('https://api.openai.com/v1/images/generations', body(size), bearer)
    return r.status === 400 ? json('https://api.openai.com/v1/images/generations', body(small), bearer) : r
  }
  if (p === 'xai') return json('https://api.x.ai/v1/images/generations', { model: IMAGE_INFO.xai.model, prompt, n: 1, response_format: 'b64_json', aspect_ratio: o.shape === 'square' ? '1:1' : '4:5', resolution: '2k', quality: 'medium' }, bearer)
  if (p === 'openrouter') return json('https://openrouter.ai/api/v1/images', { model: IMAGE_INFO.openrouter.model, prompt, n: 1, aspect_ratio: o.shape === 'square' ? '1:1' : '4:5', resolution: o.hi ? '4K' : '2K', quality: o.hi ? 'high' : 'medium', output_format: 'png', ...(o.transparent ? { background: 'transparent' } : {}) }, bearer)
  // Gemini: documented interactions API first, then classic generateContent.
  const g = { 'x-goog-api-key': key }
  const r = await json('https://generativelanguage.googleapis.com/v1beta/interactions', { model: IMAGE_INFO.gemini.model, input: [{ type: 'text', text: prompt }], response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: o.shape === 'square' ? '1:1' : '4:5', image_size: o.hi ? '4K' : '2K' } }, g)
  if (r.status !== 404 && r.status !== 400) return r
  return json('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent', { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: o.shape === 'square' ? '1:1' : '4:5' } } }, g)
}

/** Make one image with the chosen (or auto) provider. Returns PNG/JPEG bytes and what it cost. */
export async function makeImage(env: any, user: number, o: { prompt: string; provider?: string | null; label?: string; shape?: 'square' | 'portrait'; transparent?: boolean; needPng?: boolean; hi?: boolean }, fetcher: Fetch = fetch) {
  const { available, auto, chatOnly } = await imageProviders(env.DB, user, o.label)
  if (!available.length) throw new ImageError(`Connect an image-capable AI key in AI setup (OpenAI, Google Gemini, xAI Grok or OpenRouter) to make images${chatOnly.length ? ` — ${chatOnly.join(', ')} only writes text` : ''}, or upload your own PNG.`, 409, 'NO_KEY')
  const p = (o.provider && o.provider !== 'auto' ? o.provider : auto) as ImageProvider
  if (!available.some(a => a.id === p)) throw new ImageError(`No ${IMAGE_INFO[p]?.name ?? o.provider} key connected. Connected: ${available.map(a => a.name).join(', ')}.`, 409)
  await spendGuard(env.DB, user)
  const conn: any = await env.DB.prepare('SELECT encrypted_key,endpoint_config FROM lw_provider_connections WHERE user_id=? AND provider=?').bind(user, p).first()
  const key = await decryptKey(env.LLM_KEY_ENCRYPTION_SECRET, conn.encrypted_key, keyContext(user, p, conn.endpoint_config))
  let r: Response
  try { r = await call(p, key, o.prompt, { shape: o.shape ?? 'square', transparent: Boolean(o.transparent), hi: Boolean(o.hi) }, fetcher) } catch { throw new ImageError(`${IMAGE_INFO[p].name} did not answer. Try again.`, 502) }
  if (r.status === 401 || r.status === 403) throw new ImageError(`${IMAGE_INFO[p].name} rejected your key for images (OpenAI image models can need organization verification).`, 400, 'KEY_FAILED')
  if (r.status === 402 || r.status === 429) throw new ImageError(`${IMAGE_INFO[p].name} rate limit or balance reached.`, 429, 'KEY_FAILED')
  const data: any = await r.json().catch(() => null)
  if (r.status === 400 || r.status === 422) throw new ImageError(`${IMAGE_INFO[p].name} would not make that image (it may look like a brand, a real person or unsafe content). Try describing it differently.${data?.error?.message ? ` (${String(data.error.message).slice(0, 160)})` : ''}`, 400)
  const img = findImage(data)
  if (!r.ok || !img) throw new ImageError(`${IMAGE_INFO[p].name} returned no image. Try again or switch provider.`, 502)
  const bytes = b64bytes(img.b64)
  if (o.needPng && !isPng(bytes)) throw new ImageError(`${IMAGE_INFO[p].name} returned a JPEG, but this needs a PNG. Switch to OpenAI, Gemini or OpenRouter for this one.`, 409)
  const cost = Math.round(Number(data?.usage?.cost) * 1e6) || IMAGE_INFO[p].costMicros
  const month = new Date().toISOString().slice(0, 7)
  await env.DB.prepare(`INSERT INTO lw_ai_usage(user_id,month,calls,input_tokens,output_tokens,cost_micros,estimated) VALUES (?,?,1,0,0,?,1)
    ON CONFLICT(user_id,month) DO UPDATE SET calls=calls+1,cost_micros=cost_micros+excluded.cost_micros,estimated=1`).bind(user, month, cost).run()
  return { bytes, png: isPng(bytes), provider: p, model: IMAGE_INFO[p].model, costMicros: cost }
}
