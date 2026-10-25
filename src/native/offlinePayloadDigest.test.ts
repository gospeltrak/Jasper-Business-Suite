import { describe, expect, it } from 'vitest';
import { canonicalOfflinePayload, offlinePayloadDigest } from './offlinePayloadDigest';

describe('Canonical transaction digests', () => {
  it('normalizes object property order before SHA-256 hashing', async () => {
    const a = { sale: { id:'uuid-1', total:100, currency:'TZS' }, items:[{id:'p1', qty:0.25}] };
    const b = { items:[{qty:0.25,id:'p1'}], sale:{currency:'TZS',total:100,id:'uuid-1'} };
    expect(canonicalOfflinePayload(a)).toEqual(canonicalOfflinePayload(b));
    expect(await offlinePayloadDigest(a)).toEqual(await offlinePayloadDigest(b));
  });
  it('changes the digest when amount, tenant or branch changes', async () => {
    const original={tenantId:'lim',branchId:'a',amount:2500};
    const hash=await offlinePayloadDigest(original);
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(await offlinePayloadDigest({...original,amount:2501})).not.toEqual(hash);
    expect(await offlinePayloadDigest({...original,branchId:'b'})).not.toEqual(hash);
    expect(await offlinePayloadDigest({...original,tenantId:'other'})).not.toEqual(hash);
  });
  it('does not let undefined fields or arrays silently create two different digests', () => {
    expect(canonicalOfflinePayload({b:undefined,a:1})).toEqual('{"a":1}');
    expect(canonicalOfflinePayload([1,undefined,2])).toEqual('[1,null,2]');
  });
  it('rejects NaN, infinity, bigint and circular transaction objects', () => {
    for (const invalid of [NaN, Infinity, -Infinity]) {
      expect(() => canonicalOfflinePayload({total:invalid})).toThrow(/non-finite/);
    }
    expect(() => canonicalOfflinePayload({balance:4n})).toThrow(/unsupported/);
    const cycle: any={id:'uuid-2'};cycle.self=cycle;
    expect(() => canonicalOfflinePayload(cycle)).toThrow(/Circular/);
  });
  it('preserves arrays order so swapped items are detected', () => {
    expect(canonicalOfflinePayload([{id:'p1'},{id:'p2'}]))
      .not.toEqual(canonicalOfflinePayload([{id:'p2'},{id:'p1'}]));
  });
  it('normalizes valid ISO dates and refuses invalid ones', () => {
    expect(canonicalOfflinePayload({when:new Date('2026-10-25T12:00:00Z')}))
      .toEqual('{"when":"2026-10-25T12:00:00.000Z"}');
    expect(() => canonicalOfflinePayload({when:new Date('invalid')})).toThrow(/Invalid date/);
  });
});
