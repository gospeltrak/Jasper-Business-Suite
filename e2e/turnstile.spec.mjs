import { test, expect } from '@playwright/test';

test.beforeEach(async ({page}) => {
  page.on('pageerror', err => console.error('Turnstile E2E error:', err.message));
  await page.goto('/e2e/turnstile.html');
  await expect(page.getByTestId('mock-solve-challenge')).toBeVisible();
});

test('one-time token is refreshed after server validation and cannot be silently reused',async ({page})=>{
  await page.getByTestId('mock-solve-challenge').click();
  await expect(page.getByTestId('challenge-token')).toContainText('mock-valid-token');
  await page.getByTestId('consume-token').click();
  await expect(page.getByTestId('challenge-token')).toHaveText('NO_TOKEN');
  await expect.poll(()=>page.locator('body').getAttribute('data-render-count')).toBe('2');
  await page.getByTestId('mock-solve-challenge').click();
  await expect(page.getByTestId('challenge-token')).toHaveText('mock-valid-token-mock-2');
});

test('Cloudflare error displays help and user can explicitly retry',async ({page})=>{
  await page.getByTestId('mock-error').click();
  await expect(page.getByRole('alert')).toContainText('haijaidhinisha anwani');
  await page.getByRole('button',{name:'Jaribu tena'}).click();
  await expect(page.getByTestId('mock-solve-challenge')).toBeVisible();
  await expect(page.getByTestId('challenge-token')).toHaveText('NO_TOKEN');
  await page.getByTestId('mock-solve-challenge').click();
  await expect(page.getByTestId('challenge-token')).toContainText('mock-valid-token');
});

test('expired or timed-out challenge can be restarted',async ({page})=>{
  await page.getByTestId('mock-expire').click();
  await expect(page.getByRole('alert')).toContainText('umeisha muda');
  await page.getByRole('button',{name:'Jaribu tena'}).click();
  await expect(page.getByTestId('mock-solve-challenge')).toBeVisible();
  await page.getByTestId('mock-timeout').click();
  await expect(page.getByRole('alert')).toContainText('muda mrefu');
  await page.getByRole('button',{name:'Jaribu tena'}).click();
  await expect(page.getByTestId('mock-solve-challenge')).toBeVisible();
});

test('challenge remains inside narrow phone/tablet viewport',async ({page})=>{
  const widths = await page.evaluate(()=>({view:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
  expect(widths.content).toBeLessThanOrEqual(widths.view+2);
  expect(await page.evaluate(()=>(window).__turnstileQA.activeWidgets())).toBe(1);
});
