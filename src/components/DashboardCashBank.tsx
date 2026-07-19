import React, { useState, useEffect } from 'react';
import { Tenant, Sale, Expense, PaymentChannel, LedgerEntry, User as AppUser } from '../types';
import { isDemoTenant } from '../utils/tenantIsolation';
import { safeSetJsonItem } from '../utils/dataSafety';
import {
  getPaymentType,
  getChannelIdForPayment,
  groupSalesByPaymentType,
  normalizePaymentModes,
  classifyPaymentMode,
  PAYMENT_TYPE_LABELS,
  PAYMENT_TYPE_COLORS,
  PAYMENT_TYPE_ICONS,
  PaymentType,
} from '../utils/paymentClassifier';
import { 
  Landmark, 
  Wallet, 
  Coins, 
  Calendar, 
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Plus, 
  CheckCircle, 
  Search, 
  Filter, 
  Clock, 
  User, 
  Download, 
  AlertCircle, 
  ChevronDown, 
  ChevronRight,
  FileText,
  Building,
  RefreshCw,
  PlusCircle,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Send,
  BarChart3,
  Eye,
  X
} from 'lucide-react';

interface DashboardCashBankProps {
  activeTenant: Tenant;
  sales: Sale[];
  expenses: Expense[];
  deliveries?: any[];
  user?: AppUser;
  systemSettings?: any;
  onUpdateSystemSettings?: (updated: any) => void;
}

export default function DashboardCashBank({ 
  activeTenant, 
  sales, 
  expenses,
  deliveries = [],
  user,
  systemSettings,
  onUpdateSystemSettings
}: DashboardCashBankProps) {
  const hasDemoSeedData = isDemoTenant(activeTenant.id);
  // Date interval settings state with user-friendly names
  const [datePreset, setDatePreset] = useState<'today' | '1week' | '1month' | 'custom'>('1month');
  // Mobile-only section tabs
  const [mobileSectionTab, setMobileSectionTab] = useState<'overview' | 'accounts' | 'transfer' | 'audit'>('overview');
  const [desktopTab, setDesktopTab] = useState<'overview' | 'accounts' | 'transfer' | 'history'>('overview');

  // On mount: migrate any existing channels from dedicated onlineStorage key into systemSettings
  // This ensures existing user data is not lost when moving to new persistence model
  useEffect(() => {
    if (!onUpdateSystemSettings || !systemSettings) return;
    // Only migrate if systemSettings doesn't already have channels saved
    if (systemSettings.paymentChannels && systemSettings.paymentChannels.length > 0) return;
    const cached = onlineStorage.getItem(`jasper_channels_${activeTenant.id}`);
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.length > 0) {
        // Migrate: save channels into systemSettings
        const updatedSettings = { ...systemSettings, paymentChannels: parsed };
        onUpdateSystemSettings(updatedSettings);
        safeSetJsonItem(`jasper_settings_${activeTenant.id}`, updatedSettings, {
          tenantId: activeTenant.id,
          dataKey: 'settings',
          logLabel: `${activeTenant.id}/settings`,
        });
      }
    } catch (e) { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Helpers to get dates
  const getTodayRange = () => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const getRelativeRange = (days: number) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(end.getDate() - (days > 0 ? days - 1 : 0));
    start.setHours(0, 0, 0, 0);
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const [startDateStr, setStartDateStr] = useState<string>(() => {
    return getRelativeRange(30).start.slice(0, 10);
  });
  const [endDateStr, setEndDateStr] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Calculate dates based on option selected
  const getFilterBoundaries = () => {
    let startIso = '';
    let endIso = '';
    
    if (datePreset === 'today') {
      const range = getTodayRange();
      startIso = range.start;
      endIso = range.end;
    } else if (datePreset === '1week') {
      const range = getRelativeRange(7);
      startIso = range.start;
      endIso = range.end;
    } else if (datePreset === '1month') {
      const range = getRelativeRange(30);
      startIso = range.start;
      endIso = range.end;
    } else {
      const startObj = new Date(startDateStr);
      startObj.setHours(0, 0, 0, 0);
      const endObj = new Date(endDateStr);
      endObj.setHours(23, 59, 59, 999);
      startIso = startObj.toISOString();
      endIso = endObj.toISOString();
    }
    return { startIso, endIso };
  };

  const { startIso: filterStart, endIso: filterEnd } = getFilterBoundaries();

  // Basic payment and banking channels
  const defaultBaseChannels: PaymentChannel[] = [
    // Mobile Money
    { id: 'mpesa-till', name: 'M-Pesa Till (Lipa namba)', category: 'telco', provider: 'Vodacom Tanzania', accountNumber: '556677' },
    { id: 'mobile-merchant', name: 'Mobile Money Account', category: 'telco', provider: 'Mobile', accountNumber: '' },
    { id: 'airtel-merchant', name: 'Airtel Money Paybill', category: 'telco', provider: 'Airtel', accountNumber: '881122' },
    
    // Bank Accounts
    { id: 'crdb-corporate', name: 'CRDB Business Account', category: 'bank', provider: 'CRDB Bank', accountNumber: '0150294811000' },
    { id: 'nmb-checking', name: 'NMB Office Account', category: 'bank', provider: 'NMB Bank Plc', accountNumber: '221100554492' },
    { id: 'pos-card-terminal', name: 'POS Card Machine', category: 'bank', provider: 'CRDB / Visa', accountNumber: 'TERM-99120' },
    
    // Cash Drawer Points
    { id: 'counter-01', name: 'Cash Counter Drawer 01', category: 'physical', provider: 'Main Desk Front', accountNumber: 'DRAWER-01' },
    { id: 'office-safe', name: 'Main Office Safe', category: 'physical', provider: 'Locked Vault', accountNumber: 'SAFE-A2' }
  ];

  // ledger entries matching active accounts
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  
  const [channels, setChannels] = useState<PaymentChannel[]>(() => {
    // Priority 1: systemSettings.paymentChannels
    if (systemSettings?.paymentChannels && systemSettings.paymentChannels.length > 0) {
      return systemSettings.paymentChannels;
    }
    // Priority 2: onlineStorage cache
    const cached = onlineStorage.getItem(`jasper_channels_${activeTenant.id}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    // Priority 3: Auto-generate from user's registered payment modes
    const rawModes = systemSettings?.business?.paymentModes || [];
    const configModes = normalizePaymentModes(rawModes as any[]);
    if (configModes.length > 0) {
      return configModes.map((m, i) => {
        const type = classifyPaymentMode(m.name);
        const category: PaymentChannel['category'] =
          type === 'mobile_money' ? 'telco' :
          type === 'bank' || type === 'card' ? 'bank' :
          type === 'credit' ? 'person' : 'physical';
        return {
          id: `auto-${i}-${m.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: m.name,
          category,
          provider: m.name,
          accountNumber: '',
        } as PaymentChannel;
      });
    }
    return hasDemoSeedData ? defaultBaseChannels : [];
  });

  // Custom accounts form states
  const [newAccType, setNewAccType] = useState<'bank' | 'telco' | 'person'>('bank');
  const [newAccProvider, setNewAccProvider] = useState<string>('');
  const [newAccName, setNewAccName] = useState<string>('');
  const [newAccNumber, setNewAccNumber] = useState<string>('');
  const [addAccountSuccess, setAddAccountSuccess] = useState<string | null>(null);

  // Validation flags for Strict Security Rule
  const [showRuleWarning, setShowRuleWarning] = useState<boolean>(false);
  
  // Interactive collapse and click tracking
  const [expandedTelco, setExpandedTelco] = useState<boolean>(false);
  const [expandedBank, setExpandedBank] = useState<boolean>(false);
  const [expandedPhysical, setExpandedPhysical] = useState<boolean>(false);

  // Funds transfer form states
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleSource, setSettleSource] = useState<string>(() => hasDemoSeedData ? 'counter-01' : '');
  const [settleTarget, setSettleTarget] = useState<string>(() => hasDemoSeedData ? 'crdb-corporate' : '');
  const [settleMemo, setSettleMemo] = useState<string>('');
  const [attachedReceiptName, setAttachedReceiptName] = useState<string>('');
  const [attachedMuamalaName, setAttachedMuamalaName] = useState<string>('');
  const [settleSuccessMsg, setSettleSuccessMsg] = useState<string | null>(null);

  // Search and general filter options
  const [auditSearch, setAuditSearch] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState<'ALL' | 'POS_CHECKOUT' | 'SETTLE_TILL_DEPOSIT' | 'EXPENSE_WITHDRAWAL'>('ALL');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('all');

  // Sync date selection presets
  useEffect(() => {
    if (datePreset !== 'custom') {
      let relativeDays = 30;
      if (datePreset === 'today') relativeDays = 0;
      else if (datePreset === '1week') relativeDays = 7;
      else if (datePreset === '1month') relativeDays = 30;
      
      const range = getRelativeRange(relativeDays);
      setStartDateStr(range.start.slice(0, 10));
      setEndDateStr(range.end.slice(0, 10));
    }
  }, [datePreset]);

  // Read transactions, seeded balances, and link them to accounts
  useEffect(() => {
    const storageKey = `jasper_cash_bank_matrix_${activeTenant.id}`;
    const cached = onlineStorage.getItem(storageKey);
    const generated: LedgerEntry[] = [];

    // Base funds in each account at startup
    const seedBalances = [
      { id: 'initial-mpesa', channelId: 'mpesa-till', amount: 1500000, desc: 'Starting balance in wallet' },
      { id: 'initial-crdb', channelId: 'crdb-corporate', amount: 8000000, desc: 'Starting balance in main bank account' },
      { id: 'initial-nmb', channelId: 'nmb-checking', amount: 4500000, desc: 'Starting balance in secondary checking account' },
      { id: 'initial-drawer1', channelId: 'counter-01', amount: 350000, desc: 'Starting cash float for till 01' },
      { id: 'initial-safe', channelId: 'office-safe', amount: 2500000, desc: 'Starting reserve cash inside lock safe' }
    ];

    (hasDemoSeedData ? seedBalances : []).forEach(seed => {
      generated.push({
        id: seed.id,
        tenantId: activeTenant.id,
        channelId: seed.channelId,
        amount: seed.amount,
        entryType: 'credit',
        sourceType: 'INITIAL_BALANCE',
        description: seed.desc,
        timestamp: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
      });
    });

    const configuredModes = normalizePaymentModes(systemSettings?.business?.paymentModes || []);

    const getPaymentChannel = (methodName: string, reference: string) => {
      const targetChannelId = getChannelIdForPayment(methodName, configuredModes, channels);
      const type = getPaymentType(methodName, configuredModes);
      const typeLabel = PAYMENT_TYPE_LABELS[type];
      const desc = `${typeLabel} payment received — Ref: ${reference}`;
      return { targetChannelId, desc };
    };

    // Link incoming sales to correct payment methods automatically
    sales.forEach(sale => {
      const saleAmount = Math.max(0, sale.total - (sale.deliveryCost || 0));
      const breakdown = Array.isArray(sale.paymentBreakdown) && sale.paymentBreakdown.length > 0
        ? sale.paymentBreakdown
        : [{ method: sale.paymentMethod || 'Cash', amount: saleAmount }];

      breakdown.forEach((part, index) => {
        const amount = Math.max(0, Number(part.amount || 0));
        if (amount <= 0) return;
        const { targetChannelId, desc } = getPaymentChannel(part.method || sale.paymentMethod || 'Cash', sale.reference);

        generated.push({
          id: `POS-RECON-${sale.id}-${index}`,
          tenantId: activeTenant.id,
          channelId: targetChannelId,
          amount,
          entryType: 'credit',
          sourceType: 'POS_CHECKOUT',
          description: desc,
          timestamp: sale.timestamp
        });
      });
    });

    // Track loose counter payments for business expenses
    expenses.forEach(exp => {
      generated.push({
        id: `EXP-WITHDR-${exp.id}`,
        tenantId: activeTenant.id,
        channelId: 'counter-01',
        amount: -exp.amount,
        entryType: 'debit',
        sourceType: 'EXPENSE_WITHDRAWAL',
        description: `Expense payout with safe drawer cash: ${exp.description} (${exp.category})`,
        timestamp: exp.date ? new Date(exp.date).toISOString() : (exp.timestamp || new Date().toISOString())
      });
    });

    // Track delivery incomes
    deliveries.forEach(del => {
      if (!del.fee && !del.deliveryCost) return;
      const amt = (del.fee || del.deliveryCost || 0);
      if (amt <= 0) return;

      const delivMethod = del.deliveryPaymentMethod || 'Cash';
      const { targetChannelId, desc: delivDesc } = getPaymentChannel(delivMethod, del.id);
      const desc = delivDesc.replace('payment received', 'delivery payment');

      generated.push({
        id: `DELIVERY-INC-${del.id}`,
        tenantId: activeTenant.id,
        channelId: targetChannelId,
        amount: amt,
        entryType: 'credit',
        sourceType: 'POS_CHECKOUT',
        description: desc,
        timestamp: del.timestamp || new Date().toISOString()
      });
    });

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const manualSettles = parsed.filter((entry: LedgerEntry) => entry.sourceType === 'SETTLE_TILL_DEPOSIT');
          const merged = [...generated, ...manualSettles];
          setLedgerEntries(merged);
          return;
        }
      } catch (err) {
        console.error('Failed to parse cache:', err);
      }
    }

    const defaultSettleDrops: LedgerEntry[] = [
      {
        id: 'SETTLE-INIT-01',
        tenantId: activeTenant.id,
        channelId: 'counter-01',
        amount: -300000,
        entryType: 'debit',
        sourceType: 'SETTLE_TILL_DEPOSIT',
        description: 'Deposited drawer cash to CRDB Bank account',
        timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        counterPartyChannelId: 'crdb-corporate'
      },
      {
        id: 'SETTLE-INIT-02',
        tenantId: activeTenant.id,
        channelId: 'crdb-corporate',
        amount: 300000,
        entryType: 'credit',
        sourceType: 'SETTLE_TILL_DEPOSIT',
        description: 'Received drawer cash deposit from Counter Drawer 01',
        timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        counterPartyChannelId: 'counter-01'
      }
    ];

    const finalInitial = [...generated, ...(hasDemoSeedData ? defaultSettleDrops : [])];
    setLedgerEntries(finalInitial);
    safeSetJsonItem(storageKey, finalInitial, {
      tenantId: activeTenant.id,
      dataKey: 'cash_bank_matrix',
      logLabel: `${activeTenant.id}/cash-bank-matrix`,
    });
  }, [activeTenant.id, sales, expenses, deliveries, hasDemoSeedData]);

  // Update cached file local records
  const saveLedgerState = (entriesList: LedgerEntry[]) => {
    setLedgerEntries(entriesList);
    safeSetJsonItem(`jasper_cash_bank_matrix_${activeTenant.id}`, entriesList, {
      tenantId: activeTenant.id,
      dataKey: 'cash_bank_matrix',
      logLabel: `${activeTenant.id}/cash-bank-matrix`,
    });
  };

  // Carry out safe transfer action between registers and accounts/wallets
  const handleExecuteSettleTill = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(settleAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('⚠️ Please enter an amount higher than 0 TZS.');
      return;
    }

    if (settleSource === settleTarget) {
      alert('⚠️ You cannot transfer money to the same account!');
      return;
    }

    if (!attachedReceiptName && !attachedMuamalaName) {
      setShowRuleWarning(true);
      return;
    }

    const sourceChan = channels.find(c => c.id === settleSource);
    const targetChan = channels.find(c => c.id === settleTarget);
    if (!sourceChan || !targetChan) return;

    const txId = `SETTLE-TX-${Date.now().toString().slice(-6)}`;
    const timestampStr = new Date().toISOString();
    const authorizerName = user?.name || user?.email || 'Authorized Staff';
    const isPersonPayout = targetChan.category === 'person';
    const descText = settleMemo.trim() || (isPersonPayout
      ? `Sent money from ${sourceChan.name} to ${targetChan.name}`
      : `Transferred money from ${sourceChan.name} to ${targetChan.name}`);

    const debitItem: LedgerEntry = {
      id: `${txId}-DEB`,
      tenantId: activeTenant.id,
      channelId: settleSource,
      amount: -amountVal,
      entryType: 'debit',
      sourceType: 'SETTLE_TILL_DEPOSIT',
      description: `${descText} (Handled by: ${authorizerName})`,
      timestamp: timestampStr,
      counterPartyChannelId: settleTarget,
      referenceId: txId,
      receiptFile: attachedReceiptName || undefined,
      muamalaFile: attachedMuamalaName || undefined
    };

    const creditItem: LedgerEntry | null = isPersonPayout ? null : {
      id: `${txId}-CRE`,
      tenantId: activeTenant.id,
      channelId: settleTarget,
      amount: amountVal,
      entryType: 'credit',
      sourceType: 'SETTLE_TILL_DEPOSIT',
      description: `${descText} (Handled by: ${authorizerName})`,
      timestamp: timestampStr,
      counterPartyChannelId: settleSource,
      referenceId: txId,
      receiptFile: attachedReceiptName || undefined,
      muamalaFile: attachedMuamalaName || undefined
    };

    const updated = creditItem ? [...ledgerEntries, debitItem, creditItem] : [...ledgerEntries, debitItem];
    saveLedgerState(updated);

    setSettleAmount('');
    setSettleMemo('');
    setAttachedReceiptName('');
    setAttachedMuamalaName('');
    setShowRuleWarning(false);
    setSettleSuccessMsg(
      isPersonPayout
        ? `Payment sent! ${amountVal.toLocaleString()} ${activeTenant.currencyCode || 'TZS'} recorded as outflow from "${sourceChan.name}" to "${targetChan.name}".`
        : `Transfer Completed! Moved ${amountVal.toLocaleString()} ${activeTenant.currencyCode || 'TZS'} successfully from "${sourceChan.name}" to "${targetChan.name}".`
    );
    setTimeout(() => {
      setSettleSuccessMsg(null);
    }, 6000);
  };

  const handleCreateAccount = () => {
    if (!newAccProvider.trim()) {
      alert(`⚠️ Please provide a ${newAccType === 'bank' ? 'Bank Name' : newAccType === 'person' ? 'Bank or Mobile Money Name' : 'Mobile Provider Name'}.`);
      return;
    }
    if (!newAccName.trim()) {
      alert(`⚠️ Please provide ${newAccType === 'person' ? 'the recipient name' : 'an Account Name'}.`);
      return;
    }
    if (!newAccNumber.trim()) {
      alert(`⚠️ Please provide ${newAccType === 'bank' ? 'Account Number / IBAN' : newAccType === 'person' ? 'Account Number or Mobile Number' : 'Mobile Number / Till Code'}.`);
      return;
    }

    const newChanId = `custom-${Date.now()}`;
    const newChan: PaymentChannel = {
      id: newChanId,
      name: newAccName,
      category: newAccType,
      provider: newAccProvider,
      accountNumber: newAccNumber
    };

    const updated = [...channels, newChan];
    setChannels(updated);
    // Save to dedicated onlineStorage key (for fast init)
    safeSetJsonItem(`jasper_channels_${activeTenant.id}`, updated, {
      tenantId: activeTenant.id,
      dataKey: 'channels',
      logLabel: `${activeTenant.id}/channels`,
    });
    // ALSO save to systemSettings so channels persist reliably across sessions
    if (onUpdateSystemSettings && systemSettings) {
      const updatedSettings = { ...systemSettings, paymentChannels: updated };
      onUpdateSystemSettings(updatedSettings);
      safeSetJsonItem(`jasper_settings_${activeTenant.id}`, updatedSettings, {
        tenantId: activeTenant.id,
        dataKey: 'settings',
        logLabel: `${activeTenant.id}/settings`,
      });
    }

    // Autofill transfer fields with this brand new target account
    setSettleTarget(newChanId);

    setNewAccProvider('');
    setNewAccName('');
    setNewAccNumber('');
    setAddAccountSuccess(newAccType === 'person' ? 'Recipient added and loaded into send options!' : 'Account successfully added and loaded into options!');
    setTimeout(() => {
      setAddAccountSuccess(null);
    }, 4000);
  };

  // Convert numbers to clean money texts
  const formatCurrency = (val: number) => {
    const rounded = Math.round(val);
    const sign = rounded < 0 ? '-' : '';
    const absVal = Math.abs(rounded);
    return `${sign}${absVal.toLocaleString()} ${activeTenant.currencyCode || 'TZS'}`;
  };

  const activeTenantFilterLedger = ledgerEntries.filter(entry => {
    const isMatchedTenant = entry.tenantId === activeTenant.id;
    const isWithinDate = entry.timestamp >= filterStart && entry.timestamp <= filterEnd;
    return isMatchedTenant && isWithinDate;
  });

  // Keep track of how much cash is in each device/account
  const getChannelAggregateBalances = () => {
    const aggregates: Record<string, { current: number; inflowSales: number; inflowDrops: number; totalMoneyIn: number }> = {};
    
    channels.forEach(chan => {
      aggregates[chan.id] = { current: 0, inflowSales: 0, inflowDrops: 0, totalMoneyIn: 0 };
    });

    ledgerEntries.forEach(entry => {
      if (entry.tenantId !== activeTenant.id) return;
      
      const targetChan = aggregates[entry.channelId];
      if (targetChan) {
        targetChan.current += entry.amount;

        const isWithinFilter = entry.timestamp >= filterStart && entry.timestamp <= filterEnd;
        if (isWithinFilter && entry.amount > 0) {
          if (entry.sourceType === 'POS_CHECKOUT') {
            targetChan.inflowSales += entry.amount;
            targetChan.totalMoneyIn += entry.amount;
          } else if (entry.sourceType === 'SETTLE_TILL_DEPOSIT') {
            targetChan.inflowDrops += entry.amount;
            targetChan.totalMoneyIn += entry.amount;
          }
        }
      }
    });

    return aggregates;
  };

  const channelBalances = getChannelAggregateBalances();

  // Combine categories to get total amounts
  const getCategoryTotals = () => {
    let physicalTotal = 0;
    let telcoTotal = 0;
    let bankTotal = 0;

    channels.forEach(chan => {
      const bal = channelBalances[chan.id]?.current || 0;
      if (chan.category === 'physical') {
        physicalTotal += bal;
      } else if (chan.category === 'telco') {
        telcoTotal += bal;
      } else if (chan.category === 'bank') {
        bankTotal += bal;
      }
    });

    return { physicalTotal, telcoTotal, bankTotal };
  };

  const categoryTotals = getCategoryTotals();
  const treasurySummaryCards = [
    {
      label: 'Available Balance',
      value: formatCurrency(
        channels
          .filter(chan => chan.category !== 'person')
          .reduce((sum, chan) => sum + (channelBalances[chan.id]?.current || 0), 0)
      ),
      tone: 'bg-slate-950 text-white border-slate-900',
      helper: `${channels.filter(chan => chan.category !== 'person').length} active accounts`
    },
  ];

  // Consolidated System Statistics (Responds to date range and links all payment modes)
  const getCombinedPerformanceStats = () => {
    let totalMoneyIn = 0;
    let totalMoneyOut = 0;
    let countMoneyIn = 0;
    let countMoneyOut = 0;

    activeTenantFilterLedger.forEach(entry => {
      if (entry.entryType === 'credit' || entry.amount >= 0) {
        totalMoneyIn += entry.amount;
        countMoneyIn++;
      } else {
        totalMoneyOut += Math.abs(entry.amount);
        countMoneyOut++;
      }
    });

    const totalCurrentRemainingBalance = channels
      .filter(chan => chan.category !== 'person')
      .reduce((sum, chan) => sum + (channelBalances[chan.id]?.current || 0), 0);
    const netChange = totalMoneyIn - totalMoneyOut;

    return {
      totalMoneyIn,
      totalMoneyOut,
      countMoneyIn,
      countMoneyOut,
      totalCurrentRemainingBalance,
      netChange
    };
  };

  const combinedStats = getCombinedPerformanceStats();

  // Export report to CSV computer file
  const downloadAuditReportCSV = () => {
    const headers = 'Date,Reference ID,Type,Where,Account No,Sent To,Sent To Number,Entry Type,Amount,Note\n';
    const rows = activeTenantFilterLedger
      .map(entry => {
        const chan = channels.find(c => c.id === entry.channelId);
        const counterParty = entry.counterPartyChannelId ? channels.find(c => c.id === entry.counterPartyChannelId) : undefined;
        return `"${entry.timestamp}","${entry.id}","${entry.sourceType}","${chan?.name || 'N/A'}","${chan?.accountNumber || ''}","${counterParty?.name || ''}","${counterParty?.accountNumber || ''}","${entry.entryType}",${entry.amount},"${entry.description}"`;
      })
      .join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `money_report_${activeTenant.id}_${datePreset}.csv`);
    a.click();
  };

  // Free text search inside transaction log
  const searchedAuditTrail = activeTenantFilterLedger.filter(entry => {
    // If a specific payment mode is selected, only show transactions belonging to it
    if (selectedChannelId !== 'all' && entry.channelId !== selectedChannelId) {
      return false;
    }

    const chan = channels.find(c => c.id === entry.channelId);
    const counterParty = entry.counterPartyChannelId ? channels.find(c => c.id === entry.counterPartyChannelId) : undefined;
    const rawString = `${entry.description} ${entry.id} ${chan?.name || ''} ${counterParty?.name || ''} ${counterParty?.accountNumber || ''} ${entry.sourceType}`.toLowerCase();
    
    const matchesSearch = rawString.includes(auditSearch.toLowerCase());
    const matchesPresetType = auditTypeFilter === 'ALL' || entry.sourceType === auditTypeFilter;

    return matchesSearch && matchesPresetType;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="w-full pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-8 select-text">

      {/* ══════════════════════════════════════════════════════════════
          MOBILE REDESIGN — native premium app experience (xl:hidden)
      ══════════════════════════════════════════════════════════════ */}
      <div className="xl:hidden space-y-3">

        {/* HERO HEADER */}
        <div className="rounded-3xl overflow-hidden relative"
          style={{background:'linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f2027 100%)'}}>
          <div className="absolute top-0 right-0 w-36 h-36 rounded-full opacity-5" style={{background:'white'}}/>
          <div className="px-5 pt-6 pb-5 relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Treasury</p>
                <h1 className="text-white font-black text-[22px] leading-tight mt-0.5">Money & Bank</h1>
                <p className="text-white/50 text-[10px] mt-0.5">
                  {datePreset === 'today' ? 'Today' : datePreset === '1week' ? 'Last 7 days' : datePreset === '1month' ? 'Last 30 days' : `${startDateStr} → ${endDateStr}`}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{background:'rgba(255,255,255,0.08)'}}>
                <Landmark className="w-6 h-6 text-emerald-400"/>
              </div>
            </div>

            {/* Big net figure */}
            <div className="mb-3">
              <p className="text-white/50 text-[11px] font-bold uppercase tracking-widest mb-1">Net Collected</p>
              <p className={`font-black text-[34px] leading-none ${combinedStats.netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {combinedStats.netChange >= 0 ? '+' : ''}{formatCurrency(combinedStats.netChange)}
              </p>
            </div>

            {/* KPI row — full words, same font size */}
            <div className="flex gap-2 mt-2">
              <div className="flex-1 rounded-xl px-3 py-2.5" style={{background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.2)'}}>
                <p className="text-emerald-400 text-[9px] font-black uppercase tracking-wider">Money In</p>
                <p className="text-white font-black text-[12px] mt-0.5 leading-none">+{formatCurrency(combinedStats.totalMoneyIn)}</p>
              </div>
              <div className="flex-1 rounded-xl px-3 py-2.5" style={{background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.2)'}}>
                <p className="text-rose-400 text-[9px] font-black uppercase tracking-wider">Money Out</p>
                <p className="text-white font-black text-[12px] mt-0.5 leading-none">-{formatCurrency(combinedStats.totalMoneyOut)}</p>
              </div>
              <div className="flex-1 rounded-xl px-3 py-2.5" style={{background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.2)'}}>
                <p className="text-indigo-400 text-[9px] font-black uppercase tracking-wider">Transactions</p>
                <p className="text-white font-black text-[12px] mt-0.5 leading-none">{combinedStats.countMoneyIn + combinedStats.countMoneyOut}</p>
              </div>
            </div>

            {/* Payment breakdown — registered modes only, no legacy modes */}
            {(() => {
              const configModes = normalizePaymentModes(systemSettings?.business?.paymentModes || []);
              if (configModes.length === 0) return null;
              const { startIso, endIso } = getFilterBoundaries();
              const salesInRange = sales.filter((s: any) => {
                const t = s.timestamp || s.createdAt || '';
                return t >= startIso && t <= endIso && s.paymentStatus !== 'Pending';
              });
              // Only count user's registered modes — ignore all others (Mixx by Yas, etc)
              const byMode: Record<string, number> = {};
              configModes.forEach(m => { byMode[m.name] = 0; });
              salesInRange.forEach((s: any) => {
                const breakdown = Array.isArray(s.paymentBreakdown) && s.paymentBreakdown.length > 0
                  ? s.paymentBreakdown
                  : [{ method: s.paymentMethod || 'Cash', amount: s.amountPaid ?? s.total }];
                breakdown.forEach((p: any) => {
                  const mName = (p.method || s.paymentMethod || 'Cash').trim();
                  const match = configModes.find(m =>
                    m.name.toLowerCase().trim() === mName.toLowerCase() ||
                    mName.toLowerCase().includes(m.name.toLowerCase()) ||
                    m.name.toLowerCase().includes(mName.toLowerCase())
                  );
                  if (match) byMode[match.name] = (byMode[match.name] || 0) + Math.max(0, Number(p.amount || 0));
                });
              });
              const total = Object.values(byMode).reduce((a, b) => a + b, 0);
              if (total === 0) return null;
              return (
                <div className="mt-3 space-y-2.5">
                  {Object.entries(byMode).filter(([, amt]) => amt > 0).map(([mode, amt]) => {
                    const config = configModes.find(m => m.name === mode);
                    const type = getPaymentType(mode, configModes);
                    const colors = PAYMENT_TYPE_COLORS[type];
                    const pct = Math.round((amt / total) * 100);
                    return (
                      <div key={mode} className="flex items-center gap-2">
                        {config?.logoUrl
                          ? <img src={config.logoUrl} className="w-4 h-4 object-contain rounded shrink-0" alt={mode}/>
                          : <span className="text-[10px] shrink-0">{PAYMENT_TYPE_ICONS[type]}</span>
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-white/80 text-[11px] font-bold truncate">{mode}</span>
                            <span className="text-white/60 text-[11px] font-mono ml-2 shrink-0">{formatCurrency(amt)}</span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{background:'rgba(255,255,255,0.1)'}}>
                            <div className="h-full rounded-full" style={{width:`${pct}%`, background: colors.text}} />
                          </div>
                        </div>
                        <span className="text-white/50 text-[10px] font-bold shrink-0 w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Date preset chips */}
          <div className="flex gap-1.5 px-5 pb-4">
            {(['today','1week','1month'] as const).map(p => (
              <button key={p} type="button" onClick={() => setDatePreset(p)}
                className="flex-1 py-1.5 rounded-xl text-[10px] font-bold"
                style={{background:datePreset===p?'rgba(255,255,255,0.18)':'rgba(255,255,255,0.07)',color:datePreset===p?'#fff':'rgba(255,255,255,0.5)'}}>
                {p==='today'?'Today':p==='1week'?'7 Days':'30 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* SECTION TAB NAV */}
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
          {([
            {id:'overview', label:'Overview', icon:<BarChart3 className="w-4 h-4"/>},
            {id:'accounts', label:'Accounts', icon:<Landmark className="w-4 h-4"/>},
            {id:'transfer', label:'Transfer', icon:<Send className="w-4 h-4"/>},
            {id:'audit',    label:'History',  icon:<Clock className="w-4 h-4"/>},
          ] as const).map(tab => {
            const active = mobileSectionTab === tab.id;
            return (
              <button key={tab.id} type="button" onClick={() => setMobileSectionTab(tab.id)}
                className="flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl gap-0.5"
                style={{background:active?'#0f172a':'transparent'}}>
                <span style={{color:active?'#34d399':'#94a3b8'}}>{tab.icon}</span>
                <span className="text-[9px] font-bold" style={{color:active?'#fff':'#94a3b8'}}>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── OVERVIEW SECTION ── */}
        {mobileSectionTab === 'overview' && (
          <div className="space-y-3">
            {/* Available Balance card */}
            {treasurySummaryCards.map((card) => (
              <div key={card.label}
                className={`rounded-2xl p-4 ${card.tone}`}
                style={{border:'1px solid rgba(0,0,0,0.06)'}}>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-70 font-mono">{card.label}</p>
                <p className="text-[17px] font-black leading-tight mt-1.5">{card.value}</p>
                <p className="text-[9px] font-bold opacity-60 mt-1">{card.helper}</p>
              </div>
            ))}

            {/* Revenue by payment mode — only user's registered modes + Credit */}
            {(() => {
              const configModes = normalizePaymentModes(systemSettings?.business?.paymentModes || []);
              const { startIso, endIso } = getFilterBoundaries();
              const salesInRange = sales.filter((s: any) => {
                const t = s.timestamp || s.createdAt || '';
                return t >= startIso && t <= endIso && s.paymentStatus !== 'Pending';
              });

              // Build per-mode totals — only for modes user has registered
              const registeredNames = new Set(configModes.map(m => m.name.toLowerCase().trim()));
              const byMode: Record<string, {amount: number; config: typeof configModes[0]}> = {};

              // Pre-populate with registered modes (so they appear even if 0)
              configModes.forEach(m => { byMode[m.name] = { amount: 0, config: m }; });

              // Also track credit separately
              let creditTotal = 0;

              salesInRange.forEach((s: any) => {
                const breakdown = Array.isArray(s.paymentBreakdown) && s.paymentBreakdown.length > 0
                  ? s.paymentBreakdown
                  : [{ method: s.paymentMethod || 'Cash', amount: s.amountPaid ?? s.total }];
                breakdown.forEach((p: any) => {
                  const mName = (p.method || s.paymentMethod || 'Cash').trim();
                  const type = getPaymentType(mName, configModes);
                  if (type === 'credit') {
                    creditTotal += Math.max(0, Number(p.amount || 0));
                  } else if (registeredNames.has(mName.toLowerCase())) {
                    // Match to registered mode
                    const key = configModes.find(m => m.name.toLowerCase().trim() === mName.toLowerCase())?.name || mName;
                    if (byMode[key]) byMode[key].amount += Math.max(0, Number(p.amount || 0));
                  } else {
                    // Try partial match
                    const partial = configModes.find(m => mName.toLowerCase().includes(m.name.toLowerCase()) || m.name.toLowerCase().includes(mName.toLowerCase()));
                    if (partial) byMode[partial.name].amount += Math.max(0, Number(p.amount || 0));
                  }
                });
              });

              const totalIn = Object.values(byMode).reduce((s, m) => s + m.amount, 0) + creditTotal;

              // Money out from expenses
              const expensesInRange = expenses.filter((e: any) => {
                const t = e.date || e.timestamp || '';
                return t >= startIso && t <= endIso;
              });
              const totalOut = expensesInRange.reduce((s: number, e: any) => s + Math.max(0, Number(e.amount || 0)), 0);
              const expensesByCategory: Record<string, number> = {};
              expensesInRange.forEach((e: any) => {
                const cat = e.category || e.type || 'Other';
                expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Math.max(0, Number(e.amount || 0));
              });

              return (
                <div className="space-y-3">
                  {/* Money Out summary */}
                  {totalOut > 0 && (
                    <div className="bg-white rounded-2xl overflow-hidden" style={{border:'1px solid #e2e8f0',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Money Out</p>
                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">Expenses by category</p>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {Object.entries(expensesByCategory).slice(0,5).map(([cat, amt]) => {
                          const pct = totalOut > 0 ? Math.round((amt / totalOut) * 100) : 0;
                          return (
                            <div key={cat} className="flex items-center gap-3 px-4 py-2.5">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-rose-50">
                                <ArrowDownRight className="w-4 h-4 text-rose-500"/>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                  <p className="text-[10.5px] font-bold text-slate-700 truncate">{cat}</p>
                                  <p className="text-[10.5px] font-black text-rose-600 ml-2 shrink-0">{formatCurrency(amt)}</p>
                                </div>
                                <div className="h-1 bg-rose-50 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-rose-400" style={{width:`${pct}%`}} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Total Expenses</p>
                        <p className="text-[13px] font-black text-rose-600">{formatCurrency(totalOut)}</p>
                      </div>
                    </div>
                  )}

                  {/* Money Out summary with percentages */}
                  {(() => {
                    const expensesInRange = expenses.filter((e: any) => {
                      const t = e.date || e.timestamp || e.createdAt || '';
                      return t >= startIso && t <= endIso;
                    });
                    const totalOut = expensesInRange.reduce((s: number, e: any) => s + Math.max(0, Number(e.amount || 0)), 0);
                    if (totalOut === 0) return null;

                    // Group by category
                    const byCategory: Record<string, number> = {};
                    expensesInRange.forEach((e: any) => {
                      const cat = e.category || e.type || 'Other';
                      byCategory[cat] = (byCategory[cat] || 0) + Math.max(0, Number(e.amount || 0));
                    });

                    const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

                    return (
                      <div className="bg-white rounded-2xl overflow-hidden" style={{border:'1px solid #e2e8f0',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Money Out</p>
                            <p className="text-[9px] text-slate-400 font-medium mt-0.5">Expenses by category</p>
                          </div>
                          <p className="text-[13px] font-black text-rose-600">{formatCurrency(totalOut)}</p>
                        </div>
                        <div className="divide-y divide-slate-50">
                          {entries.map(([cat, amt]) => {
                            const pct = totalOut > 0 ? Math.round((amt / totalOut) * 100) : 0;
                            return (
                              <div key={cat} className="flex items-center gap-3 px-4 py-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-rose-50">
                                  <ArrowDownRight className="w-4 h-4 text-rose-500"/>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-center mb-1">
                                    <p className="text-[11px] font-bold text-slate-700 truncate">{cat}</p>
                                    <p className="text-[11px] font-black text-rose-600 ml-2 shrink-0">{formatCurrency(amt)}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-rose-50 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full bg-rose-400" style={{width:`${pct}%`}} />
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-400 shrink-0 w-7 text-right">{pct}%</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── ACCOUNTS SECTION ── */}
        {mobileSectionTab === 'accounts' && (
          <div className="space-y-3">
            {/* Account type filter pills */}
            <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
              {(['all', ...channels.map(c => c.id)] as string[]).slice(0, 6).map(id => {
                const chan = id === 'all' ? null : channels.find(c => c.id === id);
                if (chan?.category === 'person') return null;
                const isSelected = selectedChannelId === id;
                return (
                  <button key={id} type="button" onClick={() => setSelectedChannelId(id)}
                    className="shrink-0 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all"
                    style={{background:isSelected?'#0f172a':'#f1f5f9',color:isSelected?'#fff':'#475569'}}>
                    {id === 'all' ? 'All' : chan?.name || id}
                  </button>
                );
              })}
            </div>

            {/* Account cards */}
            <div className="space-y-3">
              {channels.filter(c => c.category !== 'person' && (selectedChannelId === 'all' || selectedChannelId === c.id)).map(chan => {
                const bal = channelBalances[chan.id]?.current || 0;
                let periodIn = 0, periodOut = 0;
                activeTenantFilterLedger.forEach(e => {
                  if (e.channelId === chan.id) { if (e.amount >= 0) periodIn += e.amount; else periodOut += Math.abs(e.amount); }
                });
                const icon = chan.category === 'bank' ? <Landmark className="w-5 h-5"/> : chan.category === 'telco' ? <Wallet className="w-5 h-5"/> : <Coins className="w-5 h-5"/>;
                const grad = chan.category === 'bank' ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : chan.category === 'telco' ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'linear-gradient(135deg,#059669,#047857)';
                return (
                  <div key={chan.id} className="bg-white rounded-2xl overflow-hidden" style={{border:'1px solid #e2e8f0',boxShadow:'0 2px 10px rgba(0,0,0,0.06)'}}>
                    {/* Card header */}
                    <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0" style={{background:grad}}>{icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-extrabold text-slate-900 truncate">{chan.name}</p>
                        <p className="text-[10px] text-slate-400 capitalize">{chan.category} · {chan.provider || 'Account'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-[16px] font-black font-mono ${bal >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>{formatCurrency(bal)}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Balance</p>
                      </div>
                    </div>
                    {/* Flow row */}
                    <div className="grid grid-cols-2 gap-0 border-t border-slate-50">
                      <div className="px-4 py-3 border-r border-slate-50">
                        <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">IN</p>
                        <p className="text-[13px] font-black text-emerald-700 font-mono mt-0.5">+{formatCurrency(periodIn)}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[9px] text-rose-500 font-bold uppercase tracking-wider">OUT</p>
                        <p className="text-[13px] font-black text-rose-600 font-mono mt-0.5">-{formatCurrency(periodOut)}</p>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="border-t border-slate-50 flex">
                      <button type="button" onClick={() => { setSettleSource(chan.id); setMobileSectionTab('transfer'); }}
                        className="flex-1 py-3 flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-600 active:bg-slate-50 border-r border-slate-50">
                        <Send className="w-3.5 h-3.5"/> Transfer
                      </button>
                      <button type="button" onClick={() => { setSelectedChannelId(chan.id); setMobileSectionTab('audit'); }}
                        className="flex-1 py-3 flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-600 active:bg-slate-50">
                        <Eye className="w-3.5 h-3.5"/> History
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add account button */}
            <button type="button" onClick={() => setExpandedBank(true)}
              className="w-full py-4 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 text-sm font-bold active:bg-slate-50">
              <Plus className="w-4 h-4"/> Add New Account
            </button>

            {/* Add account form (collapsible) */}
            {(expandedBank || expandedTelco || expandedPhysical) && (
              <div className="bg-white rounded-2xl p-4 space-y-3" style={{border:'1px solid #e2e8f0'}}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-800">Add New Account</p>
                  <button type="button" onClick={() => { setExpandedBank(false); setExpandedTelco(false); setExpandedPhysical(false); }}
                    className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                    <X className="w-4 h-4 text-slate-500"/>
                  </button>
                </div>
                {addAccountSuccess && <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{addAccountSuccess}</p>}
                <div className="grid grid-cols-3 gap-2">
                  {(['bank','telco','person'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setNewAccType(t)}
                      className="py-2.5 rounded-xl text-[11px] font-bold capitalize transition-all"
                      style={{background:newAccType===t?'#0f172a':'#f1f5f9',color:newAccType===t?'#fff':'#475569'}}>
                      {t === 'telco' ? 'Mobile' : t === 'person' ? 'Person' : 'Bank'}
                    </button>
                  ))}
                </div>
                <input type="text" placeholder="Account name" value={newAccName} onChange={e => setNewAccName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"/>
                <input type="text" placeholder="Provider (e.g. M-Pesa, KCB)" value={newAccProvider} onChange={e => setNewAccProvider(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"/>
                <input type="text" placeholder="Account / Till number" value={newAccNumber} onChange={e => setNewAccNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                <button type="button" onClick={handleCreateAccount}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors">
                  Add Account
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TRANSFER SECTION ── */}
        {mobileSectionTab === 'transfer' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-4 space-y-4" style={{border:'1px solid #e2e8f0',boxShadow:'0 2px 8px rgba(0,0,0,0.05)'}}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Send className="w-5 h-5 text-emerald-600"/>
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Transfer / Settle Till</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Move money between accounts</p>
                </div>
              </div>

              {settleSuccessMsg && (
                <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5"/>
                  <p className="text-[11px] text-emerald-800 font-medium">{settleSuccessMsg}</p>
                </div>
              )}

              <form onSubmit={handleExecuteSettleTill} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">From</label>
                  <select value={settleSource} onChange={e => setSettleSource(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs text-slate-800 font-semibold outline-none focus:border-emerald-500 cursor-pointer">
                    {channels.filter(c => c.category !== 'person').map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({formatCurrency(channelBalances[c.id]?.current)})</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-slate-400 rotate-90"/>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">To</label>
                  <select value={settleTarget} onChange={e => setSettleTarget(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs text-slate-800 font-semibold outline-none focus:border-emerald-500 cursor-pointer">
                    <optgroup label="Mobile Wallets">
                      {channels.filter(c => c.category === 'telco').map(c => <option key={c.id} value={c.id}>{c.name} ({formatCurrency(channelBalances[c.id]?.current)})</option>)}
                    </optgroup>
                    <optgroup label="Bank Accounts">
                      {channels.filter(c => c.category === 'bank').map(c => <option key={c.id} value={c.id}>{c.name} ({formatCurrency(channelBalances[c.id]?.current)})</option>)}
                    </optgroup>
                    <optgroup label="Cash / Physical">
                      {channels.filter(c => c.category === 'physical').map(c => <option key={c.id} value={c.id}>{c.name} ({formatCurrency(channelBalances[c.id]?.current)})</option>)}
                    </optgroup>
                    <optgroup label="Send to Person">
                      {channels.filter(c => c.category === 'person').map(c => <option key={c.id} value={c.id}>{c.name} – {c.accountNumber}</option>)}
                    </optgroup>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Amount</label>
                  <input type="number" placeholder="Enter amount" value={settleAmount} onChange={e => setSettleAmount(e.target.value)} required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-base font-black font-mono text-slate-900 outline-none focus:border-emerald-500"/>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Memo (optional)</label>
                  <input type="text" placeholder="Note or reason" value={settleMemo} onChange={e => setSettleMemo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-emerald-500"/>
                </div>

                {showRuleWarning && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-800 font-semibold">
                    ⚠️ Large transfer — attach a receipt or proof of payment for audit trail.
                  </div>
                )}

                <button type="submit"
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black rounded-2xl transition-colors flex items-center justify-center gap-2">
                  <Send className="w-4 h-4"/> Execute Transfer
                </button>
              </form>
            </div>

            {/* Add account quick shortcut */}
            <div className="bg-white rounded-2xl p-4 space-y-3" style={{border:'1px solid #e2e8f0'}}>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Add Recipient / New Account</p>
              <div className="grid grid-cols-3 gap-2">
                {(['bank','telco','person'] as const).map(t => (
                  <button key={t} type="button" onClick={() => { setNewAccType(t); setMobileSectionTab('accounts'); setExpandedBank(true); }}
                    className="py-3 rounded-xl flex flex-col items-center gap-1.5 bg-slate-50 border border-slate-100 active:bg-slate-100">
                    {t === 'bank' ? <Landmark className="w-4 h-4 text-blue-500"/> : t === 'telco' ? <Wallet className="w-4 h-4 text-purple-500"/> : <User className="w-4 h-4 text-emerald-500"/>}
                    <span className="text-[9px] font-bold text-slate-500">{t === 'telco' ? 'Mobile' : t === 'person' ? 'Person' : 'Bank'}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── AUDIT / HISTORY SECTION ── */}
        {mobileSectionTab === 'audit' && (
          <div className="space-y-3">
            {/* Search + filter bar */}
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-white border border-slate-200 px-3 py-2.5 rounded-xl gap-2" style={{boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                <Search className="w-4 h-4 text-slate-400 shrink-0"/>
                <input type="text" placeholder="Search transactions..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-slate-800 placeholder-slate-400 flex-1"/>
              </div>
              <select value={auditTypeFilter} onChange={e => setAuditTypeFilter(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-xl px-2 py-2.5 text-[10px] font-bold text-slate-700 outline-none cursor-pointer"
                style={{boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                <option value="ALL">All</option>
                <option value="POS_CHECKOUT">Sales</option>
                <option value="SETTLE_TILL_DEPOSIT">Transfers</option>
                <option value="EXPENSE_WITHDRAWAL">Expenses</option>
              </select>
            </div>

            {/* Account filter pills */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              <button type="button" onClick={() => setSelectedChannelId('all')}
                className="shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold"
                style={{background:selectedChannelId==='all'?'#0f172a':'#f1f5f9',color:selectedChannelId==='all'?'#fff':'#475569'}}>
                All Accounts
              </button>
              {channels.filter(c => c.category !== 'person').map(c => (
                <button key={c.id} type="button" onClick={() => setSelectedChannelId(c.id)}
                  className="shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold"
                  style={{background:selectedChannelId===c.id?'#0f172a':'#f1f5f9',color:selectedChannelId===c.id?'#fff':'#475569'}}>
                  {c.name}
                </button>
              ))}
            </div>

            {/* Transaction cards — premium style */}
            <div className="space-y-2.5">
              {searchedAuditTrail.length > 0 ? searchedAuditTrail.map(entry => {
                const chan = channels.find(c => c.id === entry.channelId);
                const counterParty = entry.counterPartyChannelId ? channels.find(c => c.id === entry.counterPartyChannelId) : undefined;
                const isPositive = entry.amount >= 0;
                const isPersonPayout = entry.sourceType === 'SETTLE_TILL_DEPOSIT' && counterParty?.category === 'person';
                const displayType = entry.sourceType === 'POS_CHECKOUT' ? 'Payment In' : isPersonPayout ? 'Sent to Person' : entry.channelId === 'counter-01' ? 'Cash Counter' : entry.sourceType === 'SETTLE_TILL_DEPOSIT' ? 'Transfer' : entry.sourceType === 'EXPENSE_WITHDRAWAL' ? 'Expense' : 'Balance';
                const typeColor = entry.sourceType === 'POS_CHECKOUT' ? {bg:'#eff6ff',text:'#1d4ed8'} : isPersonPayout ? {bg:'#fff5f5',text:'#dc2626'} : entry.sourceType === 'SETTLE_TILL_DEPOSIT' ? {bg:'#f0fdf4',text:'#059669'} : entry.sourceType === 'EXPENSE_WITHDRAWAL' ? {bg:'#fff5f5',text:'#dc2626'} : {bg:'#f8fafc',text:'#475569'};

                return (
                  <div key={entry.id} className="bg-white rounded-2xl overflow-hidden" style={{border:'1px solid #e2e8f0',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                    <div className="px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{background:typeColor.bg,color:typeColor.text}}>
                          {isPositive ? <ArrowDownRight className="w-4 h-4"/> : <ArrowUpRight className="w-4 h-4"/>}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg" style={{background:typeColor.bg,color:typeColor.text}}>{displayType}</span>
                            <span className={`text-[15px] font-black font-mono shrink-0 ${isPositive ? 'text-emerald-600' : 'text-rose-500'}`}>
                              {isPositive ? '+' : ''}{formatCurrency(entry.amount)}
                            </span>
                          </div>
                          <p className="text-[12px] font-semibold text-slate-800 mt-1.5 truncate">{chan?.name || 'Account'}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {new Date(entry.timestamp).toLocaleString([], {dateStyle:'short',timeStyle:'short'})}
                          </p>
                          {entry.description && (
                            <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">{entry.description}</p>
                          )}
                          {entry.counterPartyChannelId && (
                            <p className="text-[9px] text-slate-400 italic mt-1">→ {counterParty?.name || 'Account'}{counterParty?.accountNumber ? ` (${counterParty.accountNumber})` : ''}</p>
                          )}
                          {(entry.receiptFile || entry.muamalaFile) && (
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                              {entry.receiptFile && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] font-bold rounded-md flex items-center gap-1"><FileText className="w-2.5 h-2.5"/>Receipt</span>}
                              {entry.muamalaFile && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold rounded-md flex items-center gap-1"><Wallet className="w-2.5 h-2.5"/>Slip</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
                    <Clock className="w-6 h-6 text-slate-300"/>
                  </div>
                  <p className="font-bold text-slate-600 text-sm">No transactions found</p>
                  <p className="text-xs text-slate-400 mt-1">Adjust your filters or date range</p>
                </div>
              )}
            </div>

            {searchedAuditTrail.length > 0 && (
              <p className="text-[10px] text-slate-400 text-center py-1">{searchedAuditTrail.length} transactions · {startDateStr} to {endDateStr}</p>
            )}
          </div>
        )}

      </div>

      {/* ══════════════════════════════════════════════════════════════
          DESKTOP LAYOUT — unchanged (hidden on mobile)
      ══════════════════════════════════════════════════════════════ */}
      <div className="hidden xl:block space-y-5">

        {/* ── TOP ROW: Header + Date Controls ── */}
        <div className="grid grid-cols-[1fr_auto] gap-4 items-start">

          {/* Dark header card */}
          <div className="rounded-2xl p-7 text-white" style={{background:'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)'}}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Treasury</p>
                <h1 className="text-white font-black text-2xl leading-tight mt-0.5">Money & Bank</h1>
                <p className="text-white/40 text-xs mt-1">
                  {datePreset === 'today' ? 'Today' : datePreset === '1week' ? 'Last 7 days' : datePreset === '1month' ? 'Last 30 days' : `${startDateStr} → ${endDateStr}`}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{background:'rgba(255,255,255,0.08)'}}>
                <Landmark className="w-5 h-5 text-emerald-400"/>
              </div>
            </div>

            {/* Net Collected */}
            <div className="mb-4">
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-0.5">Net Collected</p>
              <p className={`font-black text-3xl leading-none ${combinedStats.netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {combinedStats.netChange >= 0 ? '+' : ''}{formatCurrency(combinedStats.netChange)}
              </p>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl px-3 py-2.5" style={{background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.2)'}}>
                <p className="text-emerald-400 text-[9px] font-black uppercase tracking-wider">Money In</p>
                <p className="text-white font-black text-sm mt-0.5">+{formatCurrency(combinedStats.totalMoneyIn)}</p>
                <p className="text-white/30 text-[9px] mt-0.5">{combinedStats.countMoneyIn} transactions</p>
              </div>
              <div className="rounded-xl px-3 py-2.5" style={{background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.2)'}}>
                <p className="text-rose-400 text-[9px] font-black uppercase tracking-wider">Money Out</p>
                <p className="text-white font-black text-sm mt-0.5">-{formatCurrency(combinedStats.totalMoneyOut)}</p>
                <p className="text-white/30 text-[9px] mt-0.5">{combinedStats.countMoneyOut} transactions</p>
              </div>
              <div className="rounded-xl px-3 py-2.5" style={{background:'rgba(99,102,241,0.15)',border:'1px solid rgba(99,102,241,0.2)'}}>
                <p className="text-indigo-400 text-[9px] font-black uppercase tracking-wider">Transactions</p>
                <p className="text-white font-black text-sm mt-0.5">{combinedStats.countMoneyIn + combinedStats.countMoneyOut}</p>
                <p className="text-white/30 text-[9px] mt-0.5">total movements</p>
              </div>
            </div>

            {/* Registered modes breakdown */}
            {(() => {
              const configModes = normalizePaymentModes(systemSettings?.business?.paymentModes || []);
              if (configModes.length === 0) return null;
              const { startIso, endIso } = getFilterBoundaries();
              const salesInRange = sales.filter((s: any) => {
                const t = s.timestamp || s.createdAt || '';
                return t >= startIso && t <= endIso && s.paymentStatus !== 'Pending';
              });
              const byMode: Record<string, number> = {};
              configModes.forEach(m => { byMode[m.name] = 0; });
              salesInRange.forEach((s: any) => {
                const breakdown = Array.isArray(s.paymentBreakdown) && s.paymentBreakdown.length > 0
                  ? s.paymentBreakdown : [{ method: s.paymentMethod || 'Cash', amount: s.amountPaid ?? s.total }];
                breakdown.forEach((p: any) => {
                  const mName = (p.method || s.paymentMethod || 'Cash').trim();
                  const match = configModes.find(m => m.name.toLowerCase().trim() === mName.toLowerCase() || mName.toLowerCase().includes(m.name.toLowerCase()) || m.name.toLowerCase().includes(mName.toLowerCase()));
                  if (match) byMode[match.name] = (byMode[match.name] || 0) + Math.max(0, Number(p.amount || 0));
                });
              });
              const total = Object.values(byMode).reduce((a, b) => a + b, 0);
              if (total === 0) return null;
              return (
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
                  {Object.entries(byMode).filter(([, amt]) => amt > 0).map(([mode, amt]) => {
                    const config = configModes.find(m => m.name === mode);
                    const type = getPaymentType(mode, configModes);
                    const colors = PAYMENT_TYPE_COLORS[type];
                    const pct = Math.round((amt / total) * 100);
                    return (
                      <div key={mode} className="flex items-center gap-2">
                        {config?.logoUrl
                          ? <img src={config.logoUrl} className="w-4 h-4 object-contain rounded shrink-0" alt={mode}/>
                          : <span className="text-sm shrink-0">{PAYMENT_TYPE_ICONS[type]}</span>
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="text-white/70 text-[9px] font-bold truncate">{mode}</span>
                            <span className="text-white/50 text-[9px] font-mono ml-1 shrink-0">{pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full mt-1" style={{background:'rgba(255,255,255,0.1)'}}>
                            <div className="h-full rounded-full" style={{width:`${pct}%`, background: colors.text}} />
                          </div>
                        </div>
                        <span className="text-white/60 text-[10px] font-mono font-bold shrink-0">{formatCurrency(amt)}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Date controls */}
          <div className="w-72 space-y-3">
            {/* Preset chips */}
            <div className="bg-white border border-slate-200 rounded-2xl p-1 grid grid-cols-3 gap-1">
              {(['today','1week','1month'] as const).map(p => (
                <button key={p} type="button" onClick={() => setDatePreset(p)}
                  className={`py-2 text-[11px] font-black rounded-xl transition-all cursor-pointer border-none outline-none ${
                    datePreset === p ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}>
                  {p === 'today' ? 'Today' : p === '1week' ? '7 Days' : '30 Days'}
                </button>
              ))}
            </div>
            {/* Custom date range */}
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 space-y-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Custom Range</p>
              <div className="space-y-1.5">
                <input type="date" value={startDateStr}
                  onChange={e => { setStartDateStr(e.target.value); setDatePreset('custom'); }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 outline-none focus:border-emerald-400 cursor-pointer"/>
                <input type="date" value={endDateStr}
                  onChange={e => { setEndDateStr(e.target.value); setDatePreset('custom'); }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 outline-none focus:border-emerald-400 cursor-pointer"/>
              </div>
            </div>

            {/* Available Balance */}
            <div className="bg-slate-950 text-white rounded-2xl p-4">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-50">Available Balance</p>
              <p className="text-2xl font-black mt-1">
                {formatCurrency(channels.filter(c => c.category !== 'person').reduce((s, c) => s + (channelBalances[c.id]?.current || 0), 0))}
              </p>
              <p className="text-[9px] opacity-40 mt-1">{channels.filter(c => c.category !== 'person').length} active accounts</p>
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT: 2 columns ── */}
        <div className="grid grid-cols-[1fr_380px] gap-5 items-start">

          {/* LEFT: Tab nav + content */}
          <div className="space-y-4">

            {/* Desktop tab navigation */}
            <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1">
              {([
                { id: 'overview',  label: 'Overview',  icon: <BarChart3 className="w-4 h-4"/> },
                { id: 'accounts',  label: 'Accounts',  icon: <Landmark className="w-4 h-4"/> },
                { id: 'transfer',  label: 'Transfer',  icon: <Send className="w-4 h-4"/> },
                { id: 'history',   label: 'History',   icon: <Clock className="w-4 h-4"/> },
              ] as const).map(tab => {
                const active = desktopTab === tab.id;
                return (
                  <button key={tab.id} type="button" onClick={() => setDesktopTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer border-none outline-none ${
                      active ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}>
                    <span className={active ? 'text-emerald-400' : 'text-slate-400'}>{tab.icon}</span>
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ── OVERVIEW TAB ── */}
            {desktopTab === 'overview' && (
              <div className="space-y-4">

            {/* Channel filter pills */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Filter by Account</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setSelectedChannelId('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                    selectedChannelId === 'all' ? 'bg-slate-950 border-slate-950 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}>
                  All Accounts
                </button>
                {channels.filter(c => c.category !== 'person').map(chan => {
                  const isSelected = selectedChannelId === chan.id;
                  const type = getPaymentType(chan.name, normalizePaymentModes(systemSettings?.business?.paymentModes || []));
                  const colors = PAYMENT_TYPE_COLORS[type];
                  const icon = chan.category === 'physical' ? '💵' : chan.category === 'telco' ? '📱' : '🏦';
                  return (
                    <button key={chan.id} type="button" onClick={() => setSelectedChannelId(chan.id)}
                      className="px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border flex items-center gap-2"
                      style={{
                        background: isSelected ? colors.text : colors.bg,
                        borderColor: isSelected ? colors.text : colors.border,
                        color: isSelected ? '#fff' : colors.text,
                      }}>
                      <span>{icon}</span>
                      <span>{chan.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Account cards grid */}
            <div className="grid grid-cols-2 gap-3">
              {channels.filter(c => c.category !== 'person' && (selectedChannelId === 'all' || selectedChannelId === c.id)).map(chan => {
                const bal = channelBalances[chan.id]?.current || 0;
                const type = getPaymentType(chan.name, normalizePaymentModes(systemSettings?.business?.paymentModes || []));
                const colors = PAYMENT_TYPE_COLORS[type];
                let periodIn = 0, periodOut = 0;
                activeTenantFilterLedger.forEach(e => {
                  if (e.channelId === chan.id) { if (e.amount >= 0) periodIn += e.amount; else periodOut += Math.abs(e.amount); }
                });
                const icon = chan.category === 'physical' ? '💵' : chan.category === 'telco' ? '📱' : '🏦';
                return (
                  <div key={chan.id} className="rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md"
                    style={{background: colors.bg, border:`1.5px solid ${colors.border}`}}
                    onClick={() => setSelectedChannelId(chan.id)}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl">{icon}</span>
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg"
                        style={{background: colors.text + '20', color: colors.text}}>
                        {chan.category === 'telco' ? 'Mobile' : chan.category === 'physical' ? 'Cash' : 'Bank'}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-600 truncate mb-1">{chan.name}</p>
                    <p className="text-2xl font-black" style={{color: bal < 0 ? '#dc2626' : colors.text}}>
                      {formatCurrency(bal)}
                    </p>
                    <div className="flex gap-3 mt-3 pt-3 border-t" style={{borderColor: colors.border}}>
                      <div>
                        <p className="text-[8px] font-bold opacity-60">Period In</p>
                        <p className="text-xs font-black text-emerald-600">+{formatCurrency(periodIn)}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold opacity-60">Period Out</p>
                        <p className="text-xs font-black text-rose-500">-{formatCurrency(periodOut)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Audit trail — preview only in overview */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-black text-slate-800">Recent Transactions</p>
                <button type="button" onClick={() => setDesktopTab('history')}
                  className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 cursor-pointer">
                  See all <ChevronRight className="w-3 h-3"/>
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {activeTenantFilterLedger
                  .filter(e => selectedChannelId === 'all' || e.channelId === selectedChannelId)
                  .slice(0, 5)
                  .map(entry => {
                    const chan = channels.find(c => c.id === entry.channelId);
                    const isCredit = entry.amount >= 0;
                    return (
                      <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isCredit ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                          {isCredit ? <ArrowUpRight className="w-4 h-4 text-emerald-500"/> : <ArrowDownRight className="w-4 h-4 text-rose-500"/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{entry.description || 'Transaction'}</p>
                          <p className="text-[9px] text-slate-400 font-mono mt-0.5">{chan?.name || entry.channelId} · {new Date(entry.timestamp).toLocaleDateString()}</p>
                        </div>
                        <p className={`text-sm font-black shrink-0 ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isCredit ? '+' : '-'}{formatCurrency(Math.abs(entry.amount))}
                        </p>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Revenue by registered mode */}
            {(() => {
              const configModes = normalizePaymentModes(systemSettings?.business?.paymentModes || []);
              const { startIso, endIso } = getFilterBoundaries();
              const salesInRange = sales.filter((s: any) => {
                const t = s.timestamp || s.createdAt || '';
                return t >= startIso && t <= endIso && s.paymentStatus !== 'Pending';
              });
              const byMode: Record<string, {amount: number; config: typeof configModes[0]}> = {};
              configModes.forEach(m => { byMode[m.name] = { amount: 0, config: m }; });
              let creditTotal = 0;
              salesInRange.forEach((s: any) => {
                const breakdown = Array.isArray(s.paymentBreakdown) && s.paymentBreakdown.length > 0
                  ? s.paymentBreakdown : [{ method: s.paymentMethod || 'Cash', amount: s.amountPaid ?? s.total }];
                breakdown.forEach((p: any) => {
                  const mName = (p.method || s.paymentMethod || 'Cash').trim();
                  const type = getPaymentType(mName, configModes);
                  if (type === 'credit') { creditTotal += Math.max(0, Number(p.amount || 0)); return; }
                  const match = configModes.find(m => m.name.toLowerCase().trim() === mName.toLowerCase() || mName.toLowerCase().includes(m.name.toLowerCase()) || m.name.toLowerCase().includes(mName.toLowerCase()));
                  if (match) byMode[match.name].amount += Math.max(0, Number(p.amount || 0));
                });
              });
              const totalIn = Object.values(byMode).reduce((s, m) => s + m.amount, 0) + creditTotal;
              return (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-sm font-black text-slate-800">Revenue by Mode</p>
                    <p className="text-sm font-black text-emerald-600">{formatCurrency(totalIn)}</p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {Object.entries(byMode).map(([name, {amount, config}]) => {
                      const type = getPaymentType(name, configModes);
                      const colors = PAYMENT_TYPE_COLORS[type];
                      const pct = totalIn > 0 ? Math.round((amount / totalIn) * 100) : 0;
                      return (
                        <div key={name} className="flex items-center gap-3 px-5 py-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{background: colors.bg}}>
                            {config.logoUrl ? <img src={config.logoUrl} className="w-5 h-5 object-contain" alt={name}/> : <span className="text-sm">{PAYMENT_TYPE_ICONS[type]}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-xs font-bold text-slate-700 truncate">{name}</p>
                              <p className="text-xs font-black ml-2 shrink-0" style={{color: colors.text}}>{formatCurrency(amount)}</p>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{background: colors.bg}}>
                              <div className="h-full rounded-full" style={{width:`${pct}%`, background: colors.text}}/>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 w-8 text-right shrink-0">{pct}%</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-3 px-5 py-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-rose-50"><span className="text-sm">📋</span></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-xs font-bold text-slate-700">Credit / Mkopo</p>
                          <p className="text-xs font-black text-rose-600 ml-2">{formatCurrency(creditTotal)}</p>
                        </div>
                        <div className="h-1.5 bg-rose-50 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-rose-400" style={{width:`${totalIn > 0 ? Math.round((creditTotal/totalIn)*100) : 0}%`}}/>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 w-8 text-right shrink-0">{totalIn > 0 ? Math.round((creditTotal/totalIn)*100) : 0}%</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Money Out by category */}
            {(() => {
              const { startIso, endIso } = getFilterBoundaries();
              const expensesInRange = expenses.filter((e: any) => {
                const t = e.date || e.timestamp || e.createdAt || '';
                return t >= startIso && t <= endIso;
              });
              const totalOut = expensesInRange.reduce((s: number, e: any) => s + Math.max(0, Number(e.amount || 0)), 0);
              if (totalOut === 0) return null;
              const byCategory: Record<string, number> = {};
              expensesInRange.forEach((e: any) => {
                const cat = e.category || e.type || 'Other';
                byCategory[cat] = (byCategory[cat] || 0) + Math.max(0, Number(e.amount || 0));
              });
              return (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-sm font-black text-slate-800">Money Out</p>
                    <p className="text-sm font-black text-rose-600">{formatCurrency(totalOut)}</p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {Object.entries(byCategory).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => {
                      const pct = totalOut > 0 ? Math.round((amt / totalOut) * 100) : 0;
                      return (
                        <div key={cat} className="flex items-center gap-3 px-5 py-3">
                          <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                            <ArrowDownRight className="w-4 h-4 text-rose-500"/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-xs font-bold text-slate-700 truncate">{cat}</p>
                              <p className="text-xs font-black text-rose-600 ml-2 shrink-0">{formatCurrency(amt)}</p>
                            </div>
                            <div className="h-1.5 bg-rose-50 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-rose-400" style={{width:`${pct}%`}}/>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 w-8 text-right shrink-0">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Quick transfer button */}
            <button type="button" onClick={() => setDesktopTab('transfer')}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-800">
              <Send className="w-4 h-4 text-emerald-400"/>
              New Transfer
            </button>
            </div>
            )}

            {/* ── ACCOUNTS TAB ── */}
            {desktopTab === 'accounts' && (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {(['all', ...channels.map((c: any) => c.id)] as string[]).map(id => {
                    const chan = id === 'all' ? null : channels.find((c: any) => c.id === id);
                    if ((chan as any)?.category === 'person') return null;
                    const isSelected = selectedChannelId === id;
                    const type = chan ? getPaymentType((chan as any).name, normalizePaymentModes(systemSettings?.business?.paymentModes || [])) : null;
                    const colors = type ? PAYMENT_TYPE_COLORS[type] : null;
                    return (
                      <button key={id} type="button" onClick={() => setSelectedChannelId(id)}
                        className="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border"
                        style={{
                          background: isSelected ? (colors?.text || '#0f172a') : (colors?.bg || '#f1f5f9'),
                          borderColor: isSelected ? (colors?.text || '#0f172a') : (colors?.border || '#e2e8f0'),
                          color: isSelected ? '#fff' : (colors?.text || '#475569'),
                        }}>
                        {id === 'all' ? 'All Accounts' : (chan as any)?.name || id}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {channels.filter((c: any) => c.category !== 'person' && (selectedChannelId === 'all' || selectedChannelId === c.id)).map((chan: any) => {
                    const bal = channelBalances[chan.id]?.current || 0;
                    let periodIn = 0, periodOut = 0;
                    activeTenantFilterLedger.forEach((e: any) => {
                      if (e.channelId === chan.id) { if (e.amount >= 0) periodIn += e.amount; else periodOut += Math.abs(e.amount); }
                    });
                    const grad = chan.category === 'bank' ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : chan.category === 'telco' ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'linear-gradient(135deg,#059669,#047857)';
                    const icon = chan.category === 'bank' ? <Landmark className="w-5 h-5"/> : chan.category === 'telco' ? <Wallet className="w-5 h-5"/> : <Coins className="w-5 h-5"/>;
                    return (
                      <div key={chan.id} className="bg-white rounded-2xl overflow-hidden" style={{border:'1px solid #e2e8f0',boxShadow:'0 2px 10px rgba(0,0,0,0.06)'}}>
                        <div className="px-5 pt-5 pb-4 flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0" style={{background:grad}}>{icon}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-extrabold text-slate-900 truncate">{chan.name}</p>
                            <p className="text-[10px] text-slate-400 capitalize">{chan.provider || chan.category}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-black font-mono ${bal >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>{formatCurrency(bal)}</p>
                            <p className="text-[9px] text-slate-400">Balance</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 border-t border-slate-100">
                          <div className="px-5 py-3 border-r border-slate-100">
                            <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">IN</p>
                            <p className="text-sm font-black text-emerald-700 font-mono mt-0.5">+{formatCurrency(periodIn)}</p>
                          </div>
                          <div className="px-5 py-3">
                            <p className="text-[9px] text-rose-500 font-bold uppercase tracking-wider">OUT</p>
                            <p className="text-sm font-black text-rose-600 font-mono mt-0.5">-{formatCurrency(periodOut)}</p>
                          </div>
                        </div>
                        <div className="border-t border-slate-100 flex">
                          <button type="button" onClick={() => { setSettleSource(chan.id); setDesktopTab('transfer'); }}
                            className="flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 border-r border-slate-100 cursor-pointer">
                            <Send className="w-3.5 h-3.5"/> Transfer
                          </button>
                          <button type="button" onClick={() => { setSelectedChannelId(chan.id); setDesktopTab('history'); }}
                            className="flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
                            <Eye className="w-3.5 h-3.5"/> History
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── TRANSFER TAB ── */}
            {desktopTab === 'transfer' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <Send className="w-5 h-5 text-emerald-600"/>
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">Transfer / Settle Till</p>
                    <p className="text-xs text-slate-400 mt-0.5">Move money between accounts</p>
                  </div>
                </div>
                {settleSuccessMsg && (
                  <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5"/>
                    <p className="text-xs text-emerald-800 font-medium">{settleSuccessMsg}</p>
                  </div>
                )}
                <form onSubmit={handleExecuteSettleTill} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">From</label>
                      <select value={settleSource} onChange={e => setSettleSource(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-semibold outline-none focus:border-emerald-500 cursor-pointer">
                        {channels.filter((c: any) => c.category !== 'person').map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name} ({formatCurrency(channelBalances[c.id]?.current)})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">To</label>
                      <select value={settleTarget} onChange={e => setSettleTarget(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-semibold outline-none focus:border-emerald-500 cursor-pointer">
                        <optgroup label="Mobile Money">{channels.filter((c: any) => c.category === 'telco').map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                        <optgroup label="Bank Accounts">{channels.filter((c: any) => c.category === 'bank').map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                        <optgroup label="Cash / Physical">{channels.filter((c: any) => c.category === 'physical').map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                        <optgroup label="Send to Person">{channels.filter((c: any) => c.category === 'person').map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Amount</label>
                      <input type="number" placeholder="0" value={settleAmount} onChange={e => setSettleAmount(e.target.value)} required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xl font-black font-mono text-slate-900 outline-none focus:border-emerald-500"/>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Memo (optional)</label>
                      <input type="text" placeholder="Note or reason" value={settleMemo} onChange={e => setSettleMemo(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500"/>
                    </div>
                  </div>
                  {showRuleWarning && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-800 font-semibold">
                      ⚠️ Large transfer — attach a receipt or proof of payment for audit trail.
                    </div>
                  )}
                  <button type="submit"
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl flex items-center justify-center gap-2 cursor-pointer">
                    <Send className="w-4 h-4"/> Execute Transfer
                  </button>
                </form>
              </div>
            )}

            {/* ── HISTORY TAB ── */}
            {desktopTab === 'history' && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl gap-2">
                    <Search className="w-4 h-4 text-slate-400 shrink-0"/>
                    <input type="text" placeholder="Search transactions..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)}
                      className="bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400 flex-1"/>
                  </div>
                  <select value={auditTypeFilter} onChange={e => setAuditTypeFilter(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer">
                    <option value="ALL">All Types</option>
                    <option value="POS_CHECKOUT">Sales</option>
                    <option value="SETTLE_TILL_DEPOSIT">Transfers</option>
                    <option value="EXPENSE_WITHDRAWAL">Expenses</option>
                  </select>
                </div>
                <div className="px-5 py-3 border-b border-slate-100 flex gap-2 flex-wrap">
                  <button type="button" onClick={() => setSelectedChannelId('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${selectedChannelId === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>All</button>
                  {channels.filter((c: any) => c.category !== 'person').map((c: any) => (
                    <button key={c.id} type="button" onClick={() => setSelectedChannelId(c.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${selectedChannelId === c.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {c.name}
                    </button>
                  ))}
                </div>
                <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
                  {searchedAuditTrail.length > 0 ? searchedAuditTrail.map((entry: any) => {
                    const chan = channels.find((c: any) => c.id === entry.channelId);
                    const isPositive = entry.amount >= 0;
                    const typeLabel = entry.sourceType === 'POS_CHECKOUT' ? 'Payment In' : entry.sourceType === 'SETTLE_TILL_DEPOSIT' ? 'Transfer' : entry.sourceType === 'EXPENSE_WITHDRAWAL' ? 'Expense' : 'Entry';
                    const tc = entry.sourceType === 'POS_CHECKOUT' ? {bg:'#eff6ff',text:'#1d4ed8'} : entry.sourceType === 'SETTLE_TILL_DEPOSIT' ? {bg:'#f0fdf4',text:'#059669'} : entry.sourceType === 'EXPENSE_WITHDRAWAL' ? {bg:'#fff1f2',text:'#be123c'} : {bg:'#f8fafc',text:'#475569'};
                    return (
                      <div key={entry.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{background:tc.bg}}>
                          {isPositive ? <ArrowUpRight className="w-4 h-4" style={{color:tc.text}}/> : <ArrowDownRight className="w-4 h-4" style={{color:tc.text}}/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{background:tc.bg,color:tc.text}}>{typeLabel}</span>
                            <p className="text-xs text-slate-600 font-medium truncate">{entry.description || '-'}</p>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono">{(chan as any)?.name || entry.channelId} · {new Date(entry.timestamp).toLocaleString()}</p>
                        </div>
                        <p className={`text-sm font-black shrink-0 ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isPositive ? '+' : '-'}{formatCurrency(Math.abs(entry.amount))}
                        </p>
                      </div>
                    );
                  }) : (
                    <div className="text-center py-12 text-slate-400">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-30"/>
                      <p className="text-sm font-bold">No transactions found</p>
                    </div>
                  )}
                </div>
                {searchedAuditTrail.length > 0 && (
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>{searchedAuditTrail.length} records</span><span>All systems normal</span>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
