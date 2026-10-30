import { describe, expect, it } from 'vitest';
import type { Sale } from '../../types';
import {
  DEFAULT_POS_DEVICE_PREFERENCES,
  formatPosReceiptForPrinter,
  normalizePosDevicePreferences,
  sendNativeReceipt,
} from './posDevices';

const sale = {
  id: 'sale-123',
  reference: 'INV-123',
  timestamp: '2026-10-31T09:12:00.000Z',
  paymentMethod: 'Cash',
  total: 25000,
  items: [
    { productId: 'p-1', productName: 'Very long product name that must wrap on fifty eight millimetre paper', qty: 2, price: 12500, discount: 0 },
  ],
} as Sale;

describe('POS device preferences', () => {
  it('defaults to Manual printing and 58mm', () => {
    expect(DEFAULT_POS_DEVICE_PREFERENCES.automaticPrinting).toBe(false);
    expect(DEFAULT_POS_DEVICE_PREFERENCES.paperWidthMm).toBe(58);
    expect(normalizePosDevicePreferences({}).automaticPrinting).toBe(false);
  });

  it('allows 58mm and 80mm only, rejecting the removed 50mm option', () => {
    expect(normalizePosDevicePreferences({ paperWidthMm: 50 }).paperWidthMm).toBe(58);
    expect(normalizePosDevicePreferences({ paperWidthMm: 58 }).paperWidthMm).toBe(58);
    expect(normalizePosDevicePreferences({ paperWidthMm: 80 }).paperWidthMm).toBe(80);
  });

  it('normalizes invalid copies, scanners, and incomplete printer identifiers', () => {
    const prefs = normalizePosDevicePreferences({
      receiptCopies: 7,
      scannerMode: 'unknown',
      printer: { id: 'a' },
    });
    expect(prefs.receiptCopies).toBe(1);
    expect(prefs.scannerMode).toBe('auto');
    expect(prefs.printer).toBeNull();
  });
});

describe('ESC/POS-compatible receipt text contract', () => {
  it('wraps all receipt lines to 58mm text width (32 characters)', () => {
    const text = formatPosReceiptForPrinter(sale, 'Orvix Shop', 58, 'sw');
    expect(text).toContain('RISITI YA MAUZO');
    expect(text).toContain('25,000');
    expect(text.trimEnd().split('\n').every(line => line.length <= 32)).toBe(true);
  });

  it('allows a wider 80mm text layout (48 characters)', () => {
    const text = formatPosReceiptForPrinter(sale, 'Orvix Shop', 80, 'en');
    expect(text).toContain('SALES RECEIPT');
    expect(text.trimEnd().split('\n').every(line => line.length <= 48)).toBe(true);
  });

  it('never pretends Bluetooth printing succeeded without native driver', async () => {
    if (typeof window === 'undefined') {
      expect((await sendNativeReceipt('tenant', sale, 'Store', 'en', 'automatic')).status)
        .toBe('not-supported');
    }
  });
});
