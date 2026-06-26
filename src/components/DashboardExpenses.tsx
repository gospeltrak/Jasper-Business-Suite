import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  Calendar, 
  ArrowUpRight, 
  Upload, 
  FileText, 
  Check, 
  FolderKanban, 
  Info, 
  Coins, 
  MessageSquare, 
  PlusCircle, 
  Download, 
  AlertCircle,
  TrendingDown,
  X,
  Sparkles,
  TrendingUp,
  MoreVertical,
  Eye,
  Edit,
  ChevronRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  ComposedChart,
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  LineChart, 
  Line, 
  CartesianGrid 
} from 'recharts';
import { Tenant, Expense, Product, Sale } from '../types';
import { isDemoTenant } from '../utils/tenantIsolation';

interface DashboardExpensesProps {
  activeTenant: Tenant;
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
  onDeleteExpense?: (id: string) => void;
  onUpdateExpense?: (expense: Expense) => void;
  userName?: string;
  sales?: Sale[];
}

export default function DashboardExpenses({ 
  activeTenant, 
  expenses = [], 
  onAddExpense,
  onDeleteExpense,
  onUpdateExpense,
  userName = 'Admin',
  sales = []
}: DashboardExpensesProps) {
  const currency = activeTenant.currencyCode || 'TSh';

  // State for submenu nav tabs: 'list' | 'categories' | 'add'
  const [subTab, setSubTab] = useState<'list' | 'categories' | 'add'>('list');
  const [expenseActionItem, setExpenseActionItem] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState<{description: string; amount: string; category: string; note: string}>({description: '', amount: '', category: '', note: ''});

  // Date/day selected states. Defaulting to empty starts with 'All Records'
  // and user can filter by a single specific date or quick day options.
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>(''); // YYYY-MM-DD format
  const [quickDateOption, setQuickDateOption] = useState<'all' | 'today' | 'yesterday' | 'week'>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Load custom categories from localStorage or set defaults
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem(`jasper_expense_cats_${activeTenant.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.warn("Failed loading custom expense categories:", err);
      }
    }
    return isDemoTenant(activeTenant.id)
      ? ['Utilities & Power', 'Wages & Salary', 'Logistics & Transport', 'Packaging Materials', 'Rent & Logistics', 'Marketing & Ads', 'Miscellaneous']
      : [];
  });

  // State for adding a new category
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [categorySuccess, setCategorySuccess] = useState('');

  // Settle categories to local storage
  const saveCategories = (newCats: string[]) => {
    setCategories(newCats);
    localStorage.setItem(`jasper_expense_cats_${activeTenant.id}`, JSON.stringify(newCats));
  };

  // Form states for creating a new expense
  const [formDate, setFormDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formTransactionMessage, setFormTransactionMessage] = useState('');
  const [formNote, setFormNote] = useState('');
  
  // File upload states
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileType, setUploadedFileType] = useState(''); // 'application/pdf' or 'image/*'
  const [uploadedFileBase64, setUploadedFileBase64] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');

  // Handle setting default category when categories load/change
  useEffect(() => {
    if (categories.length > 0 && !formCategory) {
      setFormCategory(categories[0]);
    }
  }, [categories, formCategory]);

  // Handle date filters changes
  useEffect(() => {
    if (quickDateOption === 'all') {
      setSelectedDateFilter('');
    } else if (quickDateOption === 'today') {
      const today = new Date();
      const yr = today.getFullYear();
      const mt = String(today.getMonth() + 1).padStart(2, '0');
      const dy = String(today.getDate()).padStart(2, '0');
      setSelectedDateFilter(`${yr}-${mt}-${dy}`);
    } else if (quickDateOption === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yr = yesterday.getFullYear();
      const mt = String(yesterday.getMonth() + 1).padStart(2, '0');
      const dy = String(yesterday.getDate()).padStart(2, '0');
      setSelectedDateFilter(`${yr}-${mt}-${dy}`);
    } else if (quickDateOption === 'week') {
      setSelectedDateFilter(''); // We will handle 'week' matching in our filtering logic
    }
  }, [quickDateOption]);

  // Synchronize manual date picker to clear quick pick if they don't match
  const handleManualDateChange = (val: string) => {
    setSelectedDateFilter(val);
    if (!val) {
      setQuickDateOption('all');
    } else {
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (val === todayStr) {
        setQuickDateOption('today');
      } else if (val === yesterdayStr) {
        setQuickDateOption('yesterday');
      } else {
        setQuickDateOption('all'); // custom
      }
    }
  };

  // Filter expenses list by active dates/days
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const expDateStr = e.timestamp.split('T')[0];

      // Date range filter (From → To) takes priority
      if (dateFrom || dateTo) {
        if (dateFrom && expDateStr < dateFrom) return false;
        if (dateTo && expDateStr > dateTo) return false;
        return true;
      }

      if (quickDateOption === 'all' && !selectedDateFilter) return true;

      if (quickDateOption === 'week') {
        const expTime = new Date(e.timestamp).getTime();
        const diffDays = (Date.now() - expTime) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 7;
      }

      if (selectedDateFilter) return expDateStr === selectedDateFilter;

      return true;
    });
  }, [expenses, selectedDateFilter, quickDateOption, dateFrom, dateTo]);

  // Reactive calculation: "instead add total expenses where it will ba changed according to the date/day selected"
  const totalExpensesAmt = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  }, [filteredExpenses]);

  // File drag & upload handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file) return;
    setUploadedFileName(file.name);
    setUploadedFileType(file.type);
    setUploadProgress(10);

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 25;
      });
    }, 100);

    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Add custom category implementation
  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCat = newCategoryName.trim();
    if (!cleanCat) {
      setCategoryError('Category title cannot be blank.');
      return;
    }
    if (categories.some(c => c.toLowerCase() === cleanCat.toLowerCase())) {
      setCategoryError('This expense category code already exists.');
      return;
    }

    const updated = [...categories, cleanCat];
    saveCategories(updated);
    setNewCategoryName('');
    setCategoryError('');
    setCategorySuccess(`"${cleanCat}" successfully registered in operations budget!`);
    setTimeout(() => setCategorySuccess(''), 3000);
  };

  // Delete category implementation (if no expenses use it)
  const handleDeleteCategory = (catToDelete: string) => {
    const isUsed = expenses.some(e => e.category === catToDelete);
    if (isUsed) {
      alert(`Cannot delete category "${catToDelete}" because historic records exist linked to it.`);
      return;
    }
    if (confirm(`Are you sure you want to remove the Category: "${catToDelete}"?`)) {
      const updated = categories.filter(c => c !== catToDelete);
      saveCategories(updated);
    }
  };

  // Handle Book Expense Submit
  const handleBookExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formDescription.trim()) {
      setFormError('Please write a name or identifier for the expense.');
      return;
    }
    if (!formCategory) {
      setFormError('Please select a valid expense category classification.');
      return;
    }
    if (formAmount === '' || formAmount <= 0) {
      setFormError('Please supply a valid operational debit amount above 0.');
      return;
    }

    const cleanDate = formDate || new Date().toISOString().split('T')[0];

    let uniqueId = '';
    let isUnique = false;
    while (!isUnique) {
      // generates a random integer between 100 and 9999 (3 or 4 digits)
      const randomNum = Math.floor(100 + Math.random() * 9900);
      uniqueId = `exp-${randomNum}`;
      isUnique = !expenses.some(e => e.id === uniqueId);
    }

    const newExpense: Expense = {
      id: uniqueId,
      category: formCategory,
      amount: Number(formAmount),
      timestamp: new Date(cleanDate + 'T12:00:00Z').toISOString(),
      description: formDescription.trim(),
      staffName: userName,
      tenantId: activeTenant.id,
      receiptRef: uploadedFileName || undefined,
      receiptImage: uploadedFileBase64 || undefined,
      transactionMessage: formTransactionMessage.trim() || undefined,
      note: formNote.trim() || undefined
    };

    onAddExpense(newExpense);

    setFormSuccess(`Expense logged successfully! Added TSh ${Number(formAmount).toLocaleString()}`);
    
    // Reset Form fields
    setFormDescription('');
    setFormAmount('');
    setFormTransactionMessage('');
    setFormNote('');
    setUploadedFileName('');
    setUploadedFileType('');
    setUploadedFileBase64(null);
    setUploadProgress(0);

    // Swap to list automatically after short success wait to let user verify
    setTimeout(() => {
      setFormSuccess('');
      setSubTab('list');
    }, 1500);
  };

  // Category breakdown values for reports
  const categoryBreakdown = useMemo(() => {
    return categories.map(cat => {
      const catExpenses = filteredExpenses.filter(e => e.category === cat);
      const amt = catExpenses.reduce((sum, item) => sum + item.amount, 0);
      const proportion = totalExpensesAmt > 0 ? (amt / totalExpensesAmt) * 100 : 0;
      return {
        name: cat,
        count: catExpenses.length,
        total: amt,
        percentage: proportion
      };
    }).sort((a, b) => b.total - a.total);
  }, [categories, filteredExpenses, totalExpensesAmt]);

  // Memoized 30-day daily expenses trends calculation
  const expensesTrendData = useMemo(() => {
    const dataMap: { [dateStr: string]: number } = {};
    
    // Initialize standard UTC-offset matching keys for last 30 days
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dataMap[dateStr] = 0;
    }
    
    // Aggregate absolute daily aggregate values
    if (expenses && expenses.length > 0) {
      expenses.forEach(e => {
        if (!e.timestamp) return;
        const dateStr = e.timestamp.split('T')[0];
        if (dataMap[dateStr] !== undefined) {
          dataMap[dateStr] += e.amount || 0;
        }
      });
    }
    
    // Format into standard Recharts list
    return Object.keys(dataMap).sort().map(dateStr => {
      const dateObj = new Date(dateStr);
      const formattedDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return {
        date: formattedDate,
        rawDate: dateStr,
        expense: dataMap[dateStr]
      };
    });
  }, [expenses]);

  return (
    <div id="expenses-scaffold-layout" className="space-y-4 font-sans text-left pb-[calc(80px+env(safe-area-inset-bottom))]">
      
      {/* 1. SECTION HEADER */}
      <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            Operating Expenses Ledger
          </h2>
        </div>

        {/* Date Selector Filter */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800">
            <button
              onClick={() => setQuickDateOption('all')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                quickDateOption === 'all' && !selectedDateFilter
                  ? 'bg-emerald-500 text-slate-950 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-amber-400'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setQuickDateOption('today')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                quickDateOption === 'today' 
                  ? 'bg-emerald-500 text-slate-950 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-amber-400'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setQuickDateOption('yesterday')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                quickDateOption === 'yesterday' 
                  ? 'bg-emerald-500 text-slate-950 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-amber-400'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => setQuickDateOption('week')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                quickDateOption === 'week' 
                  ? 'bg-emerald-500 text-slate-950 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-amber-400'
              }`}
            >
              Last 7 Days
            </button>
          </div>

          {/* Date range: From → To */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setQuickDateOption('all'); setSelectedDateFilter(''); }}
              className="bg-transparent border-none text-xs font-semibold outline-none text-slate-700 dark:text-slate-300 w-[110px] cursor-pointer"
            />
            <span className="text-slate-300 dark:text-slate-600 font-bold shrink-0">→</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setQuickDateOption('all'); setSelectedDateFilter(''); }}
              className="bg-transparent border-none text-xs font-semibold outline-none text-slate-700 dark:text-slate-300 w-[110px] cursor-pointer"
            />
            {(dateFrom || dateTo) && (
              <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="ml-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer bg-transparent border-none text-[10px] font-bold"
              >✕</button>
            )}
          </div>
        </div>
      </div>

      {/* 2. ACTIVE LEDGER SUM — premium card, amount left + trend chart right in one row */}
      <div className="w-full rounded-2xl overflow-hidden relative" style={{background: 'linear-gradient(135deg, #059669 0%, #047857 60%, #065f46 100%)', boxShadow: '0 4px 24px rgba(5,150,105,0.22)'}}>
        {/* Decorative background circle */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none" style={{background: 'rgba(255,255,255,0.05)'}} />
        <div className="absolute -bottom-8 right-16 w-24 h-24 rounded-full pointer-events-none" style={{background: 'rgba(255,255,255,0.04)'}} />

        <div className="flex items-stretch gap-0 px-5 pt-4 pb-4 relative">
          {/* LEFT: total amount details */}
          <div className="flex flex-col justify-between min-w-0 flex-1 pr-4">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-200" />
                <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest">Total Expenses</span>
              </div>
              <p className="text-[28px] font-black text-white leading-none tracking-tight">
                {currency} {Math.round(totalExpensesAmt).toLocaleString()}
              </p>
              <p className="text-[10px] text-emerald-200 mt-2 font-medium leading-snug">
                {filteredExpenses.length} {filteredExpenses.length === 1 ? 'entry' : 'entries'} ·{' '}
                {dateFrom || dateTo
                  ? `${dateFrom || '...'} → ${dateTo || '...'}`
                  : quickDateOption === 'today' ? 'Today'
                  : quickDateOption === 'yesterday' ? 'Yesterday'
                  : quickDateOption === 'week' ? 'Last 7 days'
                  : 'All time'}
              </p>
            </div>

            {/* Mini stat pills — desktop only */}
            {totalExpensesAmt > 0 && (
              <div className="hidden md:flex items-center gap-2 mt-3">
                <div className="px-2.5 py-1 rounded-xl" style={{background: 'rgba(255,255,255,0.12)'}}>
                  <p className="text-[9px] font-bold text-emerald-200 uppercase tracking-wide">Avg/Entry</p>
                  <p className="text-[12px] font-black text-white">{currency} {filteredExpenses.length > 0 ? Math.round(totalExpensesAmt / filteredExpenses.length).toLocaleString() : 0}</p>
                </div>
                <div className="px-2.5 py-1 rounded-xl" style={{background: 'rgba(255,255,255,0.12)'}}>
                  <p className="text-[9px] font-bold text-emerald-200 uppercase tracking-wide">Categories</p>
                  <p className="text-[12px] font-black text-white">{categoryBreakdown.filter(c => c.total > 0).length}</p>
                </div>
              </div>
            )}
          </div>

          {/* Divider line */}
          <div className="w-px self-stretch shrink-0" style={{background: 'rgba(255,255,255,0.12)', margin: '2px 0'}} />

          {/* RIGHT: trend chart — clear, prominent, beautiful */}
          <div className="shrink-0 pl-4" style={{width: '55%', height: '110px'}}>
            {expenses && expenses.length > 0 ? (
              <div className="w-full h-full flex flex-col">
                <p className="text-[9px] font-bold text-emerald-300 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60 inline-block" />
                  Spending Trend
                </p>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={expensesTrendData} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="expTrendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fff" stopOpacity={0.35}/>
                          <stop offset="100%" stopColor="#fff" stopOpacity={0.02}/>
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        stroke="transparent"
                        tick={{fill: 'rgba(255,255,255,0.4)', fontSize: 7, fontWeight: 600}}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                        dy={3}
                      />
                      <YAxis
                        stroke="transparent"
                        tick={{fill: 'rgba(255,255,255,0.4)', fontSize: 7}}
                        tickLine={false}
                        axisLine={false}
                        width={22}
                        tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#064e3b',
                          borderColor: 'rgba(255,255,255,0.2)',
                          fontSize: '10px',
                          borderRadius: '10px',
                          color: '#fff',
                          padding: '5px 10px',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                        }}
                        formatter={(value: any) => [`${currency} ${Number(value).toLocaleString()}`, 'Expenses']}
                        labelStyle={{color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '9px'}}
                        cursor={{stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1, strokeDasharray: '3 3'}}
                      />
                      <Area
                        type="monotone"
                        dataKey="expense"
                        stroke="rgba(255,255,255,0.25)"
                        strokeWidth={1}
                        fillOpacity={1}
                        fill="url(#expTrendFill)"
                        dot={false}
                        activeDot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="expense"
                        stroke="#fff"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{r: 4, fill: '#fff', stroke: 'rgba(255,255,255,0.4)', strokeWidth: 2}}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{background: 'rgba(255,255,255,0.1)'}}>
                  <TrendingDown className="w-4 h-4 text-emerald-200" />
                </div>
                <p className="text-[9px] text-emerald-300 font-medium text-center">Add expenses<br/>to see trend</p>
              </div>
            )}
          </div>
        </div>
      </div>

            {/* 3. TAB NAVIGATION — clean pill design */}
      <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl">
        {([
          { id: 'list', label: 'Expenses', icon: Receipt, color: 'text-emerald-600' },
          { id: 'categories', label: 'Categories', icon: FolderKanban, color: 'text-violet-600' },
          { id: 'add', label: '+ Add Expense', icon: PlusCircle, color: 'text-white' },
        ] as const).map(tab => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          const isAdd = tab.id === 'add';
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer border-none ${
                isAdd
                  ? isActive
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
                    : 'bg-emerald-600/90 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-500/10'
                  : isActive
                    ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-800 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isAdd ? 'text-white' : isActive ? tab.color : ''}`} />
              <span className="leading-none whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. MAIN INTERACTIVE VIEWER AREAS */}
      
      {/* TAB A: EXPENSES LIST */}
      {subTab === 'list' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-950 dark:text-white">Expenditure Transaction Index</h3>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">
              Showing {filteredExpenses.length} record(s) matching dates
            </span>
          </div>

          {/* ── MOBILE EXPENSE CARDS ── */}
          <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800">
            {filteredExpenses.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm">
                <Receipt className="w-8 h-8 mx-auto mb-3 text-slate-200" />
                <p className="font-bold">No expenses found</p>
              </div>
            ) : filteredExpenses.map(e => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4 text-rose-500" />
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{e.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 rounded-md">{e.category}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{new Date(e.timestamp).toLocaleDateString([], {day:'2-digit', month:'short'})}</span>
                  </div>
                </div>
                {/* Amount + menu */}
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-sm font-black text-rose-600">{currency} {Math.round(e.amount).toLocaleString()}</p>
                  <button type="button"
                    onClick={() => setExpenseActionItem(e)}
                    className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 active:scale-90 transition-all cursor-pointer border-none"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── DESKTOP TABLE ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 font-bold border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                  <th className="p-3">Expense Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Staff</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-105 dark:divide-slate-800 text-slate-650 dark:text-slate-400">
                {filteredExpenses.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors group">
                    <td className="p-3">
                      <p className="font-semibold text-slate-900 dark:text-white text-xs leading-tight">{e.description}</p>
                      {e.note && <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[180px]">{e.note}</p>}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 rounded-lg border border-rose-100 dark:border-rose-500/20">
                        {e.category}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                      {currency} {Math.round(e.amount).toLocaleString()}
                    </td>
                    <td className="p-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                      {new Date(e.timestamp).toLocaleDateString([], {day:'2-digit', month:'short', year:'numeric'})}
                    </td>
                    <td className="p-3 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                      {e.staffName || 'Admin'}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" title="View"
                          onClick={() => setExpenseActionItem(e)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-none"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" title="Edit"
                          onClick={() => { setEditingExpense(e); setEditForm({description: e.description, amount: String(e.amount), category: e.category, note: e.note || ''}); }}
                          className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer bg-transparent border-none"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" title="Delete"
                          onClick={() => { if (window.confirm('Delete this expense?')) onDeleteExpense?.(e.id); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-600 transition-colors cursor-pointer bg-transparent border-none"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400 dark:text-slate-500 select-none">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                        <p className="font-extrabold text-sm text-slate-700 dark:text-slate-400">No expenses found</p>
                        <p className="text-xs text-slate-400 max-w-sm">No expenses found.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB B: EXPENSES CATEGORIES */}
      {subTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* List existing categories */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-sm text-slate-900 dark:text-white">Active Operational Classifications</h3>
              <span className="text-[10px] font-mono text-slate-405 font-bold uppercase tracking-wider">{categories.length} Registered categories</span>
            </div>

            <div className="space-y-3.5 pt-2">
              {categoryBreakdown.map((cat, i) => (
                <div key={cat.name} className="flex flex-col space-y-1.5 p-3.5 bg-slate-55/40 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-810/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-slate-350">{String(i + 1).padStart(2, '0')}</span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{cat.name}</h4>
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-sm font-mono">
                        {cat.count} files
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-450">
                        {currency} {Math.round(cat.total).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.name)}
                        className="text-slate-350 hover:text-red-500 transition-colors p-1 rounded-md"
                        title={`Delete classifying code ${cat.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Proportional visual gauge */}
                  <div className="space-y-1">
                    <div className="w-full bg-slate-100 dark:bg-slate-805 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, cat.percentage)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-mono text-slate-405">
                      <span>Proportionate Budget Share</span>
                      <span>{cat.percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form to Register Custom classification */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xs shrink-0 self-start">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white pb-3 border-b border-slate-150 dark:border-slate-800 flex items-center gap-1.5">
              <FolderKanban className="w-4 h-4 text-emerald-500" />
              <span>Register New Category</span>
            </h3>

            <form onSubmit={handleAddCategorySubmit} className="space-y-4 pt-4 text-xs font-sans">
              <div className="space-y-1.5 text-left">
                <label className="block text-slate-600 dark:text-slate-400 font-extrabold">Classification Name</label>
                <input
                  type="text"
                  placeholder="Expense category..."
                  value={newCategoryName}
                  onChange={(e) => {
                    setNewCategoryName(e.target.value);
                    setCategoryError('');
                  }}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-slate-450 leading-relaxed">
                  Adding a custom classification class populates the categories selector immediately when booking expenses.
                </p>
              </div>

              {categoryError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-250/30 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[10px] font-medium leading-tight">{categoryError}</span>
                </div>
              )}

              {categorySuccess && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-550/25 text-emerald-700 dark:text-emerald-400 rounded-xl flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[10px] font-bold leading-tight">{categorySuccess}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-700 dark:border-slate-800 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-xl cursor-pointer transition-all shadow-xs flex items-center justify-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Category</span>
              </button>
            </form>
          </div>

        </div>
      )}

      {/* TAB C: ADD NEW EXPENSE */}
      {subTab === 'add' && (
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-md overflow-hidden relative">
          
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-2.5">
            <div className="p-2.5 bg-emerald-50 text-emerald-650 rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="font-extrabold text-sm text-slate-950 dark:text-white">Add Expense</h3>
              <p className="text-[10.5px] text-slate-400">Add expense details.</p>
            </div>
          </div>

          <form onSubmit={handleBookExpense} className="p-6 space-y-5 text-xs text-left">
            
            {/* Choose Date: "first choose date it should be the present day by default" */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-slate-600 dark:text-slate-400 font-extrabold">Choose Date</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <Calendar className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white font-medium"
                    required
                  />
                </div>
              </div>

              {/* Expense Category */}
              <div className="space-y-1">
                <label className="block text-slate-600 dark:text-slate-400 font-extrabold">Expense Categories</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white font-medium cursor-pointer"
                  required
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* write name of expenses & Supply Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-slate-600 dark:text-slate-400 font-extrabold">Name of Expense</label>
                <input
                  type="text"
                  placeholder="Expense description..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white font-semibold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-600 dark:text-slate-400 font-extrabold">Expense Money Out Amount ({currency})</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-semibold select-none">
                    {currency}
                  </span>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 15000"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="w-full pl-12 p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500  outline-none text-slate-905 dark:text-white font-black"
                    required
                  />
                </div>
              </div>
            </div>

            {/* File Upload Box: "place to upload pdf receipt" */}
            <div className="space-y-1">
              <label className="block text-slate-600 dark:text-slate-400 font-extrabold">Upload PDF Receipt / Receipt Attachment</label>
              
              <div 
                className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                  dragActive 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950' 
                    : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-950/20'
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center space-y-1.5">
                  <Upload className="w-8 h-8 text-slate-400 animate-pulse" />
                  <p className="font-extrabold text-xs text-slate-700 dark:text-slate-300">Drag & Drop PDF / Image receipts, or Click to Browse</p>
                  <p className="text-[10px] text-slate-400">PNG, JPG, or PDF.</p>
                </div>

                {uploadedFileName && (
                  <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/50 dark:border-slate-800 flex items-center justify-between animate-fade-in text-left">
                    <div className="flex items-center space-x-2">
                      <FileText className={`w-5 h-5 ${uploadedFileType.includes('pdf') ? 'text-rose-500' : 'text-emerald-500'}`} />
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[250px]">{uploadedFileName}</p>
                        <p className="text-[9px] text-slate-405">
                          {uploadedFileType.includes('pdf') ? 'A4 Legal PDF document' : 'Voucher Receipt Digital Image'} - uploaded
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedFileName('');
                        setUploadedFileType('');
                        setUploadedFileBase64(null);
                        setUploadProgress(0);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* "and another to add transaction message" */}
            <div className="space-y-1">
              <label className="block text-slate-600 dark:text-slate-400 font-extrabold">Note / Reference Code</label>
              <input
                type="text"
                placeholder="Payment reference..."
                value={formTransactionMessage}
                onChange={(e) => setFormTransactionMessage(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white font-medium"
              />
            </div>

            {/* "below it placement for note: about the expense" */}
            <div className="space-y-1">
              <label className="block text-slate-600 dark:text-slate-400 font-extrabold">Note about the Expense</label>
              <textarea
                placeholder="Expense notes..."
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                rows={3}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white"
              />
            </div>

            {/* Success and Error Indicators */}
            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/25 text-red-650 dark:text-red-400 border border-red-200/50 rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-semibold text-[11px] leading-tight">{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center space-x-2">
                <Check className="w-4 h-4 shrink-0 animate-bounce" />
                <span className="font-extrabold text-[11px] leading-tight">{formSuccess}</span>
              </div>
            )}

            {/* Submit Ledger Button */}
            <button
              type="submit"
              className="w-full py-3 bg-emerald-500 text-slate-950 hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/10 active:scale-95 text-xs font-black uppercase tracking-widest rounded-2xl transition-all font-mono flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Add Expense</span>
            </button>
          </form>
        </div>
      )}

      {/* ── MOBILE EXPENSE ACTION SHEET — motion spring, matches Sales exactly ── */}
      <AnimatePresence>
        {expenseActionItem && (
          <>
            <motion.div
              key="expense-sheet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExpenseActionItem(null)}
              className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              key="expense-sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="fixed left-0 right-0 max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-3xl z-[80] overflow-hidden font-sans flex flex-col border border-slate-100 dark:border-slate-800"
              style={{
                bottom: 'calc(56px + env(safe-area-inset-bottom))',
                maxHeight: 'calc(85vh - 56px - env(safe-area-inset-bottom))',
                boxShadow: 'none',
              }}
            >
              {/* Drag handle */}
              <div className="w-full flex justify-center py-2 shrink-0">
                <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-5 pb-3 pt-1 shrink-0">
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white leading-tight truncate">
                  {expenseActionItem.description}
                </h3>
                <p className="text-xs text-slate-400 mt-1 flex items-center justify-between flex-wrap gap-1">
                  <span className="font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-md text-[10px]">{expenseActionItem.category}</span>
                  <span>{new Date(expenseActionItem.timestamp).toLocaleDateString()}</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{currency} {Math.round(expenseActionItem.amount).toLocaleString()}</span>
                </p>
                {(expenseActionItem.staffName || expenseActionItem.note || expenseActionItem.receiptRef) && (
                  <div className="mt-2 space-y-1">
                    {expenseActionItem.staffName && <p className="text-[11px] text-slate-500"><span className="text-slate-400">Staff:</span> {expenseActionItem.staffName}</p>}
                    {expenseActionItem.note && <p className="text-[11px] text-slate-500"><span className="text-slate-400">Note:</span> {expenseActionItem.note}</p>}
                    {expenseActionItem.receiptRef && <p className="text-[11px] text-emerald-600 font-bold"><span className="text-slate-400 font-normal">Receipt:</span> {expenseActionItem.receiptRef}</p>}
                  </div>
                )}
              </div>

              <div className="bg-slate-100 dark:bg-slate-800 h-[1px] w-full shrink-0" />

              {/* Action rows */}
              <div className="overflow-y-auto p-4 space-y-2.5">
                <button
                  type="button"
                  onClick={() => { setEditingExpense(expenseActionItem); setEditForm({description: expenseActionItem.description, amount: String(expenseActionItem.amount), category: expenseActionItem.category, note: expenseActionItem.note || ''}); setExpenseActionItem(null); }}
                  className="w-full h-14 min-h-[52px] bg-white dark:bg-slate-800 hover:bg-slate-50 flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-xs cursor-pointer text-left transition-colors"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Edit className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-800 dark:text-white block">Edit Expense</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Update amount, category or name</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => { if (window.confirm('Delete this expense?')) { onDeleteExpense?.(expenseActionItem.id); setExpenseActionItem(null); } }}
                  className="w-full h-14 min-h-[52px] bg-white dark:bg-slate-800 hover:bg-red-50 flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-red-100 dark:border-red-500/20 shadow-xs cursor-pointer text-left transition-colors"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-red-600 block">Delete Expense</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Remove this record permanently</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── EDIT EXPENSE MODAL ── */}
      {editingExpense && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{background: 'rgba(0,0,0,0.4)', paddingBottom: 'calc(56px + env(safe-area-inset-bottom))'}}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Edit Expense</h3>
              <button type="button" onClick={() => setEditingExpense(null)} className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-pointer border-none">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Description</label>
                <input type="text" value={editForm.description} onChange={e => setEditForm(p => ({...p, description: e.target.value}))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Amount ({currency})</label>
                <input type="number" value={editForm.amount} onChange={e => setEditForm(p => ({...p, amount: e.target.value}))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-emerald-500 font-mono font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Category</label>
                <select value={editForm.category} onChange={e => setEditForm(p => ({...p, category: e.target.value}))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-emerald-500 cursor-pointer">
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Note (optional)</label>
                <input type="text" value={editForm.note} onChange={e => setEditForm(p => ({...p, note: e.target.value}))}
                  placeholder="Add a note..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-emerald-500" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditingExpense(null)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold cursor-pointer border-none">
                  Cancel
                </button>
                <button type="button"
                  onClick={() => {
                    if (!editForm.description || !editForm.amount) return;
                    onUpdateExpense?.({...editingExpense, description: editForm.description, amount: parseFloat(editForm.amount) || 0, category: editForm.category, note: editForm.note});
                    setEditingExpense(null);
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold cursor-pointer border-none transition-colors">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
