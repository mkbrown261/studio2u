// Merch with no inventory, through the artist's own FREE Fourthwall shop.
// Flow: connect shop (owner) -> designs (upload your art, or AI from your own OpenAI key,
// or an agent's idea) -> owner approves + confirms rights -> Fourthwall renders mockups on a
// HIDDEN product -> owner presses Publish -> fans buy, Fourthwall prints + ships + handles
// sales tax and support; the owner keeps the margin (Fourthwall pays out inside Fourthwall).
// Verified 2026-10-29: docs.fourthwall.com (Basic auth API user, media upload, design products,
// product state), fourthwall.com/print-on-demand (no upfront cost, flat catalog fee, 2.9% + $0.30
// card fee, merchant of record), developers.openai.com (gpt-image-2.5-flare, transparent PNG).
// Never stored or seen: the owner's Fourthwall login, card, bank or payout details.
import { ServiceError, memberRole, requireEditor } from './service'
import { encryptKey, decryptKey, keyContext } from '../providers/vault'
import { spendGuard } from '../providers/budget'

export const MERCH_FACTS_VERSION = '2026-10-29'
export type Fetch = (url: string, init?: RequestInit) => Promise<Response>
const FW = 'https://api.fourthwall.com/open-api/v1.0'
/** Products we offer by default (public Fourthwall catalog, checked 2026-10-29). Base cost is re-read live before creating. */
export const KINDS = {
  tee: { label: 'T-shirt', templateId: 'pro_O7Dd4-6JTUuq48NSUd3TMg', name: 'Gildan Unisex Softstyle T-Shirt', region: 'front_large', base: 9.5, margin: 15, colors: ['Black', 'White'] },
  hoodie: { label: 'Hoodie', templateId: 'pro_gUu4CvXsRm-BxogjB89KzA', name: 'Gildan Classic Hoodie', region: 'front', base: 22.2, margin: 20, colors: ['Black'] },
  hat: { label: 'Trucker hat', templateId: 'pro_fy5YZDa9Sw-sCWYqBQ5Mvg', name: 'Otto Foam Trucker Hat', region: 'front_dtf_hat', base: 11.45, margin: 14, colors: ['Black'] },
  poster: { label: 'Poster', templateId: 'pro_15bc29bc8a324d449d', name: 'Enhanced Matte Paper Poster', region: 'default', base: 5.5, margin: 12, colors: ['White'] },
  sticker: { label: 'Sticker', templateId: 'pro_358', name: 'Kiss Cut Stickers', region: 'default', base: 2.29, margin: 3, colors: ['White'] },
  mug: { label: 'Mug', templateId: 'pro_4v5OfYhyRx62KW5b7Oj6Uw', name: 'White Glossy Mug', region: 'default', base: 5.95, margin: 10, colors: ['White'] }
} as const
export type Kind = keyof typeof KINDS
const BRANDS = /\b(nike|adidas|jordan|supreme|gucci|louis\s*vuitton|lv|chanel|prada|balenciaga|off-?white|bape|disney|marvel|dc comics|pokemon|nintendo|sanrio|hello kitty|mickey|spongebob|nba|nfl|mlb|coca-?cola|pepsi|mcdonald|apple logo|playboy|rolex|ferrari|lamborghini)\b/i
const str = (v: unknown, f: string, max: number) => { if (v == null || v === '') return null; if (typeof v !== 'string' || v.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)) throw new ServiceError(`Invalid ${f}`); return v.trim() || null }
const ctxKey = (label: string) => `studio2u:merch:v1:${label}`
async function requireOwner(db: any, label: string, actor: number) { const r = await memberRole(db, label, actor); if (!r) throw new ServiceError('Label not found', 404); if (r !== 'owner') throw new ServiceError('Only the label owner can do this', 403) }

/** PNG facts from the header: size and whether it can have a transparent background. */
export function pngInfo(b: Uint8Array) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10]
  if (b.length < 33 || sig.some((x, i) => b[i] !== x)) throw new ServiceError('Upload a PNG file (transparent background works best).')
  const u32 = (o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0
  const width = u32(16), height = u32(20), colorType = b[25]
  let transparent = colorType === 4 || colorType === 6
  for (let o = 8; !transparent && o + 8 < Math.min(b.length, 1 << 20);) { const len = u32(o), type = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]); if (type === 'tRNS') transparent = true; if (type === 'IDAT' || type === 'IEND') break; o += 12 + len }
  if (!width || !height || width > 12000 || height > 12000) throw new ServiceError('Image size looks wrong.')
  return { width, height, transparent }
}
async function sha256(b: Uint8Array) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join('') }

// ---------------- Fourthwall client ----------------
async function creds(env: any, label: string) {
  const row: any = await env.DB.prepare('SELECT encrypted_creds,shop_json FROM lw_merch_shops WHERE label_id=?').bind(label).first()
  if (!row) throw new ServiceError('Connect your free Fourthwall shop first (Merch tab).', 409)
  const c = JSON.parse(await decryptKey(env.LLM_KEY_ENCRYPTION_SECRET, row.encrypted_creds, ctxKey(label)))
  return { auth: 'Basic ' + btoa(`${c.u}:${c.p}`), shop: JSON.parse(row.shop_json || '{}') }
}
export async function fw(fetcher: Fetch, auth: string | null, path: string, method = 'GET', body?: unknown) {
  let r: Response
  try { r = await fetcher(FW + path, { method, headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Authorization: auth } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(90000) }) } catch { throw new ServiceError('Fourthwall did not answer. Try again in a minute.', 502) }
  if (r.status === 401 || r.status === 403) throw new ServiceError('Fourthwall rejected the API key. In Fourthwall: Settings > For developers, create a new API user and paste it again.', 400)
  if (r.status === 429) throw new ServiceError('Fourthwall allows about 5 new products a minute. Try again in a minute.', 429)
  const data: any = await r.json().catch(() => null)
  if (!r.ok) { const code = typeof data?.code === 'string' ? data.code : typeof data?.error === 'string' ? data.error : `HTTP_${r.status}`; throw new ServiceError(`Fourthwall said: ${code.replace(/[^\w .:-]/g, '').slice(0, 120)}`, 502) }
  return data
}

// ---------------- shop ----------------
export async function connectShop(env: any, label: string, actor: number, b: any, fetcher: Fetch = fetch) {
  await requireOwner(env.DB, label, actor)
  const u = str(b?.username, 'username', 200), p = str(b?.password, 'password', 300)
  if (!u || !p) throw new ServiceError('Paste the API username and password from Fourthwall > Settings > For developers.')
  const auth = 'Basic ' + btoa(`${u}:${p}`)
  const shop = await fw(fetcher, auth, '/shops/current')
  const info = { id: String(shop.id ?? ''), name: String(shop.name ?? '').slice(0, 120), domain: shop.domain ?? null, publicDomain: shop.publicDomain ?? null, status: shop.status ?? null }
  const enc = await encryptKey(env.LLM_KEY_ENCRYPTION_SECRET, JSON.stringify({ u, p }), ctxKey(label))
  await env.DB.batch([
    env.DB.prepare('INSERT INTO lw_merch_shops(label_id,encrypted_creds,shop_json,connected_by) VALUES (?,?,?,?) ON CONFLICT(label_id) DO UPDATE SET encrypted_creds=excluded.encrypted_creds,shop_json=excluded.shop_json,connected_by=excluded.connected_by,connected_at=CURRENT_TIMESTAMP').bind(label, enc, JSON.stringify(info), actor),
    env.DB.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, actor, 'merch.shop.connected', JSON.stringify({ shop: info.name, status: info.status }))
  ])
  return { shop: info, say: info.status === 'LIVE' ? `Connected to ${info.name}.` : `Connected to ${info.name}. Your shop is ${String(info.status).toLowerCase().replace(/_/g, ' ')}: launch it in Fourthwall when you're ready for fans to buy.` }
}
export async function disconnectShop(env: any, label: string, actor: number) {
  await requireOwner(env.DB, label, actor)
  await env.DB.prepare('DELETE FROM lw_merch_shops WHERE label_id=?').bind(label).run()
  return { disconnected: true }
}

// ---------------- designs ----------------
async function quotaOk(db: any, label: string, n: number) {
  const q: any = await db.prepare(`SELECT storage_quota_bytes,(SELECT COALESCE(SUM(byte_size),0) FROM lw_assets WHERE label_id=?)+(SELECT COALESCE(SUM(byte_size),0) FROM lw_research_reports WHERE label_id=?)+(SELECT COALESCE(SUM(byte_size),0) FROM lw_merch_designs WHERE label_id=?) AS used FROM lw_labels WHERE id=?`).bind(label, label, label, label).first()
  if (q && q.used + n > q.storage_quota_bytes) throw new ServiceError('Storage quota exceeded', 413)
}
async function storeDesign(env: any, label: string, bytes: Uint8Array, d: { title: string; prompt: string | null; source: 'UPLOAD' | 'AI'; by: string; caseId?: string | null; id?: string }) {
  const info = pngInfo(bytes); await quotaOk(env.DB, label, bytes.length)
  const id = d.id ?? crypto.randomUUID(), key = `label-world/private/${label}/merch/${id}.png`
  await env.R2.put(key, bytes, { httpMetadata: { contentType: 'image/png' } })
  const exists = d.id ? await env.DB.prepare('SELECT 1 FROM lw_merch_designs WHERE id=? AND label_id=?').bind(id, label).first() : null
  if (exists) await env.DB.prepare(`UPDATE lw_merch_designs SET source=?,status='DRAFT',object_key=?,width=?,height=?,byte_size=?,sha256=?,transparent=?,fw_image_json='{}',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(d.source, key, info.width, info.height, bytes.length, await sha256(bytes), info.transparent ? 1 : 0, id).run()
  else await env.DB.prepare('INSERT INTO lw_merch_designs(id,label_id,case_id,title,prompt,source,status,object_key,width,height,byte_size,sha256,transparent,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, label, d.caseId ?? null, d.title, d.prompt, d.source, 'DRAFT', key, info.width, info.height, bytes.length, await sha256(bytes), info.transparent ? 1 : 0, d.by).run()
  return { id, ...info, warnings: [...(!info.transparent ? ['No transparent background: the image prints as a rectangle. A transparent PNG looks cleaner.'] : []), ...(Math.max(info.width, info.height) < 1500 ? ['Small image: it may print blurry on shirts. 2250x2700 or bigger is ideal.'] : [])] }
}
export async function uploadDesign(env: any, label: string, actor: number, bytes: Uint8Array, title: string | null) {
  await requireEditor(env.DB, label, actor)
  if (!bytes.length) throw new ServiceError('Empty file')
  if (bytes.length > 20 * 1024 * 1024) throw new ServiceError('PNG must be under 20 MB', 413)
  const t = str(title, 'title', 120) ?? 'My design'
  return storeDesign(env, label, bytes, { title: t, prompt: null, source: 'UPLOAD', by: 'owner' })
}
/** A PNG the owner's agent made with its own image tool (via a one-time upload link). Fills the idea if given. */
export async function saveAgentDesign(env: any, label: string, actor: number, bytes: Uint8Array, title: string | null, ideaId?: string | null) {
  await requireEditor(env.DB, label, actor)
  if (bytes.length > 20 * 1024 * 1024) throw new ServiceError('PNG must be under 20 MB', 413)
  const idea: any = ideaId ? await env.DB.prepare("SELECT id,title,prompt FROM lw_merch_designs WHERE id=? AND label_id=?").bind(ideaId, label).first() : null
  return storeDesign(env, label, bytes, { title: str(title, 'title', 120) ?? idea?.title ?? 'Design', prompt: idea?.prompt ?? null, source: 'AI', by: 'agent', id: idea?.id })
}
/** An agent (Claude/Codex) or the owner saves an idea; nothing is generated or spent until the owner taps Make it. */
export async function addIdea(db: any, label: string, actor: number, b: any, by: string) {
  await requireEditor(db, label, actor)
  const title = str(b?.title, 'title', 120), prompt = str(b?.prompt, 'prompt', 2000)
  if (!title || !prompt) throw new ServiceError('title and prompt (what the design looks like) are required')
  if (BRANDS.test(`${title} ${prompt}`)) throw new ServiceError('No other brands, logos or characters. Merch must be your own art.')
  const id = crypto.randomUUID()
  await db.prepare("INSERT INTO lw_merch_designs(id,label_id,case_id,title,prompt,source,status,created_by) VALUES (?,?,?,?,?,'IDEA','IDEA',?)").bind(id, label, b?.caseId ? String(b.caseId).slice(0, 100) : null, title, prompt, by.slice(0, 80)).run()
  return { id, title, status: 'IDEA', say: 'Saved as an idea. The owner taps "Make it" to create the image (about 10 cents from their own OpenAI key).' }
}
export function designPrompt(p: string, brief: { artist: string; genres?: string[]; brandWords?: string[] }) {
  return [
    `Original merch artwork for the music artist "${brief.artist}"${brief.genres?.length ? ` (${brief.genres.slice(0, 3).join(', ')})` : ''}${brief.brandWords?.length ? `, brand feel: ${brief.brandWords.slice(0, 3).join(', ')}` : ''}.`,
    p,
    'Print-ready graphic for a T-shirt front: centered composition, bold clean shapes, high contrast, transparent background, no mockup, no shirt, no frame, no background scene.',
    'Use only original artwork. No existing logos, brands, trademarks, celebrities, real people\'s faces, cartoon characters or copyrighted lyrics. Any text must be spelled exactly as written above.'
  ].join('\n')
}
/** Make one design with the owner's OWN OpenAI key (they pay OpenAI directly, a few cents). */
export async function generateDesign(env: any, label: string, actor: number, b: any, fetcher: Fetch = fetch) {
  await requireEditor(env.DB, label, actor)
  let title = str(b?.title, 'title', 120), prompt = str(b?.prompt, 'prompt', 2000), ideaId: string | null = null
  if (b?.ideaId) {
    const idea: any = await env.DB.prepare("SELECT id,title,prompt FROM lw_merch_designs WHERE id=? AND label_id=? AND status IN ('IDEA','REJECTED','DRAFT')").bind(String(b.ideaId), label).first()
    if (!idea) throw new ServiceError('Idea not found', 404)
    ideaId = idea.id; title = title ?? idea.title; prompt = prompt ?? idea.prompt
  }
  if (!prompt) throw new ServiceError('Describe the design (what goes on it, colors, vibe).')
  if (BRANDS.test(`${title ?? ''} ${prompt}`)) throw new ServiceError('No other brands, logos or characters. Merch must be your own art.')
  const id: any = await env.DB.prepare('SELECT artist_name FROM lw_label_identity WHERE label_id=?').bind(label).first()
  const facts = (await env.DB.prepare("SELECT key,value_json FROM lw_artist_facts WHERE label_id=? AND key IN ('genres','brandWords')").bind(label).all().catch(() => ({ results: [] }))).results as any[]
  const f: Record<string, any> = {}; for (const r of facts) f[r.key] = JSON.parse(r.value_json)
  const full = designPrompt(prompt, { artist: id?.artist_name ?? 'the artist', genres: f.genres, brandWords: f.brandWords })
  const { makeImage } = await import('../providers/images')
  let made: any
  try { made = await makeImage(env, actor, { prompt: full, provider: b?.provider ?? null, label, shape: 'portrait', transparent: true, needPng: true }, fetcher) }
  catch (e: any) {
    if (e?.code === 'NO_KEY' || e?.code === 'KEY_FAILED') {
      const keep = ideaId ?? (await addIdea(env.DB, label, actor, { title: title ?? prompt.slice(0, 60), prompt }, 'owner')).id
      const { imageTask } = await import('./creative')
      return { ...(await imageTask(env.DB, label, { kind: 'merch', prompt: full, title: title ?? prompt.slice(0, 60), ideaId: keep, why: e.code === 'KEY_FAILED' ? e.message : null })), id: keep }
    }
    throw new ServiceError(e?.message ?? 'Image failed', e?.status ?? 502)
  }
  const bytes = made.bytes
  const saved = await storeDesign(env, label, bytes, { title: title ?? prompt.slice(0, 60), prompt, source: 'AI', by: 'owner', id: ideaId ?? undefined })
  return { ...saved, title: title ?? prompt.slice(0, 60), provider: made.provider, estimatedCostUsd: made.costMicros / 1e6, say: 'Design ready. Approve it if you like it.' }
}
export async function decideDesign(db: any, label: string, actor: number, id: string, b: any) {
  await requireEditor(db, label, actor)
  const d: any = await db.prepare('SELECT id,status,object_key FROM lw_merch_designs WHERE id=? AND label_id=?').bind(id, label).first()
  if (!d) throw new ServiceError('Design not found', 404)
  const decision = String(b?.decision ?? '')
  if (decision === 'APPROVED') {
    if (!d.object_key) throw new ServiceError('Make or upload the image first.')
    if (b?.ownsRights !== true) throw new ServiceError('Confirm you own this art or have the rights to sell it.')
    await db.prepare("UPDATE lw_merch_designs SET status='APPROVED',rights_attested_by=?,rights_attested_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(actor, id).run()
  } else if (decision === 'REJECTED') await db.prepare("UPDATE lw_merch_designs SET status='REJECTED',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run()
  else throw new ServiceError('decision must be APPROVED or REJECTED')
  await db.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, actor, 'merch.design.' + decision.toLowerCase(), JSON.stringify({ id })).run()
  return { id, status: decision }
}
export async function designImage(env: any, label: string, actor: number, id: string) {
  if (!await memberRole(env.DB, label, actor)) throw new ServiceError('Label not found', 404)
  const d: any = await env.DB.prepare('SELECT object_key FROM lw_merch_designs WHERE id=? AND label_id=?').bind(id, label).first()
  if (!d?.object_key) throw new ServiceError('Not found', 404)
  const o = await env.R2.get(d.object_key); if (!o) throw new ServiceError('Not found', 404)
  return new Uint8Array(await o.arrayBuffer())
}

// ---------------- products ----------------
/** Live base price and colors from Fourthwall's public catalog. */
export async function templateInfo(kind: string, fetcher: Fetch = fetch) {
  const k = KINDS[kind as Kind]; if (!k) throw new ServiceError(`kind must be one of ${Object.keys(KINDS).join(', ')}`)
  const t = await fw(fetcher, null, `/product-templates/${k.templateId}`).catch(() => null)
  const colors = (t?.colorVariants ?? []).filter((c: any) => c.available).map((c: any) => ({ name: c.color?.name, hex: c.color?.hex })).filter((c: any) => c.name)
  const area = (t?.customizableAreas ?? []).find((a: any) => a.regionId === k.region)
  return { kind, label: k.label, product: t?.name ?? k.name, base: Number(t?.priceFrom?.amount ?? k.base), baseTo: Number(t?.priceTo?.amount ?? k.base), colors: colors.length ? colors.slice(0, 40) : k.colors.map(n => ({ name: n, hex: null })), defaultColors: k.colors, defaultMargin: k.margin, printArea: area?.dimensions ? `${area.dimensions.pixelsWidth}x${area.dimensions.pixelsHeight}px` : null, live: Boolean(t) }
}
/** What the owner keeps per sale: margin minus the card fee (2.9% + $0.30 on the sale price, US cards). Shipping is paid by the buyer. */
export function profitPerSale(base: number, margin: number) {
  const price = Math.round((base + margin) * 100) / 100, fee = Math.round((price * 0.029 + 0.3) * 100) / 100
  return { price, fee, keep: Math.round((margin - fee) * 100) / 100 }
}
async function fwImageId(env: any, label: string, design: any, auth: string, shopId: string, fetcher: Fetch) {
  const cache = JSON.parse(design.fw_image_json || '{}'); if (cache[shopId]) return cache[shopId] as string
  const o = await env.R2.get(design.object_key); if (!o) throw new ServiceError('Design file missing; upload it again.', 409)
  const bytes = new Uint8Array(await o.arrayBuffer())
  const up = await fw(fetcher, auth, '/media/upload-url', 'POST', { fileName: `${design.id}.png`, contentType: 'image/png', size: bytes.length })
  let put: Response
  try { put = await fetcher(up.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: bytes }) } catch { throw new ServiceError('Upload to Fourthwall failed. Try again.', 502) }
  if (!put.ok) throw new ServiceError('Upload to Fourthwall failed. Try again.', 502)
  const img = await fw(fetcher, auth, '/media/images', 'POST', { fileUrl: up.fileUrl, width: design.width, height: design.height })
  cache[shopId] = img.id
  await env.DB.prepare('UPDATE lw_merch_designs SET fw_image_json=? WHERE id=?').bind(JSON.stringify(cache), design.id).run()
  return img.id as string
}
/** Fourthwall renders mockups and creates the product HIDDEN. Nothing is for sale until the owner presses Publish. */
export async function makeProduct(env: any, label: string, actor: number, b: any, fetcher: Fetch = fetch) {
  await requireEditor(env.DB, label, actor)
  const k = KINDS[b?.kind as Kind]; if (!k) throw new ServiceError(`kind must be one of ${Object.keys(KINDS).join(', ')}`)
  const design: any = await env.DB.prepare('SELECT * FROM lw_merch_designs WHERE id=? AND label_id=?').bind(String(b?.designId ?? ''), label).first()
  if (!design) throw new ServiceError('Design not found', 404)
  if (design.status !== 'APPROVED') throw new ServiceError('Approve the design first (and confirm you own the art).', 409)
  const margin = Number(b?.profitMargin ?? k.margin)
  if (!Number.isFinite(margin) || margin < 1 || margin > 200) throw new ServiceError('Your profit per item must be between $1 and $200.')
  const colors = Array.isArray(b?.colors) && b.colors.length ? b.colors.slice(0, 12).map((c: any) => str(c, 'color', 60)).filter(Boolean) : [...k.colors]
  const id: any = await env.DB.prepare('SELECT artist_name FROM lw_label_identity WHERE label_id=?').bind(label).first()
  const name = str(b?.name, 'name', 120) ?? `${design.title} ${k.label}`.slice(0, 120)
  const { auth, shop } = await creds(env, label)
  const imageId = await fwImageId(env, label, design, auth, shop.id || 'shop', fetcher)
  const res = await fw(fetcher, auth, '/products', 'POST', {
    type: 'design', productTemplateId: k.templateId, name, colors,
    description: str(b?.description, 'description', 1000) ?? `Official ${id?.artist_name ?? ''} merch.`.replace('  ', ' '),
    regions: [{ region: k.region, imageId, placementStrategy: 'AUTO' }], profitMargin: margin, publishOnCreate: false
  })
  if (!res?.productId) throw new ServiceError('Fourthwall did not create the product. Try again.', 502)
  const mockups = (res.images ?? []).slice(0, 12).map((i: any) => ({ url: String(i.url), color: i.color ?? null, style: i.style ?? null }))
  const pid = crypto.randomUUID(), base = Number(b?.base ?? k.base)
  await env.DB.batch([
    env.DB.prepare('INSERT INTO lw_merch_products(id,label_id,design_id,kind,template_id,name,fw_product_id,colors_json,base_price,profit_margin,mockups_json,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(pid, label, design.id, b.kind, k.templateId, name, String(res.productId), JSON.stringify(colors), base, margin, JSON.stringify(mockups), actor),
    env.DB.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, actor, 'merch.product.created', JSON.stringify({ pid, fwProductId: res.productId, kind: b.kind, margin }))
  ])
  return { id: pid, name, state: 'HIDDEN', mockups: mockups.length, ...profitPerSale(base, margin), say: `Mockups are ready and "${name}" is in your shop, hidden. Press Publish when you like it.` }
}
export async function setProductState(env: any, label: string, actor: number, id: string, b: any, fetcher: Fetch = fetch) {
  const state = b?.state === 'PUBLIC' ? 'PUBLIC' : b?.state === 'HIDDEN' ? 'HIDDEN' : null
  if (!state) throw new ServiceError('state must be PUBLIC or HIDDEN')
  if (state === 'PUBLIC') await requireOwner(env.DB, label, actor); else await requireEditor(env.DB, label, actor)
  const p: any = await env.DB.prepare('SELECT * FROM lw_merch_products WHERE id=? AND label_id=?').bind(id, label).first()
  if (!p) throw new ServiceError('Product not found', 404)
  const { auth } = await creds(env, label)
  await fw(fetcher, auth, `/products/${encodeURIComponent(p.fw_product_id)}/state`, 'PUT', { state })
  await env.DB.batch([
    env.DB.prepare(`UPDATE lw_merch_products SET state=?,published_at=CASE WHEN ?='PUBLIC' THEN COALESCE(published_at,CURRENT_TIMESTAMP) ELSE published_at END WHERE id=?`).bind(state, state, id),
    env.DB.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, actor, 'merch.product.' + state.toLowerCase(), JSON.stringify({ id }))
  ])
  return { id, state }
}
const MOCKUP_HOST = /(^|\.)fourthwall\.(com|dev)$/
export async function mockupImage(env: any, label: string, actor: number, id: string, i: number, fetcher: Fetch = fetch) {
  if (!await memberRole(env.DB, label, actor)) throw new ServiceError('Label not found', 404)
  const p: any = await env.DB.prepare('SELECT mockups_json FROM lw_merch_products WHERE id=? AND label_id=?').bind(id, label).first()
  const m = p ? JSON.parse(p.mockups_json || '[]')[i] : null
  if (!m) throw new ServiceError('Not found', 404)
  let u: URL; try { u = new URL(m.url) } catch { throw new ServiceError('Not found', 404) }
  if (u.protocol !== 'https:' || !MOCKUP_HOST.test(u.hostname)) throw new ServiceError('Not found', 404)
  const r = await fetcher(u.href, { redirect: 'error', signal: AbortSignal.timeout(20000) }).catch(() => null)
  const type = r?.headers.get('content-type') ?? ''
  if (!r?.ok || !/^image\//.test(type)) throw new ServiceError('Mockup unavailable', 502)
  const buf = new Uint8Array(await r.arrayBuffer()); if (buf.length > 10 * 1024 * 1024) throw new ServiceError('Mockup too large', 502)
  return { bytes: buf, type }
}

// ---------------- overview + sales ----------------
export async function merchOverview(env: any, label: string, actor: number) {
  const role = await memberRole(env.DB, label, actor); if (!role) throw new ServiceError('Label not found', 404)
  const shop: any = await env.DB.prepare('SELECT shop_json,connected_at FROM lw_merch_shops WHERE label_id=?').bind(label).first()
  const designs = (await env.DB.prepare('SELECT id,case_id,title,prompt,source,status,width,height,transparent,created_by,created_at,(object_key IS NOT NULL) AS has_image FROM lw_merch_designs WHERE label_id=? ORDER BY created_at DESC LIMIT 60').bind(label).all()).results
  const products = (await env.DB.prepare('SELECT id,design_id,kind,name,colors_json,base_price,profit_margin,mockups_json,state,created_at,published_at FROM lw_merch_products WHERE label_id=? ORDER BY created_at DESC LIMIT 60').bind(label).all()).results.map((p: any) => ({ ...p, colors: JSON.parse(p.colors_json), mockups: JSON.parse(p.mockups_json).length, colors_json: undefined, mockups_json: undefined, ...profitPerSale(p.base_price ?? 0, p.profit_margin) }))
  return {
    factsVersion: MERCH_FACTS_VERSION, role, shop: shop ? { ...JSON.parse(shop.shop_json), connectedAt: shop.connected_at } : null, designs, products,
    kinds: Object.entries(KINDS).map(([k, v]) => ({ kind: k, label: v.label, product: v.name, base: v.base, defaultMargin: v.margin })),
    howItWorks: ['Free Fourthwall shop: no upfront cost, no monthly fee, no inventory.', 'Fourthwall prints and ships each order, handles sales tax and customer support.', 'Fourthwall deducts its listed base cost per item and a 2.9% + $0.30 card fee (US cards); you keep the rest.', 'You sign up, add payout info and press Publish yourself.']
  }
}
export async function merchSales(env: any, label: string, actor: number, fetcher: Fetch = fetch) {
  if (!await memberRole(env.DB, label, actor)) throw new ServiceError('Label not found', 404)
  const { auth } = await creds(env, label)
  const d = await fw(fetcher, auth, '/order?size=100&page=0')
  const money = (m: any) => Number(m?.value ?? m?.amount ?? 0)
  let orders = 0, items = 0, sales = 0, profit = 0
  const recent: any[] = []
  for (const o of d?.results ?? []) {
    if (o.status === 'CANCELLED') continue
    orders++
    for (const of of o.offers ?? []) {
      const v = of.variant ?? {}, q = Number(v.quantity ?? 1), unit = money(v.unitPrice ?? v.price), cost = money(v.unitCost ?? v.cost)
      items += q; sales += unit * q; profit += (unit - cost) * q
    }
    if (recent.length < 10) recent.push({ id: o.friendlyId ?? o.id, status: o.status, total: money(o.amounts?.total), createdAt: o.createdAt })
  }
  const r2 = (n: number) => Math.round(n * 100) / 100
  return { orders, items, salesUsd: r2(sales), profitBeforeCardFeesUsd: r2(profit), recent, note: 'From your Fourthwall orders (last 100). Profit = sale price minus Fourthwall base cost; card fees come out after. Payouts happen inside Fourthwall.' }
}
