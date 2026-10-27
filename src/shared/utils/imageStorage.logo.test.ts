import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  getUser: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
}));

vi.mock('../dataBridge/secureDataBridge', () => ({
  getSecureDataBridgeClient: async () => ({
    auth: { getUser: storage.getUser },
    storage: {
      from: () => ({ upload: storage.upload, getPublicUrl: storage.getPublicUrl }),
    },
  }),
}));

import { uploadTenantLogo, uploadTenantBrandLogo } from './imageStorage';

const svg = { type: 'image/svg+xml' } as File;

describe('tenant logo storage path and failure safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getUser.mockResolvedValue({ data: { user: { id: 'user-one' } }, error: null });
    storage.upload.mockResolvedValue({ error: null });
    storage.getPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/tenant-logos/${path}` },
    }));
  });

  it('uses separate light and dark keys within the uploader-owned RLS folder', async () => {
    const light = await uploadTenantLogo(svg, 'tenant-A', 'light');
    const dark = await uploadTenantLogo(svg, 'tenant-A', 'dark');
    expect(storage.upload).toHaveBeenCalledTimes(2);
    const [lightPath, lightBlob, lightOptions] = storage.upload.mock.calls[0];
    const [darkPath, darkBlob, darkOptions] = storage.upload.mock.calls[1];
    expect(lightPath).toMatch(/^user-one\/tenant-A\/logo-light-[0-9a-f-]{36}\.svg$/);
    expect(darkPath).toMatch(/^user-one\/tenant-A\/logo-dark-[0-9a-f-]{36}\.svg$/);
    expect(lightBlob).toBe(svg);
    expect(darkBlob).toBe(svg);
    expect(lightOptions).toEqual({ contentType: 'image/svg+xml', upsert: false });
    expect(darkOptions).toEqual({ contentType: 'image/svg+xml', upsert: false });
    expect(light).toContain(lightPath);
    expect(dark).toContain(darkPath);
    expect(light).not.toBe(dark);
  });

  it('stores brand marks as immutable tenant-scoped URLs, never JSON base64', async () => {
    const logo = await uploadTenantBrandLogo(svg, 'tenant-A');
    const path = storage.upload.mock.calls[0][0] as string;
    expect(path).toMatch(/^user-one\/tenant-A\/logo-brand-[0-9a-f-]{36}\.svg$/);
    expect(storage.upload.mock.calls[0][2]).toEqual({ contentType: 'image/svg+xml', upsert: false });
    expect(logo).toContain(path);
    await uploadTenantBrandLogo(svg, 'tenant-A');
    expect(storage.upload.mock.calls[1][0]).not.toBe(path);
  });

  it('gives repeat uploads distinct paths so earlier logo URLs remain valid', async () => {
    await uploadTenantLogo(svg, 'tenant-A', 'light');
    await uploadTenantLogo(svg, 'tenant-A', 'light');
    expect(storage.upload.mock.calls[0][0]).not.toBe(storage.upload.mock.calls[1][0]);
    expect(storage.upload.mock.calls[0][2].upsert).toBe(false);
    expect(storage.upload.mock.calls[1][2].upsert).toBe(false);
  });

  it('does not attempt an upload without an authenticated uploader', async () => {
    storage.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(uploadTenantLogo(svg, 'tenant-A', 'light')).resolves.toBeNull();
      expect(storage.upload).not.toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('returns null when Storage rejects the write rather than returning base64', async () => {
    storage.upload.mockResolvedValue({ error: { message: 'Storage unavailable' } });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(uploadTenantLogo(svg, 'tenant-A', 'light')).resolves.toBeNull();
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
