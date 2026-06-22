import React, { useState, useEffect } from 'react';
import { Tenant, Sale, Expense, PaymentChannel, LedgerEntry, User as AppUser } from '../types';
import { 
  Landmark, 
  Wallet, 
  Coins, 
  Calendar, 
  ArrowRight, 
  Plus, 
  CheckCircle, 
  Search, 
  Filter, 
  Clock, 
  User, 
  Download, 
  AlertCircle, 
  ChevronDown, 
  FileText,
  Building,
  RefreshCw,
  PlusCircle,
  HelpCircle
} from 'lucide-react';

interface DashboardCashBankProps {
  activeTenant: Tenant;
  sales: Sale[];
  expenses: Expense[];
  deliveries?: any[];
  user?: AppUser;
}

export default function DashboardCashBank({ 
  activeTenant, 
  sales, 
  expenses,
  deliveries = [],
  user
}: DashboardCashBankProps) {
  // Date interval settings state with user-friendly names
  const [datePreset, setDatePreset] = useState<'today' | '1week' | '1month' | 'custom'>('1month');
  
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
    { id: 'yas-merchant', name: 'Delivery Account (mixx by Yas Paybill)', category: 'telco', provider: 'Yas', accountNumber: '223399' },
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
    const cached = localStorage.getItem(`jasper_channels_${activeTenant.id}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error("Failed to parse cached channels", e);
      }
    }
    return defaultBaseChannels;
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
  const [settleSource, setSettleSource] = useState<string>('counter-01');
  const [settleTarget, setSettleTarget] = useState<string>('crdb-corporate');
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
    const cached = localStorage.getItem(storageKey);
    const generated: LedgerEntry[] = [];

    // Base funds in each account at startup
    const seedBalances = [
      { id: 'initial-mpesa', channelId: 'mpesa-till', amount: 1500000, desc: 'Starting balance in wallet' },
      { id: 'initial-crdb', channelId: 'crdb-corporate', amount: 8000000, desc: 'Starting balance in main bank account' },
      { id: 'initial-nmb', channelId: 'nmb-checking', amount: 4500000, desc: 'Starting balance in secondary checking account' },
      { id: 'initial-drawer1', channelId: 'counter-01', amount: 350000, desc: 'Starting cash float for till 01' },
      { id: 'initial-safe', channelId: 'office-safe', amount: 2500000, desc: 'Starting reserve cash inside lock safe' }
    ];

    seedBalances.forEach(seed => {
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

    // Link incoming sales to correct payment methods automatically
    sales.forEach(sale => {
      let targetChannelId = 'counter-01';
      let desc = `Received sale payment from customer: Receipt ${sale.reference}`;
      const method = sale.paymentMethod?.toLowerCase() || '';
      
      if (method.includes('mpesa')) {
        targetChannelId = 'mpesa-till';
        desc = `M-Pesa payment received: Receipt ${sale.reference}`;
      } else if (method.includes('momo') || method.includes('money') || method.includes('tigo') || method.includes('yas') || method.includes('mixx') || method.includes('airtel')) {
        targetChannelId = 'yas-merchant';
        desc = `Mobile money payment received: Receipt ${sale.reference}`;
      } else if (method.includes('card') || method.includes('paystack')) {
        targetChannelId = 'pos-card-terminal';
        desc = `Card machine payment received: Receipt ${sale.reference}`;
      } else if (method.includes('bank')) {
        targetChannelId = 'crdb-corporate';
        desc = `Direct bank transfer received: Receipt ${sale.reference}`;
      } else {
        targetChannelId = 'counter-01';
        desc = `Cash received in register drawer: Receipt ${sale.reference}`;
      }

      generated.push({
        id: `POS-RECON-${sale.id}`,
        tenantId: activeTenant.id,
        channelId: targetChannelId,
        amount: Math.max(0, sale.total - (sale.deliveryCost || 0)),
        entryType: 'credit',
        sourceType: 'POS_CHECKOUT',
        description: desc,
        timestamp: sale.timestamp
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

      let targetChannelId = 'counter-01';
      let desc = `Received delivery charge payment for Order Ref: ${del.id}`;
      const method = del.deliveryPaymentMethod?.toLowerCase() || '';
      
      if (method.includes('mpesa')) {
        targetChannelId = 'mpesa-till';
        desc = `M-Pesa delivery payment: Ref ${del.id}`;
      } else if (method.includes('momo') || method.includes('money') || method.includes('tigo') || method.includes('yas') || method.includes('mixx') || method.includes('airtel')) {
        targetChannelId = 'yas-merchant';
        desc = `Mobile money delivery payment: Ref ${del.id}`;
      } else if (method.includes('card') || method.includes('paystack')) {
        targetChannelId = 'pos-card-terminal';
        desc = `Card machine delivery payment: Ref ${del.id}`;
      } else if (method.includes('bank')) {
        targetChannelId = 'crdb-corporate';
        desc = `Direct bank transfer delivery payment: Ref ${del.id}`;
      } else {
        targetChannelId = 'counter-01';
        desc = `Cash received for delivery: Ref ${del.id}`;
      }

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

    const finalInitial = [...generated, ...defaultSettleDrops];
    setLedgerEntries(finalInitial);
    localStorage.setItem(storageKey, JSON.stringify(finalInitial));
  }, [activeTenant.id, sales, expenses, deliveries]);

  // Update cached file local records
  const saveLedgerState = (entriesList: LedgerEntry[]) => {
    setLedgerEntries(entriesList);
    localStorage.setItem(`jasper_cash_bank_matrix_${activeTenant.id}`, JSON.stringify(entriesList));
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
    localStorage.setItem(`jasper_channels_${activeTenant.id}`, JSON.stringify(updated));

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
    const aggregates: Record<string, { current: number; inflowSales: number; inflowDrops: number; totalMoney In: number }> = {};
    
    channels.forEach(chan => {
      aggregates[chan.id] = { current: 0, inflowSales: 0, inflowDrops: 0, totalMoney In: 0 };
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
            targetChan.totalMoney In += entry.amount;
          } else if (entry.sourceType === 'SETTLE_TILL_DEPOSIT') {
            targetChan.inflowDrops += entry.amount;
            targetChan.totalMoney In += entry.amount;
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

  // Consolidated System Statistics (Responds to date range and links all payment modes)
  const getCombinedPerformanceStats = () => {
    let totalMoney In = 0;
    let totalMoney Out = 0;
    let countMoney In = 0;
    let countMoney Out = 0;

    activeTenantFilterLedger.forEach(entry => {
      if (entry.entryType === 'credit' || entry.amount >= 0) {
        totalMoney In += entry.amount;
        countMoney In++;
      } else {
        totalMoney Out += Math.abs(entry.amount);
        countMoney Out++;
      }
    });

    const totalCurrentRemainingBalance = channels
      .filter(chan => chan.category !== 'person')
      .reduce((sum, chan) => sum + (channelBalances[chan.id]?.current || 0), 0);
    const netChange = totalMoney In - totalMoney Out;

    return {
      totalMoney In,
      totalMoney Out,
      countMoney In,
      countMoney Out,
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
    <div className="w-full space-y-6 select-text">
      
      {/* SIMPLE HEADER AREA */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-150 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-slate-900 rounded-xl text-white">
              <Landmark className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">MONEY OVERVIEW</span>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">My Money & Bank Accounts</h1>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1 sm:max-w-xl">
            See all your cash drawer drawers, mobile money, and bank savings in one simple dashboard. You can also transfer money between accounts.
          </p>
        </div>

        {/* Date presets with direct always-visible calendar ranges */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center bg-slate-50 border border-slate-200 rounded-3xl p-1.5 gap-3 self-start lg:self-auto">
          <div className="flex flex-wrap gap-1 bg-slate-200/50 p-0.5 rounded-xl">
            {(['today', '1week', '1month'] as const).map((preset) => (
              <button
                key={preset}
                id={`preset-${preset}`}
                type="button"
                onClick={() => setDatePreset(preset)}
                className={`px-3 py-1 text-xs font-bold capitalize rounded-lg transition-all cursor-pointer border-none outline-none ${
                  datePreset === preset
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/80 bg-transparent'
                }`}
              >
                {preset === 'today' ? 'Today' : 
                 preset === '1week' ? 'Past 7 Days' : 
                 preset === '1month' ? 'Past 30 Days' : ''}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 animate-fadeIn bg-white border border-slate-200 px-3 py-1 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              type="date"
              value={startDateStr}
              onChange={(e) => {
                setStartDateStr(e.target.value);
                setDatePreset('custom');
              }}
              className="bg-transparent border-none text-slate-800 text-xs font-bold outline-none cursor-pointer p-0 font-mono"
            />
            <span className="text-slate-400 text-xs font-bold font-mono">to</span>
            <input
              type="date"
              value={endDateStr}
              onChange={(e) => {
                setEndDateStr(e.target.value);
                setDatePreset('custom');
              }}
              className="bg-transparent border-none text-slate-800 text-xs font-bold outline-none cursor-pointer p-0 font-mono"
            />
          </div>
        </div>
      </div>

      {/* SEAMLESS PAYMENT MODE CHOOSERS */}
      <div className="p-5 bg-white border border-slate-150 rounded-3xl shadow-xs space-y-3 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">CHOOSE PAYMENT MODE FOR DETAILED DATE-BASED METRICS</span>
          </div>
          <span className="text-[10px] bg-slate-900 text-white font-extrabold px-2.5 py-0.5 rounded-md uppercase font-mono tracking-widest scale-95">
            {selectedChannelId === 'all' ? 'All Combined Active' : `${channels.find(c => c.id === selectedChannelId)?.name} Filtered`}
          </span>
        </div>

        <div className="flex flex-wrap gap-2.5">

          {/* CHANNELS */}
          {channels.filter(chan => chan.category !== 'person').map((chan) => {
            const isSelected = selectedChannelId === chan.id;
            const sums = channelBalances[chan.id] || { current: 0 };
            
            // Calculate total based on dates (using activeTenantFilterLedger)
            let periodMoney In = 0;
            let periodMoney Out = 0;
            activeTenantFilterLedger.forEach(entry => {
              if (entry.channelId === chan.id) {
                if (entry.amount > 0) {
                  periodMoney In += entry.amount;
                } else {
                  periodMoney Out += Math.abs(entry.amount);
                }
              }
            });
            const periodNet = periodMoney In - periodMoney Out;

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
                className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer border flex items-center space-x-2 ${
                  isSelected ? activePillStyle : basePillStyle
                }`}
              >
                <div className={`p-1 rounded-lg shrink-0 ${isSelected ? 'bg-white/60' : 'bg-slate-200/50'}`}>
                  {iconOfChan}
                </div>
                <div className="text-left">
                  <span className="block font-black tracking-tight leading-none text-slate-800">{chan.name}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedChannelId === 'all' ? (
        <>
          {/* CONSOLIDATED LIQUIDITY & PERFORMANCE DASHBOARD */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-sm space-y-4 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 font-mono uppercase tracking-widest block">Combined System Dashboard</span>
                <h2 className="text-sm font-extrabold text-white tracking-tight mt-1">Available Cash & Total Cash Movement</h2>
                <p className="text-xs text-slate-400 mt-0.5">All account balances.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
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
                <span className="text-lg font-black text-emerald-300 block mt-0.5 font-sans">+{formatCurrency(combinedStats.totalMoney In)}</span>
                <span className="text-[9.5px] font-medium text-slate-400 block mt-0.5">{combinedStats.countMoney In} credit movements</span>
              </div>

              <div className="bg-rose-950/20 p-4 rounded-2xl border border-rose-900/40 text-white animate-fadeIn">
                <span className="text-[10px] font-bold text-rose-400 block uppercase font-mono tracking-wide">Total Payment Out (Money Outs)</span>
                <span className="text-lg font-black text-rose-300 block mt-0.5 font-sans">-{formatCurrency(combinedStats.totalMoney Out)}</span>
                <span className="text-[9.5px] font-medium text-slate-400 block mt-0.5">{combinedStats.countMoney Out} debit movements</span>
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(() => {
                return channels.filter(chan => chan.category !== 'person').map(chan => {
                  const currentBalance = channelBalances[chan.id]?.current || 0;
                  
                  // Compute period range inflow and range outflow for this account specifically from the same activeTenantFilterLedger
                  let periodMoney In = 0;
                  let periodMoney Out = 0;
                  activeTenantFilterLedger.forEach(entry => {
                    if (entry.channelId === chan.id) {
                      if (entry.amount >= 0) {
                        periodMoney In += entry.amount;
                      } else {
                        periodMoney Out += Math.abs(entry.amount);
                      }
                    }
                  });

                  return (
                    <div key={chan.id} className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 space-y-4 shadow-xs transition-all hover:bg-slate-50/10">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2.5 w-full min-w-0">
                          <div className={`p-2 rounded-xl shrink-0 ${
                            chan.category === 'bank' ? 'bg-blue-50 text-blue-600' :
                            chan.category === 'telco' ? 'bg-indigo-50 text-indigo-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {chan.category === 'bank' ? <Landmark className="w-4.5 h-4.5" /> : 
                             chan.category === 'telco' ? <Wallet className="w-4.5 h-4.5" /> :
                             <Coins className="w-4.5 h-4.5" />}
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
                          <span className="text-emerald-600 font-bold font-sans">+{formatCurrency(periodMoney In)}</span>
                        </div>
                        <div className="space-y-0.5 text-right border-l border-slate-100 pl-2">
                          <span className="block text-[9px] font-bold text-slate-400 font-mono uppercase tracking-wider">Money Outs</span>
                          <span className="text-slate-600 font-medium font-sans">-{formatCurrency(periodMoney Out)}</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="instant-settlements-box">
            
            {/* SIMPLE TRANSFER / DEPOSIT PANEL */}
            <div className="lg:col-span-5 bg-white border border-slate-150 rounded-3xl p-6 self-start space-y-4">
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
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-slate-800"
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
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                  />
                  <input
                    type="text"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    placeholder={newAccType === 'person' ? 'Person name' : 'Account name'}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                  <input
                    type="text"
                    value={newAccNumber}
                    onChange={(e) => setNewAccNumber(e.target.value)}
                    placeholder={newAccType === 'person' ? 'Account number or mobile number' : newAccType === 'bank' ? 'Account number' : 'Till/paybill/mobile number'}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleCreateAccount}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase border-none cursor-pointer"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:border-slate-800 outline-none cursor-pointer"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:border-slate-800 outline-none cursor-pointer"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:border-slate-800 outline-none"
                    required
                  />
                </div>

                {/* Secure Receipts & Proof Upload Panel */}
                <div className="space-y-3 pt-2 pb-1 border-t border-b border-dashed border-slate-150">
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
                    <div className="relative flex items-center justify-center border border-dashed border-slate-200 hover:border-slate-300 rounded-xl p-2.5 bg-slate-50 focus-within:ring-1 focus-within:ring-indigo-505 transition-all cursor-pointer">
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
                    <div className="relative flex items-center justify-center border border-dashed border-slate-200 hover:border-slate-300 rounded-xl p-2.5 bg-slate-50 focus-within:ring-1 focus-within:ring-emerald-505 transition-all cursor-pointer">
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-slate-800 outline-none placeholder-slate-400 text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-2 px-3 rounded-xl text-xs transition-all cursor-pointer shadow-sm flex items-center justify-center space-x-1 border-none"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Perform Money Transfer</span>
                </button>
              </form>
            </div>



            {/* QUICK AUDIT TRACKER INFOGRAPHIC */}
            <div className="lg:col-span-7 bg-white border border-slate-150 rounded-3xl p-6 flex flex-col justify-between space-y-5 shadow-xs animate-fadeIn">
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
                      <strong className="text-rose-750 font-bold block">Upload receipt or proof</strong>
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
          
          let periodMoney In = 0;
          let periodMoney Out = 0;
          let countMoney In = 0;
          let countMoney Out = 0;
          
          activeTenantFilterLedger.forEach(entry => {
            if (entry.channelId === chan.id) {
              if (entry.amount >= 0) {
                periodMoney In += entry.amount;
                countMoney In++;
              } else {
                periodMoney Out += Math.abs(entry.amount);
                countMoney Out++;
              }
            }
          });

          const periodNet = periodMoney In - periodMoney Out;

          return (
            <div className="space-y-6 animate-fadeIn">
              {/* Spotlight Banner Card */}
              <div className={`border p-6 rounded-3xl relative overflow-hidden shadow-xs ${
                chan.category === 'telco' ? 'bg-gradient-to-br from-indigo-50/40 via-white to-white border-indigo-150' :
                chan.category === 'bank' ? 'bg-gradient-to-br from-blue-50/40 via-white to-white border-blue-150' :
                'bg-gradient-to-br from-amber-50/40 via-white to-white border-amber-150'
              }`}>
                {/* Back button */}
                <button
                  onClick={() => setSelectedChannelId('all')}
                  className="absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold font-sans transition-all border-none cursor-pointer flex items-center space-x-1"
                >
                  <span>← Back to Combined View</span>
                </button>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-2">
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
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">{chan.name}</h2>
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
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-150">
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono tracking-wide">Selected Date preset</span>
                    <span className="text-xs font-bold text-slate-750 block mt-1 select-none">
                      {datePreset === 'today' ? 'Today Only' : 
                       datePreset === '1week' ? 'Past 7 Days' : 
                       datePreset === '1month' ? 'Past 30 Days' : 
                       datePreset === '3months' ? 'Past 3 Months' : 'Custom Interval'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 block mt-0.5">{startDateStr} to {endDateStr}</span>
                  </div>

                  <div className="bg-emerald-50/20 p-4 rounded-2xl border border-emerald-100">
                    <span className="text-[10px] font-bold text-emerald-600 block uppercase font-mono tracking-wide">Total Money In</span>
                    <span className="text-lg font-black text-emerald-700 block mt-0.5 font-sans">+{formatCurrency(periodMoney In)}</span>
                    <span className="text-[9.5px] font-medium text-slate-400 block mt-0.5">{countMoney In} credit movements</span>
                  </div>

                  <div className="bg-rose-50/10 p-4 rounded-2xl border border-rose-100">
                    <span className="text-[10px] font-bold text-rose-600 block uppercase font-mono tracking-wide">Total Money Out</span>
                    <span className="text-lg font-black text-rose-600 block mt-0.5 font-sans">-{formatCurrency(periodMoney Out)}</span>
                    <span className="text-[9.5px] font-medium text-slate-400 block mt-0.5">{countMoney Out} debit movements</span>
                  </div>

                  <div className={`p-4 rounded-2xl border ${periodNet >= 0 ? 'bg-emerald-50/15 border-emerald-150 text-emerald-800' : 'bg-rose-50/15 border-rose-150 text-rose-800'}`}>
                    <span className="text-[10px] font-bold block uppercase font-mono tracking-wide">Net Income</span>
                    <span className="text-lg font-black block mt-0.5 font-sans">{periodNet >= 0 ? '+' : ''}{formatCurrency(periodNet)}</span>
                    <span className="text-[9.5px] font-mono block mt-0.5 text-slate-450">Sum outcome inside date range</span>
                  </div>
                </div>
              </div>

              {/* Quick Money Transfers */}
              <div className="bg-white border border-slate-150 rounded-3xl p-6">
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
                      className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-2.5 px-5 rounded-2xl text-xs transition-style cursor-pointer flex items-center space-x-2 max-w-full"
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
      <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-xs space-y-4">
        
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
                className="pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-slate-800 w-full sm:w-52"
              />
            </div>

            {/* Simple Wording Source Type Filter */}
            <select
              value={auditTypeFilter}
              onChange={(e) => setAuditTypeFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-bold outline-none focus:border-slate-800 cursor-pointer"
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
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs py-1.5 px-3.5 rounded-xl cursor-pointer transition-all flex items-center justify-center space-x-1 shadow-sm shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Report</span>
            </button>

          </div>
        </div>

        {/* Audit Table List rendering */}
        <div className="overflow-x-auto rounded-2xl border border-slate-150">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-150 font-bold font-mono text-slate-500 text-[10px] uppercase select-none">
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
        
        {searchedAuditTrail.length > 0 && (
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono select-none pt-2">
            <span>Showing {searchedAuditTrail.length} transaction entries</span>
            <span>All systems running normally</span>
          </div>
        )}

      </div>

    </div>
  );
}
