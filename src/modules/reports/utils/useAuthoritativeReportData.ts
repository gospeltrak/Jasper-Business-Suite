import { useEffect, useMemo, useRef, useState } from 'react';
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
  performedByName?: string;
}

export interface TreasuryReportSummary {
  moneyIn: number;
  moneyOut: number;
  count: number;
}

export interface TreasuryReportPage {
  accounts: TreasuryReportAccount[];
  entries: TreasuryReportEntry[];
  summary: TreasuryReportSummary;
  accountBreakdown: Array<{ accountId: string; moneyIn: number; moneyOut: number }>;
  hasMore: boolean;
  nextCursor: { postedAt: string; lineId: string } | null;
}

const REPORT_PAGE_SIZE = 50;

export function useAuthoritativeReportData(input: {
  tenantId: string;
  branchId: string | null;
  accountId: string | null;
  tab: string;
  startDate: string;
  endDate: string;
}) {
  const [treasury, setTreasury] = useState<TreasuryReportPage | null>(null);
  const [treasuryLoading, setTreasuryLoading] = useState(false);
  const [treasuryMoreLoading, setTreasuryMoreLoading] = useState(false);
  const [treasuryError, setTreasuryError] = useState<string | null>(null);
  const [stockRows, setStockRows] = useState<StockAdjustmentReportRow[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const activeQueryRef = useRef('');
  const loadingMoreRef = useRef(false);

  const args = useMemo(() => ({
    p_from: new Date(input.startDate + 'T00:00:00.000').toISOString(),
    p_to: new Date(input.endDate + 'T23:59:59.999').toISOString(),
    p_branch_id: input.branchId,
  }), [input.startDate, input.endDate, input.branchId]);

  const treasuryArgs = useMemo(() => ({
    ...args,
    p_account_id: input.accountId,
    p_limit: REPORT_PAGE_SIZE,
  }), [args, input.accountId]);

  const queryKey = useMemo(() =>
    JSON.stringify([input.tenantId, input.tab, treasuryArgs, refreshIndex]),
  [input.tenantId, input.tab, treasuryArgs, refreshIndex]);

  useEffect(() => {
    activeQueryRef.current = queryKey;
    if (input.tab !== 'money-bank') return;
    let cancelled = false;
    loadingMoreRef.current = false;
    setTreasury(null);
    setTreasuryLoading(true);
    setTreasuryError(null);
    void (async () => {
      try {
        const client: any = await getSecureDataBridgeClient();
        const { data, error } = await client.rpc('get_current_tenant_treasury_report_page', treasuryArgs);
        if (error) throw error;
        if (!data || !Array.isArray(data.accounts) || !Array.isArray(data.entries)
          || !data.summary || !Array.isArray(data.accountBreakdown)) {
          throw new Error('Invalid paginated treasury report response.');
        }
        if (!cancelled && activeQueryRef.current === queryKey) setTreasury(data);
      } catch (error: any) {
        if (!cancelled && activeQueryRef.current === queryKey) {
          setTreasuryError(error?.message || 'Money & Bank data could not be loaded.');
        }
      } finally {
        if (!cancelled && activeQueryRef.current === queryKey) setTreasuryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [input.tab, treasuryArgs, queryKey]);

  const loadMoreTreasury = async () => {
    if (loadingMoreRef.current || treasuryLoading || !treasury?.hasMore || !treasury.nextCursor) return;
    const requestedKey = queryKey;
    const cursor = treasury.nextCursor;
    loadingMoreRef.current = true;
    setTreasuryMoreLoading(true);
    try {
      const client: any = await getSecureDataBridgeClient();
      const { data, error } = await client.rpc('get_current_tenant_treasury_report_page', {
        ...treasuryArgs,
        p_after_at: cursor.postedAt,
        p_after_line_id: cursor.lineId,
      });
      if (error) throw error;
      if (!data || !Array.isArray(data.entries) || !data.summary) throw new Error('Invalid treasury page response.');
      if (activeQueryRef.current !== requestedKey) return;
      setTreasury(previous => {
        if (!previous) return previous;
        const seen = new Set(previous.entries.map(e => e.id));
        const newEntries = data.entries.filter((row: TreasuryReportEntry) => !seen.has(row.id));
        return { ...previous, entries: [...previous.entries, ...newEntries],
          hasMore: !!data.hasMore, nextCursor: data.nextCursor || null };
      });
    } catch (error: any) {
      if (activeQueryRef.current === requestedKey) setTreasuryError(error?.message || 'Could not load older entries.');
    } finally {
      loadingMoreRef.current = false;
      if (activeQueryRef.current === requestedKey) setTreasuryMoreLoading(false);
    }
  };

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
        if (!Array.isArray(data)) throw new Error('Invalid stock adjustment response.');
        if (!cancelled) setStockRows(data);
      } catch (error: any) {
        if (!cancelled) setStockError(error?.message || 'Stock Adjustment data could not be loaded.');
      } finally {
        if (!cancelled) setStockLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [input.tenantId, input.tab, args]);

  return { treasury, treasuryLoading, treasuryMoreLoading, treasuryError,
    loadMoreTreasury, refreshTreasury: () => setRefreshIndex(n => n + 1),
    stockRows, stockLoading, stockError };
}
