// Label Office tabs inside Money Found: weekly report, statements, split sheets
// (built-in e-sign), Content Studio. Phone-first layout: single column, big tap targets.
import React, {useEffect, useState} from 'react'
import {api, Badge, Button} from './ui'

type N = (s: string) => void
const money = (n: number) => `$${(n ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`

// ---------------- Weekly report ----------------
export function Report({labelId, editable, notify}: {labelId: string, editable: boolean, notify: N}) {
  const [d, setD] = useState<any>(null), [busy, setBusy] = useState(false), [idx, setIdx] = useState(0)
  const load = () => api(`/labels/${labelId}/reports`).then(setD).catch(e => notify(e.message))
  useEffect(() => { setD(null); setIdx(0); load() }, [labelId])
  async function gen() { setBusy(true); try { await api(`/labels/${labelId}/reports/generate`, {}); await load(); setIdx(0); notify('Report updated') } catch (e) { notify((e as Error).message) } finally { setBusy(false) } }
  async function saveSchedule(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); try { await api(`/labels/${labelId}/report-settings`, {timezone: f.get('tz'), reportWeekday: Number(f.get('wd')), reportHour: Number(f.get('hr'))}); await load(); notify('Schedule saved') } catch (er) { notify((er as Error).message) } }
  if (!d) return <p className="lw-muted">Loading…</p>
  const r = d.reports[idx]?.report
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return <div className="lw-office">
    <div className="lw-office-head"><div><h3>Weekly report</h3><p className="lw-muted">Every {days[d.settings.reportWeekday]} at {d.settings.reportHour}:00 ({d.settings.timezone}). Built from your records only, nothing guessed.</p></div>
      {editable && <Button gold disabled={busy} onClick={gen}>{busy ? 'Building…' : 'Build it now'}</Button>}</div>
    {d.reports.length > 1 && <select aria-label="Past reports" value={idx} onChange={e => setIdx(Number(e.target.value))}>{d.reports.map((x: any, i: number) => <option key={x.id} value={i}>Week of {x.localDate}{x.trigger === 'MANUAL' ? ' (built by hand)' : ''}</option>)}</select>}
    {!r ? <p className="lw-mf-empty">No report yet. {editable ? 'Tap "Build it now" to see this week.' : ''}</p> : <>
      <ul className="lw-report-headline">{r.headline.map((h: string) => <li key={h}>{h}</li>)}</ul>
      {r.carriedOver?.length > 0 && <section className="lw-report-card warn"><h4>Still open from last week</h4><ul>{r.carriedOver.map((x: string) => <li key={x}>{x}</li>)}</ul></section>}
      <section className="lw-report-card"><h4>Needs you ({r.needsYou.length})</h4>{r.needsYou.length ? <ol>{r.needsYou.map((n: any) => <li key={n.key}><a href={n.link}>{n.text}</a>{n.weeks >= 2 && <Badge tone="red">{n.weeks} weeks</Badge>}</li>)}</ol> : <p>Nothing. Your team has it.</p>}</section>
      <section className="lw-report-card"><h4>Money</h4>
        <p><b>{money(r.money.verifiedEarnedUsd)}</b> verified from statements.</p>
        {r.money.bySource.map((s: any) => <div key={s.source} className="lw-report-row"><span>{s.source}</span><span>{money(s.usd)}</span></div>)}
        {r.money.topSongs.length > 0 && <><h5>Top songs</h5>{r.money.topSongs.slice(0, 5).map((s: any) => <div key={s.song} className="lw-report-row"><span>{s.song}</span><span>{money(s.usd)}</span></div>)}</>}
        {r.money.potential.length > 0 && <><h5>Potential, not money yet</h5>{r.money.potential.map((p: any) => <div key={p.caseId} className="lw-report-row"><span>{p.title}</span><span>{p.estimate}</span></div>)}</>}
        <p className="lw-muted small">{r.money.rule}</p></section>
      {r.deadlines.length > 0 && <section className="lw-report-card"><h4>Deadlines (next 30 days)</h4>{r.deadlines.map((x: any) => <div key={x.caseId} className="lw-report-row"><span>{x.title}</span><span>{x.deadline}</span></div>)}</section>}
      <section className="lw-report-card"><h4>Songs</h4><p>{r.catalog.proRegistered} of {r.catalog.songs} registered with your PRO{r.catalog.percentRegistered != null ? ` (${r.catalog.percentRegistered}%)` : ''} · {r.catalog.soundExchangeClaimed} claimed at SoundExchange · {r.catalog.stillToRegister} still to check or register.</p>{r.catalog.songs > 0 && <div className="lw-mf-progress"><span style={{width: `${r.catalog.percentRegistered ?? 0}%`}}/></div>}</section>
      <section className="lw-report-card"><h4>Your team this week</h4><p>{r.team.tasksDone} tasks done · {r.team.queued} queued · {r.team.stuck} stuck · cases: {r.cases.open} open, {r.cases.waitingOnThem} waiting on others, {r.cases.resolvedThisWeek} resolved.</p></section>
      {r.social.length > 0 && <section className="lw-report-card"><h4>Socials read this week</h4>{r.social.slice(0, 6).map((s: any, i: number) => <div key={i} className="lw-report-row"><span>{s.platform} · {s.title}</span><span>{Object.entries(s.metrics).slice(0, 2).map(([k, v]) => `${k} ${v}`).join(' · ')}</span></div>)}</section>}
    </>}
    {editable && <details className="lw-report-card"><summary>Change when it arrives</summary><form className="lw-stacked-form" onSubmit={saveSchedule}>
      <label>Time zone<input name="tz" defaultValue={d.settings.timezone} placeholder="America/New_York"/></label>
      <div className="lw-form-two"><label>Day<select name="wd" defaultValue={d.settings.reportWeekday}>{days.map((x, i) => <option key={x} value={i}>{x}</option>)}</select></label><label>Hour<select name="hr" defaultValue={d.settings.reportHour}>{Array.from({length: 24}, (_, i) => <option key={i} value={i}>{i}:00</option>)}</select></label></div>
      <Button type="submit">Save schedule</Button></form></details>}
  </div>
}

// ---------------- Statements ----------------
export function Statements({labelId, editable, notify}: {labelId: string, editable: boolean, notify: N}) {
  const [d, setD] = useState<any>(null), [csv, setCsv] = useState(''), [file, setFile] = useState('statement.csv'), [prev, setPrev] = useState<any>(null), [map, setMap] = useState<Record<string, string>>({}), [source, setSource] = useState('unitedmasters'), [busy, setBusy] = useState(false)
  const load = () => api(`/labels/${labelId}/statements`).then(setD).catch(e => notify(e.message))
  useEffect(() => { setD(null); load() }, [labelId])
  async function pick(f: File | undefined) {
    if (!f) return; if (f.size > 3_000_000) { notify('File is over 3 MB. Export one month at a time.'); return }
    const text = await f.text(); setCsv(text); setFile(f.name)
    if (/ascap/i.test(f.name)) setSource('ascap'); else if (/bmi/i.test(f.name)) setSource('bmi'); else if (/mlc/i.test(f.name)) setSource('mlc'); else if (/soundexchange|sx/i.test(f.name)) setSource('soundexchange')
    try { const p = await api(`/labels/${labelId}/statements/preview`, {csv: text}); setPrev(p); setMap(Object.fromEntries(Object.entries(p.mapping).map(([k, v]) => [k, String(v)]))) } catch (e) { notify((e as Error).message); setPrev(null) }
  }
  async function doImport() {
    setBusy(true)
    try { const m = Object.fromEntries(Object.entries(map).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)])); const r = await api(`/labels/${labelId}/statements`, {csv, filename: file, source, mapping: m}); notify(`Imported ${r.statement.lines} lines · ${money(r.statement.totalUsd)}${r.statement.skipped ? ` · ${r.statement.skipped} lines skipped (no amount)` : ''}`); setCsv(''); setPrev(null); await load() }
    catch (e) { notify((e as Error).message) } finally { setBusy(false) }
  }
  async function del(id: string) { if (!confirm('Delete this statement and its lines?')) return; try { await api(`/labels/${labelId}/statements/${id}/delete`, {}); await load() } catch (e) { notify((e as Error).message) } }
  const labels: Record<string, string> = {title: 'Song title', isrc: 'ISRC', amount: 'Money amount (required)', period: 'Period / month', platform: 'Store / platform', territory: 'Country', quantity: 'Streams / units'}
  return <div className="lw-office">
    <div className="lw-office-head"><div><h3>Royalty statements</h3><p className="lw-muted">Upload the CSV your distributor or PRO gives you. This is your verified money; your team uses it to spot songs that earn on one side but not the other.</p></div></div>
    {d && <section className="lw-report-card"><h4>{money(d.summary.verifiedEarnedUsd)} verified</h4>{d.summary.bySource.map((s: any) => <div key={s.source} className="lw-report-row"><span>{s.source}</span><span>{money(s.usd)}</span></div>)}</section>}
    {editable && <section className="lw-report-card"><h4>Import a statement</h4>
      <label className="lw-file">Choose CSV file<input type="file" accept=".csv,.tsv,.txt,text/csv" onChange={e => pick(e.target.files?.[0])}/></label>
      {prev && <div className="lw-stacked-form">
        <p>{prev.rows} lines found in <b>{file}</b>. Check which column is which:</p>
        <label>Where is this from?<select value={source} onChange={e => setSource(e.target.value)}>{[['unitedmasters', 'UnitedMasters'], ['ascap', 'ASCAP'], ['bmi', 'BMI'], ['mlc', 'The MLC'], ['soundexchange', 'SoundExchange'], ['distributor', 'Other distributor'], ['other', 'Other']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <div className="lw-map-grid">{prev.fields.map((f: string) => <label key={f}>{labels[f]}<select value={map[f] ?? ''} onChange={e => setMap({...map, [f]: e.target.value})}><option value="">(none)</option>{prev.headers.map((h: string, i: number) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}</select></label>)}</div>
        <div className="lw-table-wrap"><table><thead><tr>{prev.headers.map((h: string, i: number) => <th key={i}>{h}</th>)}</tr></thead><tbody>{prev.sample.map((r: string[], i: number) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
        <Button gold disabled={busy || !map.amount} onClick={doImport}>{busy ? 'Importing…' : 'Import statement'}</Button>
      </div>}
      <p className="lw-muted small">Sending us a real UnitedMasters or ASCAP export lets us add a one-tap importer for that exact format.</p>
    </section>}
    {d?.statements?.length > 0 && <section className="lw-report-card"><h4>On file</h4>{d.statements.map((s: any) => <div key={s.id} className="lw-report-row"><span>{s.source} · {s.filename} · {s.row_count} lines</span><span>{money(s.totalUsd)} {editable && <button className="lw-link-btn" onClick={() => del(s.id)}>delete</button>}</span></div>)}</section>}
  </div>
}

// ---------------- Split sheets ----------------
const ROLES = ['songwriter', 'composer', 'lyricist', 'producer', 'performer', 'featured artist', 'engineer', 'other']
const blank = () => ({legalName: '', stageName: '', email: '', roles: ['songwriter'], pro: '', ipi: '', compositionShare: 0, masterShare: 0, producerPoints: 0})
export function Agreements({labelId, editable, notify}: {labelId: string, editable: boolean, notify: N}) {
  const [list, setList] = useState<any[]>([]), [mode, setMode] = useState<'list' | 'new'>('list'), [open, setOpen] = useState<any>(null), [links, setLinks] = useState<any[]>([])
  const load = () => api(`/labels/${labelId}/agreements`).then(d => setList(d.agreements)).catch(e => notify(e.message))
  useEffect(() => { setList([]); setOpen(null); setLinks([]); load() }, [labelId])
  async function view(id: string) { try { setOpen(await api(`/labels/${labelId}/agreements/${id}`)) } catch (e) { notify((e as Error).message) } }
  async function relink(pid: string) { try { const r = await api(`/labels/${labelId}/agreements/${open.id}/parties/${pid}/link`, {}); setLinks([{...r, partyId: pid}]); notify('New link made. The old one stopped working.') } catch (e) { notify((e as Error).message) } }
  async function voidIt() { const reason = prompt('Why void this split sheet?'); if (reason == null) return; try { await api(`/labels/${labelId}/agreements/${open.id}/void`, {reason}); await load(); await view(open.id) } catch (e) { notify((e as Error).message) } }
  const tone = (s: string) => s === 'FULLY_SIGNED' ? 'green' : s === 'DECLINED' ? 'red' : s === 'VOID' ? 'muted' : 'gold'
  if (mode === 'new') return <NewAgreement labelId={labelId} notify={notify} onDone={r => { setMode('list'); setLinks(r.signLinks); load(); setOpen(r.agreement) }} onCancel={() => setMode('list')}/>
  return <div className="lw-office">
    <div className="lw-office-head"><div><h3>Split sheets</h3><p className="lw-muted">Everyone signs from a private link on their phone. No account, no DocuSign. Any change after signing makes a new version everyone signs again.</p></div>{editable && <Button gold onClick={() => { setLinks([]); setMode('new') }}>New split sheet</Button>}</div>
    {links.length > 0 && <section className="lw-report-card warn"><h4>Send each person their link</h4><p className="lw-muted small">Shown once. Text, DM or email it yourself. Each link only works for that person's email.</p>{links.map(l => <div key={l.partyId} className="lw-link-row"><span>{l.legalName} · {l.email}</span><input readOnly value={l.signUrl} onFocus={e => e.currentTarget.select()}/><button className="lw-mf-copy" onClick={() => { navigator.clipboard?.writeText(l.signUrl); notify('Link copied') }}>Copy</button></div>)}</section>}
    {!list.length && <p className="lw-mf-empty">No split sheets yet.</p>}
    {list.map(a => <button key={a.id} className={`lw-agreement-row ${open?.id === a.id ? 'active' : ''}`} onClick={() => view(a.id)}><span><b>{a.work_title}</b> · v{a.version}</span><span>{a.signed}/{a.signers} signed <Badge tone={tone(a.status)}>{a.status.replace(/_/g, ' ').toLowerCase()}</Badge></span></button>)}
    {open && <section className="lw-report-card">
      <h4>{open.workTitle} · version {open.version}</h4>
      {open.parties.map((p: any) => <div key={p.id} className="lw-report-row"><span>{p.legalName} ({p.roles.join(', ')}) · writing {p.compositionShare}%{p.masterShare ? ` · master ${p.masterShare}%` : ''}{p.producerPoints ? ` · ${p.producerPoints} pts` : ''}{p.declineReason ? <><br/><em>"{p.declineReason}"</em></> : null}</span><span><Badge tone={p.status === 'SIGNED' ? 'green' : p.status === 'DECLINED' ? 'red' : 'muted'}>{p.status.replace('_', ' ').toLowerCase()}</Badge>{editable && open.status === 'OUT_FOR_SIGNATURE' && p.status !== 'SIGNED' && <button className="lw-link-btn" onClick={() => relink(p.id)}>new link</button>}</span></div>)}
      <div className="lw-action-row"><a className="lw-button" href={`/api/label-world/labels/${labelId}/agreements/${open.id}/copy`}>Download {open.status === 'FULLY_SIGNED' ? 'signed copy' : 'copy'}</a>{editable && ['OUT_FOR_SIGNATURE', 'DECLINED'].includes(open.status) && <Button onClick={voidIt}>Void</Button>}</div>
      <details><summary>Document and audit trail</summary><pre className="lw-doc">{open.document}</pre><p className="lw-muted small">Fingerprint {open.docHash}</p><ul className="lw-audit">{open.events.map((e: any, i: number) => <li key={i}>{e.created_at} · {e.kind} · {e.actor}: {e.body}</li>)}</ul></details>
      <p className="lw-muted small">Need changes? Ask Eric or the Executive in chat to revise it; everyone will sign the new version.</p>
    </section>}
  </div>
}
function NewAgreement({labelId, notify, onDone, onCancel}: {labelId: string, notify: N, onDone: (r: any) => void, onCancel: () => void}) {
  const [title, setTitle] = useState(''), [samples, setSamples] = useState('none'), [notes, setNotes] = useState(''), [people, setPeople] = useState<any[]>([blank()]), [check, setCheck] = useState<any>(null), [busy, setBusy] = useState(false)
  const set = (i: number, k: string, v: any) => setPeople(people.map((p, j) => j === i ? {...p, [k]: v} : p))
  const total = (k: string) => Math.round(people.reduce((a, p) => a + Number(p[k] || 0), 0) * 100) / 100
  const terms = () => ({workTitle: title, samples, notes: notes || undefined, parties: people.map(p => ({...p, pro: p.pro || undefined, ipi: p.ipi || undefined, stageName: p.stageName || undefined, compositionShare: Number(p.compositionShare), masterShare: Number(p.masterShare), producerPoints: Number(p.producerPoints)}))})
  async function precheck() { try { setCheck(await api(`/labels/${labelId}/agreements/precheck`, terms())) } catch (e) { notify((e as Error).message) } }
  async function create() { setBusy(true); try { onDone(await api(`/labels/${labelId}/agreements`, terms())) } catch (e) { notify((e as Error).message) } finally { setBusy(false) } }
  const comp = total('compositionShare'), master = total('masterShare')
  return <div className="lw-office"><div className="lw-office-head"><h3>New split sheet</h3><Button onClick={onCancel}>Cancel</Button></div>
    <div className="lw-stacked-form">
      <label>Song title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={200}/></label>
      {people.map((p, i) => <fieldset key={i} className="lw-party"><legend>Person {i + 1}{people.length > 1 && <button type="button" className="lw-link-btn" onClick={() => setPeople(people.filter((_, j) => j !== i))}>remove</button>}</legend>
        <div className="lw-form-two"><label>Legal name<input value={p.legalName} onChange={e => set(i, 'legalName', e.target.value)} maxLength={120}/></label><label>Artist name<input value={p.stageName} onChange={e => set(i, 'stageName', e.target.value)} maxLength={120}/></label></div>
        <label>Email (their link only works with this)<input type="email" value={p.email} onChange={e => set(i, 'email', e.target.value)} maxLength={254}/></label>
        <div className="lw-chips">{ROLES.map(r => <label key={r} className={p.roles.includes(r) ? 'on' : ''}><input type="checkbox" checked={p.roles.includes(r)} onChange={e => set(i, 'roles', e.target.checked ? [...p.roles, r] : p.roles.filter((x: string) => x !== r))}/>{r}</label>)}</div>
        <div className="lw-form-two"><label>PRO<select value={p.pro} onChange={e => set(i, 'pro', e.target.value)}><option value="">Not sure</option>{['ASCAP', 'BMI', 'SESAC', 'GMR', 'SOCAN', 'PRS', 'OTHER', 'NONE'].map(x => <option key={x}>{x}</option>)}</select></label><label>IPI<input value={p.ipi} onChange={e => set(i, 'ipi', e.target.value)} maxLength={20}/></label></div>
        <div className="lw-form-three"><label>Songwriting %<input type="number" min={0} max={100} step={0.01} value={p.compositionShare} onChange={e => set(i, 'compositionShare', e.target.value)}/></label><label>Master %<input type="number" min={0} max={100} step={0.01} value={p.masterShare} onChange={e => set(i, 'masterShare', e.target.value)}/></label><label>Producer pts<input type="number" min={0} max={100} step={0.5} value={p.producerPoints} onChange={e => set(i, 'producerPoints', e.target.value)}/></label></div>
      </fieldset>)}
      {people.length < 20 && <Button onClick={() => setPeople([...people, blank()])}>+ Add person</Button>}
      <p className={comp === 100 ? 'lw-ok' : 'lw-warn'}>Songwriting total: {comp}% {comp === 100 ? '✓' : '(must be 100%)'} · Master total: {master}% {master === 0 ? '(not covered)' : master === 100 ? '✓' : '(must be 0 or 100%)'}</p>
      <label>Samples or loops?<select value={samples} onChange={e => setSamples(e.target.value)}><option value="none">No samples</option><option value="cleared">Yes, all cleared</option><option value="uncleared">Yes, NOT cleared</option><option value="unsure">Not sure</option></select></label>
      <label>Extra terms (optional)<textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000}/></label>
      <div className="lw-action-row"><Button onClick={precheck}>Attorney agent check</Button><Button gold disabled={busy || comp !== 100 || !title} onClick={create}>{busy ? 'Creating…' : 'Create and get sign links'}</Button></div>
      {check && <section className="lw-report-card"><h4>Attorney agent</h4>{check.flags.length ? check.flags.map((f: any, i: number) => <p key={i}><Badge tone={f.level === 'STOP' ? 'red' : f.level === 'FIX' ? 'gold' : 'cyan'}>{f.level}</Badge> <b>{f.issue}.</b> {f.why}</p>) : <p>No red flags in the basics.</p>}<p className="lw-muted small">{check.disclaimer}</p></section>}
    </div></div>
}

// ---------------- Content Studio ----------------
export function ContentStudio({labelId, editable, notify, onAsk}: {labelId: string, editable: boolean, notify: N, onAsk: (q: string) => void}) {
  const [list, setList] = useState<any[]>([]), [open, setOpen] = useState<any>(null), [creating, setCreating] = useState(false)
  const load = () => api(`/labels/${labelId}/campaigns`).then(d => setList(d.campaigns)).catch(e => notify(e.message))
  useEffect(() => { setList([]); setOpen(null); load() }, [labelId])
  async function view(id: string) { try { setOpen(await api(`/labels/${labelId}/campaigns/${id}`)) } catch (e) { notify((e as Error).message) } }
  async function create(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); try { const c = await api(`/labels/${labelId}/campaigns`, f); setCreating(false); await load(); setOpen(c); onAsk(`Plan content for "${c.trackTitle}". Goal: ${c.objective}. Read my analytics and trends first, then add concepts to campaign ${c.id}.`) } catch (er) { notify((er as Error).message) } }
  async function status(id: string, s: string) { try { await api(`/labels/${labelId}/concepts/${id}/status`, {status: s}); await view(open.id); load() } catch (e) { notify((e as Error).message) } }
  return <div className="lw-office">
    <div className="lw-office-head"><div><h3>Content Studio</h3><p className="lw-muted">Carla reads your retention curves and what's trending (read-only), Builder writes shootable ideas. You approve. Nobody posts for you.</p></div>{editable && <Button gold onClick={() => setCreating(!creating)}>New campaign</Button>}</div>
    {creating && <form className="lw-stacked-form lw-report-card" onSubmit={create}>
      <label>Song<input name="trackTitle" required maxLength={200}/></label>
      <label>Goal<select name="objective"><option>Pre-saves before release</option><option>More streams</option><option>A sound people use</option><option>New followers</option></select></label>
      <div className="lw-form-two"><label>Who it's for<input name="audience" maxLength={500} placeholder="e.g. Atlanta, 18-24, R&B fans"/></label><label>Budget<input name="budget" maxLength={200} placeholder="phone only / $500"/></label></div>
      <label>Vibe or references<input name="vibe" maxLength={500}/></label>
      <Button type="submit" gold>Create and ask the team</Button></form>}
    {!list.length && !creating && <p className="lw-mf-empty">No campaigns yet.</p>}
    {list.map(c => <button key={c.id} className={`lw-agreement-row ${open?.id === c.id ? 'active' : ''}`} onClick={() => view(c.id)}><span><b>{c.track_title}</b> · {c.objective}</span><span>{c.concepts} ideas{c.waiting ? <Badge tone="gold">{c.waiting} to review</Badge> : null}</span></button>)}
    {open && <section className="lw-report-card"><h4>{open.trackTitle}</h4>
      {!open.concepts.length && <p className="lw-muted">No ideas yet. <button className="lw-link-btn" onClick={() => onAsk(`Add content concepts to campaign ${open.id} for "${open.trackTitle}" (${open.objective}).`)}>Ask the team</button></p>}
      {open.concepts.map((k: any) => <article key={k.id} className="lw-concept">
        <header><b>{k.title}</b> <Badge tone={k.status === 'APPROVED' ? 'green' : k.status === 'REJECTED' ? 'red' : k.status === 'DRAFT' ? 'gold' : 'cyan'}>{k.status.toLowerCase()}</Badge>{k.platform && <small> · {k.platform}{k.durationSec ? ` · ${k.durationSec}s` : ''}</small>}</header>
        <p><b>Hook:</b> {k.hook}</p><p>{k.treatment}</p>
        {k.songSection && <p><b>Song part:</b> {k.songSection}</p>}
        {k.shots.length > 0 && <ol>{k.shots.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol>}
        {(k.lowBudget || k.highBudget) && <div className="lw-form-two">{k.lowBudget && <p><b>Phone only:</b> {k.lowBudget}</p>}{k.highBudget && <p><b>Bigger budget:</b> {k.highBudget}</p>}</div>}
        {k.caption && <p><b>Caption:</b> {k.caption}</p>}{k.cta && <p><b>Ask:</b> {k.cta}</p>}
        {k.rightsNotes && <p className="lw-warn">{k.rightsNotes}</p>}
        {k.evidence.length > 0 && <p className="lw-muted small">Why: {k.evidence.map((e: any) => e.why).join(' · ')}</p>}
        {editable && <div className="lw-action-row">{k.status === 'DRAFT' && <><Button gold onClick={() => status(k.id, 'APPROVED')}>Approve</Button><Button onClick={() => status(k.id, 'REJECTED')}>Pass</Button></>}{k.status === 'APPROVED' && <Button onClick={() => status(k.id, 'SHOT')}>We shot it</Button>}{k.status === 'SHOT' && <Button onClick={() => status(k.id, 'POSTED')}>Posted</Button>}{k.status === 'REJECTED' && <Button onClick={() => status(k.id, 'DRAFT')}>Reconsider</Button>}</div>}
      </article>)}
    </section>}
  </div>
}
