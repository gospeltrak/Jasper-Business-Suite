import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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
