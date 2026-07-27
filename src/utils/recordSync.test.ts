import { describe, it, expect } from 'vitest';
import { mergeRecordsById, APPEND_MERGE_DATA_KEYS } from './recordSync';

// These are regression tests for the exact bug reported this session:
// deleting a sale/expense would silently reappear a while after deletion.
// mergeRecordsById is a UNION-by-id merge (it can only add/replace records,
// never remove one) — that is correct and desirable for the legacy
// tenant_data table keys it's still used for (branches/branchStocks/
// branchStaffAssignments), but it must NEVER be used for keys that support
// user-initiated deletion (sales/expenses/etc.), because a union merge can
// never honor a deletion. This suite locks in both facts so a future change
// can't quietly reintroduce the resurrection bug.

describe('mergeRecordsById', () => {
  it('keeps a record that only exists on one side (basic union)', () => {
    const result = mergeRecordsById(
      [{ id: 'a', name: 'A' }],
      [{ id: 'b', name: 'B' }],
    );
    const ids = result.map((r: any) => r.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('never drops a record that is missing from "incoming" — this is why it must not be used for deletable data', () => {
    // Simulates: user deleted record "old" locally (incoming no longer has
    // it), but "current"/remote still has it. A union merge always brings
    // it back — this is the exact mechanism that resurrected deleted sales.
    const incoming = [{ id: 'new', amount: 100 }];
    const current = [{ id: 'old', amount: 50 }, { id: 'new', amount: 100 }];
    const result = mergeRecordsById(incoming, current);
    const ids = result.map((r: any) => r.id).sort();
    expect(ids).toContain('old');
    expect(ids).toEqual(['new', 'old']);
  });

  it('picks the record with the newer timestamp when both sides have the same id', () => {
    const incoming = [{ id: 'x', amount: 10, updatedAt: '2026-01-01T00:00:00Z' }];
    const current = [{ id: 'x', amount: 999, updatedAt: '2026-06-01T00:00:00Z' }];
    const result = mergeRecordsById(incoming, current);
    expect(result.find((r: any) => r.id === 'x')?.amount).toBe(999);
  });

  it('keeps anonymous (no-id) records from both sides without deduplication', () => {
    const result = mergeRecordsById(
      [{ note: 'no id here' }],
      [{ note: 'also no id' }],
    );
    expect(result.length).toBe(2);
  });

  it('APPEND_MERGE_DATA_KEYS must NOT contain deletable business-record keys', () => {
    // sales/expenses/deliveries/purchases/pendingDeliveryNotes all support
    // user-initiated deletion (delete a sale, delete an expense, etc.).
    // If any of these ever end up back in this set, the legacy tenant_data
    // union-merge path (dbSync.ts saveData) will resurrect deletions again,
    // exactly like the bug fixed in commit 5067650.
    const deletableKeys = [
      'sales', 'sales_map',
      'expenses', 'expenses_map',
      'deliveries', 'deliveries_map',
      'purchases', 'purchases_map',
      'pendingDeliveryNotes', 'pendingDeliveryNotes_map', 'pending_delivery_notes_map',
    ];
    for (const key of deletableKeys) {
      expect(APPEND_MERGE_DATA_KEYS.has(key)).toBe(false);
    }
  });
});
