import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { PaymentChannel, Purchase } from '../../types';
import { getMaskedAccountReference } from '../../shared/utils/paymentAccounts';

export type AddPurchasePayment = (purchaseId: string, paymentId: string, amount: number, fundingType: 'registered' | 'external', sourceKey?: string) => Promise<Purchase>;

export default function PurchasePaymentModal({ purchase, accounts, currency, onSave, onClose, onComplete }: {
  purchase: Purchase;
  accounts: PaymentChannel[];
  currency: string;
  onSave: AddPurchasePayment;
  onClose: () => void;
  onComplete: (purchase: Purchase) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  // Retain this ID after an ambiguous network failure so Retry cannot debit twice.
  const [paymentId] = useState(() => crypto.randomUUID());
  const [fundingType, setFundingType] = useState<'registered' | 'external'>('registered');
  const [sourceKey, setSourceKey] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const due = Math.max(0, purchase.totalAmount - purchase.amountPaid);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > due || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) {
      setError('Enter an amount greater than zero, up to the outstanding balance, with at most two decimals.');
      return;
    }
    if (fundingType === 'registered' && !sourceKey) {
      setError('Select the treasury account to pay from.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const saved = await onSave(purchase.id, paymentId, value, fundingType, fundingType === 'registered' ? sourceKey : undefined);
      onComplete(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Payment was not confirmed. Refresh purchase history before trying another payment.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialog} aria-labelledby="purchase-payment-title"
      onCancel={event => { event.preventDefault(); if (!inFlight.current) onClose(); }}
      className="fixed inset-0 m-auto w-[calc(100%_-_24px)] max-w-md max-h-[calc(100dvh-24px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl backdrop:bg-slate-950/70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="purchase-payment-title" className="text-lg font-bold">Add Payment</h2>
            <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">{purchase.supplierName} · {purchase.id}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close payment" className="rounded-lg px-2 py-1 text-sm disabled:opacity-50">✕</button>
        </div>
        <p className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">Outstanding <strong className="float-right">{currency}{due.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></p>
        <div>
          <label htmlFor="purchase-payment-funding" className="mb-1 block text-xs font-semibold">Paid from</label>
          <select id="purchase-payment-funding" value={fundingType} disabled={busy} onChange={event => setFundingType(event.target.value as 'registered' | 'external')}
            className="w-full rounded-xl border border-slate-200 bg-transparent p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="registered">Treasury account</option>
            <option value="external">External account</option>
          </select>
        </div>
        {fundingType === 'registered' ? <div>
          <label htmlFor="purchase-payment-account" className="mb-1 block text-xs font-semibold">Treasury account</label>
          <select id="purchase-payment-account" required value={sourceKey} disabled={busy} onChange={event => setSourceKey(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-transparent p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">Select account</option>
            {accounts.map(account => <option key={account.id} value={account.id}>{account.name} {getMaskedAccountReference(account)}</option>)}
          </select>
          {accounts.length === 0 && <p className="mt-1 text-xs text-amber-600">No active treasury accounts in this branch.</p>}
        </div> : <p className="text-xs text-slate-500 dark:text-slate-400">This payment reduces the supplier balance without debiting treasury.</p>}
        <div>
          <label htmlFor="purchase-payment-amount" className="mb-1 block text-xs font-semibold">Amount ({currency})</label>
          <input id="purchase-payment-amount" autoFocus required type="number" inputMode="decimal" min="0.01" max={due} step="0.01" value={amount} disabled={busy} onChange={event => setAmount(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-transparent p-3 font-semibold dark:border-slate-700" />
        </div>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
        <button type="submit" disabled={busy || due <= 0} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Saving payment…' : 'Save Payment'}</button>
      </form>
    </dialog>
  );
}
