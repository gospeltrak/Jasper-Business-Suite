export type ImageCompressionOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/webp' | 'image/jpeg' | 'image/png';
  backgroundColor?: string;
};

const DEFAULT_OPTIONS: Required<ImageCompressionOptions> = {
  maxWidth: 900,
  maxHeight: 900,
  quality: 0.72,
  mimeType: 'image/webp',
  backgroundColor: '',
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to load image for compression.'));
    img.src = src;
  });
}

export async function compressImageFile(file: File, options: ImageCompressionOptions = {}): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return readFileAsDataUrl(file);
  }

  const merged = { ...DEFAULT_OPTIONS, ...options };
  const original = await readFileAsDataUrl(file);
  const img = await loadImage(original);
  const scale = Math.min(1, merged.maxWidth / img.width, merged.maxHeight / img.height);
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return original;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (merged.backgroundColor) {
    ctx.fillStyle = merged.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL(merged.mimeType, merged.quality);
}


/**
 * Subscription receipts are intentionally much smaller than ordinary product
 * photos. Compress in the browser, try multiple sizes/qualities, then reject
 * if the 14 KB ceiling cannot be met without overly aggressive downsizing.
 * We never silently upload an oversized receipt.
 */
export async function compressPaymentReceipt(file: File, maxBytes = 14 * 1024): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Use a PNG, JPG, or WebP receipt image.');
  }
  const img = await loadImage(await readFileAsDataUrl(file));
  if (img.width < 1 || img.height < 1) throw new Error('The receipt image is invalid.');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('This device cannot compress receipt images.');

  // Receipts benefit from white backgrounds and legible, high-contrast text.
  // Start with a readable size, only reduce as necessary.
  for (const maxEdge of [1200, 1000, 840, 720, 640, 560]) {
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.68, 0.56, 0.44, 0.34]) {
      const dataUrl = canvas.toDataURL('image/webp', quality);
      if (!dataUrl.startsWith('data:image/webp;base64,')) {
        throw new Error('WebP compression is unavailable on this device.');
      }
      const encoded = dataUrl.split(',')[1] || '';
      const bytes = Math.floor(encoded.length * 3 / 4) - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
      if (bytes > 0 && bytes <= maxBytes) return dataUrl;
    }
  }
  throw new Error('The receipt cannot fit within 14 KB clearly. Please crop it to the payment details and try again.');
}
