import React, { useState } from 'react';
import { useMicroSoko } from './MicroSokoContext';
import { Receipt, Search, Plus } from 'lucide-react';

export const MicroSokoExpenses: React.FC = () => {
  const { expenses, addExpense, paymentMethods } = useMicroSoko();
  const [showForm, setShowForm] = useState(false);
  
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Rent');
  const [amount, setAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [notes, setNotes] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount) return;
    
    addExpense({
      id: Math.random().toString(36).substr(2, 9),
      name, category, amount: Number(amount),
      paymentMethodId, notes,
      date: new Date().toISOString()
    });
    setShowForm(false);
    setName(''); setAmount(''); setNotes('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Business Expenses</h2>
          <p className="text-slate-500">Track general operational costs.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center hover:bg-emerald-700">
          <Plus className="w-5 h-5 mr-2" /> Add Expense
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800">New Expense Record</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Expense Name</label>
              <input required type="text" value={name} onChange={e=>setName(e.target.value)} className="w-full border p-2 rounded-lg" placeholder="e.g. LUKU" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Category</label>
              <select value={category} onChange={e=>setCategory(e.target.value)} className="w-full border p-2 rounded-lg bg-white">
                <option>Rent</option><option>Salary</option><option>Electricity</option>
                <option>Water</option><option>Internet</option><option>Cleaning</option>
                <option>Maintenance</option><option>Tax</option><option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Amount (TZS)</label>
              <input required type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full border p-2 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Payment Method</label>
              <select value={paymentMethodId} onChange={e=>setPaymentMethodId(e.target.value)} className="w-full border p-2 rounded-lg bg-white">
                <option value="">Select...</option>
                {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1">Notes</label>
              <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} className="w-full border p-2 rounded-lg" />
            </div>
          </div>
          <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">Save Expense</button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
            <tr>
              <th className="p-4">Date</th>
              <th className="p-4">Name</th>
              <th className="p-4">Category</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Method</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.map(e => (
              <tr key={e.id}>
                <td className="p-4">{new Date(e.date).toLocaleDateString()}</td>
                <td className="p-4 font-bold text-slate-800">{e.name}</td>
                <td className="p-4">{e.category}</td>
                <td className="p-4 font-mono">TZS {e.amount.toLocaleString()}</td>
                <td className="p-4">{paymentMethods.find(p=>p.id===e.paymentMethodId)?.name || '-'}</td>
              </tr>
            ))}
            {expenses.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">No expenses recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};
