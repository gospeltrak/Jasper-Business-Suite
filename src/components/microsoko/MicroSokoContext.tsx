import React, { createContext, useContext, useState, useEffect } from 'react';
import { MsUnit, MsConversion, MsPaymentMethod, MsBatch, MsItem, MsExpense, MsDelivery, MsSale, MsExpenseCategory, MsBusinessSettings, MsBrandingSettings } from './MicroSokoTypes';

interface MicroSokoState {
  units: MsUnit[];
  conversions: MsConversion[];
  paymentMethods: MsPaymentMethod[];
  items: MsItem[];
  expenseCategories: MsExpenseCategory[];
  expenses: MsExpense[];
  deliveries: MsDelivery[];
  sales: MsSale[];
  businessSettings: MsBusinessSettings;
  brandingSettings: MsBrandingSettings;
  setBusinessSettings: (opts: MsBusinessSettings) => void;
  setBrandingSettings: (opts: MsBrandingSettings) => void;
  updateItem: (item: MsItem) => void;
  addItem: (item: MsItem) => void;
  addSale: (sale: MsSale) => void;
  addExpense: (exp: MsExpense) => void;
  addDelivery: (del: MsDelivery) => void;
  setUnits: (units: MsUnit[]) => void;
  setPaymentMethods: (methods: MsPaymentMethod[]) => void;
  setExpenseCategories: (cats: MsExpenseCategory[]) => void;
  setConversions: (convs: MsConversion[]) => void;
  setItems: (items: MsItem[]) => void;
  setExpenses: (exps: MsExpense[]) => void;
  setDeliveries: (dels: MsDelivery[]) => void;
  setSales: (sales: MsSale[]) => void;
}

const defaultUnits: MsUnit[] = [
  { id: '1', name: 'Kg', isActive: true },
  { id: '2', name: 'Litre', isActive: true },
  { id: '3', name: 'Piece', isActive: true },
  { id: '4', name: 'Gunia', isActive: true },
  { id: '5', name: 'Ndoo', isActive: true }
];

const defaultPaymentMethods: MsPaymentMethod[] = [
  { id: '1', name: 'Cash', isActive: true, isDefault: true },
  { id: '2', name: 'M-Pesa', isActive: true, isDefault: false }
];

const defaultExpenseCategories: MsExpenseCategory[] = [
  { id: '1', name: 'Rent', isActive: true },
  { id: '2', name: 'Salary', isActive: true },
  { id: '3', name: 'Electricity', isActive: true },
  { id: '4', name: 'Water', isActive: true },
  { id: '5', name: 'Internet', isActive: true },
  { id: '6', name: 'Cleaning', isActive: true },
  { id: '7', name: 'Maintenance', isActive: true },
  { id: '8', name: 'Tax', isActive: true },
  { id: '9', name: 'Other', isActive: true }
];

const defaultBusiness: MsBusinessSettings = {
  name: 'My Awesome MicroSoko',
  ownerName: 'Admin',
  phone: '0700000000',
  address: 'Central CBD',
  region: 'Dar es Salaam',
  currency: 'TZS',
  defaultSellingMethod: 'fifo'
};

const defaultBranding: MsBrandingSettings = {
  themeColor: '#10b981',
  receiptHeader: 'My Awesome MicroSoko',
  receiptFooter: 'Thank you for your business!',
  address: 'Central CBD',
  phone: '0700000000'
};

const MicroSokoContext = createContext<MicroSokoState | null>(null);

export const useMicroSoko = () => {
  const ctx = useContext(MicroSokoContext);
  if (!ctx) throw new Error('useMicroSoko must be used within provider');
  return ctx;
};

export const MicroSokoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [units, setUnits] = useState<MsUnit[]>(defaultUnits);
  const [conversions, setConversions] = useState<MsConversion[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<MsPaymentMethod[]>(defaultPaymentMethods);
  const [expenseCategories, setExpenseCategories] = useState<MsExpenseCategory[]>(defaultExpenseCategories);
  const [items, setItems] = useState<MsItem[]>([]);
  const [expenses, setExpenses] = useState<MsExpense[]>([]);
  const [deliveries, setDeliveries] = useState<MsDelivery[]>([]);
  const [sales, setSales] = useState<MsSale[]>([]);
  const [businessSettings, setBusinessSettings] = useState<MsBusinessSettings>(defaultBusiness);
  const [brandingSettings, setBrandingSettings] = useState<MsBrandingSettings>(defaultBranding);

  // We can add local storage logic here later if needed, right now memory is fine for the requested demonstration
  
  const updateItem = (updated: MsItem) => setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  const addItem = (item: MsItem) => setItems(prev => [...prev, item]);
  const addSale = (sale: MsSale) => setSales(prev => [...prev, sale]);
  const addExpense = (exp: MsExpense) => setExpenses(prev => [...prev, exp]);
  const addDelivery = (del: MsDelivery) => setDeliveries(prev => [...prev, del]);

  return (
    <MicroSokoContext.Provider value={{
      units, conversions, paymentMethods, items, expenses, deliveries, sales,
      expenseCategories, businessSettings, brandingSettings,
      setBusinessSettings, setBrandingSettings,
      updateItem, addItem, addSale, addExpense, addDelivery,
      setUnits, setPaymentMethods, setExpenseCategories, setConversions,
      setItems, setExpenses, setDeliveries, setSales
    }}>
      {children}
    </MicroSokoContext.Provider>
  );
};
