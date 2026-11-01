import type { JasperNotification } from '../../types';

type NotificationLanguage = 'sw' | 'en';

const amount = (value: unknown) => `TSh ${Math.max(0, Number(value) || 0).toLocaleString('en-US')}`;
const nonEmpty = (value: unknown) => String(value ?? '').trim();

export interface OrvixSaleNotificationDetails {
  seller?: string;
  productAmount?: number;
  deliveryAmount?: number;
  total?: number;
  productPaymentMethod?: string;
  deliveryPaymentMethod?: string;
  reference?: string;
  items?: Array<{ name: string; qty: number }>;
  payments?: Array<{ method: string; amount: number }>;
}

/** Render ONE sale notification consistently in the language chosen in Orvix.
 * Dynamic product and seller names are never translated or guessed.
 * Delivery is shown separately from product collections, never double-counted.
 */
export function formatOrvixNotification(notification: JasperNotification, lang: NotificationLanguage) {
  const sw = lang === 'sw';
  if (notification.notificationType !== 'sale') {
    const known: Record<string, [string, string]> = {
      'New Sale Recorded': ['Mauzo mapya yamehifadhiwa', 'New sale recorded'],
      'System notification': ['Arifa ya mfumo', 'System notification'],
      'Mauzo yamekamilika na kuhifadhiwa': ['Mauzo yamekamilika na kuhifadhiwa', 'Sale completed and saved'],
    };
    const title = known[notification.title];
    return { title: title ? title[sw ? 0 : 1] : notification.title, message: notification.message };
  }
  const details = notification.saleDetails as OrvixSaleNotificationDetails | undefined;
  if (!details) {
    // Old sale events may have no normalized sales record. Do not create
    // imaginary product/payment details; keep the original historical message.
    return {
      title: sw ? 'Mauzo yamekamilika na kuhifadhiwa' : 'Sale completed and saved',
      message: notification.message,
    };
  }
  const lines: string[] = [];
  if (details.seller) lines.push(`${sw ? 'Muuzaji' : 'Seller'}: ${details.seller}`);
  if (details.items?.length) {
    const items = details.items.slice(0, 8).map(item => `${item.name} ×${item.qty}`);
    lines.push(`${sw ? 'Bidhaa' : 'Products'}: ${items.join(', ')}${details.items.length > 8 ? '…' : ''}`);
  }
  const payments = (details.payments || []).filter(p => p.amount > 0 && p.method);
  if (payments.length) {
    lines.push(`${sw ? 'Malipo ya bidhaa' : 'Product payments'}: ${payments.map(p => `${p.method} ${amount(p.amount)}`).join(' · ')}`);
  } else if (details.productPaymentMethod) {
    lines.push(`${sw ? 'Njia ya malipo ya bidhaa' : 'Product payment method'}: ${details.productPaymentMethod}`);
  }
  if ((details.deliveryAmount || 0) > 0) {
    lines.push(`${sw ? 'Usafirishaji' : 'Delivery'}: ${amount(details.deliveryAmount)} · ${sw ? 'Imelipwa kwa' : 'Paid via'} ${nonEmpty(details.deliveryPaymentMethod) || '—'}`);
  }
  if ((details.total || 0) > 0) {
    lines.push(`${sw ? 'Jumla ya oda' : 'Order total'}: ${amount(details.total)}`);
  }
  if (details.reference) lines.push(`${sw ? 'Rejea' : 'Reference'}: ${details.reference}`);
  return {
    title: `${sw ? 'Mauzo yamekamilika' : 'Sale completed'} · ${amount(details.productAmount ?? details.total ?? 0)}`,
    message: lines.join('\n'),
  };
}
