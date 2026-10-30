// Merch tab: sell shirts/hoodies/hats with your own art through your free Fourthwall shop.
// No inventory: Fourthwall prints and ships each order. You approve every design and press Publish.
import React, {useEffect, useState} from 'react'
import {api, chime, Badge, Button} from './ui'

type N = (s: string) => void
const usd = (n: number) => `$${(n ?? 0).toFixed(2)}`

export function Merch({labelId, editable, notify, onAsk}: {labelId: string, editable: boolean, notify: N, onAsk: (q: string) => void}) {
  const [d, setD] = useState<any>(null), [busy, setBusy] = useState<string | null>(null), [sales, setSales] = useState<any>(null)
  const [prompt, setPrompt] = useState(''), [title, setTitle] = useState(''), [make, setMake] = useState<{designId: string, kind: string} | null>(null)
  const base = `/labels/${labelId}/merch`
  const load = () => api(base).then(setD).catch(e => notify(e.message))
  useEffect(() => { setD(null); setSales(null); load() }, [labelId])
  useEffect(() => { if (d?.shop) api(`${base}/sales`).then(setSales).catch(() => {}) }, [d?.shop?.id])
  async function run(key: string, fn: () => Promise<any>, ok?: string) { setBusy(key); try { const r = await fn(); if (ok || r?.say) { notify(ok ?? r.say); chime() } await load(); return r } catch (e) { notify((e as Error).message) } finally { setBusy(null) } }
  if (!d) return <p className="lw-muted">Loading…</p>
  const isOwner = d.role === 'owner'

  async function connect(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); await run('connect', () => api(`${base}/shop`, {username: f.get('username'), password: f.get('password')})) }
  async function upload(file: File) {
    setBusy('upload')
    try {
      const r = await fetch(`/api/label-world${base}/designs/upload`, {method: 'POST', headers: {'Content-Type': 'image/png', 'X-Title': encodeURIComponent(title || file.name.replace(/\.png$/i, '').slice(0, 100))}, body: file})
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Upload failed')
      notify(j.warnings?.length ? j.warnings.join(' ') : 'Design uploaded. Approve it to make products.'); chime(); setTitle(''); await load()
    } catch (e) { notify((e as Error).message) } finally { setBusy(null) }
  }
  const generate = (ideaId?: string) => run('gen' + (ideaId ?? ''), () => api(`${base}/designs/generate`, ideaId ? {ideaId} : {prompt, title: title || undefined}).then(r => { setPrompt(''); setTitle(''); return r }), 'Design ready. Approve it if you like it.')
  const decide = (id: string, decision: 'APPROVED' | 'REJECTED') => {
    if (decision === 'APPROVED' && !confirm('Do you own this art (you made it, or paid for it with the rights), and it uses no other brands, characters or real people\'s faces?')) return
    return run('dec' + id, () => api(`${base}/designs/${id}/decision`, {decision, ownsRights: decision === 'APPROVED'}), decision === 'APPROVED' ? 'Approved. Pick a product to put it on.' : 'Removed.')
  }

  return <div className="lw-office lw-merch">
    <section className="lw-office-head"><div><h3>Merch, no inventory</h3><p className="lw-muted">Your art on shirts, hoodies, hats, posters and more. Fans buy from your free Fourthwall shop; Fourthwall prints, ships, handles sales tax and support. You keep the profit you set.</p></div>
      {d.shop && <Badge tone={d.shop.status === 'LIVE' ? 'green' : 'gold'}>{d.shop.name} · {String(d.shop.status ?? '').toLowerCase().replace(/_/g, ' ')}</Badge>}</section>

    {!d.shop && <section className="lw-merch-step"><h4>1. Connect your free Fourthwall shop</h4>
      <ol className="lw-merch-how"><li>Sign up free at <a href="https://fourthwall.com" target="_blank" rel="noopener noreferrer">fourthwall.com</a> (no card needed to start). Add your payout info there yourself.</li><li>In Fourthwall: <b>Settings → For developers → Create API user</b>.</li><li>Paste the API username and password here. It's a shop key, not your login; it's stored encrypted and never shown again.</li></ol>
      {isOwner ? <form onSubmit={connect} className="lw-form-two"><label>API username<input name="username" required autoComplete="off" maxLength={200}/></label><label>API password<input name="password" type="password" required autoComplete="off" maxLength={300}/></label><Button gold type="submit" disabled={busy === 'connect'}>{busy === 'connect' ? 'Checking…' : 'Connect shop'}</Button></form> : <p className="lw-muted">Only the label owner can connect the shop.</p>}
    </section>}

    {sales && <section className="lw-merch-sales"><div><strong>{sales.orders}</strong><span>orders</span></div><div><strong>{sales.items}</strong><span>items sold</span></div><div><strong>{usd(sales.salesUsd)}</strong><span>sales</span></div><div><strong>{usd(sales.profitBeforeCardFeesUsd)}</strong><span>your profit*</span></div><small>*Before card fees. Payouts happen inside Fourthwall.</small></section>}

    {editable && <section className="lw-merch-step"><h4>{d.shop ? '2' : 'Meanwhile'}. Make a design</h4>
      <label>Name it<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder='e.g. "22" tour tee'/></label>
      <label>Describe it (or upload your own PNG below)<textarea rows={3} maxLength={2000} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder='e.g. Big gold "22" in graffiti letters with a broken heart, black and gold, streetwear vibe'/></label>
      <div className="lw-mf-row"><Button gold disabled={!prompt.trim() || !!busy} onClick={() => generate()}>{busy === 'gen' ? 'Making it… (up to a minute)' : 'Make it with AI (~10¢, your OpenAI key)'}</Button>
        <label className="lw-button lw-merch-file">{busy === 'upload' ? 'Uploading…' : 'Upload my PNG'}<input type="file" accept="image/png" hidden disabled={!!busy} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = '' }}/></label>
        <button className="lw-link-btn" onClick={() => onAsk('Read my Know me brief and save 3 merch design ideas that fit my look and my top songs (use studio2u_guide merch → add_merch_idea). Original art only.')}>Have the Builder suggest 3 ideas</button></div>
      <p className="lw-muted small">Best results: transparent background, 2250×2700 px or bigger. Only art you own: no other brands, logos, characters or real people's faces.</p>
    </section>}

    {d.designs.length > 0 && <section><h4>Designs</h4><div className="lw-merch-grid">{d.designs.map((x: any) => <article key={x.id} className={`lw-merch-card ${x.status.toLowerCase()}`}>
      {x.has_image ? <img src={`/api/label-world${base}/designs/${x.id}/image`} alt={x.title} loading="lazy"/> : <div className="lw-merch-idea">{x.prompt}</div>}
      <b>{x.title}</b><small>{x.source === 'IDEA' ? `Idea from ${x.created_by}` : x.source === 'AI' ? 'Made with AI' : 'Your upload'}{x.has_image && !x.transparent ? ' · no transparent background' : ''}</small>
      <Badge tone={x.status === 'APPROVED' ? 'green' : x.status === 'REJECTED' ? 'muted' : 'gold'}>{x.status === 'IDEA' ? 'idea' : x.status === 'DRAFT' ? 'needs your OK' : x.status.toLowerCase()}</Badge>
      {editable && <div className="lw-mf-draft-actions">
        {x.status === 'IDEA' && <Button gold disabled={!!busy} onClick={() => generate(x.id)}>{busy === 'gen' + x.id ? 'Making…' : 'Make it (~10¢)'}</Button>}
        {x.status === 'DRAFT' && <><Button onClick={() => decide(x.id, 'REJECTED')}>No</Button><button className="lw-mf-approve" onClick={() => decide(x.id, 'APPROVED')}>Approve</button></>}
        {x.status === 'APPROVED' && d.shop && <Button gold onClick={() => setMake({designId: x.id, kind: 'tee'})}>Put it on a product</Button>}
        {x.status === 'APPROVED' && !d.shop && <small>Connect your shop to make products.</small>}
      </div>}
    </article>)}</div></section>}

    {make && <MakeProduct base={base} make={make} setMake={setMake} kinds={d.kinds} busy={busy} onMake={body => run('make', () => api(`${base}/products`, body)).then(r => { if (r) setMake(null) })}/>}

    {d.products.length > 0 && <section><h4>Products</h4><div className="lw-merch-grid">{d.products.map((p: any) => <article key={p.id} className="lw-merch-card">
      {p.mockups > 0 && <img src={`/api/label-world${base}/products/${p.id}/mockups/0`} alt={`${p.name} mockup`} loading="lazy"/>}
      <b>{p.name}</b><small>{usd(p.price)} · you keep about {usd(p.keep)} each · {p.colors.join(', ')}</small>
      {p.mockups > 1 && <details><summary>{p.mockups} mockups</summary><div className="lw-merch-thumbs">{Array.from({length: Math.min(p.mockups, 8)}, (_, i) => <img key={i} src={`/api/label-world${base}/products/${p.id}/mockups/${i}`} alt="" loading="lazy"/>)}</div></details>}
      <Badge tone={p.state === 'PUBLIC' ? 'green' : 'gold'}>{p.state === 'PUBLIC' ? 'for sale' : 'hidden'}</Badge>
      <div className="lw-mf-draft-actions">
        {p.state === 'HIDDEN' && (isOwner ? <button className="lw-mf-approve" disabled={!!busy} onClick={() => confirm(`Put "${p.name}" on sale at ${usd(p.price)}?`) && run('pub' + p.id, () => api(`${base}/products/${p.id}/state`, {state: 'PUBLIC'}), 'It\'s for sale. Share your shop link!')}>Publish</button> : <small>The owner presses Publish.</small>)}
        {p.state === 'PUBLIC' && editable && <Button onClick={() => run('hide' + p.id, () => api(`${base}/products/${p.id}/state`, {state: 'HIDDEN'}), 'Hidden from your shop.')}>Hide</Button>}
        {d.shop?.publicDomain && <a className="lw-link-btn" href={`https://${d.shop.publicDomain}`} target="_blank" rel="noopener noreferrer">Open my shop</a>}
      </div>
    </article>)}</div></section>}

    <details className="lw-muted small"><summary>How the money works</summary><ul>{d.howItWorks.map((h: string) => <li key={h}>{h}</li>)}</ul></details>
  </div>
}

function MakeProduct({base, make, setMake, kinds, busy, onMake}: {base: string, make: {designId: string, kind: string}, setMake: (m: any) => void, kinds: any[], busy: string | null, onMake: (b: any) => void}) {
  const [t, setT] = useState<any>(null), [margin, setMargin] = useState<number>(15), [colors, setColors] = useState<string[]>([])
  useEffect(() => { setT(null); api(`${base}/template/${make.kind}`).then(x => { setT(x); setMargin(x.defaultMargin); setColors(x.defaultColors) }).catch(() => {}) }, [make.kind])
  const price = t ? t.base + margin : 0, fee = price * 0.029 + 0.3
  return <section className="lw-merch-step"><h4>3. Put it on a product</h4>
    <div className="lw-merch-kinds">{kinds.map(k => <button key={k.kind} className={make.kind === k.kind ? 'on' : ''} onClick={() => setMake({...make, kind: k.kind})}>{k.label}<small>from {usd(k.base)}</small></button>)}</div>
    {!t ? <p className="lw-muted">Checking today's price…</p> : <>
      <p className="lw-muted small">{t.product}. Fourthwall's cost {usd(t.base)}{t.baseTo > t.base ? ` (bigger sizes up to ${usd(t.baseTo)})` : ''}{t.printArea ? ` · print area ${t.printArea}` : ''}.</p>
      {t.colors.length > 1 && <div className="lw-merch-colors">{t.colors.slice(0, 24).map((c: any) => <button key={c.name} title={c.name} className={colors.includes(c.name) ? 'on' : ''} style={{background: c.hex ?? undefined}} onClick={() => setColors(colors.includes(c.name) ? colors.filter(x => x !== c.name) : [...colors, c.name].slice(0, 12))}><span>{c.name}</span></button>)}</div>}
      <label>Your profit per item: {usd(margin)}<input type="range" min={1} max={60} step={1} value={margin} onChange={e => setMargin(Number(e.target.value))}/></label>
      <p className="lw-merch-math">Fans pay <b>{usd(price)}</b> + shipping · card fee ≈ {usd(fee)} · <b>you keep ≈ {usd(margin - fee)}</b> per sale</p>
      <div className="lw-mf-row"><Button onClick={() => setMake(null)}>Cancel</Button><Button gold disabled={busy === 'make' || !colors.length} onClick={() => onMake({designId: make.designId, kind: make.kind, profitMargin: margin, colors, base: t.base})}>{busy === 'make' ? 'Fourthwall is making mockups…' : 'Make mockups (stays hidden)'}</Button></div>
    </>}
  </section>
}
