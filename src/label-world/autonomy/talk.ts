// Talk, don't fill forms. The owner says what happened in their own words; we open (or
// continue) the case, fill every box we can from what they said plus free public lookups,
// and answer IN THE SAME CHAT BOX with what we figured out and the one or two things we
// still need. No AI tokens are spent on this.
import { ServiceError, requireEditor } from './service'
import { openCase, updateCase } from './cases'
import { understand, sayUnderstood, type Fetcher } from './understand'
import { suggestPlaybooks, playbookById, playbookScore } from './playbooks'

const AGENTS = ['researcher', 'reviewer', 'executive', 'builder', 'partner']
/** Money/rights problems become cases automatically. Creative/advice playbooks stay a normal chat. */
export const CASE_PLAYBOOKS = ['tv-cue-sheet', 'register-songs', 'soundexchange-money', 'unpaid-split', 'name-dispute', 'beat-ownership', 'mlc-mechanicals', 'bmi-registration', 'split-sheet', 'merch-drop']

export function caseTitle(playbook: string, f: Record<string, any>) {
  const pb = playbookById(playbook)
  if (playbook === 'tv-cue-sheet' && (f.songTitle || f.show)) {
    const ep = typeof f.episode === 'string' ? /Season (\d+), Episode (\d+)/.exec(f.episode) : null
    return `${f.songTitle ? `"${f.songTitle}"` : 'My song'} on ${f.show ?? 'TV'}${ep ? ` (S${ep[1]}E${ep[2]})` : ''}`.slice(0, 200)
  }
  return (pb?.name ?? 'Case').slice(0, 200)
}

export async function talk(db: any, label: string, actor: number, b: any, fetcher?: Fetcher) {
  await requireEditor(db, label, actor)
  const text = typeof b?.text === 'string' ? b.text.trim() : ''
  if (!text || text.length > 4000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new ServiceError('Say what happened (up to 4000 characters).')
  const agent = AGENTS.includes(b?.agent) ? b.agent : null
  // Settings in plain words ("sell on Fourthwall", "my instagram is @me", "autopilot on", "stop").
  if (!b?.caseId || /^\s*(stop|resume)\b/i.test(text)) {
    const { ownerCommand } = await import('./commands')
    const cmd = await ownerCommand(db, label, actor, text)
    if (cmd) {
      if (agent) {
        const uid = crypto.randomUUID()
        await db.batch([
          db.prepare("INSERT INTO lw_employee_messages(id,label_id,user_id,agent_id,role,content,status) VALUES (?,?,?,?,'user',?,'COMPLETED')").bind(uid, label, actor, agent, text),
          db.prepare("INSERT INTO lw_employee_messages(id,label_id,user_id,agent_id,role,content,status,reply_to,provider,model) VALUES (?,?,?,?,'assistant',?,'COMPLETED',?,'studio2u','command')").bind(crypto.randomUUID(), label, actor, agent, cmd.reply, uid)
        ])
      }
      return { handled: true, command: true, did: cmd.did, caseId: null, opened: false, reused: false, case: null, reply: cmd.reply, found: [], ask: [], confirm: [], options: null, done: true }
    }
  }
  const tracks = (await db.prepare(`SELECT title,work_json FROM lw_catalog_tracks WHERE label_id=? AND pro_status<>'NOT_MINE' LIMIT 400`).bind(label).all()).results as any[]
  const idr: any = await db.prepare('SELECT artist_name,legal_name,pro FROM lw_label_identity WHERE label_id=?').bind(label).first()
  const me = {
    name: idr?.legal_name ?? idr?.artist_name ?? 'Me', pro: idr?.pro ?? null,
    writersFor: (t: string) => {
      const r = tracks.find(x => String(x.title).toLowerCase() === t.toLowerCase()); let w: any[] = []
      try { w = JSON.parse(r?.work_json || '{}').writers ?? [] } catch { /* none */ }
      return w.length ? w.map((x: any) => `${x.legalName} ${x.split}%${x.pro ? ` (${x.pro})` : ''}`).join(', ') : null
    }
  }
  let caseRow: any = null
  if (b?.caseId) {
    caseRow = await db.prepare('SELECT * FROM lw_cases WHERE label_id=? AND id=?').bind(label, String(b.caseId)).first()
    if (!caseRow) throw new ServiceError('Case not found', 404)
    if (['RESOLVED', 'CLOSED'].includes(caseRow.status)) caseRow = null
  }
  const guess = suggestPlaybooks(text, 1)[0]?.id ?? null
  // Talking about a different problem while answering a case = a new case.
  if (caseRow && guess && guess !== caseRow.playbook && CASE_PLAYBOOKS.includes(guess) && text.length > 40) caseRow = null
  const asked = typeof b?.playbook === 'string' && playbookById(b.playbook) ? b.playbook : null
  // Only open a case on its own when the message clearly describes that problem (casual chat stays chat).
  const strong = guess != null && CASE_PLAYBOOKS.includes(guess) && (playbookScore(text, guess) >= 3 || (playbookScore(text, guess) >= 2 && /(never (got )?paid|not paid|didn'?t get paid|no money|owe[sd]? me|register|unregistered|claim|split|stole|using my name|sell|merch|shirt)/i.test(text)))
  const playbook: string | null = caseRow?.playbook ?? asked ?? (strong ? guess : null)
  if (!playbook) return { handled: false, suggested: suggestPlaybooks(text, 2) }

  const u = await understand(text, { playbook, facts: caseRow ? JSON.parse(caseRow.facts_json || '{}') : undefined, titles: tracks.map(t => t.title), me, fetcher })
  let detail: any, opened: { title: string; deadline: string | null; deadlineNote: string | null; reused?: boolean } | null = null
  if (caseRow) {
    const merged = { ...JSON.parse(caseRow.facts_json || '{}'), ...u.facts }
    detail = await updateCase(db, label, actor, caseRow.id, { facts: u.facts, note: `Owner said: "${text.slice(0, 300)}"${u.found.length ? ` → filled ${u.found.map(f => f.label).join(', ')}` : ''}` }, 'owner')
    if (caseRow.title === playbookById(caseRow.playbook)?.name || /^"?My song"? on TV/.test(caseRow.title)) {
      const t = caseTitle(caseRow.playbook, merged); if (t !== caseRow.title) await db.prepare('UPDATE lw_cases SET title=? WHERE id=?').bind(t, caseRow.id).run()
    }
  } else {
    detail = await openCase(db, label, actor, { playbook, title: caseTitle(playbook, u.facts), facts: u.facts }, 'owner')
    opened = { title: detail.case.title, deadline: detail.case.deadline, deadlineNote: detail.case.deadlineNote, reused: Boolean(detail.reused) }
  }
  const reply = sayUnderstood(u, opened ?? (detail.case.deadline && u.found.some(f => f.key === 'airDate') ? { title: detail.case.title, deadline: detail.case.deadline, deadlineNote: null, reused: true } : null))
  if (agent) {
    const uid = crypto.randomUUID()
    await db.batch([
      db.prepare("INSERT INTO lw_employee_messages(id,label_id,user_id,agent_id,role,content,status) VALUES (?,?,?,?,'user',?,'COMPLETED')").bind(uid, label, actor, agent, text),
      db.prepare("INSERT INTO lw_employee_messages(id,label_id,user_id,agent_id,role,content,status,reply_to,provider,model) VALUES (?,?,?,?,'assistant',?,'COMPLETED',?,'studio2u','case-intake')").bind(crypto.randomUUID(), label, actor, agent, reply, uid)
    ])
  }
  const fresh = detail.case
  return { handled: true, caseId: fresh.id, opened: !caseRow && !detail.reused, reused: Boolean(detail.reused), case: { id: fresh.id, title: fresh.title, status: fresh.status, deadline: fresh.deadline }, reply, found: u.found, ask: u.ask, confirm: u.confirm, options: u.options ?? null, done: !u.ask.length && !u.confirm.length }
}
