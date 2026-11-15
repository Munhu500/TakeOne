// Verifies the static preview (preview-dist/ served on :8090 by scripts/preview-server.cjs or a real Apache).
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8090', SHOTS = process.env.SHOTS || '.', PW = 'TakeOne-demo-2026';
const results = [], bad = [];
const ok = (name, pass, note = '') => { results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${note ? '  — ' + note : ''}`); };
(async () => {
  const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } } : {});
  const open = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, ...opts });
    const page = await ctx.newPage();
    page.on('requestfailed', (r) => { if (r.url().startsWith(BASE) && !/ERR_ABORTED/.test(r.failure()?.errorText ?? '')) bad.push(`request failed: ${r.url().replace(BASE, '')}`); });
    page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace(BASE, '').split('?')[0]}`); });
    page.on('pageerror', (e) => bad.push(`page error: ${e.message.slice(0, 160)}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|fontshare|ERR_TUNNEL|net::ERR|Failed to load resource/.test(m.text())) bad.push(`console: ${m.text().slice(0, 160)}`); });
    return page;
  };
  const see = (page, text, t = 30000) => page.getByText(text, { exact: false }).first().waitFor({ timeout: t }).then(() => true, () => false);
  const login = async (page, email) => { await page.fill('#email', email); await page.fill('#password', PW); await page.click('button[type=submit]'); };

  // 1. landing
  let p = await open();
  await p.goto(BASE + '/');
  ok('/ loads (landing)', await see(p, 'Get paid by brands.') && await see(p, 'For brands') && !(await p.getByText('Preview build').count()));
  await p.screenshot({ path: `${SHOTS}/pv-landing.png` });

  // 2. brand
  await p.goto(BASE + '/brand/');
  ok('/brand/ signed out → sign-in page', await see(p, 'Sign in') && p.url().includes('/login'));
  await login(p, 'brand@takeone.demo');
  ok('brand login → dashboard', await see(p, 'Kaya Glow') && await see(p, 'In escrow') && !(await p.getByText('Campaign credit').count()), p.url().replace(BASE, ''));
  await p.getByText('Vitamin C Glow Serum — 30-day results').first().click();
  ok('open a campaign (id in URL)', await see(p, 'Creator shot list') && /\/brand\/campaigns\/c0000000/.test(p.url()), p.url().replace(BASE, ''));
  await p.getByRole('link', { name: /Creators & variants/ }).click();
  await p.getByRole('link', { name: /Open variants|Review variants/ }).first().click();
  const variants = await see(p, 'Hook First') && await see(p, 'Licensed');
  // footage is a neutral frame until real files are supplied (apps/web/public/media or rendered variants)
  const frames = await p.getByText('Footage coming soon').count();
  const videos = await p.locator('video').count();
  ok('view variants (frames or footage, partnership ad naming)', variants && frames + videos > 0 && !(await p.getByText(/whitelist/i).count()), p.url().replace(BASE, ''));
  await p.screenshot({ path: `${SHOTS}/pv-brand-review.png` });
  await p.reload();
  ok('refresh on brand deep link', await see(p, 'Hook First') && await see(p, 'Winning post'));
  await p.goto(BASE + '/brand/billing/');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }).catch(() => null), p.getByText('Invoice PDF').first().click()]);
  const pdfPath = dl ? await dl.path() : null;
  ok('invoice PDF generated in the browser', !!pdfPath && require('fs').readFileSync(pdfPath).subarray(0, 5).toString() === '%PDF-', dl ? dl.suggestedFilename() : 'no download');
  await p.context().close();

  // 3. agency white-label by ?agency=
  p = await open();
  await p.goto(BASE + '/agency/?agency=mirage');
  const branded = await see(p, 'Mirage Media') && await see(p, 'Your Mirage Media campaign workspace');
  // the agency theme is applied after an asynchronous lookup, so wait for it rather than reading once
  await p.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-brand').trim().toUpperCase() !== '#7C5CFF', null, { timeout: 15000 }).catch(() => {});
  const accent = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-brand').trim());
  ok('/agency/?agency=mirage shows agency branding', branded && accent.toUpperCase() === '#E0A526' && !(await p.getByText('TakeOne', { exact: true }).count()), `accent ${accent}, title "${await p.title()}"`);
  await p.screenshot({ path: `${SHOTS}/pv-agency-login.png` });
  await login(p, 'agency@takeone.demo');
  ok('agency login → client workspaces', await see(p, 'Client workspaces') && await see(p, 'Add a client') && await see(p, 'Open workspace'));
  await p.goto(BASE + '/agency/branding/'); await p.reload();
  ok('refresh on agency deep link', await see(p, 'White-label') && await see(p, 'Save branding'));
  await p.context().close();

  // 4. admin
  p = await open();
  await p.goto(BASE + '/admin/');
  await see(p, 'Sign in'); await login(p, 'admin@takeone.demo');
  ok('/admin/ loads the QA queue', await see(p, 'QA queue') && p.url().includes('/admin/qa/'), p.url().replace(BASE, ''));
  await p.screenshot({ path: `${SHOTS}/pv-admin-qa.png` });
  await p.goto(BASE + '/admin/settings/'); await p.reload();
  ok('refresh on admin deep link', await see(p, 'FX rates') && await see(p, 'Licence prices'));
  await p.context().close();

  // 5. creator app under /app
  p = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const fromRoot = [];
  p.on('request', (r) => { const u = r.url(); if (u.startsWith(BASE) && !u.startsWith(BASE + '/app')) fromRoot.push(u.replace(BASE, '')); });
  await p.goto(BASE + '/app/');
  ok('/app/ loads the creator app', await see(p, 'Demo logins') && !(await p.getByText('Preview build').count()));
  await p.getByText('Priya', { exact: false }).first().click();
  ok('creator login → feed', await see(p, 'You earn') && await see(p, 'Apply'), p.url().replace(BASE, ''));
  await p.screenshot({ path: `${SHOTS}/pv-app-feed.png` });
  await p.goto(BASE + '/app/wallet'); await p.reload();
  ok('wallet + refresh on /app deep link', await see(p, 'Available to withdraw') && await see(p, 'MONTHLY EARNINGS STATEMENT'));
  await p.screenshot({ path: `${SHOTS}/pv-app-wallet.png` });
  await p.goto(BASE + '/app/work');
  await p.getByText('Vitamin C Glow Serum', { exact: false }).first().click();
  ok('Studio opens with variants', await see(p, 'Hook First') && await see(p, 'Licensed by the brand') && /\/app\/studio\//.test(p.url()), p.url().replace(BASE, ''));
  await p.reload();
  ok('refresh on Studio deep link', await see(p, 'Hook First'));
  await p.screenshot({ path: `${SHOTS}/pv-app-studio.png` });
  ok('creator app assets all load from /app/', fromRoot.length === 0, fromRoot.slice(0, 3).join(', '));
  await p.context().close();

  // 6. unknown path
  p = await open();
  const r = await p.goto(BASE + '/does-not-exist/');
  ok('unknown path → exported 404 page', r.status() === 404 && await see(p, 'Page not found'));
  const expected404 = bad.filter((b) => b.includes('/does-not-exist/')).length;
  const real = [...new Set(bad.filter((b) => !b.includes('/does-not-exist/')))];
  ok('no failed asset requests or console errors', real.length === 0, real.slice(0, 6).join(' | '));
  void expected404;
  console.log(results.join('\n'));
  await browser.close();
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error('CHECK CRASHED', e.message.slice(0, 300)); process.exit(1); });
