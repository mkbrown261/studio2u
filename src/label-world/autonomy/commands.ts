// Say it, it's done. The owner types (or says) what they want in any chat box ("sell my merch on
// Fourthwall", "my instagram is @aviatorkeyz", "autopilot on", "stop") and the setting changes
// right away: no forms, no dropdown hunting. Money/rights stories still go to cases (talk.ts).
// No AI tokens are spent here.
import { ServiceError } from './service'
import { enqueue } from './engine'
import * as partner from './partner'
import { stopAll, resumeAll } from './checkpoints'

const FW = /\b(fourth\s?wall|4th\s?wall)\b/i
const NET: Record<string, partner.Platform> = { instagram: 'instagram', insta: 'instagram', ig: 'instagram', tiktok: 'tiktok', 'tik tok': 'tiktok', twitter: 'x', x: 'x', facebook: 'facebook', fb: 'facebook', threads: 'threads', youtube: 'youtube', yt: 'youtube' }
const HANDLE = /\b(instagram|insta|ig|tik\s?tok|twitter|x|facebook|fb|threads|youtube|yt)\b[^@\n]{0,40}@([A-Za-z0-9._-]{1,60})/gi

/** Returns null when the message is not a command (it then goes to cases / the employee). */
export async function ownerCommand(db: any, label: string, actor: number, text: string): Promise<{ reply: string; did: string[] } | null> {
  const t = text.trim(), low = t.toLowerCase(), did: string[] = [], say: string[] = []
  const q = (x: any) => enqueue(db, x)
  const tryDo = async (what: string, fn: () => Promise<any>) => { try { const r = await fn(); did.push(what); return r } catch (e: any) { say.push(e instanceof ServiceError ? e.message : 'That did not work, try again.'); return null } }

  if (/^\s*(stop|stop (it|everything|all|now)|pause (everything|all))\b/i.test(t)) { const r = await tryDo('stop', () => stopAll(db, label, actor)); return { reply: r?.say ?? say.join(' '), did } }
  if (/^\s*(resume|unpause|start (back|again)|keep going)\b/i.test(t)) { const r = await tryDo('resume', () => resumeAll(db, label, actor)); return { reply: r?.say ?? say.join(' '), did } }

  // Merch store
  const merchy = /\b(sell|selling|merch|shop|store|shirts?|tees?|hoodies?)\b/i.test(t)
  if (FW.test(t) && (merchy || /\b(use|switch|go with|set up|setup|connect)\b/i.test(t))) {
    const both = /\bamazon\b/i.test(t) && /\b(both|and|also|too|plus)\b/i.test(t) && !/\b(not|no|instead of|stop|drop)\b[^.]{0,20}amazon/i.test(t)
    const r = await tryDo('merch', () => partner.saveStreams(db, label, actor, { merch: both ? 'BOTH' : 'FOURTHWALL' }))
    if (r) {
      const shop = await partner.queueShopSetup(db, label, q, JSON.stringify(r)).catch(() => false)
      const connected = await db.prepare('SELECT 1 FROM lw_merch_shops WHERE label_id=?').bind(label).first()
      say.push(`Done: your merch now sells on ${both ? 'Fourthwall and Amazon' : 'Fourthwall'}${both ? '' : ' (Amazon is off)'}.${connected ? ' Your shop is already connected.' : shop ? ' Your agent sets up your free Fourthwall shop in your browser and connects it here on its next run. If Fourthwall asks for a code or payout details, that one step is yours.' : ''}`)
    }
  } else if (/\bamazon\b/i.test(t) && merchy && !FW.test(t)) {
    const off = /\b(no|not|stop|drop|turn off|without)\b[^.]{0,20}amazon/i.test(t)
    const r = await tryDo('merch', () => partner.saveStreams(db, label, actor, off ? { amazon: 'NONE' } : { merch: 'AMAZON', amazon: /seller central/i.test(t) ? 'SELLER_CENTRAL' : 'MERCH_ON_DEMAND' }))
    if (r) say.push(off ? 'Done: Amazon is off.' : `Done: merch sells on Amazon (${r.amazon === 'SELLER_CENTRAL' ? 'Seller Central' : 'Merch on Demand'}). Your agent fills the application in your browser; you do the tax and bank step yourself.`)
  }
  // Tickets
  if (/\btickets?\b/i.test(t)) {
    if (/\beventbrite\b/i.test(t)) { if (await tryDo('tickets', () => partner.saveStreams(db, label, actor, { tickets: 'EVENTBRITE' }))) say.push('Done: tickets go through Eventbrite.') }
    else if (/\b(stripe|own (ticket )?(link|page)|my (own )?page|qr)\b/i.test(t)) { if (await tryDo('tickets', () => partner.saveStreams(db, label, actor, { tickets: 'OWN_LINK' }))) say.push('Done: tickets go through your own show page + QR code.') }
  }
  // Autopilot, pace, check-in, spend cap
  if (/\bauto\s?pilot\b/i.test(t)) {
    const on = /\b(on|start|enable|turn it on|go)\b/i.test(t) && !/\b(off|stop|disable)\b/i.test(t)
    if (await tryDo('autopilot', () => partner.savePartnerSettings(db, label, actor, { autopilot: on ? 'ON' : 'OFF' }))) say.push(on ? 'Done: autopilot is on. Ben posts only what you approved.' : 'Done: autopilot is off.')
  }
  const ppd = /\b([0-3])\s*(posts?|times)\s*(a|per|each)\s*day\b/i.exec(t)
  if (ppd) { if (await tryDo('pace', () => partner.savePartnerSettings(db, label, actor, { postsPerDay: Number(ppd[1]) }))) say.push(`Done: ${ppd[1]} post(s) a day per account.`) }
  const hr = /\bcheck.?in\b[^0-9]{0,15}(\d{1,2})\s*(am|pm)?/i.exec(t)
  if (hr) { let h = Number(hr[1]) % 12; if ((hr[2] ?? '').toLowerCase() === 'pm') h += 12; else if (!hr[2] && Number(hr[1]) >= 12) h = Number(hr[1]); if (await tryDo('checkin', () => partner.savePartnerSettings(db, label, actor, { checkinHour: h }))) say.push(`Done: daily check-in at ${hr[1]}${hr[2] ?? ':00'}.`) }
  const cap = /\b(spend(ing)?\s*cap|budget)\b[^$\d]{0,20}\$?\s*(\d{1,4})/i.exec(t)
  if (cap) { if (await tryDo('cap', () => partner.savePartnerSettings(db, label, actor, { spendCapUsd: Number(cap[3]) }))) say.push(`Done: Ben can spend up to $${cap[3]} a month (and still asks first).`) }
  // Social accounts the owner already has
  const handles: { platform: partner.Platform; handle: string }[] = []
  for (const m of t.matchAll(HANDLE)) { const p = NET[m[1].toLowerCase().replace(/\s+/, ' ')] ?? NET[m[1].toLowerCase().replace(/\s/g, '')]; if (p && !handles.some(h => h.platform === p)) handles.push({ platform: p, handle: m[2].replace(/\.$/, '') }) }
  for (const h of handles) if (await tryDo('account', () => partner.saveChannel(db, label, actor, { platform: h.platform, handle: h.handle, status: 'READY', existing: true }, q))) say.push(`Got it: Ben runs your ${partner.SETUP[h.platform].name} @${h.handle}.`)
  const haveAccounts = !handles.length && /\b(already|i)\s+(have|got)\b[^.]{0,40}\b(social|accounts?|instagram|insta|tiktok|youtube|twitter|facebook|pages?)\b/i.test(t)
  // Brand
  if (haveAccounts || /\b(build|start|do|make)\s+(my|the)\s+brand\b/i.test(low)) {
    const { brandKickoff } = await import('./creative')
    const r = await tryDo('brand', () => brandKickoff(db, label, actor, q, true))
    if (r !== null) say.push(haveAccounts ? 'Got it. Your agent checks which accounts you are logged in to, takes them over (no new accounts), reads your posts to learn how you talk, then builds your brand story, merch and posts. It asks before anything goes public.' : r ? 'Ben is on it: brand story, merch designs and a week of posts in your voice. He asks before anything goes public.' : 'Your agents are stopped. Say "resume" first.')
  }
  if (/\b(set ?up|connect|make|create)\b[^.]{0,20}\b(shop|store)\b/i.test(t) && !did.includes('merch')) {
    const r = await tryDo('shop', () => partner.requestShopSetup(db, label, actor, q)); if (r) say.push(r.say)
  }
  if (!did.length && !say.length) return null
  return { reply: say.join('\n'), did }
}
