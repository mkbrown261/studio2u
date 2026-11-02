"""Real-browser audit of a running Studio2U (default: production).
Visits every public page, signs up a synthetic QA account, walks the Label World
flows (dashboard, 3D headquarters, every agent workspace, inbox) and reports
HTTP failures, console errors, uncaught exceptions and WIP copy.
    python3 tools/production-audit.py https://studio2u.pages.dev
"""
import json, sys, time, re
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://studio2u.pages.dev').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else '/tmp/audit'
import os; os.makedirs(SHOTS, exist_ok=True)
WIP = re.compile(r'(foundation preview|not yet executable|physical (model|character) pending|remain unfinished|demo mode|not implemented|todo|lorem ipsum)', re.I)
report = {'base': BASE, 'pages': [], 'issues': []}

def visit(page, path, name, wait='networkidle', extra=None):
    errors, failed = [], []
    page.on('console', lambda m: m.type == 'error' and errors.append(m.text[:300]))
    page.on('pageerror', lambda e: errors.append('UNCAUGHT ' + str(e)[:300]))
    page.on('response', lambda r: r.status >= 400 and not r.url.endswith('favicon.ico') and failed.append(f'{r.status} {r.url.replace(BASE, "")}'))
    t = time.time()
    try:
        resp = page.goto(BASE + path, wait_until=wait, timeout=60000)
        status = resp.status if resp else None
    except Exception as e:
        status = 'TIMEOUT ' + str(e)[:80]
    if extra: extra(page)
    page.wait_for_timeout(800)
    try: text = page.inner_text('body', timeout=10000)
    except Exception: text = ''
    wip = sorted(set(m.group(0).lower() for m in WIP.finditer(text)))
    try: page.screenshot(path=f'{SHOTS}/{name}.png', full_page=False, timeout=20000)
    except Exception as e: errors.append('screenshot failed: ' + str(e)[:80])
    entry = {'name': name, 'path': path, 'status': status, 'ms': int((time.time() - t) * 1000), 'consoleErrors': errors[:8], 'failedRequests': failed[:8], 'wipCopy': wip}
    report['pages'].append(entry)
    try: page.close()
    except Exception: pass
    return entry

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
    for path, name in [('/', 'home'), ('/label', 'label-landing'), ('/engineers', 'engineers'), ('/pricing', 'pricing'), ('/terms', 'terms'), ('/privacy', 'privacy'), ('/consent', 'consent'), ('/refund-policy', 'refund'), ('/security', 'security'), ('/status', 'status'), ('/login', 'login'), ('/signup', 'signup'), ('/label-world/login', 'lw-login'), ('/sitemap.xml', 'sitemap')]:
        visit(ctx.new_page(), path, name)
    # Engineer profile + booking page if any engineer exists
    pg = ctx.new_page(); pg.goto(BASE + '/engineers', wait_until='networkidle')
    links = pg.eval_on_selector_all('a[href^="/engineers/"]', 'els => [...new Set(els.map(e => e.getAttribute("href")))]')
    if links:
        visit(ctx.new_page(), links[0], 'engineer-profile')
        eid = links[0].split('/')[-1]
        visit(ctx.new_page(), f'/book/{eid}', 'booking')

    # Signed-in Label World journey (synthetic QA account)
    email = f'qa+audit{int(time.time())}@example.invalid'
    pg = ctx.new_page(); pg.goto(BASE + '/signup', wait_until='networkidle')
    pg.fill('input[name=name]', 'QA Audit'); pg.fill('input[name=email]', email); pg.fill('input[name=phone]', '5555550101'); pg.fill('input[name=password]', 'Audit-Pass-12345')
    for sel in ['input[name=role_artist]', 'input[name=terms_accepted]']:
        try: pg.check(sel)
        except Exception: pass
    pg.click('button[type=submit]'); pg.wait_for_load_state('networkidle')
    report['signup'] = pg.url.replace(BASE, '')
    visit(ctx.new_page(), '/dashboard', 'account-dashboard')

    def make_label(page):
        try:
            page.fill('#lw-label-form input[name=name]', 'Audit Records'); page.click('#lw-label-form button'); page.wait_for_timeout(2500)
            page.fill('#lw-release-form input[name=artist]', 'Audit Artist'); page.fill('#lw-release-form input[name=title]', 'Audit Single')
            page.click('#lw-release-submit'); page.wait_for_timeout(2500)
            report['dashboardReleaseCreated'] = 'Audit Single' in page.inner_text('#lw-releases')
            report['dashboardMessage'] = page.inner_text('#lw-message')
        except Exception as e:
            report['issues'].append('dashboard flow: ' + str(e)[:200])
    visit(ctx.new_page(), '/label-world/dashboard', 'lw-dashboard', extra=make_label)

    def scene(page):
        try:
            page.wait_for_selector('[data-scene-loaded="true"]', timeout=90000)
            report['scene'] = {'loaded': True, 'meshes': page.get_attribute('[data-scene-loaded]', 'data-scene-meshes')}
        except Exception:
            el = page.query_selector('[data-scene-loaded]')
            report['scene'] = {'loaded': False, 'meshes': el.get_attribute('data-scene-meshes') if el else None}
    visit(ctx.new_page(), '/label-world', 'lw-headquarters', wait='domcontentloaded', extra=scene)
    for agent in ['researcher', 'reviewer', 'executive', 'builder']:
        visit(ctx.new_page(), f'/label-world/agents/{agent}', f'lw-agent-{agent}', wait='domcontentloaded', extra=lambda pg: pg.wait_for_timeout(4000))
    visit(ctx.new_page(), '/label-world/inbox', 'lw-inbox', wait='domcontentloaded', extra=lambda pg: pg.wait_for_timeout(4000))

    # Mobile pass on the money pages
    m = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    for path, name in [('/', 'm-home'), ('/label', 'm-label'), ('/engineers', 'm-engineers')]:
        visit(m.new_page(), path, name)
    browser.close()

for pgr in report['pages']:
    bad = (isinstance(pgr['status'], int) and pgr['status'] >= 400) or not isinstance(pgr['status'], int)
    if bad or pgr['consoleErrors'] or pgr['failedRequests'] or pgr['wipCopy']:
        report['issues'].append({k: pgr[k] for k in ('name', 'status', 'consoleErrors', 'failedRequests', 'wipCopy') if pgr[k]})
print(json.dumps({'summary': {'pages': len(report['pages']), 'issues': len(report['issues']), 'scene': report.get('scene'), 'signup': report.get('signup'), 'dashboardReleaseCreated': report.get('dashboardReleaseCreated')}, 'issues': report['issues'], 'timings': {p['name']: p['ms'] for p in report['pages']}}, indent=1))
