/**
 * Customer-facing thermal receipt text used by POS checkout and Sales reprint.
 * Locale is the user's selected LanguageContext value (not browser locale).
 * Never translate tenant-entered product names, customer names, or account names.
 */
export type PosReceiptLanguage = 'en' | 'sw';
export type PosReceiptLabel =
  | 'title' | 'invoiceNo' | 'date' | 'time' | 'cashier' | 'pharmacist'
  | 'customer' | 'description' | 'quantity' | 'price' | 'total'
  | 'subtotal' | 'discount' | 'delivery' | 'due' | 'paymentDetails'
  | 'mode' | 'amount' | 'change' | 'thankYou' | 'poweredBy';

const LABELS: Record<PosReceiptLabel, Record<PosReceiptLanguage, string>> = {
  title: { en: 'POS Receipt', sw: 'Risiti ya Mauzo' },
  invoiceNo: { en: 'Invoice No', sw: 'Namba ya Ankara' },
  date: { en: 'Date', sw: 'Tarehe' },
  time: { en: 'Time', sw: 'Wakati' },
  cashier: { en: 'Cashier', sw: 'Keshia' },
  pharmacist: { en: 'Pharmacist', sw: 'Mfamasia' },
  customer: { en: 'Customer', sw: 'Mteja' },
  description: { en: 'Description', sw: 'Maelezo' },
  quantity: { en: 'Qty', sw: 'Idadi' },
  price: { en: 'Price', sw: 'Bei' },
  total: { en: 'Total', sw: 'Jumla' },
  subtotal: { en: 'Subtotal', sw: 'Jumla Ndogo' },
  discount: { en: 'Discount', sw: 'Punguzo' },
  delivery: { en: 'Delivery', sw: 'Uwasilishaji' },
  due: { en: 'Due', sw: 'Salio Linalodaiwa' },
  paymentDetails: { en: 'Payment Details', sw: 'Maelezo ya Malipo' },
  mode: { en: 'Mode', sw: 'Njia ya Malipo' },
  amount: { en: 'Amount', sw: 'Kiasi' },
  change: { en: 'Change', sw: 'Chenji' },
  thankYou: { en: 'Thank you for shopping with us', sw: 'Asante kwa kununua nasi' },
  poweredBy: { en: 'Powered by Orvix.africa', sw: 'Imeandaliwa na Orvix.africa' },
};

export const posReceiptLabel = (key: PosReceiptLabel, language: PosReceiptLanguage): string =>
  LABELS[key][language];

/** Generic payment-mode values are translated; brand/account names stay intact. */
export function posReceiptPaymentMode(raw: string | undefined | null, language: PosReceiptLanguage): string {
  if (!raw || language !== 'sw') return raw || '';
  const names: Record<string, string> = {
    cash: 'Taslimu',
    'cash payment': 'Taslimu',
    credit: 'Mkopo',
    card: 'Kadi',
    'mobile money': 'Malipo kwa Simu',
    'multi-channel': 'Malipo Mchanganyiko',
    'multi-payment': 'Malipo Mchanganyiko',
    'split payment': 'Malipo Mchanganyiko',
    'bank transfer': 'Uhamisho wa Benki',
    bank: 'Benki',
  };
  return names[raw.trim().toLowerCase()] || raw;
}

export function posReceiptWalkInCustomer(raw: string | undefined | null, language: PosReceiptLanguage): string {
  if (!raw) return '';
  return language === 'sw' && raw.trim().toLowerCase() === 'walk-in customer'
    ? 'Mteja wa Papo Hapo' : raw;
}

export function posReceiptQuantity(raw: string, language: PosReceiptLanguage): string {
  if (language !== 'sw') return raw;
  // Only replace known units in quantities, never product descriptions.
  return raw.replace(/\bpcs\b/gi, 'vipande')
    .replace(/\bpieces\b/gi, 'vipande')
    .replace(/\bpacket(s)?\b/gi, 'pakiti')
    .replace(/\bbox(es)?\b/gi, 'boksi')
    .replace(/\bbottles?\b/gi, 'chupa');
}

const receiptLocale = (language: PosReceiptLanguage) => language === 'sw' ? 'sw-TZ' : 'en-US';
export function posReceiptDate(value: string | number | Date, language: PosReceiptLanguage): string {
  return new Date(value).toLocaleDateString(receiptLocale(language), { dateStyle: 'long' });
}
export function posReceiptTime(value: string | number | Date, language: PosReceiptLanguage): string {
  return new Date(value).toLocaleTimeString(receiptLocale(language), {
    hour: '2-digit', minute: '2-digit', hour12: language === 'en',
  });
}
