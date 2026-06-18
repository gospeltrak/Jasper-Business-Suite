import React, { useState } from 'react';
import { useMicroSoko } from './MicroSokoContext';
import { Truck, Plus } from 'lucide-react';

export const MicroSokoDelivery: React.FC = () => {
  const { deliveries, addDelivery } = useMicroSoko();
  const [showForm, setShowForm] = useState(false);
  
  const [type, setType] = useState('Customer Delivery');
  const [cost, setCost] = useState('');
  const [paidBy, setPaidBy] = useState<'business'|'customer'>('business');
  const [riderName, setRiderName] = useState('');
  const [destination, setDestination] = useState('');
  const [notes, setNotes] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cost) return;
    
    addDelivery({
      id: Math.random().toString(36).substr(2, 9),
      type, cost: Number(cost), paidBy, riderName, destination, notes,
      date: new Date().toISOString()
    });
    setShowForm(false);
    setCost(''); setRiderName(''); setDestination(''); setNotes('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Deliveries</h2>
          <p className="text-slate-500">Track outbound logistics and transport costs.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center hover:bg-emerald-700">
          <Plus className="w-5 h-5 mr-2" /> Add Delivery
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800">New Delivery Record</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Type</label>
              <select value={type} onChange={e=>setType(e.target.value)} className="w-full border p-2 rounded-lg bg-white">
                <option>Customer Delivery</option><option>Market Transport</option>
                <option>Internal Transfer</option><option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Paid By</label>
              <select value={paidBy} onChange={e=>setPaidBy(e.target.value as 'business'|'customer')} className="w-full border p-2 rounded-lg bg-white">
                <option value="business">Business</option>
                <option value="customer">Customer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Delivery Cost (TZS)</label>
              <input required type="number" value={cost} onChange={e=>setCost(e.target.value)} className="w-full border p-2 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Rider / Driver Name</label>
              <input type="text" value={riderName} onChange={e=>setRiderName(e.target.value)} className="w-full border p-2 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Destination</label>
              <input type="text" value={destination} onChange={e=>setDestination(e.target.value)} className="w-full border p-2 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Notes</label>
              <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} className="w-full border p-2 rounded-lg" />
            </div>
          </div>
          <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">Save Delivery</button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
            <tr>
              <th className="p-4">Date</th>
              <th className="p-4">Type</th>
              <th className="p-4">Destination</th>
              <th className="p-4">Rider</th>
              <th className="p-4">Cost</th>
              <th className="p-4">Paid By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deliveries.map(d => (
              <tr key={d.id}>
                <td className="p-4">{new Date(d.date).toLocaleDateString()}</td>
                <td className="p-4 font-bold text-slate-800">{d.type}</td>
                <td className="p-4">{d.destination || '-'}</td>
                <td className="p-4">{d.riderName || '-'}</td>
                <td className="p-4 font-mono">TZS {d.cost.toLocaleString()}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${d.paidBy === 'business' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {d.paidBy.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
            {deliveries.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-400">No deliveries recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};
