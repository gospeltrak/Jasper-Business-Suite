import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Search,
  Lock,
  ArrowLeft,
  AppWindow,
  Key,
  MoreVertical,
  Eye,
  MapPin,
  Pencil,
  Trash2,
  ChevronRight,
  X
} from 'lucide-react';
import {
  deleteSuperAdminUser,
  listSuperAdminTenantStaff,
  loadSuperAdminOverview,
  loadSuperAdminTenantWorkspace,
  mapSuperAdminUsers,
  removeSuperAdminTenantStaffLogin,
  resetSuperAdminUserPassword,
  SuperAdminOverview,
  SuperAdminTenantStaffRow,
  SuperAdminUserRow,
  updateSuperAdminUser,
  verifySuperAdminPassword
} from '../utils/superAdminData';
import { loadPlatformRecord, savePlatformRecord } from '../utils/superAdminPlatformRecords';

interface SessionLog {
  loginTime: string;
  logoutTime: string;
  durationMinutes: number;
  device: 'Phone' | 'Tablet' | 'Desktop';
  ipAddress: string;
  location: string;
}

interface UserAccount extends SuperAdminUserRow {
  id: string;
  tenantId: string | null;
  tenantName: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  referralSource: 'direct' | 'affiliate';
  referringAffiliate?: string;
  subscriptionPlan: string;
  paymentStatus: 'Paid' | 'Unpaid' | 'Grace Period' | 'Overdue';
  paymentMethod: string;
  dateCreated: string;
  status: 'Active' | 'Suspended' | 'Expired';
  sessions: SessionLog[];
  transactions: Array<{ id: string; date: string; items: string; amount: number; paymentMethod: string }>;
  reports: Array<{ month: string; profit: number; taxCollected: number; expenseTotal: number }>;
  stockRecords: Array<{ id: string; name: string; sku: string; stockQty: number; alertQty: number }>;
  downlines: Array<{ name: string; role: string; status: 'online' | 'offline' }>;
  messages: Array<{ sender: string; timestamp: string; body: string }>;
  paymentHistory: Array<{ invoiceNo: string; date: string; amount: number; method: string; status: 'Success' | 'Pending' }>;
}

export default function SaaSUserDesk({ isUnlocked = false, onLock }: { isUnlocked?: boolean, onLock?: () => void }) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'organic' | 'sub_affiliate'>('all');
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isTenantDetailLoading, setIsTenantDetailLoading] = useState(false);
  const [hardwarePurchasesBySubscriber, setHardwarePurchasesBySubscriber] = useState<Record<string, any[]>>({});
  const overviewRef = useRef<SuperAdminOverview | null>(null);
  const tenantDetailRequestRef = useRef<AbortController | null>(null);

  // Mirror view authentication states
  const [showMirrorModal, setShowMirrorModal] = useState(false);
  const [mirrorTarget, setMirrorTarget] = useState<UserAccount | null>(null);
  const [mirrorPass1, setMirrorPass1] = useState('');
  const [mirrorPass2, setMirrorPass2] = useState('');
  const [mirrorError, setMirrorError] = useState('');

  // Immersive Mode (Seeing everything exactly as the user sees it)
  const [immersiveTab] = useState<'business'>('business');
  const [bizSubTab, setBizSubTab] = useState<'messages' | 'billing' | 'hardware'>('messages');

  // Encryption key verification states
  const [secureKeyInput, setSecureKeyInput] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0); // in seconds
  const [isActionLocked, setIsActionLocked] = useState(false);

  // Field edit states for selected user
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<UserAccount['paymentStatus']>('Paid');
  const [editStatus, setEditStatus] = useState<UserAccount['status']>('Active');

  // Custom password reset state
  const [newPasswordValue, setNewPasswordValue] = useState('');

  // Tenant staff list, shown inside Edit Subscriber. Loaded on demand (not
  // every row has staff, and Super Admin never saw this list before).
  const [tenantStaff, setTenantStaff] = useState<SuperAdminTenantStaffRow[]>([]);
  const [isLoadingTenantStaff, setIsLoadingTenantStaff] = useState(false);
  const [removingStaffId, setRemovingStaffId] = useState<string | null>(null);
  const [resetStaffId, setResetStaffId] = useState<string | null>(null);
  const [staffPasswordValue, setStaffPasswordValue] = useState('');
  const [resettingStaffId, setResettingStaffId] = useState<string | null>(null);

  // Per-card "⋮" actions sheet (write mode only) and the location it can open.
  const [actionsMenuUser, setActionsMenuUser] = useState<UserAccount | null>(null);
  const [locationModalUser, setLocationModalUser] = useState<UserAccount | null>(null);

  // Business type (retail/pharmacy) correction state
  const [isEditingBusinessType, setIsEditingBusinessType] = useState(false);
  const [isSavingBusinessType, setIsSavingBusinessType] = useState(false);

  // Profile field edit panel (name/username/email/phone/plan/payment status)
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Pager settings for live logs
  useEffect(() => {
    loadUsersData();
    const lockedUntil = onlineStorage.getItem('saas_admin_lockout_until');
    if (lockedUntil) {
      const remaining = Math.ceil((parseInt(lockedUntil) - Date.now()) / 1000);
      if (remaining > 0) {
        setLockoutTimeLeft(remaining);
        setIsActionLocked(true);
      }
    }
  }, []);

  useEffect(() => () => tenantDetailRequestRef.current?.abort(), []);

  // Set up secure lock timer ticking
  useEffect(() => {
    if (lockoutTimeLeft > 0) {
      const timer = setInterval(() => {
        setLockoutTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsActionLocked(false);
            onlineStorage.removeItem('saas_admin_lockout_until');
            setFailedAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTimeLeft]);

  const loadUsersData = async () => {
    setIsLoading(true);
    try {
      const [overview, purchasesBySubscriber] = await Promise.all([
        loadSuperAdminOverview(),
        loadPlatformRecord<Record<string, any[]>>('hardware_purchases_by_subscriber', 'global', {})
      ]);
      const liveUsers = mapSuperAdminUsers(overview);
      overviewRef.current = overview;
      setUsers(liveUsers);
      setHardwarePurchasesBySubscriber(purchasesBySubscriber || {});
      setSelectedUser((current) => current ? liveUsers.find((user) => user.id === current.id) || null : null);
      setLoadError('');
    } catch (error: any) {
      setLoadError(error?.message || 'Unable to load live subscriber database.');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
    return;
  };

  const selectUser = async (user: UserAccount) => {
    tenantDetailRequestRef.current?.abort();
    setSelectedUser(user);
    setEditName(user.name);
    setEditUsername(user.username);
    setEditEmail(user.email);
    setEditPhone(user.phone);
    setEditPlan(user.subscriptionPlan);
    setEditPaymentStatus(user.paymentStatus);
    setEditStatus(user.status);
    setBizSubTab('messages');
    setIsEditingBusinessType(false);
    if (!user.tenantId || !overviewRef.current) return;

    const controller = new AbortController();
    tenantDetailRequestRef.current = controller;
    setIsTenantDetailLoading(true);
    try {
      const workspace = await loadSuperAdminTenantWorkspace(user.tenantId, controller.signal);
      if (controller.signal.aborted) return;
      const detailedUser = mapSuperAdminUsers({
        ...overviewRef.current,
        workspaces: [workspace],
      }).find((candidate) => candidate.id === user.id);
      if (detailedUser) {
        setSelectedUser((current) => current?.id === user.id ? detailedUser : current);
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') setLoadError(error?.message || 'Unable to load the selected tenant data.');
    } finally {
      if (tenantDetailRequestRef.current === controller) {
        tenantDetailRequestRef.current = null;
        setIsTenantDetailLoading(false);
      }
    }
  };

  const handleAuditLog = async (actionTaken: string, targetName: string) => {
    try {
      const adminLogs = await loadPlatformRecord<any[]>('saas_ops_admin_logs', 'global', []);
      const newLog = {
        id: 'log-' + Math.floor(Math.random() * 1000000),
        actionTaken,
        targetUser: targetName,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        adminUsername: '@super_admin_core'
      };
      const updated = [newLog, ...adminLogs];
      await savePlatformRecord('saas_ops_admin_logs', 'global', updated);
      window.dispatchEvent(new Event('saas_logs_updated'));
    } catch (error) {
      console.warn('Admin audit log was not saved:', error);
    }
  };

  // Gates sensitive admin actions on the current session having 2FA (MFA)
  // verified (aal2) -- see verifySuperAdminPassword, which checks session
  // assurance level, not a typed password/key (there is no such input).
  const verifySecureKey = async (): Promise<boolean> => {
    if (isActionLocked) {
      alert(`🔒 Lockout active. Please wait ${lockoutTimeLeft}s before trying again.`);
      return false;
    }

    let verified = false;
    try {
      verified = await verifySuperAdminPassword(secureKeyInput);
    } catch (error: any) {
      alert(error?.message || 'Password verification is temporarily unavailable.');
      return false;
    }
    if (verified) {
      setFailedAttempts(0);
      setSecureKeyInput('');
      return true;
    } else {
      const nextFail = failedAttempts + 1;
      setFailedAttempts(nextFail);
      setSecureKeyInput('');
      
      if (nextFail >= 3) {
        const lockDuration = Date.now() + 10 * 60 * 1000; // 10 minutes lock
        onlineStorage.setItem('saas_admin_lockout_until', lockDuration.toString());
        setIsActionLocked(true);
        setLockoutTimeLeft(600);
        alert('🔒 Too many attempts. Admin actions are locked for 10 minutes. Log in with 2FA verified, then try again.');
      } else {
        alert(`🔒 This action requires two-factor authentication (2FA) on your current session. Log out and back in, completing the 2FA step, then try again. (${3 - nextFail} attempt${3 - nextFail === 1 ? '' : 's'} left before a temporary lockout.)`);
      }
      return false;
    }
  };

  const handleEditFieldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!(await verifySecureKey())) return;

    const updatedUser: UserAccount = {
      ...selectedUser,
      name: editName,
      username: editUsername,
      email: editEmail,
      phone: editPhone,
      subscriptionPlan: editPlan,
      paymentStatus: editPaymentStatus,
      status: editStatus
    };

    setIsSavingProfile(true);
    try {
      await updateSuperAdminUser(selectedUser.id, {
        name: editName,
        email: editEmail,
        phone: editPhone,
        isActive: editStatus === 'Active'
      });
      const updatedUsersList = users.map(u => u.id === selectedUser.id ? updatedUser : u);
      setUsers(updatedUsersList);
      setSelectedUser(updatedUser);
      setIsEditingProfile(false);
      handleAuditLog(`Updated profile fields: name, email, plan to ${editPlan}`, selectedUser.name);
      alert('Tenant profile updated in Supabase.');
    } catch (error: any) {
      alert(error?.message || 'Unable to update tenant user.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSuspendReactivate = async (targetStatus: 'Active' | 'Suspended') => {
    if (!selectedUser) return;
    if (!(await verifySecureKey())) return;

    const updatedUser: UserAccount = {
      ...selectedUser,
      status: targetStatus
    };

    try {
      await updateSuperAdminUser(selectedUser.id, { isActive: targetStatus === 'Active' });
      const updatedUsersList = users.map(u => u.id === selectedUser.id ? updatedUser : u);
      setUsers(updatedUsersList);
      setSelectedUser(updatedUser);
      setEditStatus(targetStatus);
      handleAuditLog(`Changed status code level to ${targetStatus}`, selectedUser.name);
      alert(`User status changed to ${targetStatus}.`);
    } catch (error: any) {
      alert(error?.message || 'Unable to change user status.');
    }
  };

  const handleDeleteUser = async (target: UserAccount | null = selectedUser) => {
    if (!target) return;
    if (!confirm(`Are you absolutely sure you want to permanently erase ${target.name} enterprise nodes from our system?`)) return;

    if (!(await verifySecureKey())) return;

    try {
      await deleteSuperAdminUser(target.id);
      setUsers(users.filter(u => u.id !== target.id));
      handleAuditLog(`Deleted tenant account from nodes`, target.name);
      alert(`Tenant/user deleted from Supabase.`);
      if (selectedUser?.id === target.id) setSelectedUser(null);
      if (actionsMenuUser?.id === target.id) setActionsMenuUser(null);
    } catch (error: any) {
      alert(error?.message || 'Unable to delete this tenant/user.');
    }
  };

  const loadTenantStaff = async (tenantId: string) => {
    setIsLoadingTenantStaff(true);
    try {
      setTenantStaff(await listSuperAdminTenantStaff(tenantId));
    } catch (error: any) {
      alert(error?.message || 'Unable to load this tenant\'s staff.');
      setTenantStaff([]);
    } finally {
      setIsLoadingTenantStaff(false);
    }
  };

  const handleRemoveStaffFromList = async (staff: SuperAdminTenantStaffRow) => {
    if (!selectedUser?.tenantId) return;
    if (!confirm(`Revoke ${staff.name || staff.email}'s login? They will no longer be able to sign in.`)) return;
    if (!(await verifySecureKey())) return;

    setRemovingStaffId(staff.id);
    try {
      await removeSuperAdminTenantStaffLogin(selectedUser.tenantId, staff.email);
      setTenantStaff(prev => prev.filter(item => item.id !== staff.id));
      handleAuditLog(`Removed staff login (${staff.email})`, selectedUser.name);
    } catch (error: any) {
      alert(error?.message || 'Unable to remove that staff login.');
    } finally {
      setRemovingStaffId(null);
    }
  };

  const handleResetStaffPassword = async (staff: SuperAdminTenantStaffRow) => {
    if (!staffPasswordValue.trim()) {
      alert('Please write a new generic password to bind.');
      return;
    }
    if (!(await verifySecureKey())) return;

    setResettingStaffId(staff.id);
    try {
      await resetSuperAdminUserPassword(staff.id, staffPasswordValue);
      handleAuditLog(`Force reset staff auth password (${staff.email})`, selectedUser?.name || staff.name);
      alert(`Password reset completed for ${staff.name || staff.email}.`);
      setResetStaffId(null);
      setStaffPasswordValue('');
    } catch (error: any) {
      alert(error?.message || 'Unable to reset staff password.');
    } finally {
      setResettingStaffId(null);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    if (!newPasswordValue.trim()) {
      alert('Please write a new generic password to bind.');
      return;
    }
    
    if (!(await verifySecureKey())) return;

    try {
      await resetSuperAdminUserPassword(selectedUser.id, newPasswordValue);
      handleAuditLog(`Force reset user auth password`, selectedUser.name);
      alert(`Password reset completed for ${selectedUser.name}.`);
      setNewPasswordValue('');
    } catch (error: any) {
      alert(error?.message || 'Unable to reset password.');
    }
  };

  const handleBusinessTypeChange = async (nextType: 'retail' | 'pharmacy') => {
    if (!selectedUser || selectedUser.businessType === nextType) {
      setIsEditingBusinessType(false);
      return;
    }
    if (!(await verifySecureKey())) return;

    setIsSavingBusinessType(true);
    try {
      await updateSuperAdminUser(selectedUser.id, { businessType: nextType });
      const updatedUser: UserAccount = { ...selectedUser, businessType: nextType };
      const updatedUsersList = users.map(u => u.id === selectedUser.id ? updatedUser : u);
      setUsers(updatedUsersList);
      setSelectedUser(updatedUser);
      setIsEditingBusinessType(false);
      handleAuditLog(`Changed business type to ${nextType}`, selectedUser.name);
      alert(`Business type updated to ${nextType === 'pharmacy' ? 'Pharmacy' : 'Retail & Wholesale'}. The tenant's active session updates automatically.`);
    } catch (error: any) {
      alert(error?.message || 'Unable to update business type.');
    } finally {
      setIsSavingBusinessType(false);
    }
  };

  // Totals calculations
  const totalDirectRevenue = users
    .filter(u => u.referralSource === 'direct')
    .reduce((val, curr) => val + (curr.paymentStatus === 'Paid' ? curr.transactions.reduce((s, t) => s + t.amount, 0) : 0), 0);

  const hasPromoCode = (user: UserAccount) => Boolean((user.promoCodeUsed || user.referringAffiliate || user.referralCodeUsed || '').trim());
  const isOrganicSubscriber = (user: UserAccount) => !hasPromoCode(user);
  const isSubAffiliateSubscriber = (user: UserAccount) => hasPromoCode(user);

  const totalAffiliateRevenue = users
    .filter(isSubAffiliateSubscriber)
    .reduce((val, curr) => val + (curr.paymentStatus === 'Paid' ? curr.transactions.reduce((s, t) => s + t.amount, 0) : 0), 0);

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.tenantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.phone.includes(searchQuery);

    let matchesCategory = true;
    if (categoryFilter === 'organic') matchesCategory = isOrganicSubscriber(u);
    if (categoryFilter === 'sub_affiliate') matchesCategory = isSubAffiliateSubscriber(u);

    return matchesSearch && matchesCategory;
  });
  const subscriberCountUnavailable = Boolean(loadError && !isLoading && users.length === 0);
  const countLabel = (value: number) => subscriberCountUnavailable ? '—' : value;

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => { void loadUsersData(); }}
            className="shrink-0 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 font-bold text-amber-100 transition-colors hover:bg-amber-400/20"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900 px-4 py-3 text-sm text-slate-400">
          Loading live tenants, users, sessions, and workspace data...
        </div>
      )}
      
      {/* Earnings Overview */}
      <div className="revenue-overview-grid gap-3 sm:gap-4">
        <div className="bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-800/80 shadow-sm shadow-black/20">
          <div className="text-slate-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wide">Direct Users Revenue</div>
          <div className="text-base sm:text-lg md:text-xl font-bold text-white font-mono mt-1 tracking-tight">TSh {totalDirectRevenue.toLocaleString()}</div>
          <div className="text-[10px] sm:text-xs text-slate-500 mt-1">
            {users.filter(u => u.referralSource === 'direct').length} direct platform registrations
          </div>
        </div>

        <div className="bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-800/80 shadow-sm shadow-black/20">
          <div className="text-amber-400/90 text-[10px] sm:text-xs font-semibold uppercase tracking-wide">Sub-Affiliate Users Revenue</div>
          <div className="text-base sm:text-lg md:text-xl font-bold text-white font-mono mt-1 tracking-tight">TSh {totalAffiliateRevenue.toLocaleString()}</div>
          <div className="text-[10px] sm:text-xs text-slate-500 mt-1">
            {users.filter(isSubAffiliateSubscriber).length} sub-affiliate promo-code registrations
          </div>
        </div>

        <div className="bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-emerald-800/30 shadow-sm shadow-black/20 col-span-2 lg:col-span-1 flex flex-col justify-center">
          <div className="text-emerald-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wide">Total Operations Revenue</div>
          <div className="text-base sm:text-lg md:text-xl font-bold text-emerald-400 font-mono mt-1 tracking-tight">TSh {(totalDirectRevenue + totalAffiliateRevenue).toLocaleString()}</div>
          <div className="text-[10px] sm:text-xs text-slate-500 mt-1">Live, synchronized from branch pools</div>
        </div>
      </div>

      {/* Main Body Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

        {/* Users Navigation Sidebar — shown below the Hub on mobile/tablet, left column on desktop */}
        <div className="order-2 xl:order-none xl:col-span-4 space-y-4 xl:sticky xl:top-[6.5rem] xl:z-10 xl:self-start">
          <div className="flex flex-col gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800/80">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Registered Subscriber Businesses</span>
            </h3>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search business, owner, email or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-slate-700"
              />
            </div>

            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 flex-wrap gap-1">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`flex-1 min-w-[20%] text-center py-1.5 px-2 text-xs rounded-lg font-medium transition-colors ${categoryFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                All
              </button>
              <button
                onClick={() => setCategoryFilter('organic')}
                className={`flex-1 min-w-[20%] text-center py-1.5 px-2 text-xs rounded-lg font-medium transition-colors ${categoryFilter === 'organic' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Organic
              </button>
              <button
                onClick={() => setCategoryFilter('sub_affiliate')}
                className={`flex-1 min-w-[20%] text-center py-1.5 px-2 text-xs rounded-lg font-medium transition-colors ${categoryFilter === 'sub_affiliate' ? 'bg-slate-800 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Sub-Affiliates
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm shadow-black/20 max-h-[calc(100dvh-220px)] xl:max-h-[380px] overflow-y-auto">
            <div className="px-4 py-2.5 bg-slate-900/80 backdrop-blur border-b border-slate-800/80 text-xs text-slate-500 sticky top-0">
              {filteredUsers.length} matched businesses
            </div>
            {filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">No users match query.</div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {filteredUsers.map(u => {
                  const isSelected = selectedUser?.id === u.id;
                  return (
                    <div
                      key={u.id}
                      onClick={() => { void selectUser(u); }}
                      className={`p-4 transition-colors cursor-pointer hover:bg-slate-800/30 shadow-sm shadow-black/20 ${isSelected ? 'bg-emerald-500/10' : ''}`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <span className="block truncate text-base font-semibold text-white">{u.tenantName}</span>
                          <span translate="no" className="mt-0.5 block truncate text-xs text-slate-400">{u.name}</span>
                          <span className="block truncate text-xs text-slate-600">{u.username || u.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${u.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : u.status === 'Suspended' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {u.status}
                          </span>
                          {isUnlocked && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setActionsMenuUser(u); }}
                              title="Subscriber actions"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
                        <span className="capitalize">{u.referralSource} path</span>
                        {isUnlocked ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMirrorTarget(u);
                              setShowMirrorModal(true);
                              setMirrorPass1('');
                              setMirrorPass2('');
                              setMirrorError('');
                            }}
                            title="Open mirror account"
                            className="text-indigo-300 hover:text-indigo-200 underline decoration-indigo-500/30 underline-offset-2 transition-colors"
                          >
                            {u.dateCreated}
                          </button>
                        ) : (
                          <span>{u.dateCreated}</span>
                        )}
                      </div>
                      {((u as any).lastActivityLabel && (u as any).lastActivityLabel !== 'Never') || ((u as any).location && (u as any).location !== 'Location not provided') ? (
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-600">
                          {(u as any).lastActivityLabel && (u as any).lastActivityLabel !== 'Never' && (
                            <span>Active: {(u as any).lastActivityLabel}</span>
                          )}
                          {(u as any).location && (u as any).location !== 'Location not provided' && (
                            <span className="truncate max-w-[140px]">📍 {(u as any).location}</span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* User Interactive Workspace (Immersive Layout simulation) — Hub shown above the list on mobile/tablet, right column on desktop */}
        <div className="order-1 xl:order-none xl:col-span-8">
          {selectedUser ? (
            <div className="relative overflow-hidden rounded-2xl border border-slate-850 bg-slate-950 shadow-xl">
              <div className={`absolute inset-y-0 left-0 w-1 ${selectedUser.status === 'Active' ? 'bg-emerald-500' : selectedUser.status === 'Suspended' ? 'bg-rose-500' : 'bg-amber-500'}`} />
              {isTenantDetailLoading && (
                <div className="border-b border-indigo-500/20 bg-indigo-500/10 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-indigo-200">
                  Loading selected tenant data…
                </div>
              )}

              {/* Tenant detail header panel */}
              <div className="flex flex-col gap-2.5 border-b border-slate-850 bg-gradient-to-r from-slate-950 to-slate-900 py-3 pl-4 pr-3.5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-extrabold leading-tight text-white">{selectedUser.tenantName}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-500">Subscriber: {selectedUser.name}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${selectedUser.businessType === 'pharmacy' ? 'bg-indigo-500/10 text-indigo-300' : 'bg-slate-800 text-slate-300'}`}>
                      {selectedUser.businessType === 'pharmacy' ? '💊 Pharmacy' : '🛒 Retail & Wholesale'}
                    </span>
                    {isUnlocked && !isEditingBusinessType && (
                      <button
                        onClick={() => setIsEditingBusinessType(true)}
                        className="text-[9px] font-mono uppercase tracking-wider text-indigo-400 hover:text-indigo-300 underline"
                      >
                        Change
                      </button>
                    )}
                  </div>
                  {isUnlocked && isEditingBusinessType && (
                    <div className="flex items-center gap-2 mt-2">
                      {(['retail', 'pharmacy'] as const).map((type) => (
                        <button
                          key={type}
                          disabled={isSavingBusinessType}
                          onClick={() => handleBusinessTypeChange(type)}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider border transition-colors disabled:opacity-50 ${selectedUser.businessType === type ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'}`}
                        >
                          {type === 'pharmacy' ? '💊 Pharmacy' : '🛒 Retail & Wholesale'}
                        </button>
                      ))}
                      <button
                        onClick={() => setIsEditingBusinessType(false)}
                        disabled={isSavingBusinessType}
                        className="text-[9px] font-mono uppercase tracking-wider text-slate-500 hover:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {isUnlocked && (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <input
                        type="password"
                        value={newPasswordValue}
                        onChange={(e) => setNewPasswordValue(e.target.value)}
                        placeholder="New password (10+ chars, letters + numbers)"
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50 w-64"
                      />
                      <button
                        onClick={handleResetPassword}
                        disabled={!newPasswordValue.trim()}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 whitespace-nowrap"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => void handleDeleteUser()}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 whitespace-nowrap"
                      >
                        Delete User
                      </button>
                      {selectedUser.status === 'Active' ? (
                        <button
                          onClick={() => handleSuspendReactivate('Suspended')}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider border border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 whitespace-nowrap"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSuspendReactivate('Active')}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 whitespace-nowrap"
                        >
                          Reactivate
                        </button>
                      )}
                      {!isEditingProfile && (
                        <button
                          onClick={() => {
                            setIsEditingProfile(true);
                            if (selectedUser.tenantId) void loadTenantStaff(selectedUser.tenantId);
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 whitespace-nowrap"
                        >
                          Edit Subscriber
                        </button>
                      )}
                    </div>
                  )}
                  {isUnlocked && isEditingProfile && (
                    <form onSubmit={handleEditFieldSubmit} className="mt-2 p-3 rounded-lg border border-slate-800 bg-slate-900/60 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Name"
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50"
                      />
                      <input
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        placeholder="Username"
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50"
                      />
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="Email"
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50"
                      />
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="Phone"
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50"
                      />
                      <input
                        type="text"
                        value={editPlan}
                        onChange={(e) => setEditPlan(e.target.value)}
                        placeholder="Subscription plan"
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50"
                      />
                      <select
                        value={editPaymentStatus}
                        onChange={(e) => setEditPaymentStatus(e.target.value as UserAccount['paymentStatus'])}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-200 outline-none focus:border-indigo-500/50"
                      >
                        <option value="Paid">Paid</option>
                        <option value="Unpaid">Unpaid</option>
                        <option value="Grace Period">Grace Period</option>
                        <option value="Overdue">Overdue</option>
                      </select>
                      <div className="sm:col-span-2 flex items-center gap-2 mt-1">
                        <button
                          type="submit"
                          disabled={isSavingProfile}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-50 whitespace-nowrap"
                        >
                          {isSavingProfile ? 'Saving…' : 'Save Profile'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingProfile(false)}
                          disabled={isSavingProfile}
                          className="text-[9px] font-mono uppercase tracking-wider text-slate-500 hover:text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                  {isUnlocked && isEditingProfile && (
                    <div className="mt-2 p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                      <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold mb-2">Staff</h4>
                      {isLoadingTenantStaff ? (
                        <p className="text-xs text-slate-500">Loading staff…</p>
                      ) : tenantStaff.length === 0 ? (
                        <p className="text-xs text-slate-500">No staff logins for this business.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {tenantStaff.map(staff => (
                            <div key={staff.id} className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-slate-200 truncate">{staff.name || 'Unnamed staff'}</p>
                                  <p className="text-[10px] font-mono text-slate-500 truncate">{staff.email} · {staff.role || 'Cashier'}</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => { setResetStaffId(resetStaffId === staff.id ? null : staff.id); setStaffPasswordValue(''); }}
                                    className="px-2 py-1 rounded-md text-[9px] font-mono font-bold uppercase tracking-wider border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                                  >
                                    Reset Password
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveStaffFromList(staff)}
                                    disabled={removingStaffId === staff.id}
                                    className="px-2 py-1 rounded-md text-[9px] font-mono font-bold uppercase tracking-wider border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                                  >
                                    {removingStaffId === staff.id ? 'Removing…' : 'Remove'}
                                  </button>
                                </div>
                              </div>
                              {resetStaffId === staff.id && (
                                <div className="mt-2 flex items-center gap-2">
                                  <input
                                    type="password"
                                    value={staffPasswordValue}
                                    onChange={(e) => setStaffPasswordValue(e.target.value)}
                                    placeholder="New password (10+ chars, letters + numbers)"
                                    className="flex-1 px-2.5 py-1.5 rounded-lg text-[10px] font-mono bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleResetStaffPassword(staff)}
                                    disabled={resettingStaffId === staff.id || !staffPasswordValue.trim()}
                                    className="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 whitespace-nowrap"
                                  >
                                    {resettingStaffId === staff.id ? 'Saving…' : 'Save'}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Location + last activity line */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 pt-2.5 border-t border-slate-800/60 text-[10px] font-mono text-slate-500">
                    {(selectedUser as any).location && (selectedUser as any).location !== 'Location not provided' && (
                      <span className="flex items-center gap-1 text-slate-400">
                        📍 {(selectedUser as any).location}
                        {(selectedUser as any).gpsLat && (selectedUser as any).gpsLng && (
                          <a
                            href={`https://maps.google.com/?q=${(selectedUser as any).gpsLat},${(selectedUser as any).gpsLng}`}
                            target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-indigo-400 hover:text-indigo-300 underline ml-1"
                          >Open in Map</a>
                        )}
                      </span>
                    )}
                    {(selectedUser as any).lastActivityLabel && (
                      <span>Last active: {(selectedUser as any).lastActivityLabel}</span>
                    )}
                    {(selectedUser as any).subscriptionEndDate && (
                      <span>Sub ends: {(selectedUser as any).subscriptionEndDate?.slice(0, 10)}</span>
                    )}
                    {(selectedUser as any).promoCodeUsed && (
                      <span>Code: <span className="text-emerald-400">{(selectedUser as any).promoCodeUsed}</span></span>
                    )}
                  </div>
                </div>
                {isUnlocked && onLock && (
                  <button 
                    onClick={onLock}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition-colors flex items-center space-x-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Return to Read-Only Mode</span>
                  </button>
                )}
              </div>

              <div className="border-b border-slate-900 bg-slate-950 px-4 py-2.5">
                <span className="text-xs font-mono uppercase tracking-tight text-emerald-400 font-black">User Data</span>
              </div>

              <div className="p-4 bg-slate-950/60">
                {/* User Business Data Intercept panels */}
                {immersiveTab === 'business' && (
                  <div className="space-y-5 animate-fade-in text-left">
                    
                    {/* Inner workspace tab selectors */}
                    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-850 flex-wrap gap-1">
                      {[
                        { id: 'messages', label: 'Active Chats' },
                        { id: 'billing', label: 'Subscription History' },
                        { id: 'hardware', label: 'Hardware' }
                      ].map(p => (
                        <button
                          key={p.id}
                          onClick={() => setBizSubTab(p.id as 'messages' | 'billing' | 'hardware')}
                          className={`px-3 py-1.5 text-[10px] font-mono rounded-md uppercase tracking-tighter ${bizSubTab === p.id ? 'bg-slate-950 text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl">
                      {/* SUB-TAB: Message streams */}
                      {bizSubTab === 'messages' && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-mono uppercase text-emerald-400 font-black">Direct System Support Interactions</h4>
                          <div className="space-y-2">
                            {selectedUser.messages.map((m, idx) => (
                              <div key={idx} className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 font-mono text-[11px]">
                                <div className="flex justify-between border-b border-slate-900 pb-1 text-[9px] text-slate-500">
                                  <span>FROM: {m.sender}</span>
                                  <span>{m.timestamp}</span>
                                </div>
                                <p className="text-slate-200 mt-1.5">{m.body}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* SUB-TAB: Billing invoice tracking */}
                      {bizSubTab === 'billing' && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-mono uppercase text-emerald-400 font-black">All Subscription History Invoices</h4>
                          <div className="bg-slate-950 rounded-lg overflow-hidden border border-slate-850">
                            <table className="w-full text-left text-xs text-slate-300 font-mono">
                              <thead className="bg-slate-900 text-[10px] uppercase text-slate-500">
                                <tr>
                                  <th className="p-2">Invoice No</th>
                                  <th className="p-2">Date Billing</th>
                                  <th className="p-2">Amount Paid</th>
                                  <th className="p-2">Gateway Mode</th>
                                  <th className="p-2 text-right">Condition</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-900">
                                {selectedUser.paymentHistory.map((h, i) => (
                                  <tr key={i} className="hover:bg-slate-850/10">
                                    <td className="p-2 text-white font-bold">{h.invoiceNo}</td>
                                    <td className="p-2 text-[10px] text-slate-400">{h.date}</td>
                                    <td className="p-2 text-emerald-400 font-bold">TSh {h.amount.toLocaleString()}</td>
                                    <td className="p-2 text-slate-500">{h.method}</td>
                                    <td className="p-2 text-right">
                                      <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[9px] font-bold">
                                        {h.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* SUB-TAB: Hardware devices */}
                      {bizSubTab === 'hardware' && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-mono uppercase text-emerald-400 font-black">Purchased Hardware Devices</h4>
                          <div className="bg-slate-950 rounded-lg overflow-hidden border border-slate-850 p-3">
                            {(() => {
                              const userPurchases: any[] =
                                hardwarePurchasesBySubscriber[selectedUser.name] ||
                                hardwarePurchasesBySubscriber[selectedUser.id] ||
                                [];

                              if (!userPurchases || userPurchases.length === 0) {
                                return <div className="text-center text-slate-500 text-xs py-4">No hardware devices purchased.</div>;
                              }

                              return (
                                <div className="space-y-3">
                                  {userPurchases.map((sale: any, idx: number) => (
                                    <div key={idx} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                                      <div className="flex justify-between items-center border-b border-slate-850 pb-2 mb-2 text-[10px] text-slate-400 font-mono">
                                        <span>Receipt: <span translate="no" className="text-indigo-400">{sale.receiptNo}</span></span>
                                        <span>Date: {new Date(sale.date).toLocaleDateString()}</span>
                                      </div>
                                      <div className="space-y-2">
                                        {sale.items.map((it: any, i: number) => (
                                          <div key={i} className="flex justify-between text-xs text-white">
                                            <span className="font-bold">{it.qty}x {it.name}</span>
                                            <span className="text-emerald-400 font-mono">{(it.price * it.qty).toLocaleString()}</span>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="mt-2 pt-2 border-t border-slate-850 flex justify-end text-sm font-bold text-emerald-400 font-mono">
                                        Total: {sale.total.toLocaleString()} TZS
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}

              </div>

            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 sm:p-5 xl:p-12 overflow-hidden min-h-0 xl:min-h-[460px] flex flex-col items-center justify-center text-center shadow-sm shadow-black/20 animate-in fade-in fill-mode-forwards duration-300">
              <div className="w-10 h-10 xl:w-16 xl:h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-2 xl:mb-6 flex-shrink-0">
                <Users className="w-5 h-5 xl:w-8 xl:h-8 text-emerald-400" />
              </div>
              <h2 className="text-base xl:text-xl font-semibold text-white mb-4 xl:mb-10 tracking-tight">Global Subscriber</h2>

              <div className="global-subscriber-stat-grid gap-1.5 sm:gap-4 xl:gap-8 w-full max-w-3xl border-t border-slate-800/80 pt-3 xl:pt-10">
                <div className="flex flex-col gap-0.5 xl:gap-1.5 items-center">
                  <span className="text-sm sm:text-base xl:text-3xl font-mono font-bold text-slate-200">{countLabel(users.length)}</span>
                  <span className="text-[9px] sm:text-[10px] xl:text-xs text-slate-400">Total Subscribers</span>
                </div>
                <div className="flex flex-col gap-0.5 xl:gap-1.5 items-center">
                  <span className="text-sm sm:text-base xl:text-3xl font-mono font-bold text-emerald-400">{countLabel(users.filter(u => u.status === 'Active').length)}</span>
                  <span className="text-[9px] sm:text-[10px] xl:text-xs text-slate-400">Active</span>
                </div>
                <div className="flex flex-col gap-0.5 xl:gap-1.5 items-center">
                  <span className="text-sm sm:text-base xl:text-3xl font-mono font-bold text-rose-400">{countLabel(users.filter(u => u.status === 'Suspended').length)}</span>
                  <span className="text-[9px] sm:text-[10px] xl:text-xs text-slate-400">Suspended</span>
                </div>
                <div className="flex flex-col gap-0.5 xl:gap-1.5 items-center">
                  <span className="text-sm sm:text-base xl:text-3xl font-mono font-bold text-amber-400">{countLabel(users.filter(u => u.paymentStatus === 'Overdue').length)}</span>
                  <span className="text-[9px] sm:text-[10px] xl:text-xs text-slate-400">Overdue</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {actionsMenuUser && (
        <>
          <div
            onClick={() => setActionsMenuUser(null)}
            className="fixed inset-0 z-[150] bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
          />
          <div className="fixed left-0 right-0 bottom-0 z-[160] mx-auto w-full max-w-lg rounded-t-3xl border border-slate-800 bg-slate-900 shadow-2xl animate-in slide-in-from-bottom-10 duration-200">
            <div className="flex justify-center pt-2.5">
              <div className="h-1 w-10 rounded-full bg-slate-700" />
            </div>
            <div className="px-5 pb-1 pt-3">
              <h3 className="text-sm font-bold text-white truncate">{actionsMenuUser.tenantName}</h3>
              <p className="text-xs text-slate-500 truncate">{actionsMenuUser.name} · {actionsMenuUser.email}</p>
            </div>
            <div className="p-4 space-y-2">
              <button
                type="button"
                onClick={() => { void selectUser(actionsMenuUser); setActionsMenuUser(null); }}
                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-3 text-left transition-colors hover:bg-slate-800/60"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-white">View Subscriber</span>
                    <span className="block text-[10px] text-slate-500">Open their full workspace</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>

              <button
                type="button"
                onClick={() => { setLocationModalUser(actionsMenuUser); setActionsMenuUser(null); }}
                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-3 text-left transition-colors hover:bg-slate-800/60"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-white">Subscriber Location</span>
                    <span className="block text-[10px] text-slate-500">Where this business is registered</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = actionsMenuUser;
                  void selectUser(target);
                  setIsEditingProfile(true);
                  if (target.tenantId) void loadTenantStaff(target.tenantId);
                  setActionsMenuUser(null);
                }}
                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-3 text-left transition-colors hover:bg-slate-800/60"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-white">Edit Subscriber</span>
                    <span className="block text-[10px] text-slate-500">Niche, profile, and staff logins</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>

              <button
                type="button"
                onClick={() => { const target = actionsMenuUser; void handleDeleteUser(target); }}
                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-rose-900/40 bg-rose-500/5 px-3.5 py-3 text-left transition-colors hover:bg-rose-500/10"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-rose-300">Delete Subscriber</span>
                    <span className="block text-[10px] text-rose-500/70">Permanently erase this business</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-rose-700" />
              </button>
            </div>
            <div className="h-[env(safe-area-inset-bottom)]" />
          </div>
        </>
      )}

      {locationModalUser && (
        <div
          onClick={() => setLocationModalUser(null)}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-150"
        >
          <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Subscriber Location</h3>
              <button type="button" onClick={() => setLocationModalUser(null)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-300">{(locationModalUser as any).location && (locationModalUser as any).location !== 'Location not provided' ? (locationModalUser as any).location : 'No location on record for this business.'}</p>
              {(locationModalUser as any).gpsLat && (locationModalUser as any).gpsLng && (
                <a
                  href={`https://maps.google.com/?q=${(locationModalUser as any).gpsLat},${(locationModalUser as any).gpsLng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                >
                  <MapPin className="w-3.5 h-3.5" /> Open in Google Maps
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {showMirrorModal && mirrorTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-indigo-600/20 px-6 py-4 border-b border-indigo-500/20 flex flex-col items-center justify-center py-6 text-center">
              <div className="w-12 h-12 bg-indigo-500/30 rounded-full flex items-center justify-center mb-3">
                <AppWindow className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-white font-bold text-lg font-sans">Mirror Gateway Authorization</h3>
              <p className="text-xs text-indigo-300 mt-1">Target Account: <span translate="no" className="font-mono text-white">{mirrorTarget.name}</span></p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Security Check 1 (Master PIN)</label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={mirrorPass1}
                    onChange={e => setMirrorPass1(e.target.value)}
                    placeholder="Enter Level 1 PIN"
                    className="w-full bg-slate-950 border border-slate-700 text-white text-sm pl-9 pr-3 py-2 rounded-lg focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Security Check 2 (Admin Override)</label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={mirrorPass2}
                    onChange={e => setMirrorPass2(e.target.value)}
                    placeholder="Enter Level 2 Code"
                    className="w-full bg-slate-950 border border-slate-700 text-white text-sm pl-9 pr-3 py-2 rounded-lg focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>
              {mirrorError && (
                <div className="text-[10px] text-red-400 font-mono text-center pt-2 animate-bounce">
                  {mirrorError}
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end space-x-3">
              <button 
                onClick={() => {
                  setShowMirrorModal(false);
                  setMirrorTarget(null);
                }}
                className="px-4 py-2 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Abort
              </button>
              <button 
                onClick={() => {
                  if (mirrorPass1 === '1472' && mirrorPass2 === '2583') {
                    window.dispatchEvent(new CustomEvent('saas_enter_mirror', { detail: { account: mirrorTarget, isAffiliate: false } }));
                    setShowMirrorModal(false);
                  } else {
                    setMirrorError('AUTHORIZATION FAILED. ACCESS DENIED.');
                  }
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-transform hover:scale-105 cursor-pointer flex items-center space-x-2"
              >
                <span>Authorize & Connect</span>
                <ArrowLeft className="w-3.5 h-3.5 transform rotate-180" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
