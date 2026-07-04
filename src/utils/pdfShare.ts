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

  // FIX: cap all images to receipt logo size (48x48px).
  // cloneNode() copies DOM but Tailwind classes don't re-apply in off-screen
  // containers, so images render at their natural full size causing the huge
  // logo in the PDF. Force every img to max 48x48px.
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

// Wait for all images to fully load before capturing
const waitForImages = (root: HTMLElement): Promise<void> => {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  const promises = imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => resolve();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      setTimeout(done, 3000); // never wait more than 3s per image
    });
  });
  return Promise.all(promises).then(() => {});
};

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

export async function createPdfFromElement({
  elementId, fileName, format = 'a4'
}: Omit<PdfShareOptions, 'phone' | 'message'>): Promise<File> {
  const source = document.getElementById(elementId);
  if (!source) throw new Error('Receipt not found. Make sure the receipt preview is open.');

  const clone = source.cloneNode(true) as HTMLElement;
  const container = document.createElement('div');
  container.style.cssText = `
    position:fixed; top:-9999px; left:-9999px;
    width:${format === 'receipt' ? '320px' : '794px'};
    background:#ffffff; z-index:-1; overflow:visible; pointer-events:none;
  `;
  clone.style.cssText = `width:100%; overflow:visible; background:#ffffff; box-shadow:none; border-radius:0;`;
  container.appendChild(clone);
  document.body.appendChild(container);
  sanitizePdfCloneStyles(clone);

  try {
    await waitForImages(clone);
    await new Promise(res => setTimeout(res, 400));

    const canvas = await html2canvas(clone, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      scrollX: 0, scrollY: 0,
      windowWidth: container.offsetWidth,
      windowHeight: clone.scrollHeight,
      width: container.offsetWidth,
      height: clone.scrollHeight,
    });

    const imageData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait', unit: 'pt',
      format: format === 'receipt'
        ? [226, Math.max(400, canvas.height * (226 / canvas.width))]
        : 'a4'
    });

    const pageWidth  = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth   = pageWidth;
    const imgHeight  = canvas.height * (pageWidth / canvas.width);

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

export type ShareResult =
  | { method: 'native-share' }
  | { method: 'downloaded'; phone: string };

export async function shareElementPdfToWhatsApp(options: PdfShareOptions): Promise<ShareResult> {
  const pdfFile = await createPdfFromElement(options);
  const message = options.message || 'Please find your receipt attached.';
  const phone   = options.phone?.replace(/[^\d]/g, '') || '';
  const files   = [pdfFile];

  // MOBILE: Web Share API — opens OS share sheet, user taps WhatsApp,
  // PDF is attached and sent directly. Best possible mobile experience.
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

  // DESKTOP FALLBACK: download PDF + open WhatsApp with text message.
  // WhatsApp Web cannot receive file attachments via any URL scheme —
  // this is a WhatsApp platform limitation, not a code limitation.
  downloadBlob(pdfFile, pdfFile.name);
  if (phone) {
    const waUrl = buildWhatsAppLink(message, phone);
    setTimeout(() => window.open(waUrl, '_blank', 'noopener,noreferrer'), 600);
  }
  return { method: 'downloaded', phone };
}
