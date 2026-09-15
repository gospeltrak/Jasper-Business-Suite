import { chromium } from 'file:///Users/msamimsechu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('./screenshots/', import.meta.url));
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await context.addInitScript(() => {
  localStorage.setItem('jasper_cashier_user', JSON.stringify({ id: 'u-demo-admin', email: 'admin@jasper.com', name: 'Jane Doe', role: 'Admin', tenantId: 't-lagos-01', activeTenant: 't-lagos-01', phone: '+255 700 000 002' }));
});
const page = await context.newPage();
await page.goto('http://localhost:3000/dashboard', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
await page.waitForTimeout(7000);
await page.screenshot({ path: `${output}/02-dashboard.png`, fullPage: false });
for (const [x, file] of [[117, '03-sales.png'], [195, '04-pos.png'], [273, '05-stock.png'], [351, '06-more.png']]) {
  await page.touchscreen.tap(x, 816);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${output}/${file}`, fullPage: false });
}
await fs.writeFile(`${output}/dashboard-url.txt`, page.url());
await browser.close();
