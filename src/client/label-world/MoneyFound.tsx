// Money Found: the label's real work. Cases (unpaid TV, unregistered songs,
// SoundExchange money, splits, name disputes), drafts waiting for the owner's
// approval, and the "Is this you?" catalog that powers it all.
import React, {useEffect, useState} from 'react'
import {api, Badge, Button, Icon} from './ui'
import {Report, Statements, Agreements, ContentStudio, RegisterSong} from './Office'

type Tab = 'report' | 'cases' | 'agreements' | 'statements' | 'content' | 'catalog' | 'identity'
const TABS: Tab[] = ['report', 'cases', 'agreements', 'statements', 'content', 'catalog', 'identity']
const hashTab = (): Tab | null => { const h = (typeof location !== 'undefined' ? location.hash.slice(1) : '') as Tab; return TABS.includes(h) ? h : null }

type CaseRow = {id: string, playbook: string, playbookName: string, title: string, status: string, step: number, deadline: string | null, deadline_note: string | null, money_estimate: string | null, next_follow_up_at: string | null, drafts_waiting: number}
const STATUS: Record<string, [string, string]> = {WAITING_ON_YOU: ['Needs you', 'red'], OPEN: ['Team working', 'gold'], WAITING_ON_THEM: ['Waiting on them', 'cyan'], RESOLVED: ['Resolved', 'green'], CLOSED: ['Closed', 'muted']}
const daysLeft = (d: string) => Math.ceil((Date.parse(d + 'T23:59:59Z') - Date.now()) / 86400000)

export function MoneyFound({labelId, role, notify, onAskAgent}: {labelId: string, role: string, notify: (s: string) => void, onAskAgent: (agent: 'executive' | 'researcher' | 'reviewer' | 'builder', q: string) => void}) {
  const [tab, setTabRaw] = useState<Tab>(hashTab() ?? 'cases')
  const setTab = (t: Tab) => { setTabRaw(t); try { history.replaceState(null, '', '#' + t) } catch { /* ignore */ } }
  const [rows, setRows] = useState<CaseRow[]>([]), [open, setOpen] = useState<string | null>(null), [playbooks, setPlaybooks] = useState<any[]>([])
  const [problem, setProblem] = useState(''), [suggested, setSuggested] = useState<any[]>([]), [summary, setSummary] = useState<any>(null), [profile, setProfile] = useState<any>(null)
  const editable = role !== 'viewer'
  async function load() {
    if (!labelId) return
    const [c, p, prof] = await Promise.all([api(`/labels/${labelId}/cases`), api(`/labels/${labelId}/playbooks`), api(`/labels/${labelId}/artist-profile`)])
    setRows(c.cases); setPlaybooks(p.playbooks); setSummary(prof.catalog); setProfile(prof.profile)
  }
  useEffect(() => { setRows([]); setOpen(null); load().catch(e => notify(e.message)) }, [labelId])
  useEffect(() => { if (problem.trim().length < 8) { setSuggested([]); return } const t = setTimeout(() => api(`/labels/${labelId}/playbooks?match=${encodeURIComponent(problem)}`).then(d => setSuggested(d.suggested)).catch(() => {}), 350); return () => clearTimeout(t) }, [problem, labelId])
  async function start(playbook: string) {
    try {
      const d = await api(`/labels/${labelId}/cases`, {playbook, facts: problem.trim() ? {story: problem.trim().slice(0, 2000)} : {}})
      setProblem(''); setSuggested([]); await load(); setOpen(d.case.id); notify('Case opened. Your team will pick it up on the next shift.')
    } catch (e) { notify((e as Error).message) }
  }
  if (!labelId) return <div className="lw-mf-empty">Pick or create a label first.</div>
  const needsYou = rows.filter(r => r.status === 'WAITING_ON_YOU' || r.drafts_waiting > 0).length
  return <div className="lw-mf">
    <div className="lw-mf-hero">
      <div><p className="lw-eyebrow">MONEY FOUND</p><h2>Get paid for what you made.</h2><p>Tell your team what's wrong in plain words. They follow the label's playbooks, track deadlines, chase people down and write every email. Nothing goes out until you approve it.</p></div>
      <div className="lw-mf-stats">
        <div><strong>{summary?.songs ?? 0}</strong><span>songs in catalog</span></div>
        <div><strong>{summary ? `${summary.proRegistered}/${summary.songs}` : '0/0'}</strong><span>registered with PRO</span></div>
        <div><strong>{rows.filter(r => !['RESOLVED', 'CLOSED'].includes(r.status)).length}</strong><span>open cases</span></div>
        <div className={needsYou ? 'alert' : ''}><strong>{needsYou}</strong><span>need you</span></div>
      </div>
    </div>
    <nav className="lw-mf-tabs" role="tablist">{([['report', 'This week'], ['cases', 'Cases'], ['agreements', 'Split sheets'], ['statements', 'Statements'], ['content', 'Content'], ['catalog', `My songs (${summary?.songs ?? 0})`], ['identity', 'Who I am']] as const).map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{t}</button>)}</nav>
    {tab === 'cases' && <>
      {editable && <section className="lw-mf-tell">
        <label htmlFor="mf-problem"><b>What's going on?</b> Talk like you'd talk to your manager.</label>
        <textarea id="mf-problem" rows={3} maxLength={2000} value={problem} onChange={e => setProblem(e.target.value)} placeholder="e.g. My song was on Baddies and I never got paid. I never did a cue sheet…"/>
        <div className="lw-mf-pick">{(suggested.length ? suggested : []).map(s => <button key={s.id} className="primary" onClick={() => start(s.id)}><Icon name="flag" size={15}/> Open case: {s.name}</button>)}
          {problem.trim().length >= 8 && !suggested.length && <span className="lw-muted">Pick the closest problem below.</span>}
        </div>
        <details><summary>All playbooks your team knows</summary><div className="lw-mf-playbooks">{playbooks.map(p => <button key={p.id} onClick={() => start(p.id)}><b>{p.name}</b><small>{p.summary}</small></button>)}</div></details>
      </section>}
      {!rows.length ? <div className="lw-mf-empty"><Icon name="wallet" size={34}/><p>No cases yet. Describe a problem above, or import your songs so your team can find what's unregistered.</p></div> :
        <div className="lw-mf-list">{rows.map(r => <CaseCard key={r.id} row={r} expanded={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} labelId={labelId} editable={editable} notify={notify} reload={load}/>)}</div>}
    </>}
    {tab === 'report' && <Report labelId={labelId} editable={editable} notify={notify}/>}
    {tab === 'agreements' && <Agreements labelId={labelId} editable={editable} notify={notify}/>}
    {tab === 'statements' && <Statements labelId={labelId} editable={editable} notify={notify}/>}
    {tab === 'content' && <ContentStudio labelId={labelId} editable={editable} notify={notify} onAsk={q => onAskAgent('builder', q)}/>}
    {tab === 'catalog' && <Catalog labelId={labelId} editable={editable} notify={notify} profile={profile} onChange={load} onAsk={q => onAskAgent('reviewer', q)}/>}
    {tab === 'identity' && <Identity labelId={labelId} editable={editable} notify={notify} profile={profile} onSaved={p => { setProfile(p); setTab('catalog') }}/>}
  </div>
}

function CaseCard({row, expanded, onToggle, labelId, editable, notify, reload}: {row: CaseRow, expanded: boolean, onToggle: () => void, labelId: string, editable: boolean, notify: (s: string) => void, reload: () => void}) {
  const [detail, setDetail] = useState<any>(null), [answers, setAnswers] = useState<Record<string, string>>({})
  useEffect(() => { if (expanded) api(`/labels/${labelId}/cases/${row.id}`).then(setDetail).catch(e => notify(e.message)) }, [expanded, row.id])
  const [label, tone] = STATUS[row.status] ?? [row.status, 'muted']
  async function saveFacts() {
    const facts = Object.fromEntries(Object.entries(answers).filter(([, v]) => v.trim()))
    if (!Object.keys(facts).length) return
    try { const d = await api(`/labels/${labelId}/cases/${row.id}`, {facts, note: 'Owner answered: ' + Object.keys(facts).join(', ')}); setDetail(d); setAnswers({}); reload(); notify('Saved. Your team has what it needs for the next step.') } catch (e) { notify((e as Error).message) }
  }
  async function decide(id: string, decision: 'APPROVED' | 'REJECTED', body?: string, subject?: string) {
    try { await api(`/labels/${labelId}/drafts/${id}/decision`, {decision, ...(body != null ? {body} : {}), ...(subject != null ? {subject} : {})}); setDetail(await api(`/labels/${labelId}/cases/${row.id}`)); reload(); notify(decision === 'APPROVED' ? 'Approved. Your agent will send it from your email (or send it yourself and tap "I sent it").' : 'Rejected.') } catch (e) { notify((e as Error).message) }
  }
  async function sent(id: string) { try { await api(`/labels/${labelId}/drafts/${id}/sent`, {note: 'Sent by owner'}); setDetail(await api(`/labels/${labelId}/cases/${row.id}`)); reload(); notify('Logged. Follow-up scheduled.') } catch (e) { notify((e as Error).message) } }
  return <article className={`lw-mf-case ${expanded ? 'open' : ''}`}>
    <button className="lw-mf-case-head" onClick={onToggle} aria-expanded={expanded}>
      <div><strong>{row.title}</strong><small>{row.playbookName}</small></div>
      <div className="lw-mf-case-meta">
        {row.deadline && <span className={`lw-mf-deadline ${daysLeft(row.deadline) < 60 ? 'urgent' : ''}`}>{daysLeft(row.deadline) >= 0 ? `${daysLeft(row.deadline)} days left` : 'Deadline passed'}</span>}
        {row.drafts_waiting > 0 && <Badge tone="red">{row.drafts_waiting} to approve</Badge>}
        <Badge tone={tone}>{label}</Badge>
      </div>
    </button>
    {expanded && detail && <div className="lw-mf-case-body">
      {detail.case.deadlineNote && <p className="lw-mf-note"><Icon name="calendar" size={15}/> {detail.case.deadlineNote}</p>}
      {detail.drafts.filter((d: any) => d.status !== 'REJECTED').map((d: any) => <Draft key={d.id} d={d} editable={editable} onDecide={decide} onSent={sent}/>)}
      {editable && detail.stillNeeded.length > 0 && <section className="lw-mf-needs"><h4>Your team needs</h4>{detail.stillNeeded.map((n: any) => <label key={n.key}>{n.question}{n.required && <em> required</em>}<input value={answers[n.key] ?? ''} onChange={e => setAnswers({...answers, [n.key]: e.target.value})} maxLength={2000}/></label>)}<Button gold onClick={saveFacts}>Save answers</Button></section>}
      <details className="lw-mf-steps"><summary>The playbook your team follows ({detail.playbook.steps.length} steps)</summary><ol>{detail.playbook.steps.map((s: string, i: number) => <li key={i} className={i < detail.case.step ? 'done' : ''}>{s}</li>)}</ol>
        {detail.playbook.facts?.length > 0 && <><h5>Verified facts</h5><ul>{detail.playbook.facts.map((f: string) => <li key={f}>{f}</li>)}</ul></>}
        {detail.playbook.contacts?.length > 0 && <><h5>Who to contact</h5><ul>{detail.playbook.contacts.map((c: any) => <li key={c.name}><b>{c.name}:</b> {c.how}</li>)}</ul></>}
      </details>
      <section className="lw-mf-timeline"><h4>What's been done</h4>{detail.events.map((e: any, i: number) => <p key={i}><span>{new Date(e.created_at + (e.created_at.includes('Z') ? '' : 'Z')).toLocaleDateString()}</span><b>{e.actor}</b> {e.body}</p>)}</section>
    </div>}
  </article>
}

function Draft({d, editable, onDecide, onSent}: {d: any, editable: boolean, onDecide: (id: string, dec: 'APPROVED' | 'REJECTED', body?: string, subject?: string) => void, onSent: (id: string) => void}) {
  const [body, setBody] = useState(d.body), [subject, setSubject] = useState(d.subject ?? '')
  const changed = body !== d.body || subject !== (d.subject ?? '')
  return <div className={`lw-mf-draft ${d.status.toLowerCase()}`}>
    <header><Badge tone={d.status === 'DRAFT' ? 'red' : d.status === 'SENT' ? 'green' : 'gold'}>{d.status === 'DRAFT' ? 'Needs your approval' : d.status === 'APPROVED' ? 'Approved, ready to send' : 'Sent'}</Badge><span>{d.kind.toLowerCase()} {d.recipient ? `to ${d.recipient}` : ''} {d.recipient_email ? `<${d.recipient_email}>` : ''}</span><small>by {d.written_by}</small></header>
    {d.status === 'DRAFT' && editable ? <><input aria-label="Subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"/><textarea aria-label="Draft body" rows={8} value={body} onChange={e => setBody(e.target.value)}/>
      <div className="lw-mf-draft-actions"><Button onClick={() => onDecide(d.id, 'REJECTED')}>Reject</Button><button className="lw-mf-approve" onClick={() => onDecide(d.id, 'APPROVED', changed ? body : undefined, changed ? subject : undefined)}>{changed ? 'Approve with my edits' : 'Approve, send it'}</button></div></>
      : <>{d.subject && <b className="lw-mf-subject">{d.subject}</b>}<pre>{d.body}</pre>{d.status === 'APPROVED' && editable && <div className="lw-mf-draft-actions"><button className="lw-mf-copy" onClick={() => navigator.clipboard?.writeText((d.subject ? 'Subject: ' + d.subject + '\n\n' : '') + d.body)}>Copy</button><Button onClick={() => onSent(d.id)}>I sent it myself</Button></div>}{d.sent_at && <small>Sent {new Date(d.sent_at + 'Z').toLocaleString()} {d.sent_note ? '· ' + d.sent_note : ''}</small>}</>}
  </div>
}

function Identity({labelId, editable, notify, profile, onSaved}: {labelId: string, editable: boolean, notify: (s: string) => void, profile: any, onSaved: (p: any) => void}) {
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    const aliases = String(f.get('aliases') || '').split(',').map(s => s.trim()).filter(Boolean)
    try { const d = await api(`/labels/${labelId}/artist-profile`, {artistName: f.get('artistName'), legalName: f.get('legalName'), aliases, pro: f.get('pro') || null, ipi: f.get('ipi') || null, firstUsedYear: f.get('firstUsedYear') || null, socials: {instagram: f.get('instagram'), tiktok: f.get('tiktok'), youtube: f.get('youtube')}}); notify('Saved. Now find your songs.'); onSaved(d.profile) } catch (err) { notify((err as Error).message) }
  }
  return <form className="lw-mf-identity" onSubmit={save}>
    <p>Your team uses this to find your songs, search SoundExchange under every name you've used, and prove your history with your name.</p>
    <div className="lw-form-two"><label>Artist name<input name="artistName" required maxLength={120} defaultValue={profile?.artistName ?? ''} disabled={!editable}/></label><label>Legal name<input name="legalName" maxLength={120} defaultValue={profile?.legalName ?? ''} disabled={!editable}/></label></div>
    <label>Other names you've released under (comma separated)<input name="aliases" defaultValue={(profile?.aliases ?? []).join(', ')} disabled={!editable}/></label>
    <div className="lw-form-two"><label>PRO<select name="pro" defaultValue={profile?.pro ?? ''} disabled={!editable}><option value="">Not sure</option>{['ASCAP', 'BMI', 'SESAC', 'GMR', 'SOCAN', 'PRS', 'OTHER', 'NONE'].map(p => <option key={p}>{p}</option>)}</select></label><label>IPI number (if you know it)<input name="ipi" maxLength={20} defaultValue={profile?.ipi ?? ''} disabled={!editable}/></label></div>
    <label>First year you used this name publicly<input name="firstUsedYear" type="number" min={1950} max={new Date().getFullYear()} defaultValue={profile?.firstUsedYear ?? ''} disabled={!editable}/></label>
    <div className="lw-form-two"><label>Instagram<input name="instagram" defaultValue={profile?.socials?.instagram ?? ''} disabled={!editable}/></label><label>TikTok<input name="tiktok" defaultValue={profile?.socials?.tiktok ?? ''} disabled={!editable}/></label></div>
    <label>YouTube<input name="youtube" defaultValue={profile?.socials?.youtube ?? ''} disabled={!editable}/></label>
    {editable && <Button gold type="submit">Save and find my songs</Button>}
  </form>
}

function Catalog({labelId, editable, notify, profile, onChange, onAsk}: {labelId: string, editable: boolean, notify: (s: string) => void, profile: any, onChange: () => void, onAsk: (q: string) => void}) {
  const [tracks, setTracks] = useState<any[]>([]), [reg, setReg] = useState<string | null>(null), [summary, setSummary] = useState<any>(null), [name, setName] = useState(profile?.artistName ?? ''), [found, setFound] = useState<any[]>([]), [picked, setPicked] = useState<Record<string, boolean>>({}), [busy, setBusy] = useState(false)
  const load = () => api(`/labels/${labelId}/catalog`).then(d => { setTracks(d.tracks); setSummary(d.summary) }).catch(e => notify(e.message))
  useEffect(() => { load() }, [labelId]); useEffect(() => { if (profile?.artistName && !name) setName(profile.artistName) }, [profile])
  async function search() { setBusy(true); try { const d = await api(`/labels/${labelId}/catalog/search?name=${encodeURIComponent(name)}`); setFound(d.artists); setPicked({}) } catch (e) { notify((e as Error).message) } finally { setBusy(false) } }
  async function importPicked() {
    const profiles = found.filter(a => picked[a.source + a.artistId]).map(a => ({source: a.source, artistId: a.artistId}))
    if (!profiles.length) { notify('Tick the profiles that are really you.'); return }
    setBusy(true); try { const d = await api(`/labels/${labelId}/catalog/import`, {profiles}); notify(`Imported ${d.added} songs.`); setFound([]); load(); onChange() } catch (e) { notify((e as Error).message) } finally { setBusy(false) }
  }
  async function mark(id: string, patch: any) { try { setSummary(await api(`/labels/${labelId}/catalog/${id}`, patch)); load(); onChange() } catch (e) { notify((e as Error).message) } }
  return <div className="lw-mf-catalog">
    {editable && <section className="lw-mf-find"><label><b>Find my music</b><span>We search Apple Music and Deezer. Similar names are common, so only pick the profiles that are really you.</span></label>
      <div className="lw-mf-row"><input value={name} onChange={e => setName(e.target.value)} placeholder="Your artist name" maxLength={120}/><Button gold disabled={busy || !name.trim()} onClick={search}>{busy ? 'Searching…' : 'Search'}</Button></div>
      {found.length > 0 && <><h4>Is this you?</h4><div className="lw-mf-found">{found.map(a => <label key={a.source + a.artistId} className={picked[a.source + a.artistId] ? 'on' : ''}><input type="checkbox" checked={!!picked[a.source + a.artistId]} onChange={e => setPicked({...picked, [a.source + a.artistId]: e.target.checked})}/>{a.picture && !/artist\/\//.test(a.picture) && !/images\/artist\/\//.test(a.picture) ? <img src={a.picture} alt="" width={44} height={44} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}/> : <span className="lw-mf-avatar">{a.name[0]}</span>}<span><b>{a.name}</b><small>{a.source === 'itunes' ? 'Apple Music' : 'Deezer'}{a.genre ? ' · ' + a.genre : ''}{a.albums != null ? ` · ${a.albums} releases` : ''}{a.exact ? ' · exact name' : ''}</small></span>{a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>View</a>}</label>)}</div><Button gold disabled={busy} onClick={importPicked}>Yes, import these songs</Button></>}
    </section>}
    {summary && summary.songs > 0 && <div className="lw-mf-progress"><div><b>{summary.proRegistered} of {summary.songs}</b> registered with your PRO</div><div className="lw-mf-bar"><i style={{width: `${Math.round(100 * summary.proRegistered / Math.max(1, summary.songs))}%`}}/></div>{summary.songs - summary.proRegistered > 0 && <Button onClick={() => onAsk(`Open a "Register my songs" case and work through my ${summary.songs - summary.proRegistered} unregistered songs.`)}>Have Eric register the rest</Button>}</div>}
    {reg && <RegisterSong labelId={labelId} trackId={reg} editable={editable} notify={notify} onClose={() => { setReg(null); load(); onChange() }} onAsk={onAsk}/>}
    {tracks.length > 0 && <div className="lw-table-wrap"><table className="lw-mf-table"><thead><tr><th>Song</th><th>Credit</th><th>Released</th><th>PRO</th><th>SoundExchange</th></tr></thead><tbody>{tracks.map(t => <tr key={t.id} className={t.pro_status === 'NOT_MINE' ? 'muted' : ''}><td>{t.link ? <a href={t.link} target="_blank" rel="noopener noreferrer">{t.title}</a> : t.title}<small>{t.album}{t.isrc ? ' · ' + t.isrc : ''}</small>{t.pro_status !== 'REGISTERED' && t.pro_status !== 'NOT_MINE' && <button className="lw-link-btn" onClick={() => setReg(t.id)}>Register with ASCAP</button>}</td><td>{t.artist_credit}</td><td>{t.release_date ?? '—'}</td>
      <td><select aria-label={`PRO status for ${t.title}`} value={t.pro_status} disabled={!editable} onChange={e => mark(t.id, {proStatus: e.target.value})}><option value="UNKNOWN">Not checked</option><option value="REGISTERED">Registered</option><option value="NOT_REGISTERED">Not registered</option><option value="NOT_MINE">Not my song</option></select></td>
      <td><select aria-label={`SoundExchange status for ${t.title}`} value={t.sx_status} disabled={!editable} onChange={e => mark(t.id, {sxStatus: e.target.value})}><option value="UNKNOWN">Not checked</option><option value="CLAIMED">Claimed</option><option value="NOT_CLAIMED">Not claimed</option><option value="NOT_MINE">Not my song</option></select></td></tr>)}</tbody></table></div>}
    {!tracks.length && <div className="lw-mf-empty"><Icon name="music" size={34}/><p>No songs yet. Search your artist name above and pick the profiles that are you.</p></div>}
  </div>
}
