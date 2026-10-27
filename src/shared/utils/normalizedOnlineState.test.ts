import { describe, expect, it } from 'vitest';
import { hydrateTypedOnlineState, makeTypedOnlineStateWrites, type TypedOnlineStateChange } from './normalizedOnlineState';

describe('optional typed application state — lossless Storage semantics', () => {
  it('hydrates nested JSON strings and inline image strings without parsing or losing their bytes', () => {
    const banner = 'data:image/png;base64,AAE=';
    const settings = '{"business":{"name":"Duka A"},"money":540000}';
    const result = hydrateTypedOnlineState([
      { state_key: 'jasper_banner', state_value: banner, is_deleted: false },
      { state_key: 'jasper_settings', state_value: settings, is_deleted: false },
      { state_key: '', state_value: '', is_deleted: false },
      { state_key: 'deleted_draft', state_value: 'previous draft evidence', is_deleted: true },
    ]);
    expect(Object.fromEntries(result)).toEqual({
      jasper_banner: banner,
      jasper_settings: settings,
      '': '',
    });
    expect(result.has('deleted_draft')).toBe(false);
  });

  it('persists only the edited key rather than an entire tenant JSON snapshot', () => {
    const changes: Array<[string, TypedOnlineStateChange]> = [
      ['jasper_theme', { value: 'emerald', isDeleted: false, revision: 1 }],
    ];
    expect(makeTypedOnlineStateWrites('tenant-1', changes)).toEqual([{
      tenant_id: 'tenant-1',
      state_key: 'jasper_theme',
      state_value: 'emerald',
      is_deleted: false,
    }]);
  });

  it('records logical removal as a tombstone retaining the prior value', () => {
    expect(makeTypedOnlineStateWrites('tenant-1', [
      ['draft', { value: 'prior draft text', isDeleted: true, revision: 3 }],
    ])).toEqual([{
      tenant_id: 'tenant-1', state_key: 'draft',
      state_value: 'prior draft text', is_deleted: true,
    }]);
  });

  it('rejects malformed typed active values and duplicate keys', () => {
    expect(() => hydrateTypedOnlineState([
      { state_key: 'x', state_value: null, is_deleted: false },
    ])).toThrow('cannot be null');
    expect(() => hydrateTypedOnlineState([
      { state_key: 'x', state_value: 'one', is_deleted: false },
      { state_key: 'x', state_value: 'two', is_deleted: false },
    ])).toThrow('Duplicate');
    expect(() => makeTypedOnlineStateWrites('', [])).toThrow('Tenant');
    expect(() => makeTypedOnlineStateWrites('tenant', [
      ['x', { value: null, isDeleted: false, revision: 1 }],
    ])).toThrow('string value');
  });

  it('does not mutate the original values when making a typed write', () => {
    const change: TypedOnlineStateChange = { value: '{"stock":2.5}', isDeleted: false, revision: 13 };
    const before = JSON.stringify(change);
    expect(makeTypedOnlineStateWrites('tenant', [['stock-draft', change]])[0].state_value).toBe('{"stock":2.5}');
    expect(JSON.stringify(change)).toBe(before);
  });
});
