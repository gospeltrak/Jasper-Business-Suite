import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { buildWhatsAppLink } from './whatsapp';

type PdfShareOptions = {
  elementId: string;
  fileName: string;
  phone?: string;
  message?: string;
  format?: 'a4' | 'receipt';
};

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
  URL.revokeObjectURL(url);
};

export async function createPdfFromElement({
  elementId,
  fileName,
  format = 'a4'
}: Omit<PdfShareOptions, 'phone' | 'message'>): Promise<File> {
  const source = document.getElementById(elementId);
  if (!source) {
    throw new Error('Document not found on screen. Please make sure the preview is open.');
  }

  // Clone element into a temporary off-screen container so overflow/clipping doesn't affect capture
  const clone = source.cloneNode(true) as HTMLElement;
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: ${format === 'receipt' ? '320px' : '794px'};
    background: #ffffff;
    z-index: -1;
    overflow: visible;
    pointer-events: none;
  `;
  clone.style.cssText = `
    width: 100%;
    overflow: visible;
    background: #ffffff;
    box-shadow: none;
    border-radius: 0;
  `;
  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    // Short wait for fonts/images to settle
    await new Promise(res => setTimeout(res, 300));

    const canvas = await html2canvas(clone, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: container.offsetWidth,
      windowHeight: clone.scrollHeight,
      width: container.offsetWidth,
      height: clone.scrollHeight,
    });

    const imageData = canvas.toDataURL('image/jpeg', 0.95);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: format === 'receipt'
        ? [226, Math.max(400, canvas.height * (226 / canvas.width))]
        : 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = canvas.height * (pageWidth / canvas.width);

    if (format === 'receipt') {
      pdf.addImage(imageData, 'JPEG', 0, 0, imgWidth, imgHeight);
    } else {
      // Multi-page A4
      let yOffset = 0;
      let page = 0;
      while (yOffset < imgHeight) {
        if (page > 0) pdf.addPage();
        pdf.addImage(imageData, 'JPEG', 0, -yOffset, imgWidth, imgHeight);
        yOffset += pageHeight;
        page++;
      }
    }

    const cleanName = sanitizeFileName(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
    const blob = pdf.output('blob');
    return new File([blob], cleanName, { type: 'application/pdf' });

  } finally {
    document.body.removeChild(container);
  }
}

export async function shareElementPdfToWhatsApp(options: PdfShareOptions) {
  const pdfFile = await createPdfFromElement(options);
  const message = options.message || 'Please find the attached document.';
  const phone = options.phone?.replace(/[^\d]/g, '') || '';
  const files = [pdfFile];

  // Try native share (mobile — works on Android/iOS)
  const canShareFile = typeof navigator !== 'undefined'
    && !!navigator.share
    && (!navigator.canShare || navigator.canShare({ files }));

  if (canShareFile) {
    try {
      await navigator.share({ files, title: pdfFile.name, text: message });
      return { shared: true, downloaded: false };
    } catch (e: any) {
      // User cancelled or share failed — fall through to download
      if (e?.name !== 'AbortError') {
        console.warn('Native share failed, falling back to download:', e);
      }
    }
  }

  // Fallback: download PDF + open WhatsApp link
  downloadBlob(pdfFile, pdfFile.name);
  if (phone) {
    const waUrl = buildWhatsAppLink(message, phone);
    setTimeout(() => window.open(waUrl, '_blank', 'noopener,noreferrer'), 500);
  }
  return { shared: false, downloaded: true };
}
