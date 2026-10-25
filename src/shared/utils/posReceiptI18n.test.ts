import { describe, expect, it } from 'vitest';
import {
  posReceiptLabel,
  posReceiptPaymentMode,
  posReceiptWalkInCustomer,
  posReceiptQuantity,
  posReceiptDate,
  posReceiptTime,
  type PosReceiptLabel,
} from './posReceiptI18n';

const allKeys: PosReceiptLabel[] = [
  'title','invoiceNo','date','time','cashier','pharmacist','customer',
  'description','quantity','price','total','subtotal','discount',
  'delivery','due','paymentDetails','mode','amount','change','thankYou','poweredBy',
];

describe('Swahili POS receipts, Sales reprints and PDF terminology', () => {
  it('all fixed receipt labels exist in Swahili and English', () => {
    for (const key of allKeys) {
      expect(posReceiptLabel(key, 'sw').length).toBeGreaterThan(1);
      expect(posReceiptLabel(key, 'en').length).toBeGreaterThan(1);
    }
  });

  it('translates the exact mixed-language entries from the seller screenshot', () => {
    expect(posReceiptLabel('title','sw')).toBe('Risiti ya Mauzo');
    expect(posReceiptLabel('invoiceNo','sw')).toBe('Namba ya Ankara');
    expect(posReceiptLabel('cashier','sw')).toBe('Keshia');
    expect(posReceiptLabel('customer','sw')).toBe('Mteja');
    expect(posReceiptLabel('quantity','sw')).toBe('Idadi');
    expect(posReceiptLabel('paymentDetails','sw')).toBe('Maelezo ya Malipo');
    expect(posReceiptLabel('mode','sw')).toBe('Njia ya Malipo');
    expect(posReceiptPaymentMode('Cash','sw')).toBe('Taslimu');
    expect(posReceiptLabel('amount','sw')).toBe('Kiasi');
    expect(posReceiptWalkInCustomer('Walk-In Customer','sw')).toBe('Mteja wa Papo Hapo');
    expect(posReceiptLabel('thankYou','sw')).toBe('Asante kwa kununua nasi');
    expect(posReceiptLabel('poweredBy','sw')).toBe('Imeandaliwa na Orvix.africa');
  });

  it('retains the original English wording on English receipts', () => {
    expect(posReceiptLabel('mode','en')).toBe('Mode');
    expect(posReceiptPaymentMode('Cash','en')).toBe('Cash');
    expect(posReceiptWalkInCustomer('Walk-In Customer','en')).toBe('Walk-In Customer');
    expect(posReceiptQuantity('2 pcs','en')).toBe('2 pcs');
  });

  it('does not change customer-provided data, mobile-money brands or account names', () => {
    for (const value of ['Mixx by Yas','M-Pesa','CRDB','NMB','Airtel Money']) {
      expect(posReceiptPaymentMode(value,'sw')).toBe(value);
    }
    expect(posReceiptWalkInCustomer('KAZENI LOGISTICS COMPANY LIMITED','sw'))
      .toBe('KAZENI LOGISTICS COMPANY LIMITED');
  });

  it('supports credit, split payments and fractions with compact thermal-paper units', () => {
    expect(posReceiptPaymentMode('Credit','sw')).toBe('Mkopo');
    expect(posReceiptPaymentMode('Multi-Channel','sw')).toBe('Malipo Mchanganyiko');
    expect(posReceiptPaymentMode('Card','sw')).toBe('Kadi');
    expect(posReceiptQuantity('2 pcs','sw')).toBe('2 vip.');
    expect(posReceiptQuantity('0.25 kg','sw')).toBe('0.25 kg');
  });

  it('renders dates with language-specific month and time formats', () => {
    const iso='2026-10-16T20:54:00.000Z';
    expect(posReceiptDate(iso,'en')).toMatch(/October/);
    expect(posReceiptDate(iso,'sw')).not.toMatch(/October/);
    expect(posReceiptDate(iso,'sw')).toMatch(/2026/);
    expect(posReceiptTime(iso,'sw')).toMatch(/\d/);
  });
});
