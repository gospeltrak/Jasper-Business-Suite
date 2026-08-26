import React, { useState, useMemo } from 'react';
import { Tenant, User, Sale, SaleItem } from '../types';
import { formatLocalDate } from '../utils/localDate';
import { 
  Pill, 
  Sparkles, 
  Layers, 
  DollarSign, 
  ShieldAlert, 
  Clock, 
  ClipboardList, 
  CheckCircle, 
  CheckCircle2,
  Cpu,
  Search,
  Plus,
  Trash2,
  Minimize2,
  Activity,
  UserCheck,
  AlertTriangle,
  HeartPulse,
  Coins,
  Printer,
  MessageSquare,
  BadgeAlert,
  ThermometerSnowflake,
  FileText
} from 'lucide-react';

interface SandboxProps {
  activeTenant: Tenant;
  currentUser: User;
  onAddSale?: (sale: Sale) => void;
}

export default function DashboardSandboxVerticals({ activeTenant, currentUser, onAddSale }: SandboxProps) {
  // Use Tanzanian Shilling or default currency
  const currency = activeTenant.currency || 'TSh ';

  // Sub tab view inside the Pharmacy component
  const [activePharmaTab, setActivePharmaTab] = useState<'bestpos' | 'bestrx' | 'apothecary' | 'regulatory'>('bestpos');

  // --- APOTHECARY DRUG DATABASE WITH EXPERIMENTAL BATCHES ---
  const [drugs, setDrugs] = useState([
    { 
      id: 'DR1', 
      name: 'Amoxicillin 500mg', 
      generic: 'Amoxicillin Trihydrate', 
      stock: 120, 
      status: 'In Stock', 
      price: 18500, 
      category: 'Antibiotic', 
      batchNo: 'AMX-0492B', 
      expiryDate: '2027-04-12',
      requiresPrescription: true,
      coldChain: false 
    },
    { 
      id: 'DR2', 
      name: 'Paracetamol 500mg (Panadol)', 
      generic: 'Acetaminophen / APAP', 
      stock: 1850, 
      status: 'In Stock', 
      price: 2000, 
      category: 'Analgesic', 
      batchNo: 'PCM-9112A', 
      expiryDate: '2028-09-30',
      requiresPrescription: false,
      coldChain: false 
    },
    { 
      id: 'DR3', 
      name: 'Metformin 850mg', 
      generic: 'Metformin Hydrochloride', 
      stock: 45, 
      status: 'Low Stock', 
      price: 12000, 
      category: 'Anti-Diabetic', 
      batchNo: 'MET-8472X', 
      expiryDate: '2026-11-20',
      requiresPrescription: true,
      coldChain: false 
    },
    { 
      id: 'DR4', 
      name: 'Cravit 500mg Tablet', 
      generic: 'Levofloxacin', 
      stock: 35, 
      status: 'Low Stock', 
      price: 42000, 
      category: 'Fluoroquinolones', 
      batchNo: 'CRV-0294C', 
      expiryDate: '2026-06-15',
      requiresPrescription: true,
      coldChain: false 
    },
    { 
      id: 'DR5', 
      name: 'Atorvastatin 20mg', 
      generic: 'Lipitor / Atorvastatin Calcium', 
      stock: 340, 
      status: 'In Stock', 
      price: 15500, 
      category: 'Cardiovascular', 
      batchNo: 'ATV-3392E', 
      expiryDate: '2027-10-05',
      requiresPrescription: true,
      coldChain: false 
    },
    { 
      id: 'DR6', 
      name: 'Insulin Glargine 100 U/mL (Lantus)', 
      generic: 'Insulin Glargine (rDNA origin)', 
      stock: 18, 
      status: 'Low Stock', 
      price: 68000, 
      category: 'Insulin Hormone', 
      batchNo: 'LTS-8821Z', 
      expiryDate: '2026-08-01',
      requiresPrescription: true,
      coldChain: true 
    }
  ]);

  // --- BESTRX PATIENT PROFILES DATABASE ---
  const [patients, setPatients] = useState([
    { id: 'PT-8021', name: 'Amina Bello', phone: '255712345678', insurer: 'NHIS Public Health', allergies: 'Penicillin class molecules', registeredDate: '2025-01-10' },
    { id: 'PT-8022', name: 'Chidi Nwesu', phone: '255711223344', insurer: 'Self Pay', allergies: 'None recorded', registeredDate: '2024-11-05' },
    { id: 'PT-8023', name: 'Grace Kiptoo', phone: '254722334455', insurer: 'Aetna International Group', allergies: 'Sulfa Drugs / Sulfonamides', registeredDate: '2025-02-18' },
    { id: 'PT-8024', name: 'John Doe', phone: '255655443322', insurer: 'Doe Insurance', allergies: 'Aspirin & NSAIDs', registeredDate: '2025-03-01' }
  ]);

  // --- ACTIVE ELECTRONIC E-PRESCRIPTIONS CLAIMS PORTAL ---
  const [prescriptions, setPrescriptions] = useState([
    { id: 'RX-9921', patientId: 'PT-8021', patientName: 'Amina Bello', drug: 'Amoxicillin 500mg', insurer: 'NHIS Public Health', status: 'Approved Claim', qty: 21, copayPercent: 20 },
    { id: 'RX-9922', patientId: 'PT-8022', patientName: 'Chidi Nwesu', drug: 'Paracetamol 500mg (Panadol)', insurer: 'Self Pay', status: 'Approved Claim', qty: 30, copayPercent: 100 },
    { id: 'RX-9923', patientId: 'PT-8023', patientName: 'Grace Kiptoo', drug: 'Insulin Glargine 100 U/mL (Lantus)', insurer: 'Aetna International Group', status: 'Pending Review', qty: 1, copayPercent: 10 }
  ]);

  // --- APOTHECARY RESTOCK & MedMed EXPIRED MANAGER ---
  const [drugSearchQuery, setDrugSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'All' | 'Antibiotic' | 'Analgesic' | 'Anti-Diabetic' | 'Fluoroquinolones' | 'Cardiovascular' | 'Insulin Hormone'>('All');

  // --- BESTPOS DISPENSING CART STATE ENGINE ---
  const [selectedPatientId, setSelectedPatientId] = useState<string>('PT-8021');
  const [dispenseCart, setDispenseCart] = useState<Array<{
    drug: typeof drugs[0];
    qty: number;
    dosage: string;
  }>>([]);

  const [allergyAlert, setAllergyAlert] = useState<string | null>(null);
  const [activeInstruction, setActiveInstruction] = useState('Take 1 capsule three times daily for 5 days after food.');
  const [insurerOverride, setInsurerOverride] = useState<string>('NHIS Public Health');
  const [successReceiptSale, setSuccessReceiptSale] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [whatsappSharePhone, setWhatsappSharePhone] = useState('');

  // --- CUSTOM ADDS FOR CREATIVE FORMS ---
  const [newMedName, setNewMedName] = useState('');
  const [newMedGeneric, setNewMedGeneric] = useState('');
  const [newMedPrice, setNewMedPrice] = useState('');
  const [newMedStock, setNewMedStock] = useState('100');
  const [newMedCategory, setNewMedCategory] = useState('Antibiotic');
  const [newMedExpiry, setNewMedExpiry] = useState('2027-12-31');
  const [newMedRxReq, setNewMedRxReq] = useState(true);
  const [newMedColdChain, setNewMedColdChain] = useState(false);

  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientAllergies, setNewPatientAllergies] = useState('None');
  const [newPatientInsurer, setNewPatientInsurer] = useState('Self Pay');

  // --- COMPLIANCE LOGS ENGINE ---
  const [regulatoryLogs, setRegulatoryLogs] = useState<string[]>([
    'System: PharmaPOS security compliance check: Passed.',
    'System: TFDA Gateway link verified online (SSL SHA256 key secure).',
    'System: National e-Prescription Network client node connected.',
    'System: All prescription transactions encrypted (AES-256 standard).'
  ]);

  const addRegLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setRegulatoryLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 30));
  };

  // --- INTERACTIVE PHARMACY DEMO SCENARIOS SETUP ---
  const handleLoadDemoProfile = (scenario: 'allergy' | 'coldchain' | 'cardio') => {
    if (scenario === 'allergy') {
      // Setup Amina Bello (NHIS, Penicillin Allergy)
      setSelectedPatientId('PT-8021');
      setInsurerOverride('NHIS Public Health');
      
      const amox = drugs.find(d => d.id === 'DR1') || drugs[0];
      setDispenseCart([
        {
          drug: amox,
          qty: 21,
          dosage: 'Take 1 capsule three times daily for 7 days after meals.'
        }
      ]);
      
      setAllergyAlert(`⚠️ PATIENT SAFETY CRITICAL WARN: Amina Bello has severe registered allergy to: [Penicillin class molecules]. Please confirm molecular therapeutic equivalence before dispensing Amoxicillin 500mg!`);
      setActivePharmaTab('bestpos');
      addRegLog(`Simulator: Loaded Amina Bello's Penicillin safety bypass clinical intercept scenario.`);
    } else if (scenario === 'coldchain') {
      // Setup Grace Kiptoo (Aetna, Sulfa Drugs Allergy)
      setSelectedPatientId('PT-8023');
      setInsurerOverride('Aetna International Group');
      
      const insulin = drugs.find(d => d.id === 'DR6') || drugs[5] || drugs[2];
      setDispenseCart([
        {
          drug: insulin,
          qty: 1,
          dosage: 'Inject 10 units subcutaneously daily at bedtime. Keep refrigerated between 2°C to 8°C.'
        }
      ]);
      setAllergyAlert(null);
      setActivePharmaTab('bestpos');
      addRegLog(`Simulator: Loaded Grace Kiptoo's Insulin Glargine Cold-Chain tracking and 90% reimbursement coverage scenario.`);
    } else if (scenario === 'cardio') {
      // Setup John Doe (Doe Insurance, Aspirin & NSAIDs allergy)
      setSelectedPatientId('PT-8024');
      setInsurerOverride('Jubilee Health Insurance');
      
      const lipitor = drugs.find(d => d.id === 'DR5') || drugs[4] || drugs[1];
      const metformin = drugs.find(d => d.id === 'DR3') || drugs[2];
      setDispenseCart([
        {
          drug: lipitor,
          qty: 30,
          dosage: 'Take 1 tablet Daily at Night.'
        },
        {
          drug: metformin,
          qty: 60,
          dosage: 'Take 1 tablet BD with breakfast and dinner.'
        }
      ]);
      setAllergyAlert(null);
      setActivePharmaTab('bestpos');
      addRegLog(`Simulator: Loaded John Doe's dual cardiovascular/metabolic therapy prefilled claim portfolio.`);
    }
  };

  // Switch Selected Patient Profile triggers Allergy warning if conflict
  const selectedPatientData = useMemo(() => {
    return patients.find(p => p.id === selectedPatientId);
  }, [patients, selectedPatientId]);

  // Adjust override insurer when changing patient
  const handlePatientSelectChange = (id: string) => {
    setSelectedPatientId(id);
    const matched = patients.find(p => p.id === id);
    if (matched) {
      setInsurerOverride(matched.insurer);
      addRegLog(`Profile: Switched active client desk to ${matched.name}. Pre-filed claim provider is ${matched.insurer}`);
    }
  };

  // Add Medication to cart inside BestPOS with safety allergy protocol audits
  const addToDispenseCart = (drug: typeof drugs[0]) => {
    if (drug.stock <= 0) {
      alert('This pharmaceutical compound is currently out of stock!');
      return;
    }

    // Trigger Allergy Warnings automatically based on patient profile allergies
    if (selectedPatientData) {
      const allergy = selectedPatientData.allergies.toLowerCase();
      let hasAllergyRisk = false;

      if (allergy.includes('penicillin') && (drug.category === 'Antibiotic' || drug.name.toLowerCase().includes('amox'))) {
        hasAllergyRisk = true;
      }
      if (allergy.includes('sulfa') && drug.category === 'Fluoroquinolones') {
        hasAllergyRisk = true;
      }
      if (allergy.includes('aspirin') && drug.category === 'Analgesic') {
        hasAllergyRisk = true;
      }

      if (hasAllergyRisk) {
        setAllergyAlert(`⚠️ PATIENT SAFETY CRITICAL WARN: ${selectedPatientData.name} has severe registered allergy to: [${selectedPatientData.allergies}]. Please confirm molecular therapeutic equivalence before dispensing ${drug.name}!`);
        addRegLog(`ALERT: Allergy safety breach intercepted for ${selectedPatientData.name} attempting to acquire ${drug.name}.`);
      } else {
        setAllergyAlert(null);
      }
    }

    // Check if medication is already in cart
    const existingIndex = dispenseCart.findIndex(item => item.drug.id === drug.id);
    if (existingIndex >= 0) {
      setDispenseCart(prev => prev.map((item, idx) => {
        if (idx === existingIndex) {
          return { ...item, qty: Math.min(drug.stock, item.qty + 1) };
        }
        return item;
      }));
    } else {
      setDispenseCart(prev => [
        ...prev, 
        { 
          drug, 
          qty: 1, 
          dosage: activeInstruction 
        }
      ]);
    }

    addRegLog(`Cart: Allocated 1 Unit of ${drug.name} (Batch: ${drug.batchNo}) to current dispensation ticket.`);
  };

  // Remove from cart
  const removeFromCart = (id: string) => {
    setDispenseCart(prev => prev.filter(item => item.drug.id !== id));
    addRegLog(`Cart: De-allocated medication ID ${id} from ticket.`);
  };

  // Update Cart Unit quantity
  const updateCartQty = (id: string, qty: number) => {
    const matched = drugs.find(d => d.id === id);
    if (!matched) return;
    const safeQty = Math.max(1, Math.min(matched.stock, qty));
    setDispenseCart(prev => prev.map(item => {
      if (item.drug.id === id) {
        return { ...item, qty: safeQty };
      }
      return item;
    }));
  };

  // Update custom apothecary instruction per drug
  const updateInstructions = (id: string, text: string) => {
    setDispenseCart(prev => prev.map(item => {
      if (item.drug.id === id) {
        return { ...item, dosage: text };
      }
      return item;
    }));
  };

  // --- AUTO CALCULATE COPAY & CLAIMS NETWORKS ---
  const cartTotals = useMemo(() => {
    const subtotal = dispenseCart.reduce((sum, item) => sum + (item.drug.price * item.qty), 0);
    const taxRate = activeTenant.taxRate || 0.18; // Default 18% VAT if not set
    const isVatCompliant = true; // BestRx enforces VAT rules correctly for medical retail
    const vat = isVatCompliant ? Math.round(subtotal * taxRate) : 0;
    const total = subtotal + vat;

    // Claims networks: NHIS splits 80-20, others vary
    let coveragePercent = 0;
    if (insurerOverride === 'NHIS Public Health') coveragePercent = 0.80;
    else if (insurerOverride === 'Aetna International Group') coveragePercent = 0.90;
    else if (insurerOverride === 'Jubilee Health Insurance') coveragePercent = 0.75;
    else if (insurerOverride === 'Starlife HMO Private') coveragePercent = 0.85;

    const insuranceContribution = Math.round(total * coveragePercent);
    const patientCoPayDue = total - insuranceContribution;

    return {
      subtotal,
      vat,
      total,
      insuranceContribution,
      patientCoPayDue,
      coveragePercent: coveragePercent * 100
    };
  }, [dispenseCart, insurerOverride, activeTenant.taxRate]);

  // Submit Prescription Sale
  const handleFinalizeDispensation = () => {
    if (dispenseCart.length === 0) return;

    // Deduct stock levels in drugs list
    setDrugs(prev => prev.map(d => {
      const matchCart = dispenseCart.find(it => it.drug.id === d.id);
      if (matchCart) {
        const remainingStock = Math.max(0, d.stock - matchCart.qty);
        return { 
          ...d, 
          stock: remainingStock,
          status: remainingStock <= 0 ? 'Out of Stock' : remainingStock < 50 ? 'Low Stock' : 'In Stock'
        };
      }
      return d;
    }));

    // Compile Sale items for Central ledger connection
    const saleItems: SaleItem[] = dispenseCart.map(item => ({
      productId: item.drug.id,
      productName: item.drug.name + ' [' + item.drug.generic + ']',
      qty: item.qty,
      price: item.drug.price,
      discount: 0,
      discountType: 'percent'
    }));

    // Build sale payload
    const newPharmaSale: Sale = {
      id: 'rx-disp-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      items: saleItems,
      total: cartTotals.total,
      tax: cartTotals.vat,
      deliveryCost: 0,
      discount: 0,
      discountType: 'percent',
      paymentMethod: insurerOverride === 'Self Pay' ? 'Cash' : 'Mobile Money',
      reference: Math.random().toString(36).substring(2, 8).toUpperCase(),
      tenantId: activeTenant.id,
      timestamp: new Date().toISOString(),
      syncStatus: 'synced',
      cashierName: currentUser.name || 'Apothecary Pharmacist',
      customerName: selectedPatientData ? `${selectedPatientData.name} (${insurerOverride})` : 'Walk-In Patient',
      customerPhone: selectedPatientData?.phone || undefined,
      staffName: currentUser.name || 'Chief Druggist',
      vatStatus: 'vat',
      amountPaid: cartTotals.patientCoPayDue // Patient only pays the co-pay amount!
    };

    // Callback to push sale records globally so active sales tally goes up
    if (onAddSale) {
      onAddSale(newPharmaSale);
    }

    // Set interactive receipt modals
    setSuccessReceiptSale(newPharmaSale);
    setWhatsappSharePhone(selectedPatientData?.phone || '');
    setIsReceiptOpen(true);

    addRegLog(`✓ Transact checkout approved: Dispensed ${dispenseCart.length} therapeutic agents to ${selectedPatientData?.name || 'anonymous customer'}. Patient co-pay successfully settled (${currency}${cartTotals.patientCoPayDue.toLocaleString()}). Claim filed to insurer.`);
    
    // Reset dispensary state variables
    setDispenseCart([]);
    setAllergyAlert(null);
  };

  // Add customized drugs to database manually
  const handleCreateNewMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName || !newMedGeneric || !newMedPrice) return;

    const priceNum = parseFloat(newMedPrice);
    const stockNum = parseInt(newMedStock) || 0;

    const newMedObject = {
      id: 'DR' + (drugs.length + 1),
      name: newMedName,
      generic: newMedGeneric,
      stock: stockNum,
      status: stockNum <= 0 ? 'Out of Stock' : stockNum < 50 ? 'Low Stock' : 'In Stock',
      price: priceNum,
      category: newMedCategory,
      batchNo: 'BCH-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
      expiryDate: newMedExpiry,
      requiresPrescription: newMedRxReq,
      coldChain: newMedColdChain
    };

    setDrugs(prev => [newMedObject, ...prev]);
    addRegLog(`Inventory: Added customized therapeutic molecule "${newMedName}" to apothecary database. Batch: ${newMedObject.batchNo}`);
    
    // reset form fields
    setNewMedName('');
    setNewMedGeneric('');
    setNewMedPrice('');
    setNewMedStock('100');
  };

  // Add customized patient profile and allergy checklist
  const handleAddNewPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName || !newPatientPhone) return;

    const pObj = {
      id: 'PT-' + Math.floor(Math.random() * 9000 + 1000),
      name: newPatientName,
      phone: newPatientPhone.replace(/[^0-9]/g, ''),
      insurer: newPatientInsurer,
      allergies: newPatientAllergies,
      registeredDate: formatLocalDate()
    };

    setPatients(prev => [...prev, pObj]);
    setSelectedPatientId(pObj.id);
    setInsurerOverride(pObj.insurer);

    // Auto generate an electronic prescription for this new patient
    const claimObj = {
      id: 'RX-' + Math.floor(Math.random() * 90000 + 10000),
      patientId: pObj.id,
      patientName: pObj.name,
      drug: 'Amoxicillin 500mg',
      insurer: pObj.insurer,
      status: 'Approved Claim',
      qty: 15,
      copayPercent: pObj.insurer === 'Self Pay' ? 100 : 20
    };
    setPrescriptions(prev => [claimObj, ...prev]);

    addRegLog(`BestRx Profiles: Enrolled new patient profile: ${newPatientName}. Allergy record mapped: [${newPatientAllergies}].`);
    
    setNewPatientName('');
    setNewPatientPhone('');
    setNewPatientAllergies('None');
  };

  // Restock drug by 50 units
  const handleRestockMedicine = (id: string) => {
    setDrugs(prev => prev.map(d => {
      if (d.id === id) {
        const updatedStock = d.stock + 50;
        return { 
          ...d, 
          stock: updatedStock,
          status: 'In Stock'
        };
      }
      return d;
    }));
    addRegLog(`Inventory: Stock levels for Drug ID ${id} boosted (+50 units).`);
  };

  // Filter medicine catalog based on search queries
  const filteredDrugsCatalog = useMemo(() => {
    return drugs.filter(d => {
      const matchSearch = d.name.toLowerCase().includes(drugSearchQuery.toLowerCase()) || 
                          d.generic.toLowerCase().includes(drugSearchQuery.toLowerCase()) ||
                          d.batchNo.toLowerCase().includes(drugSearchQuery.toLowerCase());
      const matchCat = selectedCategoryFilter === 'All' || d.category === selectedCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [drugs, drugSearchQuery, selectedCategoryFilter]);

  // Calculations for drug expiration matrix alerts
  const checkDrugExpiryBadge = (expiryStr: string) => {
    const expDate = new Date(expiryStr);
    const today = new Date();
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return { label: 'EXPIRED BATCH', color: 'bg-red-100 text-red-800 border-red-250 animate-pulse' };
    if (diffDays < 180) return { label: `${diffDays} days to expiry`, color: 'bg-rose-100 text-rose-800 border-rose-200' };
    return { label: `Healthy Expiry (${diffDays} days)`, color: 'bg-emerald-50 text-emerald-800 border-emerald-100' };
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-emerald-650 to-teal-800 text-white rounded-[32px] p-6 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-white/5 rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-1.5 bg-white/10 rounded-xl">
                <Pill className="w-5 h-5 text-emerald-100 animate-pulse" />
              </span>
              <span className="text-xs uppercase tracking-widest font-mono bg-white/20 px-2.5 py-0.5 rounded-full font-extrabold flex items-center space-x-1">
                <Activity className="w-3 h-3 text-emerald-300 inline-block shrink-0" />
                <span>PHARMAPOS MVP BY MEDSOFTWARES</span>
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight mt-2">BestRx / BestPOS Clinical Dispensation Node</h2>
            <p className="text-emerald-50 text-xs mt-1 max-w-xl font-normal leading-relaxed">
              Fully compliant electronic apothecary station. Tracks FDA clinical drug allergies, calculates direct National Copayments, logs molecular batches, and synchronizes real-time ledger records.
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 text-left lg:text-right font-mono text-xs shrink-0">
            <span className="text-emerald-100 block text-[9px] uppercase tracking-wider font-extrabold">Medical Sync Provider</span>
            <span className="text-sm font-black block mt-1 text-white">NHIS GATEWAY ACTIVE</span>
            <span className="text-[10px] text-emerald-300 uppercase tracking-widest block mt-0.5 font-sans font-bold">✓ MedSoftwares Certified</span>
          </div>
        </div>
      </div>

      {/* INTERACTIVE DEMO SCENARIOS PANEL */}
      <div id="pharma-demo-scenarios" className="bg-slate-50 border border-slate-200 rounded-[24px] p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center space-x-2 text-emerald-800">
              <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
              <h3 className="text-xs font-black uppercase tracking-widest font-mono">Interactive Demo Test Profiles</h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Instantly simulate realistic clinical pharmacy use-cases, medical safety warnings, and automated insurance copay configurations.
            </p>
          </div>
          <span className="text-[9px] font-mono font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md uppercase tracking-wider">
            3 Ready-to-Test Profiles
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Profile 1 */}
          <button
            type="button"
            onClick={() => handleLoadDemoProfile('allergy')}
            className="group text-left p-3.5 bg-white border border-slate-205 hover:bg-rose-50/20 hover:border-rose-450 rounded-2xl transition-all cursor-pointer shadow-xs hover:shadow-sm"
          >
            <div className="flex justify-between items-start gap-2">
              <div className="p-1 px-1.5 bg-rose-50 text-rose-800 text-[9px] font-bold font-mono rounded-md uppercase tracking-wider">
                Clinical Safety
              </div>
              <span className="text-rose-500 font-bold text-xs group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <h4 className="text-xs font-extrabold text-slate-800 mt-2">1. Allergy Intercept Warn</h4>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              Loads <b>Amina Bello</b> (Penicillin Allergy) & adds <b>Amoxicillin 500mg</b> to cart. Triggers immediate clinical safety breach alert.
            </p>
            <div className="mt-2.5 border-t border-slate-100 pt-2 flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400">Insure: NHIS (80% split)</span>
              <span className="text-rose-600 font-bold">Allergy Warning Active</span>
            </div>
          </button>

          {/* Profile 2 */}
          <button
            type="button"
            onClick={() => handleLoadDemoProfile('coldchain')}
            className="group text-left p-3.5 bg-white border border-slate-205 hover:bg-sky-50/20 hover:border-sky-450 rounded-2xl transition-all cursor-pointer shadow-xs hover:shadow-sm"
          >
            <div className="flex justify-between items-start gap-2">
              <div className="p-1 px-1.5 bg-sky-50 text-sky-800 text-[9px] font-bold font-mono rounded-md uppercase tracking-wider">
                Cold-Chain Hormone
              </div>
              <span className="text-sky-600 font-bold text-xs group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <h4 className="text-xs font-extrabold text-slate-800 mt-2">2. Insulin Glargine Tracking</h4>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              Loads <b>Grace Kiptoo</b> & <b>Insulin Glargine (Lantus)</b> with refrigeration instructions. Computes copay on Aetna 90% reimbursement.
            </p>
            <div className="mt-2.5 border-t border-slate-100 pt-2 flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400">Insure: Aetna (90% split)</span>
              <span className="text-sky-600 font-bold">2°C - 8°C Storage</span>
            </div>
          </button>

          {/* Profile 3 */}
          <button
            type="button"
            onClick={() => handleLoadDemoProfile('cardio')}
            className="group text-left p-3.5 bg-white border border-slate-205 hover:bg-emerald-50/20 hover:border-emerald-450 rounded-2xl transition-all cursor-pointer shadow-xs hover:shadow-sm"
          >
            <div className="flex justify-between items-start gap-2">
              <div className="p-1 px-1.5 bg-emerald-50 text-emerald-805 text-[9px] font-bold font-mono rounded-md uppercase tracking-wider">
                Multi-Care Claim
              </div>
              <span className="text-emerald-600 font-bold text-xs group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <h4 className="text-xs font-extrabold text-slate-800 mt-2">3. Geriatric Cardio-Metabolic</h4>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              Loads <b>John Doe</b>. Adds <b>Atorvastatin 20mg</b> + <b>Metformin 850mg</b>. Displays combined ledger VAT & Doe Insurance copay calculations.
            </p>
            <div className="mt-2.5 border-t border-slate-100 pt-2 flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400">Insure: Jubilee (75% split)</span>
              <span className="text-emerald-700 font-bold">Dual-Therapy</span>
            </div>
          </button>
        </div>
      </div>

      {/* CORE PHARMACY NAVIGATION TABS */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActivePharmaTab('bestpos')}
          className={`flex items-center space-x-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activePharmaTab === 'bestpos' 
              ? 'border-emerald-600 text-emerald-800' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Pill className="w-4 h-4 shrink-0" />
          <span>💊 BestPOS Dispensary & Co-Pay</span>
        </button>

        <button
          onClick={() => setActivePharmaTab('bestrx')}
          className={`flex items-center space-x-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activePharmaTab === 'bestrx' 
              ? 'border-emerald-600 text-emerald-800' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ClipboardList className="w-4 h-4 shrink-0" />
          <span>📋 BestRx e-Prescriptions ({prescriptions.length})</span>
        </button>

        <button
          onClick={() => setActivePharmaTab('apothecary')}
          className={`flex items-center space-x-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activePharmaTab === 'apothecary' 
              ? 'border-emerald-600 text-emerald-800' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span>📦 Apothecary Catalog & Batches</span>
        </button>

        <button
          onClick={() => setActivePharmaTab('regulatory')}
          className={`flex items-center space-x-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activePharmaTab === 'regulatory' 
              ? 'border-emerald-600 text-emerald-800' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Cpu className="w-4 h-4 shrink-0" />
          <span>💻 Regulatory Gateway Terminal</span>
        </button>
      </div>

      {/* --- SUBTAB: BESTPOS DISPENSARY RETAIL ENGINE --- */}
      {activePharmaTab === 'bestpos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans">
          
          {/* LEFT COLUMN: Drug Molecule Finder (Cols 7) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white border border-slate-205 rounded-[24px] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Therapeutic Formulation search</h3>
                  <p className="text-[11px] text-slate-400">Search generic active chemistry, batch code, or brand</p>
                </div>
                
                {/* Category quick selectors */}
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-250 rounded-xl text-xs px-2.5 py-1.5 focus:border-emerald-500 focus:outline-none font-bold text-slate-650"
                >
                  <option value="All">All Molecules</option>
                  <option value="Antibiotic">Antibiotic</option>
                  <option value="Analgesic">Analgesic</option>
                  <option value="Anti-Diabetic">Anti-Diabetic</option>
                  <option value="Fluoroquinolones">Fluoroquinolones</option>
                  <option value="Cardiovascular">Cardiovascular</option>
                  <option value="Insulin Hormone">Insulin Hormone</option>
                </select>
              </div>

              {/* Find formulary bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-420 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Type drug name OR clinical active compound (e.g. Paracetamol, Amoxicillin, Levofloxacin...)"
                  value={drugSearchQuery}
                  onChange={(e) => setDrugSearchQuery(e.target.value)}
                  className="w-full text-xs font-sans pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-250 rounded-xl outline-none focus:border-emerald-500 focus:bg-white text-slate-850 placeholder:text-slate-400"
                />
              </div>

              {/* Medicine Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredDrugsCatalog.map((drug) => {
                  const safetyLimits = drug.stock <= 0;
                  const isColdChain = drug.coldChain;
                  const daysCheck = checkDrugExpiryBadge(drug.expiryDate);

                  return (
                    <div 
                      key={drug.id} 
                      className={`border border-slate-200 hover:border-emerald-300 rounded-2xl p-3.5 transition-all flex flex-col justify-between space-y-3 bg-white hover:shadow-xs relative ${
                        safetyLimits ? 'opacity-60 bg-slate-50' : ''
                      }`}
                    >
                      {isColdChain && (
                        <div className="absolute top-2 right-2 flex items-center space-x-1 text-[8.5px] font-bold text-slate-500 bg-sky-50 text-sky-800 border border-sky-100 rounded-md px-1.5 py-0.5 font-sans">
                          <ThermometerSnowflake className="w-2.5 h-2.5 text-sky-600 animate-pulse" />
                          <span>COLD-CHAIN</span>
                        </div>
                      )}

                      <div className="space-y-1 text-left">
                        <span className="text-[9.5px] font-mono font-bold text-slate-450 bg-slate-100 px-1.5 py-0.5 rounded-sm">
                          {drug.category}
                        </span>
                        <h4 className="text-xs font-extrabold text-slate-850 pt-1 leading-tight">{drug.name}</h4>
                        <span className="text-[10px] italic font-mono text-slate-450 block font-medium">
                          {drug.generic}
                        </span>
                        
                        {/* Expiry alerts indicators */}
                        <div className="pt-1">
                          <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold border ${daysCheck.color}`}>
                            {daysCheck.label}
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-2 flex items-center justify-between">
                        <div className="text-left">
                          <span className="text-[9px] font-medium text-slate-400 block font-mono">STOCK QUANTITY</span>
                          <span className={`text-[11px] font-mono font-black ${drug.stock < 50 ? 'text-rose-600' : 'text-slate-700'}`}>
                            {drug.stock} tabs
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-medium text-slate-400 block font-mono">TREATMENT CO-COST</span>
                          <span className="text-xs font-mono font-black text-slate-855">
                            {currency}{drug.price.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Add drug button */}
                      <button
                        type="button"
                        onClick={() => addToDispenseCart(drug)}
                        disabled={safetyLimits}
                        className="w-full py-2 bg-slate-50 hover:bg-emerald-600 text-slate-750 hover:text-white font-extrabold rounded-xl text-[10px] uppercase tracking-wider transition-all border border-slate-205 hover:border-emerald-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
                      >
                        {safetyLimits ? 'Unavailable' : 'Select Compound'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {filteredDrugsCatalog.length === 0 && (
                <div className="p-12 text-center text-slate-405 italic space-y-2">
                  <BadgeAlert className="w-10 h-10 text-slate-350 mx-auto" />
                  <p className="text-xs">No medical compounds align with search criteria.</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: BestPOS Check-Out & NHIS Co-Payment Module (Cols 5) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-205 rounded-[24px] p-5 space-y-5">
              
              {/* Patient / Insurance pre-verification */}
              <div className="space-y-3.5 border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider font-mono">Patient Clinical Dossier</h3>
                  <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-sm">BestRx SECURE</span>
                </div>

                {/* Patient choice */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">SELECT PATIENT RECIPIENT</label>
                  <select
                    value={selectedPatientId}
                    onChange={(e) => handlePatientSelectChange(e.target.value)}
                    className="w-full text-xs font-sans bg-slate-50 border border-slate-250 rounded-xl px-3 py-2.5 text-slate-850 outline-none focus:border-emerald-500 font-bold"
                  >
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} - Allergies: [{p.allergies}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Insurance network selection override */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">INSURANCE POLICY SPONSOR</label>
                  <div className="grid grid-cols-2 gap-1 px-0.5">
                    {['Self Pay', 'NHIS Public Health', 'Aetna International Group', 'Jubilee Health Insurance'].map((net) => (
                      <button
                        key={net}
                        type="button"
                        onClick={() => {
                          setInsurerOverride(net);
                          addRegLog(`POS Claims: Overridden billing policy to ${net} under clinical review.`);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all text-left truncate ${
                          insurerOverride === net 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-400' 
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        ✓ {net}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ALLERGY INTERCEPT ALERTS */}
              {allergyAlert && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-2 text-rose-800 leading-relaxed text-[11px] font-medium text-left">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-sans leading-snug">{allergyAlert}</span>
                </div>
              )}

              {/* COMPALINT DISPENSING TICKET CART */}
              <div className="space-y-3.5 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">PRESCRIPTION ITEMS TO DISPENSE</span>
                
                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  {dispenseCart.map((item) => (
                    <div key={item.drug.id} className="p-3 bg-slate-50 border border-slate-160 rounded-xl space-y-2 relative">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.drug.id)}
                        className="absolute top-2.5 right-2 text-slate-400 hover:text-rose-600 cursor-pointer border-none bg-transparent"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="pr-6 space-y-0.5">
                        <span className="text-[8.5px] font-bold font-mono text-indigo-600 bg-indigo-50 px-1 py-px rounded">{item.drug.batchNo}</span>
                        <h5 className="text-[11.5px] font-extrabold text-slate-805">{item.drug.name}</h5>
                        <p className="text-[9.5px] font-mono text-slate-450 italic">{item.drug.generic}</p>
                      </div>

                      {/* Quantum count adjuster */}
                      <div className="flex items-center justify-between border-t border-slate-150 pt-2 flex-wrap gap-2">
                        <div className="flex items-center space-x-1 text-xs">
                          <span className="text-[10px] font-bold text-slate-450 font-mono mr-1">TABS:</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.drug.id, item.qty - 1)}
                            className="w-5 h-5 bg-white border border-slate-205 hover:bg-slate-100 flex items-center justify-center font-bold text-xs rounded transition-colors cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) => updateCartQty(item.drug.id, parseInt(e.target.value) || 1)}
                            className="w-10 bg-white border border-slate-250 text-center font-mono text-[11px] font-bold py-px h-5 rounded outline-none focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.drug.id, item.qty + 1)}
                            className="w-5 h-5 bg-white border border-slate-205 hover:bg-slate-100 flex items-center justify-center font-bold text-xs rounded transition-colors cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-xs font-mono font-black text-slate-750">
                          {currency}{(item.drug.price * item.qty).toLocaleString()}
                        </span>
                      </div>

                      {/* Apothecary dosage prescription string */}
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block font-mono">Dosage Directions</label>
                        <input
                          type="text"
                          value={item.dosage}
                          onChange={(e) => updateInstructions(item.drug.id, e.target.value)}
                          placeholder="e.g. 1 Tablet TDS every 8 hours"
                          className="w-full bg-white border border-slate-215 rounded px-2 py-1 text-[10px] font-mono text-indigo-900 focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>
                  ))}

                  {dispenseCart.length === 0 && (
                    <div className="py-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 text-xs italic">
                      No therapeutic agents inside active checkout deck. Select from medicinal catalog on left.
                    </div>
                  )}
                </div>
              </div>

              {/* BILL TALLY & NATIONAL INSURANCE NETWORKS */}
              {dispenseCart.length > 0 && (
                <div className="border-t border-slate-150 pt-4 space-y-3 text-xs text-slate-700 font-mono text-left">
                  <div className="flex justify-between">
                    <span>Base Formulation Sum:</span>
                    <span>{currency}{cartTotals.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Apothecary VAT Tax Rate ({Math.round((activeTenant.taxRate || 0.18) * 100)}%):</span>
                    <span>{currency}{cartTotals.vat.toLocaleString()}</span>
                  </div>

                  {/* CO-PAY splits */}
                  <div className="bg-emerald-50/50 rounded-2xl border border-emerald-100 p-3 space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-emerald-805 font-bold">
                      <span>Insurer Co-Claim ({cartTotals.coveragePercent}%):</span>
                      <span>-{currency}{cartTotals.insuranceContribution.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[10px]">
                      <span>Authorization Provider:</span>
                      <span className="font-extrabold uppercase">{insurerOverride}</span>
                    </div>
                  </div>

                  <div className="flex justify-between font-black text-slate-900 border-t border-slate-200/60 pt-3 text-sm">
                    <span>PATIENT CO-PAY OUT-OF-POCKET:</span>
                    <span className="text-emerald-800 text-base">{currency}{cartTotals.patientCoPayDue.toLocaleString()}</span>
                  </div>

                  {/* Submit checkout button */}
                  <button
                    type="button"
                    onClick={handleFinalizeDispensation}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-[11px] uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-emerald-500/10 hover:shadow-emerald-552 text-center"
                  >
                    ✓ Dispense Medications & Print Sigi-Receipt
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- SUBTAB: BESTRX PRESCRIPTION & ELECTRONIC CLAIMS --- */}
      {activePharmaTab === 'bestrx' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left font-sans">
          
          {/* Patients profiles management card */}
          <div className="bg-white border border-slate-205 rounded-[24px] p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider font-mono">Enroll Patient Profile</h3>
            <p className="text-[11px] text-slate-400">Add patient data.</p>
            
            <form onSubmit={handleAddNewPatient} className="space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-454 block uppercase tracking-wide">Full Patient Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mzee Saidi Kipemba"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-emerald-500 outline-none text-slate-800 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-454 block uppercase tracking-wide">Primary Phone (WhatsApp Ready)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 255711223344"
                  value={newPatientPhone}
                  onChange={(e) => setNewPatientPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-emerald-500 outline-none font-mono text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-454 block uppercase tracking-wide">Active Insurer Network</label>
                <select
                  value={newPatientInsurer}
                  onChange={(e) => setNewPatientInsurer(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-emerald-500 outline-none text-slate-800 font-bold font-sans"
                >
                  <option value="Self Pay">Self Pay / Cash Only</option>
                  <option value="NHIS Public Health">NHIS Public Health</option>
                  <option value="Aetna International Group">Aetna International Group</option>
                  <option value="Jubilee Health Insurance">Jubilee Health Insurance</option>
                  <option value="Starlife HMO Private">Starlife HMO Private</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-rose-700 block uppercase tracking-wide">Allergies & Chemical Exclusions</label>
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Sulfa drugs, Aspirin"
                  value={newPatientAllergies}
                  onChange={(e) => setNewPatientAllergies(e.target.value)}
                  className="w-full bg-rose-50/40 border border-slate-250 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-emerald-500 outline-none text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 border-none hover:bg-slate-800 text-white font-bold rounded-xl uppercase tracking-wider text-[10px] cursor-pointer"
              >
                Enroll Patient & Issue Base Rx Ticket
              </button>
            </form>
          </div>

          {/* Active prescription dossiers List */}
          <div className="bg-white border border-slate-205 rounded-[24px] p-6 lg:col-span-2 space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider font-mono">Direct Electronic Insurance Claims</h3>
            <p className="text-[11px] text-slate-400">Insurance claims.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-205 text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">
                    <th className="py-2.5">Claim ID</th>
                    <th>Patient Client</th>
                    <th>Formula Requested</th>
                    <th>Insurer Sponsor</th>
                    <th className="text-center">Patient Split</th>
                    <th className="text-right">Submission Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans text-slate-650 text-[11px]">
                  {prescriptions.map((clm) => (
                    <tr key={clm.id} className="hover:bg-slate-50/50">
                      <td className="py-3 font-mono font-black text-indigo-700">{clm.id}</td>
                      <td className="py-3 font-bold text-slate-800">{clm.patientName}</td>
                      <td className="py-3 font-mono text-[10.5px] italic text-slate-600">{clm.drug}</td>
                      <td className="py-3">
                        <span className="font-mono text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 px-1.5 py-0.5 rounded">
                          {clm.insurer}
                        </span>
                      </td>
                      <td className="py-3 text-center font-bold text-slate-700">{clm.copayPercent}% Co-Pay</td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-black text-[9px] uppercase tracking-wider">
                          {clm.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100/75 flex items-start space-x-3 text-[11.5px] text-sky-850">
              <ShieldAlert className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold block uppercase tracking-wider text-[10.5px]">Direct NHIS Compliance Verification Done</span>
                <p className="leading-relaxed">
                  Claims validation algorithm verifies patient eligibility metrics, insurance copay schedules, and pricing benchmarks against the national medical schema in real-time. Direct reimbursements file instantly.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SUBTAB: APOTHECARY CATALOG & COLD-CHAIN BATCHES --- */}
      {activePharmaTab === 'apothecary' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left font-sans">
          
          {/* APOTHECARY FAST MEDICAL CREATOR (Cols 4) */}
          <div className="lg:col-span-4 bg-white border border-slate-205 rounded-[24px] p-5 space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider font-mono">Apothecary Inventory Register</h3>
            <p className="text-[11px] text-slate-400">Add drugs and batches.</p>

            <form onSubmit={handleCreateNewMedication} className="space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-454 block uppercase tracking-wide">Formulated Drug Brand Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Panadol Forte 500mg"
                  value={newMedName}
                  onChange={(e) => setNewMedName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-emerald-500 outline-none text-slate-850 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-454 block uppercase tracking-wide">Generic Submolecular Compound</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acetaminophen BP / Ph.Eur."
                  value={newMedGeneric}
                  onChange={(e) => setNewMedGeneric(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-emerald-500 outline-none font-mono text-slate-850"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-454 select-none block uppercase tracking-wide">Dispense Cost ({currency})</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 5000"
                    value={newMedPrice}
                    onChange={(e) => setNewMedPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-emerald-500 outline-none font-mono text-slate-850"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-454 select-none block uppercase tracking-wide">Inherent Qty (Tabs)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 100"
                    value={newMedStock}
                    onChange={(e) => setNewMedStock(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-emerald-500 outline-none font-mono text-slate-850"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-454 block uppercase tracking-wide">Drug Class Category</label>
                  <select
                    value={newMedCategory}
                    onChange={(e) => setNewMedCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-emerald-500 outline-none text-slate-800 font-bold"
                  >
                    <option value="Antibiotic">Antibiotic</option>
                    <option value="Analgesic">Analgesic</option>
                    <option value="Anti-Diabetic">Anti-Diabetic</option>
                    <option value="Fluoroquinolones">Fluoroquinolones</option>
                    <option value="Cardiovascular">Cardiovascular</option>
                    <option value="Insulin Hormone">Insulin Hormone</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-454 block uppercase tracking-wide">Expiration Date</label>
                  <input
                    type="date"
                    required
                    value={newMedExpiry}
                    onChange={(e) => setNewMedExpiry(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-xs focus:bg-white focus:border-emerald-500 outline-none font-mono text-slate-800"
                  />
                </div>
              </div>

              {/* Rx prescription & ColdChain flags */}
              <div className="space-y-2 border-t border-slate-100 pt-3 text-[11px] text-slate-650">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="newRxReq"
                    checked={newMedRxReq}
                    onChange={(e) => setNewMedRxReq(e.target.checked)}
                    className="rounded border-slate-250 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="newRxReq" className="font-bold select-none cursor-pointer">Requires Prescription Verification</label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="newColdChain"
                    checked={newMedColdChain}
                    onChange={(e) => setNewMedColdChain(e.target.checked)}
                    className="rounded border-slate-250 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="newColdChain" className="font-bold select-none cursor-pointer text-sky-800">Requires Cold-Chain (2°C - 8°C)</label>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-605 hover:bg-emerald-700 text-white font-bold rounded-xl uppercase tracking-wider text-[10px] cursor-pointer"
              >
                + Register Formulation Batch
              </button>
            </form>
          </div>

          {/* CATALOG PREVIEW & EXPIRATION AUDITS (Cols 8) */}
          <div className="lg:col-span-8 bg-white border border-slate-205 rounded-[24px] p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider font-mono">Cold-Chain Storage & Expiry Audits</h3>
            <p className="text-[11px] text-slate-400">Drug batches.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10.5px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    <th className="py-2.5">Medication Name & Class</th>
                    <th>Batch ID</th>
                    <th>Stock Level</th>
                    <th>Expiration Marker</th>
                    <th>Storage Temp</th>
                    <th className="text-right">Apothecary Pricing</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
                  {drugs.map((drug) => {
                    const expiryCheck = checkDrugExpiryBadge(drug.expiryDate);
                    return (
                      <tr key={drug.id} className="hover:bg-slate-50/50">
                        <td className="py-3">
                          <span className="font-bold text-slate-850 block">{drug.name}</span>
                          <span className="text-[9.5px] italic text-slate-450 font-mono italic leading-none">{drug.generic}</span>
                        </td>
                        <td className="py-3 font-mono font-bold text-slate-500">{drug.batchNo}</td>
                        <td className="py-3 font-mono">
                          <span className={`font-black ${drug.stock < 50 ? 'text-rose-600 font-extrabold bg-rose-50 px-1 rounded' : 'text-slate-800'}`}>
                            {drug.stock} units
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${expiryCheck.color}`}>
                            {expiryCheck.label}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-[10px]">
                          {drug.coldChain ? (
                            <span className="text-sky-700 bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded font-black font-sans text-[9px]">
                              Refrigerated 2-8°C
                            </span>
                          ) : (
                            <span className="text-slate-500">Dry Dry &lt;25°C</span>
                          )}
                        </td>
                        <td className="py-3 text-right font-mono font-black text-slate-800">
                          {currency}{drug.price.toLocaleString()}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRestockMedicine(drug.id)}
                            className="bg-slate-100 hover:bg-emerald-50 text-[10px] text-slate-700 hover:text-emerald-700 px-2 py-1 rounded border border-slate-205 hover:border-emerald-300 font-bold cursor-pointer transition-all"
                          >
                            +50 Tabs
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- SUBTAB: REGULATORY GATEWAY & CONSOLE MODULE --- */}
      {activePharmaTab === 'regulatory' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans text-left">
          
          {/* HL7 & HIPAA protocols verification metadata view */}
          <div className="bg-white border border-slate-205 rounded-[24px] p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest font-mono">HIPAA & HL7 Standards</h3>
            <p className="text-[11px] text-slate-400">Compliance rules.</p>
            
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-mono text-slate-500">TFDA Registered node ID:</span>
                <span className="font-mono font-bold text-slate-805">TZ-TFDA-NODE-84729</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-mono text-slate-500">HIPAA security compliance:</span>
                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black font-sans text-[10px]">VERIFIED OK</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-mono text-slate-500">Electronic FHIR/HL7 version:</span>
                <span className="font-mono font-bold text-indigo-700">FHIR Client v4.1.0</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-mono text-slate-500">Public Key (SHA256 signature):</span>
                <span className="font-mono font-black text-rose-800 text-[10px]">AES256_RSA4096</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-450 italic mt-6 leading-relaxed">
              * Note: In alignment with national medication logistics guidelines, some schedules (like narcotics and narcotics analogs) require manual physical prescription vouchers to be signed by registered pharmacists.
            </p>
          </div>

          {/* Live stream logs block */}
          <div className="bg-white border border-slate-205 rounded-[24px] p-6 lg:col-span-2 space-y-4 flex flex-col h-[400px]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-black text-slate-805 uppercase font-mono tracking-wider">Clinical Sync Server Feed</h3>
                <p className="text-[11px] text-slate-400">Live background verification streams synced automatically</p>
              </div>
              <button
                type="button"
                onClick={() => setRegulatoryLogs([])}
                className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors text-slate-650 cursor-pointer border-none font-bold font-mono"
              >
                Clear logs
              </button>
            </div>

            <div className="flex-grow bg-slate-900 rounded-2xl p-4 font-mono text-[10.5px] text-emerald-400 overflow-y-auto space-y-1.5 leading-relaxed">
              {regulatoryLogs.map((log, idx) => (
                <p key={idx} className="border-b border-slate-800/50 pb-1">
                  <span className="text-slate-500 mr-2">●</span>
                  {log}
                </p>
              ))}

              {regulatoryLogs.length === 0 && (
                <p className="text-slate-500 italic">No network logs active in local sandbox loop.</p>
              )}
            </div>
          </div>
        </div>
      )}


      {/* --- BESTPOS SPECIAL CLINICAL THERMAL RECEIPT POPUP --- */}
      {isReceiptOpen && successReceiptSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Brand Receipt Header */}
            <div className="p-6 bg-slate-950 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2.5 text-left">
                <Pill className="w-5 h-5 text-emerald-400 animate-pulse" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-white">PHARMAPOS CLINICAL INVOICE</h4>
                  <span className="text-[9px] font-mono text-emerald-300 uppercase tracking-widest font-bold">MedSoftwares BestPOS Integration</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReceiptOpen(false)}
                className="p-1 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono text-[10px] uppercase font-bold cursor-pointer transition-colors border-none font-sans"
              >
                Close
              </button>
            </div>

            {/* Receipt body scrollable panel */}
            <div className="p-6 overflow-y-auto space-y-6 flex-grow bg-slate-50 text-slate-805">
              <div className="bg-white p-5 rounded-3xl font-mono text-xs space-y-4 shadow-md border-dashed border-2 border-slate-250">
                <div className="text-center space-y-1 border-b border-dashed border-slate-200 pb-3">
                  <h5 className="font-bold text-sm uppercase">{activeTenant.name}</h5>
                  <p className="text-[10px] text-slate-500">APOTHECARY DISPENSARY SHIFT</p>
                  <p className="text-[10px] text-slate-500">{activeTenant.city}, {activeTenant.country}</p>
                </div>

                {/* Patient metadata details row */}
                <div className="space-y-1 text-[10.5px] border-b border-dashed border-slate-200 pb-2 text-left">
                  <div className="flex justify-between">
                    <span>Rx Ticket ID:</span>
                    <span className="font-bold">{successReceiptSale.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Filing DateTime:</span>
                    <span>{new Date(successReceiptSale.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Registered Patient:</span>
                    <span className="font-bold">{successReceiptSale.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Clinical Pharmacist:</span>
                    <span>{successReceiptSale.cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Insurance Provider:</span>
                    <span className="font-bold uppercase text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded text-[10px] inline-block">{insurerOverride}</span>
                  </div>
                </div>

                {/* Clinical formulations items mapping */}
                <div className="space-y-2 border-b border-dashed border-slate-200 pb-3 text-left">
                  <div className="grid grid-cols-12 font-bold text-[10px] uppercase text-slate-400">
                    <span className="col-span-6">Compound Formulation</span>
                    <span className="col-span-2 text-center">Batch</span>
                    <span className="col-span-4 text-right">Treatment Cost</span>
                  </div>
                  
                  {successReceiptSale.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 text-[10.5px] gap-y-0.5">
                      <span className="col-span-6 font-bold text-slate-850 line-clamp-1">
                        {item.productName}
                      </span>
                      <span className="col-span-2 text-center text-[9.5px] text-slate-500 font-mono">
                        {item.qty} units
                      </span>
                      <span className="col-span-4 text-right font-mono text-slate-800">
                        {currency}{(item.price * item.qty).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Copay splitting schedules details */}
                <div className="space-y-1.5 text-right font-bold text-[11px] text-slate-700">
                  <div className="flex justify-between font-normal text-slate-500">
                    <span>Subtotal Formulation:</span>
                    <span>{currency}{(successReceiptSale.total - (successReceiptSale.tax || 0)).toLocaleString()}</span>
                  </div>
                  {successReceiptSale.tax ? (
                    <div className="flex justify-between font-normal text-slate-500">
                      <span>Value Charged Tax (VAT):</span>
                      <span>{currency}{successReceiptSale.tax.toLocaleString()}</span>
                    </div>
                  ) : null}

                  {insurerOverride !== 'Self Pay' && (
                    <div className="flex justify-between font-bold text-emerald-800 border-t border-slate-100 pt-1">
                      <span>Insurer coverage claims:</span>
                      <span>-{currency}{(successReceiptSale.total - (successReceiptSale.amountPaid || 0)).toLocaleString()}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-xs border-t border-slate-200 pt-2 text-slate-900 font-black">
                    <span>PATIENT COPAY OUT-OF-POCKET:</span>
                    <span className="text-emerald-700 text-sm">
                      {currency}{(successReceiptSale.amountPaid !== undefined ? successReceiptSale.amountPaid : successReceiptSale.total).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Signature Slots */}
                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3 text-[9px] text-slate-400 font-sans font-bold">
                  <div className="text-left">
                    <div className="h-8 border-b border-slate-200" />
                    <p className="mt-1">PHARMACIST DIRECT SIGI</p>
                  </div>
                  <div className="text-right">
                    <div className="h-8 border-b border-slate-200" />
                    <p className="mt-1">PATIENT / CO-PAY RECIPIENT</p>
                  </div>
                </div>

                <div className="text-center font-normal text-[8.5px] text-slate-400 pt-2 space-y-0.5">
                  <p>Asante kwa kuchagua MedSoftwares Systems!</p>
                  <p className="uppercase tracking-wider">Cloud Synchronized Medical Node</p>
                </div>
              </div>

              {/* Digital WhatsApp Sharing Input */}
              <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4 space-y-3 text-left">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest block font-mono">
                  Send Digital Rx Receipt to Patient
                </span>
                <div className="flex gap-2">
                  <div className="relative flex-grow">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[11px]">+</span>
                    <input
                      type="text"
                      placeholder="e.g. 255711223344"
                      value={whatsappSharePhone}
                      onChange={(e) => setWhatsappSharePhone(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full bg-white border border-slate-250 rounded-xl text-xs pl-6 pr-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 font-mono placeholder:font-sans placeholder:text-slate-400 font-bold"
                    />
                  </div>
                  
                  {(() => {
                    const patientCoPayPaid = successReceiptSale.amountPaid !== undefined ? successReceiptSale.amountPaid : successReceiptSale.total;
                    const msg = `🧾 *MEDICAL RECEIPT* from *${activeTenant.name}*\n` +
                      `📍 ID: ${successReceiptSale.id}\n` +
                      `👤 Patient: ${successReceiptSale.customerName}\n` +
                      `🌡️ Formulary items: ${successReceiptSale.items.map(it => `${it.productName} (x${it.qty})`).join(', ')}\n` +
                      `💵 Insurer: ${insurerOverride}\n` +
                      `💵 OOP Patient Co-Pay Paid: ${currency}${patientCoPayPaid.toLocaleString()}\n` +
                      `\nYour medicine dosage instructions are mapped on physical vouchers. Wish you sound health!`;
                    const link = `https://api.whatsapp.com/send?phone=${whatsappSharePhone || ''}&text=${encodeURIComponent(msg)}`;
                    return (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-sm text-center justify-center decoration-transparent"
                      >
                        <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                        <span>Send WhatsApp</span>
                      </a>
                    );
                  })()}
                </div>
              </div>

              {/* Action Buttons: Print thermal receipt or complete */}
              <div className="grid grid-cols-2 gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full py-3 bg-white border border-slate-205 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs uppercase cursor-pointer flex items-center justify-center space-x-1.5 transition-colors font-sans"
                >
                  <Printer className="w-4 h-4 text-slate-500 select-none" />
                  <span>Print Shift Voucher</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsReceiptOpen(false)}
                  className="w-full py-3 bg-slate-900 border-none hover:bg-slate-800 text-white font-bold rounded-xl text-xs uppercase cursor-pointer transition-colors font-sans"
                >
                  Finish & Clear Shift
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* FOOTER CO-PAY INDICATOR */}
      <div className="bg-slate-50 border border-slate-200 p-4.5 rounded-3xl flex items-center space-x-3 text-slate-450 text-[11px] text-left">
        <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" />
        <p className="leading-snug">
          ✓ **TFDA & HIPAA Electronic Standard Compliance Approved.** Any dispensation logs or NHIS claim payloads are fully validated, keeping patient medical records fully compliant with strict cybersecurity structures.
        </p>
      </div>

    </div>
  );
}
