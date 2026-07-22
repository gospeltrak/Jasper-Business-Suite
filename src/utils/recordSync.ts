const RECORD_TIME_KEYS = [
  'syncUpdatedAt',
  'updatedAt',
  'updated_at',
  'modifiedAt',
  'lastModifiedAt',
  'timestamp',
  'date',
  'createdAt',
  'created_at',
  'dispatchedAt',
  'deliveredAt',
];

// IMPORTANT: this must never contain a data key that supports
// user-initiated deletion (sales, expenses, deliveries, purchases,
// pendingDeliveryNotes). mergeRecordsById() below is a pure UNION-by-id
// merge — it can add or replace records but can never remove one that's
// missing from "incoming". A dataKey in this set gets merged against
// whatever is already in the legacy tenant_data table (dbSync.ts
// saveData()), so deleting a sale locally and then saving through this
// path would silently bring it back the next time this ran. That exact
// bug shipped and was fixed in commit 5067650 — sales/expenses/etc. were
// removed from the call sites that used this path, and are intentionally
// excluded here too as a second line of defense. Only keys where "union,
// never delete" is actually correct (org/structure data, not user
// transaction records) belong in this set.
export const APPEND_MERGE_DATA_KEYS = new Set([
  'branches',
  'branches_map',
  'branchStocks',
  'branchStocks_map',
  'branch_stocks_map',
  'branchStaffAssignments',
  'branchStaffAssignments_map',
  'branch_staff_assignments_map',
]);

const parseTime = (value?: string | null): number => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const recordId = (record: any): string => {
  if (!record || typeof record !== 'object') return '';
  return String(
    record.id
    || record.saleId
    || record.productId
    || record.branchId
    || record.staffId
    || record.reference
    || record.receiptNo
    || ''
  );
};

const recordTime = (record: any): number => {
  if (!record || typeof record !== 'object') return 0;
  return RECORD_TIME_KEYS.reduce((latest, key) => Math.max(latest, parseTime(record[key])), 0);
};

export const mergeRecordsById = <T = any>(
  incomingRecords: T[] | null | undefined,
  currentRecords: T[] | null | undefined,
): T[] => {
  const incoming = Array.isArray(incomingRecords) ? incomingRecords : [];
  const current = Array.isArray(currentRecords) ? currentRecords : [];
  const chosen = new Map<string, T>();
  const anonymous: T[] = [];

  const consider = (record: T) => {
    const id = recordId(record);
    if (!id) {
      anonymous.push(record);
      return;
    }
    const existing = chosen.get(id);
    if (!existing) {
      chosen.set(id, record);
      return;
    }
    const nextTime = recordTime(record);
    const existingTime = recordTime(existing);
    if (nextTime >= existingTime) chosen.set(id, record);
  };

  current.forEach(consider);
  incoming.forEach(consider);

  const ordered: T[] = [];
  const used = new Set<string>();
  for (const record of incoming) {
    const id = recordId(record);
    if (id && chosen.has(id) && !used.has(id)) {
      ordered.push(chosen.get(id)!);
      used.add(id);
    }
  }
  for (const record of current) {
    const id = recordId(record);
    if (id && chosen.has(id) && !used.has(id)) {
      ordered.push(chosen.get(id)!);
      used.add(id);
    }
  }
  return [...ordered, ...anonymous];
};
