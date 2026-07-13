import React, { useState, useEffect } from 'react';
import { Receipt, Trash } from 'lucide-react';
import { loadPlatformRecord, savePlatformRecord } from '../utils/superAdminPlatformRecords';
import { ONLINE_ONLY_WRITE_MESSAGE } from '../utils/onlineOnly';

interface ExpenseRecord {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  recipient: string;
}

export default function SaaSExpensesView() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState('Operational');
  const [expAmount, setExpAmount] = useState('');
  const [expRecipient, setExpRecipient] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(() => {
    let alive = true;
    loadPlatformRecord<ExpenseRecord[]>('platform_expenses', 'global', [])
      .then((items) => { if (alive) setExpenses(Array.isArray(items) ? items : []); })
      .catch(() => setExpenses([]));
    return () => { alive = false; };
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle || !expAmount) return;

    const amountNum = parseFloat(expAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    const newExp: ExpenseRecord = {
      id: 'EXP-' + Math.floor(1000 + Math.random() * 9000),
      title: expTitle,
      category: expCategory,
      amount: amountNum,
      date: new Date().toISOString().split('T')[0],
      recipient: expRecipient || 'General Vendor'
    };

    const updated = [...expenses, newExp];
    try {
      await savePlatformRecord('platform_expenses', 'global', updated);
    } catch (error: any) {
      alert(error?.message || ONLINE_ONLY_WRITE_MESSAGE);
      return;
    }

    setExpenses(updated);
    setExpTitle('');
    setExpAmount('');
    setExpRecipient('');
    setFormSuccess(true);
    setTimeout(() => setFormSuccess(false), 2500);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('Delete this expense record?')) return;
    const filtered = expenses.filter(e => e.id !== id);
    try {
      await savePlatformRecord('platform_expenses', 'global', filtered);
    } catch (error: any) {
      alert(error?.message || ONLINE_ONLY_WRITE_MESSAGE);
      return;
    }

    setExpenses(filtered);
  };

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Expenses Owed Metric Card */}
      <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl relative overflow-hidden max-w-sm">
        <div className="absolute top-4 right-4 text-amber-500/20"><Receipt className="w-5 h-5" /></div>
        <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-bold text-amber-400">Total Operational Expenses</span>
        <h3 className="text-2xl font-black text-white mt-2">
          TSh {expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-slate-900 border border-slate-850 p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Record Daily Expense</h3>
            <span className="p-1.5 bg-slate-950 rounded text-[9.5px] font-mono text-slate-500">Manual Entry</span>
          </div>

          {formSuccess && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-center text-xs animate-fade-in">
              ✓ Expense recorded successfully inside accounts catalog ledger.
            </div>
          )}

          <form onSubmit={handleAddExpense} className="space-y-4 text-xs font-sans">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Description</label>
              <input type="text" required placeholder="e.g. Server hosting" value={expTitle} onChange={(e) => setExpTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-white placeholder-slate-600 outline-none rounded-xl p-3 focus:border-amber-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Amount (TSh)</label>
                <input type="number" required min="50" placeholder="e.g. 15000" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-white placeholder-slate-600 outline-none rounded-xl p-3 focus:border-amber-500 font-mono" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Category</label>
                <select value={expCategory} onChange={(e) => setExpCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-white outline-none rounded-xl p-3 focus:border-amber-500 cursor-pointer">
                  <option value="Operational">Operational</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Legal">Legal</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Vendor/Recipient</label>
              <input type="text" placeholder="e.g. Hostinger Web LTD" value={expRecipient} onChange={(e) => setExpRecipient(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-white placeholder-slate-600 outline-none rounded-xl p-3 focus:border-amber-500" />
            </div>
            <button type="submit" className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold uppercase rounded-xl transition-all cursor-pointer shadow-md">
              Post Expense Entry
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 bg-slate-900 border border-slate-850 p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Platform Expenses Ledger</h3>
            <span className="px-2 py-0.5 bg-slate-950 border border-slate-850 rounded text-[9.5px] font-mono text-slate-400 uppercase">Audit Records ({expenses.length})</span>
          </div>
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {[...expenses].reverse().map((item) => (
              <div key={item.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-855 flex justify-between items-center text-xs font-mono relative group">
                <div className="space-y-1 text-left">
                  <div className="flex items-center space-x-2">
                    <span className="text-amber-400 font-bold text-[10px] bg-amber-500/10 px-2 py-0.5 rounded">{item.id}</span>
                    <span className="font-extrabold text-white text-[11.5px] font-sans">{item.title}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 pl-1">{item.date} • {item.recipient}</div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <div className="text-amber-400 font-black tracking-wider text-[11.5px]">- TSh {item.amount.toLocaleString()}</div>
                  <button onClick={() => handleDeleteExpense(item.id)} className="text-rose-500 hover:text-rose-400 p-1 opacity-50 hover:opacity-100 transition-opacity" title="Delete Expense">
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {expenses.length === 0 && (
              <div className="p-8 text-center text-slate-500 italic font-sans text-xs">
                No expense entries cataloged yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
