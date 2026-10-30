// Real actions behind buttons that used to say "Coming soon":
//  - FinalApproval: version-bound request / approve / reject (owner decides)
//  - DistributionPrep: the field-by-field packets for UnitedMasters / ASCAP / SoundExchange
//  - PackageTools: preview + download a release manifest (metadata, intake, files + SHA-256)
//  - AssignTask: send work to an employee's inbox (your connected Codex/Claude picks it up)
import React, {useEffect, useState} from 'react'
import {api, chime, agents, Badge, Button, type AgentId} from './ui'

type N = (s: string) => void

export function FinalApproval({labelId, releaseId, role, notify, compact = false}: {labelId: string, releaseId: string, role: string, notify: N, compact?: boolean}) {
  const [s, setS] = useState<any>(null), [busy, setBusy] = useState(false)
  const url = `/labels/${labelId}/releases/${releaseId}/approval`
  const load = () => labelId && releaseId ? api(url).then(setS).catch(e => notify(e.message)) : Promise.resolve(setS(null))
  useEffect(() => { setS(null); load() }, [labelId, releaseId])
  useEffect(() => { const f = () => load(); window.addEventListener('lw-approval-updated', f); window.addEventListener('lw-review-updated', f); return () => { window.removeEventListener('lw-approval-updated', f); window.removeEventListener('lw-review-updated', f) } }, [labelId, releaseId])
  async function act(action: string) {
    if (!releaseId) { notify('Pick a release at the top first.'); return }
    setBusy(true)
    try { const r = await api(url, {action}); notify(r.say); chime(); window.dispatchEvent(new Event('lw-approval-updated')) }
    catch (e) { notify((e as Error).message) } finally { setBusy(false) }
  }
  const pending = s?.current?.status === 'PENDING', approved = s?.current?.status === 'APPROVED', owner = role === 'owner'
  if (compact) return <Button gold disabled={busy || role === 'viewer'} onClick={() => act('REQUEST')}>{approved ? `v${s.version} approved ✓` : pending ? 'Waiting for owner' : 'Request Final Approval'}</Button>
  return <div className="lw-release-tool">
    {!releaseId ? <p className="lw-muted">Pick a release at the top first.</p> : !s ? <p className="lw-muted">Loading…</p> : <>
      <p>Version {s.version} · {approved ? <Badge tone="cyan">APPROVED</Badge> : pending ? <Badge tone="gold">WAITING FOR OWNER</Badge> : <Badge>NOT REQUESTED</Badge>}</p>
      {s.blockers.length > 0 && !approved && <><h4>Before it can be approved</h4><ol className="lw-blockers">{s.blockers.map((b: string) => <li key={b}>{b}</li>)}</ol></>}
      <div className="lw-partner-row">
        {!pending && !approved && <Button gold disabled={busy || role === 'viewer'} onClick={() => act('REQUEST')}>Request Final Approval</Button>}
        {pending && owner && <><Button gold disabled={busy} onClick={() => act('APPROVE')}>Approve version {s.version}</Button><Button disabled={busy} onClick={() => act('REJECT')}>Reject</Button></>}
        {pending && !owner && <span className="lw-muted">Waiting for the label owner.</span>}
      </div>
      {s.history.length > 0 && <small className="lw-source-line">History: {s.history.slice(0, 4).map((h: any) => `v${h.release_version} ${h.status.toLowerCase()} ${h.created_at.slice(0, 10)}`).join(' · ')}</small>}
    </>}
  </div>
}

export function DistributionPrep({labelId, releaseId, notify}: {labelId: string, releaseId: string, notify: N}) {
  const [subs, setSubs] = useState<any[] | null>(null), [open, setOpen] = useState<string | null>(null), [packet, setPacket] = useState<any>(null)
  const base = `/labels/${labelId}/releases/${releaseId}/submissions`
  useEffect(() => { setSubs(null); setOpen(null); setPacket(null); if (labelId && releaseId) api(base).then(d => setSubs(d.submissions)).catch(e => notify(e.message)) }, [labelId, releaseId])
  async function show(t: string) {
    if (open === t) { setOpen(null); return }
    try { setPacket(await api(`${base}/${t}`)); setOpen(t) } catch (e) { notify((e as Error).message) }
  }
  const copy = (v: string) => navigator.clipboard?.writeText(v).then(() => notify('Copied.')).catch(() => {})
  if (!releaseId) return <p className="lw-muted">Pick a release at the top first.</p>
  if (!subs) return <p className="lw-muted">Loading packets…</p>
  return <div className="lw-release-tool">
    <p className="lw-muted">Everything each site asks for, in its own order. Copy the READY values, answer the missing ones, and you press Submit on the official site. Or tell Codex/Claude "do my Studio2U tasks" and it fills the form for you.</p>
    {subs.map(s => <div key={s.target} className="lw-packet">
      <header><b>{s.target}</b><Badge tone={s.status === 'READY' ? 'cyan' : s.status === 'VERIFIED' ? 'cyan' : s.status === 'BLOCKED' ? 'gold' : 'muted'}>{s.status.replaceAll('_', ' ')}</Badge>{s.missing_count > 0 && <small>{s.missing_count} missing</small>}<Button onClick={() => show(s.target)}>{open === s.target ? 'Hide' : 'Prepare delivery'}</Button></header>
      {open === s.target && packet && <div>
        <div className="lw-partner-row"><a className="lw-button gold" href={packet.packet.officialUrl} target="_blank" rel="noreferrer noopener">Open {s.target} site</a></div>
        {packet.packet.missing.length > 0 && <><h4>Still needed</h4><ul>{packet.packet.missing.map((m: any) => <li key={m.key}>{m.question}</li>)}</ul></>}
        {packet.packet.sections.map((sec: any) => <div key={sec.title}><h4>{sec.title}</h4>{sec.fields.map((f: any) => <div key={f.key} className="lw-packet-field"><span>{f.label}</span>{f.status === 'READY' ? <button type="button" onClick={() => copy(Array.isArray(f.value) ? f.value.join(', ') : typeof f.value === 'object' ? JSON.stringify(f.value) : String(f.value))} title="Copy">{Array.isArray(f.value) ? f.value.join(', ') : typeof f.value === 'object' ? JSON.stringify(f.value) : String(f.value)} ⧉</button> : <Badge tone={f.status === 'MISSING' ? 'gold' : 'muted'}>{f.status.replaceAll('_', ' ')}</Badge>}</div>)}</div>)}
        {packet.packet.humanOnly.length > 0 && <small className="lw-source-line">You do: {packet.packet.humanOnly.join(' · ')}</small>}
      </div>}
    </div>)}
    {!subs.length && <p className="lw-muted">No packets for this release yet.</p>}
  </div>
}

export function PackageTools({labelId, release, assets, notify}: {labelId: string, release: any, assets: any[], notify: N}) {
  const [preview, setPreview] = useState<any>(null), [busy, setBusy] = useState(false)
  async function manifest() {
    if (!release) throw new Error('Pick a release at the top first.')
    const [intake, approval, subs] = await Promise.all([api(`/labels/${labelId}/releases/${release.id}/intake`), api(`/labels/${labelId}/releases/${release.id}/approval`).catch(() => null), api(`/labels/${labelId}/releases/${release.id}/submissions`).catch(() => ({submissions: []}))])
    return {
      manifestVersion: 1, generatedAt: new Date().toISOString(),
      release: {id: release.id, title: release.title, artist: release.artist, type: release.release_type, mode: release.release_mode, distributor: release.target_distributor, version: release.version, state: release.state},
      intake: intake.intake,
      files: assets.map(a => ({kind: a.kind, name: a.original_name, bytes: a.byte_size, sha256: a.sha256, releaseVersion: a.version})),
      finalApproval: approval ? {status: approval.current?.status ?? 'NOT_REQUESTED', version: approval.version, blockers: approval.blockers} : null,
      submissions: subs.submissions.map((s: any) => ({target: s.target, status: s.status, missing: s.missing_count, confirmation: s.confirmation_ref})),
      note: 'Manifest of what Studio2U holds for this release. Audio and artwork stay in your private storage; checksums prove which exact files were reviewed.'
    }
  }
  async function run(kind: 'preview' | 'build') {
    setBusy(true)
    try {
      const m = await manifest()
      if (kind === 'preview') { setPreview(m); return }
      if (!assets.some(a => a.kind === 'master' || a.kind === 'artwork')) throw new Error('Upload the master WAV or artwork first; there is nothing to package yet.')
      const res = await fetch(`/api/label-world/labels/${labelId}/releases/${release.id}/package.zip`)
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Package failed')
      const blob = await res.blob(), a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = (res.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/)?.[1] || 'release.zip'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000)
      notify('Release zip downloaded: audio, artwork and manifest.'); chime()
    } catch (e) { notify((e as Error).message) } finally { setBusy(false) }
  }
  return <>
    <div className="lw-partner-row"><Button disabled={busy} onClick={() => run('preview')}>Preview Package</Button><Button gold disabled={busy} onClick={() => run('build')}>Build Package</Button></div>
    {preview && <div className="lw-modal-backdrop" onClick={() => setPreview(null)}><section className="lw-modal" role="dialog" aria-modal="true" aria-label="Package preview" onClick={e => e.stopPropagation()}><header><h2>Package preview · v{preview.release.version}</h2><button aria-label="Close" onClick={() => setPreview(null)}>×</button></header>
      <p><b>{preview.release.artist} – {preview.release.title}</b> · {preview.release.type} · {preview.release.distributor}</p>
      <h4>Files</h4>{preview.files.length ? <ul>{preview.files.map((f: any) => <li key={f.sha256}>{f.kind}: {f.name} · {Math.round(f.bytes / 1024)} KB · <code>{f.sha256.slice(0, 16)}…</code></li>)}</ul> : <p className="lw-muted">No master or artwork uploaded yet.</p>}
      <h4>Final approval</h4><p>{preview.finalApproval?.status ?? 'Unknown'}{preview.finalApproval?.blockers?.length ? ` · ${preview.finalApproval.blockers.length} thing(s) to fix first` : ''}</p>
      <h4>Where it goes</h4><ul>{preview.submissions.map((s: any) => <li key={s.target}>{s.target}: {s.status.replaceAll('_', ' ')}{s.missing ? ` (${s.missing} missing)` : ''}</li>)}</ul>
      <Button gold onClick={() => { setPreview(null); run('build') }}>Download zip</Button>
    </section></div>}
  </>
}

export function AssignTask({labelId, role, notify}: {labelId: string, role: string, notify: N}) {
  const [open, setOpen] = useState(false), [who, setWho] = useState<AgentId>('builder'), [what, setWhat] = useState(''), [busy, setBusy] = useState(false)
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true)
    try {
      await api(`/labels/${labelId}/inbox/${who}/messages`, {content: `Task from the Executive: ${what.trim()}`, messageId: crypto.randomUUID()})
      notify(`Sent to ${agents[who].name}. It answers in their chat; your connected Codex/Claude does the work on its next run.`); chime(); setWhat(''); setOpen(false)
    } catch (e) { notify((e as Error).message) } finally { setBusy(false) }
  }
  if (!open) return <Button disabled={role === 'viewer'} onClick={() => labelId ? setOpen(true) : notify('Choose a label workspace first.')}>Assign task</Button>
  return <form className="lw-stacked-form lw-assign" onSubmit={send}>
    <label>Who<select value={who} onChange={e => setWho(e.target.value as AgentId)}>{(Object.keys(agents) as AgentId[]).filter(a => a !== 'executive').map(a => <option key={a} value={a}>{agents[a].name}</option>)}</select></label>
    <label>What to do<textarea required rows={2} maxLength={2000} value={what} onChange={e => setWhat(e.target.value)} placeholder="e.g. Check my newest single is registered at ASCAP"/></label>
    <div className="lw-partner-row"><Button type="submit" gold disabled={busy || !what.trim()}>Send task</Button><Button onClick={() => setOpen(false)}>Cancel</Button></div>
  </form>
}

/** Lyrics import: read a .txt / .lrc / .md file into the lyrics box (stays a draft until you save). */
export function LyricsImport({onText, notify}: {onText: (t: string) => void, notify: N}) {
  const ref = React.useRef<HTMLInputElement | null>(null)
  return <><Button onClick={() => ref.current?.click()}>Import</Button><input ref={ref} type="file" hidden accept=".txt,.lrc,.md,text/plain" onChange={async e => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
    if (f.size > 200000) { notify('That file is too big for lyrics (200 KB max).'); return }
    const t = (await f.text()).replace(/^\[\d{2}:\d{2}(?:\.\d+)?\]\s?/gm, '').trim()
    onText(t); notify(`Imported ${f.name}. Tap Save to keep it.`)
  }}/></>
}

const LANE_NAMES: Record<string, string> = {hiphop: 'Hip-Hop/Rap', rnb: 'R&B', pop: 'Pop', latin: 'Latin', country: 'Country', dance: 'Dance/Electronic'}
/** Carla's live charts (free public charts). Lane boxes filter; Refresh pulls fresh charts now. */
export function TrendsLive({labelId, role, notify, onAsk}: {labelId: string, role: string, notify: N, onAsk: (q: string) => void}) {
  const [d, setD] = useState<any>(null), [busy, setBusy] = useState(false), [lanes, setLanes] = useState<string[]>([])
  const load = () => labelId ? api(`/labels/${labelId}/research/trends/latest`).then(x => { setD(x); if (x?.report?.lanes?.length) setLanes(l => l.length ? l : x.report.lanes) }).catch(() => setD({report: null, rows: []})) : Promise.resolve()
  useEffect(() => { setD(null); setLanes([]); load() }, [labelId])
  async function refresh() { setBusy(true); try { await api(`/labels/${labelId}/research/trends`, {}); await load(); notify('Fresh charts pulled.'); chime() } catch (e) { notify((e as Error).message) } finally { setBusy(false) } }
  if (!labelId) return <p className="lw-muted">Choose a label workspace first.</p>
  const rows = (d?.rows ?? []) as any[]
  const laneOf = (r: any) => Object.keys(LANE_NAMES).find(k => String(r.period ?? '').includes(LANE_NAMES[k])) ?? null
  const shown = rows.filter(r => { const l = laneOf(r); return !l || !lanes.length || lanes.includes(l) }).slice(0, 25)
  return <div className="lw-release-tool">
    <div className="lw-chart-filters">{Object.entries(LANE_NAMES).map(([k, n]) => <label key={k}><input type="checkbox" checked={lanes.includes(k)} onChange={() => setLanes(x => x.includes(k) ? x.filter(y => y !== k) : [...x, k])}/>{n}</label>)}
      <Button gold disabled={busy || role === 'viewer'} onClick={refresh}>{busy ? 'Pulling charts…' : 'Refresh charts'}</Button></div>
    {!d ? <p className="lw-muted">Loading…</p> : !d.report ? <p className="lw-muted">No charts pulled yet. Tap "Refresh charts".</p> : <>
      <small className="lw-source-line">Pulled {new Date(d.report.observedAt).toLocaleString()} · Deezer, Apple Music, iTunes, YouTube · free public charts</small>
      <table><thead><tr><th>Song</th><th>Artist</th><th>Chart</th><th></th></tr></thead><tbody>{shown.map((r, i) => <tr key={i}><td>{r.source_url ? <a href={r.source_url} target="_blank" rel="noreferrer noopener">{r.track}</a> : r.track}</td><td>{r.artist}</td><td>{r.period}</td><td><button onClick={() => onAsk(`What can I learn from "${r.track}" by ${r.artist} for my own next release?`)}>Ask Carla</button></td></tr>)}</tbody></table>
    </>}
  </div>
}

/** Image AI switch: Auto (the provider your label uses) or any connected image provider. */
export function ImageProviderPicker({labelId, value, onChange}: {labelId: string, value: string, onChange: (v: string) => void}) {
  const [d, setD] = useState<any>(null)
  useEffect(() => { api(`/image-providers${labelId ? `?labelId=${encodeURIComponent(labelId)}` : ''}`).then(setD).catch(() => setD({available: [], auto: null})) }, [labelId])
  if (!d) return null
  if (!d.available.length) return <small className="lw-muted">Connect an image AI key (OpenAI, Google Gemini, xAI Grok or OpenRouter) in <b>AI setup</b> to make images.</small>
  return <label className="lw-inline-select">Image AI<select value={value} onChange={e => onChange(e.target.value)}><option value="auto">Auto ({d.available.find((a: any) => a.id === d.auto)?.name ?? d.available[0].name})</option>{d.available.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
}

/** Cover art: really made with the owner's image AI, saved as the release artwork. */
export function CoverArt({labelId, release, role, notify, onMade}: {labelId: string, release: any, role: string, notify: N, onMade: () => void}) {
  const [idea, setIdea] = useState(''), [provider, setProvider] = useState('auto'), [busy, setBusy] = useState(false), [last, setLast] = useState<any>(null)
  async function make() {
    if (!release) { notify('Pick a release at the top first.'); return }
    setBusy(true)
    try { const r = await api(`/labels/${labelId}/releases/${release.id}/cover`, {prompt: idea || undefined, provider}); setLast(r); notify(r.say); chime(); onMade() }
    catch (e) { notify((e as Error).message) } finally { setBusy(false) }
  }
  return <div className="lw-release-tool">
    <textarea rows={2} maxLength={1500} value={idea} onChange={e => setIdea(e.target.value)} placeholder="Optional idea: e.g. gold 22 on a night runway, grainy film look"/>
    <div className="lw-partner-row"><ImageProviderPicker labelId={labelId} value={provider} onChange={setProvider}/><Button gold disabled={busy || !release || role === 'viewer'} onClick={make}>{busy ? 'Making cover… (up to 2 min)' : 'Generate cover'}</Button></div>
    {last && <img className="lw-cover-preview" alt="Generated cover" src={`/api/label-world/labels/${labelId}/releases/${release.id}/artwork/${last.assetId}`}/>}
  </div>
}

/** Suno / Higgsfield / Genjitsu: your agent does it in your logged-in browser. */
export function CreativeTool({labelId, releaseId, tool, name, href, role, notify}: {labelId: string, releaseId: string, tool: string, name: string, href: string, role: string, notify: N}) {
  const [open, setOpen] = useState(false), [goal, setGoal] = useState(''), [busy, setBusy] = useState(false)
  async function go(e: React.FormEvent) { e.preventDefault(); setBusy(true); try { const r = await api(`/labels/${labelId}/creative`, {tool, goal, releaseId: releaseId || undefined}); notify(r.say); chime(); setGoal(''); setOpen(false) } catch (e) { notify((e as Error).message) } finally { setBusy(false) } }
  return <>
    <div className="lw-partner-row"><Button gold disabled={role === 'viewer'} onClick={() => labelId ? setOpen(!open) : notify('Choose a label workspace first.')}>Have my agent do it</Button><a className="lw-button" href={href} target="_blank" rel="noreferrer noopener">Open {name}</a></div>
    {open && <form className="lw-stacked-form lw-assign" onSubmit={go}><textarea required rows={2} maxLength={1500} value={goal} onChange={e => setGoal(e.target.value)} placeholder={tool === 'suno' ? 'e.g. A dark trap beat at 140 BPM for my next single' : tool === 'higgsfield' ? 'e.g. A 15-second visualizer for "22" for TikTok' : 'e.g. Cut my studio footage into a 30-second reel'}/><small className="lw-muted">Log in to {name} once in your browser. Your agent asks before spending credits or posting anything.</small><Button type="submit" gold disabled={busy || !goal.trim()}>Queue it</Button></form>}
  </>
}

/** Checkpoints + STOP: shown on every page. Agents ask here before Submit/Publish/Post/Sell/Send/Spend. */
export function ControlBar({labelId, notify}: {labelId: string, notify: N}) {
  const [d, setD] = useState<any>(null), [busy, setBusy] = useState<string | null>(null)
  const load = () => labelId ? api(`/labels/${labelId}/control`).then(setD).catch(() => setD(null)) : Promise.resolve(setD(null))
  useEffect(() => { setD(null); load(); const t = setInterval(load, 30000); const f = () => load(); window.addEventListener('focus', f); return () => { clearInterval(t); window.removeEventListener('focus', f) } }, [labelId])
  async function act(key: string, path: string, body: unknown) { setBusy(key); try { const r = await api(`/labels/${labelId}/${path}`, body); notify(r.say); chime(); await load() } catch (e) { notify((e as Error).message) } finally { setBusy(null) } }
  if (!labelId || !d) return null
  const owner = d.role === 'owner', editor = d.role !== 'viewer'
  const verb: Record<string, string> = {SUBMIT: 'Submit', PUBLISH: 'Publish', POST: 'Post', SELL: 'Sell', SEND: 'Send', SPEND: 'Spend', DELETE: 'Delete', OTHER: 'Do'}
  return <div id="checkpoints" className={`lw-control ${d.paused ? 'paused' : ''}`}>
    <div className="lw-control-head">
      <b>{d.paused ? '⏸ Your agents are stopped' : d.pending.length ? `${d.pending.length} thing(s) waiting for your OK` : d.running ? `Your agents are working (${d.running})` : 'Your agents ask you here before anything big happens'}</b>
      {d.paused ? (owner && <Button gold disabled={busy === 'resume'} onClick={() => act('resume', 'control/resume', {})}>Resume</Button>) : (editor && <button className="lw-stop" disabled={busy === 'stop'} onClick={() => confirm('Stop every agent on this label right now?') && act('stop', 'control/stop', {})}>STOP</button>)}
    </div>
    {d.pending.map((c: any) => <div key={c.id} className="lw-checkpoint">
      <div><Badge tone="gold">{verb[c.kind] ?? c.kind}</Badge> <b>{c.title}</b>{c.site && <small> · {c.site}</small>}{c.amountUsd != null && <small> · ${c.amountUsd.toFixed(2)}</small>}
        {c.detail && <p>{c.detail}</p>}{c.previewUrl && <a href={c.previewUrl} target="_blank" rel="noreferrer noopener">Look first</a>}<small className="lw-muted"> asked by {c.requestedBy}</small></div>
      {owner ? <div className="lw-partner-row"><Button gold disabled={!!busy} onClick={() => act('a' + c.id, `checkpoints/${c.id}/decision`, {decision: 'APPROVED'})}>Yes, do it</Button><Button disabled={!!busy} onClick={() => act('d' + c.id, `checkpoints/${c.id}/decision`, {decision: 'DENIED'})}>No</Button></div> : <small className="lw-muted">Waiting for the label owner</small>}
    </div>)}
  </div>
}
