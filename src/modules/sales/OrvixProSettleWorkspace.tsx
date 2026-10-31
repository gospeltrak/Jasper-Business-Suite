import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Banknote, CheckCircle2, Clock3, FileText, Handshake, LockKeyhole, ShieldAlert, X } from 'lucide-react';
import type { PaymentChannel, SystemSettings } from '../../types';
import { getMaskedAccountReference } from '../../shared/utils/paymentAccounts';

type Action = 'count' | 'transfer' | 'handover' | null;

interface Props {
  currency: string;
  cashierName: string;
  systemSettings?: SystemSettings;
  branchId?: string | null;
}

/**
 * Foundation of the Pro Settle UI. Nothing here is authoritative and no
 * financial record is ever written locally: an approved server-side shift
 * ledger, teller reconciliation and double-entry treasury RPC are required
 * before enabling the final confirmation actions.
 */
export default function OrvixProSettleWorkspace({ currency, cashierName, systemSettings, branchId }: Props) {
  const [action, setAction] = useState<Action>(null);
  const [actualCounted, setActualCounted] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [reference, setReference] = useState('');
  const [receiver, setReceiver] = useState('');
  const [reviewNote, setReviewNote] = useState('');

  // Existing settings are only used for display. Server-side transfer APIs
  // must independently validate the destination and the active branch.
  const accounts = useMemo(
    () => (systemSettings?.paymentChannels || []).filter((channel: PaymentChannel) =>
      channel?.id &&
      channel.status !== 'inactive' &&
      channel.status !== 'archived' &&
      channel.category !== 'person' &&
      (!branchId || !channel.branchId || String(channel.branchId) === branchId)
    ),
    [systemSettings?.paymentChannels, branchId]
  );

  const validAmount = (value: string) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
  const actions: Array<{ key: Exclude<Action, null>; title: string; desc: string; icon: typeof Banknote }> = [
    { key: 'count', title: 'Count & Reconcile', desc: 'Count physical cash manually', icon: Banknote },
    { key: 'transfer', title: 'Transfer Money', desc: 'Use registered Treasury accounts', icon: ArrowLeftRight },
    { key: 'handover', title: 'Handover Shift', desc: 'Cashier to cashier, with audit', icon: Handshake },
  ];

  return (
    <div id="orvix-pro-settle-workspace" className="space-y-4 font-sans">
      <div className="rounded-2xl border border-emerald-100 bg-white dark:bg-slate-900 dark:border-slate-700 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Orvix Pro · Settle</p>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Cashier Shift Control</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Cashier: {cashierName}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 text-amber-800 px-2 py-1 text-[10px] font-bold border border-amber-200">
            <Clock3 size={13} /> Server verification pending
          </span>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          <ShieldAlert className="mt-0.5 shrink-0" size={17} />
          <span>Financial settlement is not yet active. Existing sales and Treasury records are unaffected. No cash balance is treated as verified until the protected shift ledger is connected.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {actions.map(item => {
          const Icon = item.icon;
          return (
            <button key={item.key} type="button" onClick={() => setAction(item.key)}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-left hover:border-emerald-400 transition-colors min-h-[90px]">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><Icon size={17} className="text-emerald-600" />{item.title}</span>
              <span className="mt-2 block text-[11px] text-slate-500 dark:text-slate-400">{item.desc}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <span className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white"><FileText size={16} className="text-emerald-500" /> Shift Records</span>
          <p className="mt-2 text-xs text-slate-500">Verified shift history will appear here from the normalized database, scoped to the selected branch.</p>
          <p className="mt-3 text-[11px] text-slate-400">No verified records loaded.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <span className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white"><CheckCircle2 size={16} className="text-emerald-500" /> Manager Review</span>
          <p className="mt-2 text-xs text-slate-500">Discrepancies, approvals and handover history will be sourced from the secured server, not browser storage.</p>
          <p className="mt-3 text-[11px] text-slate-400">No verified reviews loaded.</p>
        </div>
      </div>

      {action && (
        <div className="fixed inset-0 z-[160] bg-slate-950/60 p-4 flex items-center justify-center" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="pro-settle-dialog-title"
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center gap-3">
              <h3 id="pro-settle-dialog-title" className="text-base font-extrabold text-slate-900 dark:text-white">
                {actions.find(item => item.key === action)?.title}
              </h3>
              <button type="button" aria-label="Close" className="p-2 text-slate-500" onClick={() => setAction(null)}><X size={20} /></button>
            </div>
            {action === 'count' && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300" htmlFor="pro-physical-cash">Actual Cash Counted ({currency})</label>
                <input id="pro-physical-cash" type="number" inputMode="decimal" min="0" step="0.01" value={actualCounted}
                  onChange={event => setActualCounted(event.target.value)}
                  placeholder="Enter cash physically counted — never auto-filled"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                <p className="text-xs text-slate-500">Expected Cash and the discrepancy will be calculated from a verified shift ledger. They cannot be guessed from total daily sales.</p>
              </div>
            )}
            {action === 'transfer' && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300" htmlFor="pro-transfer-destination">Destination from Money & Bank</label>
                <select id="pro-transfer-destination" value={destinationId} onChange={event => setDestinationId(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                  <option value="">Choose registered account</option>
                  {accounts.map(channel => <option key={channel.id} value={channel.id}>{channel.name || channel.paymentMethod || 'Account'} {getMaskedAccountReference(channel)}</option>)}
                </select>
                {!accounts.length && <p className="text-xs text-amber-700">No registered account in the selected branch. Configure one in Money & Bank first.</p>}
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300" htmlFor="pro-transfer-amount">Amount ({currency})</label>
                <input id="pro-transfer-amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={transferAmount} onChange={event => setTransferAmount(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300" htmlFor="pro-transfer-ref">Transfer reference / evidence ID</label>
                <input id="pro-transfer-ref" value={reference} onChange={event => setReference(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
              </div>
            )}
            {action === 'handover' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300">From cashier: <strong>{cashierName}</strong></p>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300" htmlFor="pro-next-cashier">Receiving cashier</label>
                <input id="pro-next-cashier" value={receiver} onChange={event => setReceiver(event.target.value)} placeholder="Next employee (must later sign in to approve)"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300" htmlFor="pro-handover-note">Handover notes</label>
                <textarea id="pro-handover-note" value={reviewNote} onChange={event => setReviewNote(event.target.value)} rows={3}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                <p className="text-xs text-slate-500">Both employees must independently verify the cash count before a real shift can be handed over.</p>
              </div>
            )}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
              <LockKeyhole size={16} className="shrink-0" />
              <span>{action === 'count' && actualCounted !== '' && !validAmount(actualCounted) ? 'Enter a valid counted amount.' : 'Preview only. No settlement, bank transfer, or handover is recorded until the secured server workflow is released.'}</span>
            </div>
            <button type="button" onClick={() => setAction(null)} className="w-full rounded-xl bg-emerald-600 text-white font-bold text-sm py-2.5">Close preview</button>
          </div>
        </div>
      )}
    </div>
  );
}
