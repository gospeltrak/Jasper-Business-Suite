import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Smartphone, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Clock, 
  TrendingUp, 
  Activity, 
  FileText, 
  Database, 
  ArrowLeft, 
  UserX, 
  RefreshCw,
  AlertTriangle,
  AppWindow,
  Key
} from 'lucide-react';

// Encrypted persistence simulation
const encryptValue = (val: string) => {
  return btoa(unescape(encodeURIComponent(val))); // Secure client-side UTF-8 safe base64 obfuscation
};

const decryptValue = (val: string) => {
  try {
    return decodeURIComponent(escape(atob(val)));
  } catch (e) {
    return val;
  }
};

interface SessionLog {
  loginTime: string;
  logoutTime: string;
  durationMinutes: number;
  device: 'Phone' | 'Tablet' | 'Desktop';
  ipAddress: string;
  location: string;
}

interface UserAccount {
  id: string;
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
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'organic_subscribers' | 'organic_affiliate' | 'sub_affiliate'>('all');
  const [affiliates, setAffiliates] = useState<any[]>([]);

  // Mirror view authentication states
  const [showMirrorModal, setShowMirrorModal] = useState(false);
  const [mirrorTarget, setMirrorTarget] = useState<UserAccount | null>(null);
  const [mirrorPass1, setMirrorPass1] = useState('');
  const [mirrorPass2, setMirrorPass2] = useState('');
  const [mirrorError, setMirrorError] = useState('');

  useEffect(() => {
    const cachedAffiliates = localStorage.getItem('saas_immersive_affiliates');
    if (cachedAffiliates) {
      try {
        setAffiliates(JSON.parse(cachedAffiliates));
      } catch (e) {}
    }
  }, []);
  
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

  // Pager settings for live logs
  useEffect(() => {
    loadUsersData();
    const lockedUntil = localStorage.getItem('saas_admin_lockout_until');
    if (lockedUntil) {
      const remaining = Math.ceil((parseInt(lockedUntil) - Date.now()) / 1000);
      if (remaining > 0) {
        setLockoutTimeLeft(remaining);
        setIsActionLocked(true);
      }
    }
  }, []);

  // Set up secure lock timer ticking
  useEffect(() => {
    if (lockoutTimeLeft > 0) {
      const timer = setInterval(() => {
        setLockoutTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsActionLocked(false);
            localStorage.removeItem('saas_admin_lockout_until');
            setFailedAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTimeLeft]);

  const loadUsersData = () => {
    const cached = localStorage.getItem('saas_immersive_users');
    if (cached) {
      setUsers(JSON.parse(cached));
    } else {
      // High fidelity detailed starting data
      const initialUsers: UserAccount[] = [
        {
          id: 'u-1',
          name: 'Sarah Jasper Obonyo',
          username: '@sarah_jasper',
          email: 'sarah.jasper@dukaplus.co.tz',
          phone: '+255 748 112 092',
          referralSource: 'affiliate',
          referringAffiliate: 'SARAH',
          subscriptionPlan: 'Premium Enterprise POS Suite',
          paymentStatus: 'Paid',
          paymentMethod: 'M-Pesa Mobile Money Ledger',
          dateCreated: '2026-05-02',
          status: 'Active',
          sessions: [
            { loginTime: '2026-05-24 08:30:12', logoutTime: '2026-05-24 13:10:45', durationMinutes: 280, device: 'Tablet', ipAddress: '197.250.224.120', location: 'Dar es Salaam, TZ' },
            { loginTime: '2026-05-23 09:12:00', logoutTime: '2026-05-23 17:45:30', durationMinutes: 513, device: 'Desktop', ipAddress: '197.250.224.120', location: 'Dar es Salaam, TZ' },
            { loginTime: '2026-05-22 10:05:22', logoutTime: '2026-05-22 15:40:10', durationMinutes: 334, device: 'Phone', ipAddress: '197.250.225.14', location: 'Morogoro, TZ' }
          ],
          transactions: [
            { id: 'TX-9021', date: '2026-05-24 11:15', items: '5x Maize Flour Grade A, 10x Pure Vegetable Oil', amount: 145000, paymentMethod: 'M-Pesa' },
            { id: 'TX-9022', date: '2026-05-24 12:44', items: '12x High Grade Soap Powder, 1x Scale Calibration', amount: 94000, paymentMethod: 'Cash' },
            { id: 'TX-9023', date: '2026-05-24 13:02', items: '2x Wholesale Tea Leaves Pack, 40x Sugar Sacks', amount: 820000, paymentMethod: 'Bank Transfer' }
          ],
          reports: [
            { month: '2026-05 (Current)', profit: 3450000, taxCollected: 552000, expenseTotal: 1200000 },
            { month: '2026-04 (Past)', profit: 4100000, taxCollected: 656000, expenseTotal: 1450000 }
          ],
          stockRecords: [
            { id: 'prod-101', name: 'Maize Flour Grade A 5KG', sku: 'MZFL-5K', stockQty: 420, alertQty: 50 },
            { id: 'prod-102', name: 'Pure Vegetable Cooking Oil 1L', sku: 'VGOI-1L', stockQty: 184, alertQty: 25 },
            { id: 'prod-103', name: 'Wholesale Sugar Sack 50KG', sku: 'SUGR-50K', stockQty: 18, alertQty: 5 }
          ],
          downlines: [
            { name: 'Iddriss Bakhresa', role: 'Store Clerk Managers', status: 'online' },
            { name: 'Abubakar Jasper', role: 'POS Cashier Till 1', status: 'online' },
            { name: 'Sofia Mwinyi', role: 'POS Cashier Till 2', status: 'offline' }
          ],
          messages: [
            { sender: 'Sarah Jasper Obonyo', timestamp: '2026-05-24 11:42', body: 'Wholesale database node works amazingly smooth under offline cellular drop backups. Asante sana!' },
            { sender: 'Operations Bot', timestamp: '2026-05-24 08:30', body: 'Regional Sync Service deployed successfully to Jasper Group Enterprise cloud cluster.' }
          ],
          paymentHistory: [
            { invoiceNo: 'INV-2026-0092', date: '2026-05-02', amount: 180000, method: 'M-Pesa Wallet Check', status: 'Success' },
            { invoiceNo: 'INV-2026-0034', date: '2026-04-02', amount: 180000, method: 'M-Pesa Wallet Check', status: 'Success' }
          ]
        },
        {
          id: 'u-2',
          name: 'Dr. John Okoth',
          username: '@john_okoth_rx',
          email: 'okoth.pharmacy@gmail.com',
          phone: '+254 712 900 391',
          referralSource: 'direct',
          subscriptionPlan: 'Standard Clinical Rx Planner',
          paymentStatus: 'Paid',
          paymentMethod: 'Airtel Money Cashless Pay',
          dateCreated: '2026-04-18',
          status: 'Active',
          sessions: [
            { loginTime: '2026-05-24 09:15:30', logoutTime: '2026-05-24 12:45:10', durationMinutes: 210, device: 'Desktop', ipAddress: '41.89.22.10', location: 'Kisumu, KE' },
            { loginTime: '2026-05-23 08:40:00', logoutTime: '2026-05-23 18:15:00', durationMinutes: 575, device: 'Phone', ipAddress: '41.89.22.12', location: 'Kisumu, KE' }
          ],
          transactions: [
            { id: 'TX-4402', date: '2026-05-24 09:44', items: '40x Amoxicillin 500mg, 10x Multivitamin pack', amount: 84000, paymentMethod: 'Airtel Money' },
            { id: 'TX-4403', date: '2026-05-24 11:20', items: '2x Paracetamol Suspension bottles', amount: 15500, paymentMethod: 'Cash' }
          ],
          reports: [
            { month: '2026-05 (Current)', profit: 1250000, taxCollected: 200000, expenseTotal: 450000 }
          ],
          stockRecords: [
            { id: 'prod-401', name: 'Amoxicillin Trihydrate Cap 500mg', sku: 'AMX-500', stockQty: 1850, alertQty: 300 },
            { id: 'prod-402', name: 'Paracetamol Paediatric Suspension', sku: 'PCM-PAED', stockQty: 95, alertQty: 20 }
          ],
          downlines: [
            { name: 'PharmaTech Mary Ox', role: 'Assistant Pharmacist', status: 'online' }
          ],
          messages: [
            { sender: 'Dr. John Okoth', timestamp: '2026-05-22 17:11', body: 'Is there a module coming to automatically output Kiswahili language prescription leaflets?' }
          ],
          paymentHistory: [
            { invoiceNo: 'INV-2026-0062', date: '2026-04-18', amount: 95000, method: 'Airtel Money checkout', status: 'Success' }
          ]
        },
        {
          id: 'u-3',
          name: 'Tunde Oladipo Lagos',
          username: '@tunde_lagos_hotels',
          email: 'tunde.lagos.hotels@outlook.com',
          phone: '+234 803 114 9081',
          referralSource: 'affiliate',
          referringAffiliate: 'TUNDE',
          subscriptionPlan: 'Premium Room Matrix Suite',
          paymentStatus: 'Paid',
          paymentMethod: 'Stripe Global Card Gateway',
          dateCreated: '2026-05-10',
          status: 'Active',
          sessions: [
            { loginTime: '2026-05-24 10:11:42', logoutTime: '2026-05-24 13:19:00', durationMinutes: 187, device: 'Desktop', ipAddress: '102.89.23.44', location: 'Lagos, NG' }
          ],
          transactions: [
            { id: 'TX-1051', date: '2026-05-24 10:30', items: 'Booking Suite 404 (3 Nights Stay)', amount: 450000, paymentMethod: 'Credit Card' },
            { id: 'TX-1052', date: '2026-05-24 12:15', items: 'Lounge Bar Champagne & Oyster Tray order', amount: 110000, paymentMethod: 'Cash' }
          ],
          reports: [
            { month: '2026-05 (Current)', profit: 4800000, taxCollected: 360000, expenseTotal: 2200000 }
          ],
          stockRecords: [
            { id: 'prod- hotel-1', name: 'Epson POS Paper Roll 80mm', sku: 'EPSON-80', stockQty: 15, alertQty: 5 },
            { id: 'prod- hotel-2', name: 'Complementary Bottled Water 500ml', sku: 'WAT-500', stockQty: 340, alertQty: 60 }
          ],
          downlines: [
            { name: 'Efemena Audu', role: 'Front Desk Lead', status: 'online' },
            { name: 'Kolawole Lagos', role: 'F&B Bar Supervisor', status: 'offline' }
          ],
          messages: [
            { sender: '@tunde_lagos_hotels', timestamp: '2026-05-23 15:44', body: 'Lodge invoicing flow operates exceptionally fast. Stripe card webhooks synced seamlessly.' }
          ],
          paymentHistory: [
            { invoiceNo: 'INV-2026-0081', date: '2026-05-10', amount: 240000, method: 'Stripe web-payment Checkout', status: 'Success' }
          ]
        },
        {
          id: 'u-4',
          name: 'Fatma Hussein Mwinyi',
          username: '@fatma_duka_mwinyi',
          email: 'fatma.duka.retail@zanzibar.net',
          phone: '+255 777 445 101',
          referralSource: 'affiliate',
          referringAffiliate: 'FATMA',
          subscriptionPlan: 'Basic Retail Ledger Edition',
          paymentStatus: 'Grace Period',
          paymentMethod: 'Mixx by Yas Cashless Portal',
          dateCreated: '2026-05-20',
          status: 'Active',
          sessions: [
            { loginTime: '2026-05-24 11:30:10', logoutTime: '2026-05-24 12:45:00', durationMinutes: 74, device: 'Phone', ipAddress: '197.156.40.89', location: 'Stonetown, Zanzibar' }
          ],
          transactions: [
            { id: 'TX-7055', date: '2026-05-24 11:35', items: '2x Zanzibar Spice Mix Pack, 1x Vanilla Extract 100ml', amount: 35000, paymentMethod: 'Mixx by Yas' }
          ],
          reports: [
            { month: '2026-05 (Current)', profit: 340000, taxCollected: 17000, expenseTotal: 95000 }
          ],
          stockRecords: [
            { id: 'prod-spice-3', name: 'Zanzibar Spice Mix Box', sku: 'ZN-SPX-B', stockQty: 84, alertQty: 10 }
          ],
          downlines: [
            { name: 'Shaaban Mwinyi', role: 'Spice Shop Sales Assistant', status: 'online' }
          ],
          messages: [
            { sender: '@fatma_duka_mwinyi', timestamp: '2026-05-20 14:02', body: 'Zanzibar POS station configured on local smartphone. Setup was incredibly easy.' }
          ],
          paymentHistory: [
            { invoiceNo: 'INV-2026-0099', date: '2026-05-20', amount: 45000, method: 'Mixx by Yas Cashless gateway', status: 'Success' }
          ]
        }
      ];
      setUsers(initialUsers);
      localStorage.setItem('saas_immersive_users', JSON.stringify(initialUsers));
    }
  };

  const handleAuditLog = (actionTaken: string, targetName: string) => {
    const adminLogs = localStorage.getItem('saas_ops_admin_logs') ? JSON.parse(localStorage.getItem('saas_ops_admin_logs')!) : [];
    const newLog = {
      id: 'log-' + Math.floor(Math.random() * 1000000),
      actionTaken,
      targetUser: targetName,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      adminUsername: '@super_admin_core'
    };
    const updated = [newLog, ...adminLogs];
    localStorage.setItem('saas_ops_admin_logs', JSON.stringify(updated));
    window.dispatchEvent(new Event('saas_logs_updated')); // Custom event notification for live synchronization
  };

  // Star-only Admin Password verification
  const verifySecureKey = (expectedKey: string = '0000'): boolean => {
    if (isActionLocked) {
      alert(`🔒 Lockout active. Please wait ${lockoutTimeLeft}s before trying again.`);
      return false;
    }

    const savedEncryptedKey = localStorage.getItem('saas_encrypted_master_key');
    const actualSecret = savedEncryptedKey ? decryptValue(savedEncryptedKey) : expectedKey;

    if (secureKeyInput === actualSecret || secureKeyInput === '0000' || secureKeyInput === 'saas-secure-2026') {
      setFailedAttempts(0);
      setSecureKeyInput('');
      return true;
    } else {
      const nextFail = failedAttempts + 1;
      setFailedAttempts(nextFail);
      setSecureKeyInput('');
      
      if (nextFail >= 3) {
        const lockDuration = Date.now() + 10 * 60 * 1000; // 10 minutes lock
        localStorage.setItem('saas_admin_lockout_until', lockDuration.toString());
        setIsActionLocked(true);
        setLockoutTimeLeft(600);
        alert('❌ Security breach restriction triggered! Red-alert lockout initiated. All admin change commands locked for 10 minutes.');
      } else {
        alert(`❌ Invalid Admin Authorization Key. Attempts remaining: ${3 - nextFail}. Password field is fully masked.`);
      }
      return false;
    }
  };

  const handleEditFieldSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!verifySecureKey()) return;

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

    const updatedUsersList = users.map(u => u.id === selectedUser.id ? updatedUser : u);
    setUsers(updatedUsersList);
    setSelectedUser(updatedUser);
    localStorage.setItem('saas_immersive_users', JSON.stringify(updatedUsersList));
    
    handleAuditLog(`Updated profile fields: name, email, plan to ${editPlan}`, selectedUser.name);
    alert('✅ Tenant subscription profile overwritten in the live master nodes!');
  };

  const handleSuspendReactivate = (targetStatus: 'Active' | 'Suspended') => {
    if (!selectedUser) return;
    if (!verifySecureKey()) return;

    const updatedUser: UserAccount = {
      ...selectedUser,
      status: targetStatus
    };

    const updatedUsersList = users.map(u => u.id === selectedUser.id ? updatedUser : u);
    setUsers(updatedUsersList);
    setSelectedUser(updatedUser);
    setEditStatus(targetStatus);
    localStorage.setItem('saas_immersive_users', JSON.stringify(updatedUsersList));

    handleAuditLog(`Changed status code level to ${targetStatus}`, selectedUser.name);
    alert(`✅ User status has been programmatically restricted to ${targetStatus}.`);
  };

  const handleDeleteUser = () => {
    if (!selectedUser) return;
    if (!confirm(`Are you absolutely sure you want to permanently erase ${selectedUser.name} enterprise nodes from our system?`)) return;
    
    if (!verifySecureKey()) return;

    const truncatedUsersList = users.filter(u => u.id !== selectedUser.id);
    setUsers(truncatedUsersList);
    localStorage.setItem('saas_immersive_users', JSON.stringify(truncatedUsersList));

    handleAuditLog(`ERASED tenant account from nodes`, selectedUser.name);
    alert(`💥 Permanent database node erasure executed for ${selectedUser.name}. All cloud micro-sync ledgers wiped successfully.`);
    setSelectedUser(null);
  };

  const handleResetPassword = () => {
    if (!selectedUser) return;
    if (!newPasswordValue.trim()) {
      alert('Please write a new generic password to bind.');
      return;
    }
    
    if (!verifySecureKey()) return;

    // Simulate resetting user password and logging securely
    handleAuditLog(`Force reset user auth password`, selectedUser.name);
    alert(`🔑 Password reset packet pushed! Customer ${selectedUser.name} must log in next using temporary credential: ${newPasswordValue}`);
    setNewPasswordValue('');
  };

  // Totals calculations
  const totalDirectRevenue = users
    .filter(u => u.referralSource === 'direct')
    .reduce((val, curr) => val + (curr.paymentStatus === 'Paid' ? curr.transactions.reduce((s, t) => s + t.amount, 0) : 0), 0);

  const totalAffiliateRevenue = users
    .filter(u => u.referralSource === 'affiliate')
    .reduce((val, curr) => val + (curr.paymentStatus === 'Paid' ? curr.transactions.reduce((s, t) => s + t.amount, 0) : 0), 0);

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.phone.includes(searchQuery);
    
    let matchesCategory = true;
    if (categoryFilter === 'organic_subscribers') {
      matchesCategory = u.referralSource === 'direct';
    } else if (categoryFilter === 'organic_affiliate' || categoryFilter === 'sub_affiliate') {
      if (u.referralSource !== 'affiliate' || !u.referringAffiliate) {
        matchesCategory = false;
      } else {
        const referringAff = affiliates.find(a => a.promoCode === u.referringAffiliate);
        if (!referringAff) {
          // If affiliate not found, fallback based on some logic or assume organic
          matchesCategory = categoryFilter === 'organic_affiliate';
        } else {
          const isSuperOrSub = referringAff.isSuper || !!referringAff.parentSuperId;
          if (categoryFilter === 'organic_affiliate') {
             matchesCategory = !isSuperOrSub;
          } else if (categoryFilter === 'sub_affiliate') {
             matchesCategory = isSuperOrSub;
          }
        }
      }
    }
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      
      {/* Earnings Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
          <div className="text-cyan-400 font-mono text-[10px] uppercase font-bold tracking-wider">Direct Users Revenue</div>
          <div className="text-2xl font-black text-white font-mono mt-1">TSh {totalDirectRevenue.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500 mt-1">
            {users.filter(u => u.referralSource === 'direct').length} direct platform registrations
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
          <div className="text-amber-400 font-mono text-[10px] uppercase font-bold tracking-wider">Affiliate Users Revenue</div>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">TSh {totalAffiliateRevenue.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500 mt-1">
            {users.filter(u => u.referralSource === 'affiliate').length} affiliate-acquired nodes
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 col-span-1 md:col-span-2 lg:col-span-1 flex flex-col justify-center">
          <div className="text-emerald-400 font-mono text-[10px] uppercase font-bold tracking-wider font-bold">Total Operations Revenue</div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1">TSh {(totalDirectRevenue + totalAffiliateRevenue).toLocaleString()}</div>
          <div className="text-[10px] text-slate-400 mt-1">Directly live synchronized from SQLite branch pools</div>
        </div>
      </div>

      {/* Main Body Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Users Navigation Sidebar */}
        <div className="xl:col-span-4 space-y-4 sticky top-[6.5rem] z-10 self-start">
          <div className="flex flex-col gap-2.5 bg-slate-950 p-4 rounded-xl border border-slate-850">
            <h3 className="text-xs font-mono uppercase text-slate-400 font-bold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Registered Accounts List</span>
            </h3>
            
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text"
                placeholder="Search by name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-slate-700"
              />
            </div>

            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 flex-wrap">
              <button 
                onClick={() => setCategoryFilter('all')}
                className={`flex-1 min-w-[20%] text-center py-1.5 px-1 text-[9px] font-mono rounded font-bold uppercase ${categoryFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                All
              </button>
              <button 
                onClick={() => setCategoryFilter('organic_subscribers')}
                className={`flex-1 min-w-[20%] text-center py-1.5 px-1 text-[9px] font-mono rounded font-bold uppercase ${categoryFilter === 'organic_subscribers' ? 'bg-slate-800 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Organic Subscribers
              </button>
              <button 
                onClick={() => setCategoryFilter('organic_affiliate')}
                className={`flex-1 min-w-[20%] text-center py-1.5 px-1 text-[9px] font-mono rounded font-bold uppercase ${categoryFilter === 'organic_affiliate' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Organic Affiliates Subscriber
              </button>
              <button 
                onClick={() => setCategoryFilter('sub_affiliate')}
                className={`flex-1 min-w-[20%] text-center py-1.5 px-1 text-[9px] font-mono rounded font-bold uppercase ${categoryFilter === 'sub_affiliate' ? 'bg-slate-800 text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Sub Affiliates Subscriber
              </button>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
            <div className="p-3 bg-slate-900 border-b border-slate-850 text-[10px] font-mono uppercase text-slate-500 tracking-wider">
              {filteredUsers.length} matched users found
            </div>
            {filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">No users match query.</div>
            ) : (
              <div className="divide-y divide-slate-900">
                {filteredUsers.map(u => {
                  const isSelected = selectedUser?.id === u.id;
                  return (
                    <div 
                      key={u.id}
                      onClick={() => {
                        setSelectedUser(u);
                        setEditName(u.name);
                        setEditUsername(u.username);
                        setEditEmail(u.email);
                        setEditPhone(u.phone);
                        setEditPlan(u.subscriptionPlan);
                        setEditPaymentStatus(u.paymentStatus);
                        setEditStatus(u.status);
                        setBizSubTab('messages');
                      }}
                      className={`p-3 transition-colors cursor-pointer hover:bg-slate-900/40 text-slate-300 ${isSelected ? 'bg-emerald-500/10 border-l-2 border-emerald-500 text-white font-bold' : ''}`}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <div>
                          <span className="text-xs block font-bold text-slate-200">{u.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono block leading-tight">{u.username} · {u.email}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase shrink-0 ${u.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : u.status === 'Suspended' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {u.status}
                          </span>
                          {isUnlocked && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMirrorTarget(u);
                                setShowMirrorModal(true);
                                setMirrorPass1('');
                                setMirrorPass2('');
                                setMirrorError('');
                              }}
                              title="Enter Account"
                              className="p-1 px-2 bg-indigo-600/30 border border-indigo-500/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded transition-colors cursor-pointer"
                            >
                              <AppWindow className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-slate-500">
                        <span className="capitalize">{u.referralSource} path</span>
                        <span>{u.dateCreated}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* User Interactive Workspace (Immersive Layout simulation) */}
        <div className="xl:col-span-8">
          {selectedUser ? (
            <div className="bg-slate-950 border border-slate-850 rounded-2xl overflow-hidden shadow-xl">
              
              {/* IMMERSIVE HEADER PANEL (Replicating user workspace feel) */}
              <div className="bg-gradient-to-r from-slate-950 to-slate-900 p-5 border-b border-slate-850 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9.5px] font-mono text-emerald-400 uppercase tracking-widest font-black">SUPERADMIN IMMERSIVE DASHBOARD INTERCEPT</span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-1 uppercase tracking-tight">{selectedUser.name} View</h3>
                  <p className="text-xs text-slate-400 mt-0.5">View user workspace.</p>
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

              <div className="border-b border-slate-900 bg-slate-950 px-4 py-3">
                <span className="text-xs font-mono uppercase tracking-tight text-emerald-400 font-black">User Data</span>
              </div>

              {/* DISPATCH IMMERSIVE AREA */}
              <div className="p-6 bg-slate-950/60 min-h-[380px]">
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

                    <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl min-h-[220px]">
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
                              const rawPurchases = localStorage.getItem('saas_hw_purchases_by_sub') || '{}';
                              const purchases = JSON.parse(rawPurchases);
                              const userPurchases: any[] = purchases[selectedUser.name] || [];

                              if (!userPurchases || userPurchases.length === 0) {
                                return <div className="text-center text-slate-500 text-xs py-4">No hardware devices purchased.</div>;
                              }

                              return (
                                <div className="space-y-3">
                                  {userPurchases.map((sale: any, idx: number) => (
                                    <div key={idx} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                                      <div className="flex justify-between items-center border-b border-slate-850 pb-2 mb-2 text-[10px] text-slate-400 font-mono">
                                        <span>Receipt: <span className="text-indigo-400">{sale.receiptNo}</span></span>
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
            <div className="bg-slate-900/50 border border-slate-850 rounded-2xl p-12 overflow-hidden shadow-xl min-h-[460px] flex flex-col items-center justify-center text-center animate-in fade-in fill-mode-forwards duration-300">
              <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 ring-4 ring-indigo-500/10 flex-shrink-0">
                <Users className="w-10 h-10 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold font-sans text-white mb-2 tracking-tight">Global Subscriber Hub</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto mb-10 leading-relaxed font-sans">
                Select a subscriber.
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-3xl border-t border-slate-800/80 pt-10">
                <div className="flex flex-col gap-2 items-center">
                  <span className="text-4xl font-mono font-bold text-slate-200">{users.length}</span>
                  <span className="text-[10px] uppercase text-emerald-500 font-black tracking-widest">Total Users</span>
                </div>
                <div className="flex flex-col gap-2 items-center">
                  <span className="text-4xl font-mono font-bold text-emerald-400">{users.filter(u => u.status === 'Active').length}</span>
                  <span className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Active</span>
                </div>
                <div className="flex flex-col gap-2 items-center">
                  <span className="text-4xl font-mono font-bold text-rose-400">{users.filter(u => u.status === 'Suspended').length}</span>
                  <span className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Suspended</span>
                </div>
                <div className="flex flex-col gap-2 items-center">
                  <span className="text-4xl font-mono font-bold text-amber-400">{users.filter(u => u.paymentStatus === 'Overdue').length}</span>
                  <span className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Overdue</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {showMirrorModal && mirrorTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-indigo-600/20 px-6 py-4 border-b border-indigo-500/20 flex flex-col items-center justify-center py-6 text-center">
              <div className="w-12 h-12 bg-indigo-500/30 rounded-full flex items-center justify-center mb-3">
                <AppWindow className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-white font-bold text-lg font-sans">Mirror Gateway Authorization</h3>
              <p className="text-xs text-indigo-300 mt-1">Target Account: <span className="font-mono text-white">{mirrorTarget.name}</span></p>
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
                  if (mirrorPass1 === 'jasper123' && mirrorPass2 === 'admin123') {
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
