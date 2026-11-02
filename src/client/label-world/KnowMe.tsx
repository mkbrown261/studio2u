// "Know me": your team can't help you until they know you.
// Phone-first: % known, "Is this you?" profile cards, 3 questions at a time, what was
// found (confirm or remove), and what your agent reads next (read-only analytics).
import React, {useEffect, useState} from 'react'
import {api, Badge, Button} from './ui'

type N = (s: string) => void
const PLATFORM: Record<string, string> = {instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', spotify: 'Spotify', apple_music: 'Apple Music', soundcloud: 'SoundCloud', x: 'X', facebook: 'Facebook', bandcamp: 'Bandcamp', genius: 'Genius', deezer: 'Deezer', audiomack: 'Audiomack', website: 'Website', press: 'Press', discogs: 'Discogs', musicbrainz: 'MusicBrainz', wikipedia: 'Wikipedia', other: 'Link'}
const LABEL: Record<string, string> = {goals: 'Goals', ownsMasters: 'Owns masters', distributor: 'Distributor', story: 'Story', hometown: 'From', genres: 'Sound', influences: 'Influences', audience: 'Audience', strengths: 'Working best', challenges: 'Holding you back', upcomingRelease: 'Next release', releaseCadence: 'Release pace', contentStyle: 'Content style', brandWords: 'In 3 words', doNotDo: 'Never do', budgetMonthly: 'Monthly budget', team: 'Team', pastPlacements: 'Past wins', similarArtists: 'Similar artists', topTracks: 'Top tracks', publicFans: 'Deezer fans', ipiPublic: 'Public IPI', artistType: 'Type', press: 'Press'}
const show = (v: any) => Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : typeof v === 'number' ? v.toLocaleString() : String(v)

export function KnowMe({labelId, editable, notify, onAsk}: {labelId: string, editable: boolean, notify: N, onAsk: (q: string) => void}) {
  const [d, setD] = useState<any>(null), [busy, setBusy] = useState(false), [answers, setAnswers] = useState<Record<string, any>>({}), [link, setLink] = useState('')
  const load = () => api(`/labels/${labelId}/know-me`).then(setD).catch(e => notify(e.message))
  useEffect(() => { setD(null); load() }, [labelId])
  if (!d) return <div className="lw-mf-empty"><p>Loading…</p></div>
  async function discover() { setBusy(true); try { const r = await api(`/labels/${labelId}/know-me/discover`, {}); notify(r.say); load() } catch (e) { notify((e as Error).message) } finally { setBusy(false) } }
  async function decide(id: string, decision: 'CONFIRMED' | 'NOT_ME') { try { await api(`/labels/${labelId}/know-me/links/${id}`, {decision}); load() } catch (e) { notify((e as Error).message) } }
  async function addLink() { try { await api(`/labels/${labelId}/know-me/links`, {url: link.trim()}); setLink(''); load() } catch (e) { notify((e as Error).message) } }
  async function saveAnswers() {
    const facts: Record<string, any> = {}
    for (const q of d.questions) { const v = answers[q.key]; if (v === undefined || v === '') continue; facts[q.key] = q.kind === 'num' ? Number(v) : v }
    if (!Object.keys(facts).length) { notify('Answer at least one.'); return }
    setBusy(true); try { await api(`/labels/${labelId}/know-me/facts`, {facts}); setAnswers({}); notify('Got it. Your team knows you better now.'); load() } catch (e) { notify((e as Error).message) } finally { setBusy(false) }
  }
  async function confirm(key: string, ok: boolean) { try { await api(`/labels/${labelId}/know-me/facts/${key}/confirm`, {confirm: ok}); load() } catch (e) { notify((e as Error).message) } }
  const suggested = d.links.filter((l: any) => l.status === 'SUGGESTED'), confirmed = d.links.filter((l: any) => l.status === 'CONFIRMED')
  const known = Object.entries<any>(d.facts).filter(([, v]) => v.confirmed)
  return <div className="lw-know">
    <section className="lw-know-head">
      <div className="lw-know-ring" style={{['--p' as any]: d.completeness}}><b>{d.completeness}%</b><small>known</small></div>
      <div><h3>{d.identity?.artistName ? `How well your team knows ${d.identity.artistName}` : 'Your team doesn\'t know you yet'}</h3>
        <p>They can't help you unless they know you. Everything here goes into every agent's brief: your goals, your sound, your audience, what's working.</p>
        {d.next.length > 0 && <ol className="lw-know-next">{d.next.slice(0, 3).map((n: string) => <li key={n}>{n}</li>)}</ol>}
      </div>
    </section>

    {!d.identity && <p className="lw-mf-note">Start in <a href="#identity">Who I am</a> with your artist name.</p>}
    {d.identity && editable && <div className="lw-know-actions">
      <Button gold disabled={busy} onClick={discover}>{busy ? 'Searching…' : d.discoveredAt ? 'Search again' : 'Find me everywhere'}</Button>
      <Button onClick={() => onAsk(`Get to know me. Use studio2u_guide know_me: confirm my profiles with me, search the web for my socials and press, read my analytics read-only (account totals and my last 10 posts), and ask me the next questions. Then tell me who you think I am.`)}>Have Carla get to know me</Button>
    </div>}

    {suggested.length > 0 && <section className="lw-know-card"><h4>Is this you? <Badge tone="gold">{suggested.length}</Badge></h4><p className="lw-muted">Similar names are common. Only confirm what's really you.</p>
      <div className="lw-know-links">{suggested.map((l: any) => <div key={l.id} className="lw-know-link">
        <span><b>{PLATFORM[l.platform] ?? l.platform}</b> <Badge tone={l.confidence === 'STRONG' ? 'green' : l.confidence === 'LIKELY' ? 'gold' : 'muted'}>{l.confidence.toLowerCase()}</Badge><a href={l.url} target="_blank" rel="noopener noreferrer">{l.url.replace(/^https:\/\/(www\.)?/, '').slice(0, 60)}</a><small>{l.evidence}</small></span>
        {editable && <div className="lw-know-yn"><button className="yes" onClick={() => decide(l.id, 'CONFIRMED')}>That's me</button><button onClick={() => decide(l.id, 'NOT_ME')}>Not me</button></div>}
      </div>)}</div></section>}

    {d.questions.length > 0 && editable && <section className="lw-know-card"><h4>A few questions <small className="lw-muted">({d.questionsLeft} left)</small></h4>
      {d.questions.map((q: any) => <label key={q.key} className="lw-know-q"><span>{q.question}</span>
        {q.kind === 'bool' ? <div className="lw-know-yn">{[['Yes', true], ['No', false]].map(([t, v]) => <button key={String(t)} type="button" className={answers[q.key] === v ? 'yes' : ''} onClick={() => setAnswers({...answers, [q.key]: v})}>{t as string}</button>)}</div>
          : q.kind === 'num' ? <input type="number" min={0} value={answers[q.key] ?? ''} onChange={e => setAnswers({...answers, [q.key]: e.target.value})}/>
          : <textarea rows={q.kind === 'list' ? 1 : 2} maxLength={1500} placeholder={q.suggested ? `It looks like: ${show(q.suggested)}` : q.kind === 'list' ? 'Separate with commas' : ''} value={answers[q.key] ?? ''} onChange={e => setAnswers({...answers, [q.key]: e.target.value})}/>}
      </label>)}
      <Button gold disabled={busy} onClick={saveAnswers}>Save answers</Button></section>}

    {d.toConfirm.length > 0 && <section className="lw-know-card"><h4>What we found, is it right?</h4>
      {d.toConfirm.map((f: any) => <div key={f.key} className="lw-know-fact"><span><b>{LABEL[f.key] ?? f.key}</b>{show(f.value)}<small>{f.source === 'PUBLIC' ? 'Public music data' : 'Found by your agent'}{f.evidence ? ` · ${f.evidence}` : ''}</small></span>{editable && <div className="lw-know-yn"><button className="yes" onClick={() => confirm(f.key, true)}>Right</button><button onClick={() => confirm(f.key, false)}>Wrong</button></div>}</div>)}</section>}

    {(known.length > 0 || confirmed.length > 0) && <section className="lw-know-card"><h4>What your team knows</h4>
      {known.map(([k, v]) => <div key={k} className="lw-know-fact"><span><b>{LABEL[k] ?? k}</b>{show(v.value)}</span></div>)}
      {confirmed.length > 0 && <div className="lw-know-chips">{confirmed.map((l: any) => <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer">{PLATFORM[l.platform] ?? l.platform}</a>)}</div>}
    </section>}

    <section className="lw-know-card"><h4>Your numbers</h4>
      {d.social.accounts.length || d.social.last10.length ? <>
        <div className="lw-know-stats">{d.social.accounts.map((a: any) => <div key={a.platform}><b>{PLATFORM[a.platform] ?? a.platform}</b>{Object.entries(a.metrics).slice(0, 4).map(([k, v]) => <small key={k}>{k}: {show(v)}</small>)}</div>)}
          {d.social.avgViews != null && <div><b>Last {d.social.last10.length} posts</b><small>avg views: {d.social.avgViews.toLocaleString()}</small>{d.social.avgRetention != null && <small>avg 3s retention: {d.social.avgRetention}%</small>}{d.social.bestPost && <small>best: {d.social.bestPost.title.slice(0, 40)} ({d.social.bestPost.views.toLocaleString()})</small>}</div>}</div>
      </> : <p className="lw-muted">Not read yet. Your agent opens your Spotify for Artists, YouTube Studio, TikTok and Instagram insights and your distributor while you're logged in, and only reads: account totals and your last 10 posts (views, watch time, retention). It never posts, likes, follows or opens DMs.</p>}
    </section>

    {editable && <section className="lw-know-card"><h4>Add a link that's you</h4><div className="lw-mf-row"><input value={link} onChange={e => setLink(e.target.value)} placeholder="instagram.com/yourname, a press article, your site…" maxLength={500}/><Button disabled={!link.trim()} onClick={addLink}>Add</Button></div></section>}
  </div>
}
