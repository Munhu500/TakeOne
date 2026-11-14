// DEMO_MODE end-to-end check. Needs: web on :3000, the mobile web export on :8081, the worker running, and
// ASSIGNMENT_ID = an assignment in status 'accepted' for creator@takeone.demo (see README).
const { chromium } = require('playwright');
(async () => {
  const base = 'http://localhost:8081', aid = process.env.ASSIGNMENT_ID, S = process.env.SHOTS || '.';
  const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } } : {});
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 200))); page.on('console', (m) => m.type() === 'error' && errs.push('console ' + m.text().slice(0, 200)));
  await page.goto(base + '/sign-in'); await page.getByText('Priya', { exact: false }).first().click();
  await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 }); await page.waitForTimeout(3000);
  await page.screenshot({ path: S + '/e-feed.png' });
  await page.goto(base + '/shoot/' + aid); await page.waitForTimeout(3500);
  await page.screenshot({ path: S + '/e-shoot.png' });
  await page.getByText('Demo: use the sample take').click(); await page.waitForTimeout(800);
  await page.screenshot({ path: S + '/e-send.png' });
  await page.getByText('Upload take').click();
  await page.waitForURL((u) => u.pathname.includes('/studio/'), { timeout: 90000 }); console.log('uploaded → studio');
  await page.waitForTimeout(6000); await page.screenshot({ path: S + '/e-building.png' });
  const t0 = Date.now();
  await page.getByText(/^Submit \d variants? to/).waitFor({ timeout: 420000 });
  console.log('variants ready after', Math.round((Date.now() - t0) / 1000), 's');
  await page.waitForTimeout(2500); await page.screenshot({ path: S + '/e-studio.png', fullPage: true });
  await page.getByText(/^Submit \d variants? to/).click(); await page.waitForTimeout(5000);
  await page.screenshot({ path: S + '/e-submitted.png' });
  console.log([...new Set(errs)].slice(0, 8).join('\n') || 'no page errors');
  await browser.close();
})().catch((e) => { console.error('E2E FAILED', e.message); process.exit(1); });
