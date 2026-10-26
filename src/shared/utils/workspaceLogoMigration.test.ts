import { describe, expect, it } from 'vitest';
import {
  collectInlineLogoCandidates,
  immutableLogoStoragePath,
  readInlineImage,
  replaceInlineLogos,
} from '../../../scripts/lib/workspace-logo-migration.mjs';

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  Buffer.from('safe-tenant-logo-bytes'),
]);
const inline = `data:image/png;base64,${png.toString('base64')}`;
const tenantId = '64ba3572-b61f-4142-826c-e6fa48eab169';

describe('non-destructive inline logo migration', () => {
  const payload = {
    settings: {
      business: {
        businessLogo: inline,
        businessLogoLight: inline,
        businessLogoDark: 'https://example.org/old-dark.png',
        branchBranding: {
          Shop: { businessLogoLight: inline, businessLogoDark: 'https://example.org/shop-dark.png' },
        },
        businessName: 'Unchanged business',
      },
      company: { logo: inline, tin: 'unchanged' },
    },
    products: [],
    saleTombstones: { record: 'never-touch' },
  };

  it('collects only inline logos, including legacy branch branding, without mutating input', () => {
    const before = structuredClone(payload);
    const candidates = collectInlineLogoCandidates(payload);
    expect(candidates).toHaveLength(4);
    expect(new Set(candidates.map((c: any) => c.image.hash)).size).toBe(1);
    expect(payload).toEqual(before);
    const url = 'https://example.supabase.co/storage/v1/object/public/tenant-logos/migrated/hash.png';
    const result = replaceInlineLogos(payload, candidates, new Map([[candidates[0].image.hash, url]]));
    expect(result.settings.business.businessLogo).toBe(url);
    expect(result.settings.business.businessLogoLight).toBe(url);
    expect(result.settings.business.businessLogoDark).toBe(payload.settings.business.businessLogoDark);
    expect(result.settings.business.branchBranding.Shop.businessLogoLight).toBe(url);
    expect(result.settings.company.logo).toBe(url);
    expect(result.settings.company.tin).toBe('unchanged');
    expect(result.settings.business.businessName).toBe('Unchanged business');
    expect(result.saleTombstones).toEqual(payload.saleTombstones);
    expect(payload).toEqual(before);
    expect(collectInlineLogoCandidates(result)).toHaveLength(0);
  });

  it('uses an immutable, tenant-scoped content-addressed Storage path', () => {
    const image = readInlineImage(inline)!;
    expect(immutableLogoStoragePath(tenantId, image)).toMatch(
      new RegExp(`^migrated/${tenantId}/[a-f0-9]{64}\\.png$`),
    );
    expect(() => immutableLogoStoragePath('../other-tenant', image)).toThrow();
  });

  it('rejects corrupt and unsupported images before any field can be replaced', () => {
    expect(() => readInlineImage('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toThrow();
    expect(() => readInlineImage('data:image/png;base64,%%%%')).toThrow();
    expect(() => readInlineImage('data:image/png;base64,YWJj')).toThrow();
  });

  it('requires URL verification before replacing a single key', () => {
    const candidates = collectInlineLogoCandidates(payload);
    expect(() => replaceInlineLogos(payload, candidates, new Map())).toThrow();
    expect(() => replaceInlineLogos(payload, candidates, new Map([[candidates[0].image.hash,'data:image/png;base64,AA==']]))).toThrow();
  });
});
