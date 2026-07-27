import { PaymentModeConfig } from '../types';

export type PaymentType = 'cash' | 'mobile_money' | 'bank' | 'card' | 'credit';

// ── Keyword maps ────────────────────────────────────────────────────────────
const MOBILE_MONEY_KEYWORDS = [
  'mpesa', 'm-pesa', 'lipa', 'tigopesa', 'tigo pesa', 'tigo',
  'halopesa', 'halo pesa', 'halo', 'airtel', 'airtel money',
  'mtn', 'momo', 'mobile money', 'vodacom', 'safaricom',
  'equitel', 'mshwari', 'tkash', 't-kash', 'bonga',
  'pesalink', 'pesapal', 'paybill', 'buy goods',
  'yas', 'mixx', 'izy', 'pochi', 'nhif mobile',
  'mobile', 'wallet', 'pesa', 'simu',
];

const BANK_KEYWORDS = [
  'crdb', 'nmb', 'nbc', 'kcb', 'equity', 'absa', 'stanbic',
  'standard chartered', 'dtb', 'diamond trust', 'i&m', 'im bank',
  'ncba', 'cooperative', 'co-op', 'family bank', 'gt bank',
  'gtbank', 'zenith', 'access bank', 'ecobank', 'uba',
  'bank', 'transfer', 'wire', 'swift', 'eft', 'rtgs',
  'cheque', 'check', 'deposit', 'account', 'uhawilisho',
];

const CARD_KEYWORDS = [
  'visa', 'mastercard', 'master card', 'amex', 'american express',
  'card', 'pos terminal', 'pos machine', 'swipe', 'tap', 'chip',
  'credit card', 'debit card', 'paystack', 'flutterwave',
  'stripe', 'square', 'sumup', 'yoco',
];

const CREDIT_KEYWORDS = [
  'credit', 'mkopo', 'debt', 'due', 'outstanding', 'unpaid',
  'account', 'defer', 'later', 'invoice', 'net 30',
];

const CASH_KEYWORDS = [
  'cash', 'naqdhi', 'taslimu', 'pesa taslimu', 'physical',
  'counter', 'drawer', 'till', 'float', 'change',
];

// ── Classify a payment method name ─────────────────────────────────────────
export function classifyPaymentMode(name: string, explicitType?: PaymentType): PaymentType {
  if (explicitType) return explicitType;

  const n = name.toLowerCase().trim();

  if (MOBILE_MONEY_KEYWORDS.some(k => n.includes(k))) return 'mobile_money';
  if (BANK_KEYWORDS.some(k => n.includes(k))) return 'bank';
  if (CARD_KEYWORDS.some(k => n.includes(k))) return 'card';
  if (CREDIT_KEYWORDS.some(k => n.includes(k))) return 'credit';
  if (CASH_KEYWORDS.some(k => n.includes(k))) return 'cash';

  // Default: cash
  return 'cash';
}

// ── Normalize payment modes from settings ──────────────────────────────────
export function normalizePaymentModes(raw: any[]): PaymentModeConfig[] {
  return (raw || []).map(m => {
    if (typeof m === 'string') return { name: m };
    return m as PaymentModeConfig;
  });
}

// ── Get type for a payment method name using tenant's configured modes ──────
export function getPaymentType(
  methodName: string,
  configuredModes: PaymentModeConfig[] = [],
): PaymentType {
  const n = (methodName || '').toLowerCase().trim();

  // Check tenant's configured modes first (explicit type wins)
  const configured = configuredModes.find(m => m.name.toLowerCase().trim() === n);
  if (configured?.type) return configured.type;

  // Auto-detect from name
  return classifyPaymentMode(methodName, configured?.type);
}

// ── Group sales by payment type ─────────────────────────────────────────────
export interface PaymentTypeSummary {
  cash: number;
  mobile_money: number;
  bank: number;
  card: number;
  credit: number;
  total: number;
}

export function groupSalesByPaymentType(
  sales: any[],
  configuredModes: PaymentModeConfig[] = [],
): PaymentTypeSummary {
  const result: PaymentTypeSummary = {
    cash: 0, mobile_money: 0, bank: 0, card: 0, credit: 0, total: 0,
  };

  sales.forEach(sale => {
    const amount = Math.max(0, Number(sale.total || 0));
    result.total += amount;

    const breakdown = Array.isArray(sale.paymentBreakdown) && sale.paymentBreakdown.length > 0
      ? sale.paymentBreakdown
      : [{ method: sale.paymentMethod || 'Cash', amount }];

    breakdown.forEach((part: any) => {
      const partAmount = Math.max(0, Number(part.amount || 0));
      const type = getPaymentType(part.method || sale.paymentMethod || 'Cash', configuredModes);
      result[type] += partAmount;
    });
  });

  return result;
}

// ── Map payment method name to best matching channel ID ────────────────────
export function getChannelIdForPayment(
  methodName: string,
  configuredModes: PaymentModeConfig[],
  channels: any[],
): string {
  const type = getPaymentType(methodName, configuredModes);
  const n = methodName.toLowerCase();

  // Try exact channel name match first
  const exactMatch = channels.find(
    c => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase().split(' ')[0])
  );
  if (exactMatch) return exactMatch.id;

  // Match by category/type
  const byCategory = channels.find(c => {
    if (type === 'mobile_money') return c.category === 'telco';
    if (type === 'bank') return c.category === 'bank';
    if (type === 'card') return c.category === 'bank' && c.name.toLowerCase().includes('card');
    return c.category === 'physical';
  });
  if (byCategory) return byCategory.id;

  // Fallback: first cash/physical channel
  const cashChannel = channels.find(c => c.category === 'physical');
  return cashChannel?.id || (channels[0]?.id || 'counter-01');
}

// ── Labels for UI ──────────────────────────────────────────────────────────
export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  bank: 'Bank Transfer',
  card: 'Card / POS',
  credit: 'Credit / Mkopo',
};

export const PAYMENT_TYPE_COLORS: Record<PaymentType, { bg: string; text: string; border: string }> = {
  cash:         { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  mobile_money: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  bank:         { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  card:         { bg: '#faf5ff', text: '#7c3aed', border: '#e9d5ff' },
  credit:       { bg: '#fff1f2', text: '#be123c', border: '#fecdd3' },
};

export const PAYMENT_TYPE_ICONS: Record<PaymentType, string> = {
  cash: '💵',
  mobile_money: '📱',
  bank: '🏦',
  card: '💳',
  credit: '📋',
};
