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

import { uploadTenantLogo } from './imageStorage';

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
    expect(storage.upload).toHaveBeenNthCalledWith(1, 'user-one/tenant-A/logo-light.svg', svg, {
      contentType: 'image/svg+xml',
      upsert: true,
    });
    expect(storage.upload).toHaveBeenNthCalledWith(2, 'user-one/tenant-A/logo-dark.svg', svg, {
      contentType: 'image/svg+xml',
      upsert: true,
    });
    expect(light).toContain('/user-one/tenant-A/logo-light.svg');
    expect(dark).toContain('/user-one/tenant-A/logo-dark.svg');
    expect(light).not.toBe(dark);
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
