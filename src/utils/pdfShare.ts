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
    throw new Error('Document template was not found on screen.');
  }

  const canvas = await html2canvas(source, {
    backgroundColor: '#ffffff',
    scale: Math.min(2, window.devicePixelRatio || 1.5),
    useCORS: true,
    allowTaint: true,
    logging: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: source.scrollWidth,
    windowHeight: source.scrollHeight
  });

  const imageData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: format === 'receipt' ? [320, Math.max(640, canvas.height * (320 / canvas.width))] : 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const ratio = canvas.width / canvas.height;
  const imgWidth = pageWidth;
  const imgHeight = imgWidth / ratio;

  if (format === 'receipt') {
    pdf.addImage(imageData, 'JPEG', 0, 0, pageWidth, Math.min(pageHeight, imgHeight));
  } else {
    let y = 0;
    let remainingHeight = imgHeight;
    pdf.addImage(imageData, 'JPEG', 0, y, imgWidth, imgHeight);
    remainingHeight -= pageHeight;

    while (remainingHeight > 0) {
      y -= pageHeight;
      pdf.addPage();
      pdf.addImage(imageData, 'JPEG', 0, y, imgWidth, imgHeight);
      remainingHeight -= pageHeight;
    }
  }

  const cleanName = sanitizeFileName(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  const blob = pdf.output('blob');
  return new File([blob], cleanName, { type: 'application/pdf' });
}

export async function shareElementPdfToWhatsApp(options: PdfShareOptions) {
  const pdfFile = await createPdfFromElement(options);
  const message = options.message || 'Please find the attached PDF document.';
  const files = [pdfFile];
  const canShareFile = typeof navigator !== 'undefined'
    && !!navigator.share
    && (!navigator.canShare || navigator.canShare({ files }));

  if (canShareFile) {
    await navigator.share({
      files,
      title: pdfFile.name,
      text: message
    });
    return { shared: true, downloaded: false };
  }

  downloadBlob(pdfFile, pdfFile.name);
  window.open(buildWhatsAppLink(message, options.phone), '_blank', 'noopener,noreferrer');
  return { shared: false, downloaded: true };
}
