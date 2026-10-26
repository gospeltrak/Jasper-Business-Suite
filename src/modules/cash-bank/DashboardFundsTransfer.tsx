import React, { useRef, useState } from 'react';
import type { PaymentChannel } from '../../types';
import { transferTreasuryFunds } from './utils/treasuryApi';

/** Transfers can be authorized without exposing the balance matrix or audit history. */
export default function DashboardFundsTransfer({ channels, canTransfer }: { channels: PaymentChannel[]; canTransfer: boolean }) {
  const accounts = channels.filter(account => account.status !== 'inactive' && account.status !== 'archived' && account.category !== 'person');
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const submitting = useRef(false);
  if (!canTransfer) return <p role="status">Your role does not allow treasury transfers.</p>;
  return (
    <section className="max-w-xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
      <h2 className="text-lg font-bold">Transfer funds</h2>
      <p className="text-sm text-slate-500">Move money between accounts in your selected branch.</p>
      <form className="space-y-4" onSubmit={async event => {
        event.preventDefault();
        if (submitting.current) return;
        const value = Number(amount);
        if (!source || !destination || source === destination || !Number.isFinite(value) || value <= 0) {
          setMessage('Select two different accounts and a positive amount.'); return;
        }
        const fingerprint = JSON.stringify({ source, destination, value, description: description.trim() });
        if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: `transfer:${crypto.randomUUID()}` };
        submitting.current = true; setBusy(true); setMessage('');
        try {
          await transferTreasuryFunds({ channels, sourceAccountKey: source, destinationAccountKey: destination,
            amount: value, idempotencyKey: attempt.current.key, description: description.trim() || 'Account transfer' });
          setMessage('Transfer recorded successfully.'); setAmount(''); setDescription(''); attempt.current = null;
        } catch (error: any) { setMessage(error?.message || 'Transfer could not be confirmed. Check with the owner before retrying.'); }
        finally { submitting.current = false; setBusy(false); }
      }}>
        <label className="block text-sm">From account
          <select required value={source} onChange={event => setSource(event.target.value)} className="block w-full mt-1 rounded-lg border p-3 bg-transparent">
            <option value="">Select account</option>{accounts.map(account => <option translate="no" key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
        <label className="block text-sm">To account
          <select required value={destination} onChange={event => setDestination(event.target.value)} className="block w-full mt-1 rounded-lg border p-3 bg-transparent">
            <option value="">Select account</option>{accounts.filter(account => account.id !== source).map(account => <option translate="no" key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
        <label className="block text-sm">Amount<input required type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className="block w-full mt-1 rounded-lg border p-3 bg-transparent" /></label>
        <label className="block text-sm">Reference<input value={description} onChange={event => setDescription(event.target.value)} className="block w-full mt-1 rounded-lg border p-3 bg-transparent" /></label>
        <button disabled={busy} className="w-full rounded-lg bg-emerald-600 text-white font-semibold p-3 disabled:opacity-50">{busy ? 'Saving…' : 'Transfer funds'}</button>
        {message && <p role="status" className="text-sm">{message}</p>}
      </form>
    </section>
  );
}
