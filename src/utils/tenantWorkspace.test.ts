import { describe, it, expect } from 'vitest';
import { workspaceHasBusinessData } from './tenantWorkspace';

describe('workspaceHasBusinessData', () => {
  it('is false for a workspace with only empty arrays', () => {
    expect(workspaceHasBusinessData({
      products: [], sales: [], expenses: [], deliveries: [],
      pendingDeliveryNotes: [], purchases: [],
      branches: [], branchStocks: [], branchStaffAssignments: [],
      settings: {} as any,
    })).toBe(false);
  });

  it('is false for null/undefined', () => {
    expect(workspaceHasBusinessData(null)).toBe(false);
    expect(workspaceHasBusinessData(undefined)).toBe(false);
  });

  it('is true when any single array has data, even if the rest are empty', () => {
    expect(workspaceHasBusinessData({
      products: [], sales: [{ id: 's1' }], expenses: [], deliveries: [],
      pendingDeliveryNotes: [], purchases: [],
      branches: [], branchStocks: [], branchStaffAssignments: [],
      settings: {} as any,
    })).toBe(true);
  });
});
