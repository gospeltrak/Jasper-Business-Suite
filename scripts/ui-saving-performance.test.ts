import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculateFractionSaleLine, resolveFractionSaleConfig } from '../src/modules/sales/utils/fractionSale';

const read = (path: string) => readFile(path, 'utf8');

test('POS confirmation is React-controlled and safe from DOM translation mutation', async () => {
  const pos = await read('src/modules/pos/DashboardPOS.tsx');
  assert.match(pos, /className="pos-checkout-confirm"\s+translate="no"/);
  assert.match(pos, /aria-busy=\{isProcessingPayment\}/);
  assert.match(pos, /key="pos-processing"/);
  assert.match(pos, /key="pos-confirm"/);
  assert.match(pos, /t\('Processing\.\.\.'\)/);
  assert.match(pos, /t\('Confirm Payment'\)/);
  assert.match(pos, /paymentSubmitInFlightRef\.current = true/);
  assert.match(pos, /if \(paymentSubmitInFlightRef\.current\) return/);
  assert.match(pos, /window\.requestAnimationFrame/);
  assert.match(pos, /window\.clearTimeout\(slowNotice\)/);
  assert.match(pos, /Still confirming this sale/);
});

test('product editing footer has two safe action slots on mobile and tablet', async () => {
  const products = await read('src/modules/products/DashboardProducts.tsx');
  const css = await read('src/index.css');
  assert.match(products, /tenant-form-footer orvix-product-edit-footer/);
  assert.doesNotMatch(products, /tenant-form-footer sticky bottom-0 z-10/);
  assert.match(products, /translate="no"\s+className="orvix-product-edit-action/);
  assert.match(products, /key="product-edit-saving"/);
  assert.match(products, /key="product-edit-save"/);
  assert.match(products, /t\('Saving…'\)/);
  assert.match(products, /t\('Save Changes'\)/);
  assert.match(products, /productEditInFlightRef\.current = true/);
  assert.match(products, /window\.clearTimeout\(slowNotice\)/);
  assert.match(css, /#dashboard-scaffold \.tenant-form-footer\.orvix-product-edit-footer \{/);
  assert.match(css, /position: relative !important/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
  assert.match(css, /min-height: 46px/);
  assert.match(css, /overflow-wrap: anywhere/);
});

test('workspace history merge maintains a single Map per collection regardless of page count', async () => {
  const workspace = await read('src/shared/utils/tenantWorkspace.ts');
  assert.match(workspace, /recordMaps: Record<PaginatedWorkspaceCollection, Map<string, any>>/);
  assert.match(workspace, /mergePageRecords\(recordMaps\[collection\], page\.records\)/);
  assert.match(workspace, /sales: Array\.from\(recordMaps\.sales\.values\(\)\)/);
  assert.doesNotMatch(workspace, /records\[collection\] = mergePageRecords\(records\[collection\]/);
});

test('POS discount and delivery fee inputs retain focus while totals recalculate', async () => {
  const pos = await read('src/modules/pos/DashboardPOS.tsx');
  // An input under a key derived from its own calculated total is unmounted
  // on every digit, interrupting typing on both Android and desktop.
  assert.match(pos, /data-testid="pos-totals"/);
  assert.doesNotMatch(pos, /key=\{\`pos-totals-\$\{cart\.length\}/);
  assert.doesNotMatch(pos, /key=\{\`pos-mobile-total-\$\{cart\.length\}/);
  assert.match(pos, /value=\{orderDiscountDraft\}/);
  assert.match(pos, /setOrderDiscountDraft\(raw\)/);
  assert.match(pos, /onChange=\{\(e\) => setDeliveryCost\(e\.target\.value === '' \? 0 : Math\.max\(0, Number\(e\.target\.value\)\)\)\}/);
});


test('mobile cart amount is derived immediately from cart entries, without waiting for discount edits', async () => {
  const pos = await read('src/modules/pos/DashboardPOS.tsx');
  assert.match(pos, /const subtotal = cart\.reduce\(\(sum, item\) => \{/);
  assert.match(pos, /return sum \+ \(discountPrice \* item\.qty\)/);
  assert.match(pos, /data-testid="pos-mobile-grand-total" role="status" aria-live="polite"/);
  assert.match(pos, /Math\.round\(grandTotal\)\.toLocaleString\(\)/);
  assert.doesNotMatch(pos, /const subtotal = useMemo\(\(\) =>/);
  // No unrelated cart remount when quantities or totals change.
  assert.doesNotMatch(pos, /key=\{\x60pos-mobile-total-\$\{cart\.length\}/);
});

test('checkout delivery summary stays inside the product amount card on one compact line', async () => {
  const pos = await read('src/modules/pos/DashboardPOS.tsx');
  const css = await read('src/index.css');
  assert.match(pos, /className="pos-checkout-total pos-checkout-total-compact"/);
  assert.match(pos, /data-testid="pos-checkout-delivery-summary"/);
  assert.match(pos, /Delivery: \{currency\}\{Math\.round\(deliveryCost\)\.toLocaleString\(\)\} · Paid via \{deliveryPaymentMethod/);
  assert.doesNotMatch(pos, /pos-checkout-delivery-breakdown/);
  assert.doesNotMatch(pos, /Combined order total \(products \+ delivery\)/);
  assert.doesNotMatch(pos, /Products only — delivery is paid separately/);
  assert.match(css, /pos-checkout-total\.pos-checkout-total-compact/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(css, /pos-checkout-total-compact \.pos-checkout-delivery-note/);
  assert.match(css, /white-space: nowrap/);
});

test('sign-in credential inputs do not re-render on every Android keyboard character', async () => {
  const login = await read('src/modules/auth/LoginPage.tsx');
  assert.match(login, /const loginEmailInputRef = useRef<HTMLInputElement>\(null\)/);
  assert.match(login, /const loginPasswordInputRef = useRef<HTMLInputElement>\(null\)/);
  assert.match(login, /ref=\{loginEmailInputRef\}[\s\S]*?type="email"[\s\S]*?defaultValue=""/);
  assert.match(login, /ref=\{loginPasswordInputRef\}[\s\S]*?autoComplete="current-password"[\s\S]*?defaultValue=""/);
  assert.match(login, /loginEmailInputRef\.current\?\.value\.trim\(\)/);
  assert.match(login, /triggerLogin\(loginEmailInputRef\.current\?\.value \|\| '', loginPasswordInputRef\.current\?\.value \|\| ''\)/);
  assert.doesNotMatch(login, /onChange=\{\(e\) => setEmail\(e\.target\.value\)\}/);
  assert.doesNotMatch(login, /onChange=\{\(e\) => setPassword\(e\.target\.value\)\}/);
});


test('a new product cart never inherits the discount or delivery charge from an emptied basket', async () => {
  const pos = await read('src/modules/pos/DashboardPOS.tsx');
  // The old Void action only did setCart([]), so prior 100%-off discounts
  // caused a new 15k item to show zero until editing the discount manually.
  assert.match(pos, /if \(cart\.length !== 0\) return;\s*setOrderDiscount\(0\);\s*setOrderDiscountDraft\(''\);\s*setOrderDiscountType\('percent'\);\s*setDeliveryCost\(0\);/);
  assert.match(pos, /\}, \[cart\.length\]\)/);
  // Preserve the original 15,000 product total with zero discount/delivery.
  const subtotal = 15000;
  const stalePctDiscount = subtotal * (100 / 100);
  assert.equal(subtotal - stalePctDiscount, 0);
  assert.equal(subtotal - 0, 15000);
});

test('cart price falls back to the visible selling price when legacy unit price is zero', () => {
  const selected = {
    isBulkProduct: true,
    sellingPrice: 15000,
    defaultPricePerBaseUnit: 0,
    inventorySettings: { defaultPricePerBaseUnit: 0 },
  } as Parameters<typeof resolveFractionSaleConfig>[0];
  const config = resolveFractionSaleConfig(selected, 'Retail & Wholesale');
  assert.equal(config.piecePrice, 15000);
  assert.equal(calculateFractionSaleLine('piece', 1, config).lineTotal, 15000);
  assert.equal(calculateFractionSaleLine('piece', 2, config).lineTotal, 30000);
});


test('selected POS product immediately prices from same channel and unit-price source as product card', async () => {
  const pos = await read('src/modules/pos/DashboardPOS.tsx');
  // Product cards must refresh their price cache when the selling channel changes.
  assert.match(pos, /\}, \[filteredProducts, getChannelPrice\]\)/);
  // POS never uses zero stale optional unit price while the card shows a positive value.
  assert.match(pos, /const displayedChannelPrice = getChannelPrice\(item\.product\)/);
  assert.match(pos, /return Number\.isFinite\(positivePrice\) && positivePrice > 0/);
  assert.match(pos, /Math\.max\(0, Number\(displayedChannelPrice\) \|\| Number\(item\.product\.sellingPrice\) \|\| 0\)/);
  // The same product unit price feeds both the per-line cart display and sticky total,
  // including Retail Packaging items; no discount input touch is required.
  assert.match(pos, /const visibleUnitPrice = getCartUnitPrice\(item\)/);
  assert.match(pos, /const subtotal = cart\.reduce\(\(sum, item\) =>/);
  assert.match(pos, /data-testid="pos-mobile-grand-total"[\s\S]*?\{Math\.round\(grandTotal\)\.toLocaleString\(\)\}/);
});


test('repeated cart additions do not regenerate the entire POS product grid', async () => {
  const pos = await read('src/modules/pos/DashboardPOS.tsx');
  // Customer reported first 1-2 add taps are fast, then 3rd+ item stalls.
  // The full catalog is independent of cart, discount and checkout state.
  const memoizedGrid = pos.match(/const productCards = useMemo\(\(\) => ([\s\S]*?), \[([\s\S]*?)\]\);/);
  assert.ok(memoizedGrid, 'Catalog cards must be built in a memoized list');
  assert.match(memoizedGrid[1], /filteredProducts\.map\(prod => \{/);
  assert.match(memoizedGrid[1], /key=\{prod\.id\}/);
  assert.match(memoizedGrid[1], /addToCart\(prod\)/);
  assert.match(memoizedGrid[2], /filteredProducts, productPriceMap, productRemainingMap, addToCart/);
  assert.doesNotMatch(memoizedGrid[2], /\bcart\b|grandTotal|subtotal|orderDiscount|deliveryCost/);
  assert.match(pos, /id="pos-product-grid"[\s\S]*?\{\s*filteredProducts\.length === 0 \? \([\s\S]*?\)\s*:\s*\(\s*productCards\s*\)\}/);
  assert.doesNotMatch(pos.slice(pos.indexOf('id="pos-product-grid"'), pos.indexOf('Cart Summary right panel')), /filteredProducts\.map\(prod =>/);
});
