/**
 * Capture login + home layout metrics and screenshots at multiple viewports.
 * Requires: npm install playwright (dev) && npx playwright install chromium
 *
 * Usage:
 *   SMOKE_SERVICE_USERNAME=testrd SMOKE_SERVICE_PASSWORD=test npm run audit:mobile
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../artifacts/rc-mobile-audit');
const TARGET = process.env.TARGET_URL || 'https://2025-14-patch.floor2plan.com/Account/Login';
const USER = process.env.SMOKE_SERVICE_USERNAME || 'testrd';
const PASS = process.env.SMOKE_SERVICE_PASSWORD || 'test';

const viewports = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-14', width: 390, height: 844 },
  { name: 'ipad-mini', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 720 },
];

async function layoutMetrics(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const form = document.querySelector('form.login');
    const menuBtn = document.querySelector('#module-dropdown-button, .f2ps-icon-layout-module, .navbar-toggler');
    const tiles = [...document.querySelectorAll('.f2ps-tile')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        label: el.querySelector('.f2ps-tile-title')?.textContent?.trim(),
        w: r.width,
        h: r.height,
        x: r.x,
        y: r.y,
      };
    });

    return {
      url: location.href,
      title: document.title,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      scroll: { w: doc.scrollWidth, h: doc.scrollHeight },
      overflowX: doc.scrollWidth > window.innerWidth + 1,
      form: form
        ? { rect: form.getBoundingClientRect().toJSON(), scrollWidth: form.scrollWidth }
        : null,
      tileCount: tiles.length,
      tiles,
      menuButtonRect: menuBtn?.getBoundingClientRect()?.toJSON() || null,
    };
  });
}

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = { target: TARGET, capturedAt: new Date().toISOString(), pages: [] };

for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  const entry = { viewport: vp, login: null, home: null };

  await page.goto(TARGET, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#userName', { timeout: 30000 });
  entry.login = await layoutMetrics(page);
  await page.screenshot({ path: path.join(OUT, `login-${vp.name}.png`), fullPage: true });

  await page.fill('#userName', USER);
  await page.fill('#password', PASS);
  await page.locator('form.login button[type="submit"], button[type="submit"]').first().click();
  await page.waitForURL((url) => !url.pathname.includes('/Account/Login'), { timeout: 60000 });
  await page.waitForSelector('.f2ps-tile', { timeout: 30000 });
  await page.waitForTimeout(2000);
  entry.home = await layoutMetrics(page);
  await page.screenshot({ path: path.join(OUT, `home-${vp.name}.png`), fullPage: true });

  report.pages.push(entry);
  await context.close();
}

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(`Wrote ${OUT}/report.json`);
await browser.close();
