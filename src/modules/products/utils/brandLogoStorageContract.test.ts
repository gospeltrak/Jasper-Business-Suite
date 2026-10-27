import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('brand logo settings do not accumulate base64', () => {
  const source = readFileSync(resolve('src/modules/products/DashboardProducts.tsx'), 'utf8');
  const start = source.indexOf('const handleBrandLogoUpload = async');
  const end = source.indexOf('  // Search filter', start);

  it('uploads new brand images to private-user scoped Storage before saving a brand', () => {
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const handler = source.slice(start, end);
    expect(handler).toContain('uploadTenantBrandLogo(file, activeTenant.id)');
    expect(handler).toContain('setNewBrandLogo(storageUrl)');
    expect(handler).not.toContain('setNewBrandLogo(compressed)');
    expect(handler).not.toContain('readAsDataURL');
  });

  it('blocks saving the brand while Storage upload is pending', () => {
    expect(source).toContain('disabled={isUploadingBrandLogo}');
    expect(source).toContain('if (isUploadingBrandLogo) return');
  });
});
