// Shows: the owner's own live shows, sold from the owner's own ticket link.
// Each published show gets a public page (studio2u.pages.dev/show/<slug>) and a QR code for
// flyers, posters, merch tables and posts. Scanning the QR opens the page; "Get tickets" goes
// straight to the owner's ticket link (any seller they control: a Stripe Payment Link from their
// own Stripe account, their Eventbrite, the venue's box office) or the show is free.
// Studio2U never takes the money, never sees card details, never stores buyer data. It only
// counts page views and QR scans. Facts checked 2026-10-30: stripe.com/pricing (2.9% + 30c per
// successful domestic card payment, Payment Links included), eventbrite.com/organizer/pricing.
import qrcode from 'qrcode-generator'
import { ServiceError, memberRole } from './service'

export const PUBLIC_ORIGIN = 'https://studio2u.pages.dev'
const str = (v: unknown, f: string, max: number, required = false) => {
  if (v == null || v === '') { if (required) throw new ServiceError(`${f} is required`); return null }
  if (typeof v !== 'string' || v.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)) throw new ServiceError(`Invalid ${f}`)
  const t = v.trim(); if (required && !t) throw new ServiceError(`${f} is required`); return t || null
}
/** Owner's ticket link: any public https page, no embedded logins, no Studio2U pages. */
export function ticketLink(v: unknown) {
  const s = str(v, 'ticket link', 2000); if (!s) return null
  let u: URL; try { u = new URL(s) } catch { throw new ServiceError('Ticket link must be a full https:// link') }
  if (u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.')) throw new ServiceError('Ticket link must be a public https:// link')
  return u.href
}
const startsAt = (v: unknown) => {
  const s = str(v, 'date and time', 16, true)!
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) || Number.isNaN(Date.parse(s + ':00Z'))) throw new ServiceError('Pick a date and start time')
  return s
}
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)
async function role(db: any, label: string, actor: number) { const r = await memberRole(db, label, actor); if (!r) throw new ServiceError('Label not found', 404); return r }
async function editor(db: any, label: string, actor: number) { const r = await role(db, label, actor); if (r === 'viewer') throw new ServiceError('Editing permission required', 403); return r }
const row = (s: any) => s && ({ id: s.id, slug: s.slug, title: s.title, startsAt: s.starts_at, venue: s.venue, city: s.city, address: s.address, details: s.details, ticketUrl: s.ticket_url, priceText: s.price_text, free: Boolean(s.free), status: s.status, url: s.url, qrUrl: s.url + '?src=qr', views: s.views, qrScans: s.qr_scans, publishedAt: s.published_at })

export async function listShows(db: any, label: string, actor: number) {
  await role(db, label, actor)
  return ((await db.prepare('SELECT * FROM lw_shows WHERE label_id=? ORDER BY starts_at DESC LIMIT 50').bind(label).all()).results as any[]).map(row)
}
export async function getShow(db: any, label: string, id: string) {
  const s = await db.prepare('SELECT * FROM lw_shows WHERE label_id=? AND id=?').bind(label, id).first()
  if (!s) throw new ServiceError('Show not found', 404)
  return s
}
/** Create or edit a show. Anyone who can edit may draft; only the owner publishes (it goes public). */
export async function saveShow(db: any, label: string, actor: number, b: any) {
  await editor(db, label, actor)
  const f = {
    title: str(b?.title, 'show name', 120, true)!, startsAt: startsAt(b?.startsAt), venue: str(b?.venue, 'venue', 120, true)!, city: str(b?.city, 'city', 80, true)!,
    address: str(b?.address, 'address', 200), details: str(b?.details, 'details', 1000), ticketUrl: ticketLink(b?.ticketUrl), priceText: str(b?.priceText, 'price', 60), free: b?.free === true
  }
  if (f.free) f.ticketUrl = f.ticketUrl ?? null
  if (b?.id) {
    const cur = await getShow(db, label, String(b.id))
    if (cur.status === 'PUBLISHED' && !f.free && !f.ticketUrl) throw new ServiceError('A live show needs a ticket link or "Free".')
    await db.prepare('UPDATE lw_shows SET title=?,starts_at=?,venue=?,city=?,address=?,details=?,ticket_url=?,price_text=?,free=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND label_id=?')
      .bind(f.title, f.startsAt, f.venue, f.city, f.address, f.details, f.ticketUrl, f.priceText, f.free ? 1 : 0, cur.id, label).run()
    return row(await getShow(db, label, cur.id))
  }
  const artist: any = await db.prepare('SELECT artist_name FROM lw_label_identity WHERE label_id=?').bind(label).first()
  const id = crypto.randomUUID(), slug = `${slugify(`${artist?.artist_name ?? ''} ${f.title}`) || 'show'}-${id.slice(0, 6)}`
  await db.prepare('INSERT INTO lw_shows(id,label_id,slug,title,starts_at,venue,city,address,details,ticket_url,price_text,free,url,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, label, slug, f.title, f.startsAt, f.venue, f.city, f.address, f.details, f.ticketUrl, f.priceText, f.free ? 1 : 0, `${PUBLIC_ORIGIN}/show/${slug}`, actor).run()
  return row(await getShow(db, label, id))
}
export async function setShowStatus(db: any, label: string, actor: number, id: string, b: any) {
  const r = await editor(db, label, actor), s = await getShow(db, label, id), status = String(b?.status ?? '')
  if (!['PUBLISHED', 'CANCELLED', 'DRAFT'].includes(status)) throw new ServiceError('status must be PUBLISHED, CANCELLED or DRAFT')
  if (status === 'PUBLISHED' && r !== 'owner') throw new ServiceError('Only the label owner can put a show page live', 403)
  if (status === 'PUBLISHED' && !s.free && !s.ticket_url) throw new ServiceError('Add your ticket link (or mark it Free) before going live.')
  await db.batch([
    db.prepare("UPDATE lw_shows SET status=?,published_at=CASE WHEN ?='PUBLISHED' THEN COALESCE(published_at,CURRENT_TIMESTAMP) ELSE published_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status, status, s.id),
    db.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, actor, 'show.' + status.toLowerCase(), JSON.stringify({ show: s.id, title: s.title }))
  ])
  return row(await getShow(db, label, s.id))
}
/** Published shows still ahead (by date), for Ben's weekly plan and check-in. */
export async function upcomingShows(db: any, label: string, fromDate: string, days = 21) {
  const to = new Date(Date.parse(fromDate + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10)
  return ((await db.prepare("SELECT * FROM lw_shows WHERE label_id=? AND status='PUBLISHED' AND substr(starts_at,1,10)>=? AND substr(starts_at,1,10)<=? ORDER BY starts_at").bind(label, fromDate, to).all()).results as any[]).map(row)
}

// ---------------- QR + public page ----------------
export function qrSvg(text: string, dark = '#000000') {
  const q = qrcode(0, 'M'); q.addData(text); q.make()
  const n = q.getModuleCount(), m = 4, size = n + m * 2
  let path = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) path += `M${c + m},${r + m}h1v1h-1z`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size * 10}" height="${size * 10}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><path d="${path}" fill="${dark}"/></svg>`
}
export async function publicShow(db: any, slug: string) {
  if (!/^[a-z0-9-]{6,80}$/.test(slug)) return null
  const s: any = await db.prepare("SELECT s.*,i.artist_name FROM lw_shows s LEFT JOIN lw_label_identity i ON i.label_id=s.label_id WHERE s.slug=? AND s.status IN ('PUBLISHED','CANCELLED')").bind(slug).first()
  return s
}
export async function countVisit(db: any, id: string, qr: boolean) {
  await db.prepare(`UPDATE lw_shows SET views=views+1${qr ? ',qr_scans=qr_scans+1' : ''} WHERE id=?`).bind(id).run()
}
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
export function niceDate(startsAt: string) {
  const d = new Date(startsAt + ':00Z')
  return d.toLocaleString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
export function showPage(s: any) {
  const artist = s.artist_name ?? '', cancelled = s.status === 'CANCELLED'
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.venue, s.address, s.city].filter(Boolean).join(', '))}`
  const cta = cancelled ? '<p class="x">This show was cancelled.</p>' : s.free ? '<p class="free">Free. Just show up.</p>' : `<a class="buy" href="${esc(s.ticket_url)}" rel="noopener noreferrer">Get tickets${s.price_text ? ` · ${esc(s.price_text)}` : ''}</a>`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(artist ? `${artist} · ${s.title}` : s.title)}</title>
<meta property="og:title" content="${esc(artist ? `${artist}: ${s.title}` : s.title)}"><meta property="og:description" content="${esc(`${niceDate(s.starts_at)} · ${s.venue}, ${s.city}`)}">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(at 50% 0,#2a2210,#07090c 60%);color:#f3eee2;font-family:Inter,Arial,sans-serif}main{max-width:460px;width:100%;padding:34px 24px;text-align:center}small{letter-spacing:3px;color:#d6b25e;font-size:12px}h1{font-size:34px;margin:10px 0 4px;line-height:1.15}h2{font-weight:400;color:#cfc6b2;font-size:18px;margin:0 0 22px}.when{font-size:17px;margin:6px 0}.where a{color:#f3eee2}.d{color:#b7ae9b;font-size:14px;line-height:1.6;white-space:pre-wrap;margin:18px 0}.buy{display:block;margin:26px 0 10px;padding:16px;border-radius:12px;background:linear-gradient(#f8d781,#c6993f);color:#151006;font-weight:700;font-size:18px;text-decoration:none}.free{font-size:20px;color:#7fe0c3;margin:26px 0}.x{font-size:20px;color:#ff8b8b;margin:26px 0}footer{margin-top:28px;color:#7b7464;font-size:11px}</style></head>
<body><main><small>LIVE</small><h1>${esc(s.title)}</h1>${artist ? `<h2>${esc(artist)}</h2>` : ''}<p class="when">${esc(niceDate(s.starts_at))}</p><p class="where"><a href="${map}" rel="noopener noreferrer">${esc(s.venue)} · ${esc(s.city)}</a>${s.address ? `<br><span>${esc(s.address)}</span>` : ''}</p>${s.details ? `<p class="d">${esc(s.details)}</p>` : ''}${cta}<footer>Tickets are sold by the artist's own ticket seller. Studio2U never sees your payment.</footer></main></body></html>`
}
