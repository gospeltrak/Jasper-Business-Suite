import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  TrendingUp
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  LineChart, 
  Line, 
  CartesianGrid 
} from 'recharts';
import { Tenant, Expense, Product, Sale } from '../types';

interface DashboardExpensesProps {
  activeTenant: Tenant;
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
  userName?: string;
  sales?: Sale[];
}

export default function DashboardExpenses({ 
  activeTenant, 
  expenses = [], 
  onAddExpense,
  userName = 'Admin',
  sales = []
}: DashboardExpensesProps) {
  const currency = activeTenant.currencyCode || 'TSh';

  // State for submenu nav tabs: 'list' | 'categories' | 'add'
  const [subTab, setSubTab] = useState<'list' | 'categories' | 'add'>('list');

  // Date/day selected states. Defaulting to empty starts with 'All Records'
  // and user can filter by a single specific date or quick day options.
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>(''); // YYYY-MM-DD format
  const [quickDateOption, setQuickDateOption] = useState<'all' | 'today' | 'yesterday' | 'week'>('all');

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
    return [
      'Utilities & Power',
      'Wages & Salary',
      'Logistics & Transport',
      'Packaging Materials',
      'Rent & Logistics',
      'Marketing & Ads',
      'Miscellaneous'
    ];
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
      if (quickDateOption === 'all' && !selectedDateFilter) {
        return true;
      }
      
      const expDateStr = e.timestamp.split('T')[0];

      if (quickDateOption === 'week') {
        // checks if within last 7 days
        const expTime = new Date(e.timestamp).getTime();
        const diffTime = Date.now() - expTime;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 7;
      }

      if (selectedDateFilter) {
        return expDateStr === selectedDateFilter;
      }

      return true;
    });
  }, [expenses, selectedDateFilter, quickDateOption]);

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
    <div id="expenses-scaffold-layout" className="space-y-6 font-sans text-left">
      
      {/* 1. SECTION HEADER */}
      <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase">
            Account debits & vouchers
          </span>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
            Operating Expenses Ledger
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Log, categorize, track, and audit branch outgoing operational cashflow with dynamic receipt scanning.
          </p>
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

          <div className="relative">
            <input
              type="date"
              value={selectedDateFilter}
              onChange={(e) => handleManualDateChange(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-700 dark:text-slate-300"
            />
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC 'TOTAL EXPENSES' CARDS SECTION */}
      {/* This strictly meets "instead add total expenses where it will be changed according to the date/day selected" */}
      <div className="w-full">
        <div className="w-full bg-gradient-to-br from-slate-900 to-slate-950 text-white p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[175px]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20" />
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center w-full">
            
            {/* Left Column - Financial Ledger Values */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-black text-amber-405 uppercase tracking-widest bg-amber-400/10 px-2 py-0.5 rounded-md">
                    Active Ledger Sum
                  </span>
                  <p className="text-xs text-slate-400 font-medium pt-1">
                    {selectedDateFilter 
                      ? `Operating expenditure for: ${new Date(selectedDateFilter).toLocaleDateString()}`
                      : quickDateOption === 'week'
                      ? 'Summary for the past 7 days operating expenditure ledger'
                      : 'Cumulative branch operational expenditure ledger (all time)'}
                  </p>
                </div>
                <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20 lg:hidden shrink-0">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>

              <div>
                <h3 className="text-3xl font-black text-white leading-none tracking-tight">
                  {currency} {Math.round(totalExpensesAmt).toLocaleString()}
                </h3>
                <p className="text-[11px] text-slate-400 mt-2 font-mono flex items-center">
                  <Info className="w-3 h-3 text-emerald-400 mr-1 shrink-0" />
                  Calculated dynamically from {filteredExpenses.length} matching operational ledger receipt(s)
                </p>
              </div>
            </div>

            {/* Middle Column - Category Distribution Live Graph */}
            <div className="lg:col-span-3">
              <div className="bg-slate-950/55 border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between min-h-[130px] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                    <Coins className="w-3 h-3 text-emerald-500" />
                    Category Distribution
                  </span>
                  <span className="text-[9px] font-mono font-bold bg-slate-900 text-slate-400 px-2 py-0.5 rounded-md">
                    {categoryBreakdown.filter(c => c.total > 0).length} active
                  </span>
                </div>

                {totalExpensesAmt > 0 ? (
                  <div className="space-y-2">
                    {categoryBreakdown.filter(c => c.total > 0).slice(0, 2).map((cat) => (
                      <div key={cat.name} className="space-y-0.5">
                        <div className="flex justify-between text-[10px] font-bold text-slate-300">
                          <span className="truncate max-w-[100px]">{cat.name}</span>
                          <span className="font-mono text-slate-400 text-[9px]">
                            {cat.percentage.toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800/60 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-450 h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(100, Math.max(3, cat.percentage))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {categoryBreakdown.filter(c => c.total > 0).length > 2 && (
                      <div className="text-[9px] text-right font-bold text-emerald-450">
                        + {categoryBreakdown.filter(c => c.total > 0).length - 2} other categories
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-center space-y-1 h-full">
                    <p className="text-[9px] text-slate-500 font-bold">No active range data</p>
                    <p className="text-[8px] text-slate-600 max-w-[180px] leading-tight">Book a cash-out voucher to see metrics</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - 30-Day Daily Expenses Trends Line Chart */}
            <div className="lg:col-span-5">
              <div className="bg-slate-950/55 border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between min-h-[130px] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-black text-rose-400 uppercase tracking-widest flex items-center gap-1">
                    <TrendingDown className="w-3 h-3 text-rose-500" />
                    30-Day Expenses Trend
                  </span>
                  <span className="text-[9px] font-mono font-bold bg-slate-900 text-slate-400 px-2 py-0.5 rounded-md">
                    Daily Expenses
                  </span>
                </div>

                <div className="w-full h-[90px] mt-1 relative">
                  {expenses && expenses.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={expensesTrendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="date" 
                          stroke="#475569" 
                          fontSize={8} 
                          tickLine={false} 
                          axisLine={false}
                          dy={3}
                          interval={4}
                        />
                        <YAxis 
                          stroke="#475569" 
                          fontSize={8} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                          width={28}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#020617', 
                            borderColor: '#1e293b', 
                            fontSize: '9px',
                            borderRadius: '8px',
                            color: '#fff',
                            padding: '4px 8px'
                          }} 
                          formatter={(value: any) => [`${currency} ${Number(value).toLocaleString()}`, 'Expenses']}
                          labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="expense" 
                          stroke="#f43f5e" 
                          strokeWidth={1.5}
                          fillOpacity={1} 
                          fill="url(#colorExpense)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <p className="text-[9px] text-slate-500">No expenses data available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 3. DYNAMIC SUB-NAV MENU TABS */}
      {/* "expenses list", "expenses categories", "add new expense" */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 pt-2">
        <button
          onClick={() => setSubTab('list')}
          className={`pb-3 px-4 text-xs font-bold leading-none cursor-pointer transition-all border-b-2 flex items-center space-x-2 ${
            subTab === 'list' 
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black border-b-[3px]' 
              : 'border-transparent text-slate-450 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Receipt className="w-4 h-4 shrink-0" />
          <span>Expenses List</span>
        </button>

        <button
          onClick={() => setSubTab('categories')}
          className={`pb-3 px-4 text-xs font-bold leading-none cursor-pointer transition-all border-b-2 flex items-center space-x-2 ${
            subTab === 'categories' 
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black border-b-[3px]' 
              : 'border-transparent text-slate-450 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <FolderKanban className="w-4 h-4 shrink-0" />
          <span>Expenses Categories</span>
        </button>

        <button
          onClick={() => setSubTab('add')}
          className={`pb-3 px-4 text-xs font-bold leading-none cursor-pointer transition-all border-b-2 flex items-center space-x-2 ${
            subTab === 'add' 
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black border-b-[3px]' 
              : 'border-transparent text-slate-450 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>Add New Expense</span>
        </button>
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

          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 font-bold border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                  <th className="p-3">Reference / ID</th>
                  <th className="p-3">Expense Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Amount Price</th>
                  <th className="p-3 text-center">Receipt File</th>
                  <th className="p-3">Staff Member</th>
                  <th className="p-3">Created Date</th>
                  <th className="p-3">Tx Message / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-105 dark:divide-slate-800 text-slate-650 dark:text-slate-400">
                {filteredExpenses.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="p-3">
                      <span className="font-mono text-xs text-rose-500 font-bold bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10 inline-block">
                        {e.id}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">
                      {e.description}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                        {e.category}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                      {currency} {e.amount.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                    </td>
                    <td className="p-3 text-center">
                      {e.receiptImage ? (
                        <div className="flex items-center justify-center space-x-1">
                          <a 
                            href={e.receiptImage} 
                            download={e.receiptRef || 'receipt-attachment'} 
                            className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center space-x-1"
                            title="Download loaded attachment representation"
                          >
                            <FileText className="w-3.5 h-3.5 mr-0.5 text-rose-500" />
                            <span className="max-w-[80px] truncate">{e.receiptRef || 'Attachment.png'}</span>
                            <Download className="w-3 h-3 text-slate-400 hover:text-emerald-500" />
                          </a>
                        </div>
                      ) : e.receiptRef ? (
                        <span className="text-[10px] font-semibold text-amber-600 inline-flex items-center bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                          <FileText className="w-3 h-3 mr-1 text-amber-500" /> {e.receiptRef}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No document</span>
                      )}
                    </td>
                    <td className="p-3 font-medium">
                      {e.staffName || 'Admin'}
                    </td>
                    <td className="p-3 font-mono text-[10px]">
                      {new Date(e.timestamp).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-[11px] max-w-xs space-y-1">
                      {e.transactionMessage && (
                        <div className="flex items-center text-slate-700 dark:text-slate-300 font-medium">
                          <MessageSquare className="w-3 h-3 mr-1 text-slate-400 shrink-0" />
                          <span className="truncate">{e.transactionMessage}</span>
                        </div>
                      )}
                      {e.note ? (
                        <p className="text-[10px] text-slate-500 italic bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 line-clamp-2">
                          <span className="font-bold uppercase text-[8px] font-mono block text-slate-400">Note:</span>
                          {e.note}
                        </p>
                      ) : !e.transactionMessage ? (
                        <span className="text-slate-400 italic text-[10px]">-</span>
                      ) : null}
                    </td>
                  </tr>
                ))}

                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400 dark:text-slate-500 select-none">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                        <p className="font-extrabold text-sm text-slate-700 dark:text-slate-400">No Operational Expense Records Located</p>
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
              <Receipt className="w-4.5 h-4.5" />
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

    </div>
  );
}
