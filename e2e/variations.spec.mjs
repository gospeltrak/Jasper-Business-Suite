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
  await page.getByRole('switch',{name:'Product Variations'}).check();
  const rows = page.getByTestId('variation-create-row');
  await expect(rows).toHaveCount(0);
  await expect(page.getByText(/Barcode Controls & Stock/)).toHaveCount(0);
  await page.getByTestId('add-variation-card').click();
  await expect(rows).toHaveCount(1);
  await page.getByTestId('add-variation-card').click();
  await expect(rows).toHaveCount(2);
  await rows.nth(0).getByRole('textbox',{name:'Variation 1 value'}).fill('250ml');
  await rows.nth(0).getByRole('spinbutton',{name:'Variation 1 buying price'}).fill('200');
  await rows.nth(0).getByRole('spinbutton',{name:'Variation 1 retail price'}).fill('500');
  await rows.nth(0).getByRole('button',{name:'Edit Stock & Barcode'}).click();
  await rows.nth(0).getByRole('spinbutton',{name:'Variation 1 shop stock'}).fill('6');
  await rows.nth(0).getByRole('textbox',{name:'Variation 1 barcode'}).fill('6155555000001');
  await rows.nth(1).getByRole('textbox',{name:'Variation 2 value'}).fill('1 Litre');
  await rows.nth(1).getByRole('spinbutton',{name:'Variation 2 buying price'}).fill('600');
  await rows.nth(1).getByRole('spinbutton',{name:'Variation 2 retail price'}).fill('1200');
  await rows.nth(1).getByRole('button',{name:'Edit Stock & Barcode'}).click();
  await rows.nth(1).getByRole('spinbutton',{name:'Variation 2 shop stock'}).fill('4');
  await rows.nth(1).getByRole('textbox',{name:'Variation 2 barcode'}).fill('6155555000002');

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

test('native phone and tablet Variation UI has tagged types and independent wholesale price/min/max', async ({page}) => {
  await page.getByTestId('open-products').click();
  if (page.viewportSize().width >= 1280) {
    await page.getByRole('button',{name:'Add Product',exact:true}).click();
  } else {
    await page.getByRole('button',{name:'Open new product form'}).click();
  }
  const form = page.getByTestId('product-variations-editor');
  const variationSwitch = form.getByRole('switch',{name:'Product Variations'});
  await expect(variationSwitch).toBeVisible();
  await expect(form.getByTestId('variation-toggle-status')).toHaveText('OFF');
  await expect(form.getByText('Size, flavor, color, material, formula or your own option.')).toHaveCount(0);
  await variationSwitch.check();
  await expect(form.getByTestId('variation-toggle-status')).toHaveText('ON');
  await expect(page.getByTestId('variation-create-row')).toHaveCount(0);
  await expect(page.getByText(/Barcode Controls & Stock/)).toHaveCount(0);
  await expect(page.getByText('Variation-based Pricing',{exact:true})).toHaveCount(0);
  await variationSwitch.uncheck();
  await expect(form.getByTestId('variation-toggle-status')).toHaveText('OFF');
  await expect(page.getByTestId('variation-create-row')).toHaveCount(0);
  await expect(page.getByText(/Barcode Controls & Stock/)).toBeVisible();
  await variationSwitch.check();
  await expect(form.getByRole('button',{name:'Flavor'})).toBeVisible();
  await form.getByRole('button',{name:'Flavor'}).click();
  await expect(form.getByRole('textbox',{name:'Variation Name'})).toHaveValue('Flavor');
  // Redundant inline Value-entry control was removed. Values live in the SKU rows.
  await expect(form.getByText('Variation Values',{exact:true})).toHaveCount(0);
  await expect(form.locator('#orvix-add-variation-value')).toHaveCount(0);
  const rows = page.getByTestId('variation-create-row');
  await form.getByTestId('add-variation-card').click();
  await expect(rows).toHaveCount(1);
  await expect(form.getByRole('textbox',{name:'Variation 1 value'})).toBeVisible();
  await rows.first().getByRole('button',{name:'Remove variation 1'}).click();
  await expect(rows).toHaveCount(0);
  await form.getByTestId('add-variation-card').click();
  await expect(rows).toHaveCount(1);
  const first = rows.first();
  const firstWholesale = first.locator('input[aria-label="Variation 1 wholesale price"]');
  if (page.viewportSize().width < 1280) {
    await expect(firstWholesale).toBeHidden();
  } else {
    await expect(firstWholesale).toBeVisible();
  }
  await first.getByRole('checkbox',{name:'Sell Wholesale 1'}).check();
  await expect(firstWholesale).toBeVisible();
  await first.getByRole('spinbutton',{name:'Variation 1 wholesale price'}).fill('400');
  await first.getByRole('spinbutton',{name:'Variation 1 min wholesale quantity'}).fill('6');
  await first.getByRole('spinbutton',{name:'Variation 1 max wholesale quantity'}).fill('24');
  await expect(first.getByRole('spinbutton',{name:'Variation 1 max wholesale quantity'})).toHaveValue('24');
  // Regression for dashboard's global mobile safety CSS which previously
  // collapsed all "grid-cols-*" UI to one column even on phone/tablet.
  const priceCols = await first.getByTestId('variation-prices-grid').evaluate(el =>
    getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);
  expect(priceCols).toBe(page.viewportSize().width >= 1280 ? 6 : 2);
  await first.getByRole('button',{name:'Edit Stock & Barcode'}).click();
  const stockCols = await first.getByTestId('variation-stock-grid').evaluate(el =>
    getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);
  expect(stockCols).toBe(page.viewportSize().width >= 1280 ? 3 : 2);
  const sizing = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(sizing.documentWidth).toBeLessThanOrEqual(sizing.viewportWidth + 2);

  await page.getByPlaceholder('e.g. Pure Groundnut Oil (5 Litre)').fill('QA Flavored Drink');
  await first.getByRole('textbox',{name:'Variation 1 value'}).fill('Vanilla');
  await first.getByRole('spinbutton',{name:'Variation 1 buying price'}).fill('200');
  await first.getByRole('spinbutton',{name:'Variation 1 retail price'}).fill('500');
  await form.getByTestId('add-variation-card').click();
  await expect(rows).toHaveCount(2);
  const second = rows.nth(1);
  await second.getByRole('textbox',{name:'Variation 2 value'}).fill('Orange');
  await second.getByRole('spinbutton',{name:'Variation 2 buying price'}).fill('300');
  await second.getByRole('spinbutton',{name:'Variation 2 retail price'}).fill('800');
  await page.locator('form button[type="submit"]').last().click();
  await expect.poll(async () => (await ledger(page)).products.filter(p => p.name.startsWith('QA Flavored Drink')).length).toBe(3);
  let state = await ledger(page);
  const newlyCreated = state.products.filter(p => p.name.startsWith('QA Flavored Drink'));
  const parent = newlyCreated.find(p => p.isParent);
  expect(parent?.option).toBe('Flavor');
  const vanilla = newlyCreated.find(p => p.parent === parent.id && p.name.endsWith('Vanilla'));
  expect(vanilla).toMatchObject({
    option:'Flavor',retail:true,wholesale:true,wholesalePrice:400,
    wholesaleMin:6,wholesaleMax:24,price:500
  });
  await page.reload();
  state = await ledger(page);
  expect(state.products.find(p => p.id === vanilla.id)).toMatchObject({
    option:'Flavor',wholesale:true,wholesaleMin:6,wholesaleMax:24
  });
});

test('one variation can be added and saved, and parent barcode-stock is hidden only while variation mode is on', async ({page}) => {
  await page.getByTestId('open-products').click();
  if (page.viewportSize().width >= 1280) {
    await page.getByRole('button',{name:'Add Product',exact:true}).click();
  } else {
    await page.getByRole('button',{name:'Open new product form'}).click();
  }
  const form = page.getByTestId('product-variations-editor');
  await page.getByPlaceholder('e.g. Pure Groundnut Oil (5 Litre)').fill('QA Solo Variant');
  await expect(page.getByText(/Barcode Controls & Stock/)).toBeVisible();
  await form.getByRole('switch',{name:'Product Variations'}).check();
  await expect(page.getByText(/Barcode Controls & Stock/)).toHaveCount(0);
  await expect(page.getByTestId('variation-create-row')).toHaveCount(0);
  await form.getByTestId('add-variation-card').click();
  const row = page.getByTestId('variation-create-row').first();
  await row.getByRole('textbox',{name:'Variation 1 value'}).fill('250ml');
  await row.getByRole('spinbutton',{name:'Variation 1 buying price'}).fill('100');
  await row.getByRole('spinbutton',{name:'Variation 1 retail price'}).fill('350');
  await row.getByRole('button',{name:'Edit Stock & Barcode'}).click();
  await row.getByRole('spinbutton',{name:'Variation 1 shop stock'}).fill('5');
  await row.getByRole('textbox',{name:'Variation 1 barcode'}).fill('6155555000010');
  await page.locator('form button[type="submit"]').last().click();
  await expect.poll(async () => (await ledger(page)).products.filter(p=>p.name.startsWith('QA Solo Variant')).length).toBe(2);
  let state=await ledger(page);
  const parent=state.products.find(p=>p.name==='QA Solo Variant');
  const onlyChild=state.products.find(p=>p.parent===parent.id);
  expect(parent.isParent).toBe(true);
  expect(parent.shop).toBe(0);
  expect(onlyChild.shop).toBe(5);
  await page.reload();
  state=await ledger(page);
  expect(state.products.filter(p=>p.name.startsWith('QA Solo Variant')).length).toBe(2);
});
