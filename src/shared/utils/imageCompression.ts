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
