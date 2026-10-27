/**
 * Tenant image uploads have explicit byte budgets before they reach Supabase.
 * 10 KiB is the hard limit for logos; product photos aim for 10 KiB and may
 * use up to 25 KiB when a smaller file would noticeably damage visual detail.
 * These limits do not apply to documents or evidence photographs.
 */
export const LOGO_MAX_BYTES = 10 * 1024;
export const PRODUCT_TARGET_BYTES = 10 * 1024;
export const PRODUCT_MAX_BYTES = 25 * 1024;

type ImageMime = 'image/jpeg' | 'image/webp';

export interface ImageBudget {
  targetBytes: number;
  maxBytes: number;
  maxDimension?: number;
  preferredMime?: ImageMime;
}

export class ImageBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageBudgetError';
  }
}

/** Renderer is injectable so the budget decision can be tested without DOM. */
export async function selectBudgetedImage(
  render: (dimension: number, quality: number) => Promise<Blob>,
  budget: ImageBudget,
): Promise<Blob> {
  if (!Number.isInteger(budget.targetBytes) || !Number.isInteger(budget.maxBytes) ||
      budget.targetBytes <= 0 || budget.maxBytes < budget.targetBytes) {
    throw new ImageBudgetError('Invalid image compression limits');
  }
  const maxDimension = Math.max(112, Math.min(800, Math.floor(budget.maxDimension || 400)));
  const dimensions = [...new Set([1, 0.8, 0.64, 0.48, 0.36, 0.28]
    .map(scale => Math.max(96, Math.round(maxDimension * scale))))];
  const qualities = [0.84, 0.74, 0.64, 0.54, 0.44];
  let acceptable: Blob | null = null;

  for (const dimension of dimensions) {
    for (const quality of qualities) {
      const candidate = await render(dimension, quality);
      if (!candidate || !candidate.size) continue;
      if (candidate.size <= budget.targetBytes) return candidate;
      // First within the hard limit keeps more pixels and quality if an
      // especially detailed product image cannot safely reach 10 KiB.
      if (!acceptable && candidate.size <= budget.maxBytes) acceptable = candidate;
    }
  }
  if (acceptable) return acceptable;
  throw new ImageBudgetError(`This image could not be reduced below ${Math.floor(budget.maxBytes / 1024)} KB. Select a simpler image.`);
}

async function readImage(file: File): Promise<HTMLImageElement> {
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new ImageBudgetError('Unable to read the image'));
    reader.readAsDataURL(file);
  });
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new ImageBudgetError('Unable to decode the image'));
    image.src = src;
  });
}

async function toBlob(canvas: HTMLCanvasElement, mime: ImageMime, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new ImageBudgetError('Your browser could not optimize this image'));
    }, mime, quality);
  });
}

/**
 * Browser-only. Resize keeping aspect ratio (no upscaling), encode WebP where
 * supported and preserve transparency for logos. Unsupported WebP falls back
 * to JPEG with white beneath transparent pixels.
 */
export async function compressImageToBudget(file: File, budget: ImageBudget): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    throw new ImageBudgetError('A valid raster image is required for compression');
  }
  const image = await readImage(file);
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new ImageBudgetError('The selected image is empty');
  }
  const mime = budget.preferredMime || 'image/jpeg';

  return selectBudgetedImage(async (dimension, quality) => {
    const ratio = Math.min(1, dimension / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageBudgetError('Image compression is unavailable');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (mime === 'image/jpeg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(image, 0, 0, width, height);
    let blob = await toBlob(canvas, mime, quality);
    if (blob.type !== mime) {
      // Canvas can silently return PNG on browsers without WebP encoding.
      // Do not upload that lossless PNG under a .webp path or content type.
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      blob = await toBlob(canvas, 'image/jpeg', quality);
    }
    if (blob.type !== mime && blob.type !== 'image/jpeg') {
      throw new ImageBudgetError('Image encoder produced an unsupported format');
    }
    return blob;
  }, budget);
}

/** Reuse the optimized blob when uploading; never re-encode it as JSON. */
export function imageFileExtension(blob: Blob): 'jpg' | 'webp' {
  if (blob.type === 'image/jpeg') return 'jpg';
  if (blob.type === 'image/webp') return 'webp';
  throw new ImageBudgetError('Unsupported optimized image type');
}
