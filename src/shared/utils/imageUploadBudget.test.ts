import { describe, expect, it, vi } from 'vitest';
import {
  ImageBudgetError,
  LOGO_MAX_BYTES,
  PRODUCT_MAX_BYTES,
  PRODUCT_TARGET_BYTES,
  imageFileExtension,
  selectBudgetedImage,
} from './imageUploadBudget';

const makeBlob = (size: number, type = 'image/webp') => new Blob([new Uint8Array(size)], { type });

describe('tenant image size budgets', () => {
  it('keeps logo byte sizes at or below 10 KiB', async () => {
    const encode = vi.fn(async (dimension: number, quality: number) =>
      makeBlob(dimension === 400 && quality >= 0.7 ? 16000 : 9000));
    const result = await selectBudgetedImage(encode, {
      targetBytes: LOGO_MAX_BYTES,
      maxBytes: LOGO_MAX_BYTES,
      maxDimension: 400,
    });
    expect(result.size).toBeLessThanOrEqual(LOGO_MAX_BYTES);
  });

  it('rejects incompressible logos rather than uploading a larger asset', async () => {
    await expect(selectBudgetedImage(
      async () => makeBlob(LOGO_MAX_BYTES + 1),
      { targetBytes: LOGO_MAX_BYTES, maxBytes: LOGO_MAX_BYTES },
    )).rejects.toBeInstanceOf(ImageBudgetError);
  });

  it('prefers a 10 KiB product when one can be produced', async () => {
    const result = await selectBudgetedImage(
      async (_, quality) => makeBlob(quality < 0.7 ? 9500 : 15000),
      { targetBytes: PRODUCT_TARGET_BYTES, maxBytes: PRODUCT_MAX_BYTES },
    );
    expect(result.size).toBe(9500);
  });

  it('allows better-detail product fallback only up to 25 KiB', async () => {
    const result = await selectBudgetedImage(
      async () => makeBlob(23000),
      { targetBytes: PRODUCT_TARGET_BYTES, maxBytes: PRODUCT_MAX_BYTES },
    );
    expect(result.size).toBe(23000);
    await expect(selectBudgetedImage(
      async () => makeBlob(26000),
      { targetBytes: PRODUCT_TARGET_BYTES, maxBytes: PRODUCT_MAX_BYTES },
    )).rejects.toBeInstanceOf(ImageBudgetError);
  });

  it('keeps file extensions matched to the actual encoded MIME', () => {
    expect(imageFileExtension(makeBlob(100, 'image/webp'))).toBe('webp');
    expect(imageFileExtension(makeBlob(100, 'image/jpeg'))).toBe('jpg');
    expect(() => imageFileExtension(makeBlob(100, 'image/png'))).toThrow(ImageBudgetError);
  });
});
