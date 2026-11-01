import { describe, expect, it } from 'vitest';
import type { JasperNotification } from '../../types';
import { formatOrvixNotification } from './orvixNotificationText';

const sale: JasperNotification = {
  id: 'sale-recipient-1',
  tenantId: 'tenant-fixture',
  moduleName: 'sales',
  notificationType: 'sale',
  title: 'Mauzo yamekamilika na kuhifadhiwa',
  message: 'Old mixed language text',
  deliveryChannel: 'in_app',
  status: 'sent',
  isRead: false,
  createdAt: '2026-11-01T18:20:00Z',
  saleDetails: {
    seller: 'Evancia',
    productAmount: 73000,
    deliveryAmount: 5000,
    total: 78000,
    reference: 'INV-1',
    productPaymentMethod: 'Multi-Channel',
    deliveryPaymentMethod: 'M-Pesa',
    payments: [{ method: 'Cash', amount: 40000 }, { method: 'M-Pesa', amount: 33000 }],
    items: [{ name: 'Palmolive', qty: 1 }, { name: 'Harpic', qty: 2 }],
  },
};

describe('Orvix selected-language sale notifications', () => {
  it('renders Seller, items and separate payment accounts in Kiswahili', () => {
    const result = formatOrvixNotification(sale, 'sw');
    expect(result.title).toBe('Mauzo yamekamilika · TSh 73,000');
    expect(result.message).toContain('Muuzaji: Evancia');
    expect(result.message).toContain('Bidhaa: Palmolive ×1, Harpic ×2');
    expect(result.message).toContain('Malipo ya bidhaa: Cash TSh 40,000 · M-Pesa TSh 33,000');
    expect(result.message).toContain('Usafirishaji: TSh 5,000 · Imelipwa kwa M-Pesa');
    expect(result.message).toContain('Jumla ya oda: TSh 78,000');
    expect(result.message).not.toContain('Paid via');
  });

  it('renders all fixed phrases in English when English is selected', () => {
    const result = formatOrvixNotification(sale, 'en');
    expect(result.title).toBe('Sale completed · TSh 73,000');
    expect(result.message).toContain('Seller: Evancia');
    expect(result.message).toContain('Products: Palmolive ×1, Harpic ×2');
    expect(result.message).toContain('Product payments: Cash TSh 40,000 · M-Pesa TSh 33,000');
    expect(result.message).toContain('Delivery: TSh 5,000 · Paid via M-Pesa');
    expect(result.message).not.toContain('Muuzaji:');
  });

  it('does not invent product details for older sale events', () => {
    const old = { ...sale, saleDetails: undefined };
    const result = formatOrvixNotification(old, 'sw');
    expect(result.message).toBe('Old mixed language text');
  });
});
