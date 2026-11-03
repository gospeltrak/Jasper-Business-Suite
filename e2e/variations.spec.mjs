import { test, expect } from '@playwright/test';

const ledger = async page => JSON.parse(await page.getByTestId('ledger').textContent());
const product = (data,id) => data.products.find(entry=>entry.id===id);

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => console.error('[E2E browser runtime]', error.message));
  page.on('console', message => {
    if (message.type() === 'error') console.error('[E2E browser console]', message.text());
  });
  await page.goto('/e2e/variations.html');
  await expect(page.locator('[data-pos-product-card]').first()).toBeVisible();
});

test('POS enforces variation selection, records exact child SKU and preserves sibling stock on sale/return/reload', async ({ page }, testInfo) => {
  const card = page.locator('[data-pos-product-card]').filter({hasText:'QA Juice'});
  await expect(card).toHaveCount(1);
  const choose = card.getByRole('combobox',{name:'Choose QA Juice variation'});
  await expect(choose).toHaveValue('');
  const add = card.getByRole('button',{name:'+ Add'});
  await expect(add).toBeDisabled();
  await choose.selectOption('e2e-child-500');
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByText('Shopping Cart')).toBeVisible();

  if(testInfo.project.name !== 'chromium-phone'){
    await page.locator('#pos-checkout-btn').click();
  } else {
    await page.getByRole('button',{name:'Checkout',exact:true}).click();
  }
  await expect(page.getByRole('group',{name:'Choose payment method'})).toBeVisible();
  await page.getByRole('group',{name:'Choose payment method'}).getByRole('button',{name:'Cash'}).click();
  await page.getByRole('button',{name:/Confirm Payment/}).click();
  await expect(page.getByText('Payment complete')).toBeVisible();
  let state = await ledger(page);
  expect(state.sales).toHaveLength(1);
  expect(state.sales[0].items).toHaveLength(1);
  expect(state.sales[0].items[0]).toMatchObject({
    productId:'e2e-child-500',variationParentId:'e2e-parent',variationLabel:'500ml',
    price:1500,qty:1
  });
  expect(product(state,'e2e-parent').shop).toBe(0);
  expect(product(state,'e2e-child-350').shop).toBe(15);
  expect(product(state,'e2e-child-500').shop).toBe(7);

  await page.getByRole('button',{name:'Close checkout'}).click();
  await page.getByTestId('refund-last-sale').click();
  state = await ledger(page);
  expect(product(state,'e2e-child-500').shop).toBe(8);
  expect(product(state,'e2e-child-350').shop).toBe(15);
  expect(product(state,'e2e-parent').shop).toBe(0);
  await page.reload();
  state = await ledger(page);
  expect(product(state,'e2e-child-500').shop).toBe(8);
  expect(state.sales).toHaveLength(1);
});

test('Add Product registers two unique child variations exactly once and reload retains them', async ({ page }) => {
  await page.getByTestId('open-products').click();
  if (page.viewportSize().width >= 1280) {
    await page.getByRole('button',{name:'Add Product',exact:true}).click();
  } else {
    await page.getByRole('button',{name:'Open new product form'}).click();
  }
  await page.getByPlaceholder('e.g. Pure Groundnut Oil (5 Litre)').fill('QA Milk');
  await page.getByRole('checkbox',{name:/Product Variations/}).check();
  const rows = page.getByTestId('variation-create-row');
  await expect(rows).toHaveCount(2);
  await rows.nth(0).locator('input').nth(0).fill('250ml');
  await rows.nth(0).locator('input').nth(1).fill('200');
  await rows.nth(0).locator('input').nth(2).fill('500');
  await rows.nth(0).locator('input').nth(3).fill('6');
  await rows.nth(0).locator('input').nth(5).fill('6155555000001');
  await rows.nth(1).locator('input').nth(0).fill('1 Litre');
  await rows.nth(1).locator('input').nth(1).fill('600');
  await rows.nth(1).locator('input').nth(2).fill('1200');
  await rows.nth(1).locator('input').nth(3).fill('4');
  await rows.nth(1).locator('input').nth(5).fill('6155555000002');

  const submit = page.locator('form button[type="submit"]').last();
  await submit.dispatchEvent('click');
  await submit.dispatchEvent('click');
  await expect.poll(async ()=>(await ledger(page)).saveCalls).toBe(1);
  let state = await ledger(page);
  const created=state.products.filter(p=>p.name.startsWith('QA Milk'));
  expect(created).toHaveLength(3);
  const parent=created.find(p=>p.isParent);
  expect(parent).toBeTruthy();
  expect(parent.shop).toBe(0);
  const children=created.filter(p=>p.parent===parent.id);
  expect(children).toHaveLength(2);
  expect(children.map(p=>p.shop).sort((a,b)=>a-b)).toEqual([4,6]);
  expect(new Set(children.map(p=>p.barcode)).size).toBe(2);
  await page.reload();
  state=await ledger(page);
  expect(state.products.filter(p=>p.name.startsWith('QA Milk'))).toHaveLength(3);
});

test('catalog retains compact variation dropdown without horizontal overflow', async ({page})=>{
  const card=page.locator('[data-pos-product-card]').filter({hasText:'QA Juice'});
  await expect(card).toHaveCount(1);
  await expect(card.getByRole('combobox',{name:'Choose QA Juice variation'})).toBeVisible();
  const sizing=await page.evaluate(()=>({
    documentWidth:document.documentElement.scrollWidth,
    viewportWidth:document.documentElement.clientWidth,
    columns:getComputedStyle(document.querySelector('#pos-product-grid')).gridTemplateColumns.split(' ').length
  }));
  expect(sizing.documentWidth).toBeLessThanOrEqual(sizing.viewportWidth+2);
  expect(sizing.columns).toBe(3);
});
