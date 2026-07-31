import { Sale, Tenant } from '../types';

/**
 * Formats a sales receipt into structured text and returns a sanitized WhatsApp api link.
 */
export function generateWhatsAppMessage(sale: Sale, tenant: Tenant): string {
  const currency = tenant.currency;
  
  // Format items
  const itemsText = sale.items
    .map(item => {
      const isItemCash = item.discountType === 'cash';
      const unitPrice = item.price;
      const discountText = item.discount > 0 
        ? (isItemCash ? ` (-${currency}${item.discount})` : ` (-${item.discount}%)`) 
        : '';
      const finalPrice = isItemCash
        ? Math.max(0, unitPrice - item.discount)
        : unitPrice * (1 - item.discount / 100);
      const rowTotal = Math.round(finalPrice * item.qty);
      
      return `• *${item.productName}* ${discountText}\n  ${item.qty} x ${currency}${unitPrice.toLocaleString()} = *${currency}${rowTotal.toLocaleString()}*`;
    })
    .join('\n\n');

  // Math variables
  const taxableSubtotal = sale.total - sale.tax - (sale.deliveryCost || 0);
  const discountVal = sale.discount || 0;
  const hasDisc = discountVal > 0;
  const originalSubtotal = hasDisc
    ? (sale.discountType === 'cash' ? taxableSubtotal + discountVal : taxableSubtotal / (1 - discountVal / 100))
    : taxableSubtotal;
  const discountAmt = originalSubtotal - taxableSubtotal;

  const discountBlock = hasDisc
    ? `*Order Discount:* -${currency}${Math.round(discountAmt).toLocaleString()} (${sale.discountType === 'cash' ? 'Cash' : `${discountVal}%`})\n`
    : '';

  const deliveryBlock = sale.deliveryCost && sale.deliveryCost > 0
    ? `*Delivery Cost:* ${currency}${Math.round(sale.deliveryCost).toLocaleString()}\n`
    : '';

  const vatBlock = `*VAT (${Math.round(tenant.taxRate * 100)}%):* ${currency}${Math.round(sale.tax).toLocaleString()}`;

  const messageText = `🧾 *Orvix POS - Transactions Receipt*

*Store:* ${tenant.name}
*Receipt Ref:* ${sale.reference || `REC-${sale.id.toUpperCase().slice(0, 8)}`}
*Date:* ${new Date(sale.timestamp).toLocaleDateString(undefined, { dateStyle: 'short' })} ${new Date(sale.timestamp).toLocaleTimeString(undefined, { timeStyle: 'short' })}
*Cashier:* ${sale.cashierName || 'Primary Teller'}
------------------------------------------
*Customer:* ${sale.customerName || 'Walk-In'}
${sale.customerPhone ? `*Phone:* ${sale.customerPhone}\n` : ''}------------------------------------------
*Items:*
${itemsText}
------------------------------------------
*Items Subtotal:* ${currency}${Math.round(originalSubtotal).toLocaleString()}
${discountBlock}${deliveryBlock}${vatBlock}
*GRAND TOTAL PAID:* *${currency}${Math.round(sale.total).toLocaleString()}*
------------------------------------------
Thank you.
Orvix receipt.`;

  return messageText;
}

/**
 * Builds the WhatsApp web or API share link based on target phone number
 */
export function buildWhatsAppLink(message: string, phone?: string): string {
  const encodedText = encodeURIComponent(message);
  if (phone) {
    const cleanedPhone = phone.replace(/[+\s-]/g, ''); // strip spaces, pluses, dashes
    return `https://wa.me/${cleanedPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}
