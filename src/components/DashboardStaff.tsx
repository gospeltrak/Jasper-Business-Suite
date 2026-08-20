import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import { StaffSettings, StaffAllowance, SystemSettings, Sale, Expense, Delivery, Tenant } from '../types';
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
  TimerReset,
  Eye,
  Plus,
  X,
  CalendarDays,
  FileDown,
  Wallet,
  Briefcase,
  ClipboardList,
  Lock,
  FileText,
  ChevronLeft,
  ChevronRight,
  MoreVertical
} from 'lucide-react';
import { DEFAULT_CUSTOM_ROLES } from '../utils/defaultCustomRoles';
import { compressImageFile } from '../utils/imageCompression';
import { getMaskedAccountReference } from '../utils/paymentAccounts';
import { loadBranchWorkspace } from '../branches/branchApi';
import { getSecureDataBridgeClient } from '../secureDataBridge';

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

type PayrollPeriodPreset = 'today' | 'week' | 'month' | 'custom';

type PayrollPeriod = {
  preset: PayrollPeriodPreset;
  start: string;
  end: string;
};

const defaultAllowanceCategories = [
  'Transport allowance',
  'Food allowance',
  'Housing allowance',
  'Airtime allowance',
  'Overtime allowance',
  'Bonus allowance',
  'Daily field allowance',
  'Delivery/rider allowance',
  'Other allowance'
];

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const toDateOnly = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const getPeriodFromPreset = (preset: PayrollPeriodPreset, current?: PayrollPeriod): PayrollPeriod => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (preset === 'today') {
    return { preset, start: todayIsoDate(), end: todayIsoDate() };
  }

  if (preset === 'week') {
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + mondayOffset);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
    return { preset, start: toDateOnly(start.toISOString()), end: toDateOnly(end.toISOString()) };
  }

  if (preset === 'month') {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 0);
    return { preset, start: toDateOnly(start.toISOString()), end: toDateOnly(end.toISOString()) };
  }

  return {
    preset,
    start: current?.start || todayIsoDate(),
    end: current?.end || todayIsoDate()
  };
};

const parsePeriodDate = (value: string, endOfDay = false) => {
  const date = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const getInclusiveDays = (period: PayrollPeriod) => {
  const start = parsePeriodDate(period.start);
  const end = parsePeriodDate(period.end, true);
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(diff / 86400000) + 1);
};

const rangesOverlap = (rangeStart: string, rangeEnd: string | undefined, period: PayrollPeriod) => {
  const start = parsePeriodDate(rangeStart);
  const end = rangeEnd ? parsePeriodDate(rangeEnd, true) : parsePeriodDate(period.end, true);
  const periodStart = parsePeriodDate(period.start);
  const periodEnd = parsePeriodDate(period.end, true);
  return start <= periodEnd && end >= periodStart;
};

const getWeeksInPeriod = (period: PayrollPeriod) => Math.max(1, Math.ceil(getInclusiveDays(period) / 7));

const getMonthsInPeriod = (period: PayrollPeriod) => {
  const start = parsePeriodDate(period.start);
  const end = parsePeriodDate(period.end, true);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
  return Math.max(1, months);
};

const calculateSalaryForPeriod = (staff: StaffSettings, period: PayrollPeriod) => {
  const salary = Number(staff.salary) || 0;
  const salaryType = staff.salaryType || 'monthly';
  if (!salary || (staff.salaryStartDate && !rangesOverlap(staff.salaryStartDate, undefined, period))) return 0;
  if (salaryType === 'daily') return salary * getInclusiveDays(period);
  if (salaryType === 'weekly') return salary * getWeeksInPeriod(period);
  if (salaryType === 'custom') return salary;
  if (salaryType === 'commission') return 0;
  return salary * getMonthsInPeriod(period);
};

const calculateAllowanceForPeriod = (allowance: StaffAllowance, period: PayrollPeriod) => {
  if (!rangesOverlap(allowance.startDate, allowance.endDate, period)) return 0;
  const amount = Number(allowance.amount) || 0;
  if (allowance.frequency === 'daily') return amount * getInclusiveDays(period);
  if (allowance.frequency === 'weekly') return amount * getWeeksInPeriod(period);
  if (allowance.frequency === 'monthly') return amount * getMonthsInPeriod(period);
  if (allowance.frequency === 'one-time') {
    const paidDate = parsePeriodDate(allowance.startDate);
    return paidDate >= parsePeriodDate(period.start) && paidDate <= parsePeriodDate(period.end, true) ? amount : 0;
  }
  return amount;
};

const calculateStaffPayroll = (staff: StaffSettings, period: PayrollPeriod) => {
  const allowances = staff.allowances || [];
  const allowanceTotals = allowances.reduce(
    (acc, allowance) => {
      const value = calculateAllowanceForPeriod(allowance, period);
      acc.total += value;
      acc.byFrequency[allowance.frequency] = (acc.byFrequency[allowance.frequency] || 0) + value;
      acc.byCategory[allowance.name] = (acc.byCategory[allowance.name] || 0) + value;
      return acc;
    },
    {
      total: 0,
      byFrequency: {
        daily: 0,
        weekly: 0,
        monthly: 0,
        'one-time': 0,
        custom: 0
      } as Record<StaffAllowance['frequency'], number>,
      byCategory: {} as Record<string, number>
    }
  );
  const salaryTotal = calculateSalaryForPeriod(staff, period);
  return {
    salaryTotal,
    allowancesTotal: allowanceTotals.total,
    totalCost: salaryTotal + allowanceTotals.total,
    allowanceByFrequency: allowanceTotals.byFrequency,
    allowanceByCategory: allowanceTotals.byCategory
  };
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

const formatMoney = (value: number) => `${currency}${Math.round(value || 0).toLocaleString()}`;

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
  deliveries,
  onPayStaff,
  payrollEnabled,
  canPayPayroll,
}: {
  systemSettings: SystemSettings;
  onUpdateSettings: (s: SystemSettings) => Promise<boolean> | void;
  sales: Sale[];
  expenses: Expense[];
  activeTenant: Tenant;
  deliveries: Delivery[];
  onPayStaff: (expense: Expense) => void | boolean | Promise<void | boolean>;
  payrollEnabled: boolean;
  canPayPayroll: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'list' | 'register' | 'reports'>('list');
  const [staffList, setStaffList] = useState<StaffSettings[]>(systemSettings.staffs || []);
  const [staffStatuses, setStaffStatuses] = useState<Record<string, boolean>>({});
  const [sessionLogs, setSessionLogs] = useState<StaffSessionRecord[]>([]);
  const [sessionNow, setSessionNow] = useState(Date.now());
  const customRoles = systemSettings.customRoles || DEFAULT_CUSTOM_ROLES;
  const paymentAccounts = (systemSettings.paymentChannels || [])
    .filter(account => account.category !== 'person' && account.status !== 'inactive' && account.status !== 'archived');

  const [roleType, setRoleType] = useState<'standard' | 'delivery'>('standard');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profilePic, setProfilePic] = useState('');
  const [selectedRole, setSelectedRole] = useState(customRoles[0]?.name || 'Seller');
  const [classification, setClassification] = useState<'rider' | 'driver'>('rider');
  const [vehicleType, setVehicleType] = useState<'motorcycle' | 'tuktuk' | 'car'>('motorcycle');
  const [vehicleColor, setVehicleColor] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [signatureImage, setSignatureImage] = useState('');
  const [staffType, setStaffType] = useState<NonNullable<StaffSettings['staffType']>>('permanent');
  const [department, setDepartment] = useState('');
  const [dateJoined, setDateJoined] = useState(todayIsoDate());
  const [salaryAmount, setSalaryAmount] = useState(0);
  const [salaryType, setSalaryType] = useState<NonNullable<StaffSettings['salaryType']>>('monthly');
  const [salaryStartDate, setSalaryStartDate] = useState(todayIsoDate());
  const [salaryNotes, setSalaryNotes] = useState('');
  const [credentialPhone, setCredentialPhone] = useState('');
  const [credentialStaffId, setCredentialStaffId] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<StaffSettings | null>(null);
  const [staffToRemove, setStaffToRemove] = useState<StaffSettings | null>(null);
  const [staffToPay, setStaffToPay] = useState<StaffSettings | null>(null);
  const [salaryPaymentAmount, setSalaryPaymentAmount] = useState('');
  const [salaryPaymentMethod, setSalaryPaymentMethod] = useState('Bank Transfer');
  const [salaryPaymentAccount, setSalaryPaymentAccount] = useState('');
  const [salaryPaymentReference, setSalaryPaymentReference] = useState('');
  const [salaryPaymentType, setSalaryPaymentType] = useState<NonNullable<Expense['payrollPaymentType']>>('salary');
  const [salaryPaymentNotes, setSalaryPaymentNotes] = useState('');
  const [salaryPaymentAttachment, setSalaryPaymentAttachment] = useState<{ name: string; data: string } | null>(null);
  const [activeBranchContext, setActiveBranchContext] = useState<{ id: string; name: string } | null>(null);
  const [allowanceForm, setAllowanceForm] = useState({
    name: 'Food allowance',
    customName: '',
    amount: '',
    frequency: 'daily' as StaffAllowance['frequency'],
    startDate: todayIsoDate(),
    endDate: '',
    notes: ''
  });
  const [payrollPeriod, setPayrollPeriod] = useState<PayrollPeriod>(() => getPeriodFromPreset('month'));
  const [successMessage, setSuccessMessage] = useState('');
  const [invitationLink, setInvitationLink] = useState('');
  const [isRegisteringStaff, setIsRegisteringStaff] = useState(false);
  const [viewingStaffReport, setViewingStaffReport] = useState<StaffSettings | null>(null);
  const [openStaffActionId, setOpenStaffActionId] = useState<string | null>(null);
  const [desktopActionMenuPos, setDesktopActionMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [mobileActionsStaff, setMobileActionsStaff] = useState<StaffSettings | null>(null);

  useEffect(() => {
    setStaffList(systemSettings.staffs || []);
  }, [systemSettings.staffs]);

  useEffect(() => {
    let mounted = true;
    const applyContext = (detail: any) => {
      if (!mounted) return;
      const id = String(detail?.activeBranchId || '');
      const name = String(detail?.businessName || detail?.branchName || '');
      setActiveBranchContext(id ? { id, name: name || 'Active branch' } : null);
    };
    const onContextChange = (event: Event) => applyContext((event as CustomEvent).detail);
    window.addEventListener('jasper_branch_context_changed', onContextChange);
    void loadBranchWorkspace().then(snapshot => applyContext({
      activeBranchId: snapshot.context.activeBranchId,
      businessName: snapshot.context.selectedBranch?.businessName || snapshot.context.selectedBranch?.branchName,
    })).catch(() => setActiveBranchContext(null));
    return () => {
      mounted = false;
      window.removeEventListener('jasper_branch_context_changed', onContextChange);
    };
  }, [activeTenant.id]);

  useEffect(() => {
    const loadSessions = () => {
      try {
        const storedSessions = onlineStorage.getItem(`jasper_staff_sessions_${activeTenant.id}`);
        const parsedSessions: StaffSessionRecord[] = storedSessions ? JSON.parse(storedSessions) : [];
        setSessionLogs(parsedSessions);

        const storedMap = onlineStorage.getItem(`jasper_staff_statuses_${activeTenant.id}`);
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
      device: activeSession?.device || lastSession?.device || 'Unknown',
      deliveriesCount: staffDeliveries.length,
      deliveryRevenue
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageFile(file, { maxWidth: 512, maxHeight: 512, quality: 0.72 });
    setter(compressed);
  };

  // Awaits the actual database write before the caller treats a change as
  // final (e.g. closing the registration form) — the write to the backing
  // store was previously fire-and-forget, so navigating away or refreshing
  // right after registering a staff member could lose them if the request
  // hadn't landed yet.
  const persistStaffList = async (updatedStaffs: StaffSettings[]): Promise<boolean> => {
    setStaffList(updatedStaffs);
    const result = onUpdateSettings({ ...systemSettings, staffs: updatedStaffs });
    if (result && typeof (result as Promise<boolean>).then === 'function') {
      return await (result as Promise<boolean>);
    }
    return true;
  };

  const createGoogleInvitation = async (staff: StaffSettings) => {
    if (!staff.email) throw new Error('Add the staff Gmail first.');
    const client: any = await getSecureDataBridgeClient();
    const { data } = await client.auth.getSession();
    const accessToken = data?.session?.access_token;
    if (!accessToken) throw new Error('Admin session is required.');
    const response = await fetch('/api/staff/google-invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        staffId: staff.id, name: staff.name, email: staff.email, phone: staff.phone,
        role: staff.role, branchId: staff.branchId || activeBranchContext?.id,
        permissions: customRoles.find(item => item.name.toLowerCase() === staff.role.toLowerCase())?.permissions || {},
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.invitationUrl) throw new Error(result.error || 'Invitation link could not be created.');
    setInvitationLink(result.invitationUrl);
    return result.invitationUrl as string;
  };

  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !email) return;

    const newStaff: StaffSettings = {
      id: `staff-${Date.now()}`,
      name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      branchId: activeBranchContext?.id,
      role: roleType === 'delivery' ? classification : selectedRole,
      salary: Number(salaryAmount) || 0,
      salaryType,
      salaryStartDate,
      salaryNotes: salaryNotes.trim(),
      staffType: roleType === 'delivery' ? classification : staffType,
      department: department.trim(),
      status: 'active',
      dateJoined,
      allowances: [],
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

    setIsRegisteringStaff(true);
    const saved = await persistStaffList([...staffList, newStaff]);
    setIsRegisteringStaff(false);
    if (!saved) {
      // The write to the database did not land — keep the form filled in
      // so the staff member isn't silently lost and the admin can retry,
      // instead of clearing the form as if registration had succeeded.
      setSuccessMessage(`Could not save "${fullName}" — check your connection and try again.`);
      setTimeout(() => setSuccessMessage(''), 6000);
      return;
    }

    try {
      await createGoogleInvitation(newStaff);
      setSuccessMessage(`Staff member "${fullName}" saved. Share the secure Google invitation link below.`);
    } catch {
      setSuccessMessage(`Staff member "${fullName}" saved, but the Google invitation was not created. Open the staff profile and try again.`);
    }
    setFullName('');
    setEmail('');
    setPhone('');
    setProfilePic('');
    setVehicleColor('');
    setLicensePlate('');
    setSignatureImage('');
    setDepartment('');
    setDateJoined(todayIsoDate());
    setSalaryAmount(0);
    setSalaryType('monthly');
    setSalaryStartDate(todayIsoDate());
    setSalaryNotes('');

    setTimeout(() => {
      setSuccessMessage('');
    }, 5000);
  };

  const handleDeleteStaff = (staffId: string) => {
    const target = staffList.find(s => s.id === staffId);
    if (target?.isOwner) {
      alert('⚠️ The business owner account cannot be removed from the staff list.');
      return;
    }
    if (target) setStaffToRemove(target);
  };

  const confirmRemoveStaff = () => {
    if (!staffToRemove) return;
    persistStaffList(staffList.filter(s => s.id !== staffToRemove.id));
    setStaffToRemove(null);
  };

  const openSalaryPayment = (staff: StaffSettings) => {
    if (!payrollEnabled) {
      setSuccessMessage('Payroll payments are available on the Tanzanite package only.');
      return;
    }
    if (!canPayPayroll) {
      setSuccessMessage('You do not have permission to post payroll payments.');
      return;
    }
    const payroll = calculateStaffPayroll(staff, payrollPeriod);
    setStaffToPay(staff);
    setSalaryPaymentAmount(String(Math.max(0, payroll.totalCost)));
    const defaultAccount = paymentAccounts.find(account => account.isDefault) || paymentAccounts[0];
    setSalaryPaymentMethod(defaultAccount?.paymentMethod || defaultAccount?.name || '');
    setSalaryPaymentAccount(defaultAccount?.id || '');
    setSalaryPaymentReference(`PAY-${todayIsoDate()}-${staff.id.slice(-6).toUpperCase()}`);
    setSalaryPaymentType('salary');
    setSalaryPaymentNotes('');
    setSalaryPaymentAttachment(null);
  };

  const confirmSalaryPayment = async () => {
    if (!staffToPay) return;
    const amount = Number(salaryPaymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSuccessMessage('Enter a valid salary or wages amount.');
      return;
    }
    const account = paymentAccounts.find(candidate => candidate.id === salaryPaymentAccount);
    if (!account) {
      setSuccessMessage('Select an active Money & Bank account for this payroll payment.');
      return;
    }
    const saved = await onPayStaff({
      id: `payroll-${Date.now()}`,
      category: salaryPaymentType === 'allowance'
        ? 'Staff Allowance'
        : salaryPaymentType === 'bonus'
          ? 'Staff Bonus'
          : salaryPaymentType === 'overtime'
            ? 'Staff Overtime'
            : salaryPaymentType === 'advance_recovery'
              ? 'Staff Advance Recovery'
              : 'Wages & Salary',
      amount,
      timestamp: new Date().toISOString(),
      description: `${salaryPaymentType.replace('_', ' ')} payment to ${staffToPay.name} for ${payrollPeriod.start} to ${payrollPeriod.end}`,
      staffName: staffToPay.name,
      staffId: staffToPay.id,
      tenantId: activeTenant.id,
      branchId: activeBranchContext?.id,
      receiptRef: salaryPaymentAttachment?.name || salaryPaymentReference.trim() || undefined,
      receiptImage: salaryPaymentAttachment?.data,
      transactionMessage: `${account.paymentMethod || account.name} · ${account.name}`,
      note: salaryPaymentNotes.trim() || `Payroll period ${payrollPeriod.start} to ${payrollPeriod.end}`,
      paymentMethod: account.paymentMethod || account.name,
      paidFromAccountId: account.id,
      payrollPaymentType: salaryPaymentType,
      payrollPeriodStart: payrollPeriod.start,
      payrollPeriodEnd: payrollPeriod.end,
      payrollReference: salaryPaymentReference.trim() || undefined,
      payrollAttachmentName: salaryPaymentAttachment?.name,
    });
    if (saved === false) {
      setSuccessMessage('Payroll payment was not posted. No local record was created.');
      return;
    }
    setSuccessMessage(`Salary payment of ${formatMoney(amount)} recorded as Money Out for ${staffToPay.name}.`);
    setStaffToPay(null);
  };

  const openStaffProfile = (staff: StaffSettings) => {
    setSelectedStaff(staff);
    setAllowanceForm({
      name: 'Food allowance',
      customName: '',
      amount: '',
      frequency: 'daily',
      startDate: todayIsoDate(),
      endDate: '',
      notes: ''
    });
  };

  const openCredentialEditor = (staff: StaffSettings) => {
    const isOpen = credentialStaffId === staff.id;
    setCredentialStaffId(isOpen ? '' : staff.id);
    setCredentialPhone(isOpen ? '' : staff.phone);
  };

  const handleSaveStaffCredentials = (staffId: string) => {
    const staff = staffList.find(item => item.id === staffId);
    if (!staff || !credentialPhone.trim()) {
      setSuccessMessage('Enter the staff phone/login ID.');
      return;
    }
    const updatedStaff = { ...staff, phone: credentialPhone.trim() };
    persistStaffList(staffList.map(item => item.id === staffId ? updatedStaff : item));
    setCredentialStaffId('');
    setCredentialPhone('');
    void createGoogleInvitation(updatedStaff)
      .then(() => setSuccessMessage('Login ID saved and a secure Google invitation was created.'))
      .catch(error => setSuccessMessage(error instanceof Error ? error.message : 'Login ID saved, but invitation creation failed.'));
  };

  const updateStaff = (staffId: string, updater: (staff: StaffSettings) => StaffSettings) => {
    const updatedStaffs = staffList.map(staff => staff.id === staffId ? updater(staff) : staff);
    persistStaffList(updatedStaffs);
    const updatedSelected = updatedStaffs.find(staff => staff.id === staffId);
    if (updatedSelected) setSelectedStaff(updatedSelected);
  };

  const handleProfileFieldChange = (staffId: string, patch: Partial<StaffSettings>) => {
    updateStaff(staffId, staff => ({ ...staff, ...patch }));
  };

  const handleAddAllowance = (staff: StaffSettings) => {
    const name = allowanceForm.name === 'custom' ? allowanceForm.customName.trim() : allowanceForm.name;
    const amount = Number(allowanceForm.amount);
    if (!name || !amount || !allowanceForm.startDate) {
      setSuccessMessage('Enter allowance category, amount, and start date.');
      return;
    }

    const newAllowance: StaffAllowance = {
      id: `allowance-${Date.now()}`,
      name,
      amount,
      frequency: allowanceForm.frequency,
      startDate: allowanceForm.startDate,
      endDate: allowanceForm.endDate || undefined,
      notes: allowanceForm.notes.trim()
    };

    updateStaff(staff.id, current => ({
      ...current,
      allowances: [...(current.allowances || []), newAllowance]
    }));
    setAllowanceForm({
      name: 'Food allowance',
      customName: '',
      amount: '',
      frequency: 'daily',
      startDate: todayIsoDate(),
      endDate: '',
      notes: ''
    });
  };

  const handleRemoveAllowance = (staffId: string, allowanceId: string) => {
    updateStaff(staffId, staff => ({
      ...staff,
      allowances: (staff.allowances || []).filter(allowance => allowance.id !== allowanceId)
    }));
  };

  const buildPayrollSummary = () => {
    const perStaff = staffList.map(staff => ({
      staff,
      payroll: calculateStaffPayroll(staff, payrollPeriod),
      summary: staffSummaries.get(staff.id) || buildStaffSummary(staff)
    }));

    return perStaff.reduce(
      (acc, row) => {
        acc.basicSalaries += row.payroll.salaryTotal;
        acc.totalAllowances += row.payroll.allowancesTotal;
        acc.totalPayroll += row.payroll.totalCost;
        acc.dailyAllowances += row.payroll.allowanceByFrequency.daily || 0;
        acc.weeklyAllowances += row.payroll.allowanceByFrequency.weekly || 0;
        acc.monthlyAllowances += row.payroll.allowanceByFrequency.monthly || 0;
        acc.oneTimeAllowances += row.payroll.allowanceByFrequency['one-time'] || 0;
        acc.temporaryStaff += row.staff.staffType?.includes('temporary') ? 1 : 0;
        acc.driversRiders += ['driver', 'rider', 'temporary-driver', 'temporary-rider'].includes(row.staff.staffType || '') || !!row.staff.classification ? 1 : 0;
        acc.activeStaff += (row.staff.status || 'active') === 'active' ? 1 : 0;
        acc.performanceOrders += row.summary.orders;
        acc.performanceProfit += row.summary.profitGenerated;
        acc.byRole[row.staff.role] = (acc.byRole[row.staff.role] || 0) + row.payroll.totalCost;
        acc.byType[row.staff.staffType || row.staff.classification || 'permanent'] = (acc.byType[row.staff.staffType || row.staff.classification || 'permanent'] || 0) + row.payroll.totalCost;
        Object.entries(row.payroll.allowanceByCategory).forEach(([category, value]) => {
          acc.byCategory[category] = (acc.byCategory[category] || 0) + value;
        });
        return acc;
      },
      {
        perStaff,
        basicSalaries: 0,
        dailyAllowances: 0,
        weeklyAllowances: 0,
        monthlyAllowances: 0,
        oneTimeAllowances: 0,
        totalAllowances: 0,
        totalPayroll: 0,
        activeStaff: 0,
        temporaryStaff: 0,
        driversRiders: 0,
        performanceOrders: 0,
        performanceProfit: 0,
        byRole: {} as Record<string, number>,
        byType: {} as Record<string, number>,
        byCategory: {} as Record<string, number>
      }
    );
  };

  const downloadStaffPdf = (title: string, lines: string[], fileName: string) => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 42;
    let y = 48;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(title, margin, y);
    y += 24;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(`Period: ${payrollPeriod.start} to ${payrollPeriod.end}`, margin, y);
    y += 22;
    lines.forEach(line => {
      const wrapped = pdf.splitTextToSize(line, pageWidth - margin * 2);
      wrapped.forEach((row: string) => {
        if (y > 780) {
          pdf.addPage();
          y = 48;
        }
        pdf.text(row, margin, y);
        y += 14;
      });
      y += 4;
    });
    pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  };

  const exportOverallStaffPdf = () => {
    const payroll = buildPayrollSummary();
    downloadStaffPdf('Overall Staff Payroll Report', [
      `Total staff: ${staffList.length}`,
      `Active staff: ${payroll.activeStaff}`,
      `Temporary staff: ${payroll.temporaryStaff}`,
      `Drivers/Riders: ${payroll.driversRiders}`,
      `Total basic salaries: ${formatMoney(payroll.basicSalaries)}`,
      `Daily allowances: ${formatMoney(payroll.dailyAllowances)}`,
      `Weekly allowances: ${formatMoney(payroll.weeklyAllowances)}`,
      `Monthly allowances: ${formatMoney(payroll.monthlyAllowances)}`,
      `One-time allowances: ${formatMoney(payroll.oneTimeAllowances)}`,
      `Total allowances/posho: ${formatMoney(payroll.totalAllowances)}`,
      `Total payroll cost: ${formatMoney(payroll.totalPayroll)}`,
      `Performance summary: ${payroll.performanceOrders} orders/transactions, ${formatMoney(payroll.performanceProfit)} profit generated`,
      'Cost by role:',
      ...Object.entries(payroll.byRole as Record<string, number>).map(([role, value]) => `- ${role}: ${formatMoney(value)}`),
      'Cost by allowance category:',
      ...Object.entries(payroll.byCategory as Record<string, number>).map(([category, value]) => `- ${category}: ${formatMoney(value)}`),
      'Payroll cost per staff:',
      ...payroll.perStaff.map(row => `- ${row.staff.name}: ${formatMoney(row.payroll.totalCost)} (${formatMoney(row.payroll.salaryTotal)} salary + ${formatMoney(row.payroll.allowancesTotal)} allowances)`)
    ], `staff-payroll-report-${payrollPeriod.start}-${payrollPeriod.end}.pdf`);
  };

  const exportIndividualStaffPdf = (staff: StaffSettings) => {
    const summary = staffSummaries.get(staff.id) || buildStaffSummary(staff);
    const payroll = calculateStaffPayroll(staff, payrollPeriod);
    downloadStaffPdf(`${staff.name} Staff Report`, [
      `Full name: ${staff.name}`,
      `Phone / username: ${staff.phone}`,
      `Role: ${staff.role}`,
      `Staff type: ${staff.staffType || staff.classification || 'permanent'}`,
      `Department: ${staff.department || 'Not recorded'}`,
      `Status: ${staff.status || 'active'}`,
      `Date joined: ${staff.dateJoined || 'Not recorded'}`,
      'Authentication: Supabase Auth protected; no workspace password stored',
      `Salary/wage amount: ${formatMoney(Number(staff.salary) || 0)}`,
      `Salary/wage frequency: ${staff.salaryType || 'monthly'}`,
      `Salary total for period: ${formatMoney(payroll.salaryTotal)}`,
      `Daily allowances: ${formatMoney(payroll.allowanceByFrequency.daily || 0)}`,
      `Weekly allowances: ${formatMoney(payroll.allowanceByFrequency.weekly || 0)}`,
      `Monthly allowances: ${formatMoney(payroll.allowanceByFrequency.monthly || 0)}`,
      `One-time allowances: ${formatMoney(payroll.allowanceByFrequency['one-time'] || 0)}`,
      `Total allowances: ${formatMoney(payroll.allowancesTotal)}`,
      `Total staff cost: ${formatMoney(payroll.totalCost)}`,
      `Sales/orders handled: ${summary.orders}`,
      `Payments/amount handled: ${formatMoney(summary.totalHandled)}`,
      `Profit generated: ${formatMoney(summary.profitGenerated)}`,
      `System sessions: ${summary.sessionCount}`,
      `Time spent in system: ${formatDuration(summary.totalDuration)}`,
      `Notes: ${staff.notes || 'No notes available'}`,
      'Allowance breakdown:',
      ...((staff.allowances || []).length ? (staff.allowances || []).map(allowance => `- ${allowance.name}: ${formatMoney(calculateAllowanceForPeriod(allowance, payrollPeriod))} (${formatMoney(allowance.amount)} ${allowance.frequency})`) : ['No allowances available'])
    ], `staff-report-${staff.name.replace(/\s+/g, '-').toLowerCase()}-${payrollPeriod.start}-${payrollPeriod.end}.pdf`);
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
          <div className="min-h-[44px] rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
            Authentication is protected by Supabase Auth. Passwords are never saved in workspace data.
          </div>
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

  const payrollSummary = buildPayrollSummary();

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

        <div className="mt-5 grid grid-cols-2 gap-3 md:max-w-md">
          {[
            { label: 'Total staff', value: totals.totalStaff.toLocaleString(), icon: Users, color: 'text-slate-900' },
            { label: 'Profit generated', value: `${currency}${Math.round(totals.totalProfit).toLocaleString()}`, icon: DollarSign, color: 'text-indigo-700' }
          ].map(item => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{item.label}</span>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <div className={`mt-2 text-lg font-black tracking-tight ${item.color}`}>{item.value}</div>
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
          <span className="min-w-0 flex-1">{successMessage}</span>
        </div>
      )}

      {activeTab === 'list' && (
        <section className="rounded-none md:rounded-[1.75rem] border-y md:border border-slate-200 bg-white p-4 md:p-6 shadow-sm -mx-4 md:mx-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-black text-slate-950">Registered Staff</h3>
            </div>
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">{staffList.length} accounts</div>
          </div>

          <div className="hidden xl:block overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-4">Staff member</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Last login</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-sm font-semibold text-slate-400">No staff registered.</td>
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
                        <td className="p-4">
                          <div className="text-xs font-bold text-slate-700">{formatDateTime(summary.lastLogin)}</div>
                          <div className="text-[11px] text-slate-400 mt-1">{summary.device}</div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                if (openStaffActionId === staff.id) {
                                  setOpenStaffActionId(null);
                                  setDesktopActionMenuPos(null);
                                  return;
                                }
                                const rect = e.currentTarget.getBoundingClientRect();
                                setDesktopActionMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                                setOpenStaffActionId(staff.id);
                              }}
                              className="h-9 w-9 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 inline-flex items-center justify-center"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {openStaffActionId === staff.id && desktopActionMenuPos && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => { setOpenStaffActionId(null); setDesktopActionMenuPos(null); }} />
                                <div
                                  className="fixed w-44 bg-white shadow-xl rounded-2xl border border-slate-200 py-1.5 z-50 animate-fade-in origin-top-right text-left text-xs font-bold text-slate-700 flex flex-col"
                                  style={{ top: desktopActionMenuPos.top, right: desktopActionMenuPos.right }}
                                >
                                  <button type="button" onClick={() => { setOpenStaffActionId(null); openStaffProfile(staff); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer">
                                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                                    View Staff
                                  </button>
                                  {payrollEnabled && canPayPayroll && (
                                    <button type="button" onClick={() => { setOpenStaffActionId(null); openSalaryPayment(staff); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer">
                                      <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                                      Pay Staff
                                    </button>
                                  )}
                                  <button type="button" onClick={() => { setOpenStaffActionId(null); openCredentialEditor(staff); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer">
                                    <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                                    Edit Staff
                                  </button>
                                  {!staff.isOwner ? (
                                    <button type="button" onClick={() => { setOpenStaffActionId(null); handleDeleteStaff(staff.id); }} className="w-full text-left px-4 py-2.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer">
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Delete Staff
                                    </button>
                                  ) : (
                                    <span className="w-full text-left px-4 py-2.5 text-amber-700 flex items-center gap-2">
                                      👑 Owner
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
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

          <div className="xl:hidden space-y-3">
            {staffList.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-400">No staff registered.</div>
            ) : (
              staffList.map(staff => {
                return (
                  <article
                    key={staff.id}
                    className="rounded-2xl bg-white p-3.5 relative overflow-hidden"
                    style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}
                  >
                    <div className="flex items-center gap-3">
                      {renderAvatar(staff, 'w-11 h-11')}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-slate-950 text-sm truncate">{staff.name}</h4>
                        <span className="text-[10px] font-black uppercase text-indigo-600 truncate">{staff.role}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMobileActionsStaff(staff)}
                        className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 flex items-center justify-center shrink-0"
                        aria-label="Staff actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      {renderCredentialEditor(staff, true)}
                    </div>
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
                    <span className="text-xs font-black text-slate-700">Phone Number</span>
                    <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 0712345678" className="w-full min-h-[48px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-indigo-500" />
                  </label>
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-xs font-black text-slate-700">Gmail for Google invitation</span>
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@gmail.com" className="w-full min-h-[48px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-indigo-500" />
                  </label>
                  <div className="md:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
                    Login credentials are created through the secure Google invitation and are never stored in workspace data.
                  </div>
                  <label className="space-y-1.5">
                    <span className="text-xs font-black text-slate-700">Staff Type</span>
                    <select value={staffType} onChange={e => setStaffType(e.target.value as NonNullable<StaffSettings['staffType']>)} className="w-full min-h-[48px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black outline-none focus:border-indigo-500">
                      <option value="permanent">Permanent</option>
                      <option value="temporary">Temporary</option>
                      <option value="driver">Driver</option>
                      <option value="rider">Rider</option>
                      <option value="temporary-driver">Temporary driver</option>
                      <option value="temporary-rider">Temporary rider</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-black text-slate-700">Date Joined</span>
                    <input type="date" value={dateJoined} onChange={e => setDateJoined(e.target.value)} className="w-full min-h-[48px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-indigo-500" />
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

                <div className="rounded-2xl bg-white border border-slate-200 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-indigo-600" />
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-500">Salary setup</h5>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Basic Salary / Wage</span>
                      <input type="number" min="0" value={salaryAmount || ''} onChange={e => setSalaryAmount(Number(e.target.value) || 0)} placeholder="0" className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none" />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Frequency</span>
                      <select value={salaryType} onChange={e => setSalaryType(e.target.value as NonNullable<StaffSettings['salaryType']>)} className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-black outline-none">
                        <option value="monthly">Monthly salary</option>
                        <option value="weekly">Weekly salary</option>
                        <option value="daily">Daily wage</option>
                        <option value="commission">Commission-based</option>
                        <option value="custom">Custom period</option>
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Salary Start Date</span>
                      <input type="date" value={salaryStartDate} onChange={e => setSalaryStartDate(e.target.value)} className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none" />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Salary Notes</span>
                      <input type="text" value={salaryNotes} onChange={e => setSalaryNotes(e.target.value)} placeholder="Optional" className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none" />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <label className="min-h-[84px] rounded-xl border-2 border-dashed border-slate-300 bg-white p-2 flex flex-col items-center justify-center text-center cursor-pointer">
                    {profilePic ? <img src={profilePic} alt="Profile" className="h-10 w-10 rounded-xl object-cover" /> : <Camera className="w-5 h-5 text-slate-400" />}
                    <span className="mt-1.5 text-[11px] font-black text-slate-600">Profile Photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, setProfilePic)} />
                  </label>
                  <label className="min-h-[84px] rounded-xl border-2 border-dashed border-slate-300 bg-white p-2 flex flex-col items-center justify-center text-center cursor-pointer">
                    {signatureImage ? <img src={signatureImage} alt="Signature" className="h-8 w-full object-contain" /> : <Upload className="w-5 h-5 text-slate-400" />}
                    <span className="mt-1.5 text-[11px] font-black text-slate-600">Signature</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, setSignatureImage)} />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={isRegisteringStaff} className="w-full md:w-auto min-h-[52px] rounded-2xl bg-indigo-600 px-8 text-sm font-black text-white hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2">
                <UserPlus className="w-4 h-4" />
                {isRegisteringStaff ? 'Saving…' : 'Save Registration'}
              </button>
            </div>
          </form>
          {invitationLink && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-black text-emerald-900">Google staff invitation (expires in 24 hours)</p>
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <input readOnly value={invitationLink} className="min-h-[44px] flex-1 rounded-xl border border-emerald-200 bg-white px-3 text-xs font-semibold" />
                <button type="button" onClick={() => void navigator.clipboard.writeText(invitationLink)} className="min-h-[44px] rounded-xl bg-emerald-700 px-4 text-xs font-black text-white">Copy link</button>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'reports' && (
        <section className="rounded-none md:rounded-[1.75rem] border-y md:border border-slate-200 bg-white p-4 md:p-6 shadow-sm -mx-4 md:mx-0">
          <div className="mb-5">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-950">Staff Payroll, Sessions and Performance</h3>
              </div>
              <button
                type="button"
                onClick={exportOverallStaffPdf}
                className="min-h-[44px] rounded-2xl bg-slate-950 px-4 text-xs font-black text-white inline-flex items-center justify-center gap-2"
              >
                <FileDown className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 md:p-5 mb-5">
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'week', label: 'This week' },
                  { id: 'month', label: 'This month' }
                ].map(period => (
                  <button
                    key={period.id}
                    type="button"
                    onClick={() => setPayrollPeriod(prev => getPeriodFromPreset(period.id as PayrollPeriodPreset, prev))}
                    className={`min-h-[42px] px-1.5 rounded-xl text-[11px] sm:text-xs font-black whitespace-nowrap ${payrollPeriod.preset === period.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">Start</span>
                  <input type="date" value={payrollPeriod.start} onChange={e => setPayrollPeriod(prev => ({ ...prev, preset: 'custom', start: e.target.value }))} className="w-full min-h-[42px] rounded-xl bg-white border border-slate-200 px-3 text-xs font-bold outline-none" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">End</span>
                  <input type="date" value={payrollPeriod.end} onChange={e => setPayrollPeriod(prev => ({ ...prev, preset: 'custom', end: e.target.value }))} className="w-full min-h-[42px] rounded-xl bg-white border border-slate-200 px-3 text-xs font-bold outline-none" />
                </label>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: 'Basic Salary', value: payrollSummary.basicSalaries, icon: Wallet },
                { label: 'Allowances', value: payrollSummary.totalAllowances, icon: Plus }
              ].map(item => (
                <div key={item.label} className="rounded-2xl bg-white border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400">{item.label}</span>
                    <item.icon className="w-4 h-4 text-indigo-600" />
                  </div>
                  <strong className="mt-2 block text-lg font-black text-slate-950">{formatMoney(item.value)}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {staffList.length === 0 ? (
              <div className="xl:col-span-2 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-400">
                Register staff to see their session and performance reports here.
              </div>
            ) : (
              staffList.map(staff => {
                return (
                  <article key={staff.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {renderAvatar(staff, 'w-11 h-11')}
                      <div className="min-w-0">
                        <h4 className="font-black text-slate-900 text-sm truncate">{staff.name}</h4>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 truncate">{staff.role}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewingStaffReport(staff)}
                      className="shrink-0 h-9 px-3 rounded-xl bg-slate-900 text-white text-[11px] font-black inline-flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">View Report</span>
                    </button>
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* PER-STAFF REPORT DRILL-DOWN */}
      {viewingStaffReport && (() => {
        const staff = viewingStaffReport;
        const summary = staffSummaries.get(staff.id) || buildStaffSummary(staff);
        const payroll = calculateStaffPayroll(staff, payrollPeriod);
        return (
          <div className="fixed inset-0 z-[96] bg-slate-950/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="w-full md:max-w-2xl max-h-[92dvh] overflow-y-auto rounded-t-[2rem] md:rounded-[2rem] bg-white shadow-2xl">
              <div className="sticky top-0 bg-white z-10 flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                <button type="button" onClick={() => setViewingStaffReport(null)} className="h-9 w-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0 flex items-center gap-3 flex-1">
                  {renderAvatar(staff, 'w-10 h-10')}
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-950 text-sm truncate">{staff.name}</h3>
                    <p className="text-[11px] text-slate-500 font-semibold">{payrollPeriod.start} to {payrollPeriod.end}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => exportIndividualStaffPdf(staff)}
                  className="shrink-0 rounded-xl bg-slate-100 px-3 h-9 text-[11px] font-black text-slate-700 inline-flex items-center gap-1.5"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  {[
                    { label: 'Sales Recorded', value: `${currency}${Math.round(summary.totalHandled).toLocaleString()}`, sub: `${summary.orders} orders` },
                    { label: 'Profit Generated', value: `${currency}${Math.round(summary.profitGenerated).toLocaleString()}`, tone: summary.profitGenerated >= 0 ? 'text-indigo-700' : 'text-rose-700' },
                    { label: 'Expenses Recorded', value: `${currency}${Math.round(summary.expensesLogged).toLocaleString()}`, tone: 'text-rose-700' },
                    { label: 'Deliveries Recorded', value: `${summary.deliveriesCount} · ${currency}${Math.round(summary.deliveryRevenue).toLocaleString()}` },
                    { label: 'Allowance', value: formatMoney(payroll.allowancesTotal), tone: 'text-amber-700' },
                    { label: 'Salary', value: formatMoney(payroll.salaryTotal) },
                  ].map((row, i) => (
                    <div key={row.label} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-500">{row.label}</span>
                        {row.sub && <span className="block text-[10px] text-slate-400">{row.sub}</span>}
                      </div>
                      <strong className={`font-mono font-black text-sm shrink-0 ${row.tone || 'text-slate-900'}`}>{row.value}</strong>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3.5 border-t border-slate-200 bg-slate-900">
                    <span className="text-xs font-black uppercase text-white/70">Total Staff Cost</span>
                    <strong className="font-mono font-black text-base text-white">{formatMoney(payroll.totalCost)}</strong>
                  </div>
                </div>

                {(staff.classification || staff.vehicleType || staff.licensePlate) && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900 flex items-center gap-2">
                    <Truck className="w-4 h-4 shrink-0" />
                    <span>{staff.classification || staff.role} - {staff.vehicleType || 'vehicle'} {staff.licensePlate ? `(${staff.licensePlate})` : ''}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {staffToPay && (
        <div role="dialog" aria-modal="true" aria-labelledby="pay-staff-title" className="fixed inset-0 z-[95] bg-slate-950/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="w-full md:max-w-2xl max-h-[92dvh] rounded-t-[2rem] md:rounded-[2rem] bg-white shadow-2xl flex flex-col overflow-hidden">
          <div className="overflow-y-auto flex-1 p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="pay-staff-title" className="text-xl font-black text-slate-950">Pay Staff</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">{staffToPay.name} · {payrollPeriod.start} to {payrollPeriod.end}</p>
              </div>
              <button type="button" aria-label="Close salary payment" onClick={() => setStaffToPay(null)} className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Amount to Pay</span><input type="number" min="0.01" step="0.01" value={salaryPaymentAmount} onChange={e => setSalaryPaymentAmount(e.target.value)} className="w-full min-h-[48px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-emerald-500" /></label>
              <label className="space-y-1.5">
                <span className="text-xs font-black text-slate-700">Payment Type</span>
                <select value={salaryPaymentType} onChange={e => setSalaryPaymentType(e.target.value as NonNullable<Expense['payrollPaymentType']>)} className="w-full min-h-[48px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold">
                  <option value="salary">Salary</option>
                  <option value="wages">Wages</option>
                  <option value="allowance">Allowance</option>
                  <option value="bonus">Bonus</option>
                  <option value="overtime">Overtime</option>
                  <option value="advance_recovery">Advance Recovery</option>
                  <option value="other">Other Payment</option>
                </select>
              </label>
              <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Payment Method</span><input value={salaryPaymentMethod} readOnly className="w-full min-h-[48px] rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-bold text-slate-600" /></label>
              <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Money & Bank Account</span><select value={salaryPaymentAccount} onChange={e => { const id = e.target.value; setSalaryPaymentAccount(id); const account = paymentAccounts.find(candidate => candidate.id === id); setSalaryPaymentMethod(account?.paymentMethod || account?.name || ''); }} className="w-full min-h-[48px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold"><option value="">Select account</option>{paymentAccounts.map(account => <option key={account.id} value={account.id}>{account.name}{getMaskedAccountReference(account) ? ` — ${getMaskedAccountReference(account)}` : ''}</option>)}</select></label>
              <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Reference</span><input value={salaryPaymentReference} onChange={e => setSalaryPaymentReference(e.target.value)} className="w-full min-h-[48px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-mono font-bold" /></label>
              <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Branch</span><input value={activeBranchContext?.name || 'Primary business workspace'} readOnly className="w-full min-h-[48px] rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-bold text-slate-600" /></label>
              <label className="space-y-1.5 md:col-span-2"><span className="text-xs font-black text-slate-700">Notes</span><textarea value={salaryPaymentNotes} onChange={e => setSalaryPaymentNotes(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-emerald-500" /></label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-black text-slate-700">Optional Attachment</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (!file) return setSalaryPaymentAttachment(null);
                    if (file.size > 5 * 1024 * 1024) {
                      setSuccessMessage('Payroll attachment must be 5 MB or smaller.');
                      event.target.value = '';
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => setSalaryPaymentAttachment({ name: file.name, data: String(reader.result || '') });
                    reader.readAsDataURL(file);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold"
                />
                {salaryPaymentAttachment && <span className="block text-xs font-bold text-emerald-700">{salaryPaymentAttachment.name}</span>}
              </label>
            </div>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">Recent Payment History</h4>
              <div className="mt-3 space-y-2">
                {expenses.filter(expense => expense.staffId === staffToPay.id || (expense.staffName === staffToPay.name && expense.payrollPaymentType)).slice(0, 5).map(expense => (
                  <div key={expense.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-600">{new Date(expense.timestamp).toLocaleDateString()} · {(expense.payrollPaymentType || 'salary').replace('_', ' ')}</span>
                    <strong className="text-slate-900">{formatMoney(expense.amount)}</strong>
                  </div>
                ))}
                {!expenses.some(expense => expense.staffId === staffToPay.id || (expense.staffName === staffToPay.name && expense.payrollPaymentType)) && (
                  <p className="text-xs font-semibold text-slate-400">No payroll payments recorded for this staff member.</p>
                )}
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
              This payment will be recorded as <strong>Money Out</strong>, category{' '}
              <strong>
                {salaryPaymentType === 'allowance' ? 'Staff Allowance'
                  : salaryPaymentType === 'bonus' ? 'Staff Bonus'
                  : salaryPaymentType === 'overtime' ? 'Staff Overtime'
                  : salaryPaymentType === 'advance_recovery' ? 'Staff Advance Recovery'
                  : 'Wages & Salary'}
              </strong>, deducted from the selected Money & Bank account, and will appear automatically in Expenses, Profit & Loss and downloaded reports.
            </div>
          </div>
          <div className="shrink-0 border-t border-slate-100 p-4 md:p-5 grid grid-cols-2 gap-3 bg-white">
            <button type="button" onClick={() => setStaffToPay(null)} className="min-h-[50px] rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700">Cancel</button>
            <button type="button" onClick={confirmSalaryPayment} className="min-h-[50px] rounded-2xl bg-emerald-600 text-sm font-black text-white">Pay Staff</button>
          </div>
          </div>
        </div>
      )}

      {staffToRemove && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-staff-title"
          className="fixed inset-0 z-[90] bg-slate-950/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
        >
          <div className="w-full md:max-w-md rounded-t-[2rem] md:rounded-[2rem] bg-white p-5 md:p-6 shadow-2xl">
            <h3 id="remove-staff-title" className="text-lg font-black text-slate-950">Remove staff account?</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              This will remove <strong className="text-slate-900">{staffToRemove.name}</strong> from this business.
              Review the selected account before confirming.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStaffToRemove(null)}
                className="min-h-[48px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
              >
                Keep Staff
              </button>
              <button
                type="button"
                onClick={confirmRemoveStaff}
                className="min-h-[48px] rounded-2xl bg-red-600 px-4 text-sm font-black text-white"
              >
                Confirm Remove Staff
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedStaff && (
        <div className="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="w-full md:max-w-6xl max-h-[calc(100dvh-24px)] md:max-h-[92dvh] overflow-y-auto rounded-t-[2rem] md:rounded-[2rem] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 md:px-6 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {renderAvatar(selectedStaff, 'w-12 h-12')}
                <div className="min-w-0">
                  <h3 className="font-black text-slate-950 truncate">{selectedStaff.name}</h3>
                  <p className="text-xs font-semibold text-slate-500 truncate">Username: {selectedStaff.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportIndividualStaffPdf(selectedStaff)}
                  className="min-h-[40px] rounded-xl bg-slate-950 px-3 text-xs font-black text-white inline-flex items-center gap-2"
                >
                  <FileDown className="w-4 h-4" />
                  PDF
                </button>
                <button
                  type="button"
                  aria-label="Close staff profile"
                  onClick={() => {
                    setSelectedStaff(null);
                  }}
                  className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 md:p-6 space-y-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.95fr] gap-5">
                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4 md:p-5">
                  <div className="mb-4">
                    <h4 className="font-black text-slate-950">Profile Details</h4>
                    <p className="text-xs text-slate-500 mt-1">Phone number is the staff username/login identifier.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Full name</span>
                      <input value={selectedStaff.name} onChange={e => handleProfileFieldChange(selectedStaff.id, { name: e.target.value })} className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none" />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Phone / Username</span>
                      <input value={selectedStaff.phone} onChange={e => handleProfileFieldChange(selectedStaff.id, { phone: e.target.value })} className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none" />
                    </label>
                    <label className="space-y-1.5 md:col-span-2">
                      <span className="text-xs font-black text-slate-700">Gmail for Google login</span>
                      <input type="email" value={selectedStaff.email || ''} onChange={e => handleProfileFieldChange(selectedStaff.id, { email: e.target.value.toLowerCase() })} placeholder="staff@gmail.com" className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none" />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Role / Position</span>
                      <input value={selectedStaff.role} onChange={e => handleProfileFieldChange(selectedStaff.id, { role: e.target.value })} className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none" />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Staff Type</span>
                      <select value={selectedStaff.staffType || selectedStaff.classification || 'permanent'} onChange={e => handleProfileFieldChange(selectedStaff.id, { staffType: e.target.value as StaffSettings['staffType'] })} className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-black outline-none">
                        <option value="permanent">Permanent</option>
                        <option value="temporary">Temporary</option>
                        <option value="driver">Driver</option>
                        <option value="rider">Rider</option>
                        <option value="temporary-driver">Temporary driver</option>
                        <option value="temporary-rider">Temporary rider</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Department / Category</span>
                      <input value={selectedStaff.department || ''} onChange={e => handleProfileFieldChange(selectedStaff.id, { department: e.target.value })} placeholder="Not recorded" className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none" />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Status</span>
                      <select value={selectedStaff.status || 'active'} onChange={e => handleProfileFieldChange(selectedStaff.id, { status: e.target.value as StaffSettings['status'] })} className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-black outline-none">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Date Joined</span>
                      <input type="date" value={selectedStaff.dateJoined || ''} onChange={e => handleProfileFieldChange(selectedStaff.id, { dateJoined: e.target.value })} className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none" />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Notes</span>
                      <input value={selectedStaff.notes || ''} onChange={e => handleProfileFieldChange(selectedStaff.id, { notes: e.target.value })} placeholder="Optional notes/history" className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none" />
                    </label>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4 md:p-5">
                  <h4 className="font-black text-slate-950">Login & Access</h4>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white border border-slate-200 p-3">
                      <Lock className="w-4 h-4 text-indigo-600 mb-2" />
                      <span className="block text-[10px] font-black uppercase text-slate-400">Authentication</span>
                      <strong className="mt-1 block text-sm text-slate-900">Supabase Auth protected</strong>
                      <p className="mt-1 text-[11px] text-slate-500">No password is stored in workspace data.</p>
                    </div>
                    <div className="rounded-2xl bg-white border border-slate-200 p-3">
                      <Clock className="w-4 h-4 text-amber-600 mb-2" />
                      <span className="block text-[10px] font-black uppercase text-slate-400">Invitation status</span>
                      <strong className="mt-1 block text-sm text-slate-900">{selectedStaff.email ? 'Ready for secure invitation' : 'Gmail required'}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!selectedStaff.email}
                    onClick={() => void createGoogleInvitation(selectedStaff)
                      .then(() => setSuccessMessage('New Google invitation created. Copy and share the link below.'))
                      .catch(error => setSuccessMessage(error instanceof Error ? error.message : 'Invitation could not be created.'))}
                    className="mt-4 w-full min-h-[46px] rounded-2xl bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-black inline-flex items-center justify-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    Create / Replace Google Invitation
                  </button>
                  {invitationLink && (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                      <span className="block text-[10px] font-black uppercase text-emerald-700">Secure invitation link</span>
                      <button type="button" onClick={() => void navigator.clipboard.writeText(invitationLink)} className="mt-2 min-h-[40px] w-full rounded-xl bg-emerald-700 px-3 text-xs font-black text-white">Copy link</button>
                    </div>
                  )}
                </section>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-5">
                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4 md:p-5">
                  <h4 className="font-black text-slate-950">Salary Details</h4>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Basic Salary / Wage</span>
                      <input type="number" min="0" value={selectedStaff.salary || ''} onChange={e => handleProfileFieldChange(selectedStaff.id, { salary: Number(e.target.value) || 0 })} className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none" />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Salary Frequency</span>
                      <select value={selectedStaff.salaryType || 'monthly'} onChange={e => handleProfileFieldChange(selectedStaff.id, { salaryType: e.target.value as StaffSettings['salaryType'] })} className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-black outline-none">
                        <option value="monthly">Monthly salary</option>
                        <option value="weekly">Weekly salary</option>
                        <option value="daily">Daily wage</option>
                        <option value="commission">Commission-based</option>
                        <option value="custom">Custom period</option>
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Salary Start Date</span>
                      <input type="date" value={selectedStaff.salaryStartDate || ''} onChange={e => handleProfileFieldChange(selectedStaff.id, { salaryStartDate: e.target.value })} className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none" />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-black text-slate-700">Salary Notes</span>
                      <input value={selectedStaff.salaryNotes || ''} onChange={e => handleProfileFieldChange(selectedStaff.id, { salaryNotes: e.target.value })} placeholder="Optional" className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none" />
                    </label>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4 md:p-5">
                  <h4 className="font-black text-slate-950">Allowance / Posho Management</h4>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <select value={allowanceForm.name} onChange={e => setAllowanceForm(prev => ({ ...prev, name: e.target.value }))} className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-black outline-none">
                      {defaultAllowanceCategories.map(category => <option key={category} value={category}>{category}</option>)}
                      <option value="custom">Custom category</option>
                    </select>
                    <input type="number" min="0" value={allowanceForm.amount} onChange={e => setAllowanceForm(prev => ({ ...prev, amount: e.target.value }))} placeholder="Amount" className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none" />
                    <select value={allowanceForm.frequency} onChange={e => setAllowanceForm(prev => ({ ...prev, frequency: e.target.value as StaffAllowance['frequency'] }))} className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-black outline-none">
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="one-time">One-time</option>
                      <option value="custom">Custom</option>
                    </select>
                    {allowanceForm.name === 'custom' && (
                      <input value={allowanceForm.customName} onChange={e => setAllowanceForm(prev => ({ ...prev, customName: e.target.value }))} placeholder="Custom category" className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none md:col-span-3" />
                    )}
                    <input type="date" value={allowanceForm.startDate} onChange={e => setAllowanceForm(prev => ({ ...prev, startDate: e.target.value }))} className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none" />
                    <input type="date" value={allowanceForm.endDate} onChange={e => setAllowanceForm(prev => ({ ...prev, endDate: e.target.value }))} className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none" />
                    <button type="button" onClick={() => handleAddAllowance(selectedStaff)} className="min-h-[44px] rounded-xl bg-indigo-600 text-white text-xs font-black inline-flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add Allowance
                    </button>
                    <input value={allowanceForm.notes} onChange={e => setAllowanceForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Notes" className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none md:col-span-3" />
                  </div>

                  <div className="mt-4 space-y-2">
                    {(selectedStaff.allowances || []).length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs font-semibold text-slate-400">No allowances added.</div>
                    ) : (
                      (selectedStaff.allowances || []).map(allowance => (
                        <div key={allowance.id} className="rounded-2xl bg-white border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="font-black text-sm text-slate-900">{allowance.name}</div>
                            <div className="text-[11px] font-semibold text-slate-500">{formatMoney(allowance.amount)} · {allowance.frequency} · {allowance.startDate}{allowance.endDate ? ` to ${allowance.endDate}` : ''}</div>
                          </div>
                          <button type="button" onClick={() => handleRemoveAllowance(selectedStaff.id, allowance.id)} className="min-h-[38px] rounded-xl bg-rose-50 px-3 text-xs font-black text-rose-700 inline-flex items-center justify-center gap-1">
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>

              {(() => {
                const profileSummary = staffSummaries.get(selectedStaff.id) || buildStaffSummary(selectedStaff);
                const profilePayroll = calculateStaffPayroll(selectedStaff, payrollPeriod);
                return (
                  <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4 md:p-5">
                    <h4 className="font-black text-slate-950">Payroll & Performance Summary</h4>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {[
                        { label: 'Salary owed', value: formatMoney(profilePayroll.salaryTotal), icon: Wallet },
                        { label: 'Allowances', value: formatMoney(profilePayroll.allowancesTotal), icon: Plus },
                        { label: 'Total cost', value: formatMoney(profilePayroll.totalCost), icon: DollarSign },
                        { label: 'Orders handled', value: profileSummary.orders.toLocaleString(), icon: ClipboardList },
                        { label: 'Handled', value: formatMoney(profileSummary.totalHandled), icon: Briefcase },
                        { label: 'Profit generated', value: formatMoney(profileSummary.profitGenerated), icon: Activity },
                        { label: 'Sessions', value: profileSummary.sessionCount.toLocaleString(), icon: Smartphone },
                        { label: 'Time spent', value: formatDuration(profileSummary.totalDuration), icon: Clock }
                      ].map(item => (
                        <div key={item.label} className="rounded-2xl bg-white border border-slate-200 p-3">
                          <item.icon className="w-4 h-4 text-indigo-600 mb-2" />
                          <span className="block text-[10px] font-black uppercase text-slate-400">{item.label}</span>
                          <strong className="mt-1 block text-sm font-black text-slate-900">{item.value}</strong>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-xs text-slate-500">Attendance/work records and customer interaction records show as no data unless the system logs those events for this staff member.</p>
                  </section>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet Action Menu for Mobile/Tablet — same pattern as Sales */}
      <AnimatePresence>
        {mobileActionsStaff && (() => {
          const staff = mobileActionsStaff;
          const showPayStaff = payrollEnabled && canPayPayroll;
          return (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileActionsStaff(null)}
                className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 280 }}
                className="fixed left-0 right-0 max-w-lg mx-auto bg-white rounded-t-3xl shadow-xl z-[120] overflow-hidden font-sans flex flex-col text-[#0f172a] border border-slate-100"
                style={{ bottom: 'calc(var(--dashboard-bottom-nav-height, 56px) + env(safe-area-inset-bottom))', maxHeight: 'calc(85vh - var(--dashboard-bottom-nav-height, 56px) - env(safe-area-inset-bottom))' }}
              >
                <div className="w-full flex justify-center py-2 shrink-0">
                  <div className="w-12 h-1 bg-slate-250 rounded-full" />
                </div>

                <div className="px-5 pb-3 pt-1 text-left shrink-0 flex items-center gap-3">
                  {renderAvatar(staff, 'w-10 h-10')}
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold text-slate-800 leading-tight truncate">{staff.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-bold uppercase tracking-wide truncate">{staff.role}</p>
                  </div>
                </div>

                <div className="bg-slate-100 h-[1px] w-full" />

                <div className="overflow-y-auto divide-y divide-slate-100 p-4 max-h-[calc(70vh-20px)] space-y-2.5">
                  <button
                    type="button"
                    onClick={() => { openStaffProfile(staff); setMobileActionsStaff(null); }}
                    className="w-full h-14 min-h-[52px] bg-white hover:bg-slate-50 flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-slate-100 shadow-3xs cursor-pointer text-left transition-colors font-semibold"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 select-none">
                        <Eye className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-800 block">View Staff</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Profile, sessions and performance</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  {showPayStaff && (
                    <button
                      type="button"
                      onClick={() => { openSalaryPayment(staff); setMobileActionsStaff(null); }}
                      className="w-full h-14 min-h-[52px] bg-white hover:bg-slate-50 flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-slate-100 shadow-3xs cursor-pointer text-left transition-colors font-semibold"
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 select-none">
                          <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-slate-800 block">Pay Staff</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Record a salary payment</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => { openCredentialEditor(staff); setMobileActionsStaff(null); }}
                    className="w-full h-14 min-h-[52px] bg-white hover:bg-slate-50 flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-slate-100 shadow-3xs cursor-pointer text-left transition-colors font-semibold"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0 select-none">
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-800 block">Edit Staff</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Update login and role details</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  {!staff.isOwner ? (
                    <button
                      type="button"
                      onClick={() => { handleDeleteStaff(staff.id); setMobileActionsStaff(null); }}
                      className="w-full h-14 min-h-[52px] bg-rose-50/30 hover:bg-rose-50 flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-rose-100 shadow-3xs cursor-pointer text-left transition-colors font-semibold text-rose-600"
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0 select-none">
                          <Trash2 className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-sm font-black block text-rose-700">Delete Staff</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Remove this account permanently</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-rose-400" />
                    </button>
                  ) : (
                    <div className="w-full px-3.5 py-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 font-black text-sm flex items-center gap-2">
                      👑 Account Owner
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
