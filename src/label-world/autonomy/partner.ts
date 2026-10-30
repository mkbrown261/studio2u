// Business Partner: the 5th AI employee. Owns everything that makes money: merch, the weekly
// campaign, Amazon, tickets. How he works (agreed with the owner):
//   * Approve once: each week he drafts a plan of posts; the owner approves it in one tap.
//   * Autopilot: while it is ON, the owner's own agent (Codex/Claude with screen control) posts
//     each approved post from the owner's own logged-in browser and records the public link.
//   * The owner creates each account (phone verification). He sets it up and runs it.
//   * Stop button: anyone on the label can pause everything instantly. Only the owner resumes.
//   * Never: passwords, card or bank details, DMs, follows, likes, ads, or spending above the cap.
//   * Every day at the owner's hour: a short money check-in in his chat (no AI tokens).
import { ServiceError, memberRole, requireEditor } from './service'
import { notify } from './engine'
import { getSettings, localParts } from './office'

export const PARTNER_FACTS_VERSION = '2026-10-30'
export const PLATFORMS = ['instagram', 'tiktok', 'x', 'facebook', 'threads', 'youtube'] as const
export type Platform = typeof PLATFORMS[number]
const METHODS = ['OWNER_BROWSER', 'OWNER_POSTS', 'OFFICIAL_API'] as const
const KINDS = ['merch', 'song', 'behind_scenes', 'question', 'announcement', 'other'] as const
/** Which public hosts count as proof a post went live on each platform. */
const HOSTS: Record<Platform, RegExp> = {
  instagram: /(^|\.)instagram\.com$/, tiktok: /(^|\.)tiktok\.com$/, x: /(^|\.)(x|twitter)\.com$/,
  facebook: /(^|\.)(facebook|fb)\.com$/, threads: /(^|\.)threads\.(net|com)$/, youtube: /(^|\.)(youtube\.com|youtu\.be)$/
}
/** Video-first platforms can't take a text-only post. */
const NEEDS_MEDIA: Platform[] = ['instagram', 'tiktok', 'youtube']
/** Account setup: the owner signs up (phone check is theirs); the partner fills the profile. */
export const SETUP: Record<Platform, { name: string; signup: string; ownerDoes: string; partnerDoes: string[] }> = {
  instagram: { name: 'Instagram', signup: 'https://www.instagram.com/accounts/emailsignup/', ownerDoes: 'Sign up with your phone or email, then switch to a free Professional (Creator) account in Settings.', partnerDoes: ['Profile photo, name and bio', 'Link to your shop / music', 'Category: Musician/Band'] },
  tiktok: { name: 'TikTok', signup: 'https://www.tiktok.com/signup', ownerDoes: 'Sign up with your phone. Keep it a personal account so you can use trending sounds.', partnerDoes: ['Profile photo, name and bio', 'Link in bio when TikTok allows it', 'Pin your best post'] },
  x: { name: 'X', signup: 'https://x.com/i/flow/signup', ownerDoes: 'Sign up with your phone or email.', partnerDoes: ['Profile photo, header, bio', 'Website link', 'Pinned post with your newest song'] },
  facebook: { name: 'Facebook Page', signup: 'https://www.facebook.com/pages/create', ownerDoes: 'From your personal Facebook, create a Page (Musician/Band). You stay the admin.', partnerDoes: ['Page photo, cover and About', 'Shop and music links', 'Call-to-action button'] },
  threads: { name: 'Threads', signup: 'https://www.threads.net/login', ownerDoes: 'Log in with your Instagram account (Threads uses it).', partnerDoes: ['Bio and link', 'Follow nothing; post only approved posts'] },
  youtube: { name: 'YouTube', signup: 'https://www.youtube.com/create_channel', ownerDoes: 'With your Google account, create a channel in your artist name. Verify your phone in YouTube settings if asked.', partnerDoes: ['Channel picture, banner, description', 'Links to shop and socials', 'Shorts from approved posts'] }
}
/** Other money streams. Facts checked on the official pages on PARTNER_FACTS_VERSION; re-check before signing up. */
export const STREAMS = {
  amazon: {
    options: {
      MERCH_ON_DEMAND: { name: 'Amazon Merch on Demand', url: 'https://merch.amazon.com', facts: ['Free to join, but you apply first; Amazon says applications are typically processed within 14 days, and a rejection cannot be re-applied.', 'Amazon is the seller: it prints (DTG), ships and handles returns; you upload PNG designs (at least 485x485, under 25 MB) and earn a royalty per sale.', 'New accounts start at Tier 10 (10 published designs); tiers grow with sales.', 'Paid monthly by direct deposit about 30 days after the month an item ships.', 'One account per person, never shared: you log in yourself; your agent only works in your logged-in browser.', 'You do the tax interview and bank details yourself.'] },
      SELLER_CENTRAL: { name: 'Amazon Seller Central', url: 'https://sell.amazon.com/pricing', facts: ['Individual plan: $0.99 per item sold, plus referral fees.', 'Professional plan: $39.99 per month, plus referral fees.', 'Clothing referral fee: 5% up to $15, 10% from $15 to $20, 17% above $20 (minimum $0.30).', 'You hold or ship the stock (or pay for FBA); you enter tax ID, ID and bank details yourself.'] },
      NONE: { name: 'Not now', url: '', facts: ['Fourthwall already sells your merch with no inventory.'] }
    }
  },
  tickets: {
    options: {
      EVENTBRITE: { name: 'Eventbrite', url: 'https://www.eventbrite.com/organizer/pricing/', facts: ['Free events are free to list.', 'Paid tickets (US): 3.7% + $1.79 service fee per ticket plus 2.9% payment processing per order; buyers pay the fees by default, or you can absorb them.', 'You add your own payout bank details inside Eventbrite.'] },
      NONE: { name: 'Not now', url: '', facts: [] }
    }
  }
} as const

const str = (v: unknown, f: string, max: number) => { if (v == null || v === '') return null; if (typeof v !== 'string' || v.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)) throw new ServiceError(`Invalid ${f}`); return v.trim() || null }
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'))
export const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
/** Monday of the week containing the local date. */
export const mondayOf = (d: string) => { const wd = new Date(d + 'T00:00:00Z').getUTCDay(); return addDays(d, -((wd + 6) % 7)) }
async function requireMember(db: any, label: string, actor: number) { const r = await memberRole(db, label, actor); if (!r) throw new ServiceError('Label not found', 404); return r }
async function requireOwner(db: any, label: string, actor: number) { const r = await requireMember(db, label, actor); if (r !== 'owner') throw new ServiceError('Only the label owner can do this', 403) }
const audit = (db: any, label: string, actor: number | null, action: string, payload: unknown) =>
  db.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, actor, action, JSON.stringify(payload))
const today = async (db: any, label: string, at = new Date()) => localParts((await getSettings(db, label)).timezone, at)

// ---------------- settings, autopilot, stop ----------------
export async function getPartnerSettings(db: any, label: string) {
  const s: any = await db.prepare('SELECT * FROM lw_partner_settings WHERE label_id=?').bind(label).first()
  let streams: any = {}; try { streams = JSON.parse(s?.streams_json || '{}') } catch { streams = {} }
  return { autopilot: (s?.autopilot ?? 'OFF') as 'OFF' | 'ON' | 'PAUSED', spendCapCents: s?.spend_cap_cents ?? 0, postsPerDay: s?.posts_per_day ?? 1, checkinHour: s?.checkin_hour ?? 9, streams, lastCheckinDate: s?.last_checkin_date ?? null, saved: Boolean(s) }
}
async function upsert(db: any, label: string, actor: number, patch: { autopilot?: string; spend_cap_cents?: number; posts_per_day?: number; checkin_hour?: number; streams_json?: string }) {
  const cur = await getPartnerSettings(db, label)
  const v = { autopilot: patch.autopilot ?? cur.autopilot, cap: patch.spend_cap_cents ?? cur.spendCapCents, ppd: patch.posts_per_day ?? cur.postsPerDay, hour: patch.checkin_hour ?? cur.checkinHour, streams: patch.streams_json ?? JSON.stringify(cur.streams) }
  await db.prepare(`INSERT INTO lw_partner_settings(label_id,autopilot,spend_cap_cents,posts_per_day,checkin_hour,streams_json,updated_by) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(label_id) DO UPDATE SET autopilot=excluded.autopilot,spend_cap_cents=excluded.spend_cap_cents,posts_per_day=excluded.posts_per_day,checkin_hour=excluded.checkin_hour,streams_json=excluded.streams_json,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`)
    .bind(label, v.autopilot, v.cap, v.ppd, v.hour, v.streams, actor).run()
}
/** Owner only: autopilot ON/OFF, monthly spend cap, pace, check-in hour. */
export async function savePartnerSettings(db: any, label: string, actor: number, b: any) {
  await requireOwner(db, label, actor)
  const patch: any = {}
  if (b?.autopilot != null) { if (!['ON', 'OFF'].includes(b.autopilot)) throw new ServiceError('autopilot must be ON or OFF (use Stop to pause)'); patch.autopilot = b.autopilot }
  if (b?.spendCapUsd != null) { const c = Math.round(Number(b.spendCapUsd) * 100); if (!Number.isFinite(c) || c < 0 || c > 500000) throw new ServiceError('Monthly spend cap must be $0 to $5,000'); patch.spend_cap_cents = c }
  if (b?.postsPerDay != null) { const n = Number(b.postsPerDay); if (!Number.isInteger(n) || n < 0 || n > 3) throw new ServiceError('Posts per day per account must be 0 to 3'); patch.posts_per_day = n }
  if (b?.checkinHour != null) { const n = Number(b.checkinHour); if (!Number.isInteger(n) || n < 0 || n > 23) throw new ServiceError('Check-in hour must be 0 to 23'); patch.checkin_hour = n }
  if (!Object.keys(patch).length) throw new ServiceError('Nothing to change')
  await upsert(db, label, actor, patch)
  await audit(db, label, actor, 'partner.settings', patch).run()
  return getPartnerSettings(db, label)
}
/** STOP: any editor can pause everything instantly; queued posting/setup work is cancelled. */
export async function stopPartner(db: any, label: string, actor: number) {
  await requireEditor(db, label, actor)
  await upsert(db, label, actor, { autopilot: 'PAUSED' })
  const r = await db.prepare(`UPDATE lw_tasks SET status='CANCELLED',result_json=json_object('outcome','STOPPED_BY_OWNER'),updated_at=CURRENT_TIMESTAMP WHERE label_id=? AND kind IN ('PARTNER_POST','PARTNER_SETUP') AND status='QUEUED'`).bind(label).run()
  await audit(db, label, actor, 'partner.stopped', { cancelledTasks: r.meta.changes }).run()
  return { autopilot: 'PAUSED', cancelledTasks: r.meta.changes, say: 'Stopped. Nothing will be posted until the owner turns autopilot back on.' }
}
/** Owner only: which Amazon / ticket route (facts above), and how far along. */
export async function saveStreams(db: any, label: string, actor: number, b: any) {
  await requireOwner(db, label, actor)
  const cur = (await getPartnerSettings(db, label)).streams
  const next: any = { ...cur }
  const status = ['NOT_STARTED', 'APPLIED', 'APPROVED', 'LIVE']
  if (b?.amazon != null) { if (!(b.amazon in STREAMS.amazon.options)) throw new ServiceError('amazon must be MERCH_ON_DEMAND, SELLER_CENTRAL or NONE'); next.amazon = b.amazon }
  if (b?.amazonStatus != null) { if (!status.includes(b.amazonStatus)) throw new ServiceError('Invalid amazonStatus'); next.amazonStatus = b.amazonStatus }
  if (b?.tickets != null) { if (!(b.tickets in STREAMS.tickets.options)) throw new ServiceError('tickets must be EVENTBRITE or NONE'); next.tickets = b.tickets }
  if (b?.ticketsStatus != null) { if (!status.includes(b.ticketsStatus)) throw new ServiceError('Invalid ticketsStatus'); next.ticketsStatus = b.ticketsStatus }
  await upsert(db, label, actor, { streams_json: JSON.stringify(next) })
  return next
}

// ---------------- accounts ----------------
export async function listChannels(db: any, label: string) {
  const rows = (await db.prepare('SELECT platform,handle,status,method,setup_json,updated_at FROM lw_partner_channels WHERE label_id=?').bind(label).all()).results as any[]
  return PLATFORMS.map(p => { const r = rows.find(x => x.platform === p); return { platform: p, name: SETUP[p].name, handle: r?.handle ?? null, status: r?.status ?? 'NEEDS_ACCOUNT', method: r?.method ?? 'OWNER_BROWSER', setup: r ? JSON.parse(r.setup_json || '{}') : {}, signup: SETUP[p].signup, ownerDoes: SETUP[p].ownerDoes, partnerDoes: SETUP[p].partnerDoes } })
}
/**
 * Owner says "I made the account" (+ handle) -> READY, and the partner is queued to set the
 * profile up in the owner's browser. Editors can save a handle; only the owner turns one READY.
 */
export async function saveChannel(db: any, label: string, actor: number, b: any, enqueueFn?: (t: any) => Promise<boolean>) {
  const role = await requireEditor(db, label, actor)
  const platform = String(b?.platform ?? '') as Platform
  if (!PLATFORMS.includes(platform)) throw new ServiceError(`platform must be one of ${PLATFORMS.join(', ')}`)
  const handle = str(b?.handle, 'handle', 60)?.replace(/^@/, '') ?? null
  if (handle && !/^[A-Za-z0-9._-]{1,60}$/.test(handle)) throw new ServiceError('Handle can only use letters, numbers, dot, dash and underscore')
  const status = String(b?.status ?? (handle ? 'READY' : 'NEEDS_ACCOUNT'))
  if (!['NEEDS_ACCOUNT', 'READY', 'PAUSED'].includes(status)) throw new ServiceError('status must be NEEDS_ACCOUNT, READY or PAUSED')
  if (status === 'READY' && role !== 'owner') throw new ServiceError('Only the label owner can hand an account to the partner', 403)
  if (status === 'READY' && !handle) throw new ServiceError('Add the account handle first')
  const method = String(b?.method ?? 'OWNER_BROWSER')
  if (!(METHODS as readonly string[]).includes(method) || method === 'OFFICIAL_API') throw new ServiceError('method must be OWNER_BROWSER (your agent posts in your browser) or OWNER_POSTS (you post the kit yourself)')
  const prev: any = await db.prepare('SELECT status FROM lw_partner_channels WHERE label_id=? AND platform=?').bind(label, platform).first()
  await db.prepare(`INSERT INTO lw_partner_channels(label_id,platform,handle,status,method) VALUES (?,?,?,?,?)
    ON CONFLICT(label_id,platform) DO UPDATE SET handle=excluded.handle,status=excluded.status,method=excluded.method,updated_at=CURRENT_TIMESTAMP`).bind(label, platform, handle, status, method).run()
  await audit(db, label, actor, 'partner.channel', { platform, handle, status, method }).run()
  let setupQueued = false
  if (status === 'READY' && prev?.status !== 'READY' && method === 'OWNER_BROWSER' && enqueueFn) {
    setupQueued = await enqueueFn({ label, kind: 'PARTNER_SETUP', role: 'business_partner', capability: 'SCREEN_CONTROL', title: `Set up your ${SETUP[platform].name} profile (@${handle})`, input: { platform, handle }, dedupe: `psetup:${label}:${platform}:${handle}` })
  }
  return { platform, handle, status, method, setupQueued }
}

// ---------------- weekly plans (approve once) ----------------
type PostIn = { day: string; platform: Platform; kind: string; caption: string; link?: string | null; media?: Record<string, unknown> }
function checkPost(p: any, weekStart: string, ppd: number): PostIn {
  if (!isDate(p?.day) || p.day < weekStart || p.day > addDays(weekStart, 6)) throw new ServiceError(`Each post day must be inside the week ${weekStart}..${addDays(weekStart, 6)}`)
  if (!PLATFORMS.includes(p?.platform)) throw new ServiceError(`platform must be one of ${PLATFORMS.join(', ')}`)
  const kind = (KINDS as readonly string[]).includes(p?.kind) ? p.kind : 'other'
  const caption = str(p?.caption, 'caption', 2200); if (!caption) throw new ServiceError('Every post needs a caption')
  let link: string | null = null
  if (p?.link) { const u = new URL(String(p.link).slice(0, 2000)); if (u.protocol !== 'https:' || u.username || u.password) throw new ServiceError('Links must be https'); link = u.href }
  const media = p?.media && typeof p.media === 'object' && !Array.isArray(p.media) ? p.media : {}
  if (JSON.stringify(media).length > 2000) throw new ServiceError('media is too large')
  void ppd
  return { day: p.day, platform: p.platform, kind, caption, link, media }
}
/** The deterministic starter plan: merch (with Fourthwall mockups), songs, a fan question. No AI tokens. */
export async function draftWeek(db: any, label: string, weekStart: string) {
  const s = await getPartnerSettings(db, label)
  const ready = (await listChannels(db, label)).filter(c => c.status === 'READY')
  if (!ready.length) throw new ServiceError('Hand the partner at least one account first (Accounts: "I made it" + handle).')
  const id: any = await db.prepare('SELECT artist_name FROM lw_label_identity WHERE label_id=?').bind(label).first()
  const artist = id?.artist_name ?? 'me'
  const shop: any = await db.prepare('SELECT shop_json FROM lw_merch_shops WHERE label_id=?').bind(label).first()
  let shopUrl: string | null = null; try { const j = JSON.parse(shop?.shop_json || '{}'); const d = j.publicDomain || j.domain; shopUrl = d ? `https://${d}` : null } catch { /* no shop */ }
  const merch = (await db.prepare("SELECT id,name FROM lw_merch_products WHERE label_id=? AND state='PUBLIC' ORDER BY created_at DESC LIMIT 6").bind(label).all()).results as any[]
  const songs = (await db.prepare("SELECT title,link FROM lw_catalog_tracks WHERE label_id=? AND pro_status<>'NOT_MINE' ORDER BY COALESCE(release_date,'') DESC LIMIT 6").bind(label).all()).results as any[]
  const pool: PostIn[] = []
  const rot: { kind: string; make: (day: string, p: Platform) => PostIn }[] = []
  merch.forEach(m => rot.push({ kind: 'merch', make: (day, p) => ({ day, platform: p, kind: 'merch', caption: `New ${m.name} is live. Printed when you order, shipped to your door. Link ${p === 'instagram' || p === 'tiktok' ? 'in bio' : 'below'}.`, link: shopUrl, media: { productId: m.id, mockup: 0 } }) }))
  songs.forEach(t => rot.push({ kind: 'song', make: (day, p) => ({ day, platform: p, kind: 'song', caption: `"${t.title}" by ${artist}. Run it back and tell me your favorite line.`, link: t.link && /^https:/.test(t.link) ? t.link : null, media: { needs: 'OWNER_CLIP', hint: `15-30s clip or visualizer of "${t.title}"` } }) }))
  rot.push({ kind: 'question', make: (day, p) => ({ day, platform: p, kind: 'question', caption: `What should ${artist} drop next: a new single, a hoodie, or a live show? Comment below.`, link: null, media: {} }) })
  rot.push({ kind: 'behind_scenes', make: (day, p) => ({ day, platform: p, kind: 'behind_scenes', caption: `In the studio this week. Something new is coming.`, link: null, media: { needs: 'OWNER_CLIP', hint: 'Short studio or phone clip' } }) })
  const perDay = Math.max(1, Math.min(s.postsPerDay || 1, 3))
  let i = 0
  for (let d = 0; d < 7; d++) for (const c of ready) for (let k = 0; k < perDay; k++) {
    let item = rot[i++ % rot.length].make(addDays(weekStart, d), c.platform)
    // Text-only posts can't go on video platforms: use a merch mockup there when possible.
    if (NEEDS_MEDIA.includes(c.platform) && !Object.keys(item.media ?? {}).length && merch.length) item = rot.find(r => r.kind === 'merch')!.make(item.day, c.platform)
    pool.push(item)
  }
  return pool
}
export async function createPlan(db: any, label: string, actor: number, b: any, by: string) {
  await requireEditor(db, label, actor)
  const s = await getPartnerSettings(db, label), now = await today(db, label)
  const weekStart = b?.weekStart == null ? mondayOf(now.date) : isDate(b.weekStart) ? mondayOf(b.weekStart) : (() => { throw new ServiceError('weekStart must be YYYY-MM-DD') })()
  if (weekStart < mondayOf(now.date)) throw new ServiceError('That week is already over')
  const raw = Array.isArray(b?.posts) && b.posts.length ? b.posts : await draftWeek(db, label, weekStart)
  if (raw.length > 63) throw new ServiceError('At most 63 posts per week')
  const posts = raw.map((p: any) => checkPost(p, weekStart, s.postsPerDay))
  const per = new Map<string, number>()
  for (const p of posts) { const k = `${p.day}:${p.platform}`; per.set(k, (per.get(k) ?? 0) + 1); if (per.get(k)! > Math.max(1, s.postsPerDay)) throw new ServiceError(`More than ${Math.max(1, s.postsPerDay)} post(s) on ${p.platform} on ${p.day} (owner's limit)`) }
  const notes = str(b?.notes, 'notes', 2000)
  const id = crypto.randomUUID()
  await db.batch([
    db.prepare("UPDATE lw_partner_plans SET status='REPLACED' WHERE label_id=? AND week_start=? AND status='DRAFT'").bind(label, weekStart),
    db.prepare('INSERT INTO lw_partner_plans(id,label_id,week_start,status,notes,created_by) VALUES (?,?,?,?,?,?)').bind(id, label, weekStart, 'DRAFT', notes, by.slice(0, 100)),
    ...posts.map((p: PostIn) => db.prepare('INSERT INTO lw_partner_posts(id,label_id,plan_id,day,platform,kind,caption,media_json,link) VALUES (?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), label, id, p.day, p.platform, p.kind, p.caption, JSON.stringify(p.media ?? {}), p.link ?? null)),
    audit(db, label, actor, 'partner.plan.created', { id, weekStart, posts: posts.length, by })
  ])
  await notify(db, { label, kind: 'PARTNER_PLAN', title: `Your week plan is ready (${posts.length} posts)`, body: 'Approve it once and your partner runs it all week. Edit or skip any post first if you like.', link: '/label-world/agents/partner', dedupe: `pplan:${id}` })
  return getPlan(db, label, id)
}
export async function getPlan(db: any, label: string, id: string) {
  const plan: any = await db.prepare('SELECT id,week_start,status,notes,created_by,approved_by,approved_at,created_at FROM lw_partner_plans WHERE label_id=? AND id=?').bind(label, id).first()
  if (!plan) throw new ServiceError('Plan not found', 404)
  const posts = ((await db.prepare('SELECT id,day,platform,kind,caption,media_json,link,status,posted_url,posted_via,note,posted_at FROM lw_partner_posts WHERE plan_id=? ORDER BY day,platform,rowid').bind(id).all()).results as any[]).map(({ media_json, ...p }) => ({ ...p, media: JSON.parse(media_json || '{}') }))
  return { plan, posts }
}
/** One tap: APPROVED (optionally with caption edits / skips first) or REJECTED. Owner only. */
export async function decidePlan(db: any, label: string, actor: number, id: string, b: any) {
  await requireOwner(db, label, actor)
  const plan: any = await db.prepare('SELECT id,week_start,status FROM lw_partner_plans WHERE label_id=? AND id=?').bind(label, id).first()
  if (!plan) throw new ServiceError('Plan not found', 404)
  if (plan.status !== 'DRAFT') throw new ServiceError(`Plan is ${plan.status}`, 409)
  const decision = String(b?.decision ?? '')
  if (!['APPROVED', 'REJECTED'].includes(decision)) throw new ServiceError('decision must be APPROVED or REJECTED')
  const edits = Array.isArray(b?.edits) ? b.edits.slice(0, 63) : []
  const stmts: any[] = []
  for (const e of edits) {
    const pid = String(e?.id ?? '')
    if (e?.skip) stmts.push(db.prepare("UPDATE lw_partner_posts SET status='SKIPPED',note='Skipped by owner' WHERE id=? AND plan_id=?").bind(pid, id))
    else if (e?.caption != null) { const c = str(e.caption, 'caption', 2200); if (!c) throw new ServiceError('Caption cannot be empty'); stmts.push(db.prepare('UPDATE lw_partner_posts SET caption=? WHERE id=? AND plan_id=?').bind(c, pid, id)) }
  }
  if (decision === 'APPROVED') {
    stmts.push(db.prepare("UPDATE lw_partner_posts SET status='SKIPPED',note='Replaced by a newer approved plan' WHERE plan_id IN (SELECT id FROM lw_partner_plans WHERE label_id=? AND week_start=? AND status='APPROVED') AND status IN ('PLANNED','SCHEDULED')").bind(label, plan.week_start))
    stmts.push(db.prepare("UPDATE lw_partner_plans SET status='REPLACED' WHERE label_id=? AND week_start=? AND status='APPROVED'").bind(label, plan.week_start))
  }
  stmts.push(db.prepare('UPDATE lw_partner_plans SET status=?,approved_by=?,approved_at=CURRENT_TIMESTAMP WHERE id=?').bind(decision, actor, id))
  stmts.push(audit(db, label, actor, 'partner.plan.' + decision.toLowerCase(), { id, edits: edits.length }))
  await db.batch(stmts)
  const s = await getPartnerSettings(db, label)
  return { ...(await getPlan(db, label, id)), autopilot: s.autopilot, say: decision === 'APPROVED' ? (s.autopilot === 'ON' ? 'Approved. Your partner posts each one on its day.' : 'Approved. Turn autopilot on and your partner posts each one on its day, or post them yourself from this list.') : 'Rejected. Ask for a new draft any time.' }
}

// ---------------- posting ----------------
/** Approved posts due today or earlier that are not done yet, with whether each can go out now. */
export async function duePosts(db: any, label: string, at = new Date()) {
  const s = await getPartnerSettings(db, label), now = await today(db, label, at)
  const channels = await listChannels(db, label)
  const rows = (await db.prepare(`SELECT p.id,p.plan_id,p.day,p.platform,p.kind,p.caption,p.media_json,p.link,p.status FROM lw_partner_posts p JOIN lw_partner_plans pl ON pl.id=p.plan_id
    WHERE p.label_id=? AND pl.status='APPROVED' AND p.status IN ('PLANNED','SCHEDULED','FAILED') AND p.day<=? AND p.day>=? ORDER BY p.day,p.rowid LIMIT 50`).bind(label, now.date, addDays(now.date, -2)).all()).results as any[]
  return {
    autopilot: s.autopilot, today: now.date,
    posts: rows.map(({ media_json, ...p }) => {
      const media = JSON.parse(media_json || '{}'), ch = channels.find(c => c.platform === p.platform)!
      const why = s.autopilot !== 'ON' ? `Autopilot is ${s.autopilot}` : ch.status !== 'READY' ? `${ch.name} account is not handed over yet` : ch.method !== 'OWNER_BROWSER' ? 'Owner posts this one themselves' : media.needs === 'OWNER_CLIP' ? `Needs a clip from the owner: ${media.hint ?? 'video'}` : null
      return { ...p, media, handle: ch.handle, mediaUrl: media.productId ? `/api/label-world/labels/${label}/merch/products/${media.productId}/mockups/${Number(media.mockup ?? 0)}` : null, canPostNow: !why, blockedBy: why }
    })
  }
}
/** Record the outcome. POSTED needs the public post link on that platform (evidence). */
export async function markPost(db: any, label: string, actor: number, id: string, b: any, via: 'web' | 'mcp', agent?: string) {
  await requireEditor(db, label, actor)
  const p: any = await db.prepare("SELECT p.id,p.platform,p.status,pl.status AS plan_status FROM lw_partner_posts p JOIN lw_partner_plans pl ON pl.id=p.plan_id WHERE p.label_id=? AND p.id=?").bind(label, id).first()
  if (!p) throw new ServiceError('Post not found', 404)
  if (p.plan_status !== 'APPROVED') throw new ServiceError('Only posts from an approved plan can go out', 409)
  if (p.status === 'POSTED') throw new ServiceError('Already posted', 409)
  const outcome = String(b?.outcome ?? '')
  if (!['POSTED', 'FAILED', 'SKIPPED'].includes(outcome)) throw new ServiceError('outcome must be POSTED, FAILED or SKIPPED')
  if (via === 'mcp' && outcome === 'POSTED' && (await getPartnerSettings(db, label)).autopilot !== 'ON') throw new ServiceError('Autopilot is not ON. Do not post; the owner stopped or has not started autopilot.', 409)
  let url: string | null = null
  if (outcome === 'POSTED') {
    try { const u = new URL(String(b?.postedUrl ?? '')); if (u.protocol !== 'https:' || u.username || u.password || !HOSTS[p.platform as Platform].test(u.hostname)) throw 0; url = u.href } catch { throw new ServiceError(`POSTED needs the public https link of the post on ${SETUP[p.platform as Platform].name}`) }
  }
  const note = str(b?.note, 'note', 1000)
  const by = via === 'mcp' ? `agent:${(agent ?? 'mcp').slice(0, 60)}` : `user:${actor}`
  await db.batch([
    db.prepare(`UPDATE lw_partner_posts SET status=?,posted_url=?,posted_via=?,note=?,posted_at=CASE WHEN ?='POSTED' THEN CURRENT_TIMESTAMP ELSE posted_at END WHERE id=?`).bind(outcome, url, by, note, outcome, id),
    audit(db, label, actor, 'partner.post.' + outcome.toLowerCase(), { id, url, via, agent })
  ])
  if (outcome === 'FAILED') await notify(db, { label, kind: 'PARTNER_POST_FAILED', title: `A ${SETUP[p.platform as Platform].name} post did not go out`, body: note ?? 'Your partner could not post it. Open the Partner screen to retry or post it yourself.', link: '/label-world/agents/partner', dedupe: `pfail:${id}` })
  return { id, status: outcome, postedUrl: url }
}

// ---------------- money desk + daily check-in ----------------
const LATE_DAYS = 10
/** Orders that look stuck (not shipped after 10 days) or cancelled. Uses the owner's Fourthwall data. */
export async function orderFlags(env: any, label: string, actor: number, fetcher?: typeof fetch) {
  const { merchSales } = await import('./merch')
  const s = await merchSales(env, label, actor, fetcher)
  const flags = (s.recent as any[]).filter(o => /CONFIRMED|PRODUCTION/i.test(o.status ?? '') && o.createdAt && Date.now() - Date.parse(o.createdAt) > LATE_DAYS * 86400000)
    .map(o => ({ order: o.id, status: o.status, createdAt: o.createdAt, why: `Not shipped after ${LATE_DAYS}+ days: check it in Fourthwall > Orders and contact Fourthwall support if needed.` }))
  return { sales: s, flags }
}
export async function partnerOverview(db: any, label: string, actor: number) {
  const role = await requireMember(db, label, actor)
  const settings = await getPartnerSettings(db, label), now = await today(db, label)
  const plans = (await db.prepare("SELECT id,week_start,status,created_by,created_at,approved_at FROM lw_partner_plans WHERE label_id=? AND week_start>=? AND status IN ('DRAFT','APPROVED') ORDER BY week_start,created_at DESC").bind(label, mondayOf(now.date)).all()).results as any[]
  const current = plans.find(p => p.status === 'DRAFT') ?? plans.find(p => p.status === 'APPROVED') ?? null
  const merch: any = await db.prepare("SELECT (SELECT COUNT(*) FROM lw_merch_shops WHERE label_id=?) AS shop,(SELECT COUNT(*) FROM lw_merch_products WHERE label_id=? AND state='PUBLIC') AS live,(SELECT COUNT(*) FROM lw_merch_products WHERE label_id=? AND state='HIDDEN') AS hidden,(SELECT COUNT(*) FROM lw_merch_designs WHERE label_id=? AND status='APPROVED' AND id NOT IN (SELECT design_id FROM lw_merch_products WHERE label_id=?)) AS approvedUnused").bind(label, label, label, label, label).first()
  const lastCheckin: any = await db.prepare("SELECT content,created_at FROM lw_employee_messages WHERE label_id=? AND agent_id='partner' AND role='assistant' AND model='daily-checkin' ORDER BY created_at DESC LIMIT 1").bind(label).first()
  const week: any = await db.prepare("SELECT SUM(p.status='POSTED') AS posted,SUM(p.status IN ('PLANNED','SCHEDULED')) AS planned,SUM(p.status='FAILED') AS failed FROM lw_partner_posts p JOIN lw_partner_plans pl ON pl.id=p.plan_id WHERE p.label_id=? AND pl.status='APPROVED' AND p.day BETWEEN ? AND ?").bind(label, mondayOf(now.date), addDays(mondayOf(now.date), 6)).first()
  return {
    factsVersion: PARTNER_FACTS_VERSION, role, today: now.date, settings, channels: await listChannels(db, label),
    plan: current ? await getPlan(db, label, current.id) : null, plans, due: await duePosts(db, label),
    week: { posted: week?.posted ?? 0, planned: week?.planned ?? 0, failed: week?.failed ?? 0 },
    merch: { shopConnected: Boolean(merch?.shop), live: merch?.live ?? 0, hidden: merch?.hidden ?? 0, approvedDesignsNotMade: merch?.approvedUnused ?? 0 },
    streams: { amazon: STREAMS.amazon.options, tickets: STREAMS.tickets.options, chosen: settings.streams },
    lastCheckin, suggestions: suggestions(merch, settings),
    rules: ['Posts only from a plan the owner approved, only while autopilot is ON.', 'Never handles passwords, card or bank details; never DMs, follows, likes, comments or buys ads.', `Never spends more than $${(settings.spendCapCents / 100).toFixed(2)} a month (he has no way to spend money today).`, 'Anyone on the label can press Stop. Only the owner turns autopilot back on.']
  }
}
function suggestions(m: any, s: any) {
  const out: string[] = []
  if (!m?.shop) out.push('Connect your free Fourthwall shop (Merch tab) so there is something to sell.')
  else if (!m.live && !m.hidden) out.push('Make your first product: a tee from your best design (Merch tab).')
  if (m?.hidden) out.push(`${m.hidden} product(s) are made but hidden. Publish the ones you like.`)
  if (m?.approvedUnused) out.push(`${m.approvedUnused} approved design(s) are not on a product yet. A hoodie or hat is a quick new drop.`)
  if (!s.streams?.amazon) out.push('Decide on Amazon: Merch on Demand (free, apply, usually decided within 14 days) or Seller Central ($0.99/item or $39.99/mo).')
  if (!s.streams?.tickets) out.push('Got a show coming? Free events list free on Eventbrite.')
  return out.slice(0, 4)
}
/** The daily check-in text. Facts only; no AI tokens. */
export async function checkinText(env: any, label: string, actor: number, fetcher?: typeof fetch) {
  const o = await partnerOverview(env.DB, label, actor)
  const lines: string[] = [`Money check-in for ${o.today}.`]
  if (o.merch.shopConnected) {
    try {
      const { sales, flags } = await orderFlags(env, label, actor, fetcher)
      lines.push(`Merch: ${sales.orders} order(s), $${sales.salesUsd} in sales, about $${sales.profitBeforeCardFeesUsd} yours before card fees (last 100 orders).`)
      if (flags.length) lines.push(`Needs a look: ${flags.map(f => `order ${f.order} (${f.status})`).join(', ')} not shipped after ${LATE_DAYS} days.`)
    } catch { lines.push('Merch: I could not reach Fourthwall right now; I will try again tomorrow.') }
  } else lines.push('Merch: no shop connected yet.')
  const due = o.due.posts, ready = due.filter(p => p.canPostNow).length
  lines.push(`Posts this week: ${o.week.posted} posted, ${o.week.planned} still planned${o.week.failed ? `, ${o.week.failed} failed` : ''}. Due now: ${due.length}${due.length ? ` (${ready} I can post, ${due.length - ready} need you)` : ''}.`)
  if (!o.plan) lines.push('No plan for this week yet. Tap "Draft my week" and approve it once.')
  else if (o.plan.plan.status === 'DRAFT') lines.push(`This week's plan (${o.plan.posts.length} posts) is waiting for your one-tap approval.`)
  lines.push(`Autopilot: ${o.settings.autopilot}.`)
  if (o.suggestions.length) lines.push('Ideas: ' + o.suggestions.join(' '))
  return lines.join('\n')
}
export async function postCheckin(env: any, label: string, actor: number, fetcher?: typeof fetch) {
  const text = await checkinText(env, label, actor, fetcher)
  await env.DB.prepare("INSERT INTO lw_employee_messages(id,label_id,user_id,agent_id,role,content,status,provider,model) VALUES (?,?,?,'partner','assistant',?,'COMPLETED','studio2u','daily-checkin')").bind(crypto.randomUUID(), label, actor, text).run()
  return text
}
/** Chat: plain money/status questions get an instant answer from the facts. */
export const PARTNER_INTENT = /\b(money|sales|sold|orders?|merch|plan|posts?|posting|autopilot|check.?in|how are we|status|today|this week|revenue|made)\b/i

/**
 * Engine pass (every 5 min, idempotent):
 *  - autopilot ON: due approved posts become screen tasks for the owner's agent (one per post)
 *  - autopilot ON + Monday + no plan this week: draft one and ask for the one-tap approval
 *  - once a day at the owner's hour (not while PAUSED): the money check-in in his chat
 */
export async function partnerPass(env: any, enqueueFn: (t: any) => Promise<boolean>, labelIds?: string[], at = new Date(), fetcher?: typeof fetch) {
  const db = env.DB
  const rows = (await db.prepare(`SELECT s.label_id,s.autopilot,s.checkin_hour,s.last_checkin_date,(SELECT user_id FROM lw_memberships m WHERE m.label_id=s.label_id AND m.role='owner' ORDER BY user_id LIMIT 1) AS owner
    FROM lw_partner_settings s WHERE s.autopilot<>'PAUSED' AND (? IS NULL OR s.label_id IN (SELECT value FROM json_each(?))) LIMIT 200`).bind(labelIds ? 1 : null, JSON.stringify(labelIds ?? [])).all()).results as any[]
  let queued = 0, checkins = 0, drafted = 0
  for (const r of rows) {
    if (!r.owner) continue
    const now = await today(db, r.label_id, at)
    if (r.autopilot === 'ON') {
      for (const p of (await duePosts(db, r.label_id, at)).posts.filter(p => p.canPostNow)) {
        if (await enqueueFn({ label: r.label_id, kind: 'PARTNER_POST', role: 'business_partner', capability: 'SCREEN_CONTROL', title: `Post on ${SETUP[p.platform as Platform].name} (@${p.handle}): ${p.caption.slice(0, 60)}`, input: { partnerPostId: p.id, platform: p.platform }, dedupe: `ppost:${p.id}` })) queued++
      }
      const wk = mondayOf(now.date)
      if (now.weekday === 1) {
        const has = await db.prepare("SELECT 1 FROM lw_partner_plans WHERE label_id=? AND week_start=? AND status IN ('DRAFT','APPROVED')").bind(r.label_id, wk).first()
        if (!has) { try { await createPlan(db, r.label_id, r.owner, { weekStart: wk, notes: 'Drafted automatically on Monday.' }, 'partner'); drafted++ } catch { /* no accounts yet */ } }
      }
    }
    if (now.hour >= r.checkin_hour && r.last_checkin_date !== now.date) {
      const claim = await db.prepare('UPDATE lw_partner_settings SET last_checkin_date=? WHERE label_id=? AND (last_checkin_date IS NULL OR last_checkin_date<>?)').bind(now.date, r.label_id, now.date).run()
      if (!claim.meta.changes) continue
      try {
        const text = await postCheckin(env, r.label_id, r.owner, fetcher)
        await notify(db, { label: r.label_id, kind: 'PARTNER_CHECKIN', title: 'Your daily money check-in', body: text.slice(0, 600), link: '/label-world/agents/partner', dedupe: `pcheck:${r.label_id}:${now.date}` })
        checkins++
      } catch { /* try again tomorrow */ }
    }
  }
  return { queued, checkins, drafted }
}
