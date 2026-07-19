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
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const getRelativeRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
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
        timestamp: exp.timestamp || new Date().toISOString()
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
          <div className="px-5 pt-5 pb-4 relative">
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
              <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-0.5">Net Collected</p>
              <p className={`font-black text-[28px] leading-none ${combinedStats.netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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
                <div className="mt-3 space-y-1.5">
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
                            <span className="text-white/80 text-[9px] font-bold truncate">{mode}</span>
                            <span className="text-white/60 text-[9px] font-mono ml-2 shrink-0">{formatCurrency(amt)}</span>
                          </div>
                          <div className="h-1 rounded-full" style={{background:'rgba(255,255,255,0.1)'}}>
                            <div className="h-full rounded-full" style={{width:`${pct}%`, background: colors.text}} />
                          </div>
                        </div>
                        <span className="text-white/40 text-[8px] font-bold shrink-0 w-6 text-right">{pct}%</span>
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

                  {/* Channel cards — Cash first, then registered modes, 2 per row */}
                  <div className="bg-white rounded-2xl overflow-hidden" style={{border:'1px solid #e2e8f0',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Payment Channels</p>
                    </div>
                    <div className="p-3 grid grid-cols-2 gap-2.5">
                      {channels.filter(c => c.category !== 'person').map(chan => {
                        const bal = channelBalances[chan.id]?.current || 0;
                        const type = getPaymentType(chan.name, configModes);
                        const colors = PAYMENT_TYPE_COLORS[type];
                        const icon = chan.category === 'physical' ? '💵'
                          : chan.category === 'telco' ? '📱'
                          : chan.category === 'bank' ? '🏦' : '💳';
                        return (
                          <div key={chan.id}
                            className="rounded-xl p-3 cursor-pointer active:scale-95 transition-transform"
                            style={{background: colors.bg, border:`1px solid ${colors.border}`}}
                            onClick={() => { setSelectedChannelId(chan.id); setMobileSectionTab('accounts'); }}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg">{icon}</span>
                              <p className="text-[10px] font-black text-slate-700 truncate flex-1">{chan.name}</p>
                            </div>
                            <p className={`text-[15px] font-black leading-none ${bal < 0 ? 'text-rose-600' : ''}`}
                              style={{color: bal >= 0 ? colors.text : '#dc2626'}}>
                              {formatCurrency(bal)}
                            </p>
                            <p className="text-[8px] font-bold opacity-60 mt-0.5 capitalize">{chan.category === 'telco' ? 'Mobile Money' : chan.category === 'physical' ? 'Cash' : chan.category}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

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
      <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 lg:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.45fr_repeat(3,minmax(0,1fr))] gap-3">
            {treasurySummaryCards.map((card, index) => (
              <div
                key={card.label}
                className={`rounded-2xl border ${index === 0 ? 'sm:col-span-2 lg:col-span-1 p-5 lg:p-6' : 'p-4 lg:p-5'} ${card.tone}`}
              >
                <span className="block text-[9.5px] font-black uppercase tracking-widest opacity-70 font-mono">{card.label}</span>
                <span className={`block font-black leading-tight ${index === 0 ? 'mt-3 text-2xl lg:text-[28px]' : 'mt-2 text-lg lg:text-xl'}`}>{card.value}</span>
                <span className={`block font-bold opacity-60 ${index === 0 ? 'mt-2 text-xs' : 'mt-1.5 text-[10px]'}`}>{card.helper}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Date presets with direct always-visible calendar ranges */}
        <div className="border-t border-slate-200 bg-slate-50 p-3 sm:p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="grid grid-cols-3 gap-2 bg-white border border-slate-200 rounded-2xl p-1">
              {(['today', '1week', '1month'] as const).map((preset) => (
                <button
                  key={preset}
                  id={`preset-${preset}`}
                  type="button"
                  onClick={() => setDatePreset(preset)}
                  className={`min-h-[44px] px-3 py-2 text-xs font-black rounded-xl transition-all cursor-pointer border-none outline-none ${
                    datePreset === preset
                      ? 'bg-slate-950 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 bg-transparent'
                  }`}
                >
                  {preset === 'today' ? 'Today' :
                   preset === '1week' ? '7 Days' :
                   preset === '1month' ? '30 Days' : ''}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2 animate-fadeIn bg-white border border-slate-200 px-3 py-2 rounded-2xl overflow-hidden">
              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <input
                type="date"
                value={startDateStr}
                onChange={(e) => {
                  setStartDateStr(e.target.value);
                  setDatePreset('custom');
                }}
                className="min-w-0 bg-transparent border-none text-slate-800 text-xs font-bold outline-none cursor-pointer p-0 font-mono"
              />
              <span className="text-slate-400 text-xs font-bold font-mono">to</span>
              <input
                type="date"
                value={endDateStr}
                onChange={(e) => {
                  setEndDateStr(e.target.value);
                  setDatePreset('custom');
                }}
                className="min-w-0 bg-transparent border-none text-slate-800 text-xs font-bold outline-none cursor-pointer p-0 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SEAMLESS PAYMENT MODE CHOOSERS */}
      <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl md:rounded-3xl shadow-xs space-y-3 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Payment mode filters</span>
          </div>
          <span className="text-[10px] bg-slate-900 text-white font-extrabold px-2.5 py-1 rounded-lg uppercase font-mono tracking-widest w-max">
            {selectedChannelId === 'all' ? 'All Combined Active' : `${channels.find(c => c.id === selectedChannelId)?.name} Filtered`}
          </span>
        </div>

        <div className="flex gap-2.5 overflow-x-auto md:flex-wrap pb-1 -mx-1 px-1">
          <button
            type="button"
            onClick={() => setSelectedChannelId('all')}
            className={`px-3.5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer border flex items-center space-x-2 shrink-0 min-w-[150px] ${
              selectedChannelId === 'all'
                ? 'bg-slate-950 border-slate-950 text-white shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80'
            }`}
          >
            <div className={`p-1 rounded-lg shrink-0 ${selectedChannelId === 'all' ? 'bg-white/15' : 'bg-slate-200/50'}`}>
              <Wallet className="w-4 h-4 shrink-0" />
            </div>
            <span>All Accounts</span>
          </button>

          {/* CHANNELS */}
          {channels.filter(chan => chan.category !== 'person').map((chan) => {
            const isSelected = selectedChannelId === chan.id;
            const sums = channelBalances[chan.id] || { current: 0 };
            
            // Calculate total based on dates (using activeTenantFilterLedger)
            let periodMoneyIn = 0;
            let periodMoneyOut = 0;
            activeTenantFilterLedger.forEach(entry => {
              if (entry.channelId === chan.id) {
                if (entry.amount > 0) {
                  periodMoneyIn += entry.amount;
                } else {
                  periodMoneyOut += Math.abs(entry.amount);
                }
              }
            });
            const periodNet = periodMoneyIn - periodMoneyOut;

            let iconOfChan = <Coins className="w-4 h-4 shrink-0" />;
            let basePillStyle = 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80';
            let activePillStyle = 'bg-amber-100 border-amber-300 text-amber-900 shadow-xs ring-1 ring-amber-400/20';
            
            if (chan.category === 'telco') {
              iconOfChan = <Wallet className="w-4 h-4 shrink-0" />;
              if (isSelected) activePillStyle = 'bg-indigo-100 border-indigo-300 text-indigo-900 shadow-xs ring-1 ring-indigo-400/20';
            } else if (chan.category === 'bank') {
              iconOfChan = <Landmark className="w-4 h-4 shrink-0" />;
              if (isSelected) activePillStyle = 'bg-blue-100 border-blue-300 text-blue-900 shadow-xs ring-1 ring-blue-400/20';
            }

            return (
              <button
                key={chan.id}
                type="button"
                onClick={() => setSelectedChannelId(chan.id)}
                className={`px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border flex items-center space-x-2 shrink-0 min-w-[190px] md:min-w-0 ${
                  isSelected ? activePillStyle : basePillStyle
                }`}
              >
                <div className={`p-1 rounded-lg shrink-0 ${isSelected ? 'bg-white/60' : 'bg-slate-200/50'}`}>
                  {iconOfChan}
                </div>
                <div className="text-left">
                  <span className={`block font-black tracking-tight leading-tight truncate max-w-[140px] ${isSelected ? '' : 'text-slate-800'}`}>{chan.name}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedChannelId === 'all' ? (
        <>
          {/* CONSOLIDATED LIQUIDITY & PERFORMANCE DASHBOARD */}
          <div className="bg-slate-900 text-white rounded-2xl md:rounded-3xl p-4 sm:p-6 border border-slate-800 shadow-sm space-y-4 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 font-mono uppercase tracking-widest block">Combined System Dashboard</span>
                <h2 className="text-sm font-extrabold text-white tracking-tight mt-1">Available Cash & Total Cash Movement</h2>
                <p className="text-xs text-slate-400 mt-0.5">All account balances.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 pt-2">
              <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono tracking-wide">Selected Date Preset</span>
                <span className="text-xs font-bold text-white block mt-1">
                  {datePreset === 'today' ? 'Today Only' : 
                   datePreset === '1week' ? 'Past 7 Days' : 
                   datePreset === '1month' ? 'Past 30 Days' : 'Custom Interval'}
                </span>
                <span className="text-[10px] font-mono text-slate-500 block mt-0.5">{startDateStr} to {endDateStr}</span>
              </div>

              <div className="bg-emerald-950/20 p-4 rounded-2xl border border-emerald-900/60 text-white animate-fadeIn">
                <span className="text-[10px] font-bold text-emerald-400 block uppercase font-mono tracking-wide">Total Payment In (Money Ins)</span>
                <span className="text-lg font-black text-emerald-300 block mt-0.5 font-sans">+{formatCurrency(combinedStats.totalMoneyIn)}</span>
                <span className="text-[9.5px] font-medium text-slate-400 block mt-0.5">{combinedStats.countMoneyIn} credit movements</span>
              </div>

              <div className="bg-rose-950/20 p-4 rounded-2xl border border-rose-900/40 text-white animate-fadeIn">
                <span className="text-[10px] font-bold text-rose-400 block uppercase font-mono tracking-wide">Total Payment Out (Money Outs)</span>
                <span className="text-lg font-black text-rose-300 block mt-0.5 font-sans">-{formatCurrency(combinedStats.totalMoneyOut)}</span>
                <span className="text-[9.5px] font-medium text-slate-400 block mt-0.5">{combinedStats.countMoneyOut} debit movements</span>
              </div>

              <div className={`p-4 rounded-2xl border ${combinedStats.netChange >= 0 ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300' : 'bg-rose-950/30 border-rose-800 text-rose-300'} animate-fadeIn`}>
                <span className="text-[10px] font-bold block uppercase font-mono tracking-wide">Remaining Net Income</span>
                <span className="text-lg font-black block mt-0.5 font-sans">{combinedStats.netChange >= 0 ? '+' : ''}{formatCurrency(combinedStats.netChange)}</span>
                <span className="text-[9.5px] font-mono block mt-0.5 text-slate-400">Net outcome in selected range</span>
              </div>
            </div>
          </div>

          {/* CORE INDIVIDUAL CASH & BANK ACCOUNTS */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Accounts & Wallets</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {(() => {
                return channels.filter(chan => chan.category !== 'person').map(chan => {
                  const currentBalance = channelBalances[chan.id]?.current || 0;
                  
                  // Compute period range inflow and range outflow for this account specifically from the same activeTenantFilterLedger
                  let periodMoneyIn = 0;
                  let periodMoneyOut = 0;
                  activeTenantFilterLedger.forEach(entry => {
                    if (entry.channelId === chan.id) {
                      if (entry.amount >= 0) {
                        periodMoneyIn += entry.amount;
                      } else {
                        periodMoneyOut += Math.abs(entry.amount);
                      }
                    }
                  });

                  return (
                    <button
                      key={chan.id}
                      type="button"
                      onClick={() => setSelectedChannelId(chan.id)}
                      className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs transition-all hover:bg-slate-50/10 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2.5 w-full min-w-0">
                          <div className={`p-2 rounded-xl shrink-0 ${
                            chan.category === 'bank' ? 'bg-blue-50 text-blue-600' :
                            chan.category === 'telco' ? 'bg-indigo-50 text-indigo-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {chan.category === 'bank' ? <Landmark className="w-5 h-5" /> : 
                             chan.category === 'telco' ? <Wallet className="w-5 h-5" /> :
                             <Coins className="w-5 h-5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-extrabold text-slate-900 text-xs truncate" title={chan.name}>{chan.name}</h4>
                            <span className="text-[9.5px] font-mono text-slate-400 block mt-0.5 truncate">{chan.provider}</span>
                          </div>
                        </div>
                        <span className={`text-[8.5px] font-extrabold font-mono tracking-wider uppercase px-2 py-0.5 rounded shrink-0 ${
                          chan.category === 'bank' ? 'bg-blue-100 text-blue-800' :
                          chan.category === 'telco' ? 'bg-indigo-100 text-indigo-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {chan.category === 'bank' ? 'Bank' :
                           chan.category === 'telco' ? 'Mobile' : 'Till'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-100/80 flex items-baseline justify-between">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Vault Balance</span>
                        <span className="text-lg font-black text-slate-950 font-sans tracking-tight">{formatCurrency(currentBalance)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed border-slate-100/80 text-[10.5px]">
                        <div className="space-y-0.5">
                          <span className="block text-[9px] font-bold text-slate-400 font-mono uppercase tracking-wider">Money Ins</span>
                          <span className="text-emerald-600 font-bold font-sans">+{formatCurrency(periodMoneyIn)}</span>
                        </div>
                        <div className="space-y-0.5 text-right border-l border-slate-100 pl-2">
                          <span className="block text-[9px] font-bold text-slate-400 font-mono uppercase tracking-wider">Money Outs</span>
                          <span className="text-slate-600 font-medium font-sans">-{formatCurrency(periodMoneyOut)}</span>
                        </div>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6" id="instant-settlements-box">
            
            {/* SIMPLE TRANSFER / DEPOSIT PANEL */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-4 sm:p-6 self-start space-y-4">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 text-emerald-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Move Money / Settle Cash</h2>
              </div>
              
              <p className="text-xs leading-relaxed text-slate-500 font-sans">
                Move money between accounts or send it to a person.
              </p>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700 font-mono">Payment Destinations</h3>
                    <p className="text-[10.5px] text-slate-500">Add an account.</p>
                  </div>
                  {addAccountSuccess && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1">
                      {addAccountSuccess}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={newAccType}
                    onChange={(e) => setNewAccType(e.target.value as 'bank' | 'telco' | 'person')}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-3 sm:py-2 text-xs font-bold text-slate-800 outline-none focus:border-slate-800 min-h-[46px] sm:min-h-0"
                  >
                    <option value="bank">Bank</option>
                    <option value="telco">Mobile Money</option>
                    <option value="person">Sent to Person</option>
                  </select>
                  <input
                    type="text"
                    value={newAccProvider}
                    onChange={(e) => setNewAccProvider(e.target.value)}
                    placeholder={newAccType === 'bank' ? 'Bank name' : newAccType === 'person' ? 'Bank/Mobile name' : 'Mobile money name'}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-3 sm:py-2 text-xs font-semibold text-slate-800 outline-none focus:border-slate-800 min-h-[46px] sm:min-h-0"
                  />
                  <input
                    type="text"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    placeholder={newAccType === 'person' ? 'Person name' : 'Account name'}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-3 sm:py-2 text-xs font-semibold text-slate-800 outline-none focus:border-slate-800 min-h-[46px] sm:min-h-0"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                  <input
                    type="text"
                    value={newAccNumber}
                    onChange={(e) => setNewAccNumber(e.target.value)}
                    placeholder={newAccType === 'person' ? 'Account number or mobile number' : newAccType === 'bank' ? 'Account number' : 'Till/paybill/mobile number'}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-3 sm:py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-slate-800 min-h-[46px] sm:min-h-0"
                  />
                  <button
                    type="button"
                    onClick={handleCreateAccount}
                    className="px-4 py-3 sm:py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase border-none cursor-pointer min-h-[46px] sm:min-h-0"
                  >
                    Add
                  </button>
                </div>
              </div>

              {settleSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-150 rounded-2xl flex items-start space-x-2 animate-fadeIn">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-800 font-medium whitespace-pre-wrap">{settleSuccessMsg}</div>
                </div>
              )}

              <form onSubmit={handleExecuteSettleTill} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-404 uppercase tracking-wider block mb-1">1. Take money from:</label>
                  <select
                    value={settleSource}
                    onChange={(e) => setSettleSource(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 sm:py-2 text-xs text-slate-800 font-semibold focus:border-slate-800 outline-none cursor-pointer min-h-[46px] sm:min-h-0"
                  >
                    {channels.filter(chan => chan.category !== 'person').map(chan => (
                      <option key={chan.id} value={chan.id}>
                        {chan.name} (Current: {formatCurrency(channelBalances[chan.id]?.current)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-center items-center py-0.5">
                  <div className="p-1 bg-slate-100 rounded-lg">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 rotate-90 lg:rotate-0" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-404 uppercase tracking-wider block mb-1">2. Put money into:</label>
                  <select
                    value={settleTarget}
                    onChange={(e) => setSettleTarget(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 sm:py-2 text-xs text-slate-800 font-semibold focus:border-slate-800 outline-none cursor-pointer min-h-[46px] sm:min-h-0"
                  >
                    <optgroup label="Mobile Wallets">
                      {channels.filter(c => c.category === 'telco').map(chan => (
                        <option key={chan.id} value={chan.id}>
                          {chan.name} (Current: {formatCurrency(channelBalances[chan.id]?.current)})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Banks Accounts">
                      {channels.filter(c => c.category === 'bank').map(chan => (
                        <option key={chan.id} value={chan.id}>
                          {chan.name} (Current: {formatCurrency(channelBalances[chan.id]?.current)})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Physical Drawer or Safes">
                      {channels.filter(c => c.category === 'physical').map(chan => (
                        <option key={chan.id} value={chan.id}>
                          {chan.name} (Current: {formatCurrency(channelBalances[chan.id]?.current)})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Sent to Person">
                      {channels.filter(c => c.category === 'person').map(chan => (
                        <option key={chan.id} value={chan.id}>
                          {chan.name} - {chan.provider || 'Recipient'} ({chan.accountNumber || 'No number'})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">3. Amount to move:</label>
                  <input
                    type="number"
                    placeholder="e.g. 100000"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 sm:py-2 text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:border-slate-800 outline-none min-h-[46px] sm:min-h-0"
                    required
                  />
                </div>

                {/* Secure Receipts & Proof Upload Panel */}
                <div className="space-y-3 pt-2 pb-1 border-t border-b border-dashed border-slate-200">
                  {showRuleWarning && (
                    <div className="bg-rose-50/70 border border-rose-150 rounded-2xl p-3 text-[11px] text-rose-800 font-semibold space-y-1 animate-fadeIn">
                      <span className="block font-extrabold text-rose-900 uppercase tracking-wider font-mono">⚠️ STRICT SECURITY RULE:</span>
                      <span className="block leading-relaxed">
                        You must upload either a **Standard Receipt (#4)** OR a **Mobile Money Slip (#5)** to continue. Without at least one proof, the money transfer cannot be submitted.
                      </span>
                    </div>
                  )}

                  {/* File Upload 1: Bank or General Receipt */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-slate-404 uppercase tracking-wider">
                        4. Upload Standard Receipt (PDF or Image):
                      </label>
                      {attachedReceiptName && (
                        <button 
                          type="button" 
                          onClick={() => setAttachedReceiptName('')}
                          className="text-rose-500 hover:text-rose-700 text-[10px] font-bold bg-transparent border-none cursor-pointer"
                        >
                          Clear File
                        </button>
                      )}
                    </div>
                    <div className="relative flex items-center justify-center border border-dashed border-slate-200 hover:border-slate-300 rounded-xl p-3 bg-slate-50 focus-within:ring-1 focus-within:ring-indigo-505 transition-all cursor-pointer min-h-[52px]">
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setAttachedReceiptName(e.target.files[0].name);
                            setShowRuleWarning(false);
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div className="flex items-center space-x-2 text-xs text-slate-500 pointer-events-none">
                        <FileText className={`w-4 h-4 text-indigo-500 transition-transform ${attachedReceiptName ? 'scale-110' : ''}`} />
                        <span className="font-semibold truncate max-w-[210px]">
                          {attachedReceiptName || 'No file chosen — Click to attach receipt'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* File Upload 2: Muamala wa Simu */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-slate-404 uppercase tracking-wider">
                        5. Upload Mobile Money Receipt / Screenshot Slip:
                      </label>
                      {attachedMuamalaName && (
                        <button 
                          type="button" 
                          onClick={() => setAttachedMuamalaName('')}
                          className="text-rose-500 hover:text-rose-700 text-[10px] font-bold bg-transparent border-none cursor-pointer"
                        >
                          Clear File
                        </button>
                      )}
                    </div>
                    <div className="relative flex items-center justify-center border border-dashed border-slate-200 hover:border-slate-300 rounded-xl p-3 bg-slate-50 focus-within:ring-1 focus-within:ring-emerald-505 transition-all cursor-pointer min-h-[52px]">
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setAttachedMuamalaName(e.target.files[0].name);
                            setShowRuleWarning(false);
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div className="flex items-center space-x-2 text-xs text-slate-500 pointer-events-none">
                        <Wallet className={`w-4 h-4 text-emerald-500 transition-transform ${attachedMuamalaName ? 'scale-110' : ''}`} />
                        <span className="font-semibold truncate max-w-[210px]">
                          {attachedMuamalaName || 'No file chosen — Click to attach Mobile receipt'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">6. Short note/memo:</label>
                  <input
                    type="text"
                    placeholder="Reason for transfer?"
                    value={settleMemo}
                    onChange={(e) => setSettleMemo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 sm:py-2 text-xs focus:border-slate-800 outline-none placeholder-slate-400 text-slate-800 min-h-[46px] sm:min-h-0"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 px-3 rounded-2xl sm:rounded-xl text-xs transition-all cursor-pointer shadow-sm flex items-center justify-center space-x-1 border-none min-h-[50px] sm:min-h-0"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Perform Money Transfer</span>
                </button>
              </form>
            </div>



            {/* QUICK AUDIT TRACKER INFOGRAPHIC */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-4 sm:p-6 flex flex-col justify-between space-y-5 shadow-xs animate-fadeIn">
              <div>
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">How to transfer money</h2>
                    <p className="text-xs text-slate-500 font-sans">Transfer rules.</p>
                  </div>
                  <span className="text-[9px] font-mono font-bold bg-slate-100 border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full uppercase">
                    Secured
                  </span>
                </div>

                <div className="space-y-4 pt-4 font-sans text-slate-600">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-extrabold text-xs font-mono">
                      1
                    </div>
                    <div className="space-y-0.5 text-xs">
                      <strong className="text-slate-800 font-bold block">From account</strong>
                      <p className="leading-relaxed text-slate-500">Select source account.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-extrabold text-xs font-mono">
                      2
                    </div>
                    <div className="space-y-0.5 text-xs">
                      <strong className="text-slate-800 font-bold block">To account</strong>
                      <p className="leading-relaxed text-slate-500">Select destination.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 font-extrabold text-xs font-mono">
                      3
                    </div>
                    <div className="space-y-0.5 text-xs text-slate-600">
                      <strong className="text-rose-700 font-bold block">Upload receipt or proof</strong>
                      <p className="leading-relaxed text-rose-800 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
                        Attach bank slip or mobile screenshot before transfer.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-sans mt-5 text-left border-t border-slate-100 pt-3">
                * Manual adjustments are timestamped.
              </div>
            </div>

          </div>
        </>
      ) : (
        (() => {
          const chan = channels.find(c => c.id === selectedChannelId)!;
          const sums = channelBalances[chan.id] || { current: 0 };
          
          let periodMoneyIn = 0;
          let periodMoneyOut = 0;
          let countMoneyIn = 0;
          let countMoneyOut = 0;
          
          activeTenantFilterLedger.forEach(entry => {
            if (entry.channelId === chan.id) {
              if (entry.amount >= 0) {
                periodMoneyIn += entry.amount;
                countMoneyIn++;
              } else {
                periodMoneyOut += Math.abs(entry.amount);
                countMoneyOut++;
              }
            }
          });

          const periodNet = periodMoneyIn - periodMoneyOut;

          return (
            <div className="space-y-6 animate-fadeIn">
              {/* Spotlight Banner Card */}
              <div className={`border p-4 sm:p-6 rounded-2xl md:rounded-3xl relative overflow-hidden shadow-xs ${
                chan.category === 'telco' ? 'bg-gradient-to-br from-indigo-50/40 via-white to-white border-indigo-150' :
                chan.category === 'bank' ? 'bg-gradient-to-br from-blue-50/40 via-white to-white border-blue-150' :
                'bg-gradient-to-br from-amber-50/40 via-white to-white border-amber-150'
              }`}>
                {/* Back button */}
                <button
                  onClick={() => setSelectedChannelId('all')}
                  className="static sm:absolute sm:top-4 sm:right-4 mb-4 sm:mb-0 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold font-sans transition-all border-none cursor-pointer flex items-center justify-center space-x-1 min-h-[42px]"
                >
                  <span>← Back to Combined View</span>
                </button>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 sm:pt-2">
                  <div className="flex items-start space-x-4">
                    <div className={`p-4 rounded-2xl shrink-0 ${
                      chan.category === 'telco' ? 'bg-indigo-50 text-indigo-600' :
                      chan.category === 'bank' ? 'bg-blue-50 text-blue-600' :
                      'bg-amber-50 text-amber-600'
                    }`}>
                      {chan.category === 'telco' ? <Wallet className="w-8 h-8" /> :
                       chan.category === 'bank' ? <Landmark className="w-8 h-8" /> :
                       <Coins className="w-8 h-8" />}
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block font-mono pb-0.5">SELECTED PAYMENT MODE DETAILS</span>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{chan.name}</h2>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1 font-medium">
                        <span>Provider: <strong className="text-slate-700">{chan.provider}</strong></span>
                        <span>Category: <strong className="text-slate-705 capitalize">{chan.category} Operational</strong></span>
                        {chan.accountNumber && (
                          <span>A/C or Code: <strong className="text-slate-800 font-mono bg-slate-100 px-1.5 py-0.5 rounded-md">{chan.accountNumber}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-left md:text-right border-t border-slate-100 md:border-t-0 pt-4 md:pt-0 shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 block font-mono pb-0.5 uppercase tracking-wide">CURRENT TOTAL BALANCE</span>
                    <span className="text-2xl font-black text-slate-900 font-sans block tracking-tight">{formatCurrency(sums.current)}</span>
                    <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 mt-1 inline-block">
                      Active & Synchronized
                    </span>
                  </div>
                </div>

                {/* Date Filters statistics grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mt-6 sm:mt-8 pt-6 border-t border-slate-200">
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono tracking-wide">Selected Date preset</span>
                    <span className="text-xs font-bold text-slate-700 block mt-1 select-none">
                      {datePreset === 'today' ? 'Today Only' : 
                       datePreset === '1week' ? 'Past 7 Days' : 
                       datePreset === '1month' ? 'Past 30 Days' : 
                       datePreset === '3months' ? 'Past 3 Months' : 'Custom Interval'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 block mt-0.5">{startDateStr} to {endDateStr}</span>
                  </div>

                  <div className="bg-emerald-50/20 p-4 rounded-2xl border border-emerald-100">
                    <span className="text-[10px] font-bold text-emerald-600 block uppercase font-mono tracking-wide">Total Money In</span>
                    <span className="text-lg font-black text-emerald-700 block mt-0.5 font-sans">+{formatCurrency(periodMoneyIn)}</span>
                    <span className="text-[9.5px] font-medium text-slate-400 block mt-0.5">{countMoneyIn} credit movements</span>
                  </div>

                  <div className="bg-rose-50/10 p-4 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-rose-600 block uppercase font-mono tracking-wide">Total Money Out</span>
                    <span className="text-lg font-black text-rose-600 block mt-0.5 font-sans">-{formatCurrency(periodMoneyOut)}</span>
                    <span className="text-[9.5px] font-medium text-slate-400 block mt-0.5">{countMoneyOut} debit movements</span>
                  </div>

                  <div className={`p-4 rounded-2xl border ${periodNet >= 0 ? 'bg-emerald-50/15 border-emerald-150 text-emerald-800' : 'bg-rose-50/15 border-rose-150 text-rose-800'}`}>
                    <span className="text-[10px] font-bold block uppercase font-mono tracking-wide">Net Income</span>
                    <span className="text-lg font-black block mt-0.5 font-sans">{periodNet >= 0 ? '+' : ''}{formatCurrency(periodNet)}</span>
                    <span className="text-[9.5px] font-mono block mt-0.5 text-slate-500">Sum outcome inside date range</span>
                  </div>
                </div>
              </div>

              {/* Quick Money Transfers */}
              <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-4 sm:p-6">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
                  <RefreshCw className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Quick Settlements / Transfers for {chan.name}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div>
                    <p className="text-xs text-slate-500 leading-relaxed font-sans">
                      Move money from <strong>{chan.name}</strong>.
                    </p>
                  </div>
                  <div className="flex justify-start md:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setSettleSource(chan.id);
                        setSelectedChannelId('all');
                        setTimeout(() => {
                          document.getElementById('instant-settlements-box')?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 sm:py-2.5 px-5 rounded-2xl text-xs transition-style cursor-pointer flex items-center justify-center space-x-2 max-w-full min-h-[48px] sm:min-h-0"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Transfer from this account</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* TRANSACTION LIST IN VERY SEAMLESS CLEAR ENGLISH */}
      <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Account History</h3>
            <p className="text-xs text-slate-400 select-none">Money in and out.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search transactions..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="pl-8.5 pr-3 py-3 sm:py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-slate-800 w-full sm:w-52 min-h-[46px] sm:min-h-0"
              />
            </div>

            {/* Simple Wording Source Type Filter */}
            <select
              value={auditTypeFilter}
              onChange={(e) => setAuditTypeFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-3 sm:py-1.5 text-xs text-slate-700 font-bold outline-none focus:border-slate-800 cursor-pointer min-h-[46px] sm:min-h-0"
            >
              <option value="ALL">All Payments</option>
              <option value="INITIAL_BALANCE">Opening Reserves</option>
              <option value="POS_CHECKOUT">Shop Sales Money In</option>
              <option value="SETTLE_TILL_DEPOSIT">Account Transfers</option>
              <option value="EXPENSE_WITHDRAWAL">Cash Expense Money Out</option>
            </select>

            {/* CSV report download button */}
            <button
              id="btn-download-csv-report"
              onClick={downloadAuditReportCSV}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs py-3 sm:py-1.5 px-3.5 rounded-xl cursor-pointer transition-all flex items-center justify-center space-x-1 shadow-sm shrink-0 min-h-[46px] sm:min-h-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Report</span>
            </button>

          </div>
        </div>

        {/* Audit Table List rendering */}
        <div className="hidden xl:block overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 font-bold font-mono text-slate-500 text-[10px] uppercase select-none">
                <th className="p-3 pl-4">Date</th>
                <th className="p-3">Ref #</th>
                <th className="p-3">Account</th>
                <th className="p-3">Type</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 pr-4 pl-6">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {searchedAuditTrail.length > 0 ? (
                searchedAuditTrail.map((entry) => {
                  const chan = channels.find(c => c.id === entry.channelId);
                  const counterParty = entry.counterPartyChannelId ? channels.find(c => c.id === entry.counterPartyChannelId) : undefined;
                  const isPositive = entry.amount >= 0;
                  const isPersonPayout = entry.sourceType === 'SETTLE_TILL_DEPOSIT' && counterParty?.category === 'person';
                  
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/50">
                      <td className="p-3 pl-4 font-mono text-slate-400 text-[10.5px]">
                        {new Date(entry.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="p-3 font-mono text-slate-700 font-semibold" title={entry.id}>
                        {(() => {
                          const idStr = entry.id;
                          let display = idStr;
                          if (display.startsWith('POS-RECON-')) {
                            display = display.replace('POS-RECON-', 'PR-');
                          } else if (display.startsWith('EXP-WITHDR-')) {
                            display = display.replace('EXP-WITHDR-', 'EW-');
                          } else if (display.startsWith('SETTLE-TX-')) {
                            display = display.replace('SETTLE-TX-', 'TX-');
                          } else if (display.startsWith('initial-')) {
                            display = display.replace('initial-', 'INI-');
                          }
                          return display.length > 14 ? `${display.slice(0, 12)}...` : display;
                        })()}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-800">{chan?.name || 'N/A'}</span>
                        <span className="text-[9.5px] block text-slate-400 uppercase font-mono tracking-wide">{chan?.provider}</span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold font-mono tracking-wide ${
                          entry.sourceType === 'POS_CHECKOUT' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                          isPersonPayout ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                          entry.channelId === 'counter-01' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                          entry.sourceType === 'SETTLE_TILL_DEPOSIT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          entry.sourceType === 'EXPENSE_WITHDRAWAL' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                          'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {entry.sourceType === 'POS_CHECKOUT' ? 'Payment In' :
                           isPersonPayout ? 'Sent to Person' :
                           entry.channelId === 'counter-01' ? 'Cash Counter' :
                           entry.sourceType === 'SETTLE_TILL_DEPOSIT' ? 'Transfer' :
                           entry.sourceType === 'EXPENSE_WITHDRAWAL' ? 'Cash Expense' : 'Starting Balance'}
                        </span>
                      </td>
                      <td className={`p-3 text-right font-black font-sans text-xs ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{formatCurrency(entry.amount)}
                      </td>
                      <td className="p-3 pr-4 pl-6 text-slate-500 font-medium whitespace-pre-wrap max-w-sm">
                        {entry.description}
                        {entry.counterPartyChannelId && (
                          <span className="text-[10px] block text-slate-400 italic">
                            {isPersonPayout ? 'Sent to' : 'Other account'}: {counterParty?.name || 'N/A'}
                            {counterParty?.accountNumber ? ` (${counterParty.accountNumber})` : ''}
                          </span>
                        )}
                        {(entry.receiptFile || entry.muamalaFile) && (
                          <div className="mt-2 text-[10px] gap-1.5 flex flex-wrap pt-1">
                            {entry.receiptFile && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 font-extrabold font-mono rounded-md border border-indigo-100 shadow-3xs" title={entry.receiptFile}>
                                <FileText className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span className="max-w-[120px] truncate">Standard Receipt: {entry.receiptFile}</span>
                              </span>
                            )}
                            {entry.muamalaFile && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 font-extrabold font-mono rounded-md border border-emerald-100 shadow-3xs" title={entry.muamalaFile}>
                                <Wallet className="w-3 h-3 text-emerald-500 shrink-0" />
                                <span className="max-w-[120px] truncate">Mobile Slip: {entry.muamalaFile}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 font-sans text-slate-400">
                    <div className="flex flex-col items-center space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-300" />
                      <p className="font-bold text-slate-500">No Transactions Found</p>
                      <p className="text-[11px] text-slate-400 max-w-xs">No matching transactions.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="xl:hidden space-y-3">
          {searchedAuditTrail.length > 0 ? (
            searchedAuditTrail.map((entry) => {
              const chan = channels.find(c => c.id === entry.channelId);
              const counterParty = entry.counterPartyChannelId ? channels.find(c => c.id === entry.counterPartyChannelId) : undefined;
              const isPositive = entry.amount >= 0;
              const isPersonPayout = entry.sourceType === 'SETTLE_TILL_DEPOSIT' && counterParty?.category === 'person';
              const displayType = entry.sourceType === 'POS_CHECKOUT' ? 'Payment In' :
                isPersonPayout ? 'Sent to Person' :
                entry.channelId === 'counter-01' ? 'Cash Counter' :
                entry.sourceType === 'SETTLE_TILL_DEPOSIT' ? 'Transfer' :
                entry.sourceType === 'EXPENSE_WITHDRAWAL' ? 'Cash Expense' : 'Starting Balance';
              const shortRef = (() => {
                let display = entry.id;
                if (display.startsWith('POS-RECON-')) display = display.replace('POS-RECON-', 'PR-');
                else if (display.startsWith('EXP-WITHDR-')) display = display.replace('EXP-WITHDR-', 'EW-');
                else if (display.startsWith('SETTLE-TX-')) display = display.replace('SETTLE-TX-', 'TX-');
                else if (display.startsWith('initial-')) display = display.replace('initial-', 'INI-');
                return display.length > 14 ? `${display.slice(0, 12)}...` : display;
              })();

              return (
                <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">{shortRef}</span>
                      <p className="mt-1 text-sm font-black text-slate-900 truncate">{chan?.name || 'N/A'}</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {new Date(entry.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                    <span className={`shrink-0 text-sm font-black ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isPositive ? '+' : ''}{formatCurrency(entry.amount)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black font-mono tracking-wide ${
                      entry.sourceType === 'POS_CHECKOUT' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                      isPersonPayout ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                      entry.channelId === 'counter-01' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      entry.sourceType === 'SETTLE_TILL_DEPOSIT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      entry.sourceType === 'EXPENSE_WITHDRAWAL' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                      'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {displayType}
                    </span>
                    {chan?.provider && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white border border-slate-200 text-slate-500">
                        {chan.provider}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-slate-600 leading-relaxed bg-white border border-slate-200 rounded-xl p-3">
                    {entry.description}
                    {entry.counterPartyChannelId && (
                      <span className="text-[10px] block text-slate-400 italic mt-1">
                        {isPersonPayout ? 'Sent to' : 'Other account'}: {counterParty?.name || 'N/A'}
                        {counterParty?.accountNumber ? ` (${counterParty.accountNumber})` : ''}
                      </span>
                    )}
                  </p>

                  {(entry.receiptFile || entry.muamalaFile) && (
                    <div className="mt-2 text-[10px] gap-1.5 flex flex-wrap">
                      {entry.receiptFile && (
                        <span className="inline-flex items-center space-x-1 px-2 py-1 bg-indigo-50 text-indigo-700 font-extrabold font-mono rounded-md border border-indigo-100" title={entry.receiptFile}>
                          <FileText className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span className="max-w-[180px] truncate">Standard Receipt: {entry.receiptFile}</span>
                        </span>
                      )}
                      {entry.muamalaFile && (
                        <span className="inline-flex items-center space-x-1 px-2 py-1 bg-emerald-50 text-emerald-800 font-extrabold font-mono rounded-md border border-emerald-100" title={entry.muamalaFile}>
                          <Wallet className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="max-w-[180px] truncate">Mobile Slip: {entry.muamalaFile}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 font-sans text-slate-400 rounded-2xl border border-slate-200 bg-slate-50">
              <div className="flex flex-col items-center space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-300" />
                <p className="font-bold text-slate-500">No Transactions Found</p>
                <p className="text-[11px] text-slate-400 max-w-xs">No matching transactions.</p>
              </div>
            </div>
          )}
        </div>
        
        {searchedAuditTrail.length > 0 && (
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono select-none pt-2">
            <span>Showing {searchedAuditTrail.length} transaction entries</span>
            <span>All systems running normally</span>
          </div>
        )}

      </div>

    </div>

    </div>
  );
}
