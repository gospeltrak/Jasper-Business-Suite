import jsPDF from 'jspdf';
import { buildWhatsAppLink } from './whatsapp';

const sanitizeFileName = (name: string) =>
  name.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

// ─── Real PDF receipt generator (no screenshot) ───────────────────────────────
// Builds the receipt as actual PDF text and lines using jsPDF drawing API.
// Result is a real searchable PDF, not an image of HTML.

export interface ReceiptData {
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  receiptId: string;
  timestamp: string;
  cashierName?: string;
  customerName?: string;
  paymentMethod: string;
  items: Array<{
    name: string;
    qty: number;
    price: number;
    total: number;
    unit?: string;
  }>;
  subtotal: number;
  tax?: number;
  discount?: number;
  deliveryCost?: number;
  productTotal: number;
  grandTotal: number;
  currency: string;
  amountPaid?: number;
  change?: number;
  vatNumber?: string;
  footer?: string;
}

export function createReceiptPdfFromData(data: ReceiptData): File {
  // Receipt width: 80mm thermal paper = 226.77pt
  const W = 226;
  const margin = 10;
  const contentW = W - margin * 2;

  // Build PDF — height will be calculated
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [W, 800] });

  let y = margin;

  const line = (x1: number, y1: number, x2: number, y2: number, color = '#e2e8f0') => {
    pdf.setDrawColor(color);
    pdf.line(x1, y1, x2, y2);
  };

  const dashed = (yPos: number) => {
    pdf.setDrawColor('#cbd5e1');
    pdf.setLineDashPattern([2, 2], 0);
    pdf.line(margin, yPos, W - margin, yPos);
    pdf.setLineDashPattern([], 0);
  };

  const text = (str: string, x: number, yPos: number, opts?: { align?: 'left'|'center'|'right'; size?: number; bold?: boolean; color?: string }) => {
    const { align = 'left', size = 7, bold = false, color = '#0f172a' } = opts || {};
    pdf.setFontSize(size);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setTextColor(color);
    pdf.text(str, x, yPos, { align });
  };

  const fmt = (amount: number) => `${data.currency} ${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ── Header ────────────────────────────────────────────────────────────────
  y += 4;
  text(data.businessName, W / 2, y, { align: 'center', size: 10, bold: true });
  y += 12;

  if (data.businessAddress) {
    text(data.businessAddress, W / 2, y, { align: 'center', size: 7, color: '#475569' });
    y += 10;
  }
  if (data.businessPhone) {
    text(data.businessPhone, W / 2, y, { align: 'center', size: 7, color: '#475569' });
    y += 10;
  }
  if (data.vatNumber) {
    text(`VAT No: ${data.vatNumber}`, W / 2, y, { align: 'center', size: 6, color: '#64748b' });
    y += 9;
  }

  y += 4;
  dashed(y);
  y += 8;

  // ── Receipt meta ──────────────────────────────────────────────────────────
  text('RECEIPT', W / 2, y, { align: 'center', size: 9, bold: true });
  y += 10;

  const metaRows = [
    ['Receipt No:', data.receiptId],
    ['Date:', new Date(data.timestamp).toLocaleString()],
    ...(data.cashierName ? [['Served by:', data.cashierName]] : []),
    ...(data.customerName ? [['Customer:', data.customerName]] : []),
    ['Payment:', data.paymentMethod],
  ];
  metaRows.forEach(([label, value]) => {
    text(label, margin, y, { size: 6.5, color: '#64748b' });
    text(value, W - margin, y, { align: 'right', size: 6.5, bold: true });
    y += 9;
  });

  y += 4;
  dashed(y);
  y += 8;

  // ── Column headers ────────────────────────────────────────────────────────
  text('ITEM', margin, y, { size: 6, bold: true, color: '#64748b' });
  text('QTY', margin + contentW * 0.6, y, { size: 6, bold: true, color: '#64748b' });
  text('PRICE', margin + contentW * 0.76, y, { size: 6, bold: true, color: '#64748b' });
  text('TOTAL', W - margin, y, { align: 'right', size: 6, bold: true, color: '#64748b' });
  y += 5;
  line(margin, y, W - margin, y, '#e2e8f0');
  y += 7;

  // ── Items ─────────────────────────────────────────────────────────────────
  data.items.forEach(item => {
    // Item name — wrap if needed
    const nameLines = pdf.splitTextToSize(item.name, contentW * 0.55);
    text(nameLines[0], margin, y, { size: 7 });
    if (nameLines.length > 1) {
      y += 9;
      text(nameLines[1], margin, y, { size: 6, color: '#64748b' });
    }
    const qtyStr = `${item.qty}${item.unit ? ` ${item.unit}` : ''}`;
    text(qtyStr, margin + contentW * 0.6, y, { size: 7 });
    text(fmt(item.price), margin + contentW * 0.76, y, { size: 7 });
    text(fmt(item.total), W - margin, y, { align: 'right', size: 7, bold: true });
    y += 10;
  });

  y += 2;
  line(margin, y, W - margin, y, '#e2e8f0');
  y += 8;

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalRow = (label: string, value: string, bold = false, color = '#0f172a') => {
    text(label, margin + contentW * 0.4, y, { size: 7, color: bold ? color : '#475569' });
    text(value, W - margin, y, { align: 'right', size: 7, bold, color });
    y += 10;
  };

  totalRow('Subtotal', fmt(data.subtotal));
  if (data.discount && data.discount > 0) totalRow('Discount', `-${fmt(data.discount)}`, false, '#dc2626');
  if (data.tax && data.tax > 0) totalRow('VAT/Tax', fmt(data.tax));
  if (data.deliveryCost && data.deliveryCost > 0) totalRow('Delivery', fmt(data.deliveryCost));

  y += 2;
  line(margin, y, W - margin, y, '#94a3b8');
  y += 7;

  // Grand total — larger
  text('TOTAL', margin + contentW * 0.4, y, { size: 9, bold: true });
  text(fmt(data.grandTotal), W - margin, y, { align: 'right', size: 9, bold: true });
  y += 12;

  if (data.amountPaid !== undefined && data.amountPaid >= 0) {
    totalRow('Paid', fmt(data.amountPaid));
    if (data.change !== undefined && data.change >= 0) {
      totalRow('Change', fmt(data.change));
    }
  }

  y += 4;
  dashed(y);
  y += 10;

  // ── Footer ────────────────────────────────────────────────────────────────
  text(data.footer || 'Thank you for your business!', W / 2, y, { align: 'center', size: 7, color: '#475569' });
  y += 9;
  text('Powered by jasper.africa', W / 2, y, { align: 'center', size: 5.5, color: '#94a3b8' });
  y += 8;

  // Resize page to actual content height
  (pdf.internal as any).pageSize.height = y + margin;

  const cleanName = sanitizeFileName(`receipt-${data.receiptId}.pdf`);
  return new File([pdf.output('blob')], cleanName, { type: 'application/pdf' });
}

// ─── Share result types ───────────────────────────────────────────────────────

export type ShareResult =
  | { method: 'native-share' }
  | { method: 'downloaded'; phone: string };

// ─── Share receipt PDF via WhatsApp ───────────────────────────────────────────

export async function sharePosReceiptPdf(
  data: ReceiptData,
  phone: string,
  message?: string
): Promise<ShareResult> {
  const pdfFile = createReceiptPdfFromData(data);
  const waMessage = message || `Hello${data.customerName ? ` ${data.customerName}` : ''}, please find your receipt attached from ${data.businessName}. Thank you!`;
  const cleanPhone = phone.replace(/[^\d]/g, '');
  const files = [pdfFile];

  // MOBILE: Web Share API — opens OS share sheet, user taps WhatsApp
  const canShareFile =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files });

  if (canShareFile) {
    try {
      await navigator.share({ files, title: pdfFile.name, text: waMessage });
      return { method: 'native-share' };
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new Error('Share cancelled');
      console.warn('[pdfShare] Native share failed, falling back:', e);
    }
  }

  // DESKTOP: download + open WhatsApp
  downloadBlob(pdfFile, pdfFile.name);
  if (cleanPhone) {
    const waUrl = buildWhatsAppLink(waMessage, cleanPhone);
    setTimeout(() => window.open(waUrl, '_blank', 'noopener,noreferrer'), 600);
  }
  return { method: 'downloaded', phone: cleanPhone };
}

// ─── Legacy html2canvas approach (kept for invoice/quotation documents) ────────
// Only used for complex multi-page documents that can't be easily
// rebuilt as programmatic PDF. Receipt now uses createReceiptPdfFromData.

import html2canvas from 'html2canvas';

type PdfShareOptions = {
  elementId: string;
  fileName: string;
  phone?: string;
  message?: string;
  format?: 'a4' | 'receipt';
};

const UNSUPPORTED_COLOR_FN = /\b(?:oklch|oklab|lch|lab|color)\(/i;
const COLOR_STYLE_PROPS = [
  'color', 'backgroundColor', 'borderTopColor', 'borderRightColor',
  'borderBottomColor', 'borderLeftColor', 'outlineColor',
  'textDecorationColor', 'columnRuleColor',
] as const;

const safeCssColor = (value: string, fallback: string) => {
  if (!value || value === 'initial' || value === 'inherit') return fallback;
  if (UNSUPPORTED_COLOR_FN.test(value)) return fallback;
  return value;
};

const sanitizePdfCloneStyles = (root: HTMLElement) => {
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  nodes.forEach((node) => {
    const computed = window.getComputedStyle(node);
    COLOR_STYLE_PROPS.forEach((prop) => {
      const fallback = prop === 'backgroundColor' ? 'transparent'
        : prop.startsWith('border') ? '#e2e8f0' : '#0f172a';
      node.style[prop] = safeCssColor(computed[prop], fallback);
    });
    if (UNSUPPORTED_COLOR_FN.test(computed.boxShadow)) node.style.boxShadow = 'none';
    if (UNSUPPORTED_COLOR_FN.test(computed.textShadow)) node.style.textShadow = 'none';
    const fill = computed.getPropertyValue('fill');
    const stroke = computed.getPropertyValue('stroke');
    if (UNSUPPORTED_COLOR_FN.test(fill)) node.style.setProperty('fill', 'currentColor');
    if (UNSUPPORTED_COLOR_FN.test(stroke)) node.style.setProperty('stroke', 'currentColor');
  });
  root.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    img.style.maxWidth  = '48px';
    img.style.maxHeight = '48px';
    img.style.width     = 'auto';
    img.style.height    = 'auto';
    img.style.objectFit = 'contain';
    img.style.display   = 'block';
    img.style.margin    = '0 auto 4px auto';
    img.crossOrigin     = 'anonymous';
  });
};

const waitForImages = (root: HTMLElement): Promise<void> => {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  const promises = imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => resolve();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      setTimeout(done, 3000);
    });
  });
  return Promise.all(promises).then(() => {});
};

export async function createPdfFromElement({
  elementId, fileName, format = 'a4'
}: Omit<PdfShareOptions, 'phone' | 'message'>): Promise<File> {
  const source = document.getElementById(elementId);
  if (!source) throw new Error('Document not found. Make sure the preview is open.');

  const clone = source.cloneNode(true) as HTMLElement;
  const container = document.createElement('div');
  container.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${format === 'receipt' ? '320px' : '794px'};background:#ffffff;z-index:-1;overflow:visible;pointer-events:none;`;
  clone.style.cssText = `width:100%;overflow:visible;background:#ffffff;box-shadow:none;border-radius:0;`;
  container.appendChild(clone);
  document.body.appendChild(container);
  sanitizePdfCloneStyles(clone);

  try {
    await waitForImages(clone);
    await new Promise(res => setTimeout(res, 400));

    const canvas = await html2canvas(clone, {
      backgroundColor: '#ffffff', scale: 2, useCORS: true, allowTaint: false,
      logging: false, scrollX: 0, scrollY: 0,
      windowWidth: container.offsetWidth, windowHeight: clone.scrollHeight,
      width: container.offsetWidth, height: clone.scrollHeight,
    });

    const imageData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt',
      format: format === 'receipt' ? [226, Math.max(400, canvas.height * (226 / canvas.width))] : 'a4' });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = canvas.height * (pageWidth / canvas.width);

    if (format === 'receipt') {
      pdf.addImage(imageData, 'JPEG', 0, 0, imgWidth, imgHeight);
    } else {
      let yOffset = 0, page = 0;
      while (yOffset < imgHeight) {
        if (page > 0) pdf.addPage();
        pdf.addImage(imageData, 'JPEG', 0, -yOffset, imgWidth, imgHeight);
        yOffset += pageHeight; page++;
      }
    }

    const cleanName = sanitizeFileName(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
    return new File([pdf.output('blob')], cleanName, { type: 'application/pdf' });
  } finally {
    document.body.removeChild(container);
  }
}

export async function shareElementPdfToWhatsApp(options: PdfShareOptions): Promise<ShareResult> {
  const pdfFile = await createPdfFromElement(options);
  const message = options.message || 'Please find your receipt attached.';
  const phone = options.phone?.replace(/[^\d]/g, '') || '';
  const files = [pdfFile];

  const canShareFile =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files });

  if (canShareFile) {
    try {
      await navigator.share({ files, title: pdfFile.name, text: message });
      return { method: 'native-share' };
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new Error('Share cancelled');
      console.warn('[pdfShare] Native share failed, falling back:', e);
    }
  }

  downloadBlob(pdfFile, pdfFile.name);
  if (phone) {
    const waUrl = buildWhatsAppLink(message, phone);
    setTimeout(() => window.open(waUrl, '_blank', 'noopener,noreferrer'), 600);
  }
  return { method: 'downloaded', phone };
}
