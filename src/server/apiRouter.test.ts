import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const server = vi.hoisted(() => ({ createApp: vi.fn(), app: vi.fn() }));
vi.mock('../../server.js', () => ({ createApp: server.createApp }));

describe('single production API entry point', () => {
  beforeEach(() => {
    vi.resetModules();
    server.app.mockReset();
    server.createApp.mockReset().mockResolvedValue(server.app);
  });

  it.each([
    ['auth/config', 'GET'], ['auth/register', 'POST'], ['affiliate/register', 'POST'],
    ['health', 'GET'], ['forecast', 'POST'],
    ['images/migrate-product', 'POST'], ['sales/sync', 'POST'],
    ['tenant/resolve', 'GET'], ['tenant/slug', 'GET'], ['tenant/slug', 'POST'],
    ['tenant/logo-by-domain', 'GET'],
  ])('forwards %s through the shared authenticated app', async (route, method) => {
    const { default: handler } = await import('../../api/router');
    const req = { method, url: '/api/router?path=unused&tenantId=example', query: { path: route }, headers: { authorization: 'Bearer test-session' }, body: { value: 1 } };
    const res = {};
    await handler(req, res);
    expect(req.url).toBe(`/api/${route}?tenantId=example`);
    expect(req.method).toBe(method);
    expect(req.headers.authorization).toBe('Bearer test-session');
    expect(req.body).toEqual({ value: 1 });
    expect(server.app).toHaveBeenCalledWith(req, res);
  });

  it('keeps staff-login query parameters and shares one app initialization', async () => {
    const { default: handler } = await import('../../api/router');
    const first = { url: '/api/router?path=auth%2Fregister&mode=staff-login', query: { path: ['auth', 'register'] } };
    await Promise.all([handler(first, {}), handler({ url: '/api/router?path=health', query: { path: 'health' } }, {})]);
    expect(first.url).toBe('/api/auth/register?mode=staff-login');
    expect(server.createApp).toHaveBeenCalledTimes(1);
    expect(server.createApp).toHaveBeenCalledWith({ serveClient: false });
  });

  it('deploys one API function while retaining public routes and forecasting', () => {
    const apiRoot = new URL('../../api/', import.meta.url);
    const apiFiles = readdirSync(apiRoot, { recursive: true }).filter(name => String(name).endsWith('.ts'));
    expect(apiFiles).toEqual(['router.ts']);
    const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
    expect(config.rewrites[0]).toEqual({ source: '/api/:path*', destination: '/api/router?path=:path*' });
    const source = readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');
    expect(source).toContain("app.post('/api/forecast'");
    expect(source).not.toContain("app.post('/api/lucy'");
    expect(source).not.toContain("app.post('/api/copilot'");
    expect(source).toContain("app.post('/api/auth/staff-login'");
    expect(source).toContain("req.query?.mode === 'staff-login'");
  });
});
