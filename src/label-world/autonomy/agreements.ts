// Split sheets with built-in e-signatures (no DocuSign).
//
// Signing model (designed around ESIGN, 15 U.S.C. 7001, and UETA):
//  * consent to do business electronically is captured explicitly before signing
//  * the signer sees the full document and its SHA-256 fingerprint; the signature
//    binds to that exact fingerprint, so any edit = a new version that must be re-signed
//  * intent: typed full legal name plus an "I agree and sign" action
//  * record: timestamps, IP, user agent and an append-only event log, and every party
//    can download the signed copy with its audit certificate at any time
//  * collaborators don't need a Studio2U account: a private link (only its hash is
//    stored) plus confirming the email address the invite was sent to
// This is a record-keeping tool, not legal advice.
import { ServiceError, memberRole, requireEditor } from './service'

export const TEMPLATE_VERSION = 'split-sheet-v1'
const ROLES = ['songwriter', 'composer', 'lyricist', 'producer', 'performer', 'featured artist', 'engineer', 'other'] as const
const PROS = ['ASCAP', 'BMI', 'SESAC', 'GMR', 'SOCAN', 'PRS', 'OTHER', 'NONE']
const EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,180}\.[a-z]{2,24}$/i
const CTRL = /[\x00-\x08\x0b\x0c\x0e-\x1f]/

async function sha256(text: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('')
}
function newToken() { const b = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
const str = (v: unknown, field: string, max: number, required = false) => {
  if (v == null || v === '') { if (required) throw new ServiceError(`${field} required`); return null }
  if (typeof v !== 'string' || v.length > max || CTRL.test(v)) throw new ServiceError(`Invalid ${field}`)
  return v.trim() || (required ? (() => { throw new ServiceError(`${field} required`) })() : null)
}
const num = (v: unknown, field: string) => {
  const n = v == null || v === '' ? 0 : Number(v)
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new ServiceError(`${field} must be between 0 and 100`)
  return Math.round(n * 100) / 100
}
const event = (db: any, a: string, label: string, actor: string, kind: string, body: string, ip?: string | null) =>
  db.prepare('INSERT INTO lw_agreement_events(agreement_id,label_id,actor,kind,body,ip) VALUES (?,?,?,?,?,?)').bind(a, label, actor.slice(0, 120), kind, body.slice(0, 2000), ip ?? null)

export type PartyIn = { legalName: string; stageName?: string | null; email: string; roles: string[]; pro?: string | null; ipi?: string | null; publisherName?: string | null; compositionShare: number; masterShare: number; producerPoints: number }
export type Terms = { workTitle: string; releaseId?: string | null; isrc?: string | null; samples: string; notes?: string | null; parties: PartyIn[] }

/** Validate terms. Composition, master and producer points are separate pools and never mixed. */
export function validateTerms(b: any): Terms {
  const workTitle = str(b?.workTitle, 'Song title', 200, true)!
  const raw = Array.isArray(b?.parties) ? b.parties : []
  if (raw.length < 1 || raw.length > 20) throw new ServiceError('Add between 1 and 20 people')
  const seen = new Set<string>()
  const parties: PartyIn[] = raw.map((p: any, i: number) => {
    const n = `Person ${i + 1}`
    const email = str(p?.email, `${n} email`, 254, true)!.toLowerCase()
    if (!EMAIL.test(email)) throw new ServiceError(`${n} email looks wrong`)
    if (seen.has(email)) throw new ServiceError(`${email} is listed twice; one signature per person`)
    seen.add(email)
    const roles = (Array.isArray(p?.roles) ? p.roles : []).map((r: any) => String(r).toLowerCase()).filter((r: string) => (ROLES as readonly string[]).includes(r))
    if (!roles.length) throw new ServiceError(`${n} needs at least one role`)
    const pro = p?.pro ? String(p.pro).toUpperCase() : null
    if (pro && !PROS.includes(pro)) throw new ServiceError(`${n} PRO must be one of ${PROS.join(', ')}`)
    const ipi = p?.ipi ? String(p.ipi).replace(/\D/g, '') : null
    if (ipi && (ipi.length < 9 || ipi.length > 11)) throw new ServiceError(`${n} IPI should be 9 to 11 digits`)
    return { legalName: str(p?.legalName, `${n} legal name`, 120, true)!, stageName: str(p?.stageName, `${n} stage name`, 120), email, roles: [...new Set(roles)] as string[], pro, ipi, publisherName: str(p?.publisherName, `${n} publisher`, 160),
      compositionShare: num(p?.compositionShare, `${n} songwriting share`), masterShare: num(p?.masterShare, `${n} master share`), producerPoints: num(p?.producerPoints, `${n} producer points`) }
  })
  const total = (k: 'compositionShare' | 'masterShare' | 'producerPoints') => Math.round(parties.reduce((a, p) => a + p[k], 0) * 100) / 100
  const comp = total('compositionShare'), master = total('masterShare'), points = total('producerPoints')
  if (comp !== 100) throw new ServiceError(`Songwriting (composition) shares add up to ${comp}%. They must total exactly 100%.`)
  if (master !== 0 && master !== 100) throw new ServiceError(`Master ownership adds up to ${master}%. Leave it all at 0 (not covered here) or make it total 100%.`)
  if (points > 100) throw new ServiceError('Producer points cannot exceed 100 in total')
  const samples = String(b?.samples ?? 'none')
  if (!['none', 'cleared', 'uncleared', 'unsure'].includes(samples)) throw new ServiceError('samples must be none, cleared, uncleared or unsure')
  return { workTitle, releaseId: b?.releaseId ? String(b.releaseId).slice(0, 80) : null, isrc: b?.isrc ? String(b.isrc).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) : null, samples, notes: str(b?.notes, 'notes', 2000), parties }
}

/** Plain-English split sheet. Deterministic, so the same terms always hash the same. */
export function renderDocument(t: Terms, labelName: string, version: number) {
  const pct = (n: number) => `${n}%`
  const L: string[] = []
  L.push(`SONG SPLIT AGREEMENT (SPLIT SHEET)`, `Template ${TEMPLATE_VERSION} · Version ${version}`, '')
  L.push(`Song: "${t.workTitle}"${t.isrc ? `   ISRC: ${t.isrc}` : ''}`, `Prepared through: ${labelName} (Studio2U Label World)`, '')
  L.push('1. WHO WROTE AND MADE THIS SONG')
  t.parties.forEach((p, i) => {
    L.push(`  ${i + 1}. ${p.legalName}${p.stageName ? ` p/k/a "${p.stageName}"` : ''}`)
    L.push(`     Role(s): ${p.roles.join(', ')}${p.pro ? ` · PRO: ${p.pro}` : ''}${p.ipi ? ` · IPI: ${p.ipi}` : ''}${p.publisherName ? ` · Publisher: ${p.publisherName}` : ''}`)
  })
  L.push('', '2. SONGWRITING (COMPOSITION / PUBLISHING) SHARES - total 100%')
  for (const p of t.parties) if (p.compositionShare) L.push(`  ${p.legalName}: ${pct(p.compositionShare)}`)
  L.push('  These are each writer\'s shares of the musical work (lyrics and music). They are used for PRO')
  L.push('  registrations (ASCAP, BMI, etc.) and mechanical royalties (The MLC). Each writer registers')
  L.push('  their own share with their own PRO and publisher, if any.')
  const master = t.parties.filter(p => p.masterShare)
  L.push('', '3. MASTER RECORDING OWNERSHIP')
  if (master.length) { for (const p of master) L.push(`  ${p.legalName}: ${pct(p.masterShare)}`) }
  else L.push('  Not covered by this agreement. Master ownership is handled separately.')
  const pts = t.parties.filter(p => p.producerPoints)
  L.push('', '4. PRODUCER POINTS')
  if (pts.length) { for (const p of pts) L.push(`  ${p.legalName}: ${p.producerPoints} point(s)`); L.push('  Points are paid from the master side as agreed between the parties; they do not change songwriting shares.') }
  else L.push('  None.')
  L.push('', '5. SAMPLES AND BEATS')
  L.push({ none: '  The parties state this song contains no samples of other recordings or songs.', cleared: '  The parties state every sample in this song has been cleared in writing.', uncleared: '  WARNING: The parties state this song contains an UNCLEARED sample. It must be cleared or removed before release.', unsure: '  The parties are unsure whether this song contains samples. This must be resolved before release.' }[t.samples]!)
  L.push('  Anyone who supplied a beat confirms they own it or have the right to license it for this song.')
  L.push('', '6. GENERAL')
  L.push('  a. Each person confirms their contribution is original to them, except for any disclosed samples.')
  L.push('  b. These splits apply worldwide for the full life of the copyright, unless all parties sign a new version.')
  L.push('  c. Nobody may register this song with different splits than these. Any change requires a new version signed by everyone.')
  L.push('  d. Each person may register and collect their own share without needing the others\' signatures again.')
  L.push('  e. This agreement can be signed electronically, in counterparts, and an electronic copy is as valid as an original.')
  if (t.notes) L.push('', '7. ADDITIONAL TERMS', ...t.notes.split('\n').map(x => '  ' + x))
  L.push('', 'Signatures are recorded electronically below, each bound to this document\'s SHA-256 fingerprint.')
  return L.join('\n')
}

async function labelName(db: any, label: string) { return ((await db.prepare('SELECT name FROM lw_labels WHERE id=?').bind(label).first()) as any)?.name ?? 'Label' }

async function insertVersion(db: any, label: string, actor: number, t: Terms, familyId: string, version: number, by: string) {
  const doc = renderDocument(t, await labelName(db, label), version), hash = await sha256(doc), id = crypto.randomUUID()
  const links: { partyId: string; legalName: string; email: string; token: string }[] = []
  const stmts: any[] = [db.prepare('INSERT INTO lw_agreements(id,label_id,release_id,family_id,version,work_title,terms_json,doc_text,doc_hash,template_version,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, label, t.releaseId ?? null, familyId, version, t.workTitle, JSON.stringify(t), doc, hash, TEMPLATE_VERSION, actor)]
  for (const p of t.parties) {
    const token = newToken(), pid = crypto.randomUUID()
    links.push({ partyId: pid, legalName: p.legalName, email: p.email, token })
    stmts.push(db.prepare('INSERT INTO lw_agreement_parties(id,agreement_id,label_id,legal_name,stage_name,email,roles_json,pro,ipi,publisher_name,composition_share,master_share,producer_points,token_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(pid, id, label, p.legalName, p.stageName ?? null, p.email, JSON.stringify(p.roles), p.pro ?? null, p.ipi ?? null, p.publisherName ?? null, p.compositionShare, p.masterShare, p.producerPoints, await sha256(token)))
  }
  stmts.push(event(db, id, label, by, 'CREATED', `Version ${version} created with ${t.parties.length} signer(s). Fingerprint ${hash.slice(0, 16)}…`))
  await db.batch(stmts)
  return { id, links }
}
const withUrls = (origin: string, links: any[]) => links.map(l => ({ partyId: l.partyId, legalName: l.legalName, email: l.email, signUrl: `${origin}/label-world/sign/${l.token}` }))

export async function createAgreement(db: any, label: string, actor: number, b: any, origin: string, by = 'owner') {
  await requireEditor(db, label, actor)
  const t = validateTerms(b)
  if (t.releaseId && !await db.prepare('SELECT 1 FROM lw_releases WHERE label_id=? AND id=?').bind(label, t.releaseId).first()) throw new ServiceError('Release not found', 404)
  const { id, links } = await insertVersion(db, label, actor, t, crypto.randomUUID(), 1, by)
  return { agreement: await getAgreement(db, label, actor, id), signLinks: withUrls(origin, links), note: 'Send each person their own link. Links are shown once; you can make a new link for anyone later.' }
}

/** Material change: new version, old one SUPERSEDED, everybody signs again. */
export async function reviseAgreement(db: any, label: string, actor: number, id: string, b: any, origin: string, by = 'owner') {
  await requireEditor(db, label, actor)
  const a: any = await db.prepare('SELECT * FROM lw_agreements WHERE label_id=? AND id=?').bind(label, id).first()
  if (!a) throw new ServiceError('Agreement not found', 404)
  if (a.status === 'SUPERSEDED' || a.status === 'VOID') throw new ServiceError('Revise the latest version instead')
  const t = validateTerms({ ...JSON.parse(a.terms_json), ...b })
  const top: any = await db.prepare('SELECT MAX(version) AS v FROM lw_agreements WHERE family_id=?').bind(a.family_id).first()
  await db.batch([db.prepare("UPDATE lw_agreements SET status='SUPERSEDED' WHERE id=?").bind(id), event(db, id, label, by, 'SUPERSEDED', 'Replaced by a new version; signatures on this version do not carry over.')])
  const { id: nid, links } = await insertVersion(db, label, actor, t, a.family_id, (top?.v ?? a.version) + 1, by)
  return { agreement: await getAgreement(db, label, actor, nid), signLinks: withUrls(origin, links) }
}
export async function voidAgreement(db: any, label: string, actor: number, id: string, reason: string) {
  if ((await memberRole(db, label, actor)) !== 'owner') throw new ServiceError('Only the label owner can void an agreement', 403)
  const r = await db.prepare("UPDATE lw_agreements SET status='VOID' WHERE label_id=? AND id=? AND status IN ('OUT_FOR_SIGNATURE','DECLINED')").bind(label, id).run()
  if (!r.meta.changes) throw new ServiceError('Only unsigned or declined agreements can be voided', 409)
  await event(db, id, label, 'owner', 'VOIDED', String(reason ?? '').slice(0, 500) || 'Voided by owner').run()
  return { ok: true }
}
export async function newLink(db: any, label: string, actor: number, id: string, partyId: string, origin: string) {
  await requireEditor(db, label, actor)
  const p: any = await db.prepare("SELECT p.id,p.legal_name,p.email,p.signed_at FROM lw_agreement_parties p JOIN lw_agreements a ON a.id=p.agreement_id WHERE a.label_id=? AND a.id=? AND p.id=? AND a.status='OUT_FOR_SIGNATURE'").bind(label, id, partyId).first()
  if (!p) throw new ServiceError('Signer not found on an open agreement', 404)
  if (p.signed_at) throw new ServiceError('This person already signed', 409)
  const token = newToken()
  await db.batch([db.prepare('UPDATE lw_agreement_parties SET token_hash=? WHERE id=?').bind(await sha256(token), partyId), event(db, id, label, 'owner', 'LINK_REISSUED', `New signing link for ${p.legal_name}; the old link no longer works.`)])
  return { signUrl: `${origin}/label-world/sign/${token}`, legalName: p.legal_name, email: p.email }
}

const partyView = (p: any) => ({ id: p.id, legalName: p.legal_name, stageName: p.stage_name, email: p.email, roles: JSON.parse(p.roles_json || '[]'), pro: p.pro, ipi: p.ipi, compositionShare: p.composition_share, masterShare: p.master_share, producerPoints: p.producer_points,
  status: p.signed_at ? 'SIGNED' : p.declined_at ? 'DECLINED' : p.viewed_at ? 'VIEWED' : 'NOT_OPENED', signedAt: p.signed_at, declinedAt: p.declined_at, declineReason: p.decline_reason })
export async function getAgreement(db: any, label: string, actor: number, id: string) {
  if (!await memberRole(db, label, actor)) throw new ServiceError('Label not found', 404)
  const a: any = await db.prepare('SELECT * FROM lw_agreements WHERE label_id=? AND id=?').bind(label, id).first()
  if (!a) throw new ServiceError('Agreement not found', 404)
  const parties = (await db.prepare('SELECT * FROM lw_agreement_parties WHERE agreement_id=? ORDER BY rowid').bind(id).all()).results.map(partyView)
  const events = (await db.prepare('SELECT actor,kind,body,created_at FROM lw_agreement_events WHERE agreement_id=? ORDER BY cursor').bind(id).all()).results
  return { id: a.id, familyId: a.family_id, version: a.version, workTitle: a.work_title, releaseId: a.release_id, status: a.status, docHash: a.doc_hash, templateVersion: a.template_version, createdAt: a.created_at, completedAt: a.completed_at, terms: JSON.parse(a.terms_json), document: a.doc_text, parties, events }
}
export async function listAgreements(db: any, label: string, actor: number) {
  if (!await memberRole(db, label, actor)) throw new ServiceError('Label not found', 404)
  return (await db.prepare(`SELECT a.id,a.family_id,a.version,a.work_title,a.release_id,a.status,a.created_at,a.completed_at,
      (SELECT COUNT(*) FROM lw_agreement_parties p WHERE p.agreement_id=a.id) AS signers,
      (SELECT COUNT(*) FROM lw_agreement_parties p WHERE p.agreement_id=a.id AND p.signed_at IS NOT NULL) AS signed
    FROM lw_agreements a WHERE a.label_id=? AND a.status<>'SUPERSEDED' ORDER BY a.created_at DESC LIMIT 100`).bind(label).all()).results
}
/** Release gate used by lint and readiness: every split sheet linked to a release must be fully signed. */
export async function releaseAgreementStatus(db: any, label: string, release: string) {
  const rows = (await db.prepare("SELECT id,work_title,status FROM lw_agreements WHERE label_id=? AND release_id=? AND status NOT IN ('SUPERSEDED','VOID')").bind(label, release).all()).results as any[]
  return { total: rows.length, unsigned: rows.filter(r => r.status !== 'FULLY_SIGNED').map(r => ({ id: r.id, work: r.work_title, status: r.status })) }
}

// ---------------- public signing (no account) ----------------
async function byToken(db: any, token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null
  return db.prepare(`SELECT p.*, a.status AS a_status, a.work_title, a.doc_text, a.doc_hash, a.version, a.label_id AS a_label, a.completed_at, l.name AS label_name
    FROM lw_agreement_parties p JOIN lw_agreements a ON a.id=p.agreement_id JOIN lw_labels l ON l.id=a.label_id WHERE p.token_hash=?`).bind(await sha256(token)).first()
}
export async function signerView(db: any, token: string, ip: string | null) {
  const p: any = await byToken(db, token)
  if (!p) throw new ServiceError('This signing link is not valid. Ask the sender for a new one.', 404)
  if (!p.viewed_at) await db.batch([db.prepare('UPDATE lw_agreement_parties SET viewed_at=CURRENT_TIMESTAMP WHERE id=?').bind(p.id), event(db, p.agreement_id, p.a_label, p.legal_name, 'VIEWED', 'Opened the signing link', ip)])
  const all = (await db.prepare('SELECT legal_name,signed_at,declined_at FROM lw_agreement_parties WHERE agreement_id=? ORDER BY rowid').bind(p.agreement_id).all()).results as any[]
  return { party: { id: p.id, legalName: p.legal_name, emailHint: p.email.replace(/^(.).*(@.*)$/, '$1•••$2'), signedAt: p.signed_at, signatureName: p.signature_name, declinedAt: p.declined_at },
    agreement: { id: p.agreement_id, status: p.a_status, workTitle: p.work_title, version: p.version, labelName: p.label_name, document: p.doc_text, docHash: p.doc_hash, completedAt: p.completed_at },
    signers: all.map(s => ({ name: s.legal_name, status: s.signed_at ? 'SIGNED' : s.declined_at ? 'DECLINED' : 'WAITING' })) }
}
export async function signerAct(db: any, token: string, b: any, meta: { ip: string | null; ua: string | null }) {
  const p: any = await byToken(db, token)
  if (!p) throw new ServiceError('This signing link is not valid. Ask the sender for a new one.', 404)
  if (p.a_status !== 'OUT_FOR_SIGNATURE') throw new ServiceError(p.a_status === 'SUPERSEDED' ? 'This version was replaced. Ask the sender for the new link.' : `This agreement is ${p.a_status.toLowerCase().replace(/_/g, ' ')}.`, 409)
  if (p.signed_at || p.declined_at) throw new ServiceError('You already responded to this agreement.', 409)
  const email = String(b?.email ?? '').trim().toLowerCase()
  if (email !== p.email) throw new ServiceError('That email does not match the one this invite was sent to.', 403)
  if (b?.docHash !== p.doc_hash) throw new ServiceError('The document changed while you were reading. Reload and review it again.', 409)
  const ua = (meta.ua ?? '').slice(0, 300)
  if (b?.action === 'decline') {
    const reason = String(b?.reason ?? '').slice(0, 1000)
    await db.batch([
      db.prepare('UPDATE lw_agreement_parties SET declined_at=CURRENT_TIMESTAMP,decline_reason=?,sign_ip=?,sign_ua=? WHERE id=? AND signed_at IS NULL AND declined_at IS NULL').bind(reason || null, meta.ip, ua, p.id),
      db.prepare("UPDATE lw_agreements SET status='DECLINED' WHERE id=? AND status='OUT_FOR_SIGNATURE'").bind(p.agreement_id),
      event(db, p.agreement_id, p.a_label, p.legal_name, 'DECLINED', reason ? `Declined: ${reason}` : 'Declined without a reason', meta.ip)
    ])
    await notifyOwners(db, p.a_label, p.agreement_id, `${p.legal_name} declined the split sheet for "${p.work_title}"`, reason || 'No reason given. Talk it through, then send a new version.')
    return { status: 'DECLINED' }
  }
  if (b?.consent !== true) throw new ServiceError('Please agree to sign electronically first.')
  const sig = String(b?.signatureName ?? '').trim().replace(/\s+/g, ' ')
  if (sig.toLowerCase() !== p.legal_name.toLowerCase().replace(/\s+/g, ' ')) throw new ServiceError(`Type your full legal name exactly as shown: ${p.legal_name}`)
  const r = await db.prepare('UPDATE lw_agreement_parties SET consent_at=CURRENT_TIMESTAMP,signed_at=CURRENT_TIMESTAMP,signature_name=?,sign_ip=?,sign_ua=? WHERE id=? AND signed_at IS NULL AND declined_at IS NULL').bind(sig, meta.ip, ua, p.id).run()
  if (!r.meta.changes) throw new ServiceError('You already responded to this agreement.', 409)
  await db.batch([event(db, p.agreement_id, p.a_label, p.legal_name, 'CONSENTED', 'Agreed to do business electronically (ESIGN Act)', meta.ip), event(db, p.agreement_id, p.a_label, p.legal_name, 'SIGNED', `Signed as "${sig}" on fingerprint ${p.doc_hash.slice(0, 16)}…`, meta.ip)])
  const left: any = await db.prepare('SELECT COUNT(*) AS n FROM lw_agreement_parties WHERE agreement_id=? AND signed_at IS NULL').bind(p.agreement_id).first()
  if (!left.n) {
    const done = await db.prepare("UPDATE lw_agreements SET status='FULLY_SIGNED',completed_at=CURRENT_TIMESTAMP WHERE id=? AND status='OUT_FOR_SIGNATURE'").bind(p.agreement_id).run()
    if (done.meta.changes) { await event(db, p.agreement_id, p.a_label, 'system', 'COMPLETED', 'Everyone signed. Agreement is fully executed.').run(); await notifyOwners(db, p.a_label, p.agreement_id, `Split sheet fully signed: "${p.work_title}"`, 'Everyone signed. Download the signed copy, then register the song with these splits.') }
    return { status: 'FULLY_SIGNED' }
  }
  return { status: 'SIGNED', waitingOn: left.n }
}
async function notifyOwners(db: any, label: string, agreement: string, title: string, body: string) {
  const { notify } = await import('./engine')
  await notify(db, { label, kind: 'AGREEMENT', title, body, link: '/label-world/money#agreements', dedupe: `agr:${agreement}:${title.slice(0, 40)}` })
}

/** Signed copy: the exact document plus an audit certificate. */
export async function signedCopy(db: any, agreementId: string, maskEmails = false) {
  const em = (e: string) => maskEmails ? e.replace(/^(.).*(@.*)$/, '$1•••$2') : e
  const a: any = await db.prepare('SELECT * FROM lw_agreements WHERE id=?').bind(agreementId).first()
  if (!a) throw new ServiceError('Agreement not found', 404)
  const parties = (await db.prepare('SELECT * FROM lw_agreement_parties WHERE agreement_id=? ORDER BY rowid').bind(agreementId).all()).results as any[]
  const events = (await db.prepare('SELECT actor,kind,body,ip,created_at FROM lw_agreement_events WHERE agreement_id=? ORDER BY cursor').bind(agreementId).all()).results as any[]
  const L = [a.doc_text, '', '='.repeat(72), 'SIGNATURES', '='.repeat(72)]
  for (const p of parties) L.push(p.signed_at ? `/s/ ${p.signature_name}   (${p.legal_name}, ${em(p.email)})   signed ${p.signed_at} UTC` : p.declined_at ? `DECLINED  ${p.legal_name} (${em(p.email)}) on ${p.declined_at} UTC` : `[not signed yet]  ${p.legal_name} (${em(p.email)})`)
  L.push('', '='.repeat(72), 'AUDIT CERTIFICATE', '='.repeat(72), `Agreement ID: ${a.id}`, `Version: ${a.version}   Template: ${a.template_version}`, `Status: ${a.status}${a.completed_at ? `   Completed: ${a.completed_at} UTC` : ''}`, `Document SHA-256: ${a.doc_hash}`, '')
  for (const e of events) L.push(`${e.created_at} UTC  ${e.kind.padEnd(13)} ${e.actor}${e.ip ? ` [${e.ip}]` : ''}  ${e.body}`)
  for (const p of parties) if (p.signed_at) L.push('', `Signer record - ${p.legal_name}: consent ${p.consent_at} UTC, IP ${p.sign_ip ?? 'n/a'}, device ${p.sign_ua ?? 'n/a'}`)
  L.push('', 'Recompute the SHA-256 of the document text above (everything before the SIGNATURES line, without the trailing newline) to confirm it was not changed.', 'Generated by Studio2U Label World. Record-keeping tool, not legal advice.')
  return { filename: `${a.work_title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'split-sheet'}-v${a.version}-${a.status === 'FULLY_SIGNED' ? 'signed' : 'draft'}.txt`, text: L.join('\n') }
}
export async function signedCopyForToken(db: any, token: string) { const p: any = await byToken(db, token); if (!p) throw new ServiceError('This signing link is not valid.', 404); return signedCopy(db, p.agreement_id, true) }
export async function signedCopyForLabel(db: any, label: string, actor: number, id: string) { await getAgreement(db, label, actor, id); return signedCopy(db, id) }

// ---------------- attorney agent: deterministic pre-check ----------------
/** Fast, free checks the attorney agent starts from. The model adds judgment on top. */
export function attorneyPrecheck(t: Terms) {
  const flags: { level: 'STOP' | 'FIX' | 'ASK'; issue: string; why: string }[] = []
  if (t.samples === 'uncleared') flags.push({ level: 'STOP', issue: 'Uncleared sample', why: 'Releasing with an uncleared sample risks a takedown and the sample owner can claim the song. Clear it or replace it first.' })
  if (t.samples === 'unsure') flags.push({ level: 'ASK', issue: 'Unknown sample status', why: 'Confirm with the producer whether anything was sampled or interpolated, including loops from packs (check the pack license).' })
  for (const p of t.parties) {
    if (p.compositionShare > 0 && !p.pro) flags.push({ level: 'FIX', issue: `${p.legalName} has a writer share but no PRO`, why: 'Their performance royalties have nowhere to go until they join a PRO (ASCAP, BMI, etc.). Ask which one, or help them join.' })
    if (p.compositionShare > 0 && p.pro && p.pro !== 'NONE' && !p.ipi) flags.push({ level: 'FIX', issue: `${p.legalName} is missing an IPI number`, why: 'PROs and The MLC match writers by IPI. Missing IPIs are a top reason money goes unmatched.' })
    if (p.roles.includes('producer') && p.compositionShare === 0 && p.producerPoints === 0 && p.masterShare === 0) flags.push({ level: 'ASK', issue: `Producer ${p.legalName} gets nothing on this sheet`, why: 'If they made the beat, confirm that is intentional and that a beat lease/sale covers it (beat-ownership playbook).' })
    if (p.producerPoints > 0 && !t.parties.some(x => x.masterShare > 0)) flags.push({ level: 'ASK', issue: `${p.legalName} has producer points but master ownership isn't covered`, why: 'Points are paid from master income. Note who owns the master so it is clear who pays the points.' })
  }
  if (t.parties.length === 1) flags.push({ level: 'ASK', issue: 'Only one person listed', why: 'Confirm nobody else wrote lyrics, a melody, or the beat. A missing co-writer can later dispute the registration.' })
  return { flags, disclaimer: 'Automated checklist from the attorney agent. Not legal advice and not a substitute for a licensed attorney.' }
}
