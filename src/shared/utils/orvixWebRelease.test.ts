import { describe, expect, it } from 'vitest';
import { isNewOrvixWebRelease, isValidOrvixWebRelease } from './orvixWebRelease';

const current = '0123456789abcdef';
const next = 'fedcba9876543210';
const manifest = { schemaVersion: 1, webVersion: next, updateStrategy: 'next-launch' };

describe('safe Orvix web release updates', () => {
  it('recognizes a real release without attempting to reinstall the APK', () => {
    expect(isValidOrvixWebRelease(manifest)).toBe(true);
    expect(isNewOrvixWebRelease(current, manifest)).toBe(true);
    expect(isNewOrvixWebRelease(next, manifest)).toBe(false);
  });

  it('rejects invalid, unversioned, and executable release data', () => {
    expect(isValidOrvixWebRelease(null)).toBe(false);
    expect(isValidOrvixWebRelease({ ...manifest, schemaVersion: 2 })).toBe(false);
    expect(isValidOrvixWebRelease({ ...manifest, updateStrategy: 'force-reload' })).toBe(false);
    expect(isValidOrvixWebRelease({ ...manifest, webVersion: '<script>alert(1)</script>' })).toBe(false);
    expect(isNewOrvixWebRelease('__ORVIX_BUILD_VERSION__', manifest)).toBe(false);
    expect(isNewOrvixWebRelease('', manifest)).toBe(false);
  });

  it('accepts fallback build identities when Git SHA is unavailable', () => {
    const fallback = { ...manifest, webVersion: 'build-mhjrxvni' };
    expect(isValidOrvixWebRelease(fallback)).toBe(true);
    expect(isNewOrvixWebRelease('build-mhjrxaaa', fallback)).toBe(true);
  });
});
