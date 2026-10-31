// Label Office: royalty statement imports and the Monday Report.
// Money rule: statement lines are VERIFIED_EARNED. Case estimates are POTENTIAL.
// The two are reported side by side and never added together.
import { ServiceError, memberRole, requireEditor } from './service'

const DAY = 86400000
async function requireMember(db: any, label: string, user: number) { if (!await memberRole(db, label, user)) throw new ServiceError('Label not found', 404) }
const usd = (micros: number) => Math.round(micros / 10000) / 100

// ---------------- CSV statements ----------------
export const STATEMENT_SOURCES = ['unitedmasters', 'ascap', 'bmi', 'mlc', 'soundexchange', 'distributor', 'other'] as const
export const MAPPING_FIELDS = ['title', 'isrc', 'amount', 'period', 'platform', 'territory', 'quantity'] as const
type Field = typeof MAPPING_FIELDS[number]
const MAX_CSV = 3_000_000, MAX_ROWS = 25_000

/** RFC 4180-ish parser: quotes, escaped quotes, CRLF, commas / semicolons / tabs. */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, ''), first = t.slice(0, t.indexOf('\n') >>> 0 || t.length)
  const delim = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0]
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += ch; continue }
    if (ch === '"') q = true
    else if (ch === delim) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(c => c.trim())) rows.push(row); row = [] }
    else cell += ch
    if (rows.length > MAX_ROWS + 1) throw new ServiceError(`Statement has more than ${MAX_ROWS} rows; split it into smaller files`)
  }
  row.push(cell); if (row.some(c => c.trim())) rows.push(row)
  return rows
}
const GUESS: Record<Field, RegExp> = {
  amount: /(net|earn|amount|royalt|payable|revenue|payout|total|usd|\$)/i,
  title: /(track|song|title|work|composition|release)/i,
  isrc: /isrc/i,
  period: /(period|month|date|quarter|statement|sale)/i,
  platform: /(store|platform|dsp|service|retailer|partner|channel|source)/i,
  territory: /(country|territory|region|market)/i,
  quantity: /(units|streams|quantity|plays|\bcount\b|performances|qty)/i
}
export function guessMapping(headers: string[]) {
  const m: Partial<Record<Field, number>> = {}, used = new Set<number>()
  for (const f of ['isrc', 'amount', 'quantity', 'title', 'period', 'platform', 'territory'] as Field[]) {
    // Prefer "net"/"payable" columns for amount over gross.
    const cands = headers.map((h, i) => ({ h, i })).filter(x => !used.has(x.i) && GUESS[f].test(x.h))
    const pick = f === 'amount' ? (cands.find(x => /(net|payable|earn)/i.test(x.h)) ?? cands[0]) : cands[0]
    if (pick) { m[f] = pick.i; used.add(pick.i) }
  }
  return m
}
export function parseAmount(v: string | undefined): number | null {
  if (v == null) return null
  let s = v.trim(); if (!s) return null
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-'); s = s.replace(/[()\s$€£-]/g, '')
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.') // 1.234,56
  else s = s.replace(/,/g, '')
  if (!/^\d*\.?\d+(e-?\d+)?$/i.test(s)) return null
  const n = Number(s); return Number.isFinite(n) ? (neg ? -n : n) : null
}
async function sha256(text: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('')
}
function checkCsv(csv: unknown) {
  if (typeof csv !== 'string' || !csv.trim()) throw new ServiceError('Paste or upload the statement CSV')
  if (csv.length > MAX_CSV) throw new ServiceError('Statement file is larger than 3 MB; split it by month')
  const rows = parseCsv(csv); if (rows.length < 2) throw new ServiceError('Statement needs a header row and at least one line')
  return rows
}
export function previewStatement(csv: unknown) {
  const rows = checkCsv(csv), headers = rows[0].map(h => h.trim())
  return { headers, mapping: guessMapping(headers), sample: rows.slice(1, 6), rows: rows.length - 1, fields: MAPPING_FIELDS }
}
export async function importStatement(db: any, label: string, actor: number, b: any) {
  await requireEditor(db, label, actor)
  const source = String(b?.source ?? 'other')
  if (!(STATEMENT_SOURCES as readonly string[]).includes(source)) throw new ServiceError(`source must be one of ${STATEMENT_SOURCES.join(', ')}`)
  const filename = String(b?.filename ?? 'statement.csv').slice(0, 200)
  const rows = checkCsv(b?.csv), headers = rows[0]
  const raw = b?.mapping && typeof b.mapping === 'object' ? b.mapping : guessMapping(headers)
  const map: Partial<Record<Field, number>> = {}
  for (const f of MAPPING_FIELDS) { const v = raw[f]; if (v == null || v === '') continue; const i = Number(v); if (!Number.isInteger(i) || i < 0 || i >= headers.length) throw new ServiceError(`Column for ${f} is not in the file`); map[f] = i }
  if (map.amount == null) throw new ServiceError('Choose which column holds the money amount')
  if (map.title == null && map.isrc == null) throw new ServiceError('Choose a song title or ISRC column so lines can be matched to songs')
  const hash = await sha256(b.csv)
  if (await db.prepare('SELECT id FROM lw_statements WHERE label_id=? AND sha256=?').bind(label, hash).first()) throw new ServiceError('This exact statement was already imported', 409)
  const lines: any[] = []; let skipped = 0, total = 0
  const cell = (r: string[], f: Field) => map[f] == null ? null : (r[map[f]!] ?? '').trim().slice(0, 200) || null
  for (const r of rows.slice(1)) {
    const amt = parseAmount(r[map.amount]); if (amt == null) { skipped++; continue }
    const micros = Math.round(amt * 1e6); total += micros
    const isrc = cell(r, 'isrc')?.toUpperCase().replace(/[^A-Z0-9]/g, '') || null
    const qty = map.quantity == null ? null : parseAmount(r[map.quantity])
    lines.push([cell(r, 'title'), isrc, cell(r, 'platform'), cell(r, 'territory'), cell(r, 'period'), qty, micros])
  }
  if (!lines.length) throw new ServiceError('No line had a readable amount in the chosen column')
  const id = crypto.randomUUID()
  await db.prepare('INSERT INTO lw_statements(id,label_id,source,filename,sha256,currency,period_label,row_count,total_micros,mapping_json,uploaded_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, label, source, filename, hash, String(b?.currency ?? 'USD').slice(0, 3).toUpperCase(), b?.periodLabel ? String(b.periodLabel).slice(0, 60) : null, lines.length, total, JSON.stringify({ map, headers: headers.slice(0, 80) }), actor).run()
  const stmt = db.prepare("INSERT INTO lw_royalty_lines(statement_id,label_id,title,isrc,platform,territory,period,quantity,amount_micros,classification) VALUES (?,?,?,?,?,?,?,?,?,'VERIFIED_EARNED')")
  for (let i = 0; i < lines.length; i += 80) await db.batch(lines.slice(i, i + 80).map(l => stmt.bind(id, label, ...l)))
  await db.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, actor, 'statement.imported', JSON.stringify({ id, source, lines: lines.length, skipped })).run()
  return { statement: { id, source, filename, lines: lines.length, skipped, totalUsd: usd(total) }, summary: await moneySummary(db, label) }
}
export async function listStatements(db: any, label: string, actor: number) {
  await requireMember(db, label, actor)
  const statements = (await db.prepare('SELECT id,source,filename,period_label,row_count,total_micros,currency,created_at FROM lw_statements WHERE label_id=? ORDER BY created_at DESC LIMIT 100').bind(label).all()).results
    .map((s: any) => ({ ...s, totalUsd: usd(s.total_micros) }))
  return { statements, summary: await moneySummary(db, label) }
}
export async function deleteStatement(db: any, label: string, actor: number, id: string) {
  if ((await memberRole(db, label, actor)) !== 'owner') throw new ServiceError('Only the label owner can delete a statement', 403)
  const r = await db.prepare('DELETE FROM lw_statements WHERE label_id=? AND id=?').bind(label, id).run()
  if (!r.meta.changes) throw new ServiceError('Statement not found', 404)
  await db.prepare('DELETE FROM lw_royalty_lines WHERE statement_id=?').bind(id).run()
  return { ok: true }
}
/** Verified money only, by source and by song. Potential money from cases is listed separately. */
export async function moneySummary(db: any, label: string) {
  const bySource = (await db.prepare("SELECT s.source, SUM(l.amount_micros) AS m, COUNT(*) AS n FROM lw_royalty_lines l JOIN lw_statements s ON s.id=l.statement_id WHERE l.label_id=? AND l.classification='VERIFIED_EARNED' GROUP BY s.source ORDER BY m DESC").bind(label).all()).results
  const bySong = (await db.prepare("SELECT COALESCE(NULLIF(title,''),isrc,'(no title)') AS song, MAX(isrc) AS isrc, SUM(amount_micros) AS m, SUM(quantity) AS q FROM lw_royalty_lines WHERE label_id=? AND classification='VERIFIED_EARNED' GROUP BY COALESCE(isrc,lower(title)) ORDER BY m DESC LIMIT 10").bind(label).all()).results
  const potential = (await db.prepare("SELECT id,title,money_estimate FROM lw_cases WHERE label_id=? AND status NOT IN ('RESOLVED','CLOSED') AND money_estimate IS NOT NULL AND money_estimate<>'' LIMIT 20").bind(label).all()).results
  const verified = bySource.reduce((a: number, r: any) => a + (r.m ?? 0), 0)
  return {
    verifiedEarnedUsd: usd(verified),
    bySource: bySource.map((r: any) => ({ source: r.source, usd: usd(r.m ?? 0), lines: r.n })),
    topSongs: bySong.map((r: any) => ({ song: r.song, isrc: r.isrc, usd: usd(r.m ?? 0), units: r.q })),
    potential: potential.map((p: any) => ({ caseId: p.id, title: p.title, estimate: p.money_estimate, class: 'POTENTIAL' })),
    rule: 'Verified = backed by an imported statement. Potential = a case estimate, not money yet. Never added together.'
  }
}

// ---------------- Monday Report ----------------
export function localParts(tz: string, at = new Date()) {
  let zone = tz
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }) } catch { zone = 'America/New_York' }
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(at).map(x => [x.type, x.value]))
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, weekday, zone }
}
export async function getSettings(db: any, label: string) {
  const s: any = await db.prepare('SELECT timezone,report_weekday,report_hour FROM lw_label_settings WHERE label_id=?').bind(label).first()
  return { timezone: s?.timezone ?? 'America/New_York', reportWeekday: s?.report_weekday ?? 1, reportHour: s?.report_hour ?? 9 }
}
export async function saveSettings(db: any, label: string, actor: number, b: any) {
  if ((await memberRole(db, label, actor)) !== 'owner') throw new ServiceError('Only the label owner can change the report schedule', 403)
  const tz = String(b?.timezone ?? 'America/New_York')
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }) } catch { throw new ServiceError('Unknown time zone') }
  const wd = Number(b?.reportWeekday ?? 1), hr = Number(b?.reportHour ?? 9)
  if (!Number.isInteger(wd) || wd < 0 || wd > 6 || !Number.isInteger(hr) || hr < 0 || hr > 23) throw new ServiceError('Pick a weekday 0-6 and hour 0-23')
  await db.prepare('INSERT INTO lw_label_settings(label_id,timezone,report_weekday,report_hour) VALUES (?,?,?,?) ON CONFLICT(label_id) DO UPDATE SET timezone=excluded.timezone,report_weekday=excluded.report_weekday,report_hour=excluded.report_hour,updated_at=CURRENT_TIMESTAMP').bind(label, tz, wd, hr).run()
  return getSettings(db, label)
}

/** Build the report from stored facts only. No model call, nothing invented. */
export async function buildReport(db: any, label: string, at = new Date()) {
  const end = at.toISOString(), start = new Date(at.getTime() - 7 * DAY).toISOString(), soon = new Date(at.getTime() + 30 * DAY).toISOString().slice(0, 10)
  const sql = (q: string, ...a: any[]) => db.prepare(q).bind(...a)
  const startSql = start.replace('T', ' ').slice(0, 19)
  const [cases, drafts, cat, tasks, signing, concepts, social, prev] = await Promise.all([
    sql("SELECT id,title,status,deadline,deadline_note,money_estimate,updated_at FROM lw_cases WHERE label_id=? AND status NOT IN ('CLOSED') ORDER BY deadline IS NULL, deadline LIMIT 60", label).all(),
    sql("SELECT d.id,d.subject,d.recipient,d.status,c.title AS case_title FROM lw_case_drafts d JOIN lw_cases c ON c.id=d.case_id WHERE d.label_id=? AND d.status IN ('DRAFT','APPROVED') LIMIT 30", label).all(),
    sql("SELECT COUNT(*) AS total, SUM(pro_status='REGISTERED') AS pro, SUM(sx_status='CLAIMED') AS sx, SUM(pro_status IN ('UNKNOWN','NOT_REGISTERED')) AS pro_todo FROM lw_catalog_tracks WHERE label_id=? AND confirmed=1 AND pro_status<>'NOT_MINE'", label).first(),
    sql("SELECT SUM(status='COMPLETED' AND updated_at>=?) AS done, SUM(status='QUEUED') AS queued, SUM(status IN ('BLOCKED','FAILED','WAITING_FOR_INPUT')) AS stuck FROM lw_tasks WHERE label_id=?", startSql, label).first(),
    sql("SELECT a.id,a.work_title,a.status,a.completed_at,(SELECT COUNT(*) FROM lw_agreement_parties p WHERE p.agreement_id=a.id AND p.signed_at IS NULL AND p.declined_at IS NULL) AS waiting FROM lw_agreements a WHERE a.label_id=? AND (a.status IN ('OUT_FOR_SIGNATURE','DECLINED') OR a.completed_at>=?) LIMIT 30", label, startSql).all(),
    sql("SELECT c.id,c.title,c.platform FROM lw_content_concepts c WHERE c.label_id=? AND c.status='DRAFT' LIMIT 20", label).all(),
    sql("SELECT platform,kind,title,metrics_json,captured_at FROM lw_social_snapshots WHERE label_id=? AND captured_at>=? ORDER BY captured_at DESC LIMIT 20", label, startSql).all(),
    sql("SELECT local_date,snapshot_json FROM lw_reports WHERE label_id=? ORDER BY local_date DESC LIMIT 1", label).first()
  ])
  const money = await moneySummary(db, label)
  const newStatements = (await sql("SELECT source,filename,total_micros FROM lw_statements WHERE label_id=? AND created_at>=?", label, startSql).all()).results
  const c = cases.results as any[]
  const deadlines = c.filter(x => x.deadline && x.deadline <= soon && x.status !== 'RESOLVED').map(x => ({ caseId: x.id, title: x.title, deadline: x.deadline, note: x.deadline_note }))
  const needs: { key: string; text: string; link: string }[] = []
  for (const d of drafts.results as any[]) needs.push(d.status === 'DRAFT'
    ? { key: `draft:${d.id}`, text: `Approve or edit the draft "${d.subject ?? d.case_title}"${d.recipient ? ` to ${d.recipient}` : ''}`, link: '/label-world/money' }
    : { key: `send:${d.id}`, text: `Send the approved message "${d.subject ?? d.case_title}" and mark it sent`, link: '/label-world/money' })
  for (const x of c.filter(x => x.status === 'WAITING_ON_YOU')) needs.push({ key: `case:${x.id}`, text: `Answer the open questions on "${x.title}"`, link: '/label-world/money' })
  for (const a of signing.results as any[]) if (a.status === 'OUT_FOR_SIGNATURE') needs.push({ key: `agreement:${a.id}`, text: `Split sheet "${a.work_title}" is waiting on ${a.waiting} signature(s)`, link: '/label-world/money#agreements' })
    else if (a.status === 'DECLINED') needs.push({ key: `agreement:${a.id}`, text: `Someone declined the split sheet "${a.work_title}". Talk it through, then send a new version`, link: '/label-world/money#agreements' })
  for (const k of concepts.results as any[]) needs.push({ key: `concept:${k.id}`, text: `Approve or pass on the content idea "${k.title}"`, link: '/label-world/money#content' })
  // Memory: anything that was on last week's list and is still here gets flagged.
  let prevNeeds: { key: string; weeks?: number }[] = []
  try { prevNeeds = prev ? JSON.parse(prev.snapshot_json).needsYou ?? [] : [] } catch { /* first report */ }
  const prevMap = new Map(prevNeeds.map(n => [n.key, n.weeks ?? 1]))
  const needsYou = needs.slice(0, 25).map(n => ({ ...n, weeks: (prevMap.get(n.key) ?? 0) + 1 }))
  const t: any = tasks ?? {}, k: any = cat ?? {}
  const pct = k.total ? Math.round((k.pro ?? 0) / k.total * 100) : null
  return {
    generatedAt: end, periodStart: start, periodEnd: end, previousReport: prev?.local_date ?? null,
    headline: [
      money.verifiedEarnedUsd ? `$${money.verifiedEarnedUsd.toFixed(2)} verified from statements on file` : 'No statements imported yet, so no verified money to show',
      k.total ? `${k.pro ?? 0} of ${k.total} songs registered with your PRO (${pct}%)` : 'Catalog not imported yet',
      needsYou.length ? `${needsYou.length} thing(s) need you` : 'Nothing is waiting on you'
    ],
    money: { ...money, newStatements: newStatements.map((s: any) => ({ source: s.source, filename: s.filename, usd: usd(s.total_micros) })) },
    deadlines,
    cases: { open: c.filter(x => !['RESOLVED'].includes(x.status)).length, waitingOnThem: c.filter(x => x.status === 'WAITING_ON_THEM').length, resolvedThisWeek: c.filter(x => x.status === 'RESOLVED' && x.updated_at >= startSql).length },
    catalog: { songs: k.total ?? 0, proRegistered: k.pro ?? 0, soundExchangeClaimed: k.sx ?? 0, stillToRegister: k.pro_todo ?? 0, percentRegistered: pct },
    team: { tasksDone: t.done ?? 0, queued: t.queued ?? 0, stuck: t.stuck ?? 0 },
    agreements: (signing.results as any[]).map(a => ({ id: a.id, work: a.work_title, status: a.status, waitingOn: a.waiting })),
    social: (social.results as any[]).map(s => ({ platform: s.platform, kind: s.kind, title: s.title, metrics: safeJson(s.metrics_json), at: s.captured_at })),
    needsYou,
    carriedOver: needsYou.filter(n => n.weeks >= 2).map(n => `${n.weeks === 2 ? 'Second' : `Week ${n.weeks} of`} week unresolved: ${n.text}`)
  }
}
const safeJson = (s: string) => { try { return JSON.parse(s) } catch { return {} } }

export async function generateReport(db: any, label: string, trigger: 'SCHEDULE' | 'MANUAL', at = new Date()) {
  const s = await getSettings(db, label), local = localParts(s.timezone, at)
  const snap = await buildReport(db, label, at)
  const id = crypto.randomUUID()
  // Manual runs replace today's report; scheduled runs never overwrite.
  const r = await db.prepare(`INSERT INTO lw_reports(id,label_id,local_date,period_start,period_end,snapshot_json,trigger) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(label_id,local_date) DO ${trigger === 'MANUAL' ? 'UPDATE SET snapshot_json=excluded.snapshot_json,period_start=excluded.period_start,period_end=excluded.period_end,trigger=excluded.trigger,created_at=CURRENT_TIMESTAMP' : 'NOTHING'}`)
    .bind(id, label, local.date, snap.periodStart, snap.periodEnd, JSON.stringify(snap), trigger).run()
  return { created: Boolean(r.meta.changes), localDate: local.date, report: snap }
}
export async function listReports(db: any, label: string, actor: number) {
  await requireMember(db, label, actor)
  const rows = (await db.prepare('SELECT id,local_date,trigger,created_at,snapshot_json FROM lw_reports WHERE label_id=? ORDER BY local_date DESC LIMIT 12').bind(label).all()).results as any[]
  return { settings: await getSettings(db, label), reports: rows.map(r => ({ id: r.id, localDate: r.local_date, trigger: r.trigger, createdAt: r.created_at, report: safeJson(r.snapshot_json) })) }
}
/** Called by the engine every pass. Writes at most one scheduled report per label per local day. */
export async function scheduledReports(db: any, labelIds?: string[], at = new Date()) {
  const labels = (await db.prepare(`SELECT l.id, s.timezone, s.report_weekday, s.report_hour FROM lw_labels l LEFT JOIN lw_label_settings s ON s.label_id=l.id
    WHERE (? IS NULL OR l.id IN (SELECT value FROM json_each(?))) LIMIT 500`).bind(labelIds ? 1 : null, JSON.stringify(labelIds ?? [])).all()).results as any[]
  const made: string[] = []
  for (const l of labels) {
    const p = localParts(l.timezone ?? 'America/New_York', at)
    if (p.weekday !== (l.report_weekday ?? 1) || p.hour < (l.report_hour ?? 9)) continue
    if (await db.prepare('SELECT 1 FROM lw_reports WHERE label_id=? AND local_date=?').bind(l.id, p.date).first()) continue
    const r = await generateReport(db, l.id, 'SCHEDULE', at)
    if (r.created) made.push(l.id)
  }
  return made
}
