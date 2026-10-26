import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { findBarcodeProduct, fitsPosShopStock, getPosShopStock, posBarcodeMessage } from '../../shared/utils/barcodeScan';

// Exercise the actual event handlers with React painting deliberately deferred.
// This reproduces camera/HID callbacks arriving between two React renders.
const pos = readFileSync(new URL('./DashboardPOS.tsx', import.meta.url), 'utf8');
const scanner = readFileSync(new URL('../../shared/components/DashboardBarcodeScanner.tsx', import.meta.url), 'utf8');
function section(source: string, start: string, end: string): string {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`Handler not found: ${start}`);
  return source.slice(a, b);
}

function mount(stock = 4, language = 'en') {
  const product = { id: 'p1', name: 'Lim Cleaner', barcode: '0012345678905', sku: 'SKU-A', shopStockQty: stock, stockQty: stock };
  const context: any = {
    products: [product], receiptLanguage: language, sellingChannel: 'retail',
    useState: (value: unknown) => [value, vi.fn()], useRef: (value: unknown) => ({ current: value }),
    useCallback: (fn: unknown) => fn, findBarcodeProduct, fitsPosShopStock, getPosShopStock, posBarcodeMessage,
    setPosWarning: vi.fn(), supportsFractionSale: () => false, usesPharmacyHierarchy: () => false,
    supportsMeasuredRetail: () => false, getCartStockWeight: () => 1,
    playErrorBeep: vi.fn(), playWarningBeep: vi.fn(), playCartSuccessBeepAfterPaint: vi.fn(), addScanToast: vi.fn(),
    closedRef: { current: false }, inline: true,
    setScanSuccessAnim: vi.fn(), playBeep: vi.fn(),
    setTimeout: () => { throw new Error('Inline POS must dispatch immediately, not queue a fake success'); },
  };
  vm.createContext(context);
  const code = section(pos, '  const [cart, setCartState]', '  const [deliveryCost,')
    + section(pos, '  const handleScanSuccess =', '  // Checkout Modal system')
    + section(pos, '  const addToCart = useCallback(', '  const updateCartQty = useCallback(')
    + '\nglobalThis.cartRef = cartRef; globalThis.latestProductsRef = latestProductsRef; globalThis.changeCart = setCart; globalThis.scan = handleScanSuccess;';
  vm.runInContext(stripTypeScriptTypes(code), context);
  context.scanHandlersRef = { current: { products: [product], onScanSuccess: context.scan } };
  vm.runInContext(stripTypeScriptTypes(section(scanner, '  const handleItemBarcodeTrigger =', '  // Camera Lifecycle')) + '\nglobalThis.cameraRead = handleItemBarcodeTrigger;', context);
  return context;
}

describe('POS camera/barcode cart integration', () => {
  it.each([3, 4])('accepts exactly %s rapid scans and consistently reports sold out afterwards', stock => {
    const screen = mount(stock);
    for (let count = 0; count < 7; count++) screen.cameraRead('0012345678905');
    expect(screen.cartRef.current[0].qty).toBe(stock);
    expect(screen.playCartSuccessBeepAfterPaint).toHaveBeenCalledTimes(stock);
    expect(screen.playWarningBeep).toHaveBeenCalledTimes(7 - stock);
    expect(screen.playErrorBeep).not.toHaveBeenCalled();
    expect(screen.setScanSuccessAnim).not.toHaveBeenCalled();
    expect(screen.addScanToast.mock.calls.at(-1)).toEqual(['warning', 'Out of stock — Lim Cleaner']);
  });

  it('reports an existing zero-stock product differently from a genuinely unknown barcode', () => {
    const screen = mount(0, 'sw');
    screen.cameraRead('0012345678905');
    screen.cameraRead('9999999999999');
    expect(screen.cartRef.current).toHaveLength(0);
    expect(screen.addScanToast.mock.calls).toEqual([
      ['warning', 'Stoki imeisha — Lim Cleaner'], ['error', 'Bidhaa haipo — 9999999999999'],
    ]);
    expect(screen.playCartSuccessBeepAfterPaint).not.toHaveBeenCalled();
  });

  it('uses the current catalogue and stock after the scanner has already opened', () => {
    const screen = mount(4);
    screen.cameraRead('0012345678905');
    const product = { ...screen.products[0], shopStockQty: 1, stockQty: 1 };
    screen.latestProductsRef.current = [product];
    screen.scanHandlersRef.current = { products: [product], onScanSuccess: screen.scan };
    screen.cameraRead('0012345678905');
    expect(screen.cartRef.current[0].qty).toBe(1);
    expect(screen.addScanToast.mock.calls.at(-1)[0]).toBe('warning');
    screen.latestProductsRef.current = [];
    screen.scanHandlersRef.current.products = [];
    screen.cameraRead('0012345678905');
    expect(screen.addScanToast.mock.calls.at(-1)[0]).toBe('error');
  });

  it('handles seven actual HID Enter-terminated scans without false added/not-found signals', () => {
    const screen = mount(3);
    let now = 1000;
    let keydown: (event: { key: string }) => void;
    screen.Date = { now: () => now };
    screen.isOpen = true;
    screen.useEffect = (effect: () => unknown) => effect();
    screen.window = { addEventListener: (_event: string, handler: typeof keydown) => { keydown = handler; }, removeEventListener: vi.fn() };
    vm.runInContext(stripTypeScriptTypes(section(scanner, '  // Hardware Scanner Listener', '  if (!isOpen) return null;')), screen);
    for (let scan = 0; scan < 7; scan++) {
      for (const key of [...'0012345678905', 'Enter']) { now += 5; keydown!({ key }); }
    }
    expect(screen.cartRef.current[0].qty).toBe(3);
    expect(screen.playCartSuccessBeepAfterPaint).toHaveBeenCalledTimes(3);
    expect(screen.playWarningBeep).toHaveBeenCalledTimes(4);
    expect(screen.playErrorBeep).not.toHaveBeenCalled();
  });

  it('reserves cart edits before the next scan and ignores late reads after closing', () => {
    const screen = mount(4);
    screen.changeCart((cart: any[]) => [{ product: screen.products[0], qty: 3, discount: 0, discountType: 'percent' }, ...cart]);
    screen.cameraRead('0012345678905');
    screen.cameraRead('0012345678905');
    expect(screen.cartRef.current[0].qty).toBe(4);
    screen.closedRef.current = true;
    screen.cameraRead('0012345678905');
    expect(screen.addScanToast).toHaveBeenCalledTimes(2);
  });
});
