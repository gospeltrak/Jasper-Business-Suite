import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Tenant, Delivery, DeliveryRider, SaleItem, Product, SystemSettings, Sale, StaffSettings } from '../types';
import { 
  Truck, 
  UserPlus, 
  UserCheck, 
  Plus, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Smartphone, 
  MessageSquare, 
  Share2, 
  Clipboard, 
  Search, 
  Check, 
  MapPin, 
  X,
  Navigation,
  Bike,
  FileText,
  Printer,
  Download,
  Trash2,
  Edit,
  MoreVertical,
  Eye
} from 'lucide-react';
import { printPdfFromElement, shareElementPdfToWhatsApp } from '../utils/pdfShare';
import { getBusinessDisplayName, getBusinessLogo } from '../utils/businessBranding';
import { formatSaleItemQuantity } from '../utils/unitFormatter';

// A high-fidelity composite component representing a rider on a motorcycle with a delivery basket on their back
function DeliveryMotorcycleIcon({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      width={size} 
      height={size} 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      {/* Wheels with inner hubs */}
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="19" cy="18" r="2.5" />
      <circle cx="5" cy="18" r="0.8" fill="currentColor" />
      <circle cx="19" cy="18" r="0.8" fill="currentColor" />
      
      {/* Front Fork & Scooter Shield & Body */}
      <path d="M5 18h4.5l1.5-3.5h5.5l2.5 3.5" />
      <path d="M17 14.5l1.5-6" strokeWidth="2.2" />
      <path d="M15.5 8.5h3" />

      {/* Seat */}
      <path d="M8 14.5h4.5" strokeWidth="1.5" />

      {/* Rider Helmet (Head) */}
      <circle cx="12" cy="6" r="1.5" fill="currentColor" />

      {/* Rider's Torso leaning forward slightly */}
      <path d="M10 14l2-5" strokeWidth="1.8" />

      {/* Rider's Arms reaching to the handlebar */}
      <path d="M11.5 9.5l4.5-0.5" />

      {/* Rider's Legs sitting on the scooter */}
      <path d="M10 14l1.5 2H13" />

      {/* Large Delivery Backpack on the rider's back */}
      <rect x="5" y="6" width="4.5" height="5.5" rx="1.2" fill="currentColor" className="text-emerald-500 stroke-none" />
      {/* Backpack design line / straps */}
      <path d="M5.5 8h3.5" stroke="white" strokeWidth="0.8" />
      <path d="M5.5 10h3.5" stroke="white" strokeWidth="0.8" />
      <path d="M9.5 7.5c0.5 0.5 0.8 1.2 0.5 2.2" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

interface DashboardDeliveriesProps {
  activeTenant: Tenant;
  deliveries: Delivery[];
  riders: DeliveryRider[];
  onAddRider: (rider: DeliveryRider) => void;
  onDispatchDelivery: (deliveryId: string, riderDetails: NonNullable<Delivery['riderDetails']>, riderId?: string, customerData?: { name: string, phone: string, location: string, paymentMethod?: string }) => void;
  onUpdateDeliveryStatus: (deliveryId: string, status: Delivery['status']) => Promise<boolean> | boolean | void;
  products?: Product[];
  systemSettings?: SystemSettings;
  sales?: Sale[];
  onAddDelivery?: (delivery: Delivery) => void;
  pendingNotes?: any[];
  onUpdatePendingNotes?: (notes: any[]) => void;
  defaultSubTab?: 'queue' | 'riders' | 'notes' | 'accounting';
  onSubTabChange?: (tab: 'queue' | 'riders' | 'notes' | 'accounting') => void;
  expenses?: any[];
  onAddExpense?: (exp: any) => void;
  onEditDelivery?: (deliveryId: string, updates: {
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    deliveryCost?: number;
    notes?: string;
    riderId?: string | null;
    riderDetails?: Delivery['riderDetails'] | null;
  }) => Promise<boolean> | boolean;
  onDeleteDelivery?: (deliveryId: string) => Promise<boolean>;
  activeBranchName?: string;
}

export default function DashboardDeliveries({
  activeTenant,
  deliveries,
  riders,
  onAddRider,
  onDispatchDelivery,
  onUpdateDeliveryStatus,
  products = [],
  systemSettings,
  sales = [],
  onAddDelivery,
  pendingNotes = [],
  onUpdatePendingNotes,
  defaultSubTab,
  onSubTabChange,
  expenses = [],
  onAddExpense,
  onEditDelivery,
  onDeleteDelivery,
  activeBranchName
}: DashboardDeliveriesProps) {
  const [activeSubTab, setActiveSubTab] = useState<'queue' | 'riders' | 'notes' | 'accounting'>('queue');
  
  useEffect(() => {
    if (defaultSubTab) {
      setActiveSubTab(defaultSubTab);
    }
  }, [defaultSubTab]);

  const handleSubTabChange = (tab: 'queue' | 'riders' | 'notes' | 'accounting') => {
    setActiveSubTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  // Logistics & transport custom states
  const [zoomLevel, setZoomLevel] = useState<number>(65);
  const [noteTransportType, setNoteTransportType] = useState('');
  const [noteVehiclePlate, setNoteVehiclePlate] = useState('');
  const [activeEditingPendingNoteId, setActiveEditingPendingNoteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Custom Add Delivery State
  const [isAddDeliveryModalOpen, setIsAddDeliveryModalOpen] = useState(false);
  const [searchSaleRef, setSearchSaleRef] = useState('');
  const [matchedSale, setMatchedSale] = useState<Sale | null>(null);
  const [newDeliveryCost, setNewDeliveryCost] = useState<number | ''>('');
  const [newDeliveryPaymentMethod, setNewDeliveryPaymentMethod] = useState<string>('Cash');

  // Dispatch Modal state
  const [dispatchTarget, setDispatchTarget] = useState<Delivery | null>(null);
  const [useShopRider, setUseShopRider] = useState<boolean>(true);
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  const [dispatchPaymentMethod, setDispatchPaymentMethod] = useState<string>('');

  useEffect(() => {
    if (dispatchTarget) {
      setDispatchCustomerName(dispatchTarget.customerName || '');
      setDispatchCustomerPhone(dispatchTarget.customerPhone || '');
      setDispatchCustomerLocation(dispatchTarget.notes || '');
    }
  }, [dispatchTarget]);
  
  // Ad-hoc/Temporary rider fields
  const [tempName, setTempName] = useState('');
  const [tempPhone, setTempPhone] = useState('');
  const [tempClassification, setTempClassification] = useState<'rider' | 'driver'>('rider');
  const [tempVehicleType, setTempVehicleType] = useState<'motorcycle' | 'tuktuk' | 'car'>('motorcycle');
  const [tempVehicleColor, setTempVehicleColor] = useState('');
  const [tempLicensePlate, setTempLicensePlate] = useState('');

  // Delivery Customer Info overwrite during dispatch
  const [dispatchCustomerName, setDispatchCustomerName] = useState('');
  const [dispatchCustomerPhone, setDispatchCustomerPhone] = useState('');
  const [dispatchCustomerLocation, setDispatchCustomerLocation] = useState('');

  // Register New Rider fields
  const [newRiderName, setNewRiderName] = useState('');
  const [newRiderPhone, setNewRiderPhone] = useState('');
  const [newRiderClassification, setNewRiderClassification] = useState<'rider' | 'driver'>('rider');
  const [newRiderVehicleType, setNewRiderVehicleType] = useState<'motorcycle' | 'tuktuk' | 'car'>('motorcycle');
  const [newRiderVehicleColor, setNewRiderVehicleColor] = useState('');
  const [newRiderLicensePlate, setNewRiderLicensePlate] = useState('');
  const [riderSuccessMessage, setRiderSuccessMessage] = useState('');

  // Handle New Delivery Search & Submit
  const handleSearchSale = () => {
    if (!searchSaleRef.trim()) return;
    const found = sales?.find(s => s.reference.toLowerCase() === searchSaleRef.toLowerCase().trim() || s.id.toLowerCase() === searchSaleRef.toLowerCase().trim());
    if (found) {
      setMatchedSale(found);
      setNewDeliveryCost(found.deliveryCost || '');
      setNewDeliveryPaymentMethod(found.deliveryPaymentMethod || systemSettings?.business?.deliveryPaymentModes?.[0] || 'Cash');
    } else {
      alert('Sale record not found. Please verify the Reference Number.');
      setMatchedSale(null);
    }
  };

  const handleSubmitNewDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedSale) return;
    if (onAddDelivery) {
      const newDeliveryId = 'DL-' + matchedSale.id.substring(matchedSale.id.length - 8).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      onAddDelivery({
        id: newDeliveryId,
        saleId: matchedSale.id,
        customerName: matchedSale.customerName || 'Walk-In Customer',
        customerPhone: matchedSale.customerPhone || '',
        items: matchedSale.items,
        totalAmount: matchedSale.total,
        deliveryPaymentMethod: newDeliveryPaymentMethod,
        deliveryCost: typeof newDeliveryCost === 'number' ? newDeliveryCost : 0,
        status: 'Pending Dispatch',
        timestamp: new Date().toISOString(),
        tenantId: activeTenant.id
      });
      setIsAddDeliveryModalOpen(false);
      setSearchSaleRef('');
      setMatchedSale(null);
      setNewDeliveryCost('');
    }
  };

  // WhatsApp simulation modal state
  const [whatsAppTarget, setWhatsAppTarget] = useState<Delivery | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [deliveryPdfStatus, setDeliveryPdfStatus] = useState<string | null>(null);

  // Delivery Note Creator Form States
  const [notePINo, setNotePINo] = useState(() => `PI-${Math.floor(10000 + Math.random() * 90000)}`);
  const [noteLPO, setNoteLPO] = useState(() => `LP-${Math.floor(100 + Math.random() * 900)}`);
  
  const getTodayFormatted = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const [noteDate, setNoteDate] = useState(() => getTodayFormatted());
  const [noteDeliveryToTitle, setNoteDeliveryToTitle] = useState('Doe Company');
  const [noteDeliveryToAddress, setNoteDeliveryToAddress] = useState('123 Main Street, City');
  const [noteDeclaration, setNoteDeclaration] = useState('Goods delivered in good order and condition.');
  const [noteDeliveredByName, setNoteDeliveredByName] = useState('');
  const [noteDeliveredBySignature, setNoteDeliveredBySignature] = useState('');
  const [noteDeliveredDate, setNoteDeliveredDate] = useState(() => getTodayFormatted());

  const [newRiderSignature, setNewRiderSignature] = useState('');
  const [selectedRiderForNoteId, setSelectedRiderForNoteId] = useState('');
  const [driverType, setDriverType] = useState<'system' | 'external'>('system');
  const [externalDriverName, setExternalDriverName] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Dynamically computed supplier details
  const computedLogo = ((() => { const stores = systemSettings?.business?.registeredStores || []; const activeBranch = stores[0]; const bb = activeBranch && systemSettings?.business?.branchBranding?.[activeBranch]; return bb?.businessLogoLight || bb?.businessLogo || null; })()) || getBusinessLogo(systemSettings) || '';
  const computedLogoName = getBusinessDisplayName(activeTenant, systemSettings);
  const computedCompanyTitle = getBusinessDisplayName(activeTenant, systemSettings);
  const computedCompanyAddress = systemSettings?.business?.businessAddress || '';
  const computedCompanyPhone = systemSettings?.business?.businessPhone || '';
  const computedCompanyEmail = systemSettings?.business?.businessEmail || '';
  const computedTIN = systemSettings?.invoiceSettings?.tin || systemSettings?.invoiceSettings?.tinNumber || '';
  const computedInvoiceColor = systemSettings?.invoiceSettings?.invoiceColor || '#102d68';
  const selectedRiderForNote = riders.find(r => r.id === selectedRiderForNoteId);
  
  // Dynamic table items
  const [noteItems, setNoteItems] = useState<Array<{id:string;description:string;unit:string;qty:number}>>([]);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [invoiceSearchResults, setInvoiceSearchResults] = useState<any[]>([]);
  const [linkedInvoiceRef, setLinkedInvoiceRef] = useState('');

  // Search sales/invoices by reference number, customer name, or date
  const handleInvoiceSearch = (query: string) => {
    setInvoiceSearchQuery(query);
    setLinkedInvoiceRef('');
    if (!query.trim() || !sales?.length) { setInvoiceSearchResults([]); return; }
    const q = query.toLowerCase().trim();
    const results = (sales || []).filter(s =>
      (s.reference && s.reference.toLowerCase().includes(q)) ||
      (s.id && s.id.toLowerCase().includes(q)) ||
      (s.customerName && s.customerName.toLowerCase().includes(q)) ||
      (s.timestamp && s.timestamp.startsWith(q))
    ).slice(0, 8);
    setInvoiceSearchResults(results);
  };

  // Pull products from a selected sale/invoice into the delivery note
  const handleLoadFromSale = (sale: any) => {
    const items = (sale.items || []).map((item: any, idx: number) => ({
      id: (idx + 1).toString(),
      description: item.productName || item.name || 'Item',
      unit: item.unit || item.baseUnit || item.sellUnit || 'PC',
      qty: item.qty || item.quantity || 1,
    }));
    setNoteItems(items);
    setLinkedInvoiceRef(sale.reference || sale.id || '');
    setInvoiceSearchQuery(sale.reference || sale.id || '');
    setInvoiceSearchResults([]);
    // Auto-fill customer info
    if (sale.customerName) setNoteDeliveryToTitle(sale.customerName);
    if (sale.customerPhone) setNoteDeliveryToAddress(`Phone: ${sale.customerPhone}`);
    if (sale.reference || sale.id) setNotePINo((sale.reference || sale.id).replace(/[^0-9A-Za-z-]/g, '').slice(0, 12));
  };

  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('PC');
  const [newItemQty, setNewItemQty] = useState(1);
  const [openDropdownRow, setOpenDropdownRow] = useState<string | null>(null);

  // Dispatch Jobs (queue) compact list: action menu + View/Edit/Delete modals
  const [openQueueActionId, setOpenQueueActionId] = useState<string | null>(null);
  const [viewingDelivery, setViewingDelivery] = useState<Delivery | null>(null);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [editDeliveryCustomerName, setEditDeliveryCustomerName] = useState('');
  const [editDeliveryCustomerPhone, setEditDeliveryCustomerPhone] = useState('');
  const [editDeliveryAddress, setEditDeliveryAddress] = useState('');
  const [editDeliveryCost, setEditDeliveryCost] = useState<number | ''>('');
  const [editMarkedDelivered, setEditMarkedDelivered] = useState(false);
  const [editUseStaffDriver, setEditUseStaffDriver] = useState<boolean>(true);
  const [editSelectedStaffId, setEditSelectedStaffId] = useState<string>('');
  const [editTempName, setEditTempName] = useState('');
  const [editTempPhone, setEditTempPhone] = useState('');
  const [editTempClassification, setEditTempClassification] = useState<'rider' | 'driver'>('rider');
  const [editTempVehicleType, setEditTempVehicleType] = useState<'motorcycle' | 'tuktuk' | 'car'>('motorcycle');
  const [editTempVehicleColor, setEditTempVehicleColor] = useState('');
  const [editTempLicensePlate, setEditTempLicensePlate] = useState('');
  const [isSavingDeliveryEdit, setIsSavingDeliveryEdit] = useState(false);
  const [deletingDelivery, setDeletingDelivery] = useState<Delivery | null>(null);
  const [isDeletingDelivery, setIsDeletingDelivery] = useState(false);

  const openEditDeliveryModal = (del: Delivery) => {
    setEditingDelivery(del);
    setEditDeliveryCustomerName(del.customerName || '');
    setEditDeliveryCustomerPhone(del.customerPhone || '');
    setEditDeliveryAddress(del.customerAddress || '');
    setEditDeliveryCost(typeof del.deliveryCost === 'number' ? del.deliveryCost : '');
    setEditMarkedDelivered(del.status === 'Delivered');

    const matchedStaff = del.riderId ? activeStaffDrivers.find(s => s.id === del.riderId) : undefined;
    if (matchedStaff) {
      setEditUseStaffDriver(true);
      setEditSelectedStaffId(matchedStaff.id);
    } else if (del.riderDetails) {
      // Assigned rider is either a temporary driver, or a former staff record no longer
      // present in the active list — keep their details visible/editable either way.
      setEditUseStaffDriver(false);
      setEditSelectedStaffId('');
    } else {
      setEditUseStaffDriver(true);
      setEditSelectedStaffId('');
    }
    setEditTempName(del.riderDetails?.name || '');
    setEditTempPhone(del.riderDetails?.phone || '');
    setEditTempClassification(del.riderDetails?.classification || 'rider');
    setEditTempVehicleType(del.riderDetails?.vehicleType || 'motorcycle');
    setEditTempVehicleColor(del.riderDetails?.vehicleColor || '');
    setEditTempLicensePlate(del.riderDetails?.licensePlate || '');
  };

  const handleSaveDeliveryEdit = async () => {
    if (!editingDelivery || !onEditDelivery || isSavingDeliveryEdit) return;

    let riderId: string | null = null;
    let riderDetails: Delivery['riderDetails'] | null = null;

    if (editUseStaffDriver) {
      if (editSelectedStaffId) {
        const staff = activeStaffDrivers.find(s => s.id === editSelectedStaffId);
        if (staff) {
          riderId = staff.id;
          riderDetails = {
            name: staff.name,
            phone: staff.phone,
            classification: staff.classification || 'rider',
            vehicleType: staff.vehicleType || 'motorcycle',
            vehicleColor: staff.vehicleColor || '',
            licensePlate: staff.licensePlate || '',
          };
        }
      }
    } else if (editTempName.trim() || editTempPhone.trim() || editTempLicensePlate.trim()) {
      if (!editTempName.trim() || !editTempPhone.trim() || !editTempLicensePlate.trim()) {
        alert('Please fill out all temporary driver details (name, phone, and registration code).');
        return;
      }
      riderDetails = {
        name: editTempName.trim(),
        phone: editTempPhone.trim(),
        classification: editTempClassification,
        vehicleType: editTempVehicleType,
        vehicleColor: editTempVehicleColor || 'Grey',
        licensePlate: editTempLicensePlate.trim().toUpperCase(),
      };
    }

    setIsSavingDeliveryEdit(true);

    if (editMarkedDelivered && editingDelivery.status !== 'Delivered') {
      const statusOk = await onUpdateDeliveryStatus(editingDelivery.id, 'Delivered');
      if (statusOk === false) {
        setIsSavingDeliveryEdit(false);
        return;
      }
    }

    const ok = await onEditDelivery(editingDelivery.id, {
      customerName: editDeliveryCustomerName.trim(),
      customerPhone: editDeliveryCustomerPhone.trim(),
      customerAddress: editDeliveryAddress.trim(),
      deliveryCost: editDeliveryCost === '' ? 0 : Number(editDeliveryCost),
      riderId,
      riderDetails,
    });
    setIsSavingDeliveryEdit(false);
    if (ok !== false) setEditingDelivery(null);
  };

  const handleConfirmDeleteDelivery = async () => {
    if (!deletingDelivery || !onDeleteDelivery) return;
    setIsDeletingDelivery(true);
    const ok = await onDeleteDelivery(deletingDelivery.id);
    setIsDeletingDelivery(false);
    if (ok) {
      setDeletingDelivery(null);
      if (viewingDelivery?.id === deletingDelivery.id) setViewingDelivery(null);
    }
  };

  const handleAddNoteItem = () => {
    if (!newItemDesc.trim()) return;
    const newId = (noteItems.length > 0 ? (Math.max(...noteItems.map(item => parseInt(item.id) || 0)) + 1).toString() : '1');
    setNoteItems([
      ...noteItems,
      {
        id: newId,
        description: newItemDesc.trim(),
        unit: newItemUnit.trim(),
        qty: newItemQty
      }
    ]);
    setNewItemDesc('');
    setNewItemUnit('PC');
    setNewItemQty(1);
  };

  const handleDeleteNoteItem = (id: string) => {
    setNoteItems(noteItems.filter(item => item.id !== id));
  };

  const handleLoadFromOrder = (del: Delivery) => {
    setNoteDeliveryToTitle(del.customerName);
    setNoteDeliveryToAddress(del.customerPhone ? `Phone: ${del.customerPhone}` : 'Custom delivery path');
    setNotePINo(del.id?.replace(/[^0-9]/g, '').slice(0, 6) || Math.floor(Math.random() * 900000 + 100000).toString());
    const mapped = del.items.map((item, idx) => ({
      id: (idx + 1).toString(),
      description: item.productName,
      unit: item.unit || item.baseUnit || item.sellUnit || 'PC',
      qty: item.qty
    }));
    setNoteItems(mapped);
  };

  const handlePrintNote = async () => {
    try {
      setDeliveryPdfStatus('Generating delivery note PDF...');
      await printPdfFromElement({
        elementId: 'delivery-note-print-area',
        fileName: `delivery-note-${notePINo || Date.now()}.pdf`,
        format: 'a4'
      });
      setDeliveryPdfStatus('PDF opened for printing.');
    } catch (err: any) {
      setDeliveryPdfStatus(err?.message || 'Could not prepare delivery note PDF.');
    } finally {
      setTimeout(() => setDeliveryPdfStatus(null), 4000);
    }
  };

  const handleFinishDeliveryNote = () => {
    // Validate mandatory fields
    if (!noteDeliveryToAddress.trim() || noteDeliveryToAddress === '123 Main Street, City') {
      alert('⚠️ Mandatory delivery location/address is missing or needs to be customized! Please provide the exact location address.');
      return;
    }
    if (!noteTransportType.trim()) {
      alert('⚠️ Type of transport is a mandatory field! Please select standard type of transport.');
      return;
    }
    if (!noteVehiclePlate.trim()) {
      alert('⚠️ Vehicle registration plate is a mandatory field! Please specify.');
      return;
    }
    if (!noteDeliveredByName.trim()) {
      alert('⚠️ Name of person delivering is a mandatory field! Please fill.');
      return;
    }

    // Process completion
    if (activeEditingPendingNoteId) {
      if (onUpdatePendingNotes) {
        // Remove it from draft as it's completed
        onUpdatePendingNotes(pendingNotes.filter(n => n.id !== activeEditingPendingNoteId));
      }
      setActiveEditingPendingNoteId(null);
    }

    alert('🎉 Success! Delivery Note completed successfully. Ready to Print!');
    
    // Auto trigger print
    handlePrintNote();
  };

  const currency = activeTenant.currency;
  const activeRiders = riders.filter(r => r.tenantId === activeTenant.id);
  // Persisted shop drivers/riders from the Staff module (branch-scoped upstream in systemSettings.staffs)
  const activeStaffDrivers: StaffSettings[] = (systemSettings?.staffs || []).filter(
    s => s.staffType === 'driver' || s.staffType === 'rider'
  );

  const filteredProductsForSelect = products.filter(p => {
    if (!productSearchTerm.trim()) return false;
    const term = productSearchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.barcode && p.barcode.toLowerCase().includes(term)) ||
      (p.sku && p.sku.toLowerCase().includes(term))
    );
  });

  const handleSelectProductFromSearch = (p: Product) => {
    const newId = (noteItems.length > 0 ? (Math.max(...noteItems.map(item => parseInt(item.id) || 0)) + 1).toString() : '1');
    setNoteItems([
      ...noteItems,
      {
        id: newId,
        description: p.name,
        unit: 'PC',
        qty: 1
      }
    ]);
    setProductSearchTerm('');
    setShowSearchResults(false);
  };

  // Pre-fill fields or trigger dispatch
  const handleOpenDispatch = (del: Delivery) => {
    setDispatchTarget(del);
    setSelectedRiderId(activeRiders[0]?.id || '');
    setDispatchPaymentMethod(del.deliveryPaymentMethod || '');
    // Reset temporary states
    setTempName('');
    setTempPhone('');
    setTempClassification('rider');
    setTempVehicleType('motorcycle');
    setTempVehicleColor('');
    setTempLicensePlate('');
  };

  const handleRegisterRiderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRiderName || !newRiderPhone || !newRiderLicensePlate) return;

    const newRider: DeliveryRider = {
      id: 'rd-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      name: newRiderName,
      phone: newRiderPhone,
      classification: newRiderClassification,
      vehicleType: newRiderVehicleType,
      vehicleColor: newRiderVehicleColor || 'Default',
      licensePlate: newRiderLicensePlate.toUpperCase(),
      tenantId: activeTenant.id,
      signatureImage: newRiderSignature || undefined
    };

    onAddRider(newRider);
    setRiderSuccessMessage(`Rider "${newRiderName}" has been successfully added to shop crew.`);
    
    // reset form fields
    setNewRiderName('');
    setNewRiderPhone('');
    setNewRiderClassification('rider');
    setNewRiderVehicleType('motorcycle');
    setNewRiderVehicleColor('');
    setNewRiderLicensePlate('');
    setNewRiderSignature('');

    setTimeout(() => {
      setRiderSuccessMessage('');
    }, 4000);
  };

  const handleExecuteDispatch = () => {
    if (!dispatchTarget) return;

    if (!dispatchTarget.deliveryPaymentMethod && !dispatchPaymentMethod) {
      alert('Please select a payment method for this delivery to ensure accurate accounting.');
      return;
    }

    let finalDetails: NonNullable<Delivery['riderDetails']>;
    let finalRiderId: string | undefined = undefined;

    if (useShopRider) {
      const selectedRider = activeRiders.find(r => r.id === selectedRiderId);
      if (!selectedRider) {
        alert('Please select or register a shop rider/driver first.');
        return;
      }
      finalDetails = {
        name: selectedRider.name,
        phone: selectedRider.phone,
        classification: selectedRider.classification,
        vehicleType: selectedRider.vehicleType,
        vehicleColor: selectedRider.vehicleColor,
        licensePlate: selectedRider.licensePlate
      };
      finalRiderId = selectedRider.id;
    } else {
      if (!tempName || !tempPhone || !tempLicensePlate) {
        alert('Please fill out all temporary driver details.');
        return;
      }
      finalDetails = {
        name: tempName,
        phone: tempPhone,
        classification: tempClassification,
        vehicleType: tempVehicleType,
        vehicleColor: tempVehicleColor || 'Grey',
        licensePlate: tempLicensePlate.toUpperCase()
      };
    }

    onDispatchDelivery(dispatchTarget.id, finalDetails, finalRiderId, {
      name: dispatchCustomerName,
      phone: dispatchCustomerPhone,
      location: dispatchCustomerLocation,
      paymentMethod: dispatchPaymentMethod
    });
    setDispatchTarget(null);
  };

  // Compose standard customer WhatsApp message template
  const generateWhatsAppMessage = (del: Delivery): string => {
    if (!del.riderDetails) return '';
    const itemsString = del.items
      .map(item => `${item.productName} — ${formatSaleItemQuantity(item)}`)
      .join('\n\n');

    const customerName = del.customerName || 'Customer';
    const dnNo = `#DN-${new Date(del.timestamp || Date.now()).getFullYear()}-${del.id.toUpperCase().replace('DLV-', '').replace('DLV_', '').slice(0, 6)}`;
    const formattedDate = new Date(del.timestamp || Date.now()).toLocaleDateString([], { dateStyle: 'medium' });
    const deliveryAddress = del.customerAddress || del.notes || 'Specified drop-off location';

    const driverName = del.riderDetails.name;
    const driverPhone = del.riderDetails.phone;

    const vehicleTypeLabel = del.riderDetails.vehicleType 
      ? del.riderDetails.vehicleType.charAt(0).toUpperCase() + del.riderDetails.vehicleType.slice(1) 
      : '';
    const vehicleColorLabel = del.riderDetails.vehicleColor || '';
    const plateSuffix = vehicleTypeLabel || vehicleColorLabel 
      ? ` (${vehicleColorLabel}${vehicleColorLabel && vehicleTypeLabel ? ' ' : ''}${vehicleTypeLabel})` 
      : '';
    const plateNumber = `${del.riderDetails.licensePlate || 'N/A'}${plateSuffix}`;

    return `Hello ${customerName},

Your order has been safely loaded and is officially en route to your location! 🚚✨

📄 *DELIVERY NOTE*

Delivery Note No: ${dnNo}

Date: ${formattedDate}

Customer: ${customerName}

Delivery Address: ${deliveryAddress}

*ITEMS BEING DELIVERED:*

${itemsString}

*Logistics & Driver Details:*

Driver Name: ${driverName}

Contact Number: ${driverPhone}

Vehicle Plate Number: ${plateNumber}

⚠️ Please inspect your items carefully and confirm everything is correct before the driver leaves. Thank you! 🙏`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const openWhatsAppLink = async (del: Delivery) => {
    const customerName = del.customerName || 'customer';
    const dnNo = `DN-${new Date(del.timestamp || Date.now()).getFullYear()}-${del.id.toUpperCase().replace('DLV-', '').replace('DLV_', '').slice(0, 6)}`;

    try {
      setDeliveryPdfStatus('Preparing delivery note PDF...');
      // The printable delivery note only exists in the DOM while the "Notes"
      // tab is active. "WhatsApp Note" is triggered from the Queue tab, so
      // without this the template was never mounted and every WhatsApp share
      // failed with "Document not found." flushSync commits the tab switch
      // and this delivery's data into the composer synchronously, so the PDF
      // capture below reads the correct, already-rendered note.
      flushSync(() => {
        handleLoadFromOrder(del);
        setActiveSubTab('notes');
      });
      await shareElementPdfToWhatsApp({
        elementId: 'delivery-note-print-area',
        fileName: `delivery-note-${dnNo}.pdf`,
        phone: del.customerPhone,
        message: `Hello ${customerName}, please find attached your delivery note PDF from ${getBusinessDisplayName(activeTenant, systemSettings)}. Thank you.`,
        format: 'a4'
      });
      setDeliveryPdfStatus('PDF ready for WhatsApp.');
    } catch (err: any) {
      setDeliveryPdfStatus(err?.message || 'Open the delivery note preview first so the PDF can be created.');
    } finally {
      setTimeout(() => setDeliveryPdfStatus(null), 4000);
    }
  };

  const filteredDeliveries = deliveries.filter(del => {
    const matchesSearch = 
      del.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      del.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (del.customerPhone && del.customerPhone.includes(searchTerm));
    return matchesSearch;
  });

  const pendingDeliveries = deliveries.filter(del => del.status === 'Pending Dispatch').length;
  const dispatchedDeliveries = deliveries.filter(del => del.status === 'Dispatched').length;
  const deliveredDeliveries = deliveries.filter(del => del.status === 'Delivered').length;
  const deliveryIncomeTotal = deliveries.reduce((sum, del) => sum + (del.deliveryCost || 0), 0);
  const deliveryStats = [
    { label: 'Pending', value: pendingDeliveries, icon: Clock, tone: 'text-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200', iconTone: 'bg-amber-100 text-amber-700' },
    { label: 'On route', value: dispatchedDeliveries, icon: Bike, tone: 'text-sky-800 bg-gradient-to-br from-sky-50 to-indigo-50 border-sky-200', iconTone: 'bg-sky-100 text-sky-700' },
    { label: 'Delivered', value: deliveredDeliveries, icon: CheckCircle, tone: 'text-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200', iconTone: 'bg-emerald-100 text-emerald-700' },
    { label: 'Revenue', value: `${currency}${Math.round(deliveryIncomeTotal).toLocaleString()}`, icon: Printer, tone: 'text-white bg-gradient-to-br from-emerald-600 to-emerald-800 border-emerald-700', iconTone: 'bg-white/20 text-white' }
  ];

  return (
    <div className="space-y-3 sm:space-y-4 xl:space-y-5 pb-24 md:pb-8">
      {/* Tab Header Section */}
      <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
        <div className="p-3.5 sm:p-4 lg:p-5 xl:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 xl:gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                <DeliveryMotorcycleIcon className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight font-sans leading-tight">
                  Delivery Operations
                </h3>
                <p className="text-[11px] sm:text-sm text-slate-500 font-sans max-w-2xl mt-0.5 sm:mt-1 leading-snug sm:leading-relaxed">
                  Dispatch orders, manage delivery notes, track riders, and reconcile logistics payments.
                </p>
              </div>
            </div>
          </div>

          <div className="mobile-tablet-kpi-grid grid grid-cols-2 gap-1.5 sm:gap-2.5 w-full xl:grid-cols-4 xl:w-auto xl:min-w-[520px]">
            {deliveryStats.map((stat) => {
              const StatIcon = stat.icon;
              return (
                <div key={stat.label} className={`relative min-w-0 overflow-hidden rounded-2xl border px-3 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.08)] ${stat.tone}`} title={`${stat.label}: ${stat.value}`}>
                  <div className="relative flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block truncate text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-current/65 font-mono">{stat.label}</span>
                      <span className="block mt-1.5 text-base sm:text-lg font-black font-mono tracking-tight leading-none whitespace-nowrap">{stat.value}</span>
                    </div>
                    <span className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${stat.iconTone}`}>
                      <StatIcon className="w-4 h-4" />
                    </span>
                  </div>
                  <span className="absolute -right-5 -bottom-7 h-16 w-16 rounded-full bg-current opacity-[0.035]" aria-hidden="true" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop sub-tab navigation */}
        <div className="hidden xl:flex bg-slate-50 border-t border-slate-200 p-2 gap-2 overflow-x-auto">
          <button
            onClick={() => handleSubTabChange('queue')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all select-none cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'queue'
                ? 'bg-white text-emerald-700 font-black shadow-sm border border-slate-200'
                : 'text-slate-655 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>Dispatch Jobs ({deliveries.length})</span>
          </button>
          <button
            onClick={() => handleSubTabChange('riders')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all select-none cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'riders'
                ? 'bg-white text-emerald-700 font-black shadow-sm border border-slate-200'
                : 'text-slate-655 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Shop Rider Crew ({activeRiders.length})</span>
          </button>
          <button
            onClick={() => handleSubTabChange('notes')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all select-none cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'notes'
                ? 'bg-white text-emerald-700 font-black shadow-sm border border-slate-200'
                : 'text-slate-655 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Create Delivery Note</span>
          </button>
          <button
            onClick={() => handleSubTabChange('accounting')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all select-none cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'accounting'
                ? 'bg-white text-emerald-700 font-black shadow-sm border border-slate-200'
                : 'text-slate-655 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Delivery Accounting</span>
          </button>
        </div>

        {/* Mobile native-style section switcher */}
        <div className="xl:hidden border-t border-slate-200 bg-slate-100/80 px-2.5 sm:px-3 py-2.5 sm:py-3">
          <div className="flex flex-nowrap items-stretch gap-1 p-1 rounded-2xl bg-white border border-slate-200 shadow-inner">
            {[
              { id: 'queue' as const, label: 'Jobs', icon: Clipboard },
              { id: 'riders' as const, label: 'Crew', icon: UserCheck },
              { id: 'notes' as const, label: 'Notes', icon: FileText },
              { id: 'accounting' as const, label: 'Report', icon: Printer }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSubTabChange(tab.id)}
                  className={`basis-0 flex-1 min-w-0 min-h-[44px] sm:min-h-[48px] rounded-xl border flex flex-row items-center justify-center gap-1.5 text-[10px] font-black transition-all ${
                    isActive
                      ? 'bg-gradient-to-br from-emerald-600 to-emerald-800 text-white border-emerald-700 shadow-md'
                      : 'bg-transparent text-slate-500 border-transparent active:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-300' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeSubTab === 'queue' && (
        <div className="space-y-3 sm:space-y-4 xl:space-y-5">
          {/* Quick Filters */}
          <div className="bg-white border border-slate-200 p-2.5 sm:p-3 xl:p-4 rounded-2xl md:rounded-3xl flex flex-row gap-2 sm:gap-3 shadow-xs md:sticky md:top-0 md:z-10">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Search deliveries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full min-h-[48px] sm:min-h-0 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-xs pl-10 sm:pl-11 pr-3 sm:pr-4 py-2.5 text-slate-800 placeholder-slate-400 font-sans focus:outline-none focus:border-emerald-500"
              />
              <Search className="absolute left-3.5 sm:left-4 top-4 sm:top-3 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <button 
              onClick={() => setIsAddDeliveryModalOpen(true)}
              className="h-12 w-12 sm:h-auto sm:w-auto sm:px-5 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-xs rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 flex flex-row items-center justify-center shrink-0 cursor-pointer"
              aria-label="Create new delivery"
            >
              <Plus className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">New Delivery</span>
            </button>
          </div>

          {/* Delivery Jobs Compact List */}
          <div className="bg-transparent border-0 shadow-none overflow-visible xl:bg-white xl:border xl:border-slate-200 xl:rounded-3xl xl:shadow-sm xl:overflow-hidden">
            {filteredDeliveries.length === 0 ? (
              <div className="text-center py-16 text-sm font-mono text-slate-500">
                <Truck className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                <p>No custom delivery dispatch queues recorded for this branch yet.</p>
              </div>
            ) : (
              <div className="space-y-2.5 xl:space-y-0 xl:divide-y xl:divide-slate-100">
                {filteredDeliveries.map(del => {
                  const isPending = del.status === 'Pending Dispatch';
                  const isDispatched = del.status === 'Dispatched';
                  const isDelivered = del.status === 'Delivered';
                  const isCancelled = del.status === 'Cancelled';
                  const isActionOpen = openQueueActionId === del.id;
                  const whenDate = new Date(del.dispatchedAt || del.timestamp);

                  return (
                    <div
                      key={del.id}
                      className={`relative grid grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[9rem_minmax(0,1fr)_7rem_8rem_2.25rem] items-start xl:items-center gap-x-3 xl:gap-x-4 gap-y-1 xl:gap-y-2 pl-4 pr-2.5 sm:pr-3 xl:px-5 py-2 xl:py-1.5 transition-colors rounded-2xl xl:rounded-none border xl:border-0 shadow-[0_2px_12px_rgba(15,23,42,0.06)] xl:shadow-none ${
                        isDelivered ? 'bg-slate-50/80 border-slate-200' : isCancelled ? 'bg-red-50/40 border-red-100 opacity-75' : 'bg-white border-slate-100 hover:bg-slate-50/70'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full xl:hidden ${
                          isPending
                            ? 'bg-amber-400'
                            : isDispatched
                              ? 'bg-sky-500'
                              : isDelivered
                                ? 'bg-emerald-500'
                                : 'bg-rose-500'
                        }`}
                      />
                      {/* Order ref + status */}
                      <div className="min-w-0 col-start-1 row-start-1 xl:col-start-1 xl:row-start-1">
                        <button
                          onClick={() => setViewingDelivery(del)}
                          className="text-[10px] font-bold text-slate-400 block font-mono truncate hover:text-emerald-600 cursor-pointer text-left"
                          title="View delivery details"
                        >
                          {del.saleId}
                        </button>
                        <span className={`inline-flex mt-0.5 px-2 py-0.5 rounded-lg text-[9px] font-bold tracking-wider uppercase font-sans ${
                          isPending
                            ? 'bg-amber-105 text-amber-700 border border-amber-200'
                            : isDispatched
                              ? 'bg-sky-105 text-sky-700 border border-sky-200'
                              : isDelivered
                                ? 'bg-emerald-105 text-emerald-700 border border-emerald-200'
                                : 'bg-red-105 text-red-700 border border-red-200'
                        }`}>
                          {del.status}
                        </span>
                      </div>

                      {/* Destination / customer */}
                      <div className="min-w-0 col-span-2 row-start-2 xl:col-span-1 xl:col-start-2 xl:row-start-1">
                        <p className="hidden xl:block text-[8px] font-black text-slate-400 uppercase tracking-widest font-mono">Delivered To</p>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <p className="font-extrabold text-[13px] sm:text-sm text-slate-900 break-words leading-tight">{del.customerName || 'Walk-In Customer'}</p>
                          {del.customerPhone && (
                            <p className="hidden xl:block text-[11px] text-slate-500 font-mono break-all">{del.customerPhone}</p>
                          )}
                        </div>
                        <p className="text-[10.5px] text-slate-500 leading-tight truncate xl:whitespace-normal xl:break-words">
                          <span className="hidden xl:inline font-semibold text-slate-600">{activeBranchName || activeTenant.name}</span>
                          <span className="mx-1.5 text-slate-300" aria-hidden="true">•</span>
                          {del.customerAddress || del.notes || 'Destination address not provided'}
                        </p>
                      </div>

                      {/* Delivery fee */}
                      <div className="min-w-0 col-start-1 row-start-3 xl:col-start-3 xl:row-start-1">
                        <span className="font-bold font-mono text-sky-600 text-xs xl:text-sm">{currency}{Math.round(del.deliveryCost || 0).toLocaleString()}</span>
                      </div>

                      {/* Date & time */}
                      <div className="min-w-0 col-start-2 row-start-3 text-right xl:text-left xl:col-start-4 xl:row-start-1">
                        <span className="text-[10px] xl:text-xs font-semibold text-slate-600 xl:text-slate-700 xl:block">{whenDate.toLocaleDateString()}</span>
                        <span className="hidden xl:inline text-[10.5px] text-slate-400 font-mono">{whenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      {/* Action menu */}
                      <div className="relative col-start-2 row-start-1 xl:col-start-5 xl:row-start-1 justify-self-end">
                        <button
                          onClick={() => setOpenQueueActionId(isActionOpen ? null : del.id)}
                          className="h-10 w-10 xl:h-8 xl:w-8 -mr-1 xl:mr-0 rounded-xl hover:bg-slate-200/70 text-slate-500 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {isActionOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenQueueActionId(null)} />
                            <div className="absolute right-0 top-10 w-44 bg-white shadow-xl rounded-2xl border border-slate-200 py-1.5 z-50 animate-fade-in origin-top-right text-left text-xs font-bold text-slate-700 flex flex-col">
                              <button
                                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                onClick={() => { setOpenQueueActionId(null); setViewingDelivery(del); }}
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-400" />
                                View Delivery
                              </button>
                              <button
                                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                onClick={() => { setOpenQueueActionId(null); openEditDeliveryModal(del); }}
                              >
                                <Edit className="w-3.5 h-3.5 text-blue-400" />
                                Edit Delivery
                              </button>
                              <button
                                className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-600 flex items-center gap-2 cursor-pointer"
                                onClick={() => { setOpenQueueActionId(null); setDeletingDelivery(del); }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete Delivery
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW DELIVERY MODAL — full details, moved from the old expanded card */}
      {viewingDelivery && (() => {
        const del = deliveries.find(d => d.id === viewingDelivery.id) || viewingDelivery;
        const isPending = del.status === 'Pending Dispatch';
        const isDispatched = del.status === 'Dispatched';
        const isDelivered = del.status === 'Delivered';
        const isCancelled = del.status === 'Cancelled';
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setViewingDelivery(null)}
          >
            <div
              className="bg-white border rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-md overflow-y-auto flex flex-col relative animate-scale-up max-h-[92vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setViewingDelivery(null)}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-4 sm:p-5">
                {/* Header badge status */}
                <div className="flex justify-between items-start gap-3 pb-3 border-b border-slate-100 pr-8">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 block font-mono">ORDER REF: {del.saleId}</span>
                    <h4 className="font-extrabold text-base sm:text-sm text-slate-900 tracking-tight mt-0.5 truncate">{del.customerName}</h4>
                    {del.customerPhone && (
                      <span className="text-[11px] font-mono text-slate-500 flex items-center mt-0.5">
                        <Smartphone className="w-3 h-3 text-slate-400 mr-1 shrink-0" />
                        {del.customerPhone}
                      </span>
                    )}
                    {del.customerAddress && (
                      <span className="text-[11px] text-slate-500 flex items-start mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 mr-1 mt-0.5 shrink-0" />
                        <span className="break-words">{del.customerAddress}</span>
                      </span>
                    )}
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[9.5px] font-bold tracking-wider uppercase font-sans shrink-0 ${
                    isPending
                      ? 'bg-amber-105 text-amber-700 border border-amber-200'
                      : isDispatched
                        ? 'bg-sky-105 text-sky-700 border border-sky-200 animate-pulse'
                        : isDelivered
                          ? 'bg-emerald-105 text-emerald-700 border border-emerald-200'
                          : 'bg-red-105 text-red-700 border border-red-200'
                  }`}>
                    {del.status}
                  </span>
                </div>

                {/* Basket items list */}
                <div className="py-3.5 space-y-1.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono block">Delivery Cargo</span>
                  <div className="max-h-[160px] overflow-y-auto space-y-1.1 scrollbar-thin">
                    {del.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-slate-600">
                        <span className="font-medium truncate max-w-[70%]">{item.productName}</span>
                        <span className="font-bold font-mono text-slate-800 shrink-0 select-none">{formatSaleItemQuantity(item)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Fees */}
                  <div className="pt-2 border-t border-slate-50 flex justify-between items-center text-xs">
                    <span className="text-slate-500">Delivery Charge Paid:</span>
                    <span className="font-bold font-mono text-sky-600">{currency}{Math.round(del.deliveryCost || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Driver details assigned block */}
                {del.riderDetails ? (
                  <div className="bg-slate-100/70 border border-slate-200 rounded-2xl p-3 space-y-1.5 mb-4 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-700">
                      <span className="uppercase text-[9px] text-slate-400 font-mono tracking-wider">Assigned Delivery Courier</span>
                      <span className="capitalize text-[10px] text-emerald-600 border border-emerald-200 bg-white rounded px-1">{del.riderDetails.classification}</span>
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-black text-slate-800 text-xs">{del.riderDetails.name}</p>
                      <p className="font-mono text-[10.5px] text-slate-500">{del.riderDetails.phone}</p>
                      <p className="text-[10.5px] text-slate-600 font-sans mt-0.5">
                        Vehicle: <span className="font-semibold capitalize text-slate-800">{del.riderDetails.vehicleColor} {del.riderDetails.vehicleType}</span> ({del.riderDetails.licensePlate})
                      </p>
                    </div>

                    {/* Notify action on dispatcher tool */}
                    <div className="pt-2 border-t border-slate-200 flex space-x-2">
                      <button
                        onClick={() => setWhatsAppTarget(del)}
                        className="flex-grow bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 sm:py-1.5 px-2 rounded-xl sm:rounded-lg text-[11px] sm:text-[10.5px] transition-all cursor-pointer flex items-center justify-center space-x-1 min-h-[42px] sm:min-h-0"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp Note</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50/50 border border-dashed border-amber-200 rounded-2xl p-3.5 text-center text-xs text-amber-800 mb-4 font-sans leading-relaxed">
                    <AlertCircle className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                    Awaiting carrier dispatch assignment.
                  </div>
                )}

                {/* Operational controls */}
                <div className="flex space-x-2 border-t border-slate-100 pt-3">
                  {isPending && (
                    <button
                      onClick={() => { setViewingDelivery(null); handleOpenDispatch(del); }}
                      className="w-full bg-slate-900 hover:bg-slate-850 text-white font-bold py-3 sm:py-2 px-3 rounded-2xl sm:rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer flex items-center justify-center space-x-1 min-h-[48px] sm:min-h-0"
                    >
                      <Navigation className="w-3.5 h-3.5 text-sky-400" />
                      <span>Dispatch Order</span>
                    </button>
                  )}

                  {isDispatched && (
                    <>
                      <button
                        onClick={() => onUpdateDeliveryStatus(del.id, 'Delivered')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 sm:py-2 px-3 rounded-2xl sm:rounded-xl text-xs flex-grow uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1 min-h-[48px] sm:min-h-0"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Mark Delivered</span>
                      </button>
                      <button
                        onClick={() => onUpdateDeliveryStatus(del.id, 'Cancelled')}
                        className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-red-600 font-bold py-3 sm:py-2 px-3 rounded-2xl sm:rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center min-h-[48px] sm:min-h-0"
                        title="Cancel Delivery Order"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {(isDelivered || isCancelled) && (
                    <div className="w-full text-center text-[10.5px] text-slate-400 font-mono py-1">
                      Completed on {new Date(del.dispatchedAt || del.timestamp).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EDIT DELIVERY MODAL */}
      {editingDelivery && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setEditingDelivery(null)}
        >
          <div
            className="bg-white border rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col relative animate-scale-up max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h4 className="font-extrabold text-sm text-slate-900">Edit Delivery</h4>
              <button onClick={() => setEditingDelivery(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-5 overflow-y-auto">
              {/* Row 1: Recipient Name + Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Customer Name</label>
                  <input
                    type="text"
                    placeholder="Recipient name"
                    value={editDeliveryCustomerName}
                    onChange={(e) => setEditDeliveryCustomerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl text-sm px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+255..."
                    value={editDeliveryCustomerPhone}
                    onChange={(e) => setEditDeliveryCustomerPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl text-sm px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 2: Delivery Address + Delivery Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Delivery Address</label>
                  <textarea
                    placeholder="Drop-off location..."
                    value={editDeliveryAddress}
                    onChange={(e) => setEditDeliveryAddress(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl text-sm px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 resize-none min-h-[46px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Delivery Amount</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={editDeliveryCost}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setEditDeliveryCost(raw === '' ? '' : Math.max(0, Number(raw)));
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl text-sm px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Driver / Rider Selection */}
              <div className="space-y-2.5 p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">Driver / Rider</label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditUseStaffDriver(true)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer min-h-[38px] ${
                      editUseStaffDriver
                        ? 'bg-slate-900 text-white font-black shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/50'
                    }`}
                  >
                    In-House / Shop Driver
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditUseStaffDriver(false)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer min-h-[38px] ${
                      !editUseStaffDriver
                        ? 'bg-slate-900 text-white font-black shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/50'
                    }`}
                  >
                    Temporary / External Driver
                  </button>
                </div>

                {editUseStaffDriver ? (
                  activeStaffDrivers.length === 0 ? (
                    <div className="p-4 text-center border border-dashed rounded-2xl text-xs text-amber-800 bg-amber-50/60">
                      No drivers/riders registered in Staff yet for {activeTenant.name}. Register one under Staff, or switch to "Temporary / External Driver" above.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-0.5">
                      {activeStaffDrivers.map(staff => (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => setEditSelectedStaffId(staff.id)}
                          className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                            editSelectedStaffId === staff.id
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-400'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-extrabold text-xs text-slate-900 truncate">{staff.name}</p>
                            <p className="text-[10.5px] font-mono text-slate-500 mt-0.5">{staff.phone}</p>
                            {(staff.vehicleType || staff.licensePlate) && (
                              <p className="text-[10.5px] text-slate-500 mt-1 uppercase tracking-wider font-mono">
                                {staff.vehicleColor} {staff.vehicleType} {staff.licensePlate ? `(${staff.licensePlate})` : ''}
                              </p>
                            )}
                          </div>
                          {staff.classification && (
                            <span className="shrink-0 text-[9px] font-bold border border-emerald-200 bg-white text-emerald-700 px-2 py-0.5 rounded uppercase">
                              {staff.classification}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Driver Name</label>
                        <input
                          type="text"
                          placeholder="Driver name"
                          value={editTempName}
                          onChange={(e) => setEditTempName(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 text-xs font-bold text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Phone Number</label>
                        <input
                          type="tel"
                          placeholder="+255..."
                          value={editTempPhone}
                          onChange={(e) => setEditTempPhone(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 text-xs font-mono text-slate-800"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Classification</label>
                        <select
                          value={editTempClassification}
                          onChange={(e) => setEditTempClassification(e.target.value as any)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 cursor-pointer text-xs text-slate-800 font-bold"
                        >
                          <option value="rider">Rider (Motorcycle/Tuktuk)</option>
                          <option value="driver">Driver (Car/Van)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Vehicle Type</label>
                        <select
                          value={editTempVehicleType}
                          onChange={(e) => setEditTempVehicleType(e.target.value as any)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 cursor-pointer text-xs text-slate-800 font-bold"
                        >
                          <option value="motorcycle">Motorcycle</option>
                          <option value="tuktuk">Tuktuk</option>
                          <option value="car">Car / Van</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Vehicle Color</label>
                        <input
                          type="text"
                          placeholder="e.g. Silver"
                          value={editTempVehicleColor}
                          onChange={(e) => setEditTempVehicleColor(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 text-xs text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Registration / Plate</label>
                        <input
                          type="text"
                          placeholder="e.g. T123 ABC"
                          value={editTempLicensePlate}
                          onChange={(e) => setEditTempLicensePlate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 text-xs uppercase text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editMarkedDelivered}
                  onChange={(e) => setEditMarkedDelivered(e.target.checked)}
                  className="sr-only"
                />
                <span className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${editMarkedDelivered ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-slate-400'}`}>
                  {editMarkedDelivered && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Delivered</span>
              </label>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
              <button
                onClick={() => setEditingDelivery(null)}
                disabled={isSavingDeliveryEdit}
                className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDeliveryEdit}
                disabled={isSavingDeliveryEdit}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer min-h-[44px]"
              >
                {isSavingDeliveryEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE DELIVERY CONFIRMATION */}
      {deletingDelivery && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
          onClick={() => !isDeletingDelivery && setDeletingDelivery(null)}
        >
          <div
            className="bg-white border rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-sm p-5 flex flex-col relative animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-900">Delete this delivery?</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Order {deletingDelivery.saleId} for {deletingDelivery.customerName || 'this customer'} will be permanently removed.
              {deletingDelivery.treasuryJournalId && ' Any delivery income already collected for it will be reversed from Money & Bank.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingDelivery(null)}
                disabled={isDeletingDelivery}
                className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteDelivery}
                disabled={isDeletingDelivery}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer"
              >
                {isDeletingDelivery ? 'Deleting...' : 'Delete Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'riders' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 xl:gap-6">
          {/* New Rider Registration Panel */}
          <div className="bg-white border border-slate-200 p-3 sm:p-4 rounded-2xl space-y-3 shadow-sm height-fit self-start">
            <div>
              <h4 className="font-extrabold text-slate-900 tracking-tight text-sm flex items-center space-x-2">
                <UserPlus className="w-[18px] h-[18px] text-emerald-600" />
                <span>Register Store Driver / Rider</span>
              </h4>
            </div>

            {riderSuccessMessage && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl py-2.5 px-4 text-[11px] text-emerald-800 animate-pulse font-medium">
                {riderSuccessMessage}
              </div>
            )}

            <form onSubmit={handleRegisterRiderSubmit} className="space-y-2.5 text-[11px] text-slate-700">
              <div className="mobile-tablet-kpi-grid grid grid-cols-2 gap-2">
              <div className="space-y-1 min-w-0">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="John Mwangi"
                  value={newRiderName}
                  onChange={(e) => setNewRiderName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:border-emerald-500 font-sans text-[11px] text-slate-800 placeholder:text-[10px] placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1 min-w-0">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block">Phone</label>
                <input
                  type="text"
                  required
                  placeholder="+234 802 123 4567"
                  value={newRiderPhone}
                  onChange={(e) => setNewRiderPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:border-emerald-500 font-mono text-[10px] text-slate-800 placeholder:text-[9px] placeholder:text-slate-400"
                />
              </div>
              </div>

              <div className="mobile-tablet-kpi-grid grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block">Role</label>
                  <select
                    value={newRiderClassification}
                    onChange={(e) => setNewRiderClassification(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 cursor-pointer font-sans text-[9px] text-slate-700"
                  >
                    <option value="rider">Rider (Motorcycle/Tuktuk)</option>
                    <option value="driver">Driver (Car/Truck)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block">Vehicle</label>
                  <select
                    value={newRiderVehicleType}
                    onChange={(e) => setNewRiderVehicleType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 cursor-pointer font-sans text-[9px] text-slate-700"
                  >
                    <option value="motorcycle">Motorcycle</option>
                    <option value="tuktuk">Tuktuk</option>
                    <option value="car">Car / Delivery Van</option>
                  </select>
                </div>
              </div>

              <div className="mobile-tablet-kpi-grid grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block">Color</label>
                  <input
                    type="text"
                    placeholder="Yellow / Red"
                    value={newRiderVehicleColor}
                    onChange={(e) => setNewRiderVehicleColor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:border-emerald-500 font-sans text-[11px] text-slate-800 placeholder:text-[10px] placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block">Plate No.</label>
                  <input
                    type="text"
                    required
                    placeholder="KMRD 420A"
                    value={newRiderLicensePlate}
                    onChange={(e) => setNewRiderLicensePlate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:border-emerald-500 font-mono text-[10px] text-slate-800 uppercase placeholder:text-[9px] placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block">
                  Signature PNG
                </label>
                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
                  <input
                    type="file"
                    accept="image/png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          if (event.target?.result) {
                            setNewRiderSignature(event.target.result as string);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="block w-full text-[9px] text-slate-500
                      file:mr-2 file:py-1 file:px-2
                      file:rounded-lg file:border-0
                      file:text-[9px] file:font-bold
                      file:bg-emerald-50 file:text-emerald-700
                      hover:file:bg-emerald-100 cursor-pointer"
                  />
                  {newRiderSignature && (
                    <img
                      src={newRiderSignature}
                      alt="Signature preview"
                      className="w-10 h-10 object-contain border border-slate-200 bg-white rounded-lg p-0.5"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-[11px] transition-all cursor-pointer flex items-center justify-center space-x-1.5 select-none shadow-sm min-h-[42px]"
              >
                <Plus className="w-[18px] h-[18px]" />
                <span>Save In-house Rider</span>
              </button>
            </form>
          </div>

          {/* Registered Crew List */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm p-3.5 sm:p-5 overflow-hidden">
            <h4 className="font-extrabold text-slate-900 tracking-tight text-sm pb-3 border-b border-slate-100 flex items-center space-x-2">
              <UserCheck className="w-[18px] h-[18px] text-emerald-600" />
              <span>Registered Branch Logistics Crew</span>
            </h4>

            {activeRiders.length === 0 ? (
              <div className="text-center py-20 font-mono text-xs text-slate-400">
                No permanent riders registered. Fill out the helper registry form on the left.
              </div>
            ) : (
              <>
                <div className="hidden xl:block overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs text-slate-700">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 tracking-widest font-mono border-b border-slate-200">
                      <th className="py-3 px-4">CREW MEMBER</th>
                      <th className="py-3 px-4">VEHICLE CLASSIFICATION</th>
                      <th className="py-3 px-4">VEHICLE DETAILS</th>
                      <th className="py-3 px-4">LICENSE PLATE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {activeRiders.map((crew) => (
                      <tr key={crew.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4.5 px-4 font-semibold">
                          <p className="text-slate-800 font-bold">{crew.name}</p>
                          <p className="text-slate-500 text-[10.5px] font-mono mt-0.5">{crew.phone}</p>
                        </td>
                        <td className="py-4.5 px-4 capitalize">
                          <span className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase tracking-wider ${
                            crew.classification === 'driver' 
                              ? 'bg-blue-50 text-blue-750 border border-blue-200' 
                              : 'bg-indigo-50 text-indigo-750 border border-indigo-200'
                          }`}>
                            {crew.classification}
                          </span>
                        </td>
                        <td className="py-4.5 px-4 capitalize">
                          <span className="font-mono text-slate-705 font-medium">{crew.vehicleColor} {crew.vehicleType}</span>
                        </td>
                        <td className="py-4.5 px-4 font-mono font-bold text-slate-800">
                          {crew.licensePlate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
                <div className="xl:hidden mt-3 space-y-2.5">
                {activeRiders.map((crew) => (
                  <div key={crew.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 truncate">{crew.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono mt-1">{crew.phone}</p>
                      </div>
                      <span className={`shrink-0 px-2.5 py-1 text-[10px] rounded-full font-black uppercase tracking-wider ${
                        crew.classification === 'driver'
                          ? 'bg-blue-50 text-blue-750 border border-blue-200'
                          : 'bg-indigo-50 text-indigo-750 border border-indigo-200'
                      }`}>
                        {crew.classification}
                      </span>
                    </div>
                    <div className="mobile-tablet-kpi-grid grid grid-cols-2 gap-2 mt-2.5">
                      <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Vehicle</span>
                        <span className="block mt-1 text-xs font-bold text-slate-800 capitalize">{crew.vehicleColor} {crew.vehicleType}</span>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Plate</span>
                        <span className="block mt-1 text-xs font-black text-slate-900 font-mono">{crew.licensePlate}</span>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'notes' && (
        <div className="space-y-3 sm:space-y-4 select-text">
          {/* Active Editing Draft Mode Banner */}
          {activeEditingPendingNoteId && (
            <div className="bg-emerald-700 text-white p-3 sm:p-4 rounded-2xl space-y-1.5 text-xs shadow-sm">
              <p className="font-extrabold flex items-center gap-1.5 text-sm">
                <span>⚡ Resolve / Editing Pending Draft Mode Active</span>
              </p>
              <p className="text-emerald-100 text-[11px]">
                You are currently editing a template populated from a pending POS sale dispatch. Complete and save the note below to clear this draft.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveEditingPendingNoteId(null);
                  setNotePINo(`PI-${Math.floor(10000 + Math.random() * 90000)}`);
                  setNoteLPO(`LP-${Math.floor(100 + Math.random() * 900)}`);
                  setNoteDate(getTodayFormatted());
                  setNoteDeliveryToTitle('Doe Company');
                  setNoteDeliveryToAddress('123 Main Street, City');
                  setNoteTransportType('');
                  setNoteVehiclePlate('');
                  setNoteDeliveredByName('');
                  setNoteDeliveredBySignature('');
                }}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold px-3 py-2 rounded-xl text-[10px] cursor-pointer transition-all border border-emerald-600"
              >
                Cancel Editing Draft (Reset Form)
              </button>
            </div>
          )}

          {/* Pending Delivery Drafts Section */}
          {pendingNotes && pendingNotes.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200 p-3 sm:p-4 rounded-2xl space-y-3 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="text-[10px] bg-amber-100 text-amber-800 uppercase px-2 py-0.5 rounded font-black font-mono tracking-wider">
                    ⏳ pending delivery note templates
                  </span>
                  <h4 className="font-extrabold text-slate-800 text-sm tracking-tight flex items-center gap-1.5">
                    <DeliveryMotorcycleIcon className="w-4 h-4 text-amber-600" />
                    <span>Incomplete / Pending Delivery Notes</span>
                  </h4>
                </div>
                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full">
                  {pendingNotes.length} Pending
                </span>
              </div>

              <div className="hidden xl:block overflow-x-auto rounded-2xl border border-amber-200/60 bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-55 text-slate-500 border-b border-amber-150 text-[10px] tracking-wider uppercase font-extrabold font-mono">
                      <th className="py-2.5 px-4">Ref Sale No</th>
                      <th className="py-2.5 px-4">Client/Recipient</th>
                      <th className="py-2.5 px-4">Item Count</th>
                      <th className="py-2.5 px-3">Date Sent</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100/40 text-slate-705">
                    {pendingNotes.map((note) => (
                      <tr 
                        key={note.id} 
                        className={`hover:bg-amber-50/20 transition-all ${
                          activeEditingPendingNoteId === note.id ? 'bg-emerald-50/50' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {note.saleId || 'No Info'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-slate-900">{note.customerName}</div>
                          <div className="text-[10.5px] text-slate-500">{note.customerPhone || 'No Phone'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-500">
                          {note.items.length} lines
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500 text-[10.5px]">
                          {note.date}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                // Load this pending note into form states
                                setActiveEditingPendingNoteId(note.id);
                                setNotePINo(note.piNo || `PI-${Math.floor(10000 + Math.random() * 90000)}`);
                                setNoteLPO(note.lpoNo || `LP-${Math.floor(100 + Math.random() * 900)}`);
                                setNoteDate(note.date || getTodayFormatted());
                                setNoteDeliveryToTitle(note.customerName);
                                setNoteDeliveryToAddress(note.deliveryLocation || note.customerAddress || 'Enter direction location');
                                setNoteItems(note.items);
                                setNoteTransportType(note.transportType || '');
                                setNoteVehiclePlate(note.registrationPlate || '');
                                setNoteDeliveredByName(note.deliveredByName || '');
                                if (note.deliveredByName) {
                                  setNoteDeliveredBySignature(note.deliveredByName.split(' ')[0] + '.');
                                } else {
                                  setNoteDeliveredBySignature('');
                                }
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-lg text-[10.5px] transition-all cursor-pointer flex items-center gap-1 shadow-sm border-none"
                            >
                              <span>✏️ Resolve / Edit Draft</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (onUpdatePendingNotes) {
                                  onUpdatePendingNotes(pendingNotes.filter(n => n.id !== note.id));
                                }
                                if (activeEditingPendingNoteId === note.id) {
                                  setActiveEditingPendingNoteId(null);
                                }
                              }}
                              className="text-rose-600 hover:bg-rose-55 hover:text-rose-700 p-1.5 rounded-lg transition-all cursor-pointer bg-transparent border-none"
                              title="Delete Draft"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="xl:hidden space-y-3">
                {pendingNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`rounded-2xl border bg-white p-3 shadow-sm ${
                      activeEditingPendingNoteId === note.id ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest font-mono">
                          {note.saleId || 'No Info'}
                        </span>
                        <p className="mt-1 font-black text-slate-900 truncate">{note.customerName}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{note.customerPhone || 'No Phone'}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-black text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
                        {note.items.length} lines
                      </span>
                    </div>
                    <div className="mt-3 text-[11px] font-mono text-slate-500">
                      Sent {note.date}
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveEditingPendingNoteId(note.id);
                          setNotePINo(note.piNo || `PI-${Math.floor(10000 + Math.random() * 90000)}`);
                          setNoteLPO(note.lpoNo || `LP-${Math.floor(100 + Math.random() * 900)}`);
                          setNoteDate(note.date || getTodayFormatted());
                          setNoteDeliveryToTitle(note.customerName);
                          setNoteDeliveryToAddress(note.deliveryLocation || note.customerAddress || 'Enter direction location');
                          setNoteItems(note.items);
                          setNoteTransportType(note.transportType || '');
                          setNoteVehiclePlate(note.registrationPlate || '');
                          setNoteDeliveredByName(note.deliveredByName || '');
                          if (note.deliveredByName) {
                            setNoteDeliveredBySignature(note.deliveredByName.split(' ')[0] + '.');
                          } else {
                            setNoteDeliveredBySignature('');
                          }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-2.5 rounded-xl text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm border-none min-h-[44px]"
                      >
                        Resolve / Edit Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onUpdatePendingNotes) {
                            onUpdatePendingNotes(pendingNotes.filter(n => n.id !== note.id));
                          }
                          if (activeEditingPendingNoteId === note.id) {
                            setActiveEditingPendingNoteId(null);
                          }
                        }}
                        className="text-rose-600 hover:bg-rose-55 hover:text-rose-700 h-[46px] w-[46px] rounded-2xl transition-all cursor-pointer bg-rose-50 border border-rose-100 flex items-center justify-center"
                        title="Delete Draft"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Order Loader bar */}
          <div className="bg-white border border-slate-200 p-3 sm:p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
            <div>
              <h4 className="font-extrabold text-slate-800 text-sm tracking-tight flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Load a Recent POS Delivery</span>
              </h4>
            </div>
            <div className="w-full md:w-80 shrink-0">
              <select
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const found = deliveries.find(d => d.id === selectedId);
                  if (found) handleLoadFromOrder(found);
                }}
                defaultValue=""
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="" disabled>-- Select Recent POS Delivery --</option>
                {deliveries.map(del => (
                  <option key={del.id} value={del.id}>
                    {del.customerName} - {del.id} ({del.items.length} items)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            
            {/* Form Fields Side panel (Left - 5 columns) */}
            <div className="lg:col-span-12 xl:col-span-5 bg-white border border-slate-200 p-3.5 sm:p-5 rounded-2xl space-y-4 shadow-sm xl:max-h-[85vh] overflow-y-auto scrollbar-thin">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <h4 className="font-black text-slate-900 tracking-tight text-sm">Delivery Note Custom Fields</h4>
                <button 
                  type="button" 
                  onClick={() => {
                    // Quick Reset
                    setNotePINo(`PI-${Math.floor(10000 + Math.random() * 90000)}`);
                    setNoteLPO(`LP-${Math.floor(100 + Math.random() * 900)}`);
                    setNoteDate(getTodayFormatted());
                    setNoteDeliveryToTitle('Doe Company');
                    setNoteDeliveryToAddress('123 Main Street, City');
                    setNoteDeclaration('Goods delivered in good order and condition.');
                    setNoteDeliveredByName('');
                    setNoteDeliveredBySignature('');
                    setNoteDeliveredDate(getTodayFormatted());
                    setSelectedRiderForNoteId('');
                    setNoteItems([]);
                    setInvoiceSearchQuery('');
                    setInvoiceSearchResults([]);
                    setLinkedInvoiceRef('');
                  }}
                  className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded hover:bg-emerald-100 transition-all cursor-pointer"
                >
                  Reload Default Template
                </button>
              </div>

              {/* Ref Meta Block */}
              <div className="space-y-3">
                <span className="text-[10px] font-black text-slate-400 block tracking-wider uppercase font-mono border-b pb-1">1. Note Reference Metadata</span>
                
                <div className="mobile-tablet-kpi-grid grid grid-cols-2 xl:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-bold text-slate-500 font-sans">Proforma Invoice No</label>
                    <input 
                      type="text" 
                      value={notePINo} 
                      onChange={(e) => setNotePINo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-xs font-mono text-slate-800 focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-bold text-slate-500 font-sans">Document Date</label>
                    <input 
                      type="text" 
                      value={noteDate} 
                      onChange={(e) => setNoteDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-xs font-sans text-slate-800 focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-bold text-slate-500 font-sans">LPO No. Ref</label>
                    <input 
                      type="text" 
                      value={noteLPO} 
                      onChange={(e) => setNoteLPO(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-xs font-mono text-slate-800 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Logistics & Transport details section */}
              <div className="space-y-3 p-3 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
                <span className="text-[10px] font-black text-emerald-700 block tracking-wider uppercase font-mono border-b border-emerald-100 pb-1">
                  2. Logistics & Fleet details (Mandatory)
                </span>
                
                <div className="mobile-tablet-kpi-grid grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 font-sans block">Type of Transport</label>
                    <select
                      value={noteTransportType}
                      onChange={(e) => setNoteTransportType(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 outline-none text-xs font-semibold text-slate-800 focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="">-- Choose Transport --</option>
                      <option value="Motorcycle (Rider)">Motorcycle (Rider)</option>
                      <option value="Tuktuk (3-Wheeler)">Tuktuk (3-Wheeler)</option>
                      <option value="Delivery Car">Delivery Car</option>
                      <option value="Logistics Truck (Canter)">Logistics Truck (Canter)</option>
                      <option value="External Couriers / Other">External Couriers / Other</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 font-sans block">Registration Plate</label>
                    <input 
                      type="text" 
                      placeholder="e.g. T 123 ABC"
                      value={noteVehiclePlate} 
                      onChange={(e) => setNoteVehiclePlate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none text-xs font-mono font-bold text-slate-800 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery To Recipient block */}
              <div className="space-y-3">
                <span className="text-[10px] font-black text-slate-400 block tracking-wider uppercase font-mono border-b pb-1">3. Delivery Destination (Client)</span>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-sans">Recipient / Office Name</label>
                  <input 
                    type="text" 
                    value={noteDeliveryToTitle} 
                    onChange={(e) => setNoteDeliveryToTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none text-xs font-bold text-slate-800 focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-sans">Recipient Main Address Location</label>
                  <input 
                    type="text" 
                    value={noteDeliveryToAddress} 
                    onChange={(e) => setNoteDeliveryToAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none text-xs font-sans text-slate-800 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* 3b. Invoice / Sales Order Lookup */}
              <div className="space-y-3">
                <span className="text-[10px] font-black text-slate-400 block tracking-wider uppercase font-mono border-b pb-1">3. Load from Invoice / Sales Order</span>
                <div className="relative">
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search by invoice no, order ref, or customer name…"
                        value={invoiceSearchQuery}
                        onChange={(e) => handleInvoiceSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-8 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                      />
                      {invoiceSearchQuery && (
                        <button type="button" onClick={() => { setInvoiceSearchQuery(''); setInvoiceSearchResults([]); setLinkedInvoiceRef(''); }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs border-none bg-transparent cursor-pointer">✕</button>
                      )}
                    </div>
                    {linkedInvoiceRef && (
                      <span className="shrink-0 bg-emerald-100 text-emerald-700 text-[10px] font-black px-2.5 py-1.5 rounded-xl border border-emerald-200 whitespace-nowrap">
                        ✓ {linkedInvoiceRef}
                      </span>
                    )}
                  </div>

                  {/* Search results dropdown */}
                  {invoiceSearchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                      {invoiceSearchResults.map((sale: any) => (
                        <button key={sale.id} type="button" onClick={() => handleLoadFromSale(sale)}
                          className="w-full text-left px-4 py-3 hover:bg-emerald-50 border-b border-slate-50 last:border-0 transition-colors cursor-pointer border-none bg-transparent">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-900 truncate">{sale.reference || sale.id}</p>
                              <p className="text-[10px] text-slate-500 truncate">{sale.customerName || 'No customer name'} · {new Date(sale.timestamp).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[10px] font-bold text-emerald-600">{(sale.items || []).length} items</p>
                              <p className="text-[9px] text-slate-400 font-mono">{sale.paymentMethod || 'Cash'}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {invoiceSearchQuery.trim() && invoiceSearchResults.length === 0 && !linkedInvoiceRef && (
                    <p className="text-[10px] text-slate-400 mt-1.5 ml-1">No matching invoice/order found — add items manually below.</p>
                  )}
                </div>
                {!linkedInvoiceRef && !invoiceSearchQuery && (
                  <p className="text-[10px] text-slate-400">Search above to auto-fill items, or skip and add manually.</p>
                )}
              </div>

              {/* Table Note Items Builder */}
              <div className="space-y-3 pb-3">
                <span className="text-[10px] font-black text-slate-400 block tracking-wider uppercase font-mono border-b pb-1">4. Delivery Items list ({noteItems.length})</span>
                
                {/* Loader from Products search query box */}
                {products && products.length > 0 && (
                  <div className="bg-slate-50 p-2.5 rounded-2xl space-y-1.5 border border-slate-200 relative">
                    <span className="text-[9px] font-black font-mono text-indigo-650 uppercase tracking-widest block">Search Catalog Product (Name or Barcode)</span>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      <input 
                        type="text"
                        placeholder="Search product name, code or barcode..."
                        value={productSearchTerm}
                        onChange={(e) => {
                          setProductSearchTerm(e.target.value);
                          setShowSearchResults(true);
                        }}
                        onFocus={() => setShowSearchResults(true)}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-505"
                      />
                      {productSearchTerm && (
                        <button
                          type="button"
                          onClick={() => {
                            setProductSearchTerm('');
                            setShowSearchResults(false);
                          }}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Popover floating search results */}
                    {showSearchResults && productSearchTerm.trim().length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 shadow-xl rounded-xl max-h-[140px] overflow-y-auto z-40 divide-y divide-slate-100">
                        {filteredProductsForSelect.length === 0 ? (
                          <div className="p-2.5 text-center text-slate-400 text-[10px] font-mono">No matching code or name</div>
                        ) : (
                          filteredProductsForSelect.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleSelectProductFromSearch(p)}
                              className="w-full text-left px-3 py-2 hover:bg-indigo-50/50 transition-colors flex items-center justify-between text-[11px] font-medium cursor-pointer"
                            >
                              <div className="min-w-0 pr-2 col-span-2">
                                <p className="font-extrabold text-slate-800 truncate">{p.name}</p>
                                <p className="text-[9px] text-slate-500 font-mono">Barcode: {p.barcode || 'N/A'}</p>
                              </div>
                              <span className="shrink-0 text-[10px] font-black text-indigo-650 bg-indigo-55 px-2 py-0.5 rounded">
                                {currency}{p.sellingPrice.toLocaleString()}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-slate-50 p-3 rounded-2xl space-y-2 border border-slate-200">
                  <span className="text-[9.5px] font-black font-mono text-slate-500 uppercase block">Manual Line Addition</span>
                  <div className="space-y-2">
                    <input 
                      type="text"
                      placeholder="Enter line details (e.g. Toilet Rim Block)"
                      value={newItemDesc}
                      onChange={(e) => setNewItemDesc(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 outline-none text-xs font-bold text-slate-800 focus:border-emerald-500"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <input 
                          type="text"
                          placeholder="Unit (e.g. PC, Boxes, Set)"
                          value={newItemUnit}
                          onChange={(e) => setNewItemUnit(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 outline-none text-xs font-sans text-slate-800"
                        />
                      </div>
                      <div>
                        <input 
                          type="number"
                          placeholder="Qty"
                          min="1"
                          value={newItemQty}
                          onChange={(e) => setNewItemQty(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 outline-none font-mono text-xs font-bold text-slate-800 text-center"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddNoteItem}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-1.5 rounded text-xs select-none cursor-pointer transition-all uppercase"
                    >
                      + Add Item line
                    </button>
                  </div>
                </div>

                {/* Items preview table list with delete button */}
                <div className="max-h-[220px] overflow-y-auto border border-slate-100 rounded-xl divide-y">
                  {noteItems.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-[10.5px] font-mono">No items. Create one column above.</div>
                  ) : (
                    noteItems.map((item, index) => (
                      <div key={item.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs gap-2">
                        <div className="flex-grow min-w-0 font-sans">
                          <p className="font-extrabold text-slate-800 truncate">{index + 1}. {item.description}</p>
                          <p className="text-[10px] text-slate-500">Unit: <span className="font-bold text-slate-700">{item.unit}</span> | Qty: <span className="font-extrabold text-indigo-700 font-mono">{item.qty}</span></p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteNoteItem(item.id)}
                          className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 text-xs cursor-pointer select-none"
                          title="Delete line item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Signatures and declaration */}
              <div className="space-y-3 pt-2">
                <span className="text-[10px] font-black text-slate-400 block tracking-wider uppercase font-mono border-b pb-1">4. Declaration & Footer Sign</span>
                
                {/* Driver Type Selector */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-sans block">Driver Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDriverType('system');
                        setExternalDriverName('');
                        // Reset to first available rider
                        const firstRider = activeRiders[0];
                        if (firstRider) {
                          setSelectedRiderForNoteId(firstRider.id);
                          setNoteDeliveredByName(firstRider.name);
                          setNoteDeliveredBySignature(firstRider.name.split(' ').map((w: string) => w[0]).join('').toUpperCase());
                        } else {
                          setSelectedRiderForNoteId('');
                          setNoteDeliveredByName('');
                          setNoteDeliveredBySignature('');
                        }
                      }}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer border-none ${
                        driverType === 'system'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      System Driver
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDriverType('external');
                        setSelectedRiderForNoteId('');
                        setNoteDeliveredByName('');
                        setNoteDeliveredBySignature('');
                        setExternalDriverName('');
                      }}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer border-none ${
                        driverType === 'external'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      External Driver
                    </button>
                  </div>
                </div>

                {/* System Driver — Rider select list */}
                {driverType === 'system' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 font-sans block">Select System Driver / Rider</label>
                    <select
                      value={selectedRiderForNoteId}
                      onChange={(e) => {
                        const rId = e.target.value;
                        setSelectedRiderForNoteId(rId);
                        const matched = riders.find(item => item.id === rId);
                        if (matched) {
                          setNoteDeliveredByName(matched.name);
                          // Initials from system driver name
                          const initials = matched.name.split(' ').map((w: string) => w[0]).join('').toUpperCase();
                          setNoteDeliveredBySignature(initials);
                        } else {
                          setNoteDeliveredByName('');
                          setNoteDeliveredBySignature('');
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs font-semibold text-slate-700 py-1.5 outline-none cursor-pointer focus:border-indigo-500"
                    >
                      <option value="">-- Select a rider --</option>
                      {activeRiders.map(item => (
                        <option key={item.id} value={item.id}>{item.name} ({item.licensePlate} - {item.classification.toUpperCase()})</option>
                      ))}
                    </select>
                    {selectedRiderForNote && (
                      <p className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                        ✓ Auto-filled: {selectedRiderForNote.name} {selectedRiderForNote.signatureImage ? '· signature loaded' : '· using initials'}
                      </p>
                    )}
                  </div>
                )}

                {/* External Driver — manual name entry */}
                {driverType === 'external' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 font-sans block">External Driver Name</label>
                    <input
                      type="text"
                      placeholder="Enter driver full name…"
                      value={externalDriverName}
                      onChange={(e) => {
                        const name = e.target.value;
                        setExternalDriverName(name);
                        setNoteDeliveredByName(name);
                        // Auto-generate initials as signature
                        const initials = name.trim().split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).join('');
                        setNoteDeliveredBySignature(initials || '');
                      }}
                      className="w-full bg-slate-50 border border-amber-200 rounded-lg px-2.5 py-1.5 outline-none text-xs font-bold text-slate-800 focus:border-amber-400"
                    />
                    {externalDriverName.trim() && (
                      <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                        ✓ Initials signature: {externalDriverName.trim().split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).join('')}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 font-sans">Declaration Note</label>
                  <input 
                    type="text" 
                    value={noteDeclaration} 
                    onChange={(e) => setNoteDeclaration(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none text-xs text-slate-800"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500">Delivered By: Name</label>
                    <input 
                      type="text" 
                      value={noteDeliveredByName} 
                      onChange={(e) => setNoteDeliveredByName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500">Delivered By: Sign Mockup</label>
                    <input 
                      type="text" 
                      value={noteDeliveredBySignature} 
                      onChange={(e) => setNoteDeliveredBySignature(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none text-xs font-serif italic"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">Delivered Sign Date</label>
                  <input 
                    type="text" 
                    value={noteDeliveredDate} 
                    onChange={(e) => setNoteDeliveredDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none text-xs font-mono text-slate-800"
                  />
                </div>
              </div>

            </div>

            {/* Note Canvas Paper Live Preview Panel (Right - 7 columns) */}
            <div className="lg:col-span-12 xl:col-span-7 space-y-4">
              <div className="bg-slate-800/90 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between text-white shadow-md gap-3">
                <span className="text-[11px] font-mono font-bold flex items-center text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-ping"></span>
                  LIVE A4 DOCUMENT PREVIEW
                </span>
                <div className="grid grid-cols-1 sm:flex sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFinishDeliveryNote}
                    className="bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold px-3.5 py-3 sm:py-2 rounded-xl text-xs flex items-center justify-center space-x-1 cursor-pointer shadow-sm transition-all border-none min-h-[46px] sm:min-h-0"
                    title="Validate and print"
                  >
                    <span>✅ Complete & Print Note</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintNote}
                    className="bg-[#102d68] hover:bg-[#1b438c] text-white font-extrabold px-3.5 py-3 sm:py-2 rounded-xl text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm transition-all border-none min-h-[46px] sm:min-h-0"
                    title="Print the current document without saving"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Draft</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Zoom & Scaling Controls for Document Preview */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide font-mono">🔎 Zoom Preview:</span>
                  <div className="flex space-x-1 bg-slate-100 rounded-xl p-1 border border-slate-200 overflow-x-auto">
                    {[50, 65, 80, 100].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setZoomLevel(level)}
                        className={`px-3 py-1 text-[10.5px] font-extrabold rounded-lg cursor-pointer transition-all border-none ${
                          zoomLevel === level
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                        }`}
                      >
                        {level}% {level === 65 ? '(Optimal Fit)' : ''}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="text-[10px] font-sans text-slate-400 font-medium">
                  Scales visual canvas; printed paper stays pristine A4.
                </span>
              </div>

              {/* Exact Replicated Standard Delivery Note Container with printing element selector */}
              <div className="w-full overflow-x-auto overflow-y-hidden rounded-2xl md:rounded-3xl bg-slate-100 p-2 sm:p-5 border border-slate-220 flex justify-start md:justify-center items-start min-h-[400px]">
                <div 
                  className="origin-top transition-all duration-200 ease-out shrink-0" 
                  style={{ 
                    transform: `scale(${zoomLevel / 100})`, 
                    width: '740px',
                    height: `${1050 * (zoomLevel / 100)}px`,
                    marginBottom: `-${1050 * (1 - zoomLevel / 100)}px`
                  }}
                >
                  <div 
                    id="delivery-note-print-area" 
                    className="bg-white border text-black shadow-xl w-[740px] p-10 relative overflow-hidden font-sans border-slate-350"
                    style={{ minHeight: '1000px' }}
                  >
                  {/* Visual watermark representing company logo prefix or brand */}
                  <div className="absolute inset-0 pointer-events-none opacity-[0.02] flex items-center justify-center select-none z-0">
                    <div className="transform -rotate-45 text-slate-800 font-extrabold text-5xl tracking-widest text-center">
                      {computedLogoName.toUpperCase()}<br />STATION
                    </div>
                  </div>

                  {/* 1. Header Row (Logo Left & Company Info Right) */}
                  <div className="flex justify-between items-center border-b-[2px] border-double pb-4 relative z-10" style={{ borderColor: computedInvoiceColor }}>
                    {/* Left Signature Logo Emblem Container */}
                    <div className="flex items-center space-x-3.5 z-10">
                      {computedLogo ? (
                        <img 
                          src={computedLogo} 
                          alt="Merchant Logo" 
                          className="max-h-10 max-w-[120px] object-contain select-none"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="relative w-14 h-14 bg-white border-2 rounded-full flex items-center justify-center p-1.5 shrink-0" style={{ borderColor: computedInvoiceColor }}>
                          {/* Stylized delivery cart logo representing current brand */}
                          <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-current stroke-[6]" style={{ color: computedInvoiceColor }} referrerPolicy="no-referrer">
                            <circle cx="35" cy="85" r="8" className="fill-current text-indigo-400" />
                            <circle cx="75" cy="85" r="8" className="fill-current text-indigo-400" />
                            <path d="M15 15 h15 l15 45 h30 l12 -30 h-62" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Right Header Details Column */}
                    <div className="text-right text-[10.5px] text-slate-800 space-y-0.5 leading-relaxed font-sans max-w-[320px] z-10">
                      <p className="font-extrabold text-slate-900 text-[11.5px]">{computedCompanyTitle}</p>
                      <p><span className="font-semibold text-slate-500">Address:</span> {computedCompanyAddress}</p>
                      <p><span className="font-semibold text-slate-500">Phone:</span> {computedCompanyPhone}</p>
                      <p><span className="font-semibold text-slate-500">Email:</span> {computedCompanyEmail}</p>
                    </div>
                  </div>

                  {/* 2. Center TIN Identification Row — only shown when TIN is set in Company Level Settings */}
                  {computedTIN && (
                    <div className="text-center py-2 text-[11px] font-extrabold tracking-wider font-mono border-b border-slate-200 relative z-10" style={{ color: computedInvoiceColor }}>
                      TIN: {computedTIN}
                    </div>
                  )}

                  {/* 3. Header Title: "DELIVERY NOTE" */}
                  <div className="text-center py-5 relative z-10">
                    <h2 className="text-2xl font-black tracking-widest uppercase font-sans" style={{ color: computedInvoiceColor }}>
                      DELIVERY NOTE
                    </h2>
                  </div>

                  {/* 4. Reference Meta Information Grid Block */}
                  <div className="flex justify-between items-end pb-3 text-xs font-sans text-slate-800 leading-normal relative z-10">
                    {/* Left Column Delivery Designation */}
                    <div>
                      <span className="text-xs font-black block uppercase tracking-wider" style={{ color: computedInvoiceColor }}>Delivery To:</span>
                    </div>

                    {/* Right Column Registration details */}
                    <div className="space-y-1 text-right font-medium text-[11px]">
                      <div className="flex justify-end gap-3">
                        <span className="text-slate-500 font-semibold">Reference PI No:</span>
                        <span className="font-bold font-mono">{notePINo}</span>
                      </div>
                      <div className="flex justify-end gap-3">
                        <span className="text-slate-500 font-semibold">Date:</span>
                        <span className="font-bold font-mono">{noteDate}</span>
                      </div>
                      <div className="flex justify-end gap-3">
                        <span className="text-slate-500 font-semibold">Reference: LPO No.</span>
                        <span className="font-bold font-mono text-[10.5px]">{noteLPO}</span>
                      </div>
                      {noteTransportType && (
                        <div className="flex justify-end gap-3 border-t border-slate-100 pt-1 mt-1">
                          <span className="text-slate-500 font-semibold">Transport Used:</span>
                          <span className="font-bold text-slate-900 font-mono text-[10.5px]">{noteTransportType}</span>
                        </div>
                      )}
                      {noteVehiclePlate && (
                        <div className="flex justify-end gap-3">
                          <span className="text-slate-500 font-semibold">Vehicle Plate No:</span>
                          <span className="font-bold text-slate-900 font-mono text-[10.5px]">{noteVehiclePlate}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 5. Highlighted Theme Customer Information Banner */}
                  <div className="text-white p-4.5 rounded-[2px] shadow-xs mb-5 leading-relaxed font-sans relative z-10" style={{ backgroundColor: computedInvoiceColor }}>
                    <h4 className="text-sm font-extrabold tracking-wide uppercase">{noteDeliveryToTitle}</h4>
                    <p className="text-[12.5px] text-slate-100 font-medium whitespace-pre-wrap mt-0.5">{noteDeliveryToAddress}</p>
                  </div>

                  {/* 6. Main Items Table Render */}
                  <div className="border border-slate-300 rounded-[2px] overflow-hidden relative z-10">
                    <table className="w-full text-left border-collapse text-[11.5px]">
                      <thead>
                        <tr className="text-white text-[10.5px] font-sans uppercase font-black divide-x divide-slate-600" style={{ backgroundColor: computedInvoiceColor }}>
                          <th className="py-2.5 px-3.5 text-center w-14 select-none">S/N</th>
                          <th className="py-2.5 px-4 text-left">Item Description</th>
                          <th className="py-2.5 px-4 text-center w-24">Unit</th>
                          <th className="py-2.5 px-4 text-center w-24">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-350 font-sans font-semibold text-slate-800">
                        {noteItems.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors divide-x divide-slate-300 even:bg-slate-50/10">
                            <td className="py-2.5 px-3.5 text-center font-bold font-mono text-slate-400 select-none">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-slate-900 leading-snug">
                              {item.description}
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-600 font-medium font-sans">
                              {item.unit}
                            </td>
                            <td className="py-2.5 px-4 text-center font-extrabold font-mono text-[12px] text-slate-900">
                              {item.qty}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 7. Declaration Segment */}
                  <div className="pt-6 pb-8 font-sans text-xs relative z-10">
                    <h5 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wide">Declaration:</h5>
                    <p className="text-slate-600 mt-0.5 font-semibold text-[11px]">{noteDeclaration}</p>
                  </div>

                  {/* 8. Signature Row Section */}
                  <div className="grid grid-cols-2 gap-10 pt-5 border-t border-slate-200 text-xs text-slate-800 leading-normal relative z-10">
                    {/* Delivered by Column Column */}
                    <div className="space-y-3 font-sans">
                      <p className="font-extrabold text-slate-900 border-b border-slate-200 pb-1.5 flex items-center gap-1 uppercase tracking-wider text-[10px] text-slate-500">
                        <span>Delivered by:</span>
                      </p>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex gap-2">
                          <span className="text-slate-500 font-semibold min-w-16">Name:</span>
                          <span className="font-extrabold text-slate-900">{noteDeliveredByName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-semibold min-w-16">Signature:</span>
                          {selectedRiderForNote?.signatureImage ? (
                            <img 
                              src={selectedRiderForNote.signatureImage} 
                              alt="Rider Signature" 
                              className="h-10 max-w-[140px] object-contain select-none"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="font-serif italic text-[14px] tracking-widest font-bold bg-slate-50 p-0.5 px-2 rounded-xs border border-slate-100 select-none" style={{ color: computedInvoiceColor }}>
                              {noteDeliveredBySignature || 'N/A'}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <span className="text-slate-500 font-semibold min-w-16">Date:</span>
                          <span className="font-bold font-mono text-slate-800">{noteDeliveredDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Received by Column Column */}
                    <div className="space-y-3 font-sans">
                      <p className="font-extrabold text-slate-900 border-b border-slate-200 pb-1.5 uppercase tracking-wider text-[10px] text-slate-500">
                        <span>Received by:</span>
                      </p>
                      <div className="space-y-2 text-[11px]">
                        <div className="flex gap-2 items-end">
                          <span className="text-slate-500 font-semibold min-w-16">Name:</span>
                          <div className="border-b border-slate-300 flex-grow h-4"></div>
                        </div>
                        <div className="flex gap-2 items-end">
                          <span className="text-slate-500 font-semibold min-w-16">Signature:</span>
                          <div className="border-b border-slate-300 flex-grow h-4"></div>
                        </div>
                        <div className="flex gap-2 items-end">
                          <span className="text-slate-500 font-semibold min-w-16">Date:</span>
                          <div className="border-b border-slate-300 flex-grow h-4"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div> {/* Close delivery-note-print-area */}
              </div>   {/* Close scaled wrapper */}
            </div>     {/* Close overflow-hidden card container */}
          </div>

          </div>
        </div>
      )}

      {activeSubTab === 'accounting' && (
        <div className="space-y-4">
          {(() => {
            const deliveryIncome = deliveries.reduce((sum, d) => sum + (d.deliveryCost || 0), 0);
            const deliveryExpenses = expenses?.filter(e => e.category === 'Delivery Expense' || e.category === 'Delivery Maintainance') || [];
            const totalDeliveryExpenses = deliveryExpenses.reduce((sum, e) => sum + e.amount, 0);
            const deliveryProfit = deliveryIncome - totalDeliveryExpenses;

            return (
              <>
                <div className="mobile-tablet-kpi-grid grid grid-cols-2 xl:grid-cols-4 gap-2.5 md:gap-4">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5 md:p-4 relative overflow-hidden shadow-sm">
                    <div className="relative z-10">
                      <span className="block text-[9px] sm:text-[10px] font-mono uppercase font-black text-emerald-600 tracking-wider mb-1.5">Delivery Income</span>
                      <span className="text-lg sm:text-xl font-black font-mono text-emerald-900">{activeTenant.currency}{deliveryIncome.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3.5 md:p-4 relative overflow-hidden shadow-sm">
                    <div className="relative z-10">
                      <span className="block text-[9px] sm:text-[10px] font-mono uppercase font-black text-rose-600 tracking-wider mb-1.5">Expenses</span>
                      <span className="text-lg sm:text-xl font-black font-mono text-rose-900">{activeTenant.currency}{totalDeliveryExpenses.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className={`border rounded-2xl p-3.5 md:p-4 relative overflow-hidden shadow-sm ${deliveryProfit >= 0 ? 'bg-teal-50 border-teal-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="relative z-10">
                      <span className={`block text-[9px] sm:text-[10px] font-mono uppercase font-black tracking-wider mb-1.5 ${deliveryProfit >= 0 ? 'text-teal-600' : 'text-red-600'}`}>Net Profit</span>
                      <span className={`text-lg sm:text-xl font-black font-mono ${deliveryProfit >= 0 ? 'text-teal-900' : 'text-red-900'}`}>
                        {activeTenant.currency}{deliveryProfit.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="bg-sky-50 border border-sky-100 rounded-2xl p-3.5 md:p-4 relative overflow-hidden shadow-sm">
                    <span className="block text-[9px] sm:text-[10px] font-mono uppercase font-black text-sky-600 tracking-wider mb-1.5">Deliveries</span>
                    <span className="text-lg sm:text-xl font-black font-mono text-sky-900">{deliveries.length.toLocaleString()}</span>
                  </div>
                </div>

                {/* Delivery Payment Methods Accounting */}
                <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-3.5 md:p-4 shadow-sm">
                  <h3 className="font-bold text-slate-700 tracking-tight mb-3 text-xs uppercase tracking-wider font-mono">
                    Payments Accounting
                  </h3>
                  <div className="mobile-tablet-kpi-grid grid grid-cols-2 xl:grid-cols-4 gap-2.5">
                    {(() => {
                      const modeTotals = deliveries.reduce((acc, d) => {
                        const m = d.deliveryPaymentMethod || 'Cash';
                        acc[m] = (acc[m] || 0) + (d.deliveryCost || 0);
                        return acc;
                      }, {} as Record<string, number>);
                      
                      const modeEntries = Object.entries(modeTotals);

                      if (modeEntries.length === 0) {
                        return <div className="text-slate-400 font-mono text-xs italic">No recorded payments</div>;
                      }

                      return modeEntries.sort((a, b) => b[1] - a[1]).map(([mode, amount]) => (
                        <div key={mode} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col justify-between">
                          <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">{mode}</span>
                          <span className="text-lg font-black font-mono text-slate-800">{activeTenant.currency}{Math.round(amount).toLocaleString()}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Delivery Form for Expense */}
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 md:p-4 shadow-sm">
                  <h3 className="font-bold text-slate-800 tracking-tight mb-3 flex items-center space-x-2 text-sm">
                    <Printer className="w-4 h-4 text-slate-400" />
                    <span>Log Delivery Expense (Oil, Maintenance, etc.)</span>
                  </h3>
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const amount = parseFloat((form.elements.namedItem('amount') as HTMLInputElement).value);
                      const desc = (form.elements.namedItem('desc') as HTMLInputElement).value;
                      if (!amount || !desc) return;
                      if (onAddExpense) {
                        onAddExpense({
                          id: 'exp-' + Math.random().toString(36).substr(2, 9),
                          amount: amount,
                          category: 'Delivery Maintainance',
                          description: desc,
                          date: new Date().toISOString(),
                          loggedBy: 'Manager',
                          tenantId: activeTenant.id
                        });
                      }
                      form.reset();
                      alert('Delivery Expense Logged Successfully!');
                    }}
                    className="flex flex-row items-end gap-2"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Description</label>
                      <input 
                        type="text" 
                        name="desc"
                        required
                        placeholder="e.g. Engine Oil for Bodaboda"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1 w-24 sm:w-40 shrink-0">
                      <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Amount ({activeTenant.currency})</label>
                      <input 
                        type="number" 
                        name="amount"
                        required
                        min="1"
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button type="submit" className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all hover:bg-emerald-700 shrink-0 min-h-[42px]">
                      <span className="sm:hidden">Add</span><span className="hidden sm:inline">Add Expense</span>
                    </button>
                  </form>
                </div>

                {/* Delivery records are managed from the Jobs screen. */}
                <div className="hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-sm text-slate-800 flex items-center justify-between">
                    <span>Detailed Deliveries Record</span>
                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-mono">{deliveries.length} Records</span>
                  </div>
                  <div className="hidden xl:block overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-100/50 text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                          <th className="px-6 py-3">Order Ref</th>
                          <th className="px-6 py-3">Customer Info</th>
                          <th className="px-6 py-3">Location / Notes</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3">Rider</th>
                          <th className="px-6 py-3">Pay. Method</th>
                          <th className="px-6 py-3 text-right">Delivery Amt Paid</th>
                          <th className="px-6 py-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
                        {deliveries.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-8 text-center text-slate-400">No deliveries recorded yet.</td>
                          </tr>
                        ) : (
                          deliveries.map(d => {
                            const isDropdownOpen = openDropdownRow === d.id;
                            // Generate short code
                            const shortCode = d.id.startsWith('del-') ? d.id.substring(4, 9).toUpperCase() : d.id.substring(0, 5).toUpperCase();
                            return (
                              <tr key={d.id} className="hover:bg-slate-50">
                                <td className="px-6 py-3 font-mono font-bold text-slate-900" title={d.id}>{shortCode}</td>
                                <td className="px-6 py-3">
                                  <div className="font-bold text-slate-800">{d.customerName || 'Walk-in'}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">{d.customerPhone || 'No Phone'}</div>
                                </td>
                                <td className="px-6 py-3 whitespace-normal min-w-48 max-w-xs">{d.notes || 'N/A'}</td>
                                <td className="px-6 py-3">
                                  {d.status === 'Delivered' ? (
                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center w-max">
                                      <CheckCircle className="w-3 h-3 mr-1" /> Delivered
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full flex items-center w-max">
                                      <Truck className="w-3 h-3 mr-1" /> On Route
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-3">
                                  {d.riderDetails ? (
                                    <div>
                                      <span className="font-bold">{d.riderDetails.name}</span>
                                      <span className="text-[10px] block text-slate-400">{d.riderDetails.vehicleType}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Unassigned</span>
                                  )}
                                </td>
                                <td className="px-6 py-3 text-xs uppercase font-mono font-bold text-slate-500">
                                  {d.deliveryPaymentMethod || 'N/A'}
                                </td>
                                <td className="px-6 py-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">
                                  {activeTenant.currency}{(d.deliveryCost || 0).toLocaleString()}
                                </td>
                                <td className="px-6 py-3 text-center relative">
                                  <button
                                    onClick={() => setOpenDropdownRow(isDropdownOpen ? null : d.id)}
                                    className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-700 transition"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                  {isDropdownOpen && (
                                    <>
                                      <div 
                                        className="fixed inset-0 z-40" 
                                        onClick={() => setOpenDropdownRow(null)}
                                      />
                                      <div className="absolute right-8 top-10 w-40 bg-white shadow-xl rounded-xl border border-slate-200 py-1.5 z-50 animate-fade-in origin-top-right text-left text-xs font-bold text-slate-700 flex flex-col">
                                        <button 
                                          className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"
                                          onClick={() => { setOpenDropdownRow(null); alert('View Delivery: ' + shortCode); }}
                                        >
                                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                                          View Delivery
                                        </button>
                                        <button 
                                          className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"
                                          onClick={() => { setOpenDropdownRow(null); alert('Edit Delivery: ' + shortCode); }}
                                        >
                                          <Edit className="w-3.5 h-3.5 text-blue-400" />
                                          Edit Delivery
                                        </button>
                                        <button 
                                          className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"
                                          onClick={() => { setOpenDropdownRow(null); alert('Delete Delivery: ' + shortCode); }}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          Delete Delivery
                                        </button>
                                        <div className="h-px bg-slate-100 my-1"></div>
                                        <button 
                                          className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"
                                          onClick={() => { setOpenDropdownRow(null); alert('Delete Delivery: ' + shortCode); }}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          Delete Delivery
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="xl:hidden p-3 space-y-3">
                    {deliveries.length === 0 ? (
                      <div className="px-4 py-8 text-center text-slate-400 text-sm">No deliveries recorded yet.</div>
                    ) : (
                      deliveries.map(d => {
                        const isDropdownOpen = openDropdownRow === d.id;
                        const shortCode = d.id.startsWith('del-') ? d.id.substring(4, 9).toUpperCase() : d.id.substring(0, 5).toUpperCase();
                        return (
                          <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-3 relative shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Order {shortCode}</span>
                                <p className="mt-1 font-black text-slate-900 truncate">{d.customerName || 'Walk-in'}</p>
                                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{d.customerPhone || 'No Phone'}</p>
                              </div>
                              <button
                                onClick={() => setOpenDropdownRow(isDropdownOpen ? null : d.id)}
                                className="h-10 w-10 rounded-full bg-white border border-slate-200 text-slate-500 flex items-center justify-center shrink-0"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="mobile-tablet-kpi-grid grid grid-cols-2 gap-2 mt-2.5">
                              <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Status</span>
                                <span className="block mt-1 text-xs font-bold text-slate-800">{d.status}</span>
                              </div>
                              <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 p-2.5">
                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Amount</span>
                                <span className="block mt-1 text-xs font-black text-emerald-700 font-mono">{activeTenant.currency}{(d.deliveryCost || 0).toLocaleString()}</span>
                              </div>
                              <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Payment</span>
                                <span className="block mt-1 text-xs font-bold text-slate-800 uppercase">{d.deliveryPaymentMethod || 'N/A'}</span>
                              </div>
                              <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Rider</span>
                                <span className="block mt-1 text-xs font-bold text-slate-800 truncate">{d.riderDetails?.name || 'Unassigned'}</span>
                              </div>
                            </div>
                            {d.notes && (
                              <p className="mt-2.5 text-[11px] text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-2.5 line-clamp-2">{d.notes}</p>
                            )}
                            {isDropdownOpen && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownRow(null)} />
                                <div className="absolute right-4 top-14 w-44 bg-white shadow-xl rounded-2xl border border-slate-200 py-2 z-50 animate-fade-in origin-top-right text-left text-xs font-bold text-slate-700 flex flex-col">
                                  <button className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2" onClick={() => { setOpenDropdownRow(null); alert('View Delivery: ' + shortCode); }}>
                                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                                    View Delivery
                                  </button>
                                  <button className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2" onClick={() => { setOpenDropdownRow(null); alert('Edit Delivery: ' + shortCode); }}>
                                    <Edit className="w-3.5 h-3.5 text-blue-400" />
                                    Edit Delivery
                                  </button>
                                  <button className="w-full text-left px-4 py-3 hover:bg-red-50 text-red-600 flex items-center gap-2" onClick={() => { setOpenDropdownRow(null); alert('Delete Delivery: ' + shortCode); }}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete Delivery
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* DISPATCH TARGET ASSIGNMENT MODAL */}
      {dispatchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col relative animate-scale-up max-h-[92vh]">
            
            {/* Modal Close Button */}
            <button 
              onClick={() => setDispatchTarget(null)}
              className="absolute top-4.5 right-4.5 p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="px-6 py-5 bg-slate-50 border-b border-slate-200">
              <h4 className="font-black text-slate-800 text-sm tracking-wide uppercase">Assign Order Delivery Dispatch</h4>
              <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                Assign a logistics agent for order Ref <span className="font-mono font-bold text-slate-800">{dispatchTarget.saleId}</span> to customer {dispatchTarget.customerName}.
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-5 text-slate-700 overflow-y-auto">
              
              {/* Customer Target Details */}
              <div className="space-y-1.5 p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono mb-2">Customer & Location Verification</label>
                <div className="space-y-3 pt-1 text-xs text-slate-700">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase font-sans">Customer Name</label>
                      <input
                        type="text"
                        placeholder="Client Name"
                        value={dispatchCustomerName}
                        onChange={(e) => setDispatchCustomerName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase font-sans">Phone Number</label>
                      <input
                        type="text"
                        placeholder="+123..."
                        value={dispatchCustomerPhone}
                        onChange={(e) => setDispatchCustomerPhone(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase font-sans">Delivery Address / Destination</label>
                    <textarea
                      placeholder="Drop-off location..."
                      value={dispatchCustomerLocation}
                      onChange={(e) => setDispatchCustomerLocation(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 min-h-[60px]"
                    ></textarea>
                  </div>
                  {(!dispatchTarget.deliveryPaymentMethod) && (
                    <div className="space-y-1 pt-3 border-t border-slate-200 border-dashed mt-3">
                      <label className="text-[10px] font-black text-rose-500 uppercase font-sans flex items-center justify-between">
                        <span>Missing Delivery Payment Method</span>
                        <span className="text-[9px] text-slate-400 lowercase font-medium">Required for accounting</span>
                      </label>
                      <select
                        value={dispatchPaymentMethod}
                        onChange={(e) => setDispatchPaymentMethod(e.target.value)}
                        className="w-full bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3 py-2 outline-none focus:border-rose-400 font-bold text-xs"
                        required
                      >
                        <option value="" disabled>Select captured payment method...</option>
                        {systemSettings?.business?.deliveryPaymentModes?.map((method, idx) => (
                          <option key={idx} value={method}>{method}</option>
                        ))}
                        {(!systemSettings?.business?.deliveryPaymentModes || systemSettings.business.deliveryPaymentModes.length === 0) && (
                          <option value="Cash">Cash</option>
                        )}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Type Router toggle */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Logistics Driver Selection</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setUseShopRider(true)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      useShopRider 
                        ? 'bg-slate-900 text-white font-black shadow-xs' 
                        : 'text-slate-600 hover:bg-slate-200/50'
                    }`}
                  >
                    Shop Registered Driver/Rider
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseShopRider(false)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      !useShopRider 
                        ? 'bg-slate-900 text-white font-black shadow-xs' 
                        : 'text-slate-600 hover:bg-slate-200/50'
                    }`}
                  >
                    Other / Temporary Driver
                  </button>
                </div>
              </div>

              {useShopRider ? (
                <div className="space-y-3">
                  {activeRiders.length === 0 ? (
                    <div className="p-6 text-center border border-dashed rounded-2xl text-xs text-amber-800 bg-amber-50/40">
                      No permanent crew registered yet for {activeTenant.name}. Register riders/drivers first, or switch to "Other / Temporary Driver" above.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Select From Store Crew</label>
                      <div className="grid grid-cols-1 gap-2">
                        {activeRiders.map(crew => (
                          <button
                            key={crew.id}
                            type="button"
                            onClick={() => setSelectedRiderId(crew.id)}
                            className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                              selectedRiderId === crew.id
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-400'
                                : 'bg-slate-50 text-slate-700 border-slate-250 hover:border-slate-350'
                            }`}
                          >
                            <div>
                              <p className="font-extrabold text-xs text-slate-900">{crew.name}</p>
                              <p className="text-[10.5px] font-mono text-slate-500 mt-0.5">{crew.phone}</p>
                              <p className="text-[10.5px] text-slate-500 mt-1 uppercase tracking-wider font-mono">
                                Vehicle: <span className="font-bold">{crew.vehicleColor} {crew.vehicleType}</span> ({crew.licensePlate})
                              </p>
                            </div>
                            <span className="text-[9px] font-bold border border-emerald-200 bg-white text-emerald-700 px-2 py-0.5 rounded uppercase">
                              {crew.classification}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3.5 pt-1 text-xs text-slate-700">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Temporary Courier Name</label>
                      <input
                        type="text"
                        placeholder="Driver Name"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 font-sans text-xs font-bold text-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Phone Number</label>
                      <input
                        type="text"
                        placeholder="WhatsApp Phone"
                        value={tempPhone}
                        onChange={(e) => setTempPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 font-mono text-xs text-slate-800 fill-inherit"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Class Classification</label>
                      <select
                        value={tempClassification}
                        onChange={(e) => setTempClassification(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer font-sans text-xs text-slate-800 font-bold"
                      >
                        <option value="rider">Rider (Motorcycle/Tuktuk)</option>
                        <option value="driver">Driver (Car/van)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Vehicle Medium</label>
                      <select
                        value={tempVehicleType}
                        onChange={(e) => setTempVehicleType(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer font-sans text-xs text-slate-800 font-bold"
                      >
                        <option value="motorcycle">Motorcycle</option>
                        <option value="tuktuk">Tuktuk</option>
                        <option value="car">Car / Van</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Vehicle Color</label>
                      <input
                        type="text"
                        placeholder="e.g. Silver / Grey"
                        value={tempVehicleColor}
                        onChange={(e) => setTempVehicleColor(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 font-sans text-xs text-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Registration Code</label>
                      <input
                        type="text"
                        placeholder="e.g. LG-934C-M"
                        value={tempLicensePlate}
                        onChange={(e) => setTempLicensePlate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 font-mono text-xs uppercase text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer actions */}
            <div className="px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDispatchTarget(null)}
                className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-4 py-3 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[46px] sm:min-h-0"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDispatch}
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[46px] sm:min-h-0"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP VISUAL PREVIEW AND SIMULATION MODAL */}
      {whatsAppTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col relative animate-scale-up max-h-[92vh]">
            
            {/* Close */}
            <button 
              onClick={() => setWhatsAppTarget(null)}
              className="absolute top-4.5 right-4.5 p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="px-6 py-5 bg-[#075e54] text-white">
              <div className="flex items-center space-x-2.5">
                <Smartphone className="w-5 h-5" />
                <h4 className="font-black text-sm tracking-wide uppercase">WhatsApp Customer Dispatch Note</h4>
              </div>
              <p className="text-[10px] text-emerald-100 font-sans mt-0.5">
                Dispatch message simulation destined to client phone: <span className="font-mono font-bold text-white">{whatsAppTarget.customerPhone || 'N/A'}</span>
              </p>
            </div>

            {/* WhatsApp Bubble Preview */}
            <div className="p-6 bg-[#ebe5df] flex-grow select-text" style={{ backgroundImage: 'radial-gradient(#dfdcd6 12%, transparent 0)' }}>
              <div className="relative max-w-[85%] bg-white rounded-2xl rounded-tl-none p-4.5 text-xs text-slate-800 shadow-md border-l-4 border-emerald-500 font-sans leading-relaxed">
                {/* Visual whatsapp tail */}
                <span className="absolute -left-1.5 top-0 w-3 h-3 bg-white transform rotate-45 rounded-sm pointer-events-none"></span>
                <p className="whitespace-pre-wrap">Delivery note PDF will be prepared from the system template and sent to the customer.</p>
                <div className="text-[9.5px] text-right text-slate-400 mt-2 font-mono flex items-center justify-end">
                  <span>PDF template ready</span>
                  <Check className="w-3 h-3 text-sky-500 ml-1 shrink-0" />
                </div>
              </div>
              {deliveryPdfStatus && (
                <p className="mt-3 text-[11px] font-bold text-emerald-800 bg-white/80 rounded-xl px-3 py-2">
                  {deliveryPdfStatus}
                </p>
              )}
            </div>

            {/* Footer with actions */}
            <div className="px-4 sm:px-6 py-4.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-[10px] bg-slate-200 text-slate-600 px-2.5 py-1 rounded-lg font-bold font-mono">
                {whatsAppTarget.customerPhone ? 'Direct WA.me Ready' : 'Incomplete Phone'}
              </span>
              <div className="grid grid-cols-2 gap-2.5 w-full sm:w-auto">
                <button
                  onClick={() => copyToClipboard(generateWhatsAppMessage(whatsAppTarget))}
                  className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-2 px-3.5 rounded-xl text-xs transition-all cursor-pointer flex items-center space-x-1"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{copiedText ? 'Copied!' : 'Copy Text'}</span>
                </button>
                <button
                  onClick={() => openWhatsAppLink(whatsAppTarget)}
                  disabled={!whatsAppTarget.customerPhone}
                  className="bg-[#25D366] hover:bg-[#20ba59] text-white font-extrabold py-2 px-4 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Send PDF</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* NEW DELIVERY VIA SALE REF MODAL */}
      {isAddDeliveryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl md:rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 pb-5">
              <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center">
                <Truck className="w-5 h-5 mr-2 text-emerald-600" />
                Add Delivery from Sales
              </h3>
              <button onClick={() => {
                setIsAddDeliveryModalOpen(false);
                setSearchSaleRef('');
                setMatchedSale(null);
                setNewDeliveryCost('');
              }} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              {!matchedSale ? (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                    <label className="block text-[11px] font-mono text-slate-500 uppercase tracking-wider font-bold mb-2">Search Sale Reference</label>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                      <input 
                        type="text"
                        placeholder="e.g. SL-2ABC1234 or reference"
                        value={searchSaleRef}
                        onChange={(e) => setSearchSaleRef(e.target.value)}
                        className="flex-1 w-full border border-slate-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                      <button 
                        type="button" 
                        onClick={handleSearchSale}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
                      >
                        Search
                      </button>
                    </div>
                  </div>
                  <div className="text-center py-6 px-4">
                    <Plus className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-xs text-slate-500 max-w-[250px] mx-auto font-medium">Search paid ticket first.</p>
                  </div>
                </>
              ) : (
                <form id="newDeliveryForm" onSubmit={handleSubmitNewDelivery} className="space-y-6">
                  {/* Matched Sale Insight */}
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-900 tracking-tight">Order Record Found</h4>
                      <p className="text-xs text-emerald-700 font-mono mt-1">Ref: {matchedSale.reference || matchedSale.id}</p>
                      <p className="text-xs text-emerald-700 mt-1">Customer: <span className="font-bold">{matchedSale.customerName || 'Walk-In Customer'}</span> {matchedSale.customerPhone && `(${matchedSale.customerPhone})`}</p>
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div className="space-y-4 pt-1">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-500 uppercase tracking-wider font-bold mb-1.5 flex items-center justify-between">
                        Delivery Fee
                        <span className="text-indigo-600 lowercase bg-indigo-50 px-1.5 py-0.5 rounded-md font-sans">in {activeTenant.currency}</span>
                      </label>
                      <input 
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={newDeliveryCost}
                        onChange={(e) => setNewDeliveryCost(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0.00"
                        className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-500 uppercase tracking-wider font-bold mb-1.5">Payment method</label>
                      <select 
                        required
                        value={newDeliveryPaymentMethod}
                        onChange={(e) => setNewDeliveryPaymentMethod(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-semibold"
                      >
                        {systemSettings?.business?.deliveryPaymentModes?.map((method, idx) => (
                          <option key={idx} value={method}>{method}</option>
                        ))}
                        {(!systemSettings?.business?.deliveryPaymentModes || systemSettings.business.deliveryPaymentModes.length === 0) && (
                          <option value="Cash">Cash</option>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Confirm Action */}
                  <div className="bg-slate-50 p-4 -mx-6 -mb-6 border-t border-slate-100 grid grid-cols-2 gap-3">
                    <button 
                      type="button" 
                      onClick={() => {
                        setSearchSaleRef('');
                        setMatchedSale(null);
                        setNewDeliveryCost('');
                      }}
                      className="px-4 py-3 sm:py-2 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer min-h-[46px] sm:min-h-0"
                    >
                      Search Another
                    </button>
                    <button 
                      type="submit" 
                      className="px-5 py-3 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 flex items-center justify-center cursor-pointer min-h-[46px] sm:min-h-0"
                    >
                      <Truck className="w-4 h-4 mr-1.5" />
                      Send to Dispatch
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
