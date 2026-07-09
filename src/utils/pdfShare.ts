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

export const printPdfFile = (pdfFile: File) => {
  if (pdfFile.type !== 'application/pdf' || !pdfFile.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Printable document must be a real PDF file.');
  }
  const url = URL.createObjectURL(pdfFile);
  const printWindow = window.open(url, '_blank');
  if (!printWindow) {
    downloadBlob(pdfFile, pdfFile.name);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }
  setTimeout(() => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch {
      downloadBlob(pdfFile, pdfFile.name);
    }
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }, 900);
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

type PdfShareOptions = {
  elementId: string;
  fileName: string;
  phone?: string;
  message?: string;
  format?: 'a4' | 'receipt';
  includeHidden?: boolean;
};

const isElementVisible = (el: Element) => {
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
};

const cleanText = (value: string) =>
  value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

const collectDirectText = (el: Element) => {
  const parts: string[] = [];
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = cleanText(node.textContent || '');
      if (text) parts.push(text);
    }
  });
  return parts.join(' ');
};

const appendWrappedText = (
  pdf: jsPDF,
  textValue: string,
  x: number,
  y: number,
  maxWidth: number,
  options: { fontSize?: number; bold?: boolean; color?: string; lineGap?: number } = {}
) => {
  const fontSize = options.fontSize || 9;
  pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
  pdf.setFontSize(fontSize);
  pdf.setTextColor(options.color || '#0f172a');
  const lines = pdf.splitTextToSize(cleanText(textValue), maxWidth);
  pdf.text(lines, x, y);
  return y + lines.length * (fontSize + (options.lineGap ?? 2));
};

const ensurePageSpace = (pdf: jsPDF, y: number, needed: number, margin: number) => {
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (y + needed <= pageHeight - margin) return y;
  pdf.addPage();
  return margin;
};

const drawTable = (pdf: jsPDF, table: HTMLTableElement, yStart: number, margin: number, includeHidden = false) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  const rows = Array.from(table.querySelectorAll('tr'))
    .filter(row => includeHidden || isElementVisible(row))
    .map(row => Array.from(row.children)
      .filter(cell => includeHidden || isElementVisible(cell))
      .map(cell => cleanText(cell.textContent || ''))
    )
    .filter(cells => cells.some(Boolean));

  if (!rows.length) return yStart;

  const columnCount = Math.max(...rows.map(row => row.length));
  const colWidth = contentWidth / Math.max(columnCount, 1);
  let y = ensurePageSpace(pdf, yStart, 24, margin);

  rows.forEach((row, rowIndex) => {
    const wrappedCells = Array.from({ length: columnCount }, (_, index) => {
      pdf.setFontSize(7.5);
      return pdf.splitTextToSize(row[index] || '', colWidth - 6);
    });
    const rowHeight = Math.max(18, ...wrappedCells.map(lines => lines.length * 9 + 8));
    y = ensurePageSpace(pdf, y, rowHeight, margin);

    pdf.setFillColor(rowIndex === 0 ? '#f1f5f9' : rowIndex % 2 ? '#ffffff' : '#f8fafc');
    pdf.rect(margin, y - 10, contentWidth, rowHeight, 'F');
    pdf.setDrawColor('#e2e8f0');
    pdf.line(margin, y - 10, margin + contentWidth, y - 10);

    wrappedCells.forEach((lines, colIndex) => {
      pdf.setFont('helvetica', rowIndex === 0 ? 'bold' : 'normal');
      pdf.setFontSize(rowIndex === 0 ? 7.5 : 7);
      pdf.setTextColor(rowIndex === 0 ? '#334155' : '#0f172a');
      pdf.text(lines, margin + colIndex * colWidth + 3, y);
    });
    y += rowHeight;
  });

  return y + 8;
};

export async function createPdfFromElement({
  elementId, fileName, format = 'a4', includeHidden = false
}: Omit<PdfShareOptions, 'phone' | 'message'>): Promise<File> {
  const source = document.getElementById(elementId);
  if (!source) throw new Error('Document not found. Make sure the preview is open.');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: format === 'receipt' ? [226, 800] : 'a4',
  });
  const margin = format === 'receipt' ? 12 : 42;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const nodes = Array.from(source.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,p,span,div,section,li,table,img'))
    .filter(el => includeHidden || isElementVisible(el))
    .filter((el) => {
      if (el.closest('button,[role="button"],input,textarea,select,.print\\:hidden')) return false;
      if (el.tagName === 'TABLE') return true;
      if (el.tagName === 'IMG') return true;
      if (el.querySelector('table')) return false;
      return !!cleanText(collectDirectText(el));
    });

  const seenText = new Set<string>();

  nodes.forEach((el) => {
    if (el.tagName === 'TABLE') {
      y = drawTable(pdf, el as HTMLTableElement, y + 4, margin, includeHidden);
      return;
    }

    if (el.tagName === 'IMG') {
      const img = el as HTMLImageElement;
      if (img.complete && img.naturalWidth && /^data:image\/|^https?:|^\//.test(img.src || '')) {
        try {
          const maxLogoWidth = format === 'receipt' ? 58 : 82;
          const width = Math.min(maxLogoWidth, img.naturalWidth);
          const height = Math.min(54, img.naturalHeight * (width / img.naturalWidth));
          y = ensurePageSpace(pdf, y, height + 8, margin);
          pdf.addImage(img, 'PNG', margin, y, width, height, undefined, 'FAST');
          y += height + 8;
        } catch {
          // Keep the PDF text-valid even if a remote logo cannot be embedded.
        }
      }
      return;
    }

    const textValue = cleanText(collectDirectText(el));
    if (!textValue || seenText.has(textValue)) return;
    seenText.add(textValue);

    const tag = el.tagName.toLowerCase();
    const isHeading = /^h[1-4]$/.test(tag);
    const isSmall = tag === 'span' || el.className.toString().includes('text-[9');
    const fontSize = format === 'receipt'
      ? (isHeading ? 9 : isSmall ? 6.5 : 7.2)
      : (tag === 'h1' ? 17 : tag === 'h2' ? 14 : isHeading ? 11 : isSmall ? 8 : 9.2);
    const needed = Math.max(16, Math.ceil(textValue.length / 70) * (fontSize + 3));
    y = ensurePageSpace(pdf, y, needed, margin);
    y = appendWrappedText(pdf, textValue, margin, y, contentWidth, {
      fontSize,
      bold: isHeading || /total|balance|invoice|receipt|delivery note|quotation|proforma/i.test(textValue),
      color: isHeading ? '#0f172a' : '#334155',
      lineGap: format === 'receipt' ? 1 : 2,
    }) + (isHeading ? 5 : 2);
  });

  if (y === margin) {
    throw new Error('Document has no printable data.');
  }

  const cleanName = sanitizeFileName(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  return new File([pdf.output('blob')], cleanName, { type: 'application/pdf' });
}

export async function downloadPdfFromElement(options: Omit<PdfShareOptions, 'phone' | 'message'>): Promise<File> {
  const pdfFile = await createPdfFromElement(options);
  downloadBlob(pdfFile, pdfFile.name);
  return pdfFile;
}

export async function printPdfFromElement(options: Omit<PdfShareOptions, 'phone' | 'message'>): Promise<File> {
  const pdfFile = await createPdfFromElement(options);
  printPdfFile(pdfFile);
  return pdfFile;
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
