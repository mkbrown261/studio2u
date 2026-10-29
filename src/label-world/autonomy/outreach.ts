// Relentless, polite outreach for cases (cue sheets, unpaid splits, name disputes...).
//
// 1. The agent RESEARCHES who to contact (end credits, IMDbPro company credits, the
//    network's press/corporate site, LinkedIn, trade press) and saves each person with
//    the source URL and a confidence level. Nothing is invented: no source, no contact.
// 2. The agent drafts the first email PLUS its follow-ups as one sequence. The owner
//    approves the whole sequence once on the website.
// 3. The agent sends from the owner's own email. On schedule the engine queues each
//    approved follow-up; the moment anyone replies the sequence stops. When a sequence
//    runs out with no reply, the agent moves up the ladder to the next contact
//    (a new sequence, approved again).
import { ServiceError, memberRole, requireEditor } from './service'

const DAY = 86400000
const EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,180}\.[a-z]{2,24}$/i
const CTRL = /[\x00-\x08\x0b\x0c\x0e-\x1f]/
const s = (v: unknown, f: string, max: number, req = false) => {
  if (v == null || v === '') { if (req) throw new ServiceError(`${f} required`); return null }
  if (typeof v !== 'string' || v.length > max || CTRL.test(v)) throw new ServiceError(`Invalid ${f}`)
  return v.trim() || null
}
export const MAX_FOLLOWUPS = 4, MIN_GAP_DAYS = 3
const event = (db: any, label: string, caseId: string, actor: string, kind: string, body: string) =>
  db.prepare('INSERT INTO lw_case_events(label_id,case_id,actor,kind,body) VALUES (?,?,?,?,?)').bind(label, caseId, actor.slice(0, 100), kind, body.slice(0, 4000))
async function caseOf(db: any, label: string, caseId: string) {
  const c = await db.prepare('SELECT id,title FROM lw_cases WHERE label_id=? AND id=?').bind(label, caseId).first()
  if (!c) throw new ServiceError('Case not found', 404)
  return c
}

// ---------------- contacts ----------------
export async function saveContact(db: any, label: string, actor: number, caseId: string, b: any, by: string) {
  await requireEditor(db, label, actor); await caseOf(db, label, caseId)
  const email = s(b?.email, 'email', 254)?.toLowerCase() ?? null
  if (email && !EMAIL.test(email)) throw new ServiceError('email looks wrong')
  const phone = s(b?.phone, 'phone', 40)
  if (phone && !/^[+()\d\s.-]{7,40}$/.test(phone)) throw new ServiceError('phone looks wrong')
  let source: string | null = null
  if (b?.sourceUrl) { try { const u = new URL(String(b.sourceUrl)); if (!/^https?:$/.test(u.protocol)) throw 0; source = u.href.slice(0, 500) } catch { throw new ServiceError('sourceUrl must be a web link') } }
  const confidence = String(b?.confidence ?? (source ? 'LIKELY' : 'GUESS')).toUpperCase()
  if (!['VERIFIED', 'LIKELY', 'GUESS'].includes(confidence)) throw new ServiceError('confidence must be VERIFIED, LIKELY or GUESS')
  if (confidence !== 'GUESS' && !source) throw new ServiceError('Say where you found this person (sourceUrl). Without a source it is a GUESS.')
  if (!email && !phone && !source) throw new ServiceError('Give an email, phone or the page where this contact is listed')
  const priority = b?.priority == null ? 5 : Number(b.priority)
  if (!Number.isInteger(priority) || priority < 1 || priority > 9) throw new ServiceError('priority must be 1 (contact first) to 9')
  const id = crypto.randomUUID()
  const r = await db.prepare(`INSERT INTO lw_case_contacts(id,label_id,case_id,name,role,company,email,phone,source_url,confidence,priority,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`)
    .bind(id, label, caseId, s(b?.name, 'name', 120), s(b?.role, 'role', 120, true), s(b?.company, 'company', 160, true), email, phone, source, confidence, priority, s(b?.notes, 'notes', 1000), by.slice(0, 100)).run()
  if (!r.meta.changes) throw new ServiceError('That email is already a contact on this case', 409)
  await event(db, label, caseId, by, 'CONTACT', `Found ${b?.name ? b.name + ', ' : ''}${b.role} at ${b.company}${email ? ` <${email}>` : ''} (${confidence.toLowerCase()}${source ? `, source: ${source}` : ''}).`).run()
  return { id, confidence }
}
export async function listContacts(db: any, label: string, actor: number, caseId: string) {
  if (!await memberRole(db, label, actor)) throw new ServiceError('Label not found', 404)
  await caseOf(db, label, caseId)
  return (await db.prepare(`SELECT id,name,role,company,email,phone,source_url,confidence,status,priority,notes,
      (SELECT COUNT(*) FROM lw_case_drafts d WHERE d.contact_id=c.id AND d.status='SENT') AS emails_sent,
      (SELECT MAX(COALESCE(d.last_sent_at,d.sent_at)) FROM lw_case_drafts d WHERE d.contact_id=c.id) AS last_contacted
    FROM lw_case_contacts c WHERE case_id=? ORDER BY CASE status WHEN 'REPLIED' THEN 0 WHEN 'NOT_CONTACTED' THEN 1 WHEN 'CONTACTED' THEN 2 ELSE 3 END, priority, created_at`).bind(caseId).all()).results
}
export async function updateContact(db: any, label: string, actor: number, contactId: string, b: any, by: string) {
  await requireEditor(db, label, actor)
  const c: any = await db.prepare('SELECT * FROM lw_case_contacts WHERE label_id=? AND id=?').bind(label, contactId).first()
  if (!c) throw new ServiceError('Contact not found', 404)
  const status = b?.status == null ? c.status : String(b.status)
  if (!['NOT_CONTACTED', 'CONTACTED', 'REPLIED', 'BOUNCED', 'WRONG_PERSON', 'DO_NOT_CONTACT'].includes(status)) throw new ServiceError('status invalid')
  if (c.status === 'DO_NOT_CONTACT' && status !== 'DO_NOT_CONTACT' && by !== 'owner') throw new ServiceError('Only the owner can undo do-not-contact', 403)
  const notes = b?.notes === undefined ? c.notes : s(b.notes, 'notes', 1000)
  await db.batch([
    db.prepare('UPDATE lw_case_contacts SET status=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status, notes, contactId),
    ...(['BOUNCED', 'WRONG_PERSON', 'DO_NOT_CONTACT', 'REPLIED'].includes(status) ? [db.prepare("UPDATE lw_case_drafts SET replied_at=COALESCE(replied_at,CURRENT_TIMESTAMP),reply_summary=COALESCE(reply_summary,?) WHERE contact_id=? AND replied_at IS NULL").bind(`Sequence stopped: ${status.toLowerCase().replace(/_/g, ' ')}`, contactId)] : []),
    event(db, label, c.case_id, by, 'CONTACT', `${c.name ?? c.role} at ${c.company}: ${status.toLowerCase().replace(/_/g, ' ')}${b?.notes ? ` (${String(b.notes).slice(0, 200)})` : ''}.`)
  ])
  return { id: contactId, status }
}

// ---------------- sequences ----------------
/** Validate follow-ups the agent proposes with a first email. */
export function sequenceInput(v: unknown) {
  if (v == null) return []
  if (!Array.isArray(v) || v.length > MAX_FOLLOWUPS) throw new ServiceError(`followUps: up to ${MAX_FOLLOWUPS}`)
  let prev = 0
  return v.map((x: any, i: number) => {
    const after = Number(x?.afterDays)
    if (!Number.isInteger(after) || after < prev + MIN_GAP_DAYS || after > 90) throw new ServiceError(`followUps[${i}].afterDays must be at least ${MIN_GAP_DAYS} days after the previous message (and at most 90)`)
    prev = after
    return { afterDays: after, subject: s(x?.subject, `followUps[${i}].subject`, 300), body: s(x?.body, `followUps[${i}].body`, 8000, true)! }
  })
}
/** Approved follow-ups whose time has come (owner approved the sequence; nobody replied). */
export async function dueFollowups(db: any, labelIds?: string[], at = Date.now()) {
  const rows = (await db.prepare(`SELECT d.id,d.label_id,d.case_id,d.recipient,d.recipient_email,d.subject,d.sequence_json,d.followups_sent,d.sent_at,d.last_sent_at,c.title, k.status AS contact_status
     FROM lw_case_drafts d JOIN lw_cases c ON c.id=d.case_id LEFT JOIN lw_case_contacts k ON k.id=d.contact_id
     WHERE d.status='SENT' AND d.sequence_approved_at IS NOT NULL AND d.replied_at IS NULL AND c.status NOT IN ('RESOLVED','CLOSED')
       AND (? IS NULL OR d.label_id IN (SELECT value FROM json_each(?))) LIMIT 300`).bind(labelIds ? 1 : null, JSON.stringify(labelIds ?? [])).all()).results as any[]
  const out: any[] = []
  for (const r of rows) {
    if (r.contact_status && ['REPLIED', 'BOUNCED', 'WRONG_PERSON', 'DO_NOT_CONTACT'].includes(r.contact_status)) continue
    const seq = JSON.parse(r.sequence_json || '[]'), next = seq[r.followups_sent]
    if (!next) continue
    const first = Date.parse(String(r.sent_at).replace(' ', 'T') + (String(r.sent_at).includes('Z') ? '' : 'Z'))
    if (first + next.afterDays * DAY <= at) out.push({ draftId: r.id, labelId: r.label_id, caseId: r.case_id, caseTitle: r.title, to: r.recipient_email ?? r.recipient, number: r.followups_sent + 1, of: seq.length, subject: next.subject ?? (r.subject ? `Re: ${r.subject}` : null), body: next.body })
  }
  return out
}
/** Agent sent follow-up N (only approved text, from the owner's email). */
export async function markFollowupSent(db: any, label: string, actor: number, draftId: string, n: number, by: string) {
  await requireEditor(db, label, actor)
  const d: any = await db.prepare('SELECT * FROM lw_case_drafts WHERE label_id=? AND id=?').bind(label, draftId).first()
  if (!d) throw new ServiceError('Draft not found', 404)
  if (d.status !== 'SENT' || !d.sequence_approved_at) throw new ServiceError('Only follow-ups the owner approved, after the first email was sent', 409)
  if (d.replied_at) throw new ServiceError('They already replied; the sequence is stopped. Answer the reply instead.', 409)
  const seq = JSON.parse(d.sequence_json || '[]')
  if (n !== d.followups_sent + 1 || !seq[n - 1]) throw new ServiceError(`Next follow-up is #${d.followups_sent + 1} of ${seq.length}`, 409)
  const done = n >= seq.length
  await db.batch([
    db.prepare('UPDATE lw_case_drafts SET followups_sent=?,last_sent_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND followups_sent=?').bind(n, draftId, n - 1),
    db.prepare("UPDATE lw_cases SET status=CASE WHEN status IN ('RESOLVED','CLOSED') THEN status ELSE 'WAITING_ON_THEM' END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(d.case_id),
    event(db, label, d.case_id, by, 'FOLLOW_UP', `Sent approved follow-up ${n} of ${seq.length} to ${d.recipient_email ?? d.recipient ?? 'contact'}.${done ? ' Sequence finished with no reply: next step is the next contact up the ladder.' : ''}`)
  ])
  return { draftId, sent: n, of: seq.length, finished: done, next: done ? 'Pick the next contact (list_case_contacts) and draft a new sequence for the owner to approve.' : null }
}
/** Someone answered. Stops every follow-up to that contact and puts the case back on the owner/agent. */
export async function recordReply(db: any, label: string, actor: number, draftId: string, summary: string, by: string) {
  await requireEditor(db, label, actor)
  const d: any = await db.prepare('SELECT * FROM lw_case_drafts WHERE label_id=? AND id=?').bind(label, draftId).first()
  if (!d) throw new ServiceError('Draft not found', 404)
  const sum = s(summary, 'summary', 2000, true)!
  await db.batch([
    db.prepare('UPDATE lw_case_drafts SET replied_at=COALESCE(replied_at,CURRENT_TIMESTAMP),reply_summary=? WHERE id=?').bind(sum, draftId),
    ...(d.contact_id ? [db.prepare("UPDATE lw_case_contacts SET status='REPLIED',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(d.contact_id)] : []),
    db.prepare("UPDATE lw_cases SET status=CASE WHEN status IN ('RESOLVED','CLOSED') THEN status ELSE 'OPEN' END,next_follow_up_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(new Date(Date.now() + DAY).toISOString(), d.case_id),
    event(db, label, d.case_id, by, 'REPLY', `${d.recipient ?? d.recipient_email ?? 'Contact'} replied: ${sum}`)
  ])
  return { draftId, stopped: true, note: 'Follow-ups stopped. Read the reply to the owner and draft the answer for approval.' }
}
