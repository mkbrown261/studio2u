// Today: the one screen. What needs you (one tap each), what your team did, what is stuck,
// whether the team is running, and phone alerts so you never have to check.
import React, {useEffect, useState} from 'react'
import {api, chime, Badge, Button} from './ui'
import {TeamPanel} from './ReleaseTools'

type N = (s: string) => void
const when = (t: string) => { const d = new Date(String(t).replace(' ', 'T') + (/Z$/.test(t) ? '' : 'Z')); return isNaN(+d) ? '' : d.toLocaleString([], {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}) }
const VERB: Record<string, string> = {SUBMIT: 'Submit', PUBLISH: 'Publish', POST: 'Post', SELL: 'Sell', SEND: 'Send', SPEND: 'Spend', DELETE: 'Delete', OTHER: 'Do'}

export function Today({labelId, role, notify, onOpen}: {labelId: string, role: string, notify: N, onOpen: (where: 'money' | 'partner' | 'builder' | 'executive', hash?: string) => void}) {
  const [d, setD] = useState<any>(null), [busy, setBusy] = useState<string | null>(null), [answers, setAnswers] = useState<Record<string, string>>({})
  const load = () => labelId ? api(`/labels/${labelId}/today`).then(setD).catch(e => notify((e as Error).message)) : Promise.resolve()
  useEffect(() => { setD(null); load(); if (labelId) api(`/labels/${labelId}/today/seen`, {}).catch(() => {}) }, [labelId])
  async function act(key: string, path: string, body: unknown, ok?: string) {
    setBusy(key)
    try { const r = await api(`/labels/${labelId}/${path}`, body); notify(r?.say ?? ok ?? 'Done.'); chime(); await load() }
    catch (e) { notify((e as Error).message) } finally { setBusy(null) }
  }
  if (!labelId) return <p className="lw-muted">Choose a label workspace at the top first.</p>
  if (!d) return <p className="lw-muted">Loading today…</p>
  const owner = d.role === 'owner', editor = d.role !== 'viewer', n = d.needs

  return <div className="lw-today">
    <div className={`lw-today-head ${d.needsYou ? 'needs' : ''}`}><h3>{d.headline}</h3>
      <div className="lw-tag-row"><Badge tone="cyan">{d.numbers.songs} songs</Badge><Badge>${Number(d.numbers.verifiedEarnedUsd || 0).toLocaleString()} verified earnings</Badge>{d.team && <Badge tone={d.team.state === 'WORKING' ? 'cyan' : ['STALLED', 'NEVER_RAN', 'NOT_CONNECTED'].includes(d.team.state) ? 'red' : 'gold'}>Team: {d.team.state.replace(/_/g, ' ').toLowerCase()}</Badge>}</div>
    </div>

    {d.needsYou > 0 && <section className="lw-today-block"><h4>Needs you</h4>
      {n.checkpoints.map((c: any) => <div key={c.id} className="lw-today-item">
        <div><Badge tone="gold">{VERB[c.kind] ?? c.kind}</Badge> <b>{c.title}</b>{c.site && <small> · {c.site}</small>}{c.amountUsd != null && <small> · ${c.amountUsd.toFixed(2)}</small>}{c.detail && <p>{c.detail}</p>}{c.previewUrl && <a href={c.previewUrl} target="_blank" rel="noreferrer noopener">Look first</a>}</div>
        {owner ? <div className="lw-partner-row"><Button gold disabled={!!busy} onClick={() => act('c' + c.id, `checkpoints/${c.id}/decision`, {decision: 'APPROVED'})}>Yes, do it</Button><Button disabled={!!busy} onClick={() => act('c' + c.id, `checkpoints/${c.id}/decision`, {decision: 'DENIED'})}>No</Button></div> : <small className="lw-muted">The owner answers this.</small>}
      </div>)}
      {n.questions.map((q: any) => <div key={q.taskId} className="lw-today-item column">
        <div><Badge tone="gold">Question</Badge> <b>{q.title}</b><ol>{q.questions.map((x: string) => <li key={x}>{x}</li>)}</ol></div>
        {editor && <div className="lw-partner-row"><textarea rows={2} maxLength={4000} placeholder="Answer in your own words" value={answers[q.taskId] ?? ''} onChange={e => setAnswers({...answers, [q.taskId]: e.target.value})}/><Button gold disabled={!!busy || !(answers[q.taskId] ?? '').trim()} onClick={() => act('q' + q.taskId, `tasks/${q.taskId}/answer`, {answer: answers[q.taskId]})}>Send</Button></div>}
      </div>)}
      {n.profiles.map((l: any) => <div key={l.id} className="lw-today-item">
        <div><Badge tone="gold">Is this you?</Badge> <b>{l.platform.replace('_', ' ')}</b> <a href={l.url} target="_blank" rel="noreferrer noopener">{l.url.replace(/^https:\/\//, '').slice(0, 60)}</a>{l.evidence && <p>{l.evidence}</p>}{l.fillsCatalog && <small className="lw-muted">“That's me” also adds its songs to your catalog right away.</small>}</div>
        {editor && <div className="lw-partner-row"><Button gold disabled={!!busy} onClick={() => act('l' + l.id, `know-me/links/${l.id}`, {decision: 'CONFIRMED'})}>That's me</Button><Button disabled={!!busy} onClick={() => act('l' + l.id, `know-me/links/${l.id}`, {decision: 'NOT_ME'})}>Not me</Button></div>}
      </div>)}
      {n.plans.map((p: any) => <div key={p.id} className="lw-today-item">
        <div><Badge tone="gold">Week plan</Badge> <b>{p.posts} posts for the week of {p.weekStart}</b><p>Approve once and Ben posts them through the week.</p></div>
        {owner ? <div className="lw-partner-row"><Button gold disabled={!!busy} onClick={() => act('p' + p.id, `partner/plans/${p.id}/decision`, {decision: 'APPROVED'})}>Approve the week</Button><Button disabled={!!busy} onClick={() => onOpen('partner')}>Look first</Button></div> : <Button onClick={() => onOpen('partner')}>Open</Button>}
      </div>)}
      {n.drafts.map((x: any) => <div key={x.id} className="lw-today-item">
        <div><Badge tone="gold">{x.kind === 'EMAIL' ? 'Email' : x.kind.toLowerCase()}</Badge> <b>{x.subject || x.caseTitle}</b>{x.to && <small> · to {x.to}</small>}<p>Draft for “{x.caseTitle}”. Read it before it goes out.</p></div>
        <Button disabled={!!busy} onClick={() => onOpen('money', '#cases')}>Read and approve</Button>
      </div>)}
      {n.designs.length > 0 && <div className="lw-today-item">
        <div><Badge tone="gold">Merch</Badge> <b>{n.designs.length} new design{n.designs.length === 1 ? '' : 's'} to look at</b><p>{n.designs.map((x: any) => x.title).join(', ')}</p></div>
        <Button disabled={!!busy} onClick={() => onOpen('money', '#merch')}>Look at them</Button>
      </div>}
    </section>}

    {d.stuck.length > 0 && <section className="lw-today-block"><h4>Stuck</h4>{d.stuck.map((t: any) => <div key={t.id} className="lw-today-item"><div><Badge tone="red">{t.status.toLowerCase()}</Badge> <b>{t.title}</b>{t.why && <p>{t.why}</p>}<small className="lw-muted">{when(t.at)}</small></div></div>)}</section>}

    <section className="lw-today-block"><h4>What your team did (last 7 days)</h4>
      {!d.done.length && !d.decided.length ? <p className="lw-muted">Nothing finished yet. {d.queued.length ? `${d.queued.length} job(s) are waiting for the next shift.` : ''}</p> : <>
        {d.done.map((t: any) => <div key={t.id} className="lw-today-item"><div><Badge tone="cyan">done</Badge> <b>{t.title}</b>{t.summary && <p>{t.summary}</p>}<small className="lw-muted">{when(t.at)}</small></div></div>)}
        {d.decided.map((c: any, i: number) => <div key={i} className="lw-today-item"><div><Badge tone={c.status === 'APPROVED' ? 'cyan' : 'muted'}>{c.status === 'APPROVED' ? 'you said yes' : 'you said no'}</Badge> {c.title}<small className="lw-muted"> · {when(c.decided_at)}</small></div></div>)}
      </>}
      {d.queued.length > 0 && <details><summary>Up next ({d.queued.length})</summary><ul>{d.queued.map((t: any, i: number) => <li key={i}>{t.title}</li>)}</ul></details>}
    </section>

    {d.team && ['STALLED', 'NEVER_RAN', 'NOT_CONNECTED', 'IDLE'].includes(d.team.state) && <section className="lw-today-block"><h4>Keep your team running</h4><TeamPanel labelId={labelId} role={d.role} notify={notify}/></section>}
    <section className="lw-today-block"><h4>Phone alerts</h4><AlertsPanel notify={notify}/></section>
  </div>
}

/** Phone push (ntfy) when your team needs you. Per person, not per label. */
export function AlertsPanel({notify}: {notify: N}) {
  const [a, setA] = useState<any>(null), [busy, setBusy] = useState(false)
  const load = () => api('/alerts').then(setA).catch(() => setA(null))
  useEffect(() => { load() }, [])
  if (!a) return null
  async function set(b: any, ok: string) { setBusy(true); try { setA(await api('/alerts', b)); notify(ok); chime() } catch (e) { notify((e as Error).message) } finally { setBusy(false) } }
  async function test() { setBusy(true); try { notify((await api('/alerts/test', {})).say) } catch (e) { notify((e as Error).message) } finally { setBusy(false) } }
  return <div className="lw-release-tool">
    <small className="lw-muted">Get a ping on your phone only when your team needs you: an approval, a question, or the team stalled. The alert never shows song names or details, just "your team needs you".</small>
    {!a.push ? <div className="lw-partner-row"><Button gold disabled={busy} onClick={() => set({push: true}, 'Phone alerts on. Now subscribe in the ntfy app.')}>Turn on phone alerts</Button></div> : <>
      <ol className="lw-needs-list">
        <li>Install the free <b>ntfy</b> app (iPhone or Android).</li>
        <li>Tap +, then subscribe to this private topic: <code className="lw-copy">{a.topic}</code> <Button onClick={() => navigator.clipboard.writeText(a.topic).then(() => notify('Topic copied.'), () => notify('Select the topic and copy it.'))}>Copy</Button></li>
        <li><Button disabled={busy} onClick={test}>Send a test</Button></li>
      </ol>
      <small className="lw-muted">Keep the topic private. Turning alerts off and on again makes a new one.</small>
      <div className="lw-partner-row"><Button disabled={busy} onClick={() => set({push: false}, 'Phone alerts off.')}>Turn off</Button></div>
    </>}
    {a.emailAvailable && <label className="lw-inline"><input type="checkbox" checked={a.email} disabled={busy} onChange={e => set({email: e.target.checked}, e.target.checked ? 'Email alerts on.' : 'Email alerts off.')}/> Also email me</label>}
  </div>
}
