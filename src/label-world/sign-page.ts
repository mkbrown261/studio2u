// Public e-signature page for collaborators. No Studio2U account: the private link
// (256-bit token, only its SHA-256 is stored) plus confirming the invited email.
// Same-origin JSON POST, so the global CSRF middleware still applies.
import { html, raw } from 'hono/html'
import { signerView, signerAct, signedCopyForToken } from './autonomy/agreements'
import { ServiceError } from './autonomy/service'

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const css = `*{box-sizing:border-box}body{margin:0;background:#0d0c14;color:#ece8f4;font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:760px;margin:auto;padding:28px 18px 80px}
h1{font-size:26px;margin:.2em 0}.muted{color:#b3abc4}.card{background:#191725;border:1px solid #362f47;border-radius:14px;padding:18px;margin:16px 0}
pre{white-space:pre-wrap;word-break:break-word;font:13.5px/1.55 ui-monospace,Menlo,Consolas,monospace;background:#0f0e17;border:1px solid #2c2639;border-radius:10px;padding:14px;max-height:60vh;overflow:auto}
label{display:block;margin:12px 0 4px;font-weight:600}input[type=email],input[type=text],textarea{width:100%;padding:12px;border-radius:9px;border:1px solid #4b4260;background:#221f30;color:#fff;font-size:16px}
.check{display:flex;gap:10px;align-items:flex-start;font-weight:400}.check input{margin-top:5px;width:20px;height:20px}
button{padding:13px 18px;border-radius:10px;border:0;font-weight:700;font-size:16px;cursor:pointer}.gold{background:#d9b867;color:#18121f}.ghost{background:transparent;color:#ffb1a7;border:1px solid #6b3a40}
button:disabled{opacity:.45;cursor:not-allowed}.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700}
.SIGNED{background:#1f4d3a;color:#7ff0c0}.WAITING{background:#3a3550;color:#d4cbe8}.DECLINED{background:#4d1f2a;color:#ffb1a7}#msg{min-height:1.5em;color:#e8bf6b;font-weight:600}
.sig{font-family:"Brush Script MT","Segoe Script",cursive;font-size:28px;color:#e8bf6b}a{color:#e8bf6b}code{font-size:12px;word-break:break-all}`

function shell(title: string, body: string) {
  return html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title><style>${raw(css)}</style></head><body><main>${raw(body)}</main></body></html>`
}
const noStore = (c: any) => { c.header('Cache-Control', 'no-store'); c.header('X-Robots-Tag', 'noindex, nofollow') }

export function installSignPage(app: any) {
  app.get('/label-world/sign/:token', async (c: any) => {
    noStore(c)
    const token = c.req.param('token')
    let v: Awaited<ReturnType<typeof signerView>>
    try { v = await signerView(c.env.DB, token, c.req.header('CF-Connecting-IP') ?? null) }
    catch (e) { return c.html(shell('Signing link not valid', `<h1>This link doesn't work</h1><p class="muted">${esc(e instanceof ServiceError ? e.message : 'Something went wrong.')}</p>`), e instanceof ServiceError ? e.status : 500) }
    const a = v.agreement, p = v.party, open = a.status === 'OUT_FOR_SIGNATURE' && !p.signedAt && !p.declinedAt
    const signers = v.signers.map(s => `<li>${esc(s.name)} <span class="pill ${s.status}">${s.status === 'SIGNED' ? 'Signed' : s.status === 'DECLINED' ? 'Declined' : 'Waiting'}</span></li>`).join('')
    const done = p.signedAt ? `<div class="card"><p>You signed this on ${esc(p.signedAt)} UTC as</p><p class="sig">${esc(p.signatureName ?? '')}</p></div>` : p.declinedAt ? `<div class="card"><p>You declined this agreement on ${esc(p.declinedAt)} UTC. The sender has been told.</p></div>` : ''
    const closed = !open && !p.signedAt && !p.declinedAt ? `<div class="card"><p><b>This agreement is ${esc(a.status.toLowerCase().replace(/_/g, ' '))}.</b> ${a.status === 'SUPERSEDED' ? 'A newer version replaced it. Ask the sender for your new link.' : 'No signature is needed on this version.'}</p></div>` : ''
    const form = open ? `<div class="card" id="signbox"><h2 style="margin-top:0">Sign</h2>
      <label for="email">Confirm your email (the one this invite was sent to: ${esc(p.emailHint)})</label><input id="email" type="email" autocomplete="email" required>
      <label class="check"><input id="consent" type="checkbox"> <span>I agree to use electronic records and signatures for this agreement, and I know I can ask the sender for a paper copy. (ESIGN Act)</span></label>
      <label for="sig">Type your full legal name to sign: <b>${esc(p.legalName)}</b></label><input id="sig" type="text" autocomplete="name" maxlength="120">
      <p class="muted" style="font-size:14px">By clicking "I agree and sign" you sign the document above, fingerprint <code>${esc(a.docHash)}</code>. If the document changes, you will be asked to sign again.</p>
      <div class="row"><button class="gold" id="signbtn" disabled>I agree and sign</button><button class="ghost" id="declinebtn" type="button">I don't agree</button></div>
      <div id="declinebox" hidden><label for="reason">What should change? (optional, the sender will see this)</label><textarea id="reason" rows="3" maxlength="1000"></textarea><div class="row"><button class="ghost" id="declineconfirm" type="button">Decline this agreement</button></div></div>
      <p id="msg" role="status"></p></div>` : ''
    const script = open ? `<script>(()=>{const $=i=>document.getElementById(i),hash=${JSON.stringify(a.docHash)},legal=${JSON.stringify(p.legalName.toLowerCase().replace(/\s+/g, ' '))};
const ok=()=>{$('signbtn').disabled=!($('consent').checked&&$('email').value.includes('@')&&$('sig').value.trim().toLowerCase().replace(/\\s+/g,' ')===legal)};['consent','email','sig'].forEach(i=>$(i).addEventListener('input',ok));$('consent').addEventListener('change',ok);
async function send(body){$('msg').textContent='Saving…';const r=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,email:$('email').value,docHash:hash})});const d=await r.json().catch(()=>({}));if(!r.ok){$('msg').textContent=d.error||'Something went wrong';return}location.reload()}
$('signbtn').addEventListener('click',()=>send({action:'sign',consent:$('consent').checked,signatureName:$('sig').value}));
$('declinebtn').addEventListener('click',()=>{$('declinebox').hidden=false});$('declineconfirm').addEventListener('click',()=>{if(!$('email').value.includes('@')){$('msg').textContent='Confirm your email first';return}send({action:'decline',reason:$('reason').value})})})()</script>` : ''
    return c.html(shell(`Sign: ${a.workTitle}`, `<p class="muted">${esc(a.labelName)} sent you a split sheet to sign · Studio2U</p><h1>"${esc(a.workTitle)}" split sheet</h1>
      <p class="muted">Version ${a.version}. Read it all. Check your name, role and percentages. No account needed.</p>${done}${closed}
      <pre tabindex="0" aria-label="Agreement text">${esc(a.document)}</pre>
      <div class="card"><b>Signers</b><ul>${signers}</ul><a href="${esc(c.req.path)}/copy">Download a copy${a.status === 'FULLY_SIGNED' ? ' (signed, with audit certificate)' : ''}</a></div>${form}
      <p class="muted" style="font-size:13px">Studio2U records when you open, consent, sign or decline, with your IP address and device, so everyone has proof of what was agreed. This is a record-keeping tool, not legal advice. Questions? Ask the person who sent you this link before signing.</p>${script}`))
  })
  app.post('/label-world/sign/:token', async (c: any) => {
    noStore(c)
    try {
      const b = await c.req.json().catch(() => null)
      if (!b || typeof b !== 'object') throw new ServiceError('JSON body required')
      return c.json(await signerAct(c.env.DB, c.req.param('token'), b, { ip: c.req.header('CF-Connecting-IP') ?? null, ua: c.req.header('User-Agent') ?? null }))
    } catch (e) { return e instanceof ServiceError ? c.json({ error: e.message }, e.status) : c.json({ error: 'Request failed' }, 500) }
  })
  app.get('/label-world/sign/:token/copy', async (c: any) => {
    noStore(c)
    try { const f = await signedCopyForToken(c.env.DB, c.req.param('token')); return c.body(f.text, 200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${f.filename}"` }) }
    catch (e) { return c.text(e instanceof ServiceError ? e.message : 'Request failed', e instanceof ServiceError ? e.status : 500) }
  })
}
