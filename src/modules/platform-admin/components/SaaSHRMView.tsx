import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash, Shield, Activity, Edit2, DollarSign } from 'lucide-react';
import { formatLocalDate } from '../utils/localDate';

interface HiredStaff {
  id: string;
  name: string;
  role: string;
  monthlySalary: number;
  status: 'Active' | 'Suspended' | 'Probation';
  joinedDate: string;
  notes?: string;
}

export default function SaaSHRMView() {
  const [staff, setStaff] = useState<HiredStaff[]>([]);
  
  // Form controls
  const [name, setName] = useState('');
  const [role, setRole] = useState('General Manager');
  const [salary, setSalary] = useState('');
  const [status, setStatus] = useState<'Active' | 'Probation'>('Active');
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState(false);

  // Edit fields
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSalaryVal, setEditSalaryVal] = useState('');

  useEffect(() => {
    // Fetch recruited staff from local storage
    const rawStaff = onlineStorage.getItem('saas_staff_ledger');
    if (rawStaff) {
      try {
        setStaff(JSON.parse(rawStaff));
      } catch (err) {}
    } else {
      // Seed initial mock HR ledger
      const initialStaff: HiredStaff[] = [
        { id: 'STF-01', name: 'Juma Ramadhani', role: 'General Manager', monthlySalary: 750000, status: 'Active', joinedDate: '2026-04-10', notes: 'Oversees daily digital banner postings and handles direct TRA compliance briefs.' },
        { id: 'STF-02', name: 'Zainab Salum', role: 'Customer Success & Support Desk', monthlySalary: 450000, status: 'Active', joinedDate: '2026-05-02', notes: 'Speaks with organic and super affiliates on live mobile complaints.' }
      ];
      onlineStorage.setItem('saas_staff_ledger', JSON.stringify(initialStaff));
      setStaff(initialStaff);
    }
  }, []);

  const handleHireStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !salary) return;

    const salNum = parseFloat(salary);
    if (isNaN(salNum) || salNum <= 0) {
      alert('Please enter a valid monthly salary.');
      return;
    }

    const newSTF: HiredStaff = {
      id: 'STF-' + Math.floor(10 + Math.random() * 90),
      name,
      role,
      monthlySalary: salNum,
      status,
      joinedDate: formatLocalDate(),
      notes: notes || 'Assigned to SaaS platform support workspace.'
    };

    const updated = [...staff, newSTF];
    onlineStorage.setItem('saas_staff_ledger', JSON.stringify(updated));
    setStaff(updated);

    // Reset inputs
    setName('');
    setSalary('');
    setNotes('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const handleTerminateStaff = (id: string, name: string) => {
    if (!window.confirm(`Are you absolutely sure you want to terminate the employment contract for ${name}? This action removes their active credentials and is irreversible.`)) return;
    const filtered = staff.filter(s => s.id !== id);
    onlineStorage.setItem('saas_staff_ledger', JSON.stringify(filtered));
    setStaff(filtered);
  };

  const handleUpdateStatus = (id: string, newStatus: 'Active' | 'Suspended' | 'Probation') => {
    const updated = staff.map(s => {
      if (s.id === id) {
        return { ...s, status: newStatus };
      }
      return s;
    });
    onlineStorage.setItem('saas_staff_ledger', JSON.stringify(updated));
    setStaff(updated);
  };

  const handleSaveSalaryEdit = (id: string) => {
    const salNum = parseFloat(editSalaryVal);
    if (isNaN(salNum) || salNum <= 0) {
      alert('Invalid salary.');
      return;
    }

    const updated = staff.map(s => {
      if (s.id === id) {
        return { ...s, monthlySalary: salNum };
      }
      return s;
    });

    onlineStorage.setItem('saas_staff_ledger', JSON.stringify(updated));
    setStaff(updated);
    setEditingId(null);
    setEditSalaryVal('');
  };

  return (
    <div className="space-y-8 animate-fade-in text-left">
      
      {/* Banner / description */}
      <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">HRM Workspace & Personnel Directory</h2>
          <p className="text-xs text-slate-400 mt-1">Hire staff and set wages.</p>
        </div>
        <div className="flex items-center space-x-2 bg-indigo-500/10 text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-500/20 text-xs font-mono">
          <Users className="w-4 h-4 shrink-0" />
          <span>Active Workforce headcount: {staff.length}</span>
        </div>
      </div>

      {/* Grid of hire form & active personnel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Hire Form Panel */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-850 p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-850">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest font-mono">Employ Personnel Ticket</h3>
            <span className="text-[10px] bg-slate-950 text-slate-500 rounded px-2 py-0.5 font-mono">Admin Portal</span>
          </div>

          {success && (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl text-center text-xs animate-fade-in font-bold">
              ✓ Staff member successfully hired and deployed. Open the Accounts section to dispatch monthly wage transfers.
            </div>
          )}

          <form onSubmit={handleHireStaff} className="space-y-4 text-xs font-sans">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-400">Employee Full Name</label>
              <input 
                type="text"
                required
                placeholder="e.g. Mary Joseph Swai"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white placeholder-slate-650 rounded-xl p-3 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-slate-400">Company Role & Scope</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="General Manager">General Manager</option>
                  <option value="Associate Platform Supervisor">Associate Platform Supervisor</option>
                  <option value="Customer Success Support">Customer Success Support</option>
                  <option value="TRA Compliance Auditor">TRA Compliance Auditor</option>
                  <option value="System Web Developer">System Web Developer</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-slate-400">Monthly Salary (TSh)</label>
                <input 
                  type="number"
                  required
                  min="1000"
                  placeholder="e.g. 600000"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white placeholder-slate-650 rounded-xl p-3 outline-none focus:border-indigo-500 font-mono font-bold text-indigo-400"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-400">Initial Job Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="Active">Active Duty</option>
                <option value="Probation">Probation (30-Day Check)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-400">Staff Responsibilities Notes</label>
              <textarea 
                placeholder="Staff targets..."
                value={notes}
                maxLength={200}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 text-white placeholder-slate-650 rounded-xl p-3 outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold uppercase rounded-xl transition-all shadow-md shadow-indigo-500/10 cursor-pointer text-xs"
            >
              Sign Employment Contract
            </button>
          </form>
        </div>

        {/* Directory Ledger List */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-850 p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-850">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest font-mono">Workforce Directory Ledger</h3>
            <span className="px-2 py-0.5 bg-slate-950 rounded text-[9.5px] font-mono text-slate-400">Authorized Personnel</span>
          </div>

          <div className="space-y-4">
            {staff.map((employee) => {
              const isEditing = editingId === employee.id;

              return (
                <div key={employee.id} className="bg-slate-955 bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-3 relative">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div className="text-left space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-[9px] font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded px-1.5 py-0.2 uppercase font-bold">{employee.id}</span>
                        <h4 className="font-bold text-white text-sm">{employee.name}</h4>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 font-medium block">Role: <span className="text-amber-400 font-bold">{employee.role}</span></span>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-mono text-indigo-300 font-bold">
                        {isEditing ? (
                          <div className="flex items-center space-x-1 mt-1">
                            <input 
                              type="number"
                              value={editSalaryVal}
                              onChange={(e) => setEditSalaryVal(e.target.value)}
                              className="bg-slate-900 text-white rounded p-1 text-[10px] w-20 outline-none border border-slate-700 font-mono font-bold"
                            />
                            <button 
                              onClick={() => handleSaveSalaryEdit(employee.id)}
                              className="px-1.5 py-1 bg-emerald-500 text-slate-950 font-bold uppercase rounded text-[8px]"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1.5 justify-end">
                            <span>TSh {employee.monthlySalary.toLocaleString()} / mo</span>
                            <button 
                              onClick={() => {
                                setEditingId(employee.id);
                                setEditSalaryVal(employee.monthlySalary.toString());
                              }} 
                              className="text-slate-500 hover:text-white"
                              title="Modify Salary Amount"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Hired Since: {employee.joinedDate}</div>
                    </div>
                  </div>

                  {employee.notes && (
                    <p className="text-[11px] text-slate-400 italic bg-slate-900/40 p-2 rounded.xl rounded border border-slate-850/60 leading-relaxed">
                      "{employee.notes}"
                    </p>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-900 pt-2.5 text-[10px]">
                    <div className="flex items-center space-x-3 text-[9px] font-mono">
                      <span className="text-slate-500">Service Status:</span>
                      
                      <div className="flex items-center space-x-1.5 font-bold">
                        <select
                          value={employee.status}
                          onChange={(e) => handleUpdateStatus(employee.status, e.target.value as any)}
                          className={`bg-slate-900 text-[10px] p-1 rounded font-bold cursor-pointer outline-none border border-slate-800 ${
                            employee.status === 'Active' 
                              ? 'text-emerald-400' 
                              : employee.status === 'Probation' 
                                ? 'text-amber-400' 
                                : 'text-rose-400'
                          }`}
                        >
                          <option value="Active">Active Duty</option>
                          <option value="Probation">On Probation</option>
                          <option value="Suspended">Suspended</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTerminateStaff(employee.id, employee.name)}
                      className="text-red-400 hover:text-red-500 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded text-[9.5px] font-mono font-bold uppercase transition-colors cursor-pointer"
                    >
                      Halt Employment
                    </button>
                  </div>
                </div>
              );
            })}

            {staff.length === 0 && (
              <div className="text-center py-12 text-slate-500 font-sans italic bg-slate-950 rounded-xl">
                No personnel hired in the SaaS system workspace yet. Use the employee contract form to add a manager or support desk representative.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
