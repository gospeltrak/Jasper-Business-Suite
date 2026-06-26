import React, { useState, useEffect } from 'react';
import { Tenant, Delivery, DeliveryRider, SaleItem, Product, SystemSettings, Sale } from '../types';
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
import { shareElementPdfToWhatsApp } from '../utils/pdfShare';

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
  onUpdateDeliveryStatus: (deliveryId: string, status: Delivery['status']) => void;
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
  onAddExpense
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
  const [noteDeliveryToTitle, setNoteDeliveryToTitle] = useState('The President Office');
  const [noteDeliveryToAddress, setNoteDeliveryToAddress] = useState('Barabara ya Julius Nyerere, Dodoma.');
  const [noteDeclaration, setNoteDeclaration] = useState('Goods delivered in good order and condition.');
  const [noteDeliveredByName, setNoteDeliveredByName] = useState('Lilian Mbawala');
  const [noteDeliveredBySignature, setNoteDeliveredBySignature] = useState('Lilian M.');
  const [noteDeliveredDate, setNoteDeliveredDate] = useState(() => getTodayFormatted());

  const [newRiderSignature, setNewRiderSignature] = useState('');
  const [selectedRiderForNoteId, setSelectedRiderForNoteId] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Dynamically computed supplier details
  const computedLogo = systemSettings?.company?.logo || systemSettings?.business?.businessLogoLight || systemSettings?.business?.businessLogo || localStorage.getItem(`jasper_tenant_logo_${activeTenant.id}`) || activeTenant?.company_settings?.logo_url || '';
  const computedLogoName = activeTenant?.name || 'Lim Cleaners';
  const computedCompanyTitle = systemSettings?.business?.businessName || activeTenant?.name || 'Lim Company Limited';
  const computedCompanyAddress = systemSettings?.company?.address || 'Wazo-Bwani, Dar es Salaam';
  const computedCompanyPhone = systemSettings?.company?.phone || '+255713965853/+255714296200';
  const computedCompanyEmail = systemSettings?.business?.businessEmail || 'limcompanyltd@gmail.com';
  const computedTIN = systemSettings?.invoiceSettings?.tin || '140-763-403';
  const computedInvoiceColor = systemSettings?.invoiceSettings?.invoiceColor || '#102d68';
  const selectedRiderForNote = riders.find(r => r.id === selectedRiderForNoteId);
  
  // Dynamic table items
  const [noteItems, setNoteItems] = useState([
    { id: '1', description: 'Toilet Rim Block', unit: 'Boxes', qty: 7 },
    { id: '2', description: 'Handwash Soap', unit: 'PC', qty: 7 },
    { id: '3', description: 'Scrub dady Sponge', unit: 'Set', qty: 5 },
    { id: '4', description: 'Organizer Basket Large', unit: 'PC', qty: 3 },
    { id: '5', description: 'Organizer Basket small', unit: 'PC', qty: 4 },
    { id: '6', description: 'Mable Tray', unit: 'PC', qty: 3 },
    { id: '7', description: 'Pink Cleaning Paste', unit: 'PC', qty: 4 },
    { id: '8', description: 'Flash Floor Cleaner 1L', unit: 'PC', qty: 3 },
    { id: '9', description: 'Pink Cream Cleaner', unit: 'PC', qty: 6 },
    { id: '10', description: 'Face towels', unit: 'PC', qty: 4 },
    { id: '11', description: 'Various as per Proforma Invoice', unit: 'Lumpsum', qty: 1 }
  ]);

  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('PC');
  const [newItemQty, setNewItemQty] = useState(1);
  const [openDropdownRow, setOpenDropdownRow] = useState<string | null>(null);

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
      unit: 'PC',
      qty: item.qty
    }));
    setNoteItems(mapped);
  };

  const handlePrintNote = () => {
    const printContent = document.getElementById('delivery-note-print-area');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocked! Please allow pop-ups to print the delivery note.');
      return;
    }
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Delivery Note - PI ${notePINo}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;950&family=Playfair+Display:wght@700&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              padding: 40px;
              display: flex;
              justify-content: center;
              background-color: white;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-container {
              width: 100%;
              max-width: 800px;
            }
          </style>
        </head>
        <body onload="setTimeout(function(){ window.print(); window.close(); }, 500)">
          <div class="print-container">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleFinishDeliveryNote = () => {
    // Validate mandatory fields
    if (!noteDeliveryToAddress.trim() || noteDeliveryToAddress === 'Barabara ya Julius Nyerere, Dodoma.') {
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
      .map(item => `${item.productName} — ${item.qty} Pcs`)
      .join('\n\n');

    const customerName = del.customerName || 'Customer';
    const dnNo = `#DN-${new Date(del.timestamp || Date.now()).getFullYear()}-${del.id.toUpperCase().replace('DLV-', '').replace('DLV_', '').slice(0, 6)}`;
    const formattedDate = new Date(del.timestamp || Date.now()).toLocaleDateString([], { dateStyle: 'medium' });
    const deliveryAddress = del.notes || 'Specified drop-off location';

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
      await shareElementPdfToWhatsApp({
        elementId: 'delivery-note-print-area',
        fileName: `delivery-note-${dnNo}.pdf`,
        phone: del.customerPhone,
        message: `Hello ${customerName}, please find attached your delivery note PDF from ${activeTenant.name}. Thank you.`,
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
    { label: 'Pending', value: pendingDeliveries, tone: 'text-amber-700 bg-amber-50 border-amber-100' },
    { label: 'On route', value: dispatchedDeliveries, tone: 'text-sky-700 bg-sky-50 border-sky-100' },
    { label: 'Delivered', value: deliveredDeliveries, tone: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
    { label: 'Revenue', value: `${currency}${Math.round(deliveryIncomeTotal).toLocaleString()}`, tone: 'text-slate-800 bg-white border-slate-200' }
  ];

  return (
    <div className="space-y-5 pb-24 md:pb-8">
      {/* Tab Header Section */}
      <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 lg:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                <DeliveryMotorcycleIcon className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight font-sans leading-tight">
                  Delivery Operations
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 font-sans max-w-2xl mt-1 leading-relaxed">
                  Dispatch orders, manage delivery notes, track riders, and reconcile logistics payments.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 xl:min-w-[520px]">
            {deliveryStats.map((stat) => (
              <div key={stat.label} className={`rounded-2xl border px-3 py-3 ${stat.tone}`}>
                <span className="block text-[10px] font-black uppercase tracking-widest text-current/70 font-mono">{stat.label}</span>
                <span className="block mt-1 text-lg font-black font-mono leading-none">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop sub-tab navigation */}
        <div className="hidden md:flex bg-slate-50 border-t border-slate-200 p-2 gap-2 overflow-x-auto">
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
        <div className="md:hidden border-t border-slate-200 bg-slate-50 px-3 py-3">
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'queue' as const, label: 'Jobs', icon: Clipboard },
              { id: 'riders' as const, label: 'Crew', icon: UserCheck },
              { id: 'notes' as const, label: 'Notes', icon: FileText },
              { id: 'accounting' as const, label: 'Money', icon: Printer }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSubTabChange(tab.id)}
                  className={`min-h-[58px] rounded-2xl border flex flex-col items-center justify-center gap-1 text-[10px] font-black transition-all ${
                    isActive
                      ? 'bg-slate-950 text-white border-slate-950 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 active:bg-slate-100'
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
        <div className="space-y-5">
          {/* Quick Filters */}
          <div className="bg-white border border-slate-200 p-3 sm:p-4 rounded-2xl md:rounded-3xl flex flex-col sm:flex-row gap-3 shadow-xs md:sticky md:top-0 md:z-10">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Search deliveries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl sm:rounded-xl text-sm sm:text-xs pl-11 pr-4 py-3 sm:py-2.5 text-slate-800 placeholder-slate-400 font-sans focus:outline-none focus:border-emerald-500"
              />
              <Search className="absolute left-4 top-3.5 sm:top-3 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <button 
              onClick={() => setIsAddDeliveryModalOpen(true)}
              className="px-5 py-3 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-xs rounded-2xl sm:rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 flex flex-row items-center justify-center shrink-0 cursor-pointer min-h-[48px] sm:min-h-0"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Delivery
            </button>
          </div>

          {/* Delivery Jobs List Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 sm:gap-5">
            {filteredDeliveries.length === 0 ? (
              <div className="lg:col-span-2 2xl:col-span-3 text-center py-16 bg-white border border-slate-200 rounded-3xl text-sm font-mono text-slate-500 shadow-sm">
                <Truck className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                <p>No custom delivery dispatch queues recorded for this branch yet.</p>
              </div>
            ) : (
              filteredDeliveries.map(del => {
                const isPending = del.status === 'Pending Dispatch';
                const isDispatched = del.status === 'Dispatched';
                const isDelivered = del.status === 'Delivered';
                const isCancelled = del.status === 'Cancelled';

                return (
                  <div 
                    key={del.id}
                    className={`bg-white border rounded-2xl md:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all relative shadow-sm min-w-0 ${
                      isDelivered 
                        ? 'border-slate-200 bg-slate-50/50 opacity-90' 
                        : isCancelled 
                          ? 'border-red-150 bg-red-50/10 opacity-75'
                          : 'border-slate-220 hover:border-slate-350 hover:shadow-md'
                    }`}
                  >
                    {/* Header badge status */}
                    <div className="flex justify-between items-start gap-3 pb-3 border-b border-slate-100">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 block font-mono">ORDER REF: {del.saleId}</span>
                        <h4 className="font-extrabold text-base sm:text-sm text-slate-900 tracking-tight mt-0.5 truncate">{del.customerName}</h4>
                        {del.customerPhone && (
                          <span className="text-[11px] font-mono text-slate-500 flex items-center mt-0.5">
                            <Smartphone className="w-3 h-3 text-slate-400 mr-1 shrink-0" />
                            {del.customerPhone}
                          </span>
                        )}
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[9.5px] font-bold tracking-wider uppercase font-sans ${
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
                    <div className="py-3.5 space-y-1.5 flex-grow">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono block">Delivery Cargo</span>
                      <div className="max-h-[108px] sm:max-h-[85px] overflow-y-auto space-y-1.1 scrollbar-thin">
                        {del.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-slate-650">
                            <span className="font-medium truncate max-w-[70%]">{item.productName}</span>
                            <span className="font-bold font-mono text-slate-800 shrink-0 select-none">x{item.qty}</span>
                          </div>
                        ))}
                      </div>
                      
                      {/* Fees */}
                      <div className="pt-2 border-t border-slate-50 flex justify-between items-center text-xs">
                        <span className="text-slate-450">Delivery Charge Paid:</span>
                        <span className="font-bold font-mono text-sky-600">{currency}{Math.round(del.deliveryCost).toLocaleString()}</span>
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
                          onClick={() => handleOpenDispatch(del)}
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
                );
              })
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'riders' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8">
          {/* New Rider Registration Panel */}
          <div className="bg-white border border-slate-200 p-4 sm:p-6 rounded-2xl md:rounded-3xl space-y-5 shadow-sm height-fit self-start">
            <div className="space-y-1">
              <h4 className="font-extrabold text-slate-900 tracking-tight text-sm flex items-center space-x-2">
                <UserPlus className="w-4.5 h-4.5 text-emerald-600" />
                <span>Register Store Driver / Rider</span>
              </h4>
              <p className="text-[11px] text-slate-450 font-sans">
                Save active shop delivery drivers or motorcycle riders to choose immediately during sales dispatch.
              </p>
            </div>

            {riderSuccessMessage && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl py-2.5 px-4 text-[11px] text-emerald-800 animate-pulse font-medium">
                {riderSuccessMessage}
              </div>
            )}

            <form onSubmit={handleRegisterRiderSubmit} className="space-y-3.5 text-xs text-slate-700">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Driver/Rider Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Mwangi"
                  value={newRiderName}
                  onChange={(e) => setNewRiderName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.1 outline-none focus:border-emerald-500 font-sans text-xs text-slate-850 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Mobile WhatsApp Phone</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +234 802 123 4567"
                  value={newRiderPhone}
                  onChange={(e) => setNewRiderPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.1 outline-none focus:border-emerald-500 font-mono text-xs text-slate-850"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Classification</label>
                  <select
                    value={newRiderClassification}
                    onChange={(e) => setNewRiderClassification(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer font-sans text-xs text-slate-800 font-bold"
                  >
                    <option value="rider">Rider (Motorcycle/Tuktuk)</option>
                    <option value="driver">Driver (Car/Truck)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Vehicle Option</label>
                  <select
                    value={newRiderVehicleType}
                    onChange={(e) => setNewRiderVehicleType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer font-sans text-xs text-slate-800 font-bold"
                  >
                    <option value="motorcycle">Motorcycle</option>
                    <option value="tuktuk">Tuktuk</option>
                    <option value="car">Car / Delivery Van</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Vehicle Color</label>
                  <input
                    type="text"
                    placeholder="e.g. Yellow / Red"
                    value={newRiderVehicleColor}
                    onChange={(e) => setNewRiderVehicleColor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.1 outline-none focus:border-emerald-500 font-sans text-xs text-slate-850"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Plate Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KMRD 420A"
                    value={newRiderLicensePlate}
                    onChange={(e) => setNewRiderLicensePlate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.1 outline-none focus:border-emerald-500 font-mono text-xs text-slate-850 uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">
                  Driver Signature PNG (Fits inside 500x500 px)
                </label>
                <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
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
                    className="block w-full text-xs text-slate-500
                      file:mr-3 file:py-1 file:px-2.5
                      file:rounded-lg file:border-0
                      file:text-[10px] file:font-bold
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
                <p className="text-[9.5px] text-slate-450 font-sans italic leading-tight">Use 500x500 PNG.</p>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-2xl sm:rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer flex items-center justify-center space-x-1.5 select-none shadow-sm min-h-[48px]"
              >
                <Plus className="w-4.5 h-4.5" />
                <span>Save In-house Rider</span>
              </button>
            </form>
          </div>

          {/* Registered Crew List */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm p-4 sm:p-6 overflow-hidden">
            <h4 className="font-extrabold text-slate-900 tracking-tight text-sm pb-4 border-b border-slate-100 flex items-center space-x-2">
              <UserCheck className="w-4.5 h-4.5 text-emerald-600" />
              <span>Registered Branch Logistics Crew</span>
            </h4>

            {activeRiders.length === 0 ? (
              <div className="text-center py-20 font-mono text-xs text-slate-400">
                No permanent riders registered. Fill out the helper registry form on the left.
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs text-slate-750">
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
                          <p className="text-slate-805 font-bold">{crew.name}</p>
                          <p className="text-slate-450 text-[10.5px] font-mono mt-0.5">{crew.phone}</p>
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
                <div className="md:hidden mt-4 space-y-3">
                {activeRiders.map((crew) => (
                  <div key={crew.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Vehicle</span>
                        <span className="block mt-1 text-xs font-bold text-slate-800 capitalize">{crew.vehicleColor} {crew.vehicleType}</span>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
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
        <div className="space-y-6 select-text">
          {/* Active Editing Draft Mode Banner */}
          {activeEditingPendingNoteId && (
            <div className="bg-indigo-600 text-white p-4 rounded-3xl space-y-2 text-xs shadow-md">
              <p className="font-extrabold flex items-center gap-1.5 text-sm">
                <span>⚡ Resolve / Editing Pending Draft Mode Active</span>
              </p>
              <p className="text-indigo-100 text-[11px]">
                You are currently editing a template populated from a pending POS sale dispatch. Complete and save the note below to clear this draft.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveEditingPendingNoteId(null);
                  setNotePINo(`PI-${Math.floor(10000 + Math.random() * 90000)}`);
                  setNoteLPO(`LP-${Math.floor(100 + Math.random() * 900)}`);
                  setNoteDate(getTodayFormatted());
                  setNoteDeliveryToTitle('The President Office');
                  setNoteDeliveryToAddress('Barabara ya Julius Nyerere, Dodoma.');
                  setNoteTransportType('');
                  setNoteVehiclePlate('');
                  setNoteDeliveredByName('Lilian Mbawala');
                  setNoteDeliveredBySignature('Lilian M.');
                }}
                className="bg-indigo-700 hover:bg-indigo-805 text-white font-extrabold px-3 py-1.5 rounded-xl text-[10px] cursor-pointer transition-all border border-indigo-500"
              >
                Cancel Editing Draft (Reset Form)
              </button>
            </div>
          )}

          {/* Pending Delivery Drafts Section */}
          {pendingNotes && pendingNotes.length > 0 && (
            <div className="bg-amber-50/75 border border-amber-205 p-5 rounded-3xl space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="text-[10px] bg-amber-100 text-amber-800 uppercase px-2 py-0.5 rounded font-black font-mono tracking-wider">
                    ⏳ pending delivery note templates
                  </span>
                  <h4 className="font-extrabold text-slate-800 text-sm tracking-tight flex items-center gap-1.5">
                    <DeliveryMotorcycleIcon className="w-4 h-4 text-amber-600" />
                    <span>Incomplete / Pending Delivery Notes</span>
                  </h4>
                  <p className="text-[11px] text-slate-550">
                    The following orders were sent for delivery. Choose one to fill in mandatory logistics details and finalize printing.
                  </p>
                </div>
                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full">
                  {pendingNotes.length} Pending
                </span>
              </div>

              <div className="hidden md:block overflow-x-auto rounded-2xl border border-amber-200/60 bg-white">
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
                          activeEditingPendingNoteId === note.id ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {note.saleId || 'No Info'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-slate-900">{note.customerName}</div>
                          <div className="text-[10.5px] text-slate-450">{note.customerPhone || 'No Phone'}</div>
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
                              className="bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold px-3 py-1.5 rounded-lg text-[10.5px] transition-all cursor-pointer flex items-center gap-1 shadow-sm border-none"
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
              <div className="md:hidden space-y-3">
                {pendingNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`rounded-2xl border bg-white p-4 shadow-sm ${
                      activeEditingPendingNoteId === note.id ? 'border-indigo-200 bg-indigo-50/40' : 'border-amber-200/70'
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
                        className="bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold px-3 py-3 rounded-2xl text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm border-none min-h-[46px]"
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
          <div className="bg-white border border-slate-205 p-4 sm:p-5 rounded-2xl md:rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-0.5">
              <span className="text-[10px] bg-slate-100 text-slate-500 uppercase px-2 py-0.5 rounded font-bold font-mono">INTEGRATION WIDGET</span>
              <h4 className="font-extrabold text-slate-800 text-sm tracking-tight flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Fill Fields from Recent POS Deliveries</span>
              </h4>
              <p className="text-[11px] text-slate-450 font-sans">
                Selecting a recent sales order will automatically pull its customer info & item catalog list into this template.
              </p>
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Form Fields Side panel (Left - 5 columns) */}
            <div className="lg:col-span-12 xl:col-span-5 bg-white border border-slate-200 p-4 sm:p-6 rounded-2xl md:rounded-3xl space-y-6 shadow-sm xl:max-h-[85vh] overflow-y-auto scrollbar-thin">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <h4 className="font-black text-slate-900 tracking-tight text-sm">Delivery Note Custom Fields</h4>
                <button 
                  type="button" 
                  onClick={() => {
                    // Quick Reset
                    setNotePINo(`PI-${Math.floor(10000 + Math.random() * 90000)}`);
                    setNoteLPO(`LP-${Math.floor(100 + Math.random() * 900)}`);
                    setNoteDate(getTodayFormatted());
                    setNoteDeliveryToTitle('The President Office');
                    setNoteDeliveryToAddress('Barabara ya Julius Nyerere, Dodoma.');
                    setNoteDeclaration('Goods delivered in good order and condition.');
                    setNoteDeliveredByName('Lilian Mbawala');
                    setNoteDeliveredBySignature('Lilian M.');
                    setNoteDeliveredDate(getTodayFormatted());
                    setSelectedRiderForNoteId('');
                    setNoteItems([
                      { id: '1', description: 'Toilet Rim Block', unit: 'Boxes', qty: 7 },
                      { id: '2', description: 'Handwash Soap', unit: 'PC', qty: 7 },
                      { id: '3', description: 'Scrub dady Sponge', unit: 'Set', qty: 5 },
                      { id: '4', description: 'Organizer Basket Large', unit: 'PC', qty: 3 },
                      { id: '5', description: 'Organizer Basket small', unit: 'PC', qty: 4 },
                      { id: '6', description: 'Mable Tray', unit: 'PC', qty: 3 },
                      { id: '7', description: 'Pink Cleaning Paste', unit: 'PC', qty: 4 },
                      { id: '8', description: 'Flash Floor Cleaner 1L', unit: 'PC', qty: 3 },
                      { id: '9', description: 'Pink Cream Cleaner', unit: 'PC', qty: 6 },
                      { id: '10', description: 'Face towels', unit: 'PC', qty: 4 },
                      { id: '11', description: 'Various as per Proforma Invoice', unit: 'Lumpsum', qty: 1 }
                    ]);
                  }}
                  className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded hover:bg-emerald-100 transition-all cursor-pointer"
                >
                  Reload Default Template
                </button>
              </div>

              {/* Ref Meta Block */}
              <div className="space-y-3">
                <span className="text-[10px] font-black text-slate-400 block tracking-wider uppercase font-mono border-b pb-1">1. Note Reference Metadata</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
              <div className="space-y-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <span className="text-[10px] font-black text-indigo-700 block tracking-wider uppercase font-mono border-b pb-1">
                  2. Logistics & Fleet details (Mandatory)
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 font-sans block">Type of Transport</label>
                    <select
                      value={noteTransportType}
                      onChange={(e) => setNoteTransportType(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-xs font-semibold text-slate-800 focus:border-indigo-500 cursor-pointer"
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

              {/* Table Note Items Builder */}
              <div className="space-y-3 pb-3">
                <span className="text-[10px] font-black text-slate-400 block tracking-wider uppercase font-mono border-b pb-1">4. Delivery Items list ({noteItems.length})</span>
                
                {/* Loader from Products search query box */}
                {products && products.length > 0 && (
                  <div className="bg-slate-50 p-2.5 rounded-2xl space-y-1.5 border border-slate-150 relative">
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
                        className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs font-semibold text-slate-805 outline-none focus:border-indigo-505"
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

                <div className="bg-slate-50 p-3 rounded-2xl space-y-2 border border-slate-150">
                  <span className="text-[9.5px] font-black font-mono text-slate-450 uppercase block">Manual Line Addition</span>
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
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 outline-none text-xs font-sans text-slate-805"
                        />
                      </div>
                      <div>
                        <input 
                          type="number"
                          placeholder="Qty"
                          min="1"
                          value={newItemQty}
                          onChange={(e) => setNewItemQty(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 outline-none font-mono text-xs font-bold text-slate-805 text-center"
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
                          <p className="font-extrabold text-slate-850 truncate">{index + 1}. {item.description}</p>
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
                
                {/* Rider Match Association select list */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-sans block">Select System Logistics Driver / Rider Profile</label>
                  <select
                    value={selectedRiderForNoteId}
                    onChange={(e) => {
                      const rId = e.target.value;
                      setSelectedRiderForNoteId(rId);
                      const matched = riders.find(item => item.id === rId);
                      if (matched) {
                        setNoteDeliveredByName(matched.name);
                        setNoteDeliveredBySignature(matched.name.split(' ')[0] + '.');
                      } else {
                        setNoteDeliveredByName('');
                        setNoteDeliveredBySignature('');
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs font-semibold text-slate-705 py-1.5 outline-none cursor-pointer focus:border-indigo-500"
                  >
                    <option value="">-- Type Manually / External Delivery --</option>
                    {activeRiders.map(item => (
                      <option key={item.id} value={item.id}>{item.name} ({item.licensePlate} - {item.classification.toUpperCase()})</option>
                    ))}
                  </select>
                </div>

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
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none text-xs font-bold text-slate-805"
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
                      <div>
                        {/* Multi-toned brand title EXACT replication of logo */}
                        <h1 className="text-xl tracking-tight leading-tight">
                          <span className="block font-sans font-extrabold text-lg" style={{ color: computedInvoiceColor }}>{computedLogoName}</span>
                          <span className="block text-[11px] tracking-wider font-extrabold uppercase mt-0.5 font-sans text-slate-500">Official Delivery</span>
                        </h1>
                      </div>
                    </div>

                    {/* Right Header Details Column */}
                    <div className="text-right text-[10.5px] text-slate-800 space-y-0.5 leading-relaxed font-sans max-w-[320px] z-10">
                      <p className="font-extrabold text-slate-900 text-[11.5px]">{computedCompanyTitle}</p>
                      <p><span className="font-semibold text-slate-500">Address:</span> {computedCompanyAddress}</p>
                      <p><span className="font-semibold text-slate-500">Phone:</span> {computedCompanyPhone}</p>
                      <p><span className="font-semibold text-slate-500">Email:</span> {computedCompanyEmail}</p>
                    </div>
                  </div>

                  {/* 2. Center TIN Identification Row */}
                  <div className="text-center py-2 text-[11px] font-extrabold tracking-wider font-mono border-b border-slate-200 relative z-10" style={{ color: computedInvoiceColor }}>
                    TIN: {computedTIN}
                  </div>

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
                            <td className="py-2.5 px-4 text-center text-slate-650 font-medium font-sans">
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
                          <span className="text-slate-450 font-semibold min-w-16">Name:</span>
                          <span className="font-extrabold text-slate-900">{noteDeliveredByName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-450 font-semibold min-w-16">Signature:</span>
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
                          <span className="text-slate-450 font-semibold min-w-16">Date:</span>
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
                          <span className="text-slate-450 font-semibold min-w-16">Name:</span>
                          <div className="border-b border-slate-300 flex-grow h-4"></div>
                        </div>
                        <div className="flex gap-2 items-end">
                          <span className="text-slate-450 font-semibold min-w-16">Signature:</span>
                          <div className="border-b border-slate-300 flex-grow h-4"></div>
                        </div>
                        <div className="flex gap-2 items-end">
                          <span className="text-slate-450 font-semibold min-w-16">Date:</span>
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
        <div className="space-y-6">
          {(() => {
            const deliveryIncome = deliveries.reduce((sum, d) => sum + (d.deliveryCost || 0), 0);
            const deliveryExpenses = expenses?.filter(e => e.category === 'Delivery Expense' || e.category === 'Delivery Maintainance') || [];
            const totalDeliveryExpenses = deliveryExpenses.reduce((sum, e) => sum + e.amount, 0);
            const deliveryProfit = deliveryIncome - totalDeliveryExpenses;

            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl md:rounded-3xl p-5 md:p-6 relative overflow-hidden shadow-sm">
                    <div className="relative z-10">
                      <span className="block text-xs font-mono uppercase font-black text-emerald-600 tracking-wider mb-2">Total Delivery Income</span>
                      <span className="text-2xl md:text-3xl font-black font-mono text-emerald-900">{activeTenant.currency}{deliveryIncome.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl md:rounded-3xl p-5 md:p-6 relative overflow-hidden shadow-sm">
                    <div className="relative z-10">
                      <span className="block text-xs font-mono uppercase font-black text-rose-600 tracking-wider mb-2">Delivery Expenses</span>
                      <span className="text-2xl md:text-3xl font-black font-mono text-rose-900">{activeTenant.currency}{totalDeliveryExpenses.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className={`border rounded-2xl md:rounded-3xl p-5 md:p-6 relative overflow-hidden shadow-sm ${deliveryProfit >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="relative z-10">
                      <span className={`block text-xs font-mono uppercase font-black tracking-wider mb-2 ${deliveryProfit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>Net Delivery Profit</span>
                      <span className={`text-2xl md:text-3xl font-black font-mono ${deliveryProfit >= 0 ? 'text-indigo-900' : 'text-red-900'}`}>
                        {activeTenant.currency}{deliveryProfit.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delivery Payment Methods Accounting */}
                <div className="bg-slate-50/50 border border-slate-200 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm">
                  <h3 className="font-bold text-slate-700 tracking-tight mb-4 text-xs uppercase tracking-wider font-mono">
                    Payments Accounting
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
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
                        <div key={mode} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                          <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">{mode}</span>
                          <span className="text-lg font-black font-mono text-slate-800">{activeTenant.currency}{Math.round(amount).toLocaleString()}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Delivery Form for Expense */}
                <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm">
                  <h3 className="font-bold text-slate-800 tracking-tight mb-4 flex items-center space-x-2">
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
                    className="grid grid-cols-1 md:grid-cols-[minmax(220px,1fr)_12rem_auto] md:items-end gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Description</label>
                      <input 
                        type="text" 
                        name="desc"
                        required
                        placeholder="e.g. Engine Oil for Bodaboda"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Amount ({activeTenant.currency})</label>
                      <input 
                        type="number" 
                        name="amount"
                        required
                        min="1"
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-800 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button type="submit" className="px-6 py-3 md:py-2.5 bg-slate-900 text-white rounded-2xl md:rounded-xl text-xs font-bold transition-all hover:bg-slate-800 shrink-0 min-h-[48px] md:min-h-0">
                      Add Expense
                    </button>
                  </form>
                </div>

                {/* Delivery List Details */}
                <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl overflow-hidden shadow-sm mt-6">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 font-bold text-sm text-slate-800 flex items-center justify-between">
                    <span>Detailed Deliveries Record</span>
                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-mono">{deliveries.length} Records</span>
                  </div>
                  <div className="hidden md:block overflow-x-auto">
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
                  <div className="md:hidden p-3 space-y-3">
                    {deliveries.length === 0 ? (
                      <div className="px-4 py-8 text-center text-slate-400 text-sm">No deliveries recorded yet.</div>
                    ) : (
                      deliveries.map(d => {
                        const isDropdownOpen = openDropdownRow === d.id;
                        const shortCode = d.id.startsWith('del-') ? d.id.substring(4, 9).toUpperCase() : d.id.substring(0, 5).toUpperCase();
                        return (
                          <div key={d.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 relative">
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
                            <div className="grid grid-cols-2 gap-2 mt-4">
                              <div className="rounded-xl bg-white border border-slate-200 p-3">
                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Status</span>
                                <span className="block mt-1 text-xs font-bold text-slate-800">{d.status}</span>
                              </div>
                              <div className="rounded-xl bg-white border border-slate-200 p-3">
                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Amount</span>
                                <span className="block mt-1 text-xs font-black text-emerald-700 font-mono">{activeTenant.currency}{(d.deliveryCost || 0).toLocaleString()}</span>
                              </div>
                              <div className="rounded-xl bg-white border border-slate-200 p-3">
                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Payment</span>
                                <span className="block mt-1 text-xs font-bold text-slate-800 uppercase">{d.deliveryPaymentMethod || 'N/A'}</span>
                              </div>
                              <div className="rounded-xl bg-white border border-slate-200 p-3">
                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Rider</span>
                                <span className="block mt-1 text-xs font-bold text-slate-800 truncate">{d.riderDetails?.name || 'Unassigned'}</span>
                              </div>
                            </div>
                            {d.notes && (
                              <p className="mt-3 text-xs text-slate-600 leading-relaxed bg-white border border-slate-200 rounded-xl p-3">{d.notes}</p>
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
                        : 'text-slate-650 hover:bg-slate-200/50'
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
                        : 'text-slate-650 hover:bg-slate-200/50'
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
                              <p className="text-[10.5px] text-slate-450 mt-1 uppercase tracking-wider font-mono">
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 font-sans text-xs font-bold text-slate-850"
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer font-sans text-xs text-slate-850 font-bold"
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer font-sans text-xs text-slate-850 font-bold"
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 font-sans text-xs text-slate-850"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Registration Code</label>
                      <input
                        type="text"
                        placeholder="e.g. LG-934C-M"
                        value={tempLicensePlate}
                        onChange={(e) => setTempLicensePlate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 font-mono text-xs uppercase text-slate-850"
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
              <span className="text-[10px] bg-slate-200 text-slate-650 px-2.5 py-1 rounded-lg font-bold font-mono">
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
