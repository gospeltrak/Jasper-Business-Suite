import React, { useState, useEffect, useMemo } from 'react';
import { StaffSettings, SystemSettings, Sale, Expense, Delivery, Tenant } from '../types';
import {
  Users,
  UserPlus,
  BarChart3,
  CheckCircle2,
  Camera,
  Shield,
  Upload,
  KeyRound,
  Clock,
  DollarSign,
  Activity,
  Trash2,
  Save,
  Truck,
  Smartphone,
  TimerReset
} from 'lucide-react';
import { DEFAULT_CUSTOM_ROLES } from './DashboardSettings';

const currency = 'TSh';

type StaffSessionRecord = {
  id: string;
  userId: string;
  staffId?: string;
  staffName: string;
  phone?: string;
  email?: string;
  role?: string;
  tenantId: string;
  loginAt: string;
  logoutAt?: string | null;
  durationMs?: number;
  status?: 'online' | 'offline';
  device?: string;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDuration = (ms: number) => {
  if (!ms || ms < 0) return '0m';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

const getSaleProfit = (sale: Sale) => {
  const directProfit = (sale as Sale & { profit?: number }).profit;
  if (typeof directProfit === 'number') return directProfit;

  return sale.items.reduce((sum, item) => {
    const gross = item.qty * item.price * (1 - (item.discount || 0) / 100);
    const cost = (item.costPriceAtSale || 0) * item.qty;
    return sum + Math.max(0, gross - cost);
  }, 0);
};

export default function DashboardStaff({
  systemSettings,
  onUpdateSettings,
  sales,
  expenses,
  activeTenant,
  deliveries
}: {
  systemSettings: SystemSettings;
  onUpdateSettings: (s: SystemSettings) => void;
  sales: Sale[];
  expenses: Expense[];
  activeTenant: Tenant;
  deliveries: Delivery[];
}) {
  const [activeTab, setActiveTab] = useState<'list' | 'register' | 'reports'>('list');
  const [staffList, setStaffList] = useState<StaffSettings[]>(systemSettings.staffs || []);
  const [staffStatuses, setStaffStatuses] = useState<Record<string, boolean>>({});
  const [sessionLogs, setSessionLogs] = useState<StaffSessionRecord[]>([]);
  const [sessionNow, setSessionNow] = useState(Date.now());
  const customRoles = systemSettings.customRoles || DEFAULT_CUSTOM_ROLES;

  const [roleType, setRoleType] = useState<'standard' | 'delivery'>('standard');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [profilePic, setProfilePic] = useState('');
  const [selectedRole, setSelectedRole] = useState(customRoles[0]?.name || 'Seller');
  const [classification, setClassification] = useState<'rider' | 'driver'>('rider');
  const [vehicleType, setVehicleType] = useState<'motorcycle' | 'tuktuk' | 'car'>('motorcycle');
  const [vehicleColor, setVehicleColor] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [signatureImage, setSignatureImage] = useState('');
  const [credentialStaffId, setCredentialStaffId] = useState('');
  const [credentialPhone, setCredentialPhone] = useState('');
  const [credentialPassword, setCredentialPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setStaffList(systemSettings.staffs || []);
  }, [systemSettings.staffs]);

  useEffect(() => {
    const loadSessions = () => {
      try {
        const storedSessions = localStorage.getItem(`jasper_staff_sessions_${activeTenant.id}`);
        const parsedSessions: StaffSessionRecord[] = storedSessions ? JSON.parse(storedSessions) : [];
        setSessionLogs(parsedSessions);

        const storedMap = localStorage.getItem(`jasper_staff_statuses_${activeTenant.id}`);
        const persistedStatuses: Record<string, boolean> = storedMap ? JSON.parse(storedMap) : {};
        const liveStatuses = parsedSessions.reduce<Record<string, boolean>>((acc, session) => {
          if (session.status === 'online' || !session.logoutAt) {
            acc[session.staffId || session.userId] = true;
          }
          return acc;
        }, {});
        setStaffStatuses({ ...persistedStatuses, ...liveStatuses });
      } catch (error) {
        console.warn('Unable to read staff session logs', error);
        setSessionLogs([]);
        setStaffStatuses({});
      }
      setSessionNow(Date.now());
    };

    loadSessions();
    const timer = window.setInterval(loadSessions, 15000);
    return () => window.clearInterval(timer);
  }, [activeTenant.id]);

  const staffSummaries = useMemo(() => {
    const statusMap = new Map<string, ReturnType<typeof buildStaffSummary>>();
    staffList.forEach(staff => statusMap.set(staff.id, buildStaffSummary(staff)));
    return statusMap;
  }, [staffList, sales, expenses, deliveries, sessionLogs, sessionNow, staffStatuses]);

  function buildStaffSummary(staff: StaffSettings) {
    const staffSales = sales.filter(s => s.cashierName === staff.name || s.staffName === staff.name);
    const staffDeliveries = deliveries.filter(d => d.riderDetails?.name === staff.name || d.riderId === staff.id);
    const staffExpenses = expenses.filter(e => e.staffName === staff.name);
    const sessions = sessionLogs
      .filter(session => {
        const sameId = session.staffId === staff.id || session.userId === staff.id;
        const samePhone = !!staff.phone && session.phone === staff.phone;
        const sameName = session.staffName === staff.name;
        return sameId || samePhone || sameName;
      })
      .sort((a, b) => new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime());

    const activeSession = sessions.find(session => session.status === 'online' || !session.logoutAt);
    const lastSession = sessions[0];
    const salesRevenue = staffSales.reduce((acc, sale) => acc + sale.total, 0);
    const deliveryRevenue = staffDeliveries.reduce((acc, delivery) => acc + (Number(delivery.deliveryCost) || 0), 0);
    const expensesLogged = staffExpenses.reduce((acc, expense) => acc + expense.amount, 0);
    const salesProfit = staffSales.reduce((acc, sale) => acc + getSaleProfit(sale), 0);
    const profitGenerated = salesProfit + deliveryRevenue - expensesLogged;
    const totalDuration = sessions.reduce((sum, session) => {
      if (session.logoutAt) return sum + (session.durationMs || 0);
      return sum + Math.max(0, sessionNow - new Date(session.loginAt).getTime());
    }, 0);

    return {
      isOnline: !!activeSession || !!staffStatuses[staff.id],
      lastLogin: activeSession?.loginAt || lastSession?.loginAt,
      lastLogout: activeSession ? null : lastSession?.logoutAt,
      totalDuration,
      orders: staffSales.length + staffDeliveries.length,
      totalHandled: salesRevenue + deliveryRevenue,
      expensesLogged,
      profitGenerated,
      sessionCount: sessions.length,
      device: activeSession?.device || lastSession?.device || 'Unknown'
    };
  }

  const totals = useMemo(() => {
    const summaries = staffList.map(staff => staffSummaries.get(staff.id)).filter(Boolean) as ReturnType<typeof buildStaffSummary>[];
    return {
      totalStaff: staffList.length,
      onlineStaff: summaries.filter(summary => summary.isOnline).length,
      totalProfit: summaries.reduce((sum, summary) => sum + summary.profitGenerated, 0),
      totalHours: summaries.reduce((sum, summary) => sum + summary.totalDuration, 0)
    };
  }, [staffList, staffSummaries]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => setter(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const persistStaffList = (updatedStaffs: StaffSettings[]) => {
    setStaffList(updatedStaffs);
    onUpdateSettings({ ...systemSettings, staffs: updatedStaffs });
  };

  const handleRegisterStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !password) return;

    const newStaff: StaffSettings = {
      id: `staff-${Date.now()}`,
      name: fullName.trim(),
      phone: phone.trim(),
      password: password.trim(),
      role: roleType === 'delivery' ? classification : selectedRole,
      salary: 0,
      profileImage: profilePic,
      ...(roleType === 'delivery'
        ? {
            classification,
            vehicleType,
            vehicleColor,
            licensePlate: licensePlate.toUpperCase(),
            signatureImage
          }
        : {})
    };

    persistStaffList([...staffList, newStaff]);
    setSuccessMessage(`Staff member "${fullName}" registered successfully.`);
    setFullName('');
    setPhone('');
    setPassword('');
    setProfilePic('');
    setVehicleColor('');
    setLicensePlate('');
    setSignatureImage('');

    setTimeout(() => {
      setSuccessMessage('');
      setActiveTab('list');
    }, 1800);
  };

  const handleDeleteStaff = (staffId: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;
    persistStaffList(staffList.filter(s => s.id !== staffId));
  };

  const openCredentialEditor = (staff: StaffSettings) => {
    const isOpen = credentialStaffId === staff.id;
    setCredentialStaffId(isOpen ? '' : staff.id);
    setCredentialPhone(isOpen ? '' : staff.phone);
    setCredentialPassword(isOpen ? '' : staff.password || '');
  };

  const handleSaveStaffCredentials = (staffId: string) => {
    if (!credentialPhone.trim() || !credentialPassword.trim()) {
      setSuccessMessage('Enter both staff phone/login ID and password.');
      return;
    }

    const updatedStaffs = staffList.map(staff =>
      staff.id === staffId
        ? { ...staff, phone: credentialPhone.trim(), password: credentialPassword.trim() }
        : staff
    );

    persistStaffList(updatedStaffs);
    setCredentialStaffId('');
    setCredentialPhone('');
    setCredentialPassword('');
    setSuccessMessage('Staff login credentials updated successfully.');
    setTimeout(() => setSuccessMessage(''), 2500);
  };

  const renderAvatar = (staff: StaffSettings, className = 'w-11 h-11') => (
    <div className={`${className} rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0`}>
      {staff.profileImage ? (
        <img src={staff.profileImage} alt={staff.name} className="w-full h-full object-cover" />
      ) : (
        <Users className="w-5 h-5 text-slate-400" />
      )}
    </div>
  );

  const renderStatus = (isOnline: boolean) => (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${
      isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
    }`}>
      <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
      {isOnline ? 'Online' : 'Offline'}
    </span>
  );

  const renderCredentialEditor = (staff: StaffSettings, compact = false) => (
    credentialStaffId === staff.id ? (
      <div className={`rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3 ${compact ? 'mt-3' : 'mt-2'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="tel"
            value={credentialPhone}
            onChange={e => setCredentialPhone(e.target.value)}
            placeholder="Phone / Login ID"
            className="min-h-[44px] rounded-xl border border-white bg-white px-3 text-sm font-semibold outline-none focus:border-indigo-400"
          />
          <input
            type="text"
            value={credentialPassword}
            onChange={e => setCredentialPassword(e.target.value)}
            placeholder="New password / PIN"
            className="min-h-[44px] rounded-xl border border-white bg-white px-3 text-sm font-semibold outline-none focus:border-indigo-400"
          />
        </div>
        <div className="mt-3 flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setCredentialStaffId('')}
            className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSaveStaffCredentials(staff.id)}
            className="min-h-[40px] rounded-xl bg-slate-950 px-4 text-xs font-black text-white inline-flex items-center gap-2"
          >
            <Save className="w-3.5 h-3.5" />
            Save Login
          </button>
        </div>
      </div>
    ) : null
  );

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      <section className="rounded-none md:rounded-[1.75rem] border-y md:border border-slate-200 bg-white px-4 py-5 md:p-6 shadow-sm -mx-4 md:mx-0">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-indigo-700">
              <Users className="w-5 h-5" />
              <span className="text-[11px] font-black uppercase tracking-[0.18em]">Staff control center</span>
            </div>
            <h2 className="mt-2 text-2xl md:text-3xl font-black tracking-tight text-slate-950">Staff & HR</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Manage staff accounts, delivery workers, login resets, live sessions, and profit generated by each team member.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className="min-h-[48px] rounded-2xl bg-indigo-600 px-5 text-sm font-black text-white shadow-sm hover:bg-indigo-700 active:scale-[0.99] inline-flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Register Staff
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total staff', value: totals.totalStaff.toLocaleString(), icon: Users, color: 'text-slate-900' },
            { label: 'Online now', value: totals.onlineStaff.toLocaleString(), icon: Activity, color: 'text-emerald-700' },
            { label: 'Profit generated', value: `${currency}${Math.round(totals.totalProfit).toLocaleString()}`, icon: DollarSign, color: 'text-indigo-700' },
            { label: 'Time in system', value: formatDuration(totals.totalHours), icon: Clock, color: 'text-amber-700' }
          ].map(item => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{item.label}</span>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <div className={`mt-2 text-xl font-black tracking-tight ${item.color}`}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="sticky top-0 z-20 -mx-4 md:mx-0 bg-slate-50/95 md:bg-transparent backdrop-blur md:static px-4 md:px-0 py-2 md:py-0">
        <div className="flex md:inline-flex w-full md:w-auto gap-1 rounded-2xl bg-slate-200/70 p-1 overflow-x-auto">
          {[
            { id: 'list', label: 'Directory', icon: Shield },
            { id: 'register', label: 'Register', icon: UserPlus },
            { id: 'reports', label: 'Reports', icon: BarChart3 }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`min-h-[44px] flex-1 md:flex-none rounded-xl px-4 text-xs font-black inline-flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                activeTab === tab.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {successMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          {successMessage}
        </div>
      )}

      {activeTab === 'list' && (
        <section className="rounded-none md:rounded-[1.75rem] border-y md:border border-slate-200 bg-white p-4 md:p-6 shadow-sm -mx-4 md:mx-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-black text-slate-950">Registered Staff</h3>
              <p className="text-xs text-slate-500 mt-1">Admin can reset a staff login ID and password from this directory.</p>
            </div>
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">{staffList.length} accounts</div>
          </div>

          <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-4">Staff member</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Last login</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-sm font-semibold text-slate-400">No staff registered.</td>
                  </tr>
                ) : (
                  staffList.map(staff => {
                    const summary = staffSummaries.get(staff.id) || buildStaffSummary(staff);
                    return (
                      <tr key={staff.id} className="align-top hover:bg-slate-50/60">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {renderAvatar(staff)}
                            <div className="min-w-0">
                              <div className="font-black text-slate-900 truncate">{staff.name}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{staff.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${
                            staff.role === 'rider' || staff.role === 'driver'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}>
                            {staff.role}
                          </span>
                        </td>
                        <td className="p-4">{renderStatus(summary.isOnline)}</td>
                        <td className="p-4">
                          <div className="text-xs font-bold text-slate-700">{formatDateTime(summary.lastLogin)}</div>
                          <div className="text-[11px] text-slate-400 mt-1">{summary.device}</div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openCredentialEditor(staff)}
                              className="min-h-[38px] rounded-xl bg-indigo-50 px-3 text-xs font-black text-indigo-700 hover:bg-indigo-100 inline-flex items-center gap-1.5"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              Edit Login
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStaff(staff.id)}
                              className="min-h-[38px] rounded-xl bg-rose-50 px-3 text-xs font-black text-rose-700 hover:bg-rose-100 inline-flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          </div>
                          {renderCredentialEditor(staff)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-3">
            {staffList.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-400">No staff registered.</div>
            ) : (
              staffList.map(staff => {
                const summary = staffSummaries.get(staff.id) || buildStaffSummary(staff);
                return (
                  <article key={staff.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      {renderAvatar(staff, 'w-14 h-14')}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-black text-slate-950 truncate">{staff.name}</h4>
                            <p className="mt-0.5 text-xs font-semibold text-slate-500">{staff.phone}</p>
                          </div>
                          {renderStatus(summary.isOnline)}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[10px] font-black uppercase text-slate-700">{staff.role}</span>
                          <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[10px] font-black text-slate-500">{formatDateTime(summary.lastLogin)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openCredentialEditor(staff)}
                        className="min-h-[46px] rounded-2xl bg-indigo-600 text-white text-xs font-black inline-flex items-center justify-center gap-2"
                      >
                        <KeyRound className="w-4 h-4" />
                        Edit Login
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteStaff(staff.id)}
                        className="min-h-[46px] rounded-2xl bg-white border border-rose-200 text-rose-700 text-xs font-black inline-flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    </div>
                    {renderCredentialEditor(staff, true)}
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}

      {activeTab === 'register' && (
        <section className="rounded-none md:rounded-[1.75rem] border-y md:border border-slate-200 bg-white p-4 md:p-6 shadow-sm -mx-4 md:mx-0">
          <div className="mb-5">
            <h3 className="text-base font-black text-slate-950">Staff Onboarding</h3>
            <p className="mt-1 text-xs text-slate-500">Create a staff login, assign a role, and add delivery details when needed.</p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 mb-5">
            <button
              type="button"
              onClick={() => setRoleType('standard')}
              className={`min-h-[46px] rounded-xl text-xs font-black ${roleType === 'standard' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}
            >
              Standard Staff
            </button>
            <button
              type="button"
              onClick={() => setRoleType('delivery')}
              className={`min-h-[46px] rounded-xl text-xs font-black ${roleType === 'delivery' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600'}`}
            >
              Driver / Rider
            </button>
          </div>

          <form onSubmit={handleRegisterStaff} className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-5">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 md:p-5 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Login and identity</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="space-y-1.5">
                    <span className="text-xs font-black text-slate-700">Full Name</span>
                    <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Omary Juma" className="w-full min-h-[48px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-indigo-500" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-black text-slate-700">Phone Number (Login ID)</span>
                    <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 0712345678" className="w-full min-h-[48px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-indigo-500" />
                  </label>
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-xs font-black text-slate-700">Password / PIN</span>
                    <input type="text" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Set staff password" className="w-full min-h-[48px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-indigo-500" />
                  </label>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 md:p-5 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Role and media</h4>
                {roleType === 'standard' ? (
                  <label className="space-y-1.5 block">
                    <span className="text-xs font-black text-slate-700">Assign Role</span>
                    <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} className="w-full min-h-[48px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black outline-none focus:border-indigo-500">
                      {customRoles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                  </label>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Classification</span>
                      <select value={classification} onChange={e => setClassification(e.target.value as 'rider' | 'driver')} className="w-full min-h-[48px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black outline-none">
                        <option value="rider">Motorcycle / TukTuk Rider</option>
                        <option value="driver">Van / Car Driver</option>
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Vehicle Type</span>
                      <select value={vehicleType} onChange={e => setVehicleType(e.target.value as 'motorcycle' | 'tuktuk' | 'car')} className="w-full min-h-[48px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black outline-none">
                        <option value="motorcycle">Motorcycle</option>
                        <option value="tuktuk">TukTuk / Bajaj</option>
                        <option value="car">Car / Van</option>
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Vehicle Color</span>
                      <input type="text" value={vehicleColor} onChange={e => setVehicleColor(e.target.value)} placeholder="e.g. Red" className="w-full min-h-[48px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none" />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">License Plate</span>
                      <input type="text" required={roleType === 'delivery'} value={licensePlate} onChange={e => setLicensePlate(e.target.value)} placeholder="e.g. MC12345" className="w-full min-h-[48px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-mono font-black uppercase outline-none" />
                    </label>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="min-h-[110px] rounded-2xl border-2 border-dashed border-slate-300 bg-white p-3 flex flex-col items-center justify-center text-center cursor-pointer">
                    {profilePic ? <img src={profilePic} alt="Profile" className="h-16 w-16 rounded-2xl object-cover" /> : <Camera className="w-7 h-7 text-slate-400" />}
                    <span className="mt-2 text-xs font-black text-slate-600">Profile Photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, setProfilePic)} />
                  </label>
                  <label className="min-h-[110px] rounded-2xl border-2 border-dashed border-slate-300 bg-white p-3 flex flex-col items-center justify-center text-center cursor-pointer">
                    {signatureImage ? <img src={signatureImage} alt="Signature" className="h-14 w-full object-contain" /> : <Upload className="w-7 h-7 text-slate-400" />}
                    <span className="mt-2 text-xs font-black text-slate-600">Signature</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, setSignatureImage)} />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="w-full md:w-auto min-h-[52px] rounded-2xl bg-indigo-600 px-8 text-sm font-black text-white hover:bg-indigo-700 active:scale-[0.99] inline-flex items-center justify-center gap-2">
                <UserPlus className="w-4 h-4" />
                Save Registration
              </button>
            </div>
          </form>
        </section>
      )}

      {activeTab === 'reports' && (
        <section className="rounded-none md:rounded-[1.75rem] border-y md:border border-slate-200 bg-white p-4 md:p-6 shadow-sm -mx-4 md:mx-0">
          <div className="mb-5">
            <h3 className="text-base font-black text-slate-950">Staff Sessions and Performance</h3>
            <p className="mt-1 text-xs text-slate-500">Shows online status, login/logout time, time spent, orders handled, and profit generated through each staff account.</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {staffList.length === 0 ? (
              <div className="xl:col-span-2 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-400">
                Register staff to see their session and performance reports here.
              </div>
            ) : (
              staffList.map(staff => {
                const summary = staffSummaries.get(staff.id) || buildStaffSummary(staff);
                return (
                  <article key={staff.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 md:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {renderAvatar(staff, 'w-14 h-14')}
                        <div className="min-w-0">
                          <h4 className="font-black text-slate-950 truncate">{staff.name}</h4>
                          <p className="mt-1 text-[11px] font-black uppercase tracking-wider text-indigo-600">{staff.role}</p>
                        </div>
                      </div>
                      {renderStatus(summary.isOnline)}
                    </div>

                    <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="rounded-2xl bg-white border border-slate-200 p-3">
                        <Clock className="w-4 h-4 text-indigo-600 mb-2" />
                        <span className="block text-[10px] font-black uppercase text-slate-400">Login</span>
                        <strong className="mt-1 block text-xs text-slate-800">{formatDateTime(summary.lastLogin)}</strong>
                      </div>
                      <div className="rounded-2xl bg-white border border-slate-200 p-3">
                        <TimerReset className="w-4 h-4 text-slate-600 mb-2" />
                        <span className="block text-[10px] font-black uppercase text-slate-400">Logout</span>
                        <strong className="mt-1 block text-xs text-slate-800">{summary.isOnline ? 'Still online' : formatDateTime(summary.lastLogout)}</strong>
                      </div>
                      <div className="rounded-2xl bg-white border border-slate-200 p-3">
                        <Smartphone className="w-4 h-4 text-amber-600 mb-2" />
                        <span className="block text-[10px] font-black uppercase text-slate-400">Time spent</span>
                        <strong className="mt-1 block text-xs text-slate-800">{formatDuration(summary.totalDuration)}</strong>
                      </div>
                      <div className="rounded-2xl bg-white border border-slate-200 p-3">
                        <Activity className="w-4 h-4 text-emerald-600 mb-2" />
                        <span className="block text-[10px] font-black uppercase text-slate-400">Sessions</span>
                        <strong className="mt-1 block text-xs text-slate-800">{summary.sessionCount}</strong>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="rounded-2xl bg-white border border-slate-200 p-3">
                        <span className="block text-[10px] font-black uppercase text-slate-400">Orders / Tx</span>
                        <strong className="mt-1 block text-lg font-black text-slate-900">{summary.orders}</strong>
                      </div>
                      <div className="rounded-2xl bg-white border border-slate-200 p-3">
                        <span className="block text-[10px] font-black uppercase text-slate-400">Handled</span>
                        <strong className="mt-1 block text-sm font-black text-emerald-700">{currency}{Math.round(summary.totalHandled).toLocaleString()}</strong>
                      </div>
                      <div className="rounded-2xl bg-white border border-slate-200 p-3">
                        <span className="block text-[10px] font-black uppercase text-slate-400">Profit</span>
                        <strong className={`mt-1 block text-sm font-black ${summary.profitGenerated >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>{currency}{Math.round(summary.profitGenerated).toLocaleString()}</strong>
                      </div>
                      <div className="rounded-2xl bg-white border border-slate-200 p-3">
                        <span className="block text-[10px] font-black uppercase text-slate-400">Expenses</span>
                        <strong className="mt-1 block text-sm font-black text-rose-700">{currency}{Math.round(summary.expensesLogged).toLocaleString()}</strong>
                      </div>
                    </div>

                    {(staff.classification || staff.vehicleType || staff.licensePlate) && (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900 flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        <span>{staff.classification || staff.role} - {staff.vehicleType || 'vehicle'} {staff.licensePlate ? `(${staff.licensePlate})` : ''}</span>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
