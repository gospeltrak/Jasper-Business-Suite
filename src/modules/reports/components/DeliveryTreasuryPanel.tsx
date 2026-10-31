import { useDeliveryTreasuryReport } from '../utils/useDeliveryTreasuryReport';

interface Props {
  tenantId: string;
  branchId: string | null;
  startDate: string;
  endDate: string;
  currency: string;
}

// No client-side reaggregation or independent treasury balance. All money
// comes directly from posted delivery/expense journal lines on the server.
export default function DeliveryTreasuryPanel({ tenantId, branchId, startDate, endDate, currency }: Props) {
  const { report, loading, moreLoading, error, loadMore, refresh } = useDeliveryTreasuryReport({
    tenantId, branchId, tab: 'deliveries', startDate, endDate,
  });

  const amount = (number: number | null | undefined) => `${currency}${Math.round(Number(number || 0)).toLocaleString()}`;
  return (
    <section aria-label="Delivery Treasury" className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-black text-sm text-slate-800">Delivery Treasury</h4>
          <p className="text-[11px] text-slate-500">
            Confirmed delivery payments, refunds and delivery expenses, independent from Sales.
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={loading || moreLoading}
          className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50">
          Refresh
        </button>
      </div>
      {loading && <p role="status" className="text-xs text-slate-500">Loading Delivery Treasury…</p>}
      {error && <p role="alert" className="text-xs font-semibold text-rose-700">Delivery Treasury unavailable: {error}</p>}
      {report && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
            {[
              { label: 'Collections', value: report.treasury.collections },
              { label: 'Refunds / Reversals', value: report.treasury.refunds },
              { label: 'Uncollected Fees', value: report.operations.uncollectedFees },
              { label: 'Delivery Expenses Paid', value: report.treasury.expensesPaid - report.treasury.expensesReversed },
            ].map(row => (
              <div key={row.label} className="rounded-xl border border-emerald-100 bg-white p-3 min-w-0">
                <p className="text-[10px] text-slate-500 font-bold">{row.label}</p>
                <p className="text-sm font-black text-slate-800 truncate">{amount(row.value)}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center rounded-xl bg-slate-900 text-white p-3 gap-3 text-xs">
            <span>Delivery Net Cash Flow</span>
            <strong className="font-mono whitespace-nowrap">{amount(report.treasury.netCashFlow)}</strong>
          </div>
          <p className="text-[11px] text-slate-600">
            Delivery orders created in selected period: {Number(report.operations.orders).toLocaleString()}.
            Quoted fees: {amount(report.operations.quotedFees)}.
            Pending dispatch: {Number(report.operations.pendingDispatch).toLocaleString()}.
            Uncollected deliveries: {Number(report.operations.uncollectedCount).toLocaleString()}.
          </p>
          <p className="text-[10px] text-slate-500">
            Order figures use delivery creation dates. Collections, refunds and expenses use posted treasury dates.
            Delivery status and payment status are independent.
          </p>
          <div className="space-y-2">
            <h5 className="font-bold text-xs text-slate-700">Delivery Payment Accounts</h5>
            {report.accounts.map(account => (
              <div key={account.accountId} className="rounded-xl border bg-white border-slate-200 p-3 flex justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <strong className="block text-slate-700 truncate">{account.accountName}</strong>
                  <span className="text-[10px] text-slate-500">
                    In {account.currency} {Number(account.collections).toLocaleString()} ·
                    Refunds {account.currency} {Number(account.refunds).toLocaleString()} ·
                    Expenses {account.currency} {Number(account.expenses).toLocaleString()}
                  </span>
                </div>
                <strong className="font-mono text-slate-900 whitespace-nowrap">{account.currency} {Number(account.net).toLocaleString()}</strong>
              </div>
            ))}
            {report.accounts.length === 0 &&
              <p className="text-xs text-slate-500">No delivery treasury payments recorded for this period.</p>}
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-xs text-slate-700">Delivery Treasury Transactions</h5>
            {report.entries.map(entry => (
              <div key={entry.id} className="rounded-xl border border-slate-200 p-3 bg-white flex justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800">
                    {entry.kind === 'delivery'
                      ? (entry.amount < 0 ? 'Delivery Refund / Reversal' : 'Delivery Collection')
                      : 'Delivery Expense / Reversal'}
                  </p>
                  <p className="text-slate-500 truncate">{entry.deliveryOrExpenseId} · {entry.accountName}</p>
                  <p className="text-[10px] text-slate-400">{new Date(entry.postedAt).toLocaleString()}</p>
                </div>
                <strong className={`font-mono whitespace-nowrap ${Number(entry.amount) < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {Number(entry.amount) > 0 ? '+' : ''}{entry.currency} {Number(entry.amount).toLocaleString()}
                </strong>
              </div>
            ))}
            {report.entries.length === 0 &&
              <p className="text-xs text-slate-500">No posted delivery transactions for this period.</p>}
            {report.hasMore && (
              <div className="flex justify-center pt-2">
                <button type="button" disabled={moreLoading} onClick={() => void loadMore()}
                  className="rounded-xl border border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50">
                  {moreLoading ? 'Loading…' : 'Load 50 older transactions'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
