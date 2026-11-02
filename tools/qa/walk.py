# Browser walkthrough: every employee page + Money Found tab, as owner and viewer.
# Logs page errors, failed API calls, and every disabled button (with its label).
import json, sys, asyncio
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000'
PAGES = [('hq', '/label-world'), ('executive', '/label-world/agents/executive'), ('partner', '/label-world/agents/partner'),
         ('researcher', '/label-world/agents/researcher'), ('reviewer', '/label-world/agents/reviewer'), ('builder', '/label-world/agents/builder'),
         ('inbox', '/label-world/inbox')]
TABS = ['knowme', 'merch', 'report', 'cases', 'agreements', 'statements', 'soundexchange', 'content', 'catalog', 'identity']
async def visit(ctx, name, url, out, after=None):
    page = await ctx.new_page(); errs, bad = [], []
    page.on('pageerror', lambda e: errs.append(str(e)[:200]))
    page.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
    page.on('response', lambda r: bad.append(f'{r.status} {r.request.method} {r.url.replace(BASE, "")[:120]}') if r.status >= 400 and '/api/' in r.url else None)
    await page.goto(BASE + url, wait_until='networkidle', timeout=45000)
    await page.wait_for_timeout(1500)
    if after: await after(page); await page.wait_for_timeout(2000)
    dis = await page.evaluate("""()=>[...document.querySelectorAll('button:disabled,input:disabled,select:disabled,textarea:disabled')].filter(e=>e.getClientRects().length).map(e=>(e.innerText||e.getAttribute('aria-label')||e.placeholder||e.name||e.type||'?').trim().replace(/\\s+/g,' ').slice(0,60))""")
    btns = await page.evaluate("""()=>[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length).length""")
    text = (await page.evaluate("()=>document.body.innerText"))
    out[name] = {'errors': sorted(set(errs))[:8], 'failedApi': sorted(set(bad))[:12], 'disabled': dis, 'buttons': btns,
                 'flags': [w for w in ['undefined', 'NaN', '[object Object]', 'Request failed', 'not implemented', 'Coming soon', 'pending', 'Unavailable', 'not connected', 'Not connected'] if w in text]}
    await page.close()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        report = {}
        for who, tok in [('owner', 'qa-owner-session'), ('viewer', 'qa-viewer-session')]:
            ctx = await b.new_context(viewport={'width': 1440, 'height': 1000})
            await ctx.add_cookies([{'name': 'studio2u_session', 'value': tok, 'url': BASE}])
            await ctx.add_init_script("try{localStorage.setItem('lw-label','qa-label')}catch{}")
            out = {}
            for n, u in PAGES: await visit(ctx, n, u, out)
            if who == 'owner':
                for t in TABS: await visit(ctx, 'money#' + t, '/label-world/money#' + t, out)
                # pick the release on release pages, then re-check disabled controls
                async def pick(page):
                    for sel in ['select[aria-label="Review release"]', 'select[aria-label="Builder release"]']:
                        if await page.locator(sel).count(): await page.select_option(sel, 'qa-rel')
                await visit(ctx, 'reviewer+release', '/label-world/agents/reviewer', out, pick)
                await visit(ctx, 'builder+release', '/label-world/agents/builder', out, pick)
            report[who] = out
            await ctx.close()
        await b.close()
        print(json.dumps(report, indent=1))
asyncio.run(main())
