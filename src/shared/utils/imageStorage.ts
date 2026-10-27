/**
 * imageStorage.ts
 *
 * Handles all image uploads for Orvix Business Suite.
 *
 * Strategy:
 *   1. Compress in the browser with adaptive dimensions/quality and byte caps
 *   2. Upload the compressed file to Supabase Storage
 *   3. Return the permanent public URL — this URL is what gets saved in
 *      the database and onlineStorage, never the raw base64 data
 *
 * Buckets:
 *   - product-images  → /{tenantId}/{productId}.jpg
 *   - tenant-logos    → /{uploaderId}/{tenantId}/logo-{variant}-{uuid}.{webp|jpg|svg}
 *
 * Why this approach:
 *   - Logos hard-capped at 10 KB; products target 10 KB, capped at 25 KB
 *   - Byte budget is enforced before Storage upload, not just assumed by quality
 *   - onlineStorage only stores a ~100-byte URL, never image data
 *   - Images never disappear because they are not subject to onlineStorage
 *     quota limits
 */

import { getSecureDataBridgeClient } from '../dataBridge/secureDataBridge';
import {
  compressImageToBudget,
  imageFileExtension,
  LOGO_MAX_BYTES,
  PRODUCT_MAX_BYTES,
  PRODUCT_TARGET_BYTES,
  type ImageBudget,
} from './imageUploadBudget';

// ─── Compression ─────────────────────────────────────────────────────────────

/**
 * Backwards-compatible JPEG image compressor. Product photos target 10 KB
 * with a 25 KB maximum. Branch logos pass a stricter 10 KB budget.
 */
export async function compressImage(
  file: File,
  budget: ImageBudget = {
    targetBytes: PRODUCT_TARGET_BYTES,
    maxBytes: PRODUCT_MAX_BYTES,
    maxDimension: 400,
    preferredMime: 'image/jpeg',
  },
): Promise<Blob> {
  return compressImageToBudget(file, budget);
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
 * Path: tenant-logos/{uploaderId}/{tenantId}/logo-{variant}-{uuid}.{webp|jpg|svg}
 * Returns the permanent public URL, or null on failure.
 */
export async function uploadTenantLogo(
  file: File,
  tenantId: string,
  variant: 'light' | 'dark' | 'brand' | null = null
): Promise<string | null> {
  try {
    const client: any = await getSecureDataBridgeClient();
    // Storage RLS for tenant-logos permits writes only under auth.uid()/.
    // Nest tenant IDs below that folder; do not broaden Storage permissions.
    const { data: authData, error: authError } = await client.auth.getUser();
    const uploaderId = authData?.user?.id;
    if (authError || !uploaderId) {
      console.error('[imageStorage] uploadTenantLogo requires an authenticated uploader');
      return null;
    }

    // Logos get slightly more generous compression (still 400×400 max)
    // but we accept SVG as-is since we can't canvas-compress vector graphics
    let uploadBlob: Blob;
    let contentType: string;

    if (file.type === 'image/svg+xml') {
      if (!Number.isFinite(file.size) || file.size > LOGO_MAX_BYTES) {
        throw new Error('SVG logos must be 10 KB or smaller');
      }
      uploadBlob = file;
      contentType = 'image/svg+xml';
    } else {
      uploadBlob = await compressImageToBudget(file, {
        targetBytes: LOGO_MAX_BYTES,
        maxBytes: LOGO_MAX_BYTES,
        maxDimension: 400,
        preferredMime: 'image/webp',
      });
      contentType = uploadBlob.type;
    }

    const ext = file.type === 'image/svg+xml' ? 'svg' : imageFileExtension(uploadBlob);
    // Keep light and dark logos in separate objects, without overwriting old logos.
    const path = `${uploaderId}/${tenantId}/${variant ? `logo-${variant}` : 'logo'}-${crypto.randomUUID()}.${ext}`;

    const { error } = await client.storage
      .from('tenant-logos')
      .upload(path, uploadBlob, {
        contentType,
        upsert: false, // new immutable object needs INSERT only; Storage has no SELECT policy
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
 * Store product-brand logos as immutable Storage assets, never data URLs.
 * Names share the same RLS-safe user/tenant namespace as business branding,
 * but get a distinct prefix and a fresh object key on every upload.
 */
export function uploadTenantBrandLogo(file: File, tenantId: string): Promise<string | null> {
  return uploadTenantLogo(file, tenantId, 'brand');
}

/**
 * Upload a real branch's own logo to Supabase Storage.
 * Path: tenant-logos/{tenantId}/branches/{branchId}/logo-{variant}.jpg
 * Branch- and variant-scoped (unlike uploadTenantLogo's single fixed path)
 * so multiple branches, and a branch's light/dark variants, never collide.
 * Returns the permanent public URL, or null on failure.
 */
export async function uploadBranchLogo(
  file: File,
  tenantId: string,
  branchId: string,
  variant: 'light' | 'dark'
): Promise<string | null> {
  try {
    const client: any = await getSecureDataBridgeClient();

    let uploadBlob: Blob;
    let contentType: string;
    if (file.type === 'image/svg+xml') {
      if (!Number.isFinite(file.size) || file.size > LOGO_MAX_BYTES) {
        throw new Error('SVG logos must be 10 KB or smaller');
      }
      uploadBlob = file;
      contentType = 'image/svg+xml';
    } else {
      uploadBlob = await compressImageToBudget(file, {
        targetBytes: LOGO_MAX_BYTES,
        maxBytes: LOGO_MAX_BYTES,
        maxDimension: 400,
        preferredMime: 'image/webp',
      });
      contentType = uploadBlob.type;
    }

    const ext = file.type === 'image/svg+xml' ? 'svg' : imageFileExtension(uploadBlob);
    const path = `${tenantId}/branches/${branchId}/logo-${variant}.${ext}`;

    const { error } = await client.storage
      .from('tenant-logos')
      .upload(path, uploadBlob, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error('[imageStorage] uploadBranchLogo failed:', error.message);
      return null;
    }

    const { data } = client.storage
      .from('tenant-logos')
      .getPublicUrl(path);

    return data?.publicUrl || null;
  } catch (err) {
    console.error('[imageStorage] uploadBranchLogo exception:', err);
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

    const optimized = await compressImage(blob as File);
    const path = `${tenantId}/${productId}.jpg`;

    const client: any = await getSecureDataBridgeClient();
    const { error } = await client.storage
      .from('product-images')
      .upload(path, optimized, { contentType: optimized.type, upsert: true });

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
