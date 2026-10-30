// Business Partner workspace: the money desk. Approve the week once, autopilot runs it,
// Stop pauses everything. Accounts are created by the owner and handed over with a handle.
import React, {useEffect, useState} from 'react'
import {api, chime, Badge, Button, Panel, Icon} from './ui'
import type {WorkspaceProps} from './workspaces'

const day = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC'})

export function PartnerWorkspace(p: WorkspaceProps) {
  const [d, setD] = useState<any>(null), [busy, setBusy] = useState<string | null>(null), [handles, setHandles] = useState<Record<string, string>>({}), [edits, setEdits] = useState<Record<string, {caption?: string, skip?: boolean}>>({}), [cap, setCap] = useState('')
  const base = `/labels/${p.labelId}/partner`
  const load = () => p.labelId ? api(base).then(x => { setD(x); setCap(String((x.settings.spendCapCents ?? 0) / 100)) }).catch(e => p.notify(e.message)) : Promise.resolve()
  useEffect(() => { setD(null); setEdits({}); load() }, [p.labelId])
  async function run(key: string, fn: () => Promise<any>, ok?: string) { setBusy(key); try { const r = await fn(); if (ok || r?.say) { p.notify(ok ?? r.say); chime() } await load(); return r } catch (e) { p.notify((e as Error).message) } finally { setBusy(null) } }
  if (!p.labelId) return <Panel title="Business Partner" icon="wallet"><p className="lw-muted">Choose a label workspace at the top first.</p></Panel>
  if (!d) return <p className="lw-muted">Loading the money desk…</p>
  const owner = d.role === 'owner', editor = d.role !== 'viewer', s = d.settings, plan = d.plan
  const ready = d.channels.filter((c: any) => c.status === 'READY')

  return <div className="lw-partner">
    <div className="lw-agent-heading"><div className="lw-avatar large gold"><Icon name="wallet" size={36}/></div><div><h1>Business Partner <Badge tone={s.autopilot === 'ON' ? 'cyan' : s.autopilot === 'PAUSED' ? 'red' : 'muted'}>Autopilot {s.autopilot}</Badge></h1><h2>Merch · Campaigns · Money</h2><p>You approve the week once. He posts it day by day from your own logged-in browser. Stop pauses everything.</p></div></div>

    <Panel title="Autopilot" icon="flag" className="lw-partner-controls">
      <div className="lw-partner-row">
        {owner && s.autopilot !== 'ON' && <Button gold disabled={busy === 'on' || !ready.length} onClick={() => run('on', () => api(`${base}/settings`, {autopilot: 'ON'}), 'Autopilot is on. He posts only what you approved.')}>Turn autopilot on</Button>}
        {owner && s.autopilot === 'ON' && <Button disabled={busy === 'off'} onClick={() => run('off', () => api(`${base}/settings`, {autopilot: 'OFF'}), 'Autopilot off.')}>Turn off</Button>}
        {editor && s.autopilot !== 'PAUSED' && <button className="lw-stop" disabled={busy === 'stop'} onClick={() => run('stop', () => api(`${base}/stop`, {}))}>STOP everything</button>}
        <span className="lw-muted">This week: {d.week.posted} posted · {d.week.planned} planned{d.week.failed ? ` · ${d.week.failed} failed` : ''}</span>
      </div>
      {!ready.length && <p className="lw-muted">Hand him at least one account below before turning autopilot on.</p>}
      {owner && <div className="lw-partner-row">
        <label>Monthly spend cap ($)<input type="number" min={0} max={5000} value={cap} onChange={e => setCap(e.target.value)} style={{width: 90}}/></label>
        <label>Posts per day per account<select value={s.postsPerDay} onChange={e => run('ppd', () => api(`${base}/settings`, {postsPerDay: Number(e.target.value)}))}>{[0, 1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
        <label>Daily check-in hour<select value={s.checkinHour} onChange={e => run('hour', () => api(`${base}/settings`, {checkinHour: Number(e.target.value)}))}>{Array.from({length: 24}, (_, h) => <option key={h} value={h}>{h}:00</option>)}</select></label>
        <Button disabled={busy === 'cap'} onClick={() => run('cap', () => api(`${base}/settings`, {spendCapUsd: Number(cap)}), 'Spend cap saved.')}>Save cap</Button>
      </div>}
      <ul className="lw-partner-rules">{d.rules.map((r: string) => <li key={r}>{r}</li>)}</ul>
    </Panel>

    <Panel title="This week's plan" icon="calendar" action={editor && <Button disabled={busy === 'draft' || !ready.length} onClick={() => run('draft', () => api(`${base}/plans`, {}), 'Draft ready. Look it over and approve once.')}>{plan ? 'Draft a new one' : 'Draft my week'}</Button>}>
      {!plan ? <p className="lw-muted">{ready.length ? 'No plan yet. Tap "Draft my week".' : 'Add an account first, then he drafts your week.'}</p> : <>
        <p className="lw-muted">Week of {day(plan.plan.week_start)} · <Badge tone={plan.plan.status === 'APPROVED' ? 'cyan' : 'gold'}>{plan.plan.status}</Badge> · drafted by {plan.plan.created_by}</p>
        <div className="lw-partner-posts">{plan.posts.map((x: any) => {
          const e = edits[x.id] ?? {}, draft = plan.plan.status === 'DRAFT'
          return <div key={x.id} className={`lw-partner-post ${e.skip || x.status === 'SKIPPED' ? 'skipped' : ''}`}>
            <header><b>{day(x.day)}</b><Badge>{x.platform}</Badge><Badge tone="purple">{x.kind.replace('_', ' ')}</Badge>{x.status !== 'PLANNED' && <Badge tone={x.status === 'POSTED' ? 'cyan' : x.status === 'FAILED' ? 'red' : 'muted'}>{x.status}</Badge>}</header>
            {draft && owner ? <textarea rows={2} value={e.caption ?? x.caption} onChange={ev => setEdits({...edits, [x.id]: {...e, caption: ev.target.value}})}/> : <p>{x.caption}</p>}
            {x.media?.productId && <img alt="Merch mockup" src={`/api/label-world/labels/${p.labelId}/merch/products/${x.media.productId}/mockups/${x.media.mockup ?? 0}`}/>}
            {x.media?.needs === 'OWNER_CLIP' && <small>Needs from you: {x.media.hint}</small>}
            {x.posted_url && <a href={x.posted_url} target="_blank" rel="noreferrer noopener">View post</a>}
            {draft && owner && <label className="lw-inline"><input type="checkbox" checked={Boolean(e.skip)} onChange={ev => setEdits({...edits, [x.id]: {...e, skip: ev.target.checked}})}/> Skip</label>}
          </div>
        })}</div>
        {plan.plan.status === 'DRAFT' && owner && <div className="lw-partner-row">
          <Button gold disabled={busy === 'approve'} onClick={() => run('approve', () => api(`${base}/plans/${plan.plan.id}/decision`, {decision: 'APPROVED', edits: Object.entries(edits).map(([id, v]) => ({id, ...v}))}))}>Approve the week</Button>
          <Button disabled={busy === 'reject'} onClick={() => run('reject', () => api(`${base}/plans/${plan.plan.id}/decision`, {decision: 'REJECTED'}))}>Reject</Button>
        </div>}
        {plan.plan.status === 'DRAFT' && !owner && <p className="lw-muted">Waiting for the label owner to approve.</p>}
      </>}
    </Panel>

    <Panel title="Due now" icon="bell">
      {!d.due.posts.length ? <p className="lw-muted">Nothing due right now.</p> : d.due.posts.map((x: any) => <div key={x.id} className="lw-partner-due">
        <div><b>{x.platform}{x.handle ? ` @${x.handle}` : ''}</b> · {day(x.day)}<p>{x.caption}</p>{x.blockedBy ? <small>{x.blockedBy}. You can post it yourself and paste the link.</small> : <small>Your agent will post this from your browser.</small>}</div>
        {editor && <PostedBox onDone={(url) => run('mark' + x.id, () => api(`${base}/posts/${x.id}`, {outcome: 'POSTED', postedUrl: url}), 'Recorded as posted.')} onSkip={() => run('skip' + x.id, () => api(`${base}/posts/${x.id}`, {outcome: 'SKIPPED'}), 'Skipped.')}/>}
      </div>)}
    </Panel>

    <Panel title="Accounts he runs" icon="people">
      <p className="lw-muted">You create each account (it needs your phone). Then type the handle and tap "Hand it over". He fills in the profile and posts only approved posts.</p>
      <div className="lw-partner-channels">{d.channels.map((c: any) => <div key={c.platform} className="lw-partner-channel">
        <header><b>{c.name}</b><Badge tone={c.status === 'READY' ? 'cyan' : c.status === 'PAUSED' ? 'red' : 'gold'}>{c.status === 'NEEDS_ACCOUNT' ? 'Needs account' : c.status}</Badge></header>
        {c.status === 'READY' ? <p>@{c.handle}</p> : <><small>{c.ownerDoes}</small><a href={c.signup} target="_blank" rel="noreferrer noopener">Create it</a></>}
        {owner && c.status !== 'READY' && <div className="lw-partner-row"><input placeholder="@handle" maxLength={60} value={handles[c.platform] ?? c.handle ?? ''} onChange={e => setHandles({...handles, [c.platform]: e.target.value})}/><Button disabled={busy === c.platform || !(handles[c.platform] ?? c.handle)} onClick={() => run(c.platform, () => api(`${base}/channels`, {platform: c.platform, handle: handles[c.platform] ?? c.handle, status: 'READY'}), `${c.name} handed over.`)}>Hand it over</Button></div>}
        {owner && c.status === 'READY' && <Button disabled={busy === c.platform} onClick={() => run(c.platform, () => api(`${base}/channels`, {platform: c.platform, handle: c.handle, status: 'PAUSED'}), `${c.name} paused.`)}>Pause this account</Button>}
      </div>)}</div>
    </Panel>

    <Panel title="Money" icon="chart" action={editor && <Button disabled={busy === 'checkin'} onClick={() => run('checkin', () => api(`${base}/checkin`, {}), 'Check-in posted in his chat.')}>Check in now</Button>}>
      <p>Merch: {d.merch.shopConnected ? `${d.merch.live} live, ${d.merch.hidden} hidden` : 'no shop connected yet'}{d.merch.approvedDesignsNotMade ? ` · ${d.merch.approvedDesignsNotMade} approved design(s) ready for a new drop` : ''}</p>
      {d.lastCheckin && <pre className="lw-partner-checkin">{d.lastCheckin.content}</pre>}
      {d.suggestions.length > 0 && <><h4>Ideas</h4><ul>{d.suggestions.map((x: string) => <li key={x}>{x}</li>)}</ul></>}
      <Streams d={d} owner={owner} save={(b: any) => run('streams', () => api(`${base}/streams`, b), 'Saved.')}/>
    </Panel>
  </div>
}

function PostedBox({onDone, onSkip}: {onDone: (url: string) => void, onSkip: () => void}) {
  const [url, setUrl] = useState('')
  return <div className="lw-partner-row"><input placeholder="Paste the post link" value={url} onChange={e => setUrl(e.target.value)} maxLength={2000}/><Button disabled={!url} onClick={() => onDone(url)}>Posted</Button><Button onClick={onSkip}>Skip</Button></div>
}

function Streams({d, owner, save}: {d: any, owner: boolean, save: (b: any) => void}) {
  const chosen = d.streams.chosen ?? {}
  const block = (key: 'amazon' | 'tickets', title: string) => <div className="lw-partner-stream"><h4>{title}</h4>
    {Object.entries<any>(d.streams[key]).map(([id, o]) => <label key={id} className="lw-inline"><input type="radio" name={key} disabled={!owner} checked={chosen[key] === id} onChange={() => save({[key]: id})}/> <span><b>{o.name}</b>{o.facts.map((f: string) => <small key={f}>{f}</small>)}{o.url && <a href={o.url} target="_blank" rel="noreferrer noopener">Official page</a>}</span></label>)}
    {chosen[key] && chosen[key] !== 'NONE' && owner && <label>Where are you?<select value={chosen[key + 'Status'] ?? 'NOT_STARTED'} onChange={e => save({[key + 'Status']: e.target.value})}>{['NOT_STARTED', 'APPLIED', 'APPROVED', 'LIVE'].map(x => <option key={x}>{x}</option>)}</select></label>}
  </div>
  return <div className="lw-partner-streams">{block('amazon', 'Amazon')}{block('tickets', 'Tickets')}<small>You sign up and enter your own tax and bank details on these sites. He never sees them.</small></div>
}
