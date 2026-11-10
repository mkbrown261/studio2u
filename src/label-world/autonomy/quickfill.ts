// Fill the label right away, without waiting for an agent shift:
//  * "That's me" on an Apple Music / Deezer profile -> its songs are imported on the spot
//    (free public catalogs, no AI tokens). Songs where the artist is featured are included.
//  * The owner answers an agent's questions from Today; the task goes straight back in line.
//  * Old jobs nobody is coming back to are closed so the queue stays honest.
import { ServiceError, requireEditor } from './service'
import type { Fetcher } from './cases'

const PROFILE = {
  apple_music: { source: 'itunes', id: (u: string) => /\/artist\/(?:[^/]+\/)?(\d{5,15})/.exec(u)?.[1] ?? null },
  deezer: { source: 'deezer', id: (u: string) => /deezer\.com\/(?:[a-z]{2}\/)?artist\/(\d{1,15})/.exec(u)?.[1] ?? null }
} as const

/** Import the songs behind one confirmed profile link. Returns null when the link is not a catalog profile. */
export async function fillFromLink(db: any, label: string, actor: number, link: { platform: string; url: string }, fetcher?: Fetcher) {
  const p = PROFILE[link.platform as keyof typeof PROFILE]
  const artistId = p?.id(String(link.url))
  if (!p || !artistId) return null
  const cases = await import('./cases')
  const tracks = await cases.artistTracks(p.source, artistId, fetcher).catch(() => [] as any[])
  if (!tracks.length) return { added: 0, songs: (await cases.catalogSummary(db, label)).songs, say: 'That profile has no songs we can read yet.' }
  const r = await cases.importTracks(db, label, actor, tracks.slice(0, 400))
  if (p.source === 'itunes') await db.prepare('UPDATE lw_label_identity SET apple_artist_id=COALESCE(apple_artist_id,?) WHERE label_id=?').bind(artistId, label).run()
  return { added: r.added, songs: r.songs, say: r.added ? `Added ${r.added} song${r.added === 1 ? '' : 's'} from that profile. Your catalog has ${r.songs} now.` : `Your catalog already had those songs (${r.songs} total).` }
}

/** Website "That's me / Not me" with the catalog filled in the same tap. */
export async function decideAndFill(db: any, label: string, actor: number, id: string, decision: string, fetcher?: Fetcher) {
  const know = await import('./discovery')
  const res = await know.decideLink(db, label, actor, id, decision)
  if (decision !== 'CONFIRMED') return { ...res, catalog: null }
  const l: any = await db.prepare('SELECT platform,url FROM lw_artist_links WHERE label_id=? AND id=?').bind(label, id).first()
  const catalog = l ? await fillFromLink(db, label, actor, l, fetcher).catch(() => null) : null
  return { ...res, catalog, say: catalog?.say ?? 'Saved.' }
}

/** The owner answers the questions an agent left (WAITING_FOR_INPUT); the task comes back now. */
export async function answerTask(db: any, label: string, actor: number, taskId: string, b: any) {
  await requireEditor(db, label, actor)
  const answer = typeof b?.answer === 'string' ? b.answer.trim() : ''
  if (!answer || answer.length > 4000) throw new ServiceError('Type your answer (up to 4000 characters).')
  if (/\b(password|passcode|ssn|social security|routing number|card number|cvv)\b/i.test(answer)) throw new ServiceError('Never type passwords, tax IDs or bank/card details here. Your agent will ask you to enter those on the official site yourself.')
  const t: any = await db.prepare(`SELECT id,input_json,result_json FROM lw_tasks WHERE label_id=? AND id=? AND status='QUEUED'`).bind(label, taskId).first()
  if (!t) throw new ServiceError('That question was already answered or the job is finished.', 409)
  let prev: any = {}; try { prev = JSON.parse(t.result_json || '{}') } catch { prev = {} }
  if (prev.outcome !== 'WAITING_FOR_INPUT') throw new ServiceError('That job is not waiting for an answer.', 409)
  await db.batch([
    db.prepare(`UPDATE lw_tasks SET input_json=json_set(input_json,'$.ownerAnswer',?,'$.ownerAnswerTo',json(?)),result_json=json_set(result_json,'$.outcome','ANSWERED'),run_after=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(answer, JSON.stringify(prev.questions ?? []), t.id),
    db.prepare('INSERT INTO lw_task_events(label_id,task_id,status,payload_json) VALUES (?,?,?,?)').bind(label, t.id, 'ANSWERED', JSON.stringify({ by: 'owner' })),
    db.prepare("UPDATE lw_notifications SET read_at=CURRENT_TIMESTAMP WHERE label_id=? AND kind='QUESTIONS' AND read_at IS NULL").bind(label)
  ])
  return { answered: true, say: 'Got it. Your team picks this back up on its next run.' }
}

/** Engine: close jobs nobody will come back to, so "waiting" means something. */
export async function sweepStale(db: any, labelIds?: string[]) {
  const scope = [labelIds ? 1 : null, JSON.stringify(labelIds ?? [])]
  const old = await db.prepare(`UPDATE lw_tasks SET status='CANCELLED',result_json=json_object('outcome','EXPIRED','summary','No one picked this up in 30 days; it is queued again if it is still needed.'),updated_at=CURRENT_TIMESTAMP
    WHERE status='QUEUED' AND kind<>'GENERIC' AND created_at<datetime('now','-30 days') AND (? IS NULL OR label_id IN (SELECT value FROM json_each(?)))`).bind(...scope).run()
  const orphan = await db.prepare(`UPDATE lw_tasks SET status='CANCELLED',result_json=json_object('outcome','CANCELLED','summary','The owner answered No or the question expired.'),updated_at=CURRENT_TIMESTAMP
    WHERE status='QUEUED' AND json_extract(input_json,'$.checkpointId') IS NOT NULL AND json_extract(input_json,'$.checkpointId') IN (SELECT id FROM lw_checkpoints WHERE status IN ('EXPIRED','CANCELLED'))
      AND (? IS NULL OR label_id IN (SELECT value FROM json_each(?)))`).bind(...scope).run()
  return { expired: old.meta.changes, orphaned: orphan.meta.changes }
}
