import { describe, expect, it } from 'vitest';
import { isLazyChunkLoadError } from './lazyWithReload';

describe('lazy screen deployment recovery', () => {
  it.each([
    new TypeError('Failed to fetch dynamically imported module: /assets/DashboardCashBank-old.js'),
    new Error('ChunkLoadError: Loading chunk 42 failed'),
    new Error('Importing a module script failed'),
    new Error('Failed to load module script'),
  ])('recognizes a recoverable stale chunk error', error => {
    expect(isLazyChunkLoadError(error)).toBe(true);
  });

  it('does not classify an ordinary screen data error as a stale chunk', () => {
    expect(isLazyChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });
});
