import { useEffect, useMemo, useRef, useState } from 'react';
import { getSecureDataBridgeClient } from '../../../shared/dataBridge/secureDataBridge';

export interface DeliveryTreasuryEntry {
  id: string;
  journalId: string;
  deliveryOrExpenseId: string;
  kind: 'delivery' | 'delivery_expense';
  accountId: string;
  accountName: string;
  branchId: string;
  currency: string;
  amount: number;
  postedAt: string;
  description: string;
  journalType: string;
}

export interface DeliveryTreasuryReport {
  operations: {
    orders: number;
    quotedFees: number;
    pendingDispatch: number;
    dispatched: number;
    delivered: number;
    uncollectedFees: number;
    uncollectedCount: number;
  };
  treasury: {
    collections: number;
    refunds: number;
    collectedNet: number;
    expensesPaid: number;
    expensesReversed: number;
    netCashFlow: number;
    collectionEntries: number;
  };
  accounts: Array<{
    accountId: string;
    accountName: string;
    currency: string;
    collections: number;
    refunds: number;
    expenses: number;
    net: number;
  }>;
  entries: DeliveryTreasuryEntry[];
  hasMore: boolean;
  nextCursor: { postedAt: string; lineId: string } | null;
}

// The delivery report reads the existing treasury ledger on demand. It never
// creates a second income ledger, polls the backend or downloads all history.
export function useDeliveryTreasuryReport(input: {
  tenantId: string;
  branchId: string | null;
  tab: string;
  startDate: string;
  endDate: string;
}) {
  const [report, setReport] = useState<DeliveryTreasuryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestRef = useRef('');
  const pagingRef = useRef(false);

  const args = useMemo(() => ({
    p_from: new Date(input.startDate + 'T00:00:00.000').toISOString(),
    p_to: new Date(input.endDate + 'T23:59:59.999').toISOString(),
    p_branch_id: input.branchId,
    p_limit: 50,
  }), [input.startDate, input.endDate, input.branchId]);

  const queryKey = useMemo(() =>
    JSON.stringify([input.tenantId, input.tab, args, refreshKey]),
    [input.tenantId, input.tab, args, refreshKey]);

  useEffect(() => {
    requestRef.current = queryKey;
    if (input.tab !== 'deliveries') return;
    let cancelled = false;
    pagingRef.current = false;
    setMoreLoading(false);
    setReport(null);
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const client: any = await getSecureDataBridgeClient();
        const { data, error: rpcError } = await client.rpc('get_current_tenant_delivery_treasury_report', args);
        if (rpcError) throw rpcError;
        if (!data || !data.operations || !data.treasury ||
            !Array.isArray(data.accounts) || !Array.isArray(data.entries)) {
          throw new Error('Invalid Delivery Treasury report.');
        }
        if (!cancelled && requestRef.current === queryKey) setReport(data as DeliveryTreasuryReport);
      } catch (cause: any) {
        if (!cancelled && requestRef.current === queryKey) {
          setError(cause?.message || 'Delivery Treasury data is unavailable.');
        }
      } finally {
        if (!cancelled && requestRef.current === queryKey) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [input.tab, queryKey, args]);

  const loadMore = async () => {
    if (pagingRef.current || loading || !report?.hasMore || !report.nextCursor) return;
    const requested = queryKey;
    const cursor = report.nextCursor;
    pagingRef.current = true;
    setMoreLoading(true);
    try {
      const client: any = await getSecureDataBridgeClient();
      const { data, error: rpcError } = await client.rpc('get_current_tenant_delivery_treasury_report', {
        ...args,
        p_after_at: cursor.postedAt,
        p_after_line_id: cursor.lineId,
      });
      if (rpcError) throw rpcError;
      if (!data || !Array.isArray(data.entries)) throw new Error('Invalid older delivery treasury page.');
      if (requestRef.current === requested) {
        setReport(current => {
          if (!current) return current;
          const seen = new Set(current.entries.map(entry => entry.id));
          return { ...current,
            entries: [...current.entries, ...data.entries.filter((row: DeliveryTreasuryEntry) => !seen.has(row.id))],
            hasMore: !!data.hasMore,
            nextCursor: data.nextCursor || null,
          };
        });
      }
    } catch (cause: any) {
      if (requestRef.current === requested) setError(cause?.message || 'Could not load older delivery entries.');
    } finally {
      pagingRef.current = false;
      if (requestRef.current === requested) setMoreLoading(false);
    }
  };

  return { report, loading, moreLoading, error,
    loadMore, refresh: () => setRefreshKey(current => current + 1) };
}
