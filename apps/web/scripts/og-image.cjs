// Regenerates public/og.png (1200×630) from the landing hero. Run with the site up:
//   node scripts/og-image.cjs [http://localhost:3000]
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const base = process.argv[2] || 'http://localhost:3000';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await page.goto(`${base}/brands`, { waitUntil: 'load' });
  // the image is the hero only: hide the nav, the audience toggle and the buttons
  await page.addStyleTag({ content: 'header,[role=radiogroup],main a,main section p.text-caption{display:none!important} main{padding-top:0!important} main>section:first-of-type{padding:72px 64px 0!important;max-width:none!important}' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(__dirname, '../public/og.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await browser.close();
  console.log('public/og.png written');
})();
