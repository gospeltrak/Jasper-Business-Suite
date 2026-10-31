import { useEffect, useMemo, useState } from 'react';
import { getSecureDataBridgeClient } from '../../../shared/dataBridge/secureDataBridge';

export interface TreasuryReportAccount {
  accountId: string;
  branchId: string;
  sourceKey: string | null;
  name: string;
  accountType: string;
  provider: string | null;
  maskedReference: string | null;
  currency: string;
  status: string;
  currentBalance: number | null;
}

export interface TreasuryReportEntry {
  id: string;
  journalId: string;
  accountId: string;
  branchId: string;
  amount: number;
  balanceAfter: number;
  currency: string;
  description: string;
  sourceType: string;
  referenceId: string | null;
  journalType: string;
  postedAt: string;
  externalCashFlow: boolean;
}

export interface StockAdjustmentReportRow {
  id: string;
  branchId?: string;
  productId: string;
  productName: string;
  sku?: string;
  type: 'add' | 'deduct';
  qty: number;
  previousStock: number;
  newStock: number;
  reason: string;
  adjustedAt: string;
  performedBy?: string;
}

export function useAuthoritativeReportData(input: {
  tenantId: string;
  branchId: string | null;
  tab: string;
  startDate: string;
  endDate: string;
}) {
  const [treasury, setTreasury] = useState<{ accounts: TreasuryReportAccount[]; entries: TreasuryReportEntry[] } | null>(null);
  const [treasuryLoading, setTreasuryLoading] = useState(false);
  const [treasuryError, setTreasuryError] = useState<string | null>(null);
  const [stockRows, setStockRows] = useState<StockAdjustmentReportRow[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const args = useMemo(() => ({
    p_from: new Date(input.startDate + 'T00:00:00.000').toISOString(),
    p_to: new Date(input.endDate + 'T23:59:59.999').toISOString(),
    p_branch_id: input.branchId,
  }), [input.startDate, input.endDate, input.branchId]);

  useEffect(() => {
    if (input.tab !== 'money-bank') return;
    let cancelled = false;
    setTreasury(null);
    setTreasuryError(null);
    setTreasuryLoading(true);
    void (async () => {
      try {
        const client: any = await getSecureDataBridgeClient();
        const { data, error } = await client.rpc('get_current_tenant_treasury_report', args);
        if (error) throw error;
        if (!data || !Array.isArray(data.accounts) || !Array.isArray(data.entries)) {
          throw new Error('Invalid response from Money & Bank report.');
        }
        if (!cancelled) setTreasury(data);
      } catch (error: any) {
        if (!cancelled) setTreasuryError(error?.message || 'Money & Bank data could not be loaded.');
      } finally {
        if (!cancelled) setTreasuryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [input.tenantId, input.tab, args]);

  useEffect(() => {
    if (input.tab !== 'stock-adjustment') return;
    let cancelled = false;
    setStockRows([]);
    setStockError(null);
    setStockLoading(true);
    void (async () => {
      try {
        const client: any = await getSecureDataBridgeClient();
        const { data, error } = await client.rpc('get_current_tenant_stock_adjustments', args);
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('Invalid response from Stock Adjustment report.');
        if (!cancelled) setStockRows(data);
      } catch (error: any) {
        if (!cancelled) setStockError(error?.message || 'Stock Adjustment data could not be loaded.');
      } finally {
        if (!cancelled) setStockLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [input.tenantId, input.tab, args]);

  return { treasury, treasuryLoading, treasuryError, stockRows, stockLoading, stockError };
}
