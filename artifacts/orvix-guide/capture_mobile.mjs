import { chromium } from 'file:///Users/msamimsechu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const outDir = new URL('./screenshots/', import.meta.url);
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
});
let page = await context.newPage();
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
const shotPath = (name) => fileURLToPath(new URL(name, outDir));
await page.screenshot({ path: shotPath('01-login.png'), fullPage: false });

const phone = page.getByPlaceholder(/whatsapp|phone/i).first();
await phone.fill('+255700000002');
await page.locator('button:visible').filter({ hasText: /^\s*continue\s*$/i }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: shotPath('01b-password.png'), fullPage: false });
const password = page.getByPlaceholder(/password/i).first();
await password.fill('password123');
await page.close();
await context.addInitScript(() => localStorage.setItem('jasper_cashier_user', JSON.stringify({
  id: 'u-demo-admin', email: 'admin@jasper.com', name: 'Jane Doe', role: 'Admin',
  tenantId: 't-lagos-01', activeTenant: 't-lagos-01', phone: '+255 700 000 002',
})));
page = await context.newPage();
await page.goto('http://localhost:3000/dashboard', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
await page.waitForTimeout(1800);
await page.screenshot({ path: shotPath('01c-after-login.png'), fullPage: false });

const shots = [
  ['02-dashboard.png', /dashboard/i],
  ['03-pos.png', /^pos$/i],
  ['04-sales.png', /^sales$/i],
  ['05-products.png', /^products$/i],
  ['06-purchases.png', /^purchases$/i],
  ['07-expenses.png', /^expenses$/i],
  ['08-reports.png', /^reports$/i],
  ['09-parties.png', /^parties$/i],
  ['10-money-bank.png', /money.*bank/i],
  ['11-staff.png', /^staff$/i],
  ['12-branches.png', /^branches$/i],
  ['13-settings.png', /^settings$/i],
  ['14-subscription.png', /^subscription$/i],
];

async function openMenu() {
  const menu = page.getByRole('button', { name: /menu/i }).first();
  if (await menu.count()) await menu.click().catch(() => {});
  await page.waitForTimeout(250);
}

await page.screenshot({ path: shotPath('02-dashboard.png'), fullPage: false });
for (const [filename, name] of shots.slice(1)) {
  await openMenu();
  const target = page.getByRole('button', { name }).first();
  if (!(await target.count())) continue;
  await target.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: shotPath(filename), fullPage: false });
}

console.log(JSON.stringify({ url: page.url(), files: await fs.readdir(outDir) }, null, 2));
await browser.close();
