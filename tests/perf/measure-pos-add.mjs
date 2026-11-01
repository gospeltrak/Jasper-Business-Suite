// Browser interaction benchmark: actual DashboardPOS + translation observer + 180 cards.
// Time from +ADD DOM click to the rendered CART TOTAL amount (after paint).
// Source: mocked QA data only. No tenant credentials or checkout requests.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const all = {};
let pass = true;
try {
  for (const language of ['en', 'sw']) {
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    await context.addInitScript(lang => localStorage.setItem('jasper_lang', lang), language);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('BROWSER_PAGE_ERROR', e.message); });
    page.on('console', message => { if (message.type() === 'error') console.error('BROWSER_CONSOLE_ERROR', message.text().slice(0, 500)); });
    page.on('response', response => { if (response.status() >= 400) console.error('BROWSER_HTTP_ERROR', response.status(), response.url()); });
    const loaded = await page.goto('http://127.0.0.1:5173/tests/perf/pos-cart-bench.html', { waitUntil: 'domcontentloaded' });
    console.log('BENCH_PAGE_LOADED', loaded?.status(), await page.title());
    try {
      await page.locator('[data-pos-product-card]').first().waitFor({ timeout: 12000 });
    } catch (e) {
      console.error('BENCH_ROOT_HTML', (await page.locator('#root').innerHTML().catch(() => 'missing root')).slice(0, 2600));
      console.error('BENCH_PAGE_ERRORS', errors);
      await page.screenshot({ path: 'pos-bench-' + language + '-failure.png', fullPage: false });
      throw e;
    }
    await page.waitForFunction(() => document.querySelectorAll('[data-pos-product-card]').length === 180, null, { timeout: 25000 });
    const samples = [];

    for (let i = 0; i < 8; i++) {
      const expected = (i + 1) * 15000 + 1000 * (i * (i + 1)) / 2;
      const result = await page.evaluate(async ({ index, expected }) => {
        const card = document.querySelectorAll('[data-pos-product-card]')[index];
        const total = document.querySelector('[data-testid="pos-mobile-grand-total"]');
        const discount = document.querySelector('[data-testid="pos-totals"] input[type="text"]');
        if (!card || !total) throw new Error('POS card or CART TOTAL selector missing');
        const startingTotal = total.textContent;
        const t0 = performance.now();
        return await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            observer.disconnect();
            reject(new Error('CART TOTAL did not update after +ADD. Observed: ' + total.textContent + ', expected ' + expected));
          }, 5000);
          const observer = new MutationObserver(() => {
            const actual = Number((total.textContent || '').replace(/[^\d]/g, ''));
            if (actual !== expected) return;
            observer.disconnect();
            clearTimeout(timeout);
            requestAnimationFrame(() => resolve({
              index: index + 1,
              expected, actual,
              ms: Math.round((performance.now() - t0) * 10) / 10,
              startingTotal,
              lastTotal: total.textContent,
              discountValue: discount?.value ?? '',
            }));
          });
          observer.observe(total, { childList: true, characterData: true, subtree: true });
          card.click();
        });
      }, { index: i, expected });
      if (result.actual !== expected || result.discountValue !== '') pass = false;
      samples.push(result);
    }
    all[language] = { samples, maxMs: Math.max(...samples.map(s => s.ms)), errors };
    if (errors.length) pass = false;
    await page.screenshot({ path: 'pos-bench-' + language + '.png', fullPage: false });
    await context.close();
  }
} finally {
  await browser.close();
}
console.log('POS_CART_RENDER_TIMES_JSON=' + JSON.stringify(all));
for (const [language, data] of Object.entries(all)) {
  console.log('LANG=' + language + ' ADD->CART_TOTAL(ms)=' + data.samples.map(s => s.ms).join(', ') + ' max=' + data.maxMs);
}
if (!pass) {
  console.error('FAIL: the cart did not update correctly or unexpectedly modified the discount / browser errors.');
  process.exit(1);
}
console.log('PASS: each +ADD immediately changed CART TOTAL to the correct value without editing discount in both languages.');
