import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
  businessEmail?: string;
  businessCity?: string;
  businessLogo?: string;
  receiptId: string;
  timestamp: string;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
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
  documentTitle?: string;
  status?: string;
  preparedByRole?: string;
  terms?: string[];
}

export function createReceiptPdfFromData(data: ReceiptData): File {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const margin = 32;
  const navy = '#0f172a';
  const muted = '#64748b';
  const pale = '#f8fafc';
  const indigo = '#4f46e5';
  const text = (value: string, x: number, y: number, options: { align?: 'left'|'center'|'right'; size?: number; bold?: boolean; color?: string } = {}) => {
    pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
    pdf.setFontSize(options.size || 8);
    pdf.setTextColor(options.color || navy);
    pdf.text(String(value), x, y, { align: options.align || 'left' });
  };
  const fmt = (amount: number) => `${data.currency} ${Math.abs(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const roundedBox = (x: number, y: number, w: number, h: number, radius: number, fill: string, stroke?: string) => {
    pdf.setFillColor(fill);
    if (stroke) pdf.setDrawColor(stroke);
    pdf.roundedRect(x, y, w, h, radius, radius, stroke ? 'FD' : 'F');
  };

  // Header — same arrangement as the approved A4 template.
  let logoAdded = false;
  if (data.businessLogo?.startsWith('data:image/')) {
    try {
      pdf.addImage(data.businessLogo, data.businessLogo.includes('png') ? 'PNG' : 'JPEG', margin, 34, 88, 42, undefined, 'FAST');
      logoAdded = true;
    } catch { /* fall back to the business initial */ }
  }
  if (!logoAdded) {
    roundedBox(margin, 35, 34, 34, 8, indigo);
    text(data.businessName.charAt(0).toUpperCase(), margin + 17, 58, { align: 'center', size: 18, bold: true, color: '#ffffff' });
  }
  text(data.businessName, margin, 101, { size: 16, bold: true });
  let businessY = 117;
  [data.businessCity, data.businessAddress, data.businessPhone ? `Tel: ${data.businessPhone}` : '', data.businessEmail].filter(Boolean).forEach(value => {
    text(String(value), margin, businessY, { size: 8, color: muted });
    businessY += 12;
  });

  const title = (data.documentTitle || 'A4 RECEIPT').toUpperCase();
  const titleWidth = Math.max(112, Math.min(178, title.length * 8 + 28));
  roundedBox(W - margin - titleWidth, 32, titleWidth, 28, 10, indigo);
  text(title, W - margin - titleWidth / 2, 51, { align: 'center', size: 11, bold: true, color: '#ffffff' });
  const metaX = W - margin;
  text(`No:  ${data.receiptId}`, metaX, 78, { align: 'right', size: 8, bold: true });
  text(`Date:  ${new Date(data.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`, metaX, 94, { align: 'right', size: 8, color: muted });
  if (data.cashierName) text(`Prepared by:  ${data.cashierName}`, metaX, 110, { align: 'right', size: 8, color: muted });
  const status = (data.status || ((data.amountPaid ?? 0) >= data.grandTotal ? 'PAID' : 'PENDING')).toUpperCase();
  roundedBox(W - margin - 64, 121, 64, 18, 7, status === 'PAID' ? '#ecfdf5' : '#fffbeb', status === 'PAID' ? '#a7f3d0' : '#fde68a');
  text(`• ${status}`, W - margin - 32, 133.5, { align: 'center', size: 7, bold: true, color: status === 'PAID' ? '#047857' : '#b45309' });

  // Bill To / From panel.
  roundedBox(margin, 178, W - margin * 2, 80, 12, pale, '#e2e8f0');
  text('BILL TO', margin + 16, 202, { size: 7, bold: true, color: '#94a3b8' });
  text(data.customerName || 'Walk-In Customer', margin + 16, 224, { size: 11, bold: true });
  if (data.customerPhone) text(data.customerPhone, margin + 16, 239, { size: 8, color: muted });
  text('FROM', W / 2 + 8, 202, { size: 7, bold: true, color: '#94a3b8' });
  text(data.businessName, W / 2 + 8, 224, { size: 11, bold: true });
  text(data.preparedByRole || data.paymentMethod || 'Sales', W / 2 + 8, 239, { size: 8, color: muted });

  // Items table, with automatic extra A4 pages when an invoice is long.
  let y = 284;
  const drawTableHeader = () => {
    roundedBox(margin, y, W - margin * 2, 30, 9, navy);
    text('#', margin + 14, y + 19, { size: 7, bold: true, color: '#ffffff' });
    text('DESCRIPTION', margin + 44, y + 19, { size: 7, bold: true, color: '#ffffff' });
    text('QTY', W - 250, y + 19, { size: 7, bold: true, color: '#ffffff', align: 'center' });
    text('UNIT PRICE', W - 130, y + 19, { size: 7, bold: true, color: '#ffffff', align: 'right' });
    text('TOTAL', W - margin - 12, y + 19, { size: 7, bold: true, color: '#ffffff', align: 'right' });
    y += 46;
  };
  drawTableHeader();
  data.items.forEach((item, index) => {
    if (y > 690) {
      pdf.addPage();
      y = 38;
      drawTableHeader();
    }
    const nameLines = pdf.splitTextToSize(item.name || 'Item', 210).slice(0, 2);
    text(String(index + 1), margin + 14, y, { size: 8, color: '#94a3b8' });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(navy);
    pdf.text(nameLines, margin + 44, y);
    text(`${item.qty}${item.unit ? ` ${item.unit}` : ''}`, W - 250, y, { size: 8, align: 'center' });
    text(fmt(item.price), W - 130, y, { size: 8, align: 'right', color: muted });
    text(fmt(item.total), W - margin - 12, y, { size: 8, align: 'right', bold: true });
    y += Math.max(28, nameLines.length * 11 + 10);
  });

  const totalsX = W - margin - 220;
  y = Math.max(y + 8, 390);
  const totalRow = (label: string, value: string, color = muted) => {
    text(label, totalsX, y, { size: 8, color });
    text(value, W - margin, y, { size: 8, align: 'right', bold: true });
    y += 22;
  };
  totalRow('Subtotal', fmt(data.subtotal));
  if ((data.discount || 0) > 0) totalRow('Discount', `-${fmt(data.discount || 0)}`, '#b45309');
  if ((data.tax || 0) > 0) totalRow('VAT / Tax', fmt(data.tax || 0));
  if ((data.deliveryCost || 0) > 0) totalRow('Delivery', fmt(data.deliveryCost || 0));
  roundedBox(totalsX, y - 7, W - margin - totalsX, 38, 9, navy);
  text('TOTAL', totalsX + 14, y + 17, { size: 10, bold: true, color: '#ffffff' });
  text(fmt(data.grandTotal), W - margin - 14, y + 17, { align: 'right', size: 11, bold: true, color: '#ffffff' });
  y += 52;
  const balance = Math.max(0, data.grandTotal - (data.amountPaid || 0));
  totalRow('Balance', fmt(balance));

  // Signatures, terms and footer.
  const signatureY = Math.max(585, y + 34);
  pdf.setDrawColor('#cbd5e1');
  pdf.line(margin, signatureY, margin + 255, signatureY);
  pdf.line(W - margin - 255, signatureY, W - margin, signatureY);
  text(data.cashierName || 'Authorized Person', margin, signatureY + 16, { size: 8, bold: true });
  text(data.preparedByRole || 'Staff', margin, signatureY + 29, { size: 7, color: '#94a3b8' });
  text('Authorized Signature', W - margin, signatureY + 16, { align: 'right', size: 7, color: '#94a3b8' });
  const terms = data.terms?.filter(Boolean) || [];
  if (terms.length) {
    const termsY = signatureY + 72;
    pdf.setDrawColor('#f1f5f9'); pdf.line(margin, termsY - 18, W - margin, termsY - 18);
    text('TERMS & CONDITIONS', margin, termsY, { size: 7, bold: true, color: '#94a3b8' });
    terms.slice(0, 4).forEach((term, index) => text(`${index + 1}. ${term}`, margin, termsY + 19 + index * 17, { size: 8, color: muted }));
  }
  pdf.setDrawColor('#f1f5f9'); pdf.line(margin, H - 66, W - margin, H - 66);
  text(data.footer || 'Powered by Ndiva Suite', W / 2, H - 48, { align: 'center', size: 6, color: '#cbd5e1' });

  const cleanName = sanitizeFileName(`a4-receipt-${data.receiptId}.pdf`);
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

const waitForDocumentAssets = async (root: HTMLElement) => {
  if (document.fonts?.ready) await document.fonts.ready;
  await Promise.all(Array.from(root.querySelectorAll('img')).map(async (image) => {
    if (image.complete) {
      try { await image.decode(); } catch { /* html2canvas will use the available image */ }
      return;
    }
    await new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    });
  }));
};

const createVisualA4Pdf = async (source: HTMLElement) => {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '794px',
    background: '#ffffff',
    zIndex: '-1',
    pointerEvents: 'none',
  });

  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  Object.assign(clone.style, {
    display: 'block',
    width: '794px',
    minHeight: '1123px',
    height: 'auto',
    maxHeight: 'none',
    margin: '0',
    transform: 'none',
    transformOrigin: 'top left',
    boxShadow: 'none',
    overflow: 'visible',
    background: '#ffffff',
  });
  clone.querySelectorAll('button,[role="button"],input,textarea,select,.print\\:hidden').forEach(node => node.remove());
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    await waitForDocumentAssets(clone);
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      width: 794,
      height: Math.max(1123, clone.scrollHeight),
      windowWidth: 794,
      windowHeight: Math.max(1123, clone.scrollHeight),
      scrollX: 0,
      scrollY: 0,
    });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const standardSliceHeight = Math.floor(canvas.width * (pageHeight / pageWidth));
    // 794 × 1123 is the browser A4 canvas. Its rounded pixel height can be one
    // pixel taller than the PDF ratio, which must not create a blank second page.
    const sliceHeight = canvas.height <= standardSliceHeight + 4 ? canvas.height : standardSliceHeight;
    let sourceY = 0;
    let page = 0;

    while (sourceY < canvas.height) {
      if (page > 0 && canvas.height - sourceY < 8) break;
      const currentHeight = Math.min(sliceHeight, canvas.height - sourceY);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = currentHeight;
      const context = pageCanvas.getContext('2d');
      if (!context) throw new Error('Could not prepare the A4 page.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      context.drawImage(canvas, 0, sourceY, canvas.width, currentHeight, 0, 0, canvas.width, currentHeight);
      if (page > 0) pdf.addPage();
      const imageHeight = pageWidth * (currentHeight / canvas.width);
      pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, pageWidth, imageHeight, undefined, 'FAST');
      sourceY += currentHeight;
      page += 1;
    }
    return pdf;
  } finally {
    host.remove();
  }
};

export async function createPdfFromElement({
  elementId, fileName, format = 'a4', includeHidden = false
}: Omit<PdfShareOptions, 'phone' | 'message'>): Promise<File> {
  const source = document.getElementById(elementId);
  if (!source) throw new Error('Document not found. Make sure the preview is open.');

  if (format === 'a4') {
    const visualPdf = await createVisualA4Pdf(source);
    const cleanName = sanitizeFileName(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
    return new File([visualPdf.output('blob')], cleanName, { type: 'application/pdf' });
  }

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
