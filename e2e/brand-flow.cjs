// DEMO_MODE end-to-end check. Needs: web on :3000, the mobile web export on :8081, the worker running, and
// ASSIGNMENT_ID = an assignment in status 'accepted' for creator@takeone.demo (see README).
const { chromium } = require('playwright');
(async () => {
  const base = 'http://localhost:3000', S = process.env.SHOTS || '.', url = `/brand/campaigns/c0000000-0000-4000-8000-000000000002/review/${process.env.ASSIGNMENT_ID}`;
  const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } } : {});
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto(base + '/login'); await page.fill('#email', 'brand@takeone.demo'); await page.fill('#password', 'TakeOne-demo-2026'); await page.click('button[type=submit]');
  await page.waitForURL((u) => u.pathname.startsWith('/brand'), { timeout: 30000 });
  await page.goto(base + url); await page.waitForTimeout(2000);
  await page.getByText('Pick (included)').first().click();
  await page.getByText(/Select 1 variant/).click(); await page.getByText('Licensed').first().waitFor({ timeout: 20000 }); console.log('selected + licensed');
  await page.getByText(/^Whitelist ·/).first().click(); await page.getByText(/whitelisted/).first().waitFor({ timeout: 20000 }); console.log('whitelist add-on bought');
  await page.getByText('Set as winning post').first().click(); await page.getByText('Winner').first().waitFor({ timeout: 20000 }); console.log('winner chosen');
  await page.getByText('Approve and release payment').click(); await page.getByText(/Approved on/).waitFor({ timeout: 20000 }); console.log('approved');
  await page.screenshot({ path: S + '/e-brand.png', fullPage: true });
  await browser.close();
})().catch((e) => { console.error('E2E FAILED', e.message.slice(0, 400)); process.exit(1); });
