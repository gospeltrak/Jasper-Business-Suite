/**
 * imageStorage.ts
 *
 * Handles all image uploads for Jasper Business Suite.
 *
 * Strategy:
 *   1. Compress the image in the browser (canvas → 400×400px, JPEG 75%)
 *   2. Upload the compressed file to Supabase Storage
 *   3. Return the permanent public URL — this URL is what gets saved in
 *      the database and localStorage, never the raw base64 data
 *
 * Buckets:
 *   - product-images  → /{tenantId}/{productId}.jpg
 *   - tenant-logos    → /{tenantId}/logo.jpg
 *
 * Why this approach:
 *   - Compressed size: ~20-30KB per image (down from 2-5MB raw)
 *   - 200 tenants × 400 images × 25KB = ~2GB total in Supabase Storage
 *   - localStorage only stores a ~100-byte URL, never image data
 *   - Images never disappear because they are not subject to localStorage
 *     quota limits
 */

import { getSecureDataBridgeClient } from '../secureDataBridge';

// ─── Compression ─────────────────────────────────────────────────────────────

const MAX_DIMENSION = 400; // px — matches POS catalogue card size
const JPEG_QUALITY  = 0.75; // 75% — good visual quality, ~20-30KB output

/**
 * Compress any image file to MAX_DIMENSION × MAX_DIMENSION JPEG at JPEG_QUALITY.
 * Maintains aspect ratio — shorter dimension is padded to a square with white.
 * Returns a Blob ready for upload.
 */
export async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = MAX_DIMENSION;
        canvas.height = MAX_DIMENSION;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not available')); return; }

        // White background (so transparent PNGs look clean as JPEG)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, MAX_DIMENSION, MAX_DIMENSION);

        // Scale to fit within MAX_DIMENSION × MAX_DIMENSION, centered
        const scale = Math.min(MAX_DIMENSION / img.width, MAX_DIMENSION / img.height);
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const x = Math.round((MAX_DIMENSION - w) / 2);
        const y = Math.round((MAX_DIMENSION - h) / 2);
        ctx.drawImage(img, x, y, w, h);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob returned null'));
          },
          'image/jpeg',
          JPEG_QUALITY
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ─── Upload helpers ───────────────────────────────────────────────────────────

/**
 * Upload a product image to Supabase Storage.
 * Path: product-images/{tenantId}/{productId}.jpg
 * Returns the permanent public URL, or null on failure.
 */
export async function uploadProductImage(
  file: File,
  tenantId: string,
  productId: string
): Promise<string | null> {
  try {
    const client: any = await getSecureDataBridgeClient();
    const compressed = await compressImage(file);
    const path = `${tenantId}/${productId}.jpg`;

    const { error } = await client.storage
      .from('product-images')
      .upload(path, compressed, {
        contentType: 'image/jpeg',
        upsert: true, // overwrite if same product image already exists
      });

    if (error) {
      console.error('[imageStorage] uploadProductImage failed:', error.message);
      return null;
    }

    const { data } = client.storage
      .from('product-images')
      .getPublicUrl(path);

    return data?.publicUrl || null;
  } catch (err) {
    console.error('[imageStorage] uploadProductImage exception:', err);
    return null;
  }
}

/**
 * Upload a tenant logo to Supabase Storage.
 * Path: tenant-logos/{tenantId}/logo.jpg
 * Returns the permanent public URL, or null on failure.
 */
export async function uploadTenantLogo(
  file: File,
  tenantId: string
): Promise<string | null> {
  try {
    const client: any = await getSecureDataBridgeClient();

    // Logos get slightly more generous compression (still 400×400 max)
    // but we accept SVG as-is since we can't canvas-compress vector graphics
    let uploadBlob: Blob;
    let contentType: string;

    if (file.type === 'image/svg+xml') {
      uploadBlob = file;
      contentType = 'image/svg+xml';
    } else {
      uploadBlob = await compressImage(file);
      contentType = 'image/jpeg';
    }

    const ext = file.type === 'image/svg+xml' ? 'svg' : 'jpg';
    const path = `${tenantId}/logo.${ext}`;

    const { error } = await client.storage
      .from('tenant-logos')
      .upload(path, uploadBlob, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error('[imageStorage] uploadTenantLogo failed:', error.message);
      return null;
    }

    const { data } = client.storage
      .from('tenant-logos')
      .getPublicUrl(path);

    return data?.publicUrl || null;
  } catch (err) {
    console.error('[imageStorage] uploadTenantLogo exception:', err);
    return null;
  }
}

/**
 * Upload a product image from a base64 data URL (already processed by canvas).
 * Used when the image was processed client-side (background removal, resize etc.)
 * and we have the result as base64, not as a raw File object.
 */
export async function uploadProductImageFromBase64(
  base64DataUrl: string,
  tenantId: string,
  productId: string
): Promise<string | null> {
  if (!base64DataUrl || !base64DataUrl.startsWith('data:image')) return null;
  try {
    // Convert base64 to Blob
    const [header, data] = base64DataUrl.split(',');
    const mimeMatch = header.match(/data:(image\/\w+);base64/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType });

    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const path = `${tenantId}/${productId}.${ext}`;

    const client: any = await getSecureDataBridgeClient();
    const { error } = await client.storage
      .from('product-images')
      .upload(path, blob, { contentType: mimeType, upsert: true });

    if (error) {
      console.error('[imageStorage] uploadProductImageFromBase64 failed:', error.message);
      return null;
    }

    const { data: urlData } = client.storage.from('product-images').getPublicUrl(path);
    return urlData?.publicUrl || null;
  } catch (err) {
    console.error('[imageStorage] uploadProductImageFromBase64 exception:', err);
    return null;
  }
}


/**
 * Delete a product image from Supabase Storage.
 * Called when a product is deleted.
 */
export async function deleteProductImage(
  tenantId: string,
  productId: string
): Promise<void> {
  try {
    const client: any = await getSecureDataBridgeClient();
    await client.storage
      .from('product-images')
      .remove([`${tenantId}/${productId}.jpg`]);
  } catch (err) {
    // Non-critical — orphaned files in storage are acceptable
    console.warn('[imageStorage] deleteProductImage failed (non-critical):', err);
  }
}

/**
 * Check if a string is a Supabase Storage URL (not base64).
 * Used to determine if migration/re-upload is needed.
 */
export function isStorageUrl(value: string | undefined | null): boolean {
  if (!value) return false;
  return value.startsWith('http') && value.includes('supabase');
}

/**
 * Check if a string is a legacy base64 image.
 */
export function isBase64Image(value: string | undefined | null): boolean {
  if (!value) return false;
  return value.startsWith('data:image');
}
