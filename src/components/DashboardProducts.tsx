import React, { useState, useRef, useMemo, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tenant, Product, ProductBatch, SystemSettings } from '../types';
import { isDemoTenant } from '../utils/tenantIsolation';
import { 
  Plus, 
  Package, 
  Trash2, 
  AlertCircle, 
  TrendingUp, 
  Sparkles, 
  Check, 
  ArrowLeftRight, 
  X, 
  Upload, 
  Download, 
  Printer, 
  Wifi, 
  Bluetooth, 
  Search, 
  FileSpreadsheet, 
  Layers, 
  Camera, 
  Database, 
  RefreshCw,
  Sliders,
  CheckCircle,
  HelpCircle,
  MoreVertical,
  Eye,
  Edit,
  Scale,
  ChevronRight
} from 'lucide-react';
import { useTranslation } from '../LanguageContext';
import CachedImage, { evictImageCache } from './CachedImage';
import {
  addBatchToProduct,
  createInventoryBatch,
  detectPriceChange,
  getDefaultFractionOptions,
  mapCostingMethodToLegacy,
} from '../utils/inventoryCosting';
import { formatProductQuantity } from '../utils/unitFormatter';
import { compressImageFile } from '../utils/imageCompression';
import { safeSetJsonItem } from '../utils/dataSafety';
import { generateUniqueEan13Barcode } from '../utils/barcode';
import ModernSelect, { ModernSelectOption } from './ui/ModernSelect';
import DashboardBarcodeScanner from './DashboardBarcodeScanner';
import { loadBranchWorkspace, transferStockBetweenBranches } from '../branches/branchApi';
import type { BranchSummary } from '../branches/branchTypes';

interface DashboardProductsProps {
  activeTenant: Tenant;
  products: Product[];
  systemSettings?: SystemSettings;
  onUpdateSettings: (settings: SystemSettings) => void;
  onAddProduct: (prod: Product) => void;
  onDeleteProduct: (id: string) => void;
  onUpdateProducts: (updatedProducts: Product[]) => void;
  subscriptionStatus?: any;
  onTriggerUpgrade?: (limitType: 'products' | 'stores' | 'staff' | 'expired') => void;
}

export interface ProductBrand {
  name: string;
  logo?: string;
}

const COSTING_METHOD_OPTIONS: ModernSelectOption[] = [
  {
    value: 'fifo',
    label: 'FIFO',
    description: 'Old stock sells first · Recommended',
    icon: <Database className="h-4.5 w-4.5" strokeWidth={2.1} />,
  },
  {
    value: 'average_price',
    label: 'Average Price',
    description: 'Uses the blended product cost',
    icon: <Scale className="h-4.5 w-4.5" strokeWidth={2.1} />,
  },
  {
    value: 'batch_price',
    label: 'Batch Price',
    description: 'Uses active batch prices',
    icon: <Layers className="h-4.5 w-4.5" strokeWidth={2.1} />,
  },
];

const PHARMACY_PRODUCT_TYPE_OPTIONS: ModernSelectOption[] = [
  { value: 'pharmaceutical', label: 'Pharmaceutical' },
  { value: 'non_pharmaceutical', label: 'Non-pharmaceutical' },
];

const PHARMACY_BASE_UNIT_OPTIONS: ModernSelectOption[] = [
  { value: 'Tablet', label: 'Tablet' },
  { value: 'Capsule', label: 'Capsule' },
  { value: 'Dose', label: 'Dose' },
];

const PHARMACY_START_OPTIONS = {
  pharmaceutical: [
    { value: 'packet', label: 'Packet / Strip' },
    { value: 'box', label: 'Box / Carton' },
  ],
  nonPharmaceutical: [
    { value: 'carton', label: 'Carton' },
    { value: 'master_box', label: 'Master Box' },
  ],
} satisfies Record<string, ModernSelectOption[]>;

export default function DashboardProducts({ 
  activeTenant, 
  products,
  systemSettings,
  onUpdateSettings,
  onAddProduct,
  onDeleteProduct,
  onUpdateProducts,
  subscriptionStatus,
  onTriggerUpgrade
}: DashboardProductsProps) {
  const currency = activeTenant.currency;
  const { t } = useTranslation();
  
  // Tab selector: 'catalog' list vs 'labels' station
  const [viewTab, setViewTab] = useState<'catalog' | 'category' | 'brand' | 'labels'>('catalog');

  // Dropdown states — desktop inline dropdown only (mobile menus removed)
  const [desktopMenuId, setDesktopMenuId] = useState<string | null>(null);
  // Mobile bottom sheet state — mobile only
  const [mobileProductMenu, setMobileProductMenu] = useState<Product | null>(null);

  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [editStockDraft, setEditStockDraft] = useState({ shop: '', store: '', alert: '' });
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const getTotalStockQty = (shopQty: number, storeQty: number) => Number((Number(shopQty || 0) + Number(storeQty || 0)).toFixed(3));
  
  // Smart Batch Pricing & Restock
  const [replenishProduct, setReplenishProduct] = useState<Product | null>(null);
  const [replenishQty, setReplenishQty] = useState<number | ''>('');
  const [replenishCost, setReplenishCost] = useState<number | ''>('');
  const [replenishSupplier, setReplenishSupplier] = useState<string>('');
  const [replenishPriceAction, setReplenishPriceAction] = useState<'suggested' | 'keep' | 'custom'>('suggested');
  const [replenishCustomPrice, setReplenishCustomPrice] = useState<number | ''>('');
  const [replenishCostingMethod, setReplenishCostingMethod] = useState<'fifo' | 'average_price' | 'batch_price'>('fifo');

  // Stock Adjustment
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState<number | ''>('');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustSearch, setAdjustSearch] = useState<string>('');
  const [adjustSearchResults, setAdjustSearchResults] = useState<Product[]>([]);
  const [adjustShowSearch, setAdjustShowSearch] = useState(false);

  // Lock body scroll when product overlays are open
  useEffect(() => {
    if (mobileProductMenu || editingProduct || replenishProduct || adjustProduct || viewingProduct || productToDelete) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileProductMenu, editingProduct, replenishProduct, adjustProduct, viewingProduct, productToDelete]);

  // Mobile/tablet Add Product form gets a polished card layout below the xl
  // breakpoint; desktop keeps the original plain layout unchanged.
  const [isDesktopAddProductLayout, setIsDesktopAddProductLayout] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1280px)').matches : true
  );
  // Tracks whether the viewport is at least md-width (768px), so a couple of
  // grid rows inside the mobile Add Product form can switch column count
  // via inline style (which cannot be spoofed by any stylesheet cascade
  // issue) instead of relying purely on a Tailwind responsive className.
  const [isTabletWidthOrWider, setIsTabletWidthOrWider] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mqDesktop = window.matchMedia('(min-width: 1280px)');
    const mqTablet = window.matchMedia('(min-width: 768px)');
    const handleDesktopChange = () => setIsDesktopAddProductLayout(mqDesktop.matches);
    const handleTabletChange = () => setIsTabletWidthOrWider(mqTablet.matches);
    handleDesktopChange();
    handleTabletChange();
    mqDesktop.addEventListener('change', handleDesktopChange);
    mqTablet.addEventListener('change', handleTabletChange);
    return () => {
      mqDesktop.removeEventListener('change', handleDesktopChange);
      mqTablet.removeEventListener('change', handleTabletChange);
    };
  }, []);
  
  const [brand, setBrand] = useState(''); // New Brand input field for manual product creation
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [customBrands, setCustomBrands] = useState<ProductBrand[]>(() => (
    Array.isArray(systemSettings?.productStore?.brands) && systemSettings.productStore.brands.length > 0
      ? systemSettings.productStore.brands
      : isDemoTenant(activeTenant.id)
      ? [
          { name: 'Coca Cola', logo: '' },
          { name: 'Nestle', logo: '' },
          { name: 'Unilever', logo: '' },
          { name: 'Jasper Foods', logo: '' }
        ]
      : []
  ));
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string | null>(null);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandLogo, setNewBrandLogo] = useState('');

  useEffect(() => {
    if (!Array.isArray(systemSettings?.productStore?.brands)) return;
    setCustomBrands(systemSettings.productStore.brands);
  }, [systemSettings?.productStore?.brands, activeTenant.id]);

  const persistCustomBrands = (nextBrands: ProductBrand[]) => {
    setCustomBrands(nextBrands);
    onUpdateSettings({
      ...systemSettings,
      productStore: {
        ...systemSettings?.productStore,
        categories: systemSettings?.productStore?.categories || [],
        units: systemSettings?.productStore?.units || [],
        brands: nextBrands,
      },
    });
  };

  // Self-healing, reactive list of categories that merges pre-loaded products and custom ones, and user settings
  const categoriesList = useMemo(() => {
    const defaultCats = systemSettings?.productStore?.categories && systemSettings.productStore.categories.length > 0
      ? systemSettings.productStore.categories
      : (isDemoTenant(activeTenant.id) ? ['Groceries', 'Beverages', 'Dairy', 'Cooking Oils', 'Household', 'Consumer Electronics', 'Apparel'] : []);
    const set = new Set(defaultCats);
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    customCategories.forEach(c => set.add(c));
    return Array.from(set) as string[];
  }, [products, customCategories, systemSettings]);

  const unitsList = useMemo(() => {
    if (activeTenant.businessType === 'pharmacy') {
      return ['Master Box', 'Carton', 'Inner Box', 'Box', 'Packet', 'Strip', 'Blister', 'Bottle', 'Vial', 'Ampoule', 'Sachet', 'Dose', 'Tablet', 'Capsule', 'Piece'];
    }
    return systemSettings?.productStore?.units && systemSettings.productStore.units.length > 0
      ? systemSettings.productStore.units
      : (isDemoTenant(activeTenant.id) ? ['Pcs', 'Kgs', 'Ltrs', 'Boxes', 'Cartons'] : []);
  }, [activeTenant.businessType, systemSettings]);

  const categorySelectOptions = useMemo<ModernSelectOption[]>(() =>
    categoriesList.map((categoryName) => ({ value: categoryName, label: categoryName })),
  [categoriesList]);

  const unitSelectOptions = useMemo<ModernSelectOption[]>(() =>
    unitsList.map((unitName) => ({ value: unitName, label: unitName })),
  [unitsList]);

  const editUnitSelectOptions = useMemo<ModernSelectOption[]>(() => [
    { value: '', label: 'No unit' },
    ...unitSelectOptions,
  ], [unitSelectOptions]);

  // Self-healing, reactive list of brands that merges pre-loaded product brands and custom registered brands
  const brandsList = useMemo(() => {
    const brandsMap = new Map<string, ProductBrand>();
    
    // Add defaults
    customBrands.forEach(b => {
      brandsMap.set(b.name.toLowerCase(), b);
    });

    // Extract from existing products
    products.forEach(p => {
      if (p.brand && !brandsMap.has(p.brand.toLowerCase())) {
        brandsMap.set(p.brand.toLowerCase(), { name: p.brand, logo: '' });
      }
    });

    return Array.from(brandsMap.values());
  }, [products, customBrands]);

  const handleBeginEdit = (prod: Product) => {
    const editDraftNumber = (value: number | undefined | null) => {
      if (value === undefined || value === null || Number(value) === 0) return '';
      return String(value);
    };
    setEditingProduct(prod);
    setEditForm({ ...prod });
    setEditStockDraft({
      shop: editDraftNumber(prod.shopStockQty),
      store: editDraftNumber(prod.storeStockQty),
      alert: editDraftNumber(prod.alertQty),
    });
  };

  const runAfterMobileMenuClose = (action: () => void) => {
    setMobileProductMenu(null);
    window.setTimeout(action, 180);
  };

  const updateEditStockNumber = (
    field: 'shopStockQty' | 'storeStockQty' | 'alertQty',
    draftKey: 'shop' | 'store' | 'alert',
    rawValue: string,
  ) => {
    setEditStockDraft(prev => ({ ...prev, [draftKey]: rawValue }));
    if (rawValue === '') {
      setEditForm(prev => ({ ...prev, [field]: undefined }));
      return;
    }
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed)) {
      setEditForm(prev => ({ ...prev, [field]: Math.max(0, parsed) }));
    }
  };

  const editNumberValue = (value: number | string | undefined | null) => {
    if (value === undefined || value === null || value === '') return '';
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric === 0) return '';
    return String(value);
  };

  const getEditPharmacyStructure = (form: Partial<Product>) => {
    const levels = form.pharmacyUnitLevels || [];
    const productType = form.pharmacyProductType
      || (form.pharmacyHierarchyStart === 'master_box' || form.pharmacyHierarchyStart === 'carton' ? 'non_pharmaceutical' : 'pharmaceutical');
    const hierarchyStart = form.pharmacyHierarchyStart
      || (productType === 'non_pharmaceutical' ? 'carton' : 'packet');
    const base = form.pharmacyBaseUnit
      || levels[levels.length - 1]?.unit
      || form.pharmacyUnitBreakdown?.baseUnit
      || (productType === 'non_pharmaceutical' ? 'Piece' : 'Tablet');
    const doseQty = Math.max(1, Number((form as any).pharmacyDoseContains || levels.find(level => level.id === 'dose')?.quantityToBaseUnit || form.tabsPerDose || form.pharmacyUnitBreakdown?.tabletsPerStrip || 1));
    const middleLevel = levels.find(level => level.id === 'strip');
    const topLevel = levels.find(level => level.id === 'packet');
    const middleQty = Math.max(1, Number((form as any).pharmacyMiddleContains || (middleLevel ? Math.round(middleLevel.quantityToBaseUnit / doseQty) : undefined) || form.dosesPerPacket || form.pharmacyUnitBreakdown?.stripsPerBox || 1));
    const topQty = Math.max(1, Number((form as any).pharmacyTopContains || (topLevel && middleLevel ? Math.round(topLevel.quantityToBaseUnit / middleLevel.quantityToBaseUnit) : undefined) || 1));

    const hierarchy = buildPharmacyHierarchy(productType, hierarchyStart, base, topQty, middleQty, doseQty);
    return { productType, hierarchyStart, base, topQty, middleQty, doseQty, hierarchy };
  };

  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name) return;

    const enteredBarcode = String(editForm.barcode || '').trim();
    const finalizedEditBarcode = enteredBarcode || generateUniqueEan13Barcode(
      products.flatMap(product => [product.barcode, product.sku]),
    );

    // Upload new image to Supabase Storage if a new image was selected.
    // editForm.image = compressed base64 preview from the canvas.
    // We upload this base64 directly — same pattern as new product creation.
    let resolvedImageUrl = editForm.image;
    if (editForm.image && editForm.image.startsWith('data:image') && editingProduct?.id) {
      try {
        const migrateResp = await fetch('/api/images/migrate-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: activeTenant.id, productId: editingProduct.id, base64DataUrl: editForm.image }),
        });
        const migrateResult = await migrateResp.json();
        if (migrateResult.success && migrateResult.url) resolvedImageUrl = migrateResult.url;
        else console.warn('[DashboardProducts] Edit upload failed:', migrateResult.error);
      } catch (err) {
        console.warn('[DashboardProducts] Edit image upload failed, keeping preview:', err);
      }
      setEditImageFile(null);
    }

    // Evict old image from CachedImage memory + browser cache so new image shows immediately
    const oldImage = editingProduct?.image;
    if (oldImage && oldImage !== resolvedImageUrl && oldImage.startsWith('https://')) {
      evictImageCache(oldImage).catch(() => {});
    }
    // Also evict the new URL in case it was previously cached (upsert same path)
    if (resolvedImageUrl && resolvedImageUrl.startsWith('https://')) {
      evictImageCache(resolvedImageUrl).catch(() => {});
    }

    // Find product in products
    const updated = products.map(p => {
      if (p.id === editingProduct?.id) {
        const rawCostPrice = editForm.costPrice ?? 0;
        const sellPrice = editForm.sellInRetail !== false ? (editForm.sellingPrice ?? 0) : 0;
        const b = finalizedEditBarcode;
        const editPharmacy = getEditPharmacyStructure(editForm);
        const editDosesPerPacket = Math.max(1, Number(editPharmacy.middleQty || 1));
        const editTabsPerDose = Math.max(1, Number(editPharmacy.doseQty || 1));
        const editTopLevel = editPharmacy.hierarchy.levels[0];
        const editDoseLevel = editPharmacy.hierarchy.levels.find(level => level.id === 'dose') || editPharmacy.hierarchy.levels[1] || editTopLevel;
        const editTabsPerPacket = Math.max(1, Number(editTopLevel?.quantityToBaseUnit || editDosesPerPacket * editTabsPerDose));
        const editFullDosePrice = Number(editForm.fullDosePrice || (Number(editDoseLevel?.quantityToBaseUnit || editTabsPerDose) * Number(editForm.tabPrice || (editTabsPerPacket > 0 ? sellPrice / editTabsPerPacket : sellPrice))));
        const editHalfDosePrice = Number(editForm.halfDosePrice || editFullDosePrice / 2);
        const editTabPrice = Number(editForm.tabPrice || (editTabsPerPacket > 0 ? sellPrice / editTabsPerPacket : sellPrice));
        const editUsesMeasuredUnit = !!editForm.isBulkProduct || !!editForm.allowScaleSelling ||
          !!editForm.inventorySettings?.allowScaleSelling || editForm.sellingMode === 'scale' || editForm.sellingMode === 'hybrid';
        const editBaseUnit = editUsesMeasuredUnit
          ? editForm.baseUnit || editForm.inventorySettings?.baseUnit || editForm.sellUnit || editForm.unit || 'Unit'
          : editForm.unit || editForm.baseUnit || editForm.inventorySettings?.baseUnit || 'Unit';
        const editPurchaseUnit = editForm.purchaseUnit || editForm.inventorySettings?.purchaseUnit || editForm.bulkUnit || 'Package';
        const editConversionToBase = Math.max(0.001, Number(editForm.conversionToBaseUnit || editForm.inventorySettings?.conversionToBaseUnit || editForm.bulkPurchaseQty || 1));
        const editPricePerBase = Number(editForm.defaultPricePerBaseUnit || editForm.inventorySettings?.defaultPricePerBaseUnit || editForm.sellUnitPrice || sellPrice || 0);
        const editPackageBuyingCost = Number(editForm.packageBuyingCost || editForm.inventorySettings?.packageBuyingCost || rawCostPrice || 0);
        const editLedgerCostPrice = activeTenant.businessType !== 'pharmacy' && editForm.isBulkProduct
          ? editPackageBuyingCost / editConversionToBase
          : rawCostPrice;
        return {
          ...p,
          name: editForm.name || '',
          brand: editForm.brand ? editForm.brand.trim() : undefined,
          category: editForm.category || '',
          unit: activeTenant.businessType === 'pharmacy' ? editPharmacy.hierarchy.baseUnit : (editForm.unit || ''),
          barcode: b,
          costPrice: editLedgerCostPrice,
          sellingPrice: sellPrice,
          stockQty: getTotalStockQty(editForm.shopStockQty ?? 0, editForm.storeStockQty ?? 0),
          shopStockQty: editForm.shopStockQty ?? 0,
          storeStockQty: editForm.storeStockQty ?? 0,
          alertQty: editForm.alertQty ?? 5,
          image: resolvedImageUrl,
          sellInRetail: editForm.sellInRetail !== false,
          sellInWholesale: !!editForm.sellInWholesale,
          wholesalePrice: editForm.sellInWholesale ? (editForm.wholesalePrice ?? 0) : undefined,
          minWholesaleQty: editForm.sellInWholesale ? (editForm.minWholesaleQty ?? 10) : undefined,
          isBulkProduct: editForm.isBulkProduct,
          bulkUnit: editForm.isBulkProduct ? editPurchaseUnit : undefined,
          bulkPurchaseQty: editForm.isBulkProduct ? editConversionToBase : undefined,
          sellUnit: editForm.isBulkProduct ? editBaseUnit : undefined,
          sellUnitQty: editForm.isBulkProduct ? 1 : undefined,
          sellUnitPrice: editForm.isBulkProduct ? editPricePerBase : undefined,
          bulkToUnitsRatio: editForm.isBulkProduct ? editConversionToBase : undefined,
          sellingMode: editForm.isBulkProduct ? editForm.sellingMode : undefined,
          costingMethod: editForm.costingMethod || editForm.inventorySettings?.costingMethod || 'fifo',
          sellingMethod: mapCostingMethodToLegacy(editForm.costingMethod || editForm.inventorySettings?.costingMethod || 'fifo'),
          allowPosMethodOverride: !!editForm.allowPosMethodOverride,
          allowScaleSelling: activeTenant.businessType === 'pharmacy' ? false : (!!editForm.allowScaleSelling || !!editForm.isBulkProduct),
          purchaseUnit: activeTenant.businessType === 'pharmacy' ? editTopLevel.unit : editPurchaseUnit,
          baseUnit: activeTenant.businessType === 'pharmacy' ? editPharmacy.hierarchy.baseUnit : editBaseUnit,
          conversionToBaseUnit: activeTenant.businessType === 'pharmacy' ? editTabsPerPacket : editConversionToBase,
          packageUnitPrice: activeTenant.businessType === 'pharmacy' ? undefined : editPricePerBase,
          wholePackagePrice: activeTenant.businessType === 'pharmacy' ? undefined : editPricePerBase * editConversionToBase,
          halfPackagePrice: activeTenant.businessType === 'pharmacy' ? undefined : editPricePerBase * (editConversionToBase / 2),
          packageBuyingCost: activeTenant.businessType === 'pharmacy' ? undefined : editPackageBuyingCost,
          allowCustomQuantity: editForm.allowCustomQuantity !== false,
          defaultPricePerBaseUnit: editPricePerBase,
          fractionSaleOptions: activeTenant.businessType === 'pharmacy' ? undefined : (editForm.fractionSaleOptions || editForm.inventorySettings?.fractionSaleOptions),
          dosesPerPacket: activeTenant.businessType === 'pharmacy' ? editDosesPerPacket : editForm.dosesPerPacket,
          tabsPerDose: activeTenant.businessType === 'pharmacy' ? editTabsPerDose : editForm.tabsPerDose,
          tabsPerPack: activeTenant.businessType === 'pharmacy' ? editTabsPerPacket : editForm.tabsPerPack,
          pharmacyProductType: activeTenant.businessType === 'pharmacy' ? editPharmacy.productType : editForm.pharmacyProductType,
          pharmacyHierarchyStart: activeTenant.businessType === 'pharmacy' ? editPharmacy.hierarchyStart : editForm.pharmacyHierarchyStart,
          pharmacyBaseUnit: activeTenant.businessType === 'pharmacy' ? editPharmacy.hierarchy.baseUnit : editForm.pharmacyBaseUnit,
          pharmacyUnitLevels: activeTenant.businessType === 'pharmacy' ? editPharmacy.hierarchy.levels : editForm.pharmacyUnitLevels,
          allowsDosageDividing: activeTenant.businessType === 'pharmacy' ? true : editForm.allowsDosageDividing,
          packetPrice: activeTenant.businessType === 'pharmacy' ? sellPrice : editForm.packetPrice,
          fullDosePrice: activeTenant.businessType === 'pharmacy' ? editFullDosePrice : editForm.fullDosePrice,
          halfDosePrice: activeTenant.businessType === 'pharmacy' ? editHalfDosePrice : editForm.halfDosePrice,
          tabPrice: activeTenant.businessType === 'pharmacy' ? editTabPrice : editForm.tabPrice,
          pharmacyUnitBreakdown: activeTenant.businessType === 'pharmacy'
            ? {
              purchaseUnit: 'Packet',
              stripUnit: editDoseLevel.unit,
              baseUnit: editPharmacy.hierarchy.baseUnit,
              stripsPerBox: editDosesPerPacket,
              tabletsPerStrip: editTabsPerDose,
            }
            : (editForm.pharmacyUnitBreakdown || editForm.inventorySettings?.pharmacyUnitBreakdown),
          inventorySettings: {
            costingMethod: editForm.costingMethod || editForm.inventorySettings?.costingMethod || 'fifo',
            allowPosMethodOverride: !!editForm.allowPosMethodOverride,
            allowScaleSelling: activeTenant.businessType === 'pharmacy' ? false : (!!editForm.allowScaleSelling || !!editForm.isBulkProduct),
            purchaseUnit: activeTenant.businessType === 'pharmacy' ? editTopLevel.unit : editPurchaseUnit,
            baseUnit: activeTenant.businessType === 'pharmacy' ? editPharmacy.hierarchy.baseUnit : editBaseUnit,
            conversionToBaseUnit: activeTenant.businessType === 'pharmacy' ? editTabsPerPacket : editConversionToBase,
            packageUnitPrice: activeTenant.businessType === 'pharmacy' ? undefined : editPricePerBase,
            wholePackagePrice: activeTenant.businessType === 'pharmacy' ? undefined : editPricePerBase * editConversionToBase,
            halfPackagePrice: activeTenant.businessType === 'pharmacy' ? undefined : editPricePerBase * (editConversionToBase / 2),
            packageBuyingCost: activeTenant.businessType === 'pharmacy' ? undefined : editPackageBuyingCost,
            allowCustomQuantity: editForm.allowCustomQuantity !== false,
            defaultPricePerBaseUnit: editPricePerBase,
            fractionSaleOptions: activeTenant.businessType === 'pharmacy' ? undefined : (editForm.fractionSaleOptions || editForm.inventorySettings?.fractionSaleOptions),
            pharmacyUnitBreakdown: activeTenant.businessType === 'pharmacy'
              ? {
                purchaseUnit: editTopLevel.unit,
                stripUnit: editDoseLevel.unit,
                baseUnit: editPharmacy.hierarchy.baseUnit,
                stripsPerBox: editDosesPerPacket,
                tabletsPerStrip: editTabsPerDose,
              }
              : (editForm.pharmacyUnitBreakdown || editForm.inventorySettings?.pharmacyUnitBreakdown),
          },
          sku: b
        } as Product;
      }
      return p;
    });

    onUpdateProducts(updated);
    setEditingProduct(null);
    setEditForm({});
  };

  const handleGenerateEditBarcode = () => {
    const generatedBarcode = generateUniqueEan13Barcode(
      products.flatMap(product => [product.barcode, product.sku]),
    );
    setEditForm(prev => ({ ...prev, barcode: generatedBarcode }));
  };

  const getReplenishPricingPreview = (
    product: Product,
    qtyReceived: number,
    newBuyingCost: number,
    method: 'fifo' | 'average_price' | 'batch_price'
  ) => {
    const latestCost = product.latestBuyingPrice ?? product.costPrice ?? 0;
    const activeBatches = (product.batches || []).filter(batch => batch.status === 'active' && batch.quantityRemaining > 0);
    const batchQuantity = activeBatches.reduce((sum, batch) => sum + batch.quantityRemaining, 0);
    const batchValue = activeBatches.reduce((sum, batch) => sum + (batch.quantityRemaining * batch.buyingPrice), 0);
    const fallbackQuantity = batchQuantity > 0 ? batchQuantity : Number(product.stockQty || product.shopStockQty || 0) + Number(product.storeStockQty || 0);
    const fallbackValue = fallbackQuantity * (product.averageBuyingCost || latestCost);
    const currentQuantity = batchQuantity > 0 ? batchQuantity : fallbackQuantity;
    const currentValue = batchQuantity > 0 ? batchValue : fallbackValue;
    const currentAverageCost = currentQuantity > 0 ? currentValue / currentQuantity : (product.averageBuyingCost || latestCost);
    const nextAverageCost = (currentQuantity + qtyReceived) > 0
      ? (currentValue + (qtyReceived * newBuyingCost)) / (currentQuantity + qtyReceived)
      : newBuyingCost;

    const previousBasis = method === 'average_price' ? currentAverageCost : latestCost;
    const nextBasis = method === 'average_price' ? nextAverageCost : newBuyingCost;
    const marginRatio = previousBasis > 0 ? product.sellingPrice / previousBasis : 1.5;
    const suggestedPrice = Math.round(nextBasis * marginRatio);

    return {
      previousBasis,
      nextBasis,
      suggestedPrice,
      priceChange: detectPriceChange(previousBasis, nextBasis),
      currentQuantity,
      methodName: method === 'average_price' ? 'Average' : method === 'batch_price' ? 'Batch Price' : 'FIFO',
      previousLabel: method === 'average_price' ? 'Current Avg Cost:' : 'Previous Buying Price:',
      nextLabel: method === 'average_price' ? 'New Avg Cost:' : 'New Buying Price:',
      note: method === 'average_price'
        ? 'Uses blended cost from old stock and this batch.'
        : method === 'batch_price'
          ? 'Uses this batch price in POS.'
          : 'Uses oldest available batch first in POS.',
    };
  };

  const handleReplenishSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replenishProduct || !replenishQty || Number(replenishQty) <= 0 || !replenishCost) return;
    
    const receivedPackageQty = Number(replenishQty);
    const receivedPackageCost = Number(replenishCost);
    const isRetailBulk = activeTenant.businessType !== 'pharmacy' && replenishProduct.isBulkProduct;
    const replenishConversion = Math.max(
      0.001,
      Number(replenishProduct.inventorySettings?.conversionToBaseUnit || replenishProduct.conversionToBaseUnit || replenishProduct.bulkPurchaseQty || 1)
    );
    const qty = isRetailBulk ? receivedPackageQty * replenishConversion : receivedPackageQty;
    const newCost = isRetailBulk ? receivedPackageCost / replenishConversion : receivedPackageCost;
    const method = replenishCostingMethod;
    const pricingPreview = getReplenishPricingPreview(replenishProduct, qty, newCost, method);
    
    let finalSellingPrice = replenishProduct.sellingPrice;
    if (replenishPriceAction === 'suggested') {
        finalSellingPrice = pricingPreview.suggestedPrice;
    } else if (replenishPriceAction === 'custom' && replenishCustomPrice) {
        finalSellingPrice = Number(replenishCustomPrice);
    }

    const productForBatch: Product = {
      ...replenishProduct,
      costPrice: isRetailBulk ? newCost : replenishProduct.costPrice,
      packageBuyingCost: isRetailBulk ? receivedPackageCost : replenishProduct.packageBuyingCost,
      costingMethod: method,
      sellingMethod: mapCostingMethodToLegacy(method),
      inventorySettings: {
        costingMethod: method,
        allowPosMethodOverride: replenishProduct.inventorySettings?.allowPosMethodOverride ?? replenishProduct.allowPosMethodOverride ?? false,
        allowScaleSelling: replenishProduct.inventorySettings?.allowScaleSelling ?? replenishProduct.allowScaleSelling ?? !!replenishProduct.isBulkProduct,
        purchaseUnit: replenishProduct.inventorySettings?.purchaseUnit || replenishProduct.purchaseUnit || replenishProduct.bulkUnit || replenishProduct.unit || 'Unit',
        baseUnit: replenishProduct.inventorySettings?.baseUnit || replenishProduct.baseUnit || replenishProduct.sellUnit || replenishProduct.unit || 'Unit',
        conversionToBaseUnit: replenishProduct.inventorySettings?.conversionToBaseUnit || replenishProduct.conversionToBaseUnit || 1,
        packageBuyingCost: isRetailBulk ? receivedPackageCost : replenishProduct.inventorySettings?.packageBuyingCost,
        allowCustomQuantity: replenishProduct.inventorySettings?.allowCustomQuantity ?? replenishProduct.allowCustomQuantity ?? true,
        defaultPricePerBaseUnit: replenishProduct.inventorySettings?.defaultPricePerBaseUnit ?? replenishProduct.defaultPricePerBaseUnit ?? replenishProduct.sellUnitPrice,
        fractionSaleOptions: replenishProduct.inventorySettings?.fractionSaleOptions || replenishProduct.fractionSaleOptions,
        pharmacyUnitBreakdown: replenishProduct.inventorySettings?.pharmacyUnitBreakdown || replenishProduct.pharmacyUnitBreakdown,
      },
    };
    const newBatch: ProductBatch = createInventoryBatch(productForBatch, qty, newCost, {
      supplierName: replenishSupplier || undefined,
      finalSellingPrice,
    });

    const productWithBatch = addBatchToProduct(productForBatch, newBatch, 'store');
    const updatedProduct: Product = {
      ...productWithBatch,
      sellingPrice: finalSellingPrice,
      sellUnitPrice: isRetailBulk ? finalSellingPrice : productForBatch.sellUnitPrice,
      defaultPricePerBaseUnit: isRetailBulk ? finalSellingPrice : productForBatch.defaultPricePerBaseUnit,
      packageUnitPrice: isRetailBulk ? finalSellingPrice : productForBatch.packageUnitPrice,
      wholePackagePrice: isRetailBulk ? finalSellingPrice * replenishConversion : productForBatch.wholePackagePrice,
      halfPackagePrice: isRetailBulk ? finalSellingPrice * (replenishConversion / 2) : productForBatch.halfPackagePrice,
      packageBuyingCost: isRetailBulk ? receivedPackageCost : productForBatch.packageBuyingCost,
      inventorySettings: {
        ...(productWithBatch.inventorySettings || productForBatch.inventorySettings),
        defaultPricePerBaseUnit: isRetailBulk ? finalSellingPrice : productForBatch.inventorySettings?.defaultPricePerBaseUnit,
        packageUnitPrice: isRetailBulk ? finalSellingPrice : productForBatch.inventorySettings?.packageUnitPrice,
        wholePackagePrice: isRetailBulk ? finalSellingPrice * replenishConversion : productForBatch.inventorySettings?.wholePackagePrice,
        halfPackagePrice: isRetailBulk ? finalSellingPrice * (replenishConversion / 2) : productForBatch.inventorySettings?.halfPackagePrice,
        packageBuyingCost: isRetailBulk ? receivedPackageCost : productForBatch.inventorySettings?.packageBuyingCost,
      },
    };

    onUpdateProducts(products.map(p => p.id === replenishProduct.id ? updatedProduct : p));

    setReplenishProduct(null);
    setReplenishQty('');
    setReplenishCost('');
    setReplenishSupplier('');
    setReplenishPriceAction('suggested');
    setReplenishCostingMethod('fifo');
    setReplenishCustomPrice('');
  };

  const adjustSearchProducts = (query: string) => {
    setAdjustSearch(query);
    if (!query.trim()) { setAdjustSearchResults([]); return; }
    const q = query.toLowerCase();
    const results = products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    ).slice(0, 8);
    setAdjustSearchResults(results);
  };

  const handleAdjustStock = (type: 'add' | 'deduct') => {
    if (!adjustProduct || !adjustQty || Number(adjustQty) <= 0) return;
    const qty = Number(adjustQty);
    const currentStock = adjustProduct.shopStockQty ?? adjustProduct.stockQty ?? 0;
    const newStock = type === 'add' ? currentStock + qty : Math.max(0, currentStock - qty);

    const updatedProduct: Product = {
      ...adjustProduct,
      stockQty: newStock,
      shopStockQty: newStock,
    };
    onUpdateProducts(products.map(p => p.id === adjustProduct.id ? updatedProduct : p));

    // Log the adjustment for reporting
    const log = {
      id: `adj-${Date.now()}`,
      productId: adjustProduct.id,
      productName: adjustProduct.name,
      sku: adjustProduct.sku || '',
      type,
      qty,
      previousStock: currentStock,
      newStock,
      reason: adjustReason || (type === 'add' ? 'Manual addition' : 'Manual deduction'),
      adjustedAt: new Date().toISOString(),
      tenantId: (activeTenant as any)?.id || '',
    };
    const existing = JSON.parse(onlineStorage.getItem('jasper_stock_adjustments') || '[]');
    existing.unshift(log);
    safeSetJsonItem('jasper_stock_adjustments', existing.slice(0, 1000), {
      tenantId: (activeTenant as any)?.id || '',
      dataKey: 'stock_adjustments',
      logLabel: `${(activeTenant as any)?.id || 'global'}/stock-adjustments`,
    });

    // Reset
    setAdjustProduct(null);
    setAdjustQty('');
    setAdjustReason('');
    setAdjustSearch('');
    setAdjustSearchResults([]);
    setAdjustShowSearch(false);
  };

  const handleBrandLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageFile(file, { maxWidth: 512, maxHeight: 512, quality: 0.72 });
    setNewBrandLogo(compressed);
  };

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Add Product Panel state
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState(categoriesList[0] || '');
  const [unit, setUnit] = useState(unitsList[0] || 'Pcs');
  const [costPrice, setCostPrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [shopStockQty, setShopStockQty] = useState(0);
  const [storeStockQty, setStoreStockQty] = useState(0);
  const [alertQty, setAlertQty] = useState(0);
  const [productImage, setProductImage] = useState<string>('');
  const [productImageFile, setProductImageFile] = useState<File | null>(null); // raw file for Supabase Storage upload

  // Image Processing state
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Form notifications
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Retail & Wholesale Form states
  const [sellInRetail, setSellInRetail] = useState(true);
  const [sellInWholesale, setSellInWholesale] = useState(false);
  const [wholesalePrice, setWholesalePrice] = useState(0);
  const [minWholesaleQty, setMinWholesaleQty] = useState(0);
  
  // Bulk-To-Unit Selling Form states
  const [isBulkProduct, setIsBulkProduct] = useState(false);
  const [sellingMode, setSellingMode] = useState<'standard' | 'scale' | 'pcs' | 'hybrid'>('scale');
  const [bulkUnit, setBulkUnit] = useState('KG');
  const [bulkPurchaseQty, setBulkPurchaseQty] = useState<number | ''>('');
  const [sellUnit, setSellUnit] = useState('kg');
  const [sellUnitQty, setSellUnitQty] = useState<number | ''>('');
  const [sellUnitPrice, setSellUnitPrice] = useState<number | ''>('');
  const [costingMethod, setCostingMethod] = useState<'fifo' | 'average_price' | 'batch_price'>('fifo');
  const [allowPosMethodOverride, setAllowPosMethodOverride] = useState(false);
  const [allowScaleSelling, setAllowScaleSelling] = useState(false);
  const [purchaseUnit, setPurchaseUnit] = useState('Sack');
  const [baseUnit, setBaseUnit] = useState('Kg');
  const [conversionToBaseUnit, setConversionToBaseUnit] = useState<number | ''>('');
  const [allowCustomQuantity, setAllowCustomQuantity] = useState(true);
  const [dosesPerPacket, setDosesPerPacket] = useState<number | ''>('');
  const [tabsPerDose, setTabsPerDose] = useState<number | ''>('');
  const [fullDosePrice, setFullDosePrice] = useState<number | ''>(0);
  const [halfDosePrice, setHalfDosePrice] = useState<number | ''>(0);
  const [tabPrice, setTabPrice] = useState<number | ''>(0);
  const [pharmacyProductType, setPharmacyProductType] = useState<'pharmaceutical' | 'non_pharmaceutical'>('pharmaceutical');
  const [pharmacyHierarchyStart, setPharmacyHierarchyStart] = useState<'box' | 'packet' | 'master_box' | 'carton'>('packet');
  const [pharmacyBaseUnit, setPharmacyBaseUnit] = useState('Tablet');
  const [pharmacyTopContains, setPharmacyTopContains] = useState<number | ''>(10);
  const [pharmacyMiddleContains, setPharmacyMiddleContains] = useState<number | ''>(10);
  const [pharmacyDoseContains, setPharmacyDoseContains] = useState<number | ''>(1);

  const buildPharmacyHierarchy = (
    productType: 'pharmaceutical' | 'non_pharmaceutical',
    start: 'box' | 'packet' | 'master_box' | 'carton',
    base: string,
    topContains: number,
    middleContains: number,
    doseContains: number
  ) => {
    const safeTop = Math.max(1, Number(topContains) || 1);
    const safeMiddle = Math.max(1, Number(middleContains) || 1);
    const safeDose = Math.max(1, Number(doseContains) || 1);
    if (productType === 'non_pharmaceutical') {
      if (start === 'master_box') {
        return {
          baseUnit: 'Piece',
          levels: [
            { id: 'packet', label: 'Master Box', unit: 'Master Box', quantityToBaseUnit: safeTop * safeMiddle },
            { id: 'strip', label: 'Carton / Inner Box', unit: 'Carton', quantityToBaseUnit: safeMiddle },
            { id: 'tabs', label: 'Piece', unit: 'Piece', quantityToBaseUnit: 1 },
          ]
        };
      }
      return {
        baseUnit: 'Piece',
        levels: [
          { id: 'packet', label: 'Carton', unit: 'Carton', quantityToBaseUnit: safeMiddle },
          { id: 'tabs', label: 'Piece', unit: 'Piece', quantityToBaseUnit: 1 },
        ]
      };
    }

    const resolvedBase = base || 'Tablet';
    if (start === 'box') {
      return {
        baseUnit: resolvedBase,
        levels: [
          { id: 'packet', label: 'Box / Carton', unit: 'Box', quantityToBaseUnit: safeTop * safeMiddle * safeDose },
          { id: 'strip', label: 'Packet / Strip', unit: 'Strip', quantityToBaseUnit: safeMiddle * safeDose },
          { id: 'dose', label: 'Dose', unit: 'Dose', quantityToBaseUnit: safeDose },
          { id: 'tabs', label: resolvedBase, unit: resolvedBase, quantityToBaseUnit: 1 },
        ]
      };
    }
    return {
      baseUnit: resolvedBase,
      levels: [
        { id: 'packet', label: 'Packet / Strip', unit: 'Strip', quantityToBaseUnit: safeMiddle * safeDose },
        { id: 'dose', label: 'Dose', unit: 'Dose', quantityToBaseUnit: safeDose },
        { id: 'tabs', label: resolvedBase, unit: resolvedBase, quantityToBaseUnit: 1 },
      ]
    };
  };

  const pharmacyFormHierarchy = useMemo(() => buildPharmacyHierarchy(
    pharmacyProductType,
    pharmacyHierarchyStart,
    pharmacyBaseUnit,
    Number(pharmacyTopContains) || 1,
    Number(pharmacyMiddleContains || dosesPerPacket) || 1,
    Number(pharmacyDoseContains || tabsPerDose) || 1
  ), [pharmacyProductType, pharmacyHierarchyStart, pharmacyBaseUnit, pharmacyTopContains, pharmacyMiddleContains, pharmacyDoseContains, dosesPerPacket, tabsPerDose]);

  // Real camera/USB/manual scanner in the product form.
  const [isFormScannerOpen, setIsFormScannerOpen] = useState(false);

  // Bulk Import state
  const [csvUploadError, setCsvUploadError] = useState<string | null>(null);
  const [csvUploadSuccess, setCsvUploadSuccess] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Stock Transfer Modal state
  const [transferProduct, setTransferProduct] = useState<Product | null>(null);
  const [transferQty, setTransferQty] = useState<number>(1);
  const [transferDirection, setTransferDirection] = useState<'store_to_shop' | 'shop_to_store' | 'branch_to_branch'>('store_to_shop');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<boolean>(false);
  const [transferBranches, setTransferBranches] = useState<BranchSummary[]>([]);
  const [transferSourceBranchId, setTransferSourceBranchId] = useState('');
  const [transferDestinationBranchId, setTransferDestinationBranchId] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  useEffect(() => {
    if (!transferProduct || subscriptionStatus?.state?.planId !== 'tanzanite') return;
    let cancelled = false;
    loadBranchWorkspace()
      .then(workspace => {
        if (cancelled || !workspace.entitlement.canOperateAdditionalBranches) return;
        const branches = workspace.directory.branches.filter(branch =>
          branch.id && branch.status === 'active' && branch.relationshipType !== 'independent_business'
        );
        setTransferBranches(branches);
        const selectedId = workspace.context.selectedBranch?.id || branches[0]?.id || '';
        setTransferSourceBranchId(selectedId || '');
        setTransferDestinationBranchId(branches.find(branch => branch.id !== selectedId)?.id || '');
      })
      .catch(() => {
        if (!cancelled) setTransferBranches([]);
      });
    return () => { cancelled = true; };
  }, [transferProduct, subscriptionStatus?.state?.planId]);

  // Barcode Printing Station States
  const [selectedLabels, setSelectedLabels] = useState<Record<string, boolean>>({});
  const [printQuantities, setPrintQuantities] = useState<Record<string, number>>({});
  const [labelSize, setLabelSize] = useState<'thermal' | 'a4'>('thermal');
  const [printLayoutOption, setPrintLayoutOption] = useState<'name_price' | 'name_barcode' | 'only_barcode'>('name_price');
  const [labelSearchQuery, setLabelSearchQuery] = useState('');
  const [connectionType, setConnectionType] = useState<'usb' | 'wifi' | 'bluetooth'>('usb');
  
  // Printer config variables
  const [selectedUsbPort, setSelectedUsbPort] = useState('COM3 (XP-365B Thermal Label printer)');
  const [selectedBtDevice, setSelectedBtDevice] = useState('RP85 Mobile Printer (paired)');
  const [wifiIpAddress, setWifiIpAddress] = useState('192.168.1.120');
  const [wifiPort, setWifiPort] = useState('9100');
  const [isConnectingPrinter, setIsConnectingPrinter] = useState(false);
  const [isPrinterConnected, setIsPrinterConnected] = useState(true);
  const [showTestPrintModal, setShowTestPrintModal] = useState(false);
  const [isPrintingJob, setIsPrintingJob] = useState(false);
  const [printJobSuccess, setPrintJobSuccess] = useState(false);

  // Profit/Telemetry calculations
  const effectiveCostPrice = isBulkProduct && activeTenant.businessType !== 'pharmacy'
    ? costPrice / Math.max(0.001, Number(conversionToBaseUnit) || Number(bulkPurchaseQty) || 1)
    : costPrice;
  const effectiveSellingPrice = isBulkProduct && activeTenant.businessType !== 'pharmacy'
    ? Number(sellUnitPrice) || sellingPrice
    : sellingPrice;
  const profit = effectiveSellingPrice - effectiveCostPrice;
  const markup = effectiveCostPrice > 0 ? (profit / effectiveCostPrice) * 100 : 0;
  const margin = effectiveSellingPrice > 0 ? (profit / effectiveSellingPrice) * 100 : 0;

  // Filter products matching print label query
  const labelSearchResults = useMemo(() => {
    if (!labelSearchQuery.trim()) return [];
    const query = labelSearchQuery.toLowerCase();
    return products.filter(p => 
      String(p.name || '').toLowerCase().includes(query) ||
      String(p.barcode || '').toLowerCase().includes(query)
    );
  }, [products, labelSearchQuery]);

  // Flattened labels list to represent duplicate copies in preview
  const flattenedLabelsForPreview = useMemo(() => {
    const list: Product[] = [];
    products.forEach(p => {
      if (selectedLabels[p.id]) {
        const count = printQuantities[p.id] || 0;
        for (let i = 0; i < count; i++) {
          list.push(p);
        }
      }
    });
    return list;
  }, [products, selectedLabels, printQuantities]);

  // Initialize labels state when switching tabs
  const handleTabSwitch = (tab: 'catalog' | 'category' | 'brand' | 'labels') => {
    setViewTab(tab);
    if (tab === 'labels') {
      const initialSelected: Record<string, boolean> = {};
      const initialQty: Record<string, number> = {};
      // default pre-populate first 3 products for initial preview visibility
      products.slice(0, 3).forEach(p => {
        initialSelected[p.id] = true;
        initialQty[p.id] = 5; // default print qty
      });
      setSelectedLabels(initialSelected);
      setPrintQuantities(initialQty);
      setLabelSearchQuery('');
    }
  };

  // 1. DYNAMIC IMAGE PROCESSING CANVAS ENGINE
  // Compresses, crop/fit on 500x500 box, separates foreground, and aligns standard catalog branding
  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProductImageFile(file); // store raw file for Supabase Storage upload

    setIsProcessingImage(true);
    setProcessingStatus('Reading image asset...');

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setProcessingStatus('Isolating background features...');
        setTimeout(() => {
          setProcessingStatus('Forcing aspect correct dimensions on 500x500 PNG...');
          
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 500;
            canvas.height = 500;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              // Ensure background is fully transparent (no white fill)
              ctx.clearRect(0, 0, 500, 500);

              // Calculate aspect-ratio fitting centered inside the 500x500 canvas
              const maxDim = 460; // 20px padding for beautiful visual display bounds
              let w = img.width;
              let h = img.height;
              
              if (w > h) {
                h = (h / w) * maxDim;
                w = maxDim;
              } else {
                w = (w / h) * maxDim;
                h = maxDim;
              }

              const x = (500 - w) / 2;
              const y = (500 - h) / 2;
              
              ctx.drawImage(img, x, y, w, h);

              // Remove solid/light/white backgrounds to isolate the object (Transparency)
              try {
                const imgData = ctx.getImageData(0, 0, 500, 500);
                const data = imgData.data;
                
                // Sample corner pixel as the background color (top-left) to automatically key it out
                const bgR = data[0];
                const bgG = data[1];
                const bgB = data[2];
                const bgA = data[3];

                const threshold = 40; // Sensitivity for color matching

                if (bgA > 50) {
                  for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i+1];
                    const b = data[i+2];
                    const a = data[i+3];

                    // Distance from sampled background color
                    const dist = Math.sqrt(
                      Math.pow(r - bgR, 2) +
                      Math.pow(g - bgG, 2) +
                      Math.pow(b - bgB, 2)
                    );

                    // Also automatically key out near-whites/light grays
                    const isNearWhite = (r > 230 && g > 230 && b > 230);

                    if (dist < threshold || isNearWhite) {
                      data[i+3] = 0; // Set pixel to fully transparent
                    }
                  }
                } else {
                  // If background is already transparent, still remove any other near-white background mattes
                  for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i+1];
                    const b = data[i+2];
                    if (r > 230 && g > 230 && b > 230) {
                      data[i+3] = 0;
                    }
                  }
                }
                ctx.putImageData(imgData, 0, 0);
              } catch (bgErr) {
                console.error('Background removal filter failure', bgErr);
              }
              
              // Export as compressed transparent WebP to preserve "no background" with less storage.
              const transparentBase64 = canvas.toDataURL('image/webp', 0.72);
              setProductImage(transparentBase64);
              setProcessingStatus('Transparent 500x500 asset generated!');
            }
          } catch (err) {
            console.error('Canvas manipulation failure', err);
          }
          
          setTimeout(() => {
            setIsProcessingImage(false);
            setProcessingStatus('');
          }, 600);
        }, 600);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 2. BARCODE VALUE GENERATOR OR SCAN ACTIONS
  const generateManualBarcodeValue = () => {
    const random8 = Math.floor(10000000 + Math.random() * 90000000);
    setBarcode(`${random8}`);
  };

  // Handle Create Product
  const handleCreateProduct = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name) {
      setFormError('Product Name is required.');
      return;
    }

    if (!sellInRetail && !sellInWholesale) {
      setFormError('Please enable at least one channel (Retail or Wholesale).');
      return;
    }

    const finalSellingPrice = sellInRetail ? sellingPrice : 0;
    const finalWholesalePrice = sellInWholesale ? wholesalePrice : 0;
    const finalMinWholesaleQty = sellInWholesale ? minWholesaleQty : 0;

    if (sellInRetail && finalSellingPrice <= 0) {
      setFormError('Retail price must be greater than zero when selling in retail.');
      return;
    }

    if (sellInWholesale) {
      if (finalWholesalePrice <= 0) {
        setFormError('Wholesale price must be greater than zero when selling in wholesale.');
        return;
      }
      if (finalMinWholesaleQty <= 0) {
        setFormError('Minimum wholesale quantity must be greater than zero.');
        return;
      }
      if (sellInRetail && finalWholesalePrice >= finalSellingPrice) {
        setFormError('Wholesale price must be strictly lower than the retail price.');
        return;
      }
    }

    if (subscriptionStatus) {
      if (subscriptionStatus.isExpired) {
        onTriggerUpgrade?.('expired');
        return;
      }
      if (products.length >= subscriptionStatus.plan.maxProducts) {
        onTriggerUpgrade?.('products');
        return;
      }
    }

    // Use barcode, or automatically generate one if left blank
    const finalizedBarcode = barcode.trim() || generateUniqueEan13Barcode(
      products.flatMap(product => [product.barcode, product.sku]),
    );
    const hierarchy = buildPharmacyHierarchy(
      pharmacyProductType,
      pharmacyHierarchyStart,
      pharmacyBaseUnit,
      Number(pharmacyTopContains) || 1,
      Number(pharmacyMiddleContains || dosesPerPacket) || 1,
      Number(pharmacyDoseContains || tabsPerDose) || 1
    );
    const pharmacyTopLevel = hierarchy.levels[0];
    const pharmacyDosesPerPacket = Math.max(1, Number(pharmacyMiddleContains || dosesPerPacket) || 1);
    const pharmacyTabsPerDose = Math.max(1, Number(pharmacyDoseContains || tabsPerDose) || 1);
    const pharmacyTabsPerPacket = Math.max(1, pharmacyTopLevel.quantityToBaseUnit);
    const pharmacyPacketPrice = finalSellingPrice;
    const pharmacyTabPrice = Number(tabPrice) || (pharmacyPacketPrice / pharmacyTabsPerPacket);
    const pharmacyFullDosePrice = Number(fullDosePrice) || (pharmacyTabPrice * (hierarchy.levels.find(level => level.id === 'dose')?.quantityToBaseUnit || pharmacyTabsPerDose));
    const pharmacyHalfDosePrice = Number(halfDosePrice) || (pharmacyFullDosePrice / 2);
    // A simple product's selected unit is its stock and sales unit. Packaging and
    // scale products may explicitly use a different base unit for conversion.
    const retailBaseUnit = (isBulkProduct || allowScaleSelling) ? (baseUnit || unit || 'Unit') : (unit || 'Unit');
    const retailPurchaseUnit = purchaseUnit || bulkUnit || 'Package';
    const retailConversionToBaseUnit = Math.max(0.001, Number(conversionToBaseUnit) || Number(bulkPurchaseQty) || 1);
    const retailPricePerBaseUnit = Number(sellUnitPrice) || finalSellingPrice;
    const retailPackageBuyingCost = costPrice;
    const ledgerCostPrice = activeTenant.businessType !== 'pharmacy' && isBulkProduct
      ? retailPackageBuyingCost / retailConversionToBaseUnit
      : costPrice;

    const newProd: Product = {
      id: 'p-' + Math.random().toString(36).substr(2, 9),
      name,
      sku: finalizedBarcode, // sku is populated behind the scenes with barcode to avoid breaking standard VM integrations
      barcode: finalizedBarcode,
      category,
      unit: activeTenant.businessType === 'pharmacy' ? hierarchy.baseUnit : unit,
      costPrice: ledgerCostPrice,
      sellingPrice: finalSellingPrice,
      stockQty: getTotalStockQty(shopStockQty, storeStockQty),
      shopStockQty: shopStockQty,
      storeStockQty: storeStockQty,
      alertQty: alertQty,
      image: productImage || undefined,
      brand: brand.trim() || undefined,
      sellInRetail,
      sellInWholesale,
      wholesalePrice: sellInWholesale ? finalWholesalePrice : undefined,
      minWholesaleQty: sellInWholesale ? finalMinWholesaleQty : undefined,
      costingMethod,
      sellingMethod: mapCostingMethodToLegacy(costingMethod),
      allowPosMethodOverride,
      allowScaleSelling: activeTenant.businessType === 'pharmacy' ? false : (allowScaleSelling || isBulkProduct),
      purchaseUnit: activeTenant.businessType === 'pharmacy' ? pharmacyTopLevel.unit : retailPurchaseUnit,
      baseUnit: activeTenant.businessType === 'pharmacy' ? hierarchy.baseUnit : retailBaseUnit,
      conversionToBaseUnit: activeTenant.businessType === 'pharmacy' ? pharmacyTabsPerPacket : retailConversionToBaseUnit,
      packageUnitPrice: activeTenant.businessType === 'pharmacy' ? undefined : retailPricePerBaseUnit,
      wholePackagePrice: activeTenant.businessType === 'pharmacy' ? undefined : retailPricePerBaseUnit * retailConversionToBaseUnit,
      halfPackagePrice: activeTenant.businessType === 'pharmacy' ? undefined : retailPricePerBaseUnit * (retailConversionToBaseUnit / 2),
      packageBuyingCost: activeTenant.businessType === 'pharmacy' ? undefined : retailPackageBuyingCost,
      allowCustomQuantity,
      defaultPricePerBaseUnit: activeTenant.businessType === 'pharmacy' ? pharmacyTabPrice : retailPricePerBaseUnit,
      pharmacyProductType: activeTenant.businessType === 'pharmacy' ? pharmacyProductType : undefined,
      pharmacyHierarchyStart: activeTenant.businessType === 'pharmacy' ? pharmacyHierarchyStart : undefined,
      pharmacyBaseUnit: activeTenant.businessType === 'pharmacy' ? hierarchy.baseUnit : undefined,
      pharmacyUnitLevels: activeTenant.businessType === 'pharmacy' ? hierarchy.levels : undefined,
      dosesPerPacket: activeTenant.businessType === 'pharmacy' ? pharmacyDosesPerPacket : undefined,
      tabsPerDose: activeTenant.businessType === 'pharmacy' ? pharmacyTabsPerDose : undefined,
      tabsPerPack: activeTenant.businessType === 'pharmacy' ? pharmacyTabsPerPacket : undefined,
      allowsDosageDividing: activeTenant.businessType === 'pharmacy' ? true : undefined,
      packetPrice: activeTenant.businessType === 'pharmacy' ? pharmacyPacketPrice : undefined,
      fullDosePrice: activeTenant.businessType === 'pharmacy' ? pharmacyFullDosePrice : undefined,
      halfDosePrice: activeTenant.businessType === 'pharmacy' ? pharmacyHalfDosePrice : undefined,
      tabPrice: activeTenant.businessType === 'pharmacy' ? pharmacyTabPrice : undefined,
      fractionSaleOptions: activeTenant.businessType !== 'pharmacy' && (allowScaleSelling || isBulkProduct)
        ? getDefaultFractionOptions(retailBaseUnit, retailPricePerBaseUnit)
        : undefined,
      pharmacyUnitBreakdown: activeTenant.businessType === 'pharmacy'
        ? {
          purchaseUnit: pharmacyTopLevel.unit,
          stripUnit: hierarchy.levels[1]?.unit || hierarchy.baseUnit,
          baseUnit: hierarchy.baseUnit,
          stripsPerBox: pharmacyDosesPerPacket,
          tabletsPerStrip: pharmacyTabsPerDose,
        }
        : undefined,
      inventorySettings: {
        costingMethod,
        allowPosMethodOverride,
        allowScaleSelling: activeTenant.businessType === 'pharmacy' ? false : (allowScaleSelling || isBulkProduct),
        purchaseUnit: activeTenant.businessType === 'pharmacy' ? pharmacyTopLevel.unit : retailPurchaseUnit,
        baseUnit: activeTenant.businessType === 'pharmacy' ? hierarchy.baseUnit : retailBaseUnit,
        conversionToBaseUnit: activeTenant.businessType === 'pharmacy' ? pharmacyTabsPerPacket : retailConversionToBaseUnit,
        packageUnitPrice: activeTenant.businessType === 'pharmacy' ? undefined : retailPricePerBaseUnit,
        wholePackagePrice: activeTenant.businessType === 'pharmacy' ? undefined : retailPricePerBaseUnit * retailConversionToBaseUnit,
        halfPackagePrice: activeTenant.businessType === 'pharmacy' ? undefined : retailPricePerBaseUnit * (retailConversionToBaseUnit / 2),
        packageBuyingCost: activeTenant.businessType === 'pharmacy' ? undefined : retailPackageBuyingCost,
        allowCustomQuantity,
        defaultPricePerBaseUnit: activeTenant.businessType === 'pharmacy' ? pharmacyTabPrice : retailPricePerBaseUnit,
        fractionSaleOptions: activeTenant.businessType !== 'pharmacy' && (allowScaleSelling || isBulkProduct)
          ? getDefaultFractionOptions(retailBaseUnit, retailPricePerBaseUnit)
          : undefined,
        pharmacyUnitBreakdown: activeTenant.businessType === 'pharmacy'
          ? {
            purchaseUnit: pharmacyTopLevel.unit,
            stripUnit: hierarchy.levels[1]?.unit || hierarchy.baseUnit,
            baseUnit: hierarchy.baseUnit,
            stripsPerBox: pharmacyDosesPerPacket,
            tabletsPerStrip: pharmacyTabsPerDose,
          }
          : undefined,
      },
      
      isBulkProduct,
      ...(isBulkProduct && {
        bulkUnit: retailPurchaseUnit,
        bulkPurchaseQty: retailConversionToBaseUnit,
        sellUnit: retailBaseUnit,
        sellUnitQty: 1,
        sellUnitPrice: retailPricePerBaseUnit,
        bulkToUnitsRatio: retailConversionToBaseUnit,
        sellingMode,
      })
    };

    // ── Upload image to Supabase Storage if a file was selected ──────────────
    // The canvas-processed preview (productImage) is shown instantly in the UI.
    // Upload the processed product image to Supabase Storage.
    // productImage = canvas-processed base64 (background removed, 500x500px)
    // We upload this processed result directly — NOT the raw file —
    // because the canvas pipeline may have transformed it significantly.
    let finalImageUrl: string | undefined = productImage || undefined;

    if (productImage && productImage.startsWith('data:image')) {
      try {
        setProcessingStatus('Uploading image to cloud storage...');
        const migrateResp = await fetch('/api/images/migrate-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: activeTenant.id, productId: newProd.id, base64DataUrl: productImage }),
        });
        const migrateResult = await migrateResp.json();
        if (migrateResult.success && migrateResult.url) {
          finalImageUrl = migrateResult.url;
        } else {
          console.warn('[DashboardProducts] Server upload failed:', migrateResult.error);
        }
      } catch (uploadErr) {
        console.warn('[DashboardProducts] Storage upload failed, keeping base64 preview:', uploadErr);
      }
      setProcessingStatus('');
    }

    const finalProd = { ...newProd, image: finalImageUrl };
    onAddProduct(finalProd);
    setFormSuccess(true);
    
    setTimeout(() => {
      // Reset Registry form
      setName('');
      setBrand('');
      setBarcode('');
      setCategory(categoriesList[0] || '');
      setCostPrice(0);
      setSellingPrice(0);
      setShopStockQty(0);
      setStoreStockQty(0);
      setAlertQty(0);
      setProductImage('');
      setProductImageFile(null);
      setSellInRetail(true);
      setSellInWholesale(false);
      setWholesalePrice(0);
      setMinWholesaleQty(0);
      setIsBulkProduct(false);
      setDosesPerPacket('');
      setTabsPerDose('');
      setFullDosePrice(0);
      setHalfDosePrice(0);
      setTabPrice(0);
      setCostingMethod('fifo');
      setAllowPosMethodOverride(false);
      setAllowScaleSelling(false);
      setPurchaseUnit('Sack');
      setBaseUnit('Kg');
      setConversionToBaseUnit('');
      setAllowCustomQuantity(true);
      setIsOpen(false);
      setFormSuccess(false);
      setFormError(null);
    }, 1100);
  };

  // Stock Transfer Actions
  const handleExecuteTransfer = async () => {
    if (!transferProduct) return;
    const qty = transferQty;
    if (qty <= 0) {
      setTransferError('Please specify a positive unit quantity.');
      return;
    }
    
    if (transferDirection === 'branch_to_branch') {
      if (!transferSourceBranchId || !transferDestinationBranchId || transferSourceBranchId === transferDestinationBranchId) {
        setTransferError('Choose two different same-business branches.');
        return;
      }
      setTransferSubmitting(true);
      try {
        await transferStockBetweenBranches({
          fromBranchId: transferSourceBranchId,
          toBranchId: transferDestinationBranchId,
          productId: String(transferProduct.id),
          quantity: qty,
          idempotencyKey: `stock-transfer:${activeTenant.id}:${Date.now()}:${transferProduct.id}`,
          notes: `Transferred from Products action menu by ${activeTenant.name}`,
        });
        setTransferSuccess(true);
        setTransferError(null);
        setTimeout(() => {
          setTransferProduct(null);
          setTransferSuccess(false);
          setTransferQty(1);
        }, 1200);
      } catch (error) {
        setTransferError(error instanceof Error ? error.message : 'Branch stock transfer could not be completed.');
      } finally {
        setTransferSubmitting(false);
      }
      return;
    }

    const shopQty = transferProduct.shopStockQty ?? 0;
    const storeQty = transferProduct.storeStockQty ?? 0;
    
    let nextShop = shopQty;
    let nextStore = storeQty;
    
    if (transferDirection === 'store_to_shop') {
      if (qty > storeQty) {
        setTransferError(`Insufficient backroom warehouse stock. Max available: ${formatProductQuantity(storeQty, transferProduct)}.`);
        return;
      }
      nextShop += qty;
      nextStore -= qty;
    } else {
      if (qty > shopQty) {
        setTransferError(`Insufficient shop floor stock. Max available: ${formatProductQuantity(shopQty, transferProduct)}.`);
        return;
      }
      nextShop -= qty;
      nextStore += qty;
    }
    
    const updatedProducts = products.map(p => {
      if (p.id === transferProduct.id) {
        return {
          ...p,
          shopStockQty: nextShop,
          storeStockQty: nextStore,
          stockQty: getTotalStockQty(nextShop, nextStore)
        };
      }
      return p;
    });
    
    onUpdateProducts(updatedProducts);
    setTransferSuccess(true);
    setTransferError(null);
    
    setTimeout(() => {
      setTransferProduct(null);
      setTransferSuccess(false);
      setTransferQty(1);
    }, 1200);
  };

  // 3. GOOGLE FORM TEMPLATE SHEET CSV EXPORTER / IMPORTER
  const downloadCsvTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Product Name,Barcode,Category,Brand,Cost Price,Selling Price,Shop Stock,Store Stock,Alert Level,Sell Retail,Sell Wholesale,Wholesale Price,Min Wholesale Qty\r\n"
      + "Premium Rice (5kg),6153094850239,Groceries,Jasper Foods,4500,5500,20,50,5,Yes,No,0,10\r\n"
      + "Spaghetti Bolognese,39185012,Groceries,Jasper Foods,800,1200,15,30,8,Yes,Yes,1100,50\r\n"
      + "Organic Coconut Milk,,Beverages,Nestle,1100,1600,10,25,3,Yes,No,0,10\r\n"; // Empty barcode tested inside
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "jasper_bulk_products_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvUploadError(null);
    setCsvUploadSuccess(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        
        if (lines.length <= 1) {
          setCsvUploadError('The selected spreadsheet template is empty or contains only column headers.');
          return;
        }

        const importedItems: Product[] = [];
        let skippedRows = 0;

        // Skip headers line 0
        for (let i = 1; i < lines.length; i++) {
          const columns = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
          
          if (columns.length < 5 || !columns[0]) {
            skippedRows++;
            continue;
          }

          const rawName = columns[0];
          const rawBarcode = columns[1] || `${Math.floor(10000000 + Math.random() * 90000000)}`;
          const rawCategory = columns[2] || 'Groceries';
          const rawBrand = columns[3] || '';
          const rawCost = parseFloat(columns[4]) || 0;
          const rawSell = parseFloat(columns[5]) || 0;
          const rawShopQty = parseInt(columns[6]) || 0;
          const rawStoreQty = parseInt(columns[7]) || 0;
          const rawAlert = parseInt(columns[8]) || 5;

          // Parse Sell Retail (default to true if empty or yes/true/1)
          const sellRetailStr = (columns[9] || '').toLowerCase();
          const rawSellRetail = sellRetailStr === '' ? true : (sellRetailStr === 'yes' || sellRetailStr === 'true' || sellRetailStr === '1' || sellRetailStr === 'y');

          // Parse Sell Wholesale (default to false unless yes/true/1/ticked)
          const sellWholesaleStr = (columns[10] || '').toLowerCase();
          const rawSellWholesale = sellWholesaleStr === 'yes' || sellWholesaleStr === 'true' || sellWholesaleStr === '1' || sellWholesaleStr === 'y' || sellWholesaleStr === 'ticked';

          const rawWholesalePrice = parseFloat(columns[11]) || 0;
          const rawMinWholesaleQty = parseInt(columns[12]) || 10;

          const importedProd: Product = {
            id: 'p-' + Math.random().toString(36).substr(2, 9),
            name: rawName,
            sku: rawBarcode, // populate behind the scenes to avoid code discrepancies
            barcode: rawBarcode,
            category: rawCategory,
            brand: rawBrand,
            costPrice: rawCost,
            sellingPrice: rawSell,
            stockQty: getTotalStockQty(rawShopQty, rawStoreQty),
            shopStockQty: rawShopQty,
            storeStockQty: rawStoreQty,
            alertQty: rawAlert,
            sellInRetail: rawSellRetail,
            sellInWholesale: rawSellWholesale,
            wholesalePrice: rawWholesalePrice,
            minWholesaleQty: rawMinWholesaleQty
          };

          importedItems.push(importedProd);
        }

        if (importedItems.length === 0) {
          setCsvUploadError('No valid rows could be imported. Please verify that column order is preserved exactly.');
          return;
        }

        if (subscriptionStatus) {
          if (subscriptionStatus.isExpired) {
            onTriggerUpgrade?.('expired');
            return;
          }
          if (products.length + importedItems.length > subscriptionStatus.plan.maxProducts) {
            onTriggerUpgrade?.('products');
            return;
          }
        }

        // Add imports directly to the system
        importedItems.forEach(item => onAddProduct(item));

        // Auto-register any new categories from the spreadsheet into settings
        // so they appear in the POS category filter immediately after import.
        const importedCategories = Array.from(
          new Set(importedItems.map(p => p.category?.trim()).filter(Boolean))
        ) as string[];
        if (importedCategories.length > 0) {
          const existingCategories: string[] = systemSettings?.productStore?.categories || [];
          const existingNormalized = existingCategories.map(c => c.trim().toLowerCase());
          const newCategories = importedCategories.filter(
            c => !existingNormalized.includes(c.toLowerCase())
          );
          if (newCategories.length > 0) {
            const mergedCategories = [...existingCategories, ...newCategories];
            onUpdateSettings({
              ...systemSettings,
              productStore: {
                ...systemSettings.productStore,
                categories: mergedCategories,
              },
            } as any);
          }
        }

        setCsvUploadSuccess(`Spreadsheet uploaded successfully! Imported ${importedItems.length} products. (Skipped ${skippedRows} rows).`);
        
        if (csvInputRef.current) {
          csvInputRef.current.value = '';
        }
      } catch (err) {
        setCsvUploadError('Failed to parse file. Ensure it is a valid CSV spreadsheet formatted according to the Downloadable Template.');
      }
    };
    reader.readAsText(file);
  };

  // Filter products catalog
  const filteredProducts = products.filter(p => 
    String(p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(p.barcode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(p.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(p.brand || '').toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    // Zero/negative stock goes to bottom, in-stock stays on top
    const stockA = a.shopStockQty ?? a.stockQty ?? 0;
    const stockB = b.shopStockQty ?? b.stockQty ?? 0;
    const aOut = stockA <= 0 ? 1 : 0;
    const bOut = stockB <= 0 ? 1 : 0;
    if (aOut !== bOut) return aOut - bOut; // out-of-stock sinks
    return 0; // preserve original order within each group
  });

  // Connection trigger simulator
  const handleConnectHardware = () => {
    setIsConnectingPrinter(true);
    setTimeout(() => {
      setIsConnectingPrinter(false);
      setIsPrinterConnected(true);
    }, 1200);
  };

  // Trigger print queue
  const handleTriggerPrintLabels = () => {
    const chosenLabels = flattenedLabelsForPreview;
    if (chosenLabels.length === 0) return;

    // Thermal label dimensions: 50mm wide × 30mm per label
    const LABEL_H_MM = 30;
    const totalHeightMm = chosenLabels.length * LABEL_H_MM;

    // Barcode bar height is responsive to how much other content shares the
    // label: more room is freed up in "only barcode" mode, so the bars grow
    // to fill it for a cleaner look, but never exceed the 3cm (30mm) cap.
    const BARCODE_HEIGHT_CAP_MM = 30;
    const thermalBarHeightMm = Math.min(
      printLayoutOption === 'only_barcode' ? 16 : printLayoutOption === 'name_barcode' ? 12 : 7.4,
      BARCODE_HEIGHT_CAP_MM
    );

    const generateBarcodeHtmlString = (code: string, barHeightMm: number) => {
      const hash = code.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + 7;
      let barsHtml = '';
      for (let i = 0; i < 59; i++) {
        const isBlack = (i % 2 === 0);
        const isGuard = i < 3 || (i >= 28 && i <= 30) || i > 55;
        let width = '2px';
        if (isGuard) { width = '1.5px'; }
        else {
          const w = (hash * (i + 17)) % 10;
          width = w < 4 ? '1.5px' : w < 7 ? '2.5px' : w < 9 ? '3.8px' : '5px';
        }
        barsHtml += `<div style="height:${barHeightMm}mm;flex-shrink:0;background:${isBlack ? '#000' : 'transparent'};width:${width};"></div>`;
      }
      return `<div style="display:flex;justify-content:center;align-items:flex-end;width:100%;overflow:hidden;">${barsHtml}</div>`;
    };

    const labelsHtml = chosenLabels.map(item => `
      <div style="width:50mm;height:${LABEL_H_MM}mm;box-sizing:border-box;padding:2mm 3mm;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:0.5mm;border-bottom:1px dashed #e2e8f0;background:#fff;page-break-inside:avoid;">
        ${printLayoutOption !== 'only_barcode' ? `<p style="font-family:monospace;font-size:8px;font-weight:800;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0;">${escapeHtml(item.name)}</p>` : ''}
        ${printLayoutOption === 'name_price' ? `<p style="font-family:monospace;font-size:8px;font-weight:900;text-align:center;margin:0;">${currency}${item.sellingPrice.toLocaleString()}</p>` : ''}
        <div style="display:flex;flex-direction:column;align-items:center;">
          ${generateBarcodeHtmlString(item.barcode || item.sku || item.id, thermalBarHeightMm)}
          <p style="font-family:monospace;font-size:7px;font-weight:700;text-align:center;margin:0.5px 0 0;letter-spacing:0.5px;">${escapeHtml(item.barcode || item.sku || '')}</p>
        </div>
      </div>`).join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Orvix Thermal Labels</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: 50mm ${totalHeightMm}mm; margin: 0; }
    body { background: #e2e8f0; font-family: monospace; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .toolbar { background: #fff; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; z-index: 10; }
    .toolbar h2 { font-size: 14px; font-weight: 800; color: #0f172a; }
    .toolbar p { font-size: 11px; color: #64748b; margin-top: 2px; }
    .btn { background: linear-gradient(135deg,#059669,#0d9488); color: #fff; border: none; padding: 8px 16px; border-radius: 7px; font-weight: 700; font-size: 12px; cursor: pointer; }
    .wrap { padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .preview-strip { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 50mm; }
    @media print {
      body { background: transparent; }
      .toolbar { display: none !important; }
      .wrap { padding: 0; gap: 0; }
      .preview-strip { border: none; border-radius: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <h2>Orvix Thermal Labels</h2>
      <p>${chosenLabels.length} label${chosenLabels.length !== 1 ? 's' : ''} · 50mm wide · ${totalHeightMm}mm total length</p>
    </div>
    <button class="btn" onclick="window.print()">🖨️ Print / Send to Thermal</button>
  </div>
  <div class="wrap">
    <div class="preview-strip">
      ${labelsHtml}
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jasper_thermal_labels_${chosenLabels.length}pcs_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    setPrintJobSuccess(true);
    setTimeout(() => setPrintJobSuccess(false), 3000);
  };

  // Download printable A4 sticker sheet
  const handleDownloadA4StickerSheet = () => {
    const chosenLabels = flattenedLabelsForPreview;
    if (chosenLabels.length === 0) return;

    // A4 grid: 4 columns × 6 rows = 24 labels per page
    const COLS = 4;
    const ROWS = 6;
    const PER_PAGE = COLS * ROWS;

    const pages: typeof chosenLabels[] = [];
    for (let i = 0; i < chosenLabels.length; i += PER_PAGE) {
      pages.push(chosenLabels.slice(i, i + PER_PAGE));
    }

    // Barcode bar height is responsive to how much other content shares the
    // sticker: more room is freed up in "only barcode" mode, so the bars
    // grow to fill it for a cleaner look, but never exceed the 3cm (30mm) cap.
    const BARCODE_HEIGHT_CAP_MM = 30;
    const a4BarHeightMm = Math.min(
      printLayoutOption === 'only_barcode' ? 24 : printLayoutOption === 'name_barcode' ? 16 : 9,
      BARCODE_HEIGHT_CAP_MM
    );

    const generateBarcodeHtmlString = (code: string, barHeightMm: number) => {
      const hash = code.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + 7;
      let barsHtml = '';
      for (let i = 0; i < 59; i++) {
        const isBlack = (i % 2 === 0);
        const isGuard = i < 3 || (i >= 28 && i <= 30) || i > 55;
        let width = '2px';
        if (isGuard) { width = '1.5px'; }
        else {
          const w = (hash * (i + 17)) % 10;
          width = w < 4 ? '1.5px' : w < 7 ? '2.5px' : w < 9 ? '3.8px' : '5px';
        }
        barsHtml += `<div style="height:${barHeightMm}mm;flex-shrink:0;background:${isBlack ? '#000' : 'transparent'};width:${width};"></div>`;
      }
      return `<div style="display:flex;justify-content:center;align-items:flex-end;width:100%;overflow:hidden;">${barsHtml}</div>`;
    };

    const pagesHtml = pages.map((pageItems, pageIdx) => {
      const slots = Array.from({ length: PER_PAGE }, (_, i) => pageItems[i] || null);
      const stickerRows = [];
      for (let r = 0; r < ROWS; r++) {
        const rowCells = [];
        for (let c = 0; c < COLS; c++) {
          const item = slots[r * COLS + c];
          if (item) {
            const onlyBarcode = printLayoutOption === 'only_barcode';
            const withPrice = printLayoutOption === 'name_price';
            rowCells.push(`
              <div class="sticker">
                ${!onlyBarcode ? `<p class="prod-name">${escapeHtml(item.name)}</p>` : ''}
                ${!onlyBarcode && withPrice ? `<div class="price-tag"><span class="price-badge">${currency}${item.sellingPrice.toLocaleString()}</span></div>` : ''}
                <div class="barcode-wrap">
                  ${generateBarcodeHtmlString(item.barcode || item.sku || item.id, a4BarHeightMm)}
                  <p class="barcode-num">${escapeHtml(item.barcode || item.sku || '')}</p>
                </div>
              </div>`);
          } else {
            rowCells.push(`<div class="sticker empty"></div>`);
          }
        }
        stickerRows.push(`<div class="row">${rowCells.join('')}</div>`);
      }
      return `
      <div class="a4-page">
        ${stickerRows.join('')}
        <div class="footer">
          <span>Orvix</span>
          <span>Page ${pageIdx + 1} / ${pages.length}</span>
          <span>${chosenLabels.length} label${chosenLabels.length !== 1 ? 's' : ''}</span>
        </div>
      </div>`;
    }).join('\n');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Orvix A4 Sticker Sheet</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 portrait; margin: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #e2e8f0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      background: #fff;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .toolbar h2 { font-size: 15px; color: #0f172a; font-weight: 800; }
    .toolbar p { font-size: 11px; color: #64748b; margin-top: 2px; }
    .btn { background: linear-gradient(135deg,#059669,#0d9488); color: #fff; border: none; padding: 9px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .btn:hover { background: linear-gradient(135deg,#047857,#0f766e); }
    .pages-wrap { padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 24px; }
    .a4-page {
      background: #fff;
      width: 210mm;
      height: 297mm;
      padding: 12mm 10mm 16mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
      position: relative;
      page-break-after: always;
      break-after: page;
    }
    .a4-page:last-child { page-break-after: avoid; break-after: avoid; }
    .row {
      display: grid;
      grid-template-columns: repeat(${COLS}, 1fr);
      gap: 3mm;
      flex: 1;
    }
    /* 6 equal rows in 297mm - 28mm padding = 269mm / 6 = ~44mm each */
    .sticker {
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 5px 6px 4px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 0.6mm;
      background: #fff;
      overflow: hidden;
      height: 41mm;
    }
    .sticker.empty { border-color: #f1f5f9; background: #fafafa; }
    .prod-name { font-size: 9.5px; font-weight: 800; color: #0f172a; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
    .price-tag { text-align: center; }
    .price-badge { background: #f1f5f9; color: #0f172a; font-weight: 900; font-size: 9px; padding: 1px 7px; border-radius: 3px; display: inline-block; }
    .barcode-wrap { display: flex; flex-direction: column; align-items: center; width: 100%; }
    .barcode-num { font-family: monospace; font-size: 8px; font-weight: 700; color: #475569; margin-top: 0.8px; letter-spacing: 0.5px; }
    .footer { position: absolute; bottom: 6mm; left: 10mm; right: 10mm; display: flex; justify-content: space-between; font-size: 7.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 3px; }
    @media print {
      body { background: transparent; }
      .toolbar { display: none !important; }
      .pages-wrap { padding: 0; gap: 0; }
      .a4-page { box-shadow: none; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <h2>Orvix A4 Printable Sticker Sheet</h2>
      <p>${chosenLabels.length} labels · ${pages.length} page${pages.length !== 1 ? 's' : ''} · 4×6 grid (24 per page)</p>
    </div>
    <button class="btn" onclick="window.print()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      Print / Save as PDF
    </button>
  </div>
  <div class="pages-wrap">
    ${pagesHtml}
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jasper_a4_stickers_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  // Quick HTML escape helper
  const escapeHtml = (unsafe: string) => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Stylized Barcode dynamic CSS line bars sequence mapping
  const renderDynamicCssBarcode = (code: string) => {
    // Generate a highly realistic EAN-13 / Code-128 standard barcode simulation
    const hash = code.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + 7;
    const bars = [];
    
    // Total count of bars (standard retail barcodes have ~55 alternating black/white modules)
    const numBars = 59;
    
    for (let i = 0; i < numBars; i++) {
      // Alternating black and white/transparent. 
      // i % 2 === 0 is black, i % 2 === 1 is white
      const isBlack = (i % 2 === 0);
      
      // Determine width representing custom symbology patterns
      // Guard patterns at the start (0-3), middle (28-30), and end (55-58) of the label
      const isGuard = i < 3 || (i >= 28 && i <= 30) || i > 55;
      
      let widthClass = 'w-[2px]';
      if (isGuard) {
        widthClass = 'w-[1.5px]'; // guard lines are consistently thin
      } else {
        // Pseudo-random widths of 1.5px, 2.5px, 3.8px, or 5px based on hash for standard pattern representation
        const widthSeed = (hash * (i + 17)) % 10;
        if (widthSeed < 4) {
          widthClass = 'w-[1.5px]';
        } else if (widthSeed < 7) {
          widthClass = 'w-[2.5px]';
        } else if (widthSeed < 9) {
          widthClass = 'w-[3.8px]';
        } else {
          widthClass = 'w-[5px]';
        }
      }

      // Uniform height across all barcode lines as requested
      const heightClass = 'h-9';

      bars.push(
        <div 
          key={i} 
          className={`${heightClass} shrink-0 ${isBlack ? 'bg-slate-900' : 'bg-transparent'} ${widthClass}`} 
        />
      );
    }
    
    return (
      <div className="flex justify-center items-start h-9 bg-white px-1 select-none pointer-events-none w-full overflow-hidden">
        <div className="flex items-start justify-center">
          {bars}
        </div>
      </div>
    );
  };

  return (
    <div id="products-view" className="space-y-4 md:space-y-6">
      
      {/* ── NATIVE APP TAB NAVIGATION ────────────────────────────────────
          Mobile: 2×2 icon grid — all 4 visible, no scroll
          Desktop: horizontal pill tabs — clean and fast
      ──────────────────────────────────────────────────────────────── */}

      {/* MOBILE/TABLET: 2×2 grid */}
      <div className="stock-tabs-two-column-grid xl:hidden grid grid-cols-2 auto-rows-fr gap-3 px-0 w-full">
        {[
          { id: 'catalog',  icon: '📦', label: 'Product List',     sub: 'View all products' },
          { id: 'category', icon: '📁', label: 'Categories',        sub: 'Browse by type' },
          { id: 'brand',    icon: '🏷️', label: 'Brands',            sub: 'Browse by brand' },
          { id: 'labels',   icon: '🖨️', label: 'Barcode & Labels',  sub: 'Print station' },
        ].map(tab => {
          const active = viewTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabSwitch(tab.id as any)}
              className="relative flex min-w-0 flex-col items-center justify-center py-4 px-2 sm:px-3 rounded-2xl text-center transition-all active:scale-95"
              style={{
                background: active ? '#059669' : '#ffffff',
                border: active ? '2px solid #059669' : '2px solid #f1f5f9',
                boxShadow: active ? '0 4px 16px rgba(15,23,42,0.18)' : '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              {active && (
                <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-emerald-400" />
              )}
              <span className="text-2xl mb-1.5 leading-none">{tab.icon}</span>
              <span className="text-[11px] sm:text-[12px] font-extrabold leading-tight break-words" style={{ color: active ? '#ffffff' : '#475569' }}>
                {tab.label}
              </span>
              <span className="text-[10px] mt-0.5 font-medium" style={{ color: active ? 'rgba(255,255,255,0.6)' : '#94a3b8' }}>
                {tab.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* DESKTOP: horizontal pill tabs */}
      <div className="hidden xl:flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 gap-1 shadow-xs">
        {[
          { id: 'catalog',  icon: '📦', label: 'Product List' },
          { id: 'category', icon: '📁', label: 'Product Category' },
          { id: 'brand',    icon: '🏷️', label: 'Product Brand' },
          { id: 'labels',   icon: '🖨️', label: 'Barcode & Labels' },
        ].map(tab => {
          const active = viewTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabSwitch(tab.id as any)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all"
              style={{
                background: active ? '#059669' : 'transparent',
                color: active ? '#ffffff' : '#64748b',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" />}
            </button>
          );
        })}
      </div>

      {/* VIEW A: STORE ITEM CATALOG TAB */}
      {viewTab === 'catalog' && (
        <div className="space-y-4 md:space-y-6 animate-fade-in">
          
          {/* ── HEADER CARD ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">

            {/* ── MOBILE: stacked native app style ── */}
            <div className="xl:hidden">
              {/* Hero strip */}
              <div className="px-5 pt-5 pb-4 flex items-center gap-4"
                style={{ background: 'linear-gradient(135deg,#059669 0%,#047857 100%)' }}>
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                  <span className="text-2xl">📦</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-extrabold text-[15px] leading-tight">Register New Product</p>
                  <p className="text-white/50 text-[11px] mt-0.5">{products.length} product{products.length !== 1 ? 's' : ''} in catalogue</p>
                </div>
                {/* Add product FAB */}
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 active:scale-95"
                  style={{ background: isOpen ? '#ef4444' : '#22c55e' }}
                >
                  {isOpen ? <X className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                </button>
              </div>

              {/* Action tiles */}
              <div className="product-import-actions-grid grid grid-cols-2 gap-3 p-4">
                <button
                  onClick={downloadCsvTemplate}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 active:bg-slate-100 text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-slate-800 dark:text-white leading-tight">Bulk Upload</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Download template</p>
                  </div>
                </button>

                <div className="relative">
                  <input type="file" accept=".csv" ref={csvInputRef} onChange={handleCsvImport}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" />
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-left">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                      <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-slate-800 dark:text-white leading-tight">Import</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Upload spreadsheet</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── DESKTOP / TABLET: horizontal command bar ── */}
            <div className="hidden xl:flex items-center justify-between gap-4 px-6 py-4">
              {/* Left: title */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-700 flex items-center justify-center shrink-0">
                  <span className="text-base">📦</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">Register New Product</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{products.length} products in catalogue</p>
                </div>
              </div>

              {/* Right: action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={downloadCsvTemplate}
                  className="h-9 px-3.5 flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors">
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Bulk Template</span>
                </button>

                <div className="relative h-9">
                  <input type="file" accept=".csv" ref={csvInputRef} onChange={handleCsvImport}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" />
                  <button className="h-9 px-3.5 flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>Bulk Upload</span>
                  </button>
                </div>

                <button onClick={() => setIsOpen(!isOpen)}
                  className="h-9 px-4 flex items-center gap-1.5 rounded-xl text-white text-xs font-bold transition-colors shadow-sm"
                  style={{ background: isOpen ? '#ef4444' : '#22c55e' }}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isOpen ? 'Cancel' : 'Add Product'}</span>
                </button>
              </div>
            </div>

            {/* Upload feedback */}
            {(csvUploadError || csvUploadSuccess) && (
              <div className="px-4 md:px-6 pb-4">
                {csvUploadError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{csvUploadError}</span>
                  </div>
                )}
                {csvUploadSuccess && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>{csvUploadSuccess}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Creation Form expansion */}
          {isOpen && (
            <form onSubmit={handleCreateProduct} className="bg-white border border-slate-200 p-6 rounded-3xl relative space-y-6 shadow-md animate-fade-in text-xs font-sans">
              {formError && (
                <div className="bg-red-50 text-red-700 border border-red-200 p-3.5 rounded-2xl font-semibold flex items-center space-x-2 animate-pulse text-[11px] font-mono">
                  <span>⚠️ {formError}</span>
                </div>
              )}
              <div className={isDesktopAddProductLayout
                ? "absolute top-0 right-6 -translate-y-1/2 bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1 rounded-full text-[10px] font-bold flex items-center space-x-1"
                : "absolute top-0 right-6 -translate-y-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white border border-emerald-500 px-3 py-1 rounded-full text-[10px] font-bold flex items-center space-x-1 shadow-sm shadow-emerald-500/30"}>
                <Sparkles className={isDesktopAddProductLayout ? "w-3.5 h-3.5 text-emerald-600 animate-pulse" : "w-3.5 h-3.5 text-white animate-pulse"} />
                <span>New Product</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Column 1: Core Title, Category and Daymode Compression Upload */}
                <div className={isDesktopAddProductLayout ? "space-y-4" : "bg-gradient-to-br from-emerald-50/60 via-white to-white border border-slate-100 rounded-2xl p-4 space-y-4"}>
                  {isDesktopAddProductLayout ? (
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">1. Descriptor & Visual Assets</h5>
                  ) : (
                    <div className="flex items-center space-x-2 pb-1.5 border-b border-slate-200/70">
                      <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-500/30">
                        <Package className="w-3.5 h-3.5" />
                      </span>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">Descriptor & Visual Assets</h5>
                    </div>
                  )}
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Product Name / Title</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Pure Groundnut Oil (5 Litre)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 transition-all outline-none font-semibold"
                    />
                  </div>

                  <div className="grid gap-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block">Category</label>
                      <ModernSelect
                        value={category}
                        options={categorySelectOptions}
                        onChange={setCategory}
                        title="Choose category"
                        placeholder="Select category"
                        searchPlaceholder="Search categories"
                        searchable
                        showOptionMarkers
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block">Units</label>
                      <ModernSelect
                        value={unit}
                        options={unitSelectOptions}
                        onChange={(nextUnit) => {
                          setUnit(nextUnit);
                          if (!isBulkProduct) setBaseUnit(nextUnit);
                        }}
                        title="Choose unit"
                        placeholder="Select unit"
                        searchPlaceholder="Search units"
                        searchable={unitSelectOptions.length > 7}
                      />
                    </div>
                  </div>

                  <div className={isDesktopAddProductLayout ? "space-y-4" : "grid gap-3"} style={isDesktopAddProductLayout ? undefined : { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Product Brand</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Pepsi, Unilever, or type brand..."
                      list="brands-suggestions"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 transition-all outline-none font-semibold"
                    />
                    <datalist id="brands-suggestions">
                      {brandsList.map(b => (
                        <option key={b.name} value={b.name} />
                      ))}
                    </datalist>
                  </div>

                  {/* Canvas Compression image module */}
                  <div className={isDesktopAddProductLayout ? "space-y-2 pt-1" : "space-y-1"}>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Product Image</label>
                    
                    {isDesktopAddProductLayout ? (
                    <div className="border border-dashed border-slate-200 rounded-xl p-3 bg-slate-50/50 flex items-center space-x-3.5">
                      {productImage ? (
                        <div className="w-14 h-14 rounded-lg bg-white border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center p-0.5 shadow-xs">
                          <img src={productImage} alt="Product Base64 Preview" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 flex flex-col items-center justify-center text-[8px] font-mono font-bold leading-tight flex-shrink-0 select-none">
                          <span>NO IMAGE</span>
                        </div>
                      )}

                      <div className="space-y-1.5 flex-grow">
                        <div className="relative inline-block">
                          <input 
                            type="file" 
                            accept="image/*"
                            ref={imageInputRef}
                            onChange={handleProductImageUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                          />
                          <button type="button" className="py-1.5 px-3 bg-white hover:bg-slate-50 border border-slate-220 rounded-lg text-[11px] font-bold text-slate-700 flex items-center space-x-1 shadow-2xs">
                            <Upload className="w-3 h-3 text-slate-500" />
                            <span>Upload Product Image</span>
                          </button>
                        </div>
                        <p className="text-[9px] text-slate-400">Removes image background.</p>
                      </div>
                    </div>
                    ) : (
                    <div className="border border-dashed border-slate-200 rounded-xl p-2.5 bg-gradient-to-br from-slate-50 to-white flex flex-col items-center text-center space-y-1.5">
                      {productImage ? (
                        <div className="w-11 h-11 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center p-0.5 shadow-xs">
                          <img src={productImage} alt="Product Base64 Preview" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center flex-shrink-0">
                          <Upload className="w-4 h-4" />
                        </div>
                      )}
                      <div className="relative inline-block w-full">
                        <input 
                          type="file" 
                          accept="image/*"
                          ref={imageInputRef}
                          onChange={handleProductImageUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                        />
                        <button type="button" className="w-full py-1.5 px-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 flex items-center justify-center space-x-1">
                          <Upload className="w-3 h-3 text-slate-500" />
                          <span>Upload</span>
                        </button>
                      </div>
                    </div>
                    )}

                    {isProcessingImage && (
                      <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl p-2.5 text-[10px] font-mono leading-none flex items-center space-x-2">
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                        <span>Canvas Processing: <b>{processingStatus}</b></span>
                      </div>
                    )}
                  </div>
                  </div>

                </div>

                {/* Column 2: Barcode Actions & Stock level details */}
                <div className={isDesktopAddProductLayout ? "space-y-4" : "bg-gradient-to-br from-amber-50/60 via-white to-white border border-slate-100 rounded-2xl p-4 space-y-4"}>
                  {isDesktopAddProductLayout ? (
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5">2. Barcode Controls & Stock</h5>
                  ) : (
                    <div className="flex items-center space-x-2 pb-1.5 border-b border-slate-200/70">
                      <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-amber-500/30">
                        <Layers className="w-3.5 h-3.5" />
                      </span>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">Barcode Controls & Stock</h5>
                    </div>
                  )}
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase block font-bold">
                      <label>Retail Scan Barcode (Acts as SKU Item Code)</label>
                      <div className="flex items-center space-x-2 text-[9px] font-bold text-emerald-600 font-mono normal-case">
                        <button type="button" onClick={generateManualBarcodeValue} className="hover:underline">
                          [Generate]
                        </button>
                        <span>|</span>
                        <button type="button" onClick={() => setIsFormScannerOpen(true)} className="hover:underline flex items-center space-x-0.5">
                          <Camera className="w-2.5 h-2.5" />
                          <span>[Scanner Beam]</span>
                        </button>
                      </div>
                    </div>

                    <input 
                      type="text" 
                      placeholder="e.g. 615010291402 or Click Generate"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 font-mono tracking-wide transition-all outline-none"
                    />
                    <p className="text-[9px] text-slate-400">Leave empty to auto-create.</p>
                  </div>

                  <div className="grid gap-3.5 border-b border-dashed border-slate-100 pb-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.875rem' }}>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block">Shop Stock ({activeTenant.businessType !== 'pharmacy' ? (isBulkProduct || allowScaleSelling ? baseUnit : unit) : pharmacyFormHierarchy.baseUnit})</label>
                      <input 
                        type="number" 
                        min="0"
                        step="0.001"
                        value={shopStockQty}
                        onChange={(e) => setShopStockQty(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 font-mono transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block">Store Stock ({activeTenant.businessType !== 'pharmacy' ? (isBulkProduct || allowScaleSelling ? baseUnit : unit) : pharmacyFormHierarchy.baseUnit})</label>
                      <input 
                        type="number" 
                        min="0"
                        step="0.001"
                        value={storeStockQty}
                        onChange={(e) => setStoreStockQty(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 font-mono transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-505 uppercase block">Low Stock Alert Level</label>
                    <p className="text-[9px] text-slate-400 leading-tight">Set low-stock alert.</p>
                    <input 
                      type="number" 
                      min="1"
                      step="0.001"
                      value={alertQty}
                      onChange={(e) => setAlertQty(Math.max(0.001, parseFloat(e.target.value) || 0))}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 font-mono transition-all outline-none mt-1"
                    />
                  </div>
                </div>

                {/* Column 3: Pricing & Margins */}
                <div className={isDesktopAddProductLayout ? "space-y-4" : "bg-gradient-to-br from-blue-50/60 via-white to-white border border-slate-100 rounded-2xl p-4 space-y-4"}>
                  {isDesktopAddProductLayout ? (
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">3. Channel Rules & Costs</h5>
                  ) : (
                    <div className="flex items-center space-x-2 pb-1.5 border-b border-slate-200/70">
                      <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-blue-500/30">
                        <TrendingUp className="w-3.5 h-3.5" />
                      </span>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">Channel Rules & Costs</h5>
                    </div>
                  )}
                  
                  {/* Channel Toggles Section */}
                  <div className={isDesktopAddProductLayout ? "bg-slate-50 p-3 rounded-2xl border border-slate-200/60 space-y-2" : "bg-white p-3 rounded-2xl border border-slate-200/60 space-y-2"}>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider font-mono">Active Selling Channels</span>
                    <div className="grid gap-2" style={{ display: 'grid', gridTemplateColumns: `repeat(${transferBranches.length > 1 ? 3 : 2}, minmax(0, 1fr))`, gap: '0.5rem' }}>
                      <label className={isDesktopAddProductLayout
                        ? "flex items-center space-x-1.5 bg-white p-2 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300"
                        : `flex items-center justify-center space-x-1.5 p-2.5 rounded-xl border cursor-pointer transition-all active:scale-[0.97] ${sellInRetail ? 'bg-gradient-to-r from-emerald-600 to-teal-500 border-emerald-600 shadow-sm shadow-emerald-600/25' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                        <input 
                          type="checkbox" 
                          checked={sellInRetail} 
                          onChange={(e) => {
                            setSellInRetail(e.target.checked);
                            if (!e.target.checked) {
                              setSellingPrice(0);
                            }
                          }}
                          className={isDesktopAddProductLayout ? "accent-teal-600 w-3.5 h-3.5" : "sr-only"}
                        />
                        {!isDesktopAddProductLayout && sellInRetail && <Check className="w-3 h-3 text-white flex-shrink-0" />}
                        <span className={isDesktopAddProductLayout ? "font-semibold text-[11px] text-slate-700" : `font-bold text-[11px] ${sellInRetail ? 'text-white' : 'text-slate-600'}`}>Sell Retail</span>
                      </label>
                      <label className={isDesktopAddProductLayout
                        ? "flex items-center space-x-1.5 bg-white p-2 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300"
                        : `flex items-center justify-center space-x-1.5 p-2.5 rounded-xl border cursor-pointer transition-all active:scale-[0.97] ${sellInWholesale ? 'bg-gradient-to-r from-emerald-600 to-teal-500 border-emerald-600 shadow-sm shadow-emerald-600/25' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                        <input 
                          type="checkbox" 
                          checked={sellInWholesale} 
                          onChange={(e) => setSellInWholesale(e.target.checked)}
                          className={isDesktopAddProductLayout ? "accent-teal-600 w-3.5 h-3.5" : "sr-only"}
                        />
                        {!isDesktopAddProductLayout && sellInWholesale && <Check className="w-3 h-3 text-white flex-shrink-0" />}
                        <span className={isDesktopAddProductLayout ? "font-semibold text-[11px] text-slate-700" : `font-bold text-[11px] ${sellInWholesale ? 'text-white' : 'text-slate-600'}`}>Sell Wholesale</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-3.5" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.875rem' }}>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block">{isBulkProduct && activeTenant.businessType !== 'pharmacy' ? `Package Buy Cost (${purchaseUnit || 'Package'})` : 'Cost Buy Price'}</label>
                      <input 
                        type="number" 
                        min="0"
                        value={costPrice || ''}
                        onChange={(e) => setCostPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 font-mono transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-505 uppercase block">
                        Retail Price {!sellInRetail && <span className="text-red-500 font-mono text-[9px]">(LOCKED)</span>}
                      </label>
                      <input 
                        type="number" 
                        min="1"
                        disabled={!sellInRetail}
                        value={sellInRetail ? (sellingPrice || '') : 0}
                        onChange={(e) => setSellingPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder={!sellInRetail ? "Inactive" : "0"}
                        className={`w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 font-mono transition-all outline-none font-bold ${!sellInRetail ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Wholesale Pricing & Minimum Quantity */}
                  <div className="grid gap-3.5" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.875rem' }}>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block">
                        Wholesale Price {!sellInWholesale && <span className="text-red-500 font-mono text-[9px]">(LOCKED)</span>}
                      </label>
                      <input 
                        type="number" 
                        min="1"
                        disabled={!sellInWholesale}
                        value={sellInWholesale ? (wholesalePrice || '') : 0}
                        onChange={(e) => setWholesalePrice(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder={!sellInWholesale ? "Inactive" : "0"}
                        className={`w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 font-mono transition-all outline-none font-bold ${!sellInWholesale ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-505 uppercase block">
                        Min Wholesale Qty {!sellInWholesale && <span className="text-red-500 font-mono text-[9px]">(LOCKED)</span>}
                      </label>
                      <input 
                        type="number" 
                        min="1"
                        disabled={!sellInWholesale}
                        value={sellInWholesale ? (minWholesaleQty || '') : 10}
                        onChange={(e) => setMinWholesaleQty(Math.max(1, parseInt(e.target.value) || 0))}
                        placeholder={!sellInWholesale ? "Inactive" : "10"}
                        className={`w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 font-mono transition-all outline-none font-semibold ${!sellInWholesale ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 font-mono text-[11px] p-4 rounded-2xl border border-slate-200 space-y-1.5 text-slate-500">
                    <div className="flex justify-between items-center text-xs border-b border-slate-200 pb-1 mb-1 text-slate-700 font-sans font-bold">
                      <span>Margin:</span>
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="flex justify-between font-mono">
                      <span>Product Markup:</span>
                      <span className="text-slate-800 font-bold">{markup.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span>Profit Margin:</span>
                      <span className="text-emerald-600 font-bold">{margin.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between font-sans font-bold text-slate-800 pt-1 mt-0.5 border-t border-slate-200">
                      <span>Margin Gain per Unit:</span>
                      <span>{currency}{Math.round(profit).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

              </div>

              <div className="space-y-4 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {!isDesktopAddProductLayout && (
                      <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-violet-500/30">
                        <Sliders className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">Smart Batch Costing</h5>
                      <p className="text-[10px] text-slate-400 mt-0.5">FIFO, average, and batch price control.</p>
                    </div>
                  </div>
                  <label className="flex items-center space-x-2 text-[10px] font-bold text-slate-600 uppercase">
                    <input
                      type="checkbox"
                      checked={allowPosMethodOverride}
                      onChange={(e) => setAllowPosMethodOverride(e.target.checked)}
                      className="accent-emerald-600"
                    />
                    <span>Cashier Override</span>
                  </label>
                </div>
                <div className="grid gap-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem' }}>
                  {[
                    ['fifo', 'FIFO', 'Oldest batch sells first'],
                    ['average_price', 'Average Price', 'Profit uses weighted cost'],
                    ['batch_price', 'Batch Price', 'Sell using batch price'],
                  ].map(([method, label, helper]) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setCostingMethod(method as typeof costingMethod)}
                      className={`p-3 rounded-xl border text-left transition-all ${costingMethod === method ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                    >
                      <span className="block text-xs font-black">{label}</span>
                      <span className={`block text-[9px] mt-1 ${costingMethod === method ? 'text-slate-300' : 'text-slate-400'}`}>{helper}</span>
                    </button>
                  ))}
                </div>
                {activeTenant.businessType !== 'pharmacy' && (
                  <div className="grid gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3" style={{ display: 'grid', gridTemplateColumns: `repeat(${isTabletWidthOrWider ? 4 : 3}, minmax(0, 1fr))`, gap: '0.75rem' }}>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Package Name</label>
                      <input value={purchaseUnit} onChange={(e) => setPurchaseUnit(e.target.value)} className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Sell / Count Unit</label>
                      <input value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)} className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">1 Package Contains</label>
                      <input type="number" step="0.001" value={conversionToBaseUnit} onChange={(e) => setConversionToBaseUnit(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                    </div>
                    <label className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-600 uppercase">
                      <input type="checkbox" checked={allowScaleSelling} onChange={(e) => setAllowScaleSelling(e.target.checked)} className="accent-emerald-600" />
                      Fraction Sale
                    </label>
                  </div>
                )}
              </div>

              {activeTenant.businessType === 'pharmacy' && (
                <div className="space-y-4 pt-2 border-t border-slate-200">
                  <div className="flex items-center space-x-2">
                    {!isDesktopAddProductLayout && (
                      <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-500/30">
                        <Layers className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <div>
                      <span className="font-bold text-sm text-slate-800">Pharmacy Unit Hierarchy</span>
                      <p className="text-[10.5px] text-slate-450 mt-0.5">Choose the product type, starting level, and how many units each level contains.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 bg-emerald-50/40 border border-emerald-100 rounded-2xl p-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Product Type</label>
                      <ModernSelect value={pharmacyProductType} options={PHARMACY_PRODUCT_TYPE_OPTIONS} onChange={(nextValue) => {
                        const next = nextValue as 'pharmaceutical' | 'non_pharmaceutical';
                        setPharmacyProductType(next);
                        setPharmacyHierarchyStart(next === 'pharmaceutical' ? 'packet' : 'carton');
                        setPharmacyBaseUnit(next === 'pharmaceutical' ? 'Tablet' : 'Piece');
                      }} title="Choose product type" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Starting Level</label>
                      <ModernSelect
                        value={pharmacyHierarchyStart}
                        options={pharmacyProductType === 'pharmaceutical'
                          ? PHARMACY_START_OPTIONS.pharmaceutical
                          : PHARMACY_START_OPTIONS.nonPharmaceutical}
                        onChange={(nextValue) => setPharmacyHierarchyStart(nextValue as any)}
                        title="Choose starting level"
                      />
                    </div>
                    {pharmacyProductType === 'pharmaceutical' && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Lowest Unit</label>
                        <ModernSelect value={pharmacyBaseUnit} options={PHARMACY_BASE_UNIT_OPTIONS} onChange={setPharmacyBaseUnit} title="Choose lowest unit" />
                      </div>
                    )}
                    {pharmacyHierarchyStart === 'box' && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Strips per Box</label>
                        <input type="number" min={1} value={pharmacyTopContains} onChange={e => setPharmacyTopContains(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                      </div>
                    )}
                    {pharmacyHierarchyStart === 'master_box' && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Cartons per Master Box</label>
                        <input type="number" min={1} value={pharmacyTopContains} onChange={e => setPharmacyTopContains(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">{pharmacyProductType === 'pharmaceutical' ? `${pharmacyBaseUnit}s per Dose/Strip` : 'Pieces per Carton'}</label>
                      <input type="number" min={1} value={pharmacyMiddleContains} onChange={e => setPharmacyMiddleContains(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                    </div>
                    {pharmacyProductType === 'pharmaceutical' && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">{pharmacyBaseUnit}s per Dose</label>
                        <input type="number" min={1} value={pharmacyDoseContains} onChange={e => setPharmacyDoseContains(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                      </div>
                    )}
                    <div className="col-span-2 grid grid-cols-2 gap-3">
                      {pharmacyFormHierarchy.levels.map(level => (
                        <div key={level.id} className="bg-white/80 border border-emerald-100 rounded-xl px-3 py-2">
                          <span className="block text-[9px] font-bold text-slate-400 uppercase">{level.label}</span>
                          <span className="text-[11px] font-black text-emerald-800">1 {level.unit} = {level.quantityToBaseUnit} {pharmacyFormHierarchy.baseUnit}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">{pharmacyFormHierarchy.levels[0]?.unit || 'Top Unit'} price</label>
                      <input type="number" value={sellingPrice || ''} onChange={e => setSellingPrice(Number(e.target.value) || 0)} className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Dose / middle price</label>
                      <input type="number" value={fullDosePrice} onChange={e => setFullDosePrice(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Auto if empty" className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Price per {pharmacyFormHierarchy.baseUnit}</label>
                      <input type="number" value={tabPrice} onChange={e => setTabPrice(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Auto if empty" className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                    </div>
                    <div className="col-span-2 text-[10px] font-mono text-emerald-800 bg-white/70 border border-emerald-100 rounded-xl px-3 py-2">
                      Total shop stock: {shopStockQty} {pharmacyFormHierarchy.baseUnit}. Total store stock: {storeStockQty} {pharmacyFormHierarchy.baseUnit}. POS will sell by {pharmacyFormHierarchy.levels.map(level => level.unit).join(', ')} and deduct from {pharmacyFormHierarchy.baseUnit}.
                    </div>
                  </div>
                </div>
              )}

              {/* Bidhaa ya Jumla / Bulk Product SECTION */}
              <div className="space-y-4 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {!isDesktopAddProductLayout && (
                      <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-500/30">
                        <Scale className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <span className="font-bold text-sm text-slate-800">Retail Package Selling</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={isBulkProduct} 
                      onChange={(e) => setIsBulkProduct(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                
                {isBulkProduct && (
                  <div className="p-4 bg-slate-50 border border-emerald-100 rounded-2xl space-y-4">
                    {/* Mode Selector */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Sell Mode</label>
                      <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                        <button 
                          type="button"
                          onClick={() => setSellingMode('scale')}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${sellingMode === 'scale' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          {t('scaleMode')}
                        </button>
                        <button 
                          type="button"
                          onClick={() => setSellingMode('pcs')}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${sellingMode === 'pcs' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          {t('pcsMode')}
                        </button>
                        <button 
                          type="button"
                          onClick={() => setSellingMode('hybrid')}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${sellingMode === 'hybrid' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          {t('hybridMode')}
                        </button>
                      </div>
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">1 {purchaseUnit || 'Package'} contains</label>
                        <input type="number" step="0.001" value={conversionToBaseUnit} onChange={e => {
                          const value = e.target.value === '' ? '' : Number(e.target.value);
                          setConversionToBaseUnit(value);
                          setBulkPurchaseQty(value);
                        }} className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Base Unit</label>
                        <input value={baseUnit} onChange={e => {
                          setBaseUnit(e.target.value);
                          setSellUnit(e.target.value);
                        }} placeholder="kg, litre, pcs" className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Quick Sale Portions</label>
                        {sellingMode === 'scale' || sellingMode === 'hybrid' ? (
                           <div className="flex space-x-1 overflow-x-auto scrollbar-hide flex-wrap gap-y-1">
                             {[
                               { label: '1/4', value: 0.25 },
                               { label: '1/2', value: 0.5 },
                               { label: '3/4', value: 0.75 },
                               { label: '1', value: 1 },
                             ].map(f => (
                               <button type="button" key={f.label} onClick={() => { setSellUnit(baseUnit); setSellUnitQty(f.value); }} className="px-2 py-1 text-[10px] font-bold bg-white border border-slate-200 rounded">{f.label} {baseUnit}</button>
                             ))}
                           </div>
                        ) : (
                           <input type="text" value={sellUnit} onChange={e => setSellUnit(e.target.value)} placeholder="Per piece" className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Default Portion Qty</label>
                        {sellingMode === 'scale' || sellingMode === 'hybrid' ? (
                          <div className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl font-bold text-slate-700">
                            {sellUnitQty === 0.25 ? '1/4' : sellUnitQty === 0.5 ? '1/2' : sellUnitQty === 0.75 ? '3/4' : '1'} {baseUnit}
                          </div>
                        ) : (
                          <input type="number" step="1" value={sellUnitQty} onChange={e => setSellUnitQty(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Price per 1 {baseUnit || 'unit'}</label>
                      <input type="number" value={sellUnitPrice} onChange={e => setSellUnitPrice(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-white border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl font-bold" />
                    </div>

                    {/* Auto-calculation display */}
                    <div className="bg-emerald-600 text-white rounded-2xl p-4 space-y-2 text-xs font-mono shadow-md shadow-emerald-600/20">
                      <div className="flex justify-between font-bold">
                        <span>{t('totalUnitsFromPurchase')}</span>
                        <span>1 {purchaseUnit || 'package'} = {formatProductQuantity(Number(conversionToBaseUnit) || 0, { unit: baseUnit } as Product)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Whole package sale value</span>
                        <span>{currency}{((Number(conversionToBaseUnit) || 0) * (Number(sellUnitPrice) || 0)).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cost of purchase:</span>
                        <span>{currency}{costPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-emerald-500 pt-2 text-emerald-100">
                        <span>{t('grossProfit')}:</span>
                        <span>{currency}{(((Number(conversionToBaseUnit) || 0) * (Number(sellUnitPrice) || 0)) - costPrice).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-100">
                        <span>{t('breakevenUnits')}:</span>
                        <span>{formatProductQuantity(Math.ceil(costPrice / (Number(sellUnitPrice) || 1)), { unit: sellUnit || baseUnit } as Product)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Commit Trigger */}
              <button
                type="submit"
                disabled={formSuccess || isProcessingImage}
                className={isDesktopAddProductLayout
                  ? "w-full py-3.5 bg-emerald-600 hover:bg-emerald-505 disabled:bg-slate-150 disabled:text-slate-400 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-md shadow-emerald-550/10"
                  : "w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:bg-slate-150 disabled:bg-none disabled:text-slate-400 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-[0.98] shadow-md shadow-emerald-600/25"}
              >
                {formSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white animate-pulse" />
                    <span className="text-white font-bold">Saving...</span>
                  </>
                ) : (
                  <span>Add Product</span>
                )}
              </button>
            </form>
          )}

          {/* Catalog Filter and Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-visible relative">
            
            <div className="p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="relative w-full sm:max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 pl-9 py-2 rounded-xl text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:bg-white dark:focus:bg-slate-700 focus:border-slate-800 dark:focus:border-slate-500 transition-all font-semibold"
                />
              </div>

              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold shrink-0">
                {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Inner content wrapper */}
            <div className="overflow-x-auto bg-white dark:bg-slate-900">

            {/* ── MOBILE STOCK CARDS ── */}
            <div className="xl:hidden bg-slate-50 dark:bg-slate-950 px-3 pt-3 pb-[calc(80px+env(safe-area-inset-bottom))] space-y-3">
              {filteredProducts.map((prod) => {
                  const shopQty = prod.shopStockQty ?? 0;
                  const storeQty = prod.storeStockQty ?? 0;
                  const totalQty = getTotalStockQty(shopQty, storeQty);
                  const isOutOfStock = totalQty <= 0;
                  const isLow = !isOutOfStock && shopQty <= (prod.alertQty || 5);
                  const isCritical = isLow && shopQty <= Math.floor((prod.alertQty || 5) / 2);
                  const shopPct = Math.min(100, Math.round((shopQty / Math.max(1, (prod.alertQty || 5) * 4)) * 100));
                  const storePct = Math.min(100, Math.round((storeQty / Math.max(1, (prod.alertQty || 5) * 4)) * 100));

                  // Color theme per status
                  const avatarBg = isOutOfStock ? '#f1f5f9' : isCritical ? '#fff1f2' : isLow ? '#fff7ed' : '#f0fdf4';
                  const avatarColor = isOutOfStock ? '#94a3b8' : isCritical ? '#e11d48' : isLow ? '#ea580c' : '#16a34a';
                  const barColor = isOutOfStock ? '#e2e8f0' : isCritical ? '#f43f5e' : isLow ? '#f97316' : '#22c55e';
                  const statusBg = isOutOfStock ? '#f8fafc' : isCritical ? '#fff1f2' : isLow ? '#fff7ed' : '#f0fdf4';
                  const statusColor = isOutOfStock ? '#64748b' : isCritical ? '#e11d48' : isLow ? '#c2410c' : '#15803d';
                  const statusText = isOutOfStock ? 'Out of Stock' : isCritical ? 'Critical Low' : isLow ? 'Low Stock' : 'In Stock';
                  const statusDot = isOutOfStock ? '#94a3b8' : isCritical ? '#f43f5e' : isLow ? '#f97316' : '#22c55e';

                  return (
                    <div key={prod.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden active:scale-[0.99] transition-all duration-150"
                      style={{
                        border: '1px solid #f0f0f0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)'
                      }}
                    >
                      {/* ── HEADER ROW ── */}
                      <div className="flex items-center gap-3.5 px-4 pt-4 pb-3.5">
                        {/* Avatar */}
                        <div
                          className="w-[76px] h-[76px] rounded-2xl flex items-center justify-center shrink-0 font-black text-lg overflow-hidden border border-slate-100 dark:border-slate-800 shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
                          style={{background: prod.image ? '#ffffff' : avatarBg, color: avatarColor}}
                        >
                          {prod.image
                            ? <img src={prod.image} alt={prod.name} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                            : prod.name.charAt(0).toUpperCase()
                          }
                        </div>

                        {/* Name + meta */}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white text-[13px] leading-snug truncate">{prod.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {prod.category && <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate max-w-[100px]">{prod.category}</span>}
                            {prod.brand && <><span className="text-slate-200 dark:text-slate-700">·</span><span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate max-w-[80px]">{prod.brand}</span></>}
                          </div>
                        </div>

                        {/* Price + menu */}
                        <div className="flex items-center gap-1 shrink-0">
                          <div className="text-right mr-1">
                            <p className="font-black text-[13px]" style={{color: '#16a34a'}}>{currency}{Math.round(prod.sellingPrice).toLocaleString()}</p>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono leading-tight">cost {currency}{Math.round(prod.costPrice).toLocaleString()}</p>
                          </div>
                          <button
                            type="button"
                            aria-label={`Open actions for ${prod.name}`}
                            onClick={(e) => { e.stopPropagation(); setMobileProductMenu(prod); }}
                            className="w-8 h-8 rounded-xl flex items-center justify-center active:bg-slate-100 dark:active:bg-slate-800"
                          >
                            <MoreVertical className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          </button>
                        </div>
                      </div>

                      {/* ── STOCK BARS ── */}
                      <div className="px-4 pb-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide w-10 shrink-0">Shop</span>
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background: '#f1f5f9'}}>
                            <div className="h-full rounded-full transition-all duration-500" style={{width: `${shopPct}%`, background: barColor}} />
                          </div>
                          <span className="text-[11px] font-black w-12 text-right shrink-0" style={{color: isOutOfStock ? '#94a3b8' : avatarColor}}>
                            {formatProductQuantity(shopQty, prod)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide w-10 shrink-0">Store</span>
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background: '#f1f5f9'}}>
                            <div className="h-full rounded-full transition-all duration-500" style={{width: `${storePct}%`, background: '#94a3b8'}} />
                          </div>
                          <span className="text-[11px] font-black w-12 text-right shrink-0 text-slate-500 dark:text-slate-400">
                            {formatProductQuantity(storeQty, prod)}
                          </span>
                        </div>
                      </div>

                      {/* ── FOOTER ROW ── */}
                      <div className="flex items-center justify-between px-4 py-2.5 border-t dark:border-slate-800" style={{background: '#fafafa'}}>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background: statusDot}} />
                          <span className="text-[10px] font-bold" style={{color: statusColor, background: statusBg, padding: '2px 8px', borderRadius: '20px'}}>
                            {statusText}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Total</span>
                            <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 ml-1.5 font-mono">{formatProductQuantity(totalQty, prod)}</span>
                          </div>
                          {prod.alertQty && (
                            <div className="text-right">
                              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Alert</span>
                              <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 ml-1.5 font-mono">{prod.alertQty}</span>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
                {filteredProducts.length === 0 && (
                   <div className="p-10 text-center text-slate-455 dark:text-slate-500 text-sm bg-white dark:bg-slate-900 rounded-2xl shadow-sm">
                      No matching products under this term or category.
                   </div>
                )}
              </div>

            </div>{/* end inner wrapper */}

            </div>{/* end catalog card */}
              <div className="hidden xl:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 text-[10px] text-slate-455 font-bold uppercase tracking-wider border-b border-slate-200 font-mono">
                    <th className="py-4 px-5">Product Name</th>
                    <th className="py-4 px-4">Barcode</th>
                    <th className="py-4 px-4">Category</th>
                    <th className="py-4 px-4">Brand</th>
                    <th className="py-4 px-4 text-right">Cost Price</th>
                    <th className="py-4 px-4 text-right">Retail Price</th>
                    <th className="py-4 px-4 text-right">Wholesale Price / Min Qty</th>
                    <th className="py-4 px-4 text-center">Shop Units</th>
                    <th className="py-4 px-4 text-center">Store Units</th>
                    <th className="py-4 px-4 text-center">Total Units</th>
                    <th className="py-4 px-4 text-center">Status</th>
                    <th className="py-4 px-5 text-center font-mono uppercase">Ledger Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150/50 text-slate-600 text-xs font-sans pb-32">
                  {filteredProducts.map(prod => {
                    const shopQty = prod.shopStockQty ?? 0;
                    const storeQty = prod.storeStockQty ?? 0;
                    const totalQty = getTotalStockQty(shopQty, storeQty);
                    
                    const isOutOfStock = totalQty <= 0;
                    const isLow = !isOutOfStock && shopQty <= prod.alertQty;
                    
                    const canSellRetail = prod.sellInRetail !== false;
                    const canSellWholesale = !!prod.sellInWholesale;
                    const minWholesaleVal = prod.minWholesaleQty ?? 0;
                    const wholesaleVal = prod.wholesalePrice ?? 0;

                    return (
                      <tr key={prod.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center space-x-3">
                            {prod.image ? (
                              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center p-1.5 shadow-[0_8px_18px_rgba(15,23,42,0.07)]">
                                <CachedImage src={prod.image} alt={prod.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                              </div>
                            ) : (
                              <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 flex flex-col items-center justify-center font-mono text-[7px] font-black leading-none flex-shrink-0 select-none shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                                <span>No image</span>
                              </div>
                            )}

                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-800 text-[12.5px] leading-tight">
                                {prod.name}
                                {prod.unit && <span className="ml-2 font-mono text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded leading-none text-[10px]">({prod.unit})</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-slate-700 tracking-wide text-[11px]">
                          {prod.barcode}
                        </td>
                        <td className="py-4 px-4 font-bold text-[10px] tracking-wider text-slate-400 select-none uppercase font-mono">
                          {prod.category}
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-600 text-[11px]">
                          {prod.brand || <span className="text-slate-400 font-normal">—</span>}
                        </td>
                        <td className="py-4 px-4 font-mono text-right text-slate-505 font-semibold">
                          {currency}{prod.costPrice.toLocaleString()}
                        </td>
                        <td className="py-4 px-4 font-mono text-right">
                          {canSellRetail ? (
                            <div className="flex flex-col items-end">
                              <span className="text-slate-800 font-extrabold text-[12.5px]">
                                {currency}{prod.sellingPrice.toLocaleString()}
                              </span>
                              {!canSellWholesale && (
                                <span className="text-[8px] bg-sky-50 text-sky-600 font-bold px-1.5 py-0.2 rounded mt-0.5 uppercase tracking-wide">
                                  Retail Only
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[9.5px] font-mono font-bold bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-lg select-none">
                              Not for Retail
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-mono text-right">
                          {canSellWholesale ? (
                            <div className="flex flex-col items-end">
                              <span className="text-teal-700 font-extrabold text-[12.5px]">
                                {currency}{wholesaleVal.toLocaleString()}
                              </span>
                              <span className="text-[9px] text-slate-400 mt-0.5">
                                Min Qty: <strong className="text-slate-700">{formatProductQuantity(minWholesaleVal, prod)}</strong>
                              </span>
                            </div>
                          ) : (
                            <span className="text-[9.5px] font-mono font-bold bg-slate-100 text-slate-400 border border-slate-200 px-2 py-0.5 rounded-lg select-none">
                              Not for Wholesale
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`font-mono text-[11px] px-2.5 py-1 rounded-full font-bold bg-slate-50 border border-slate-200 ${
                            isLow ? 'text-amber-600 bg-amber-50/50 border-amber-200' : 'text-slate-600'
                          }`}>
                            {formatProductQuantity(shopQty, prod)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="font-mono text-[11px] px-2.5 py-1 rounded-full font-bold bg-slate-50 border border-slate-200 text-slate-600">
                            {formatProductQuantity(storeQty, prod)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center font-black text-slate-700 font-mono text-xs">
                          {formatProductQuantity(totalQty, prod)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {isOutOfStock ? (
                            <span className="inline-block bg-red-50 text-red-600 border border-red-105 font-extrabold font-mono text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded-full">
                              Out of stock
                            </span>
                          ) : isLow ? (
                            <span className="inline-block bg-amber-50 text-amber-600 border border-amber-150 font-extrabold font-mono text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded-full">
                              Low stock
                            </span>
                          ) : (
                            <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-100 font-extrabold font-mono text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded-full">
                              In stock
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-center relative">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => {
                                setTransferProduct(prod);
                                setTransferQty(1);
                                setTransferDirection('store_to_shop');
                                setTransferError(null);
                                setTransferSuccess(false);
                              }}
                              className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg cursor-pointer transition-colors"
                              title="Transfer Warehouse Stock"
                            >
                              <ArrowLeftRight className="w-4 h-4" />
                            </button>

                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setDesktopMenuId(desktopMenuId === prod.id ? null : prod.id)}
                                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg cursor-pointer transition-colors flex items-center justify-center"
                                title="Item Options"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {desktopMenuId === prod.id && (
                                <>
                                  <div className="fixed inset-0 z-[70]" onClick={() => setDesktopMenuId(null)} />
                                  <div className="absolute right-0 top-full mt-1.5 z-[90] bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden w-48 py-1"
                                    style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)' }}
                                  >
                                    {[
                                      { label: 'View Details',   icon: Eye,     color: 'text-slate-700',   action: () => { setViewingProduct(prod); setDesktopMenuId(null); } },
                                      { label: 'Edit Item',      icon: Edit,    color: 'text-slate-700',   action: () => { handleBeginEdit(prod); setDesktopMenuId(null); } },
                                      { label: 'Replenish Stock',icon: Package, color: 'text-emerald-700', action: () => { setReplenishProduct(prod); setReplenishCost(''); setReplenishQty(''); setReplenishSupplier(''); setReplenishPriceAction('suggested'); setReplenishCostingMethod(prod.costingMethod || prod.inventorySettings?.costingMethod || 'fifo'); setDesktopMenuId(null); } },
                                      { label: 'Adjust Stock', icon: ArrowLeftRight, color: 'text-blue-600', action: () => { setAdjustProduct(prod); setAdjustQty(''); setAdjustReason(''); setAdjustSearch(prod.name); setAdjustShowSearch(false); setDesktopMenuId(null); } },
                                      { label: 'Transfer Stock', icon: ArrowLeftRight, color: 'text-indigo-700', action: () => { setTransferProduct(prod); setTransferQty(1); setTransferDirection('store_to_shop'); setTransferError(null); setTransferSuccess(false); setDesktopMenuId(null); } },
                                    ].map(item => {
                                      const Icon = item.icon;
                                      return (
                                        <button key={item.label} type="button" onClick={item.action}
                                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer text-left"
                                        >
                                          <Icon className={`w-3.5 h-3.5 ${item.color} shrink-0`} />
                                          <span className={item.color}>{item.label}</span>
                                        </button>
                                      );
                                    })}
                                    <div className="h-px bg-slate-100 mx-3 my-1" />
                                    <button type="button"
                                      onClick={() => { setProductToDelete(prod); setDesktopMenuId(null); }}
                                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold hover:bg-red-50 transition-colors cursor-pointer text-left"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                      <span className="text-red-600">Delete Item</span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>

                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-400 font-medium bg-slate-50/50">
                        No active stock items match the filter keywords.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>

      )}

      {/* VIEW B: BARCODE & LABEL PRINTING */}
      {viewTab === 'labels' && (
        <div className="space-y-6 animate-fade-in text-xs font-sans">
          
          {/* Section 1: Connection Drivers setup box for Thermal and hardware models */}
          <div className="bg-slate-800 text-white rounded-3xl p-6 border border-slate-700 shadow-xl space-y-5 relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-y-1/3 translate-x-1/3 bg-emerald-500/10 w-96 h-96 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10 border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Printer className="w-5 h-5 text-emerald-400" />
                  <h4 className="font-black text-sm uppercase tracking-wide">Orvix Print Driver Engine</h4>
                </div>
                <p className="text-[11px] text-slate-400 max-w-xl leading-relaxed">
                  Connect your thermal printer via USB, Bluetooth, or network to print labels.
                </p>
              </div>

              {/* Status lights */}
              <div className="flex items-center space-x-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-700">
                <div className="flex items-center space-x-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isPrinterConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                  <span className="font-mono text-[10px] font-bold text-slate-400">
                    {isPrinterConnected ? 'Connected' : 'Not connected'}
                  </span>
                </div>
                <span>|</span>
                <button
                  onClick={() => setShowTestPrintModal(true)}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-[10px] uppercase font-bold tracking-wider rounded-lg text-white transition-colors cursor-pointer"
                >
                  Trigger Test Page
                </button>
              </div>
                        {/* Connection configuration matrix */}
            <div className="grid grid-cols-1 gap-5 relative z-10">
              
              {/* Status and Diagnostics Print Area */}
              <div className="space-y-2 bg-slate-950/40 p-4 rounded-2xl border border-slate-850">
                <span className="text-[10px] font-mono tracking-wider font-extrabold text-slate-400 uppercase block">Link & print diagnostics</span>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-3 bg-slate-900/50 border border-slate-700/50 rounded-xl">
                    <span className="block text-[8px] uppercase text-slate-500 font-bold tracking-widest leading-none">Status Link</span>
                    <span className="text-[10px] font-bold text-emerald-400 mt-1.5 block">ACTIVE LINK</span>
                  </div>
                  <div className="p-3 bg-slate-900/50 border border-slate-700/50 rounded-xl">
                    <span className="block text-[8px] uppercase text-slate-500 font-bold tracking-widest leading-none">Paper Size</span>
                    <span className="text-[10px] font-bold text-slate-300 mt-1.5 block">50MM ROLL</span>
                  </div>
                </div>
              </div>

            </div>  </div>

          </div>

          {/* Section 2: Assemble Print Jobs list selecting products and setting ticket count */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Queue: Selectable catalog list */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4 lg:col-span-2">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span className="font-bold text-slate-800">1. Product print queue selection</span>
                <span className="text-[10px] italic text-slate-400 font-medium">Choose items to print barcodes</span>
              </div>

              {/* Product search box */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={labelSearchQuery}
                  onChange={(e) => setLabelSearchQuery(e.target.value)}
                  placeholder="Type product name or barcode to add..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition-all font-sans font-medium text-slate-700 placeholder-slate-400"
                />
                
                {/* Search Results Dropdown/Box if query is present */}
                {labelSearchQuery.trim().length > 0 && (
                  <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg z-25 max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {labelSearchResults.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-xs font-medium">
                        No matching products found.
                      </div>
                    ) : (
                      labelSearchResults.map(p => (
                        <div 
                          key={p.id}
                          onClick={() => {
                            setSelectedLabels(prev => ({ ...prev, [p.id]: true }));
                            setPrintQuantities(prev => ({ ...prev, [p.id]: prev[p.id] || 5 })); // default copies of 5
                            setLabelSearchQuery(''); // clear search input after selection
                          }}
                          className="p-3 hover:bg-slate-50/80 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div className="space-y-0.5 text-left">
                            <p className="font-bold text-slate-800 text-xs">{p.name}</p>
                            <span className="font-mono text-[9px] text-slate-400">Barcode: {p.barcode}</span>
                          </div>
                          <button
                            type="button"
                            className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            + Add to Queue
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Active Print Queue List */}
              <div className="space-y-2.5 pt-1">
                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2">
                  <span>Selected Print Queue</span>
                  <span>{products.filter(p => selectedLabels[p.id]).length} products</span>
                </div>

                <div className="max-h-[320px] overflow-y-auto pr-1 space-y-2">
                  {products.filter(p => selectedLabels[p.id]).length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                      Print queue is empty. Use the search box above to add products!
                    </div>
                  ) : (
                    products.filter(p => selectedLabels[p.id]).map(p => {
                      const count = printQuantities[p.id] || 0;

                      return (
                        <div 
                          key={p.id} 
                          className="flex items-center justify-between p-3 border border-slate-200 rounded-2xl bg-white shadow-2xs hover:border-slate-250 transition-colors"
                        >
                          <div className="flex items-center space-x-3 max-w-[55%]">
                            <div className="space-y-0.5 truncate text-left">
                              <p className="font-bold text-slate-800 truncate text-[12px]">{p.name}</p>
                              <span className="font-mono text-[9px] text-slate-400 block">Barcode: {p.barcode}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3 shrink-0">
                            {/* Copies count controller */}
                            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                              <label className="text-[9px] uppercase font-mono font-bold text-slate-400 shrink-0">Copies:</label>
                              <button
                                type="button"
                                onClick={() => setPrintQuantities(prev => ({ ...prev, [p.id]: Math.max(1, (prev[p.id] || 1) - 1) }))}
                                className="w-5 h-5 rounded bg-white hover:bg-slate-100 border border-slate-200/60 flex items-center justify-center font-bold text-xs cursor-pointer"
                              >
                                -
                              </button>
                              <input 
                                type="number"
                                min="1"
                                value={count}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value) || 1);
                                  setPrintQuantities(prev => ({ ...prev, [p.id]: val }));
                                }}
                                className="w-8 text-center bg-transparent border-none py-0.5 font-mono font-bold text-xs outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setPrintQuantities(prev => ({ ...prev, [p.id]: (prev[p.id] || 1) + 1 }))}
                                className="w-5 h-5 rounded bg-white hover:bg-slate-100 border border-slate-200/60 flex items-center justify-center font-bold text-xs cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() => setSelectedLabels(prev => ({ ...prev, [p.id]: false }))}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg bg-slate-50 hover:bg-red-50/50 border border-slate-200 hover:border-red-100 transition-all cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

            {/* Right Settings & Preview parameters */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
              <span className="font-bold text-slate-880 block border-b border-slate-100 pb-3">2. Label Paper & Output</span>
              
              {/* Paper selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">Output format roll size</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLabelSize('thermal')}
                    className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold uppercase transition-all flex flex-col items-center justify-center cursor-pointer ${
                      labelSize === 'thermal'
                        ? 'border-emerald-500 bg-emerald-50/20 text-emerald-700 font-extrabold shadow-2xs'
                        : 'border-slate-200 hover:border-slate-350 text-slate-500'
                    }`}
                  >
                    <span>⚡ Thermal Roll</span>
                    <span className="text-[8px] lowercase font-normal text-slate-400 mt-0.5">50mm x 30mm Roll</span>
                  </button>
                  <button
                    onClick={() => setLabelSize('a4')}
                    className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold uppercase transition-all flex flex-col items-center justify-center cursor-pointer ${
                      labelSize === 'a4'
                        ? 'border-emerald-500 bg-emerald-50/20 text-emerald-700 font-extrabold shadow-2xs'
                        : 'border-slate-200 hover:border-slate-350 text-slate-500'
                    }`}
                  >
                    <span>📄 A4 Sticker sheet</span>
                    <span className="text-[8px] lowercase font-normal text-slate-400 mt-0.5">24 labels / A4 page</span>
                  </button>
                </div>
              </div>

              {/* Barcode Appearance Layout selection */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">Barcode label layout option</label>
                <div className="flex flex-col space-y-2">
                  <label className={`flex items-center space-x-2.5 p-2.5 border rounded-2xl cursor-pointer transition-all ${printLayoutOption === 'name_price' ? 'border-emerald-500 bg-emerald-50/20 text-emerald-800' : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'}`}>
                    <input 
                      type="radio" 
                      name="printLayoutOption" 
                      value="name_price" 
                      checked={printLayoutOption === 'name_price'} 
                      onChange={() => setPrintLayoutOption('name_price')}
                      className="accent-emerald-600 h-3.5 w-3.5"
                    />
                    <div className="text-left font-sans">
                      <p className="text-[11px] font-bold">With Name & Price</p>
                      <p className="text-[9px] text-slate-400 leading-tight">Shows Name, Price & Barcode</p>
                    </div>
                  </label>
                  
                  <label className={`flex items-center space-x-2.5 p-2.5 border rounded-2xl cursor-pointer transition-all ${printLayoutOption === 'name_barcode' ? 'border-emerald-500 bg-emerald-50/20 text-emerald-800' : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'}`}>
                    <input 
                      type="radio" 
                      name="printLayoutOption" 
                      value="name_barcode" 
                      checked={printLayoutOption === 'name_barcode'} 
                      onChange={() => setPrintLayoutOption('name_barcode')}
                      className="accent-emerald-600 h-3.5 w-3.5"
                    />
                    <div className="text-left font-sans">
                      <p className="text-[11px] font-bold">With Name & Barcode</p>
                      <p className="text-[9px] text-slate-400 leading-tight">Shows Name & Barcode Text (No Price)</p>
                    </div>
                  </label>
                  
                  <label className={`flex items-center space-x-2.5 p-2.5 border rounded-2xl cursor-pointer transition-all ${printLayoutOption === 'only_barcode' ? 'border-emerald-500 bg-emerald-50/20 text-emerald-800' : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'}`}>
                    <input 
                      type="radio" 
                      name="printLayoutOption" 
                      value="only_barcode" 
                      checked={printLayoutOption === 'only_barcode'} 
                      onChange={() => setPrintLayoutOption('only_barcode')}
                      className="accent-emerald-600 h-3.5 w-3.5"
                    />
                    <div className="text-left font-sans">
                      <p className="text-[11px] font-bold">Only Barcode</p>
                      <p className="text-[9px] text-slate-400 leading-tight">Barcode only</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Printable stats summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 font-mono text-[10.5px] text-slate-500">
                <div className="flex justify-between font-sans font-bold text-slate-705 border-b border-slate-200 pb-1.5 mb-1 text-xs">
                  <span>Queue Totals</span>
                  <Sliders className="w-3.5 h-3.5" />
                </div>
                <div className="flex justify-between">
                  <span>Selected Products:</span>
                  <span className="font-bold text-slate-800">
                    {Object.keys(selectedLabels).filter(k => selectedLabels[k]).length} items
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total ticket copies:</span>
                  <span className="font-bold text-slate-800">
                    {Object.keys(selectedLabels).filter(k => selectedLabels[k]).reduce((acc, k) => acc + (printQuantities[k] || 0), 0)} tags
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Output Paper:</span>
                  <span className="font-bold text-slate-800 truncate">
                    {labelSize === 'thermal' ? 'Thermal adhesive roll' : 'Standard flat A4 sheet (24-grid)'}
                  </span>
                </div>
              </div>

              {/* Feedback messages */}
              {printJobSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-center border border-emerald-100 font-bold text-[10px] uppercase tracking-wide animate-pulse">
                  ✓ Print job successfully transmitted to Orvix printer. Check feed.
                </div>
              )}

              {/* Trigger Print Button */}
              {labelSize === 'thermal' ? (
                <div className="space-y-1.5">
                  <button
                    onClick={handleTriggerPrintLabels}
                    disabled={isPrintingJob || Object.keys(selectedLabels).filter(k => selectedLabels[k]).length === 0}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-mono text-[11px] uppercase tracking-wider font-extrabold rounded-2xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span>Print via Orvix Thermal Printer</span>
                  </button>
                  <p className="text-[9.5px] text-slate-400 text-center font-mono">
                    Ready to print 50×30mm labels.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <button
                    onClick={handleDownloadA4StickerSheet}
                    disabled={Object.keys(selectedLabels).filter(k => selectedLabels[k]).length === 0}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-mono text-[11px] uppercase tracking-wider font-extrabold rounded-2xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-white" />
                    <span>Download A4 Sticker Sheet</span>
                  </button>
                  <p className="text-[9.5px] text-slate-400 text-center font-sans font-medium">
                    Exports standalone print-ready HTML template with perfect 4x6 grid alignments.
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* Section 3: Genuine physical layout print preview mockup sheet */}
          <div className="bg-slate-100 border border-slate-250 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <span className="font-bold text-xs uppercase font-mono tracking-wider text-slate-500">
                🔎 Print Layout Preview (WYSIWYG layout simulation)
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Thermal label preview.
              </p>
            </div>

            {/* Print roll display */}
            <div className={`p-6 border border-dashed border-slate-350 bg-slate-50 rounded-2xl flex items-center justify-center ${labelSize === 'a4' ? 'min-h-[400px]' : ''}`}>
              
              {/* Thermal continuous stickers roll */}
              {labelSize === 'thermal' && (
                <div className="flex flex-col space-y-4 w-full max-w-xs bg-white text-slate-900 p-5 rounded-3xl shadow-lg border border-slate-200 select-none">
                  <div className="text-center font-mono text-[9px] uppercase font-black text-slate-400 tracking-wider flex items-center justify-center space-x-1 border-b border-dashed border-slate-200 pb-2 mb-2">
                    <Printer className="w-3 h-3" />
                    <span>Thermal Continuous Sticker (50mm x 30mm)</span>
                  </div>

                  {flattenedLabelsForPreview.slice(0, 3).map((p, index) => (
                    <div key={`${p.id}-${index}`} className="bg-white p-3 border border-slate-200 rounded-2xl relative shadow-2xs space-y-0.5 font-sans overflow-hidden">
                      {printLayoutOption === 'only_barcode' ? (
                        <div className="py-1 flex flex-col items-center justify-center space-y-0.5 bg-white">
                          {renderDynamicCssBarcode(p.barcode)}
                          <p className="font-mono text-[9.5px] font-bold text-slate-700">{p.barcode}</p>
                        </div>
                      ) : (
                        <>
                          {/* Product Name placed centered in the middle */}
                          <div className="text-center font-sans">
                            <p className="font-extrabold text-slate-800 truncate text-[11px] leading-tight">{p.name}</p>
                          </div>

                          {/* Price display if selected, placed below product name */}
                          {printLayoutOption === 'name_price' && (
                            <div className="text-center select-none pointer-events-none mt-0.5">
                              <span className="bg-slate-105 text-slate-900 font-mono font-black text-[10px] px-2 py-0.5 rounded inline-block">
                                {currency}{p.sellingPrice.toLocaleString()}
                              </span>
                            </div>
                          )}

                          {/* Visual Barcode bars details */}
                          <div className="pt-0.5 text-center space-y-0.5 bg-white select-none pointer-events-none">
                            {renderDynamicCssBarcode(p.barcode)}
                            <p className="font-mono text-[8.5px] font-bold text-slate-600">{p.barcode}</p>
                          </div>
                        </>
                      )}

                      {/* Side tear label mock */}
                      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-slate-50 rounded-full border-r border-slate-200" />
                      <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-slate-50 rounded-full border-l border-slate-200" />
                    </div>
                  ))}

                  {flattenedLabelsForPreview.length > 3 && (
                    <p className="text-[10px] text-slate-400 italic text-center pt-2">
                      + {flattenedLabelsForPreview.length - 3} more sticker items in the active queue.
                    </p>
                  )}

                  {flattenedLabelsForPreview.length === 0 && (
                    <div className="p-12 text-center text-slate-400 italic">
                      No label rows are selected. Search and add products inside the print selector to preview thermals.
                    </div>
                  )}
                </div>
              )}

              {/* A4 Sheet grid visualizer */}
              {labelSize === 'a4' && (
                <div className="bg-white border border-slate-300 w-full max-w-3xl min-h-[480px] p-6 text-slate-900 rounded-xl shadow-xl flex flex-col space-y-4">
                  <div className="border-b border-dashed border-slate-200 pb-3 flex items-center justify-between text-slate-500 font-mono select-none">
                    <div className="text-left">
                      <span className="font-bold text-[11px] block">📄 A4 Label Sheet Outline (4 x 6 = 24 Labels layout)</span>
                      <span className="text-[9px] text-slate-400 font-sans">Ready to print or download.</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadA4StickerSheet}
                      disabled={flattenedLabelsForPreview.length === 0}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-sans font-bold text-[10px] uppercase rounded-xl tracking-wide shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5 text-white" />
                      <span>Download A4 Sheet</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {flattenedLabelsForPreview.slice(0, 12).map((p, index) => (
                      <div key={`${p.id}-${index}`} className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5 shadow-2xs font-sans text-left relative overflow-hidden select-none pointer-events-none">
                        {printLayoutOption === 'only_barcode' ? (
                          <div className="py-1 flex flex-col items-center justify-center space-y-0.5 bg-white h-full min-h-[85px]">
                            {renderDynamicCssBarcode(p.barcode)}
                            <p className="font-mono text-[8.5px] text-slate-800 font-bold">{p.barcode}</p>
                          </div>
                        ) : (
                          <>
                            {/* Product name centered in the middle */}
                            <div className="text-center truncate">
                              <p className="font-bold text-slate-800 truncate text-[10px] leading-tight">{p.name}</p>
                            </div>

                            {/* Price display below product name, if selected */}
                            {printLayoutOption === 'name_price' && (
                              <div className="text-center select-none pointer-events-none mt-0.5">
                                <span className="bg-slate-100 text-slate-900 font-mono font-black text-[9px] px-1.5 py-0.5 rounded leading-none inline-block">
                                  {currency}{p.sellingPrice.toLocaleString()}
                                </span>
                              </div>
                            )}
                            
                            {/* Centered Barcode bars and code */}
                            <div className="pt-0.5 text-center bg-white space-y-0.5 select-none pointer-events-none">
                              {renderDynamicCssBarcode(p.barcode)}
                              <p className="font-mono text-[7.5px] text-slate-500 font-bold">{p.barcode}</p>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {flattenedLabelsForPreview.length > 12 && (
                    <p className="text-[10px] text-slate-500 italic text-center pt-2">
                      + {flattenedLabelsForPreview.length - 12} more sticker items populated on following print sheets.
                    </p>
                  )}

                  {flattenedLabelsForPreview.length === 0 && (
                    <div className="p-24 text-center text-slate-400 italic">
                      No label rows are selected. Search and add products inside the print selector to preview sticker sheet patterns.
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

        </div>
      )}

      <DashboardBarcodeScanner
        isOpen={isFormScannerOpen}
        onClose={() => setIsFormScannerOpen(false)}
        products={products}
        onScanSuccess={(scannedText) => {
          setBarcode(scannedText);
          setIsFormScannerOpen(false);
        }}
      />

      {/* MODAL II: THERMAL HARDWARE SUCCESS DIAGNOSTIC TEST PAGE */}
      {showTestPrintModal && (
        <div id="modal-test-print" className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in font-mono text-[11px] text-slate-900 select-none" style={{paddingBottom: `calc(${'var(--dashboard-bottom-nav-height, 60px)'} + env(safe-area-inset-bottom))`}}>
          <div className="bg-white border border-slate-350 rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden flex flex-col relative">
            
            {/* Header tab */}
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
              <span className="font-bold text-[10px] tracking-widest uppercase">Thermal Device diagnostics</span>
              <button onClick={() => setShowTestPrintModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Simulated Receipt Page */}
            <div className="p-6 space-y-4 bg-white font-mono text-center relative border-dashed border-b border-slate-300">
              <span className="text-[9px] font-black text-slate-400 font-bold block">*** PHYSICAL PRINT FEEDOUT ***</span>
              
              <div className="space-y-1">
                <p className="font-sans font-black text-xs uppercase text-slate-800">JASPER HARDWARE LABS</p>
                <p className="text-[10px] text-slate-500">Port-Link diagnostics output</p>
                <p className="text-[9px] text-slate-505 font-medium leading-tight">Server-Ingress: Active node</p>
              </div>

              <div className="border-t border-b border-dashed border-slate-250 py-3 space-y-1.5 text-left text-[10px]">
                <div className="flex justify-between">
                  <span>Interface Link:</span>
                  <span className="font-bold uppercase text-slate-800">{connectionType}</span>
                </div>
                <div className="flex justify-between">
                  <span>Target driver:</span>
                  <span className="font-bold text-slate-800">
                    {connectionType === 'usb' ? 'XP-365B' : connectionType === 'bluetooth' ? 'RP85 Beacon' : `${wifiIpAddress}:${wifiPort}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Print queue status:</span>
                  <span className="text-emerald-600 font-bold">READY (OK-0)</span>
                </div>
                <div className="flex justify-between">
                  <span>Calibration:</span>
                  <span className="font-bold">50mm x 300dpi</span>
                </div>
              </div>

              {/* Grid outline representation */}
              <div className="pt-0.5 text-center space-y-0.5">
                {renderDynamicCssBarcode('JSP-TEST-PAGE')}
                <p className="text-[9px] text-slate-700 font-bold tracking-widest">JSP-DIAGNOSTIC-OK</p>
              </div>

              <div className="text-[9.5px] italic text-slate-500 leading-relaxed pt-2">
                "Printed successfully via active Orvix software. Live printer triggers are compatible with unified Windows PRN controllers & mobile thermal Bluetooth devices."
              </div>

              {/* Tear outline mocks */}
              <div className="absolute -left-1.5 top-[230px] w-3 h-3 bg-slate-100 rounded-full border-r border-slate-300" />
              <div className="absolute -right-1.5 top-[230px] w-3 h-3 bg-slate-100 rounded-full border-l border-slate-300" />
            </div>

            <div className="bg-slate-50 p-3 text-center">
              <button 
                onClick={() => setShowTestPrintModal(false)}
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[10px] uppercase cursor-pointer"
              >
                Close Diagnostic View
              </button>
            </div>

          </div>
        </div>
      )}

      {/* METAMODAL: INVENTORY TRANSFER HUB */}
      {transferProduct && (
        <div className="tenant-modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in font-sans" style={{paddingBottom: `calc(${'var(--dashboard-bottom-nav-height, 60px)'} + env(safe-area-inset-bottom))`}}>
          <div className="tenant-form-screen relative bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col uppercase text-xs">
            
            {/* Header */}
            <div className="tenant-form-header px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ArrowLeftRight className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-slate-800 text-xs tracking-wide">Internal Stock Transfer</h4>
              </div>
              <button onClick={() => setTransferProduct(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="tenant-form-body p-5 space-y-4 min-h-0 overflow-y-auto overflow-x-hidden">
              {/* Product Info */}
              <div className="space-y-0.5 normal-case font-medium">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{transferProduct.category}</p>
                <h5 className="text-xs font-bold text-slate-900 leading-snug">{transferProduct.name}</h5>
                <p className="text-[10px] font-mono text-slate-500">Barcode: {transferProduct.barcode}</p>
              </div>

              {/* Current Balances */}
              <div className="grid grid-cols-2 gap-3 pb-1">
                <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-xl text-center space-y-0.5">
                  <span className="text-[9px] font-bold text-emerald-600 tracking-wider">In Shop layout</span>
                  <p className="text-xl font-mono font-black text-emerald-700">{formatProductQuantity(transferProduct.shopStockQty ?? 0, transferProduct)}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-center space-y-0.5">
                  <span className="text-[9px] font-bold text-slate-550 tracking-wider">In store rooms</span>
                  <p className="text-xl font-mono font-black text-slate-700">{formatProductQuantity(transferProduct.storeStockQty ?? 0, transferProduct)}</p>
                </div>
              </div>

              {transferSuccess ? (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-center rounded-xl border border-emerald-150 font-bold text-[10px] tracking-wide animate-pulse">
                  ✓ STOCK TRANSFER COMPLETED SUCCESSFULLY!
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Direction Switcher */}
                  <div className="space-y-1.5">
                    <label className="text-[9.5px] font-bold text-slate-400 block tracking-wider col-span-2">Transfer path</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setTransferDirection('store_to_shop'); setTransferError(null); }}
                        className={`py-2 px-2 rounded-xl text-[10.5px] font-bold transition-all flex flex-col items-center justify-center border cursor-pointer ${
                          transferDirection === 'store_to_shop'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-extrabold'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <span>Store ➔ Shop</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setTransferDirection('shop_to_store'); setTransferError(null); }}
                        className={`py-2 px-2 rounded-xl text-[10.5px] font-bold transition-all flex flex-col items-center justify-center border cursor-pointer ${
                          transferDirection === 'shop_to_store'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-extrabold'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <span>Shop ➔ Store</span>
                      </button>
                      {transferBranches.length > 1 && (
                        <button
                          type="button"
                          onClick={() => { setTransferDirection('branch_to_branch'); setTransferError(null); }}
                          className={`py-2 px-2 rounded-xl text-[10.5px] font-bold transition-all border cursor-pointer ${
                            transferDirection === 'branch_to_branch'
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                              : 'bg-slate-50 border-slate-200 text-slate-500'
                          }`}
                        >
                          Branch ➔ Branch
                        </button>
                      )}
                    </div>
                  </div>

                  {transferDirection === 'branch_to_branch' && (
                    <div className="grid grid-cols-1 gap-3 normal-case">
                      <label className="space-y-1"><span className="text-[10px] font-bold text-slate-500">Source branch</span><select value={transferSourceBranchId} onChange={e => setTransferSourceBranchId(e.target.value)} className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold">{transferBranches.map(branch => <option key={branch.id || branch.branchCode} value={branch.id || ''}>{branch.businessName || branch.branchName}</option>)}</select></label>
                      <label className="space-y-1"><span className="text-[10px] font-bold text-slate-500">Destination branch</span><select value={transferDestinationBranchId} onChange={e => setTransferDestinationBranchId(e.target.value)} className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold"><option value="">Choose destination</option>{transferBranches.filter(branch => branch.id !== transferSourceBranchId).map(branch => <option key={branch.id || branch.branchCode} value={branch.id || ''}>{branch.businessName || branch.branchName}</option>)}</select></label>
                    </div>
                  )}

                  {/* Qty input */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[9.5px] font-bold text-slate-400">
                      <label>Units to move</label>
                      <button 
                        type="button"
                        onClick={() => {
                          const maxQty = transferDirection === 'store_to_shop' 
                            ? (transferProduct.storeStockQty ?? 0) 
                            : transferDirection === 'shop_to_store'
                              ? (transferProduct.shopStockQty ?? 0)
                              : (transferProduct.stockQty ?? 0);
                          setTransferQty(maxQty);
                        }}
                        className="text-emerald-600 hover:underline font-mono"
                      >
                        [Max Qty]
                      </button>
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={transferQty}
                      onChange={(e) => {
                        setTransferQty(Math.max(1, parseInt(e.target.value) || 0));
                        setTransferError(null);
                      }}
                      className="w-full text-center bg-slate-50 border border-slate-200 focus:border-emerald-500 px-3 py-2.5 rounded-xl font-mono text-lg text-slate-800 font-extrabold"
                    />
                  </div>

                  {transferError && (
                    <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-[10.5px] font-bold text-center leading-normal">
                      ⚠ {transferError}
                    </div>
                  )}

                  <button
                    onClick={handleExecuteTransfer}
                    disabled={transferSubmitting}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-505 disabled:opacity-60 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    {transferSubmitting ? 'Posting Transfer…' : 'Review & Commit Stock Move'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW B: PRODUCT CATEGORIES DIRECTORIES */}
      {viewTab === 'category' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fade-in text-xs font-sans">
          {/* Left Panel: Category registration and filter list */}
          <div className="md:col-span-4 space-y-6">
            {/* Create Category Registration form card */}
            <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-xs space-y-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Plus className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-800 text-xs">Register New Category</h4>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Category Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Toiletries, Pharmacy"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 transition-all outline-none font-semibold"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const trimmed = newCategoryName.trim();
                    if (!trimmed) return;
                    if (categoriesList.map(c => c.toLowerCase()).includes(trimmed.toLowerCase())) {
                      alert('This category is already registered!');
                      return;
                    }
                    const updatedSettings: SystemSettings = {
                      ...systemSettings,
                      productStore: {
                        ...systemSettings?.productStore,
                        categories: [...(systemSettings?.productStore?.categories || []), trimmed]
                      }
                    } as SystemSettings;
                    setCustomCategories(prev => [...prev, trimmed]);
                    onUpdateSettings(updatedSettings);
                    setNewCategoryName('');
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-505 text-white rounded-xl font-bold uppercase text-[10.5px] transition-all cursor-pointer"
                >
                  Create Category
                </button>
              </div>
            </div>

            {/* Interactive category listings */}
            <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-xs space-y-4">
              <h4 className="font-bold text-slate-800 text-xs border-b border-slate-100 pb-2">Categories</h4>
              
              <div className="space-y-1.5 overflow-y-auto pr-1">
                <button
                  onClick={() => setSelectedCategoryFilter(null)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between font-medium cursor-pointer ${
                    selectedCategoryFilter === null
                      ? 'bg-slate-900 border-slate-900 text-white font-bold shadow-md shadow-slate-950/10'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>All Registered Items</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono leading-none ${
                    selectedCategoryFilter === null ? 'bg-slate-805 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {products.length}
                  </span>
                </button>

                {categoriesList.map(cat => {
                  const count = products.filter(p => p.category === cat).length;
                  return (
                    <div
                      key={cat}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between font-medium ${
                        selectedCategoryFilter === cat
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedCategoryFilter(cat)}
                        className="flex items-center justify-between flex-1 min-w-0 cursor-pointer bg-transparent border-none text-left"
                      >
                        <span className="truncate pr-2">{cat}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono leading-none flex-shrink-0 ${
                          selectedCategoryFilter === cat ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-200 text-slate-700 font-semibold'
                        }`}>
                          {count}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const productCount = products.filter(product => product.category === cat).length;
                          if (productCount > 0) {
                            alert(`"${cat}" is used by ${productCount} product${productCount === 1 ? '' : 's'}. Reassign those products before deleting this category.`);
                            return;
                          }
                          if (!window.confirm(`Delete category "${cat}"? This cannot be undone.`)) return;

                          setCustomCategories(prev => prev.filter(c => c !== cat));
                          onUpdateSettings({
                            ...systemSettings,
                            productStore: {
                              ...systemSettings?.productStore,
                              categories: (systemSettings?.productStore?.categories || []).filter(existing => existing !== cat)
                            }
                          } as SystemSettings);
                          if (selectedCategoryFilter === cat) setSelectedCategoryFilter(null);
                        }}
                        className="ml-2 p-2 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors flex-shrink-0 cursor-pointer bg-transparent border-none min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Panel: Products under Category filtered list */}
          <div className="md:col-span-8 bg-white border border-slate-200 p-6 rounded-3xl shadow-xs space-y-5 flex flex-col min-h-[450px]">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="font-bold text-slate-800 text-sm uppercase font-mono">
                  {selectedCategoryFilter || 'All Categories'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  Stock for selected category.
                </p>
              </div>
              <span className="font-mono text-[11px] font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-600">
                {products.filter(p => !selectedCategoryFilter || p.category === selectedCategoryFilter).length} matches
              </span>
            </div>

            {/* List products for active Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto max-h-[500px]">
              {products
                .filter(p => !selectedCategoryFilter || p.category === selectedCategoryFilter)
                .map(prod => {
                  const shopQty = prod.shopStockQty ?? 0;
                  const storeQty = prod.storeStockQty ?? 0;
                  return (
                    <div key={prod.id} className="bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start space-x-3 transition-all relative">
                      {prod.image ? (
                        <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl overflow-hidden flex-shrink-0 p-0.5 flex items-center justify-center">
                          <CachedImage src={prod.image} alt={prod.name} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 border border-slate-200 text-slate-400 font-mono text-[7px] font-black rounded-xl flex items-center justify-center uppercase leading-none text-center flex-shrink-0">
                          No img
                        </div>
                      )}
                      
                      <div className="space-y-1 min-w-0 flex-grow">
                        <h5 className="font-bold text-slate-800 text-[12.5px] truncate leading-snug">{prod.name}</h5>
                        <p className="text-[10px] text-slate-400 font-mono tracking-wider">Barcode: <span className="font-semibold text-slate-700">{prod.barcode}</span></p>
                        <p className="text-[10px] text-slate-400 font-semibold">Brand: <span className="text-slate-700">{prod.brand || '—'}</span></p>
                        <div className="flex items-center space-x-3 pt-1.5 font-mono text-[10.5px]">
                          <span className="text-emerald-700 font-bold font-mono">Cost: {currency}{prod.costPrice}</span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-800 font-mono font-extrabold">Price: {currency}{prod.sellingPrice}</span>
                        </div>
                        <div className="pt-2">
                          <span className="inline-block bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-mono text-[9.5px]">
                            Shop: {formatProductQuantity(shopQty, prod)} / Store: {formatProductQuantity(storeQty, prod)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {products.filter(p => !selectedCategoryFilter || p.category === selectedCategoryFilter).length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-400">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-bounce" />
                  <p className="font-semibold text-xs">No active store items match this category classifications.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW C: PRODUCT BRANDS DIRECTORIES */}
      {viewTab === 'brand' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fade-in text-xs font-sans">
          {/* Left Panel: Brand registration and logo upload, interactive listings */}
          <div className="md:col-span-4 space-y-6">
            {/* Create Brand Registration form card */}
            <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-xs space-y-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                </div>
                <h4 className="font-bold text-slate-800 text-xs">Register New Brand</h4>
              </div>

              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Brand Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Nestle, Unilever"
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 transition-all outline-none font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Brand Logo / Visual Mark</label>
                  <div className="border border-dashed border-slate-220 rounded-xl p-3 bg-slate-50/50 flex items-center space-x-3">
                    {newBrandLogo ? (
                      <div className="w-11 h-11 bg-white border border-slate-200 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center p-0.5">
                        <img src={newBrandLogo} alt="Brand Logo Preview" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                    ) : (
                      <div className="w-11 h-11 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-[8px] font-mono text-slate-400 font-bold leading-none text-center uppercase flex-shrink-0">
                        No logo
                      </div>
                    )}
                    <div className="relative inline-block overflow-hidden">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleBrandLogoUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                      />
                      <button type="button" className="py-1 px-2.5 bg-white border border-slate-220 rounded-lg font-bold text-[10.5px] text-slate-700 flex items-center space-x-1 hover:bg-slate-50 shadow-2xs cursor-pointer">
                        <Upload className="w-3 h-3 text-slate-400" />
                        <span>Upload Logo</span>
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const trimmed = newBrandName.trim();
                    if (!trimmed) return;
                    if (brandsList.map(b => b.name.toLowerCase()).includes(trimmed.toLowerCase())) {
                      alert('This brand name is already registered!');
                      return;
                    }
                    const nextBrand = {
                      name: trimmed,
                      logo: newBrandLogo || undefined
                    };
                    persistCustomBrands([...customBrands, nextBrand]);
                    setNewBrandName('');
                    setNewBrandLogo('');
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-505 text-white rounded-xl font-bold uppercase text-[10.5px] transition-all cursor-pointer"
                >
                  Save Product Brand
                </button>
              </div>
            </div>

            {/* Interactive brand directories */}
            <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-xs space-y-4">
              <h4 className="font-bold text-slate-800 text-xs border-b border-slate-100 pb-2">Product Brands</h4>
              
              <div className="space-y-1.5 overflow-y-auto pr-1">
                <button
                  onClick={() => setSelectedBrandFilter(null)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between font-medium cursor-pointer ${
                    selectedBrandFilter === null
                      ? 'bg-slate-900 border-slate-900 text-white font-bold shadow-md shadow-slate-950/10'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-700 text-white font-black flex items-center justify-center text-[8px] font-mono leading-none">ALL</span>
                    <span>All Brands</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono leading-none ${
                    selectedBrandFilter === null ? 'bg-slate-805 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {products.length}
                  </span>
                </button>

                {brandsList.map(b => {
                  const count = products.filter(p => p.brand?.toLowerCase() === b.name.toLowerCase()).length;
                  const initials = b.name.slice(0, 2).toUpperCase();
                  return (
                    <div
                      key={b.name}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between font-medium ${
                        selectedBrandFilter?.toLowerCase() === b.name.toLowerCase()
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedBrandFilter(b.name)}
                        className="flex items-center justify-between flex-1 min-w-0 cursor-pointer bg-transparent border-none text-left"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          {b.logo ? (
                            <div className="w-5 h-5 bg-white border border-slate-200 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center p-0.5">
                              <img src={b.logo} alt={b.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                            </div>
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-[7.5px] font-mono leading-none flex-shrink-0 uppercase">
                              {initials}
                            </span>
                          )}
                          <span className="truncate pr-1">{b.name}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono leading-none flex-shrink-0 ${
                          selectedBrandFilter?.toLowerCase() === b.name.toLowerCase() ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-200 text-slate-700 font-semibold'
                        }`}>
                          {count}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete brand "${b.name}"? Products using it will be unlinked.`)) {
                            persistCustomBrands(customBrands.filter(br => br.name !== b.name));
                            if (selectedBrandFilter === b.name) setSelectedBrandFilter(null);
                          }
                        }}
                        className="ml-2 p-2 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors flex-shrink-0 cursor-pointer bg-transparent border-none min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title="Delete Brand"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Panel: Products under Brand filtered list */}
          <div className="md:col-span-8 bg-white border border-slate-200 p-6 rounded-3xl shadow-xs space-y-5 flex flex-col min-h-[450px]">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="font-bold text-slate-800 text-sm uppercase font-mono flex items-center space-x-2">
                  <span>{selectedBrandFilter || 'All Brands'} Products Grid</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Showing active system registry lines under selected brand house labels.
                </p>
              </div>
              <span className="font-mono text-[11px] font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-600">
                {products.filter(p => !selectedBrandFilter || p.brand?.toLowerCase() === selectedBrandFilter.toLowerCase()).length} matches
              </span>
            </div>

            {/* List products for active Brand */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto max-h-[500px]">
              {products
                .filter(p => !selectedBrandFilter || p.brand?.toLowerCase() === selectedBrandFilter.toLowerCase())
                .map(prod => {
                  const shopQty = prod.shopStockQty ?? 0;
                  const storeQty = prod.storeStockQty ?? 0;
                  return (
                    <div key={prod.id} className="bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start space-x-3 transition-all">
                      {prod.image ? (
                        <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl overflow-hidden flex-shrink-0 p-0.5 flex items-center justify-center">
                          <CachedImage src={prod.image} alt={prod.name} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 border border-slate-200 text-slate-400 font-mono text-[7px] font-black rounded-xl flex items-center justify-center uppercase leading-none text-center flex-shrink-0">
                          No img
                        </div>
                      )}
                      
                      <div className="space-y-1 min-w-0 flex-grow">
                        <h5 className="font-bold text-slate-800 text-[12.5px] truncate leading-snug">{prod.name}</h5>
                        <p className="text-[10px] text-slate-400 font-mono tracking-wider">Barcode: <span className="font-semibold text-slate-700">{prod.barcode}</span></p>
                        <p className="text-[10px] text-slate-400 font-semibold">
                          Category: <span className="text-slate-700">{prod.category}</span>
                          {prod.unit && <span className="ml-2 font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded leading-none">Unit: {prod.unit}</span>}
                        </p>
                        <div className="flex items-center space-x-3 pt-1.5 font-mono text-[10.5px]">
                          <span className="text-emerald-700 font-bold font-mono">Cost: {currency}{prod.costPrice}</span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-800 font-mono font-extrabold">Price: {currency}{prod.sellingPrice}</span>
                        </div>
                        <div className="pt-2">
                          <span className="inline-block bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-mono text-[9.5px]">
                            Shop: {formatProductQuantity(shopQty, prod)} / Store: {formatProductQuantity(storeQty, prod)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {products.filter(p => !selectedBrandFilter || p.brand?.toLowerCase() === selectedBrandFilter.toLowerCase()).length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-400">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-bounce" />
                  <p className="font-semibold text-xs">No active stock lines linked with this brand label found.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {viewingProduct && (
        <div className="tenant-modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in font-sans" style={{paddingBottom: `calc(${'var(--dashboard-bottom-nav-height, 60px)'} + env(safe-area-inset-bottom))`}}>
          <div className="tenant-form-screen bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[calc(100vh-56px-env(safe-area-inset-bottom)-env(safe-area-inset-top))] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="tenant-form-header px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono">Product View-Details Desk</h4>
              </div>
              <button type="button" onClick={() => setViewingProduct(null)} className="text-slate-500 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="tenant-form-body p-6 space-y-6 text-xs text-slate-600 uppercase min-h-0 overflow-y-auto overflow-x-hidden">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Visual Block & Classification summary */}
                <div className="space-y-4">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1.5 font-mono">1. Descriptor & Image</h5>
                  
                  <div className="space-y-1.5 normal-case font-semibold text-xs">
                    <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Product Name / Title</label>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 font-bold">
                      {viewingProduct.name}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Category Classification</label>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 font-bold font-mono">
                      {viewingProduct.category}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Product Brand</label>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 font-bold font-mono">
                      {viewingProduct.brand || "—"}
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 font-mono">
                    <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Asset Image Preview</label>
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-center">
                      {viewingProduct.image ? (
                        <CachedImage src={viewingProduct.image} alt={viewingProduct.name} className="max-h-36 object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="text-slate-400 font-extrabold text-[9px] p-8 text-center bg-slate-50 w-full rounded">
                          No Image
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stock levels block */}
                <div className="space-y-4">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1.5 font-mono">2. Barcode & Stocking</h5>
                  
                  <div className="space-y-1.5 font-mono">
                    <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Retail barcode (SKU)</label>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 font-bold font-mono tracking-wide">
                      {viewingProduct.barcode}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pb-1 font-mono">
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Shop shelf units</label>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 font-bold">
                        {formatProductQuantity(viewingProduct.shopStockQty ?? 0, viewingProduct)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase block">store room units</label>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 font-bold font-mono">
                        {formatProductQuantity(viewingProduct.storeStockQty ?? 0, viewingProduct)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 font-mono">
                    <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Low alert Level threshold</label>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 font-bold font-mono">
                      {formatProductQuantity(viewingProduct.alertQty ?? 5, viewingProduct)}
                    </div>
                  </div>

                  <div className="bg-teal-50/50 border border-teal-150 p-4 rounded-2xl items-center font-mono">
                    <span className="text-[9.5px] font-bold text-teal-650 uppercase block">Overall ledger balance</span>
                    <p className="text-2xl font-black text-teal-800 mt-1">{formatProductQuantity((viewingProduct.shopStockQty ?? 0) + (viewingProduct.storeStockQty ?? 0), viewingProduct)}</p>
                  </div>
                </div>

                {/* Sells & Margin statistics */}
                <div className="space-y-4 font-mono">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1.5 font-mono">3. Financial Margin metrics</h5>
                  
                  <div className="grid grid-cols-2 gap-3 pb-1">
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Cost Buy pricing</label>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-emerald-700 font-extrabold">
                        {currency}{(viewingProduct.costPrice ?? 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Retail pricing</label>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-855 font-extrabold">
                        {viewingProduct.sellInRetail !== false ? `${currency}${(viewingProduct.sellingPrice ?? 0).toLocaleString()}` : 'LOCKED'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-b border-dashed border-slate-200 pb-3">
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Wholesale pricing</label>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 font-bold">
                        {viewingProduct.sellInWholesale ? `${currency}${(viewingProduct.wholesalePrice ?? 0).toLocaleString()}` : 'LOCKED'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Wholesale Min qty</label>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 font-bold">
                        {viewingProduct.sellInWholesale ? formatProductQuantity(viewingProduct.minWholesaleQty ?? 10, viewingProduct) : 'LOCKED'}
                      </div>
                    </div>
                  </div>

                  {/* Profit calculations */}
                  {viewingProduct.sellInRetail !== false && viewingProduct.sellingPrice > 0 && (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1.5 text-slate-500">
                      <div className="flex justify-between">
                        <span>Markup Factor:</span>
                        <span className="text-slate-800 font-bold">
                          {(((viewingProduct.sellingPrice - viewingProduct.costPrice) / (viewingProduct.costPrice || 1)) * 105).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Earned Profit Margin:</span>
                        <span className="text-emerald-600 font-bold">
                          {(((viewingProduct.sellingPrice - viewingProduct.costPrice) / (viewingProduct.sellingPrice || 1)) * 105).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between font-sans font-bold text-slate-800 pt-1 border-t border-slate-200">
                        <span>Margin Gain / Unit:</span>
                        <span className="text-emerald-700">{currency}{(viewingProduct.sellingPrice - viewingProduct.costPrice).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Batches Log */}
                {viewingProduct.batches && viewingProduct.batches.length > 0 && (
                  <div className="md:col-span-3 space-y-4 font-mono mt-4">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1.5 font-mono">4. Purchase Batches Log</h5>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                           <tr className="text-[9px] text-slate-500 bg-slate-100">
                             <th className="p-3">Batch ID</th>
                             <th className="p-3">Date</th>
                             <th className="p-3">Supplier</th>
                             <th className="p-3">Bought Qty</th>
                             <th className="p-3">Remain Qty</th>
                             <th className="p-3">Buy Price</th>
                             <th className="p-3">Sale Price</th>
                             <th className="p-3">Status</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {viewingProduct.batches.map(b => (
                            <tr key={b.id} className={b.status === 'finished' ? 'opacity-60 bg-slate-50' : 'bg-white'}>
                               <td className="p-3 font-bold">{b.batchNumber}</td>
                               <td className="p-3">{new Date(b.purchaseDate).toLocaleDateString()}</td>
                               <td className="p-3">{b.supplierName || '-'}</td>
                               <td className="p-3">{b.quantityPurchased}</td>
                               <td className="p-3 font-bold text-emerald-600">{b.quantityRemaining}</td>
                               <td className="p-3">{currency}{b.buyingPrice.toLocaleString()}</td>
                               <td className="p-3">{currency}{b.finalSellingPrice?.toLocaleString() || viewingProduct.sellingPrice.toLocaleString()}</td>
                               <td className="p-3">
                                 <span className={`px-2 py-1 rounded text-[8px] tracking-wider uppercase font-bold ${b.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                                    {b.status}
                                 </span>
                               </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-4 flex justify-end">
              <button 
                type="button"
                onClick={() => setViewingProduct(null)} 
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl uppercase tracking-wider text-[10.5px] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {editingProduct && (
        <div className="tenant-modal-overlay fixed inset-0 z-[230] flex items-stretch justify-center bg-slate-950/70 backdrop-blur-sm animate-fade-in font-sans lg:items-center lg:p-4" style={{paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)'}}>
          <form 
            onSubmit={handleSaveProductEdit}
            className="tenant-form-screen bg-white border border-slate-200 shadow-2xl w-full h-full max-h-[100dvh] overflow-hidden flex flex-col uppercase text-xs lg:h-auto lg:max-w-4xl lg:max-h-[calc(100dvh_-_2rem)] lg:rounded-3xl"
          >
            {/* Header */}
            <div className="tenant-form-header sticky top-0 z-10 px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2 min-w-0">
                <Edit className="w-4 h-4 text-emerald-600 animate-pulse" />
                <h4 className="flex-1 min-w-0 font-bold text-slate-800 text-[11px] sm:text-xs uppercase tracking-wider font-mono truncate">Adjust Product details desk</h4>
              </div>
              <button type="button" onClick={() => setEditingProduct(null)} className="w-10 h-10 lg:w-auto lg:h-auto rounded-full bg-white lg:bg-transparent border border-slate-200 lg:border-0 flex items-center justify-center text-slate-500 hover:text-slate-700 cursor-pointer shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="tenant-form-body flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6 space-y-6 text-xs text-slate-600">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Visual Block & Classification summary */}
                <div className="space-y-4">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1.5 font-mono">1. Descriptor & Image</h5>
                  
                  <div className="space-y-1.5 normal-case font-semibold text-xs">
                    <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Product Name / Title</label>
                    <input 
                      type="text" 
                      required
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-855 font-bold outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Category Classification</label>
                      <ModernSelect
                        value={editForm.category || ''}
                        options={categorySelectOptions}
                        onChange={(nextCategory) => setEditForm(prev => ({ ...prev, category: nextCategory }))}
                        title="Choose category"
                        placeholder="Select category"
                        searchPlaceholder="Search categories"
                        searchable
                        showOptionMarkers
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Units</label>
                      <ModernSelect
                        value={editForm.unit || ''}
                        options={editUnitSelectOptions}
                        onChange={(nextUnit) => setEditForm(prev => ({
                          ...prev,
                          unit: nextUnit,
                          ...(prev.isBulkProduct || prev.allowScaleSelling ? {} : { baseUnit: nextUnit }),
                        }))}
                        title="Choose unit"
                        placeholder="No unit"
                        searchPlaceholder="Search units"
                        searchable={editUnitSelectOptions.length > 7}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Product Brand</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Nestle, Sprite"
                      list="brands-suggestions-edit"
                      value={editForm.brand || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, brand: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-855 font-bold outline-none font-semibold"
                    />
                    <datalist id="brands-suggestions-edit">
                      {brandsList.map(b => (
                        <option key={b.name} value={b.name} />
                      ))}
                    </datalist>
                  </div>

                  <div className="space-y-2 pt-1 font-mono">
                    <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Asset Image Preview</label>
                    
                    <div className="border border-dashed border-slate-220 rounded-xl p-3 bg-slate-50 flex items-center space-x-3">
                      {editForm.image ? (
                        <div className="w-12 h-12 bg-white border border-slate-200 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center p-0.5">
                          <img src={editForm.image} alt="Product logo preview" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-[7.5px] text-slate-400 font-extrabold text-center uppercase flex-shrink-0">
                          NO IMG
                        </div>
                      )}
                      
                      <div className="relative inline-block overflow-hidden flex-grow">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setEditImageFile(file);
                              // Compress to 400×400px JPEG 75% before preview and upload
                              const compressed = await compressImageFile(file, { maxWidth: 400, maxHeight: 400, quality: 0.75 });
                              setEditForm(prev => ({ ...prev, image: compressed }));
                            }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                        />
                        <button type="button" className="py-1.5 px-2.5 bg-white border border-slate-220 rounded-lg text-[10.5px] font-bold text-slate-700 flex items-center space-x-1 hover:bg-slate-50 shadow-2xs cursor-pointer">
                          <Upload className="w-3 h-3 text-slate-400" />
                          <span>Replace image</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stock levels block */}
                <div className="space-y-4">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1.5 font-mono">2. Barcode & Stocking</h5>
                  
                  <div className="space-y-1.5 font-mono">
                    <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Retail barcode (SKU)</label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={editForm.barcode || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, barcode: e.target.value }))}
                        placeholder="Enter or generate barcode"
                        aria-label="Retail barcode"
                        className="min-w-0 flex-1 bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-855 font-bold outline-none font-mono tracking-wide"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateEditBarcode}
                        className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[10px] font-black text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100 active:bg-emerald-200"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Generate Barcode</span>
                      </button>
                    </div>
                    <p className="text-[9.5px] text-slate-400 font-sans">Enter a barcode, or tap Generate Barcode to create one.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pb-1 font-mono">
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Shop shelf ({activeTenant.businessType !== 'pharmacy' ? (editForm.baseUnit || editForm.inventorySettings?.baseUnit || editForm.unit || 'units') : 'Units'})</label>
                      <input 
                        type="number" 
                        min="0"
                        step="0.001"
                        value={editStockDraft.shop}
                        onChange={(e) => updateEditStockNumber('shopStockQty', 'shop', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-855 font-mono outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase block">store rooms ({activeTenant.businessType !== 'pharmacy' ? (editForm.baseUnit || editForm.inventorySettings?.baseUnit || editForm.unit || 'units') : 'Units'})</label>
                      <input 
                        type="number" 
                        min="0"
                        step="0.001"
                        value={editStockDraft.store}
                        onChange={(e) => updateEditStockNumber('storeStockQty', 'store', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-855 font-mono outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 font-mono">
                    <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Low alert Level threshold</label>
                    <input 
                      type="number" 
                      min="0"
                      step="0.001"
                      value={editStockDraft.alert}
                      onChange={(e) => updateEditStockNumber('alertQty', 'alert', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-855 font-mono outline-none"
                    />
                  </div>

                  <div className="bg-teal-50/50 border border-teal-150 p-4 rounded-2xl items-center font-mono">
                    <span className="text-[9.5px] font-bold text-teal-650 uppercase block">Overall ledger balance</span>
                    <p className="text-2xl font-black text-teal-800 mt-1">{formatProductQuantity((editForm.shopStockQty ?? 0) + (editForm.storeStockQty ?? 0), editForm as Product)}</p>
                  </div>
                </div>

                {/* Sells & Margin statistics */}
                <div className="space-y-4 font-mono">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1.5 font-mono">3. Financial Margin metrics</h5>
                  
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/60 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider font-mono">Active Selling Channels</span>
                    <div className="grid grid-cols-2 gap-2 font-sans font-bold leading-none text-slate-700">
                      <label className="flex items-center space-x-1.5 bg-white p-2 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300">
                        <input 
                          type="checkbox" 
                          checked={editForm.sellInRetail !== false} 
                          onChange={(e) => {
                            setEditForm(prev => ({ ...prev, sellInRetail: e.target.checked }));
                          }}
                          className="accent-teal-600 w-3.5 h-3.5"
                        />
                        <span className="font-semibold text-[11px] text-slate-700">Sell Retail</span>
                      </label>
                      <label className="flex items-center space-x-1.5 bg-white p-2 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300">
                        <input 
                          type="checkbox" 
                          checked={!!editForm.sellInWholesale} 
                          onChange={(e) => setEditForm(prev => ({ ...prev, sellInWholesale: e.target.checked }))}
                          className="accent-teal-600 w-3.5 h-3.5"
                        />
                        <span className="font-semibold text-[11px] text-slate-700">Sell Wholesale</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase block">{editForm.isBulkProduct && activeTenant.businessType !== 'pharmacy' ? `Package Buy Cost (${editForm.purchaseUnit || editForm.inventorySettings?.purchaseUnit || editForm.bulkUnit || 'Package'})` : 'Cost buy Price'}</label>
                      <input 
                        type="number" 
                        min="0"
                        value={editForm.isBulkProduct && activeTenant.businessType !== 'pharmacy'
                          ? editNumberValue(editForm.packageBuyingCost ?? editForm.inventorySettings?.packageBuyingCost ?? editForm.costPrice)
                          : editNumberValue(editForm.costPrice)}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0);
                          setEditForm(prev => prev.isBulkProduct && activeTenant.businessType !== 'pharmacy'
                            ? { ...prev, packageBuyingCost: val }
                            : { ...prev, costPrice: val }
                          );
                        }}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-855 font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Retail price</label>
                      <input 
                        type="number" 
                        min="1"
                        disabled={editForm.sellInRetail === false}
                        value={editForm.sellInRetail !== false ? editNumberValue(editForm.sellingPrice) : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0);
                          setEditForm(prev => ({ ...prev, sellingPrice: val }));
                        }}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-855 font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-b border-dashed border-slate-200 pb-3">
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Wholesale price</label>
                      <input 
                        type="number" 
                        min="1"
                        disabled={!editForm.sellInWholesale}
                        value={editForm.sellInWholesale ? editNumberValue(editForm.wholesalePrice) : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0);
                          setEditForm(prev => ({ ...prev, wholesalePrice: val }));
                        }}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-855 font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Wholesale Min Qty</label>
                      <input 
                        type="number" 
                        min="1"
                        disabled={!editForm.sellInWholesale}
                        value={editForm.sellInWholesale ? editNumberValue(editForm.minWholesaleQty) : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : Math.max(1, parseInt(e.target.value) || 1);
                          setEditForm(prev => ({ ...prev, minWholesaleQty: val }));
                        }}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-855 font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 pt-1 font-mono">
                    <label className="text-[9.5px] font-bold text-slate-500 uppercase block">How Stock is Used</label>
                    <ModernSelect
                      value={editForm.costingMethod || editForm.inventorySettings?.costingMethod || 'fifo'}
                      options={COSTING_METHOD_OPTIONS}
                      onChange={(nextMethod) => {
                        const method = nextMethod as 'fifo'|'average_price'|'batch_price';
                        setEditForm(prev => ({
                          ...prev,
                          costingMethod: method,
                          sellingMethod: mapCostingMethodToLegacy(method),
                          inventorySettings: {
                            costingMethod: method,
                            allowPosMethodOverride: prev.inventorySettings?.allowPosMethodOverride ?? prev.allowPosMethodOverride ?? false,
                            allowScaleSelling: prev.inventorySettings?.allowScaleSelling ?? prev.allowScaleSelling ?? !!prev.isBulkProduct,
                            purchaseUnit: prev.inventorySettings?.purchaseUnit || prev.purchaseUnit || prev.bulkUnit || prev.unit || 'Unit',
                            baseUnit: prev.inventorySettings?.baseUnit || prev.baseUnit || prev.sellUnit || prev.unit || 'Unit',
                            conversionToBaseUnit: prev.inventorySettings?.conversionToBaseUnit || prev.conversionToBaseUnit || 1,
                            allowCustomQuantity: prev.inventorySettings?.allowCustomQuantity ?? prev.allowCustomQuantity ?? true,
                            defaultPricePerBaseUnit: prev.inventorySettings?.defaultPricePerBaseUnit ?? prev.defaultPricePerBaseUnit ?? prev.sellUnitPrice,
                            fractionSaleOptions: prev.inventorySettings?.fractionSaleOptions || prev.fractionSaleOptions,
                            pharmacyUnitBreakdown: prev.inventorySettings?.pharmacyUnitBreakdown || prev.pharmacyUnitBreakdown,
                          },
                        }));
                      }}
                      title="Choose costing method"
                      showOptionMarkers
                    />
                  </div>

                  <div className={`grid ${activeTenant.businessType === 'pharmacy' ? 'grid-cols-1' : 'grid-cols-2'} gap-3 pt-1`}>
                    <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-600 uppercase">
                      <input
                        type="checkbox"
                        checked={!!(editForm.allowPosMethodOverride ?? editForm.inventorySettings?.allowPosMethodOverride)}
                        onChange={(e) => setEditForm(prev => ({
                          ...prev,
                          allowPosMethodOverride: e.target.checked,
                          inventorySettings: {
                            costingMethod: prev.costingMethod || prev.inventorySettings?.costingMethod || 'fifo',
                            allowPosMethodOverride: e.target.checked,
                            allowScaleSelling: prev.inventorySettings?.allowScaleSelling ?? prev.allowScaleSelling ?? !!prev.isBulkProduct,
                            purchaseUnit: prev.inventorySettings?.purchaseUnit || prev.purchaseUnit || prev.bulkUnit || prev.unit || 'Unit',
                            baseUnit: prev.inventorySettings?.baseUnit || prev.baseUnit || prev.sellUnit || prev.unit || 'Unit',
                            conversionToBaseUnit: prev.inventorySettings?.conversionToBaseUnit || prev.conversionToBaseUnit || 1,
                            allowCustomQuantity: prev.inventorySettings?.allowCustomQuantity ?? prev.allowCustomQuantity ?? true,
                            defaultPricePerBaseUnit: prev.inventorySettings?.defaultPricePerBaseUnit ?? prev.defaultPricePerBaseUnit ?? prev.sellUnitPrice,
                            fractionSaleOptions: prev.inventorySettings?.fractionSaleOptions || prev.fractionSaleOptions,
                            pharmacyUnitBreakdown: prev.inventorySettings?.pharmacyUnitBreakdown || prev.pharmacyUnitBreakdown,
                          },
                        }))}
                        className="accent-emerald-600"
                      />
                      POS Override
                    </label>
                    {activeTenant.businessType !== 'pharmacy' && (
                      <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-600 uppercase">
                        <input
                          type="checkbox"
                          checked={!!(editForm.allowScaleSelling ?? editForm.inventorySettings?.allowScaleSelling)}
                          onChange={(e) => setEditForm(prev => ({ ...prev, allowScaleSelling: e.target.checked }))}
                          className="accent-emerald-600"
                        />
                        Scale Selling
                      </label>
                    )}
                  </div>

                  {activeTenant.businessType !== 'pharmacy' && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Package Name</label>
                        <input value={editForm.purchaseUnit || editForm.inventorySettings?.purchaseUnit || editForm.bulkUnit || ''} onChange={e => setEditForm(prev => ({ ...prev, purchaseUnit: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Sell / Count Unit</label>
                        <input value={editForm.baseUnit || editForm.inventorySettings?.baseUnit || editForm.sellUnit || ''} onChange={e => setEditForm(prev => ({ ...prev, baseUnit: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9.5px] font-bold text-slate-500 uppercase block">1 Package Contains</label>
                        <input type="number" step="0.001" value={editNumberValue(editForm.conversionToBaseUnit || editForm.inventorySettings?.conversionToBaseUnit)} onChange={e => setEditForm(prev => ({ ...prev, conversionToBaseUnit: e.target.value === '' ? undefined : Number(e.target.value) || 1 }))} className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {activeTenant.businessType === 'pharmacy' && (
                <div className="px-5 pb-5">
                  {(() => {
                    const structure = getEditPharmacyStructure(editForm);
                    const topLabel = structure.hierarchyStart === 'box'
                      ? 'Strips per Box'
                      : structure.hierarchyStart === 'master_box'
                        ? 'Cartons per Master Box'
                        : '';
                    const middleLabel = structure.productType === 'non_pharmaceutical' ? 'Pieces per Carton' : `${structure.base}s per Strip`;
                    return (
                      <div className="border border-emerald-100 bg-emerald-50/40 rounded-2xl p-4 space-y-3">
                        <div>
                          <span className="font-bold text-[11px] text-slate-700 uppercase tracking-widest">Pharmacy Unit Hierarchy</span>
                          <p className="text-[10px] text-slate-450 mt-0.5">Edit pharmaceutical or non-pharmaceutical selling levels.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase">Product type</label>
                            <ModernSelect value={structure.productType} options={PHARMACY_PRODUCT_TYPE_OPTIONS} onChange={(nextValue) => setEditForm(prev => ({
                              ...prev,
                              pharmacyProductType: nextValue as any,
                              pharmacyHierarchyStart: nextValue === 'non_pharmaceutical' ? 'carton' : 'packet',
                              pharmacyBaseUnit: nextValue === 'non_pharmaceutical' ? 'Piece' : (prev.pharmacyBaseUnit || 'Tablet')
                            }))} title="Choose product type" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase">Start level</label>
                            <ModernSelect
                              value={structure.hierarchyStart}
                              options={structure.productType === 'pharmaceutical'
                                ? PHARMACY_START_OPTIONS.pharmaceutical
                                : PHARMACY_START_OPTIONS.nonPharmaceutical}
                              onChange={(nextValue) => setEditForm(prev => ({ ...prev, pharmacyHierarchyStart: nextValue as any }))}
                              title="Choose starting level"
                            />
                          </div>
                          {structure.productType === 'pharmaceutical' && (
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Base unit</label>
                              <input value={structure.base} onChange={e => setEditForm(prev => ({ ...prev, pharmacyBaseUnit: e.target.value }))} className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                            </div>
                          )}
                          {topLabel && (
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-500 uppercase">{topLabel}</label>
                              <input type="number" min={1} value={structure.topQty} onChange={e => setEditForm(prev => ({ ...prev, pharmacyTopContains: Number(e.target.value) || 1 } as any))} className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                            </div>
                          )}
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase">{middleLabel}</label>
                            <input type="number" min={1} value={structure.middleQty} onChange={e => setEditForm(prev => ({ ...prev, pharmacyMiddleContains: Number(e.target.value) || 1, dosesPerPacket: Number(e.target.value) || 1 } as any))} className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                          </div>
                          {structure.productType === 'pharmaceutical' && (
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-500 uppercase">{structure.base}s per Dose</label>
                              <input type="number" min={1} value={structure.doseQty} onChange={e => setEditForm(prev => ({ ...prev, pharmacyDoseContains: Number(e.target.value) || 1, tabsPerDose: Number(e.target.value) || 1 } as any))} className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                            </div>
                          )}
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase">{structure.hierarchy.levels[0]?.unit || 'Top unit'} price</label>
                            <input type="number" value={editNumberValue(editForm.sellingPrice)} onChange={e => setEditForm(prev => ({ ...prev, sellingPrice: e.target.value === '' ? undefined : Number(e.target.value) || 0 }))} className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase">Price per {structure.hierarchy.baseUnit}</label>
                            <input type="number" value={editForm.tabPrice ?? ''} onChange={e => setEditForm(prev => ({ ...prev, tabPrice: e.target.value === '' ? undefined : Number(e.target.value) }))} className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                          </div>
                          <div className="col-span-2 text-[10px] font-mono text-emerald-800 bg-white/70 border border-emerald-100 rounded-xl px-3 py-2">
                            POS levels: {structure.hierarchy.levels.map(level => `${level.unit} (${level.quantityToBaseUnit} ${structure.hierarchy.baseUnit})`).join(' -> ')}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Edit Bidhaa ya Jumla / Bulk Product SECTION */}
              <div className="px-5 pb-5">
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Scale className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-bold text-[11px] text-slate-700 uppercase tracking-widest">Retail Package Selling</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={!!editForm.isBulkProduct} 
                        onChange={(e) => setEditForm(prev => ({ ...prev, isBulkProduct: e.target.checked, sellingMode: prev.sellingMode || 'scale', bulkPurchaseQty: prev.bulkPurchaseQty || 100, sellUnitQty: prev.sellUnitQty || 1, sellUnitPrice: prev.sellUnitPrice || 0 }))}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                  
                  {editForm.isBulkProduct && (
                    <div className="p-4 bg-white border-t border-slate-200 space-y-4">
                      {/* Mode Selector */}
                      <div>
                        <label className="text-[9.5px] font-bold text-slate-500 uppercase block mb-1.5">{t('sellByWeightOrPcs')}</label>
                        <div className="flex bg-slate-50 rounded-lg p-1 border border-slate-200">
                          <button 
                            type="button"
                            onClick={() => setEditForm(prev => ({ ...prev, sellingMode: 'scale' }))}
                            className={`flex-1 py-1 text-[10.5px] font-bold rounded transition-all ${editForm.sellingMode === 'scale' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-white'}`}
                          >
                            {t('scaleMode')}
                          </button>
                          <button 
                            type="button"
                            onClick={() => setEditForm(prev => ({ ...prev, sellingMode: 'pcs' }))}
                            className={`flex-1 py-1 text-[10.5px] font-bold rounded transition-all ${editForm.sellingMode === 'pcs' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-white'}`}
                          >
                            {t('pcsMode')}
                          </button>
                          <button 
                            type="button"
                            onClick={() => setEditForm(prev => ({ ...prev, sellingMode: 'hybrid' }))}
                            className={`flex-1 py-1 text-[10.5px] font-bold rounded transition-all ${editForm.sellingMode === 'hybrid' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-white'}`}
                          >
                            {t('hybridMode')}
                          </button>
                        </div>
                      </div>

                      {/* Inputs */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9.5px] font-bold text-slate-500 uppercase block">1 Package Contains</label>
                          <input type="number" step="0.001" value={editForm.conversionToBaseUnit ?? editForm.inventorySettings?.conversionToBaseUnit ?? editForm.bulkPurchaseQty ?? ''} onChange={e => {
                            const value = e.target.value === '' ? undefined : Number(e.target.value);
                            setEditForm(prev => ({ ...prev, conversionToBaseUnit: value, bulkPurchaseQty: value }));
                          }} className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Base Unit</label>
                          <input value={editForm.baseUnit || editForm.inventorySettings?.baseUnit || editForm.sellUnit || ''} onChange={e => setEditForm(prev => ({ ...prev, baseUnit: e.target.value, sellUnit: e.target.value }))} placeholder="kg, litre, pcs" className="w-full bg-slate-50 border border-slate-200 text-[11px] px-2 py-2 rounded-xl" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Quick Sale Portions</label>
                          {editForm.sellingMode === 'scale' || editForm.sellingMode === 'hybrid' ? (
                            <div className="flex flex-col space-y-1">
                             <div className="flex space-x-1 overflow-x-auto scrollbar-hide flex-wrap gap-y-1">
                               {[
                                 { label: '1/4', value: 0.25 },
                                 { label: '1/2', value: 0.5 },
                                 { label: '3/4', value: 0.75 },
                                 { label: '1', value: 1 },
                               ].map(f => (
                                 <button type="button" key={f.label} onClick={() => setEditForm(prev => ({ ...prev, sellUnit: prev.baseUnit || prev.inventorySettings?.baseUnit || 'kg', sellUnitQty: f.value }))} className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-50 border border-slate-200 rounded">{f.label} {editForm.baseUnit || editForm.inventorySettings?.baseUnit || 'kg'}</button>
                               ))}
                             </div>
                            </div>
                          ) : (
                             <input type="text" value={editForm.sellUnit ?? ''} onChange={e => setEditForm(prev => ({ ...prev, sellUnit: e.target.value }))} placeholder="Per piece" className="w-full bg-slate-50 border border-slate-200 text-[11px] px-3 py-2 rounded-xl" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Default Portion Qty</label>
                          {editForm.sellingMode === 'scale' || editForm.sellingMode === 'hybrid' ? (
                            <div className="w-full bg-slate-50 border border-slate-200 text-[11px] px-3 py-2 rounded-xl font-bold text-slate-700">
                              {editForm.sellUnitQty === 0.25 ? '1/4' : editForm.sellUnitQty === 0.5 ? '1/2' : editForm.sellUnitQty === 0.75 ? '3/4' : '1'} {editForm.baseUnit || editForm.inventorySettings?.baseUnit || 'kg'}
                            </div>
                          ) : (
                            <input type="number" step="1" value={editForm.sellUnitQty ?? ''} onChange={e => setEditForm(prev => ({ ...prev, sellUnitQty: e.target.value === '' ? undefined : Number(e.target.value) }))} className="w-full bg-slate-50 border border-slate-200 text-[11px] px-3 py-2 rounded-xl" />
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Price per 1 {editForm.baseUnit || editForm.inventorySettings?.baseUnit || editForm.sellUnit || 'unit'}</label>
                        <input type="number" value={editForm.sellUnitPrice ?? editForm.defaultPricePerBaseUnit ?? editForm.inventorySettings?.defaultPricePerBaseUnit ?? ''} onChange={e => setEditForm(prev => ({ ...prev, sellUnitPrice: e.target.value === '' ? undefined : Number(e.target.value), defaultPricePerBaseUnit: e.target.value === '' ? undefined : Number(e.target.value) }))} className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl font-bold" />
                      </div>

                      {/* Auto-calculation display */}
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 space-y-1 mt-2 text-[10px] font-mono text-emerald-800">
                        <div className="flex justify-between font-bold">
                          <span>{t('totalUnitsFromPurchase')}</span>
                          <span>1 {editForm.purchaseUnit || editForm.inventorySettings?.purchaseUnit || editForm.bulkUnit || 'package'} = {formatProductQuantity(Number(editForm.conversionToBaseUnit || editForm.inventorySettings?.conversionToBaseUnit || editForm.bulkPurchaseQty || 0), { unit: editForm.baseUnit || editForm.inventorySettings?.baseUnit || editForm.sellUnit || editForm.unit } as Product)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Whole package value</span>
                          <span>{currency}{((Number(editForm.conversionToBaseUnit || editForm.inventorySettings?.conversionToBaseUnit || editForm.bulkPurchaseQty || 0)) * (Number(editForm.sellUnitPrice || editForm.defaultPricePerBaseUnit || editForm.inventorySettings?.defaultPricePerBaseUnit || 0))).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cost:</span>
                          <span>{currency}{(editForm.costPrice ?? 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t border-emerald-200 pt-1 mt-1 text-emerald-900">
                          <span>{t('grossProfit')}:</span>
                          <span>{currency}{(((Number(editForm.conversionToBaseUnit || editForm.inventorySettings?.conversionToBaseUnit || editForm.bulkPurchaseQty || 0)) * (Number(editForm.sellUnitPrice || editForm.defaultPricePerBaseUnit || editForm.inventorySettings?.defaultPricePerBaseUnit || 0))) - (editForm.costPrice ?? 0)).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-bold text-emerald-900">
                          <span>{t('breakevenUnits')}:</span>
                          <span>{formatProductQuantity(Math.ceil((editForm.costPrice ?? 0) / (Number(editForm.sellUnitPrice) || 1)), { unit: editForm.sellUnit || editForm.baseUnit || editForm.unit } as Product)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="tenant-form-footer sticky bottom-0 z-10 bg-slate-50 p-3 sm:p-4 flex gap-2 border-t border-slate-200 shrink-0">
              <button 
                type="button" 
                onClick={() => setEditingProduct(null)} 
                className="flex-1 lg:flex-none px-4 sm:px-5 py-3 sm:py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl uppercase tracking-wider text-[10.5px] cursor-pointer"
              >
                Cancel Adjustments
              </button>
              <button 
                type="submit" 
                className="flex-1 lg:flex-none px-4 sm:px-5 py-3 sm:py-2.5 bg-emerald-600 hover:bg-emerald-505 text-white font-bold rounded-xl uppercase tracking-wider text-[10.5px] cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
      {/* REPLENISH BATCH MODAL */}
      {replenishProduct && (
        <div className="tenant-modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in font-sans" style={{paddingBottom: `calc(${'var(--dashboard-bottom-nav-height, 60px)'} + env(safe-area-inset-bottom))`}}>
          <form onSubmit={handleReplenishSubmit} className="tenant-form-screen bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="tenant-form-header px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono">Stock Restock & Prices</h4>
                </div>
                <button type="button" onClick={() => setReplenishProduct(null)} className="text-slate-500 hover:text-slate-700 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-500">Adding new purchases for <span className="font-bold text-slate-800">{replenishProduct.name}</span></p>
            </div>

            <div className="tenant-form-body p-6 space-y-5 overflow-y-auto overflow-x-hidden min-h-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Qty Received</label>
                  <input required type="number" min="0.01" step="0.01" value={replenishQty} onChange={e => setReplenishQty(e.target.value ? Number(e.target.value) : '')} className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-sm px-3 py-2 rounded-xl text-slate-800 font-mono outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Supplier (Optional)</label>
                  <input type="text" value={replenishSupplier} onChange={e => setReplenishSupplier(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-sm px-3 py-2 rounded-xl text-slate-800 outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">New Buy Price</label>
                <div className="relative">
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{currency}</span>
                 <input required type="number" min="0" step="0.01" value={replenishCost} onChange={e => setReplenishCost(e.target.value ? Number(e.target.value) : '')} className="w-full pl-10 pr-3 bg-white border-2 border-emerald-100 focus:border-emerald-500 text-sm px-3 py-2.5 rounded-xl text-emerald-800 font-mono outline-none font-bold placeholder-slate-300" placeholder="0.00" />
                </div>
              </div>

              {/* Price Calculation Engine */}
              {replenishCost !== '' && replenishCost > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center space-x-2 text-indigo-700 font-bold text-xs uppercase tracking-widest font-mono border-b border-indigo-100 pb-2">
                    <Scale className="w-4 h-4" /> <span>Smart Price Suggester</span>
                  </div>

                  {(() => {
                     const newC = Number(replenishCost);
                     const qty = Number(replenishQty || 0);
                     const preview = getReplenishPricingPreview(replenishProduct, qty, newC, replenishCostingMethod);
                     const { priceChange, suggestedPrice } = preview;

                     return (
                       <div className="space-y-4 text-xs">
                         <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100">
                           <span className="text-slate-500">{preview.previousLabel}</span>
                           <span className="font-mono font-bold text-slate-800">{currency}{Math.round(preview.previousBasis).toLocaleString()}</span>
                         </div>
                         <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100">
                           <span className="text-slate-500">{preview.nextLabel}</span>
                           <span className="font-mono font-bold text-slate-800">{currency}{Math.round(preview.nextBasis).toLocaleString()}</span>
                         </div>
                         {preview.previousBasis > 0 && Math.abs(priceChange.percentage) > 0.1 && (
                           <div className={`flex justify-between items-center p-2.5 rounded-lg border ${priceChange.direction === 'increased' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-green-50 border-green-100 text-green-800'}`}>
                             <span className="font-bold">{replenishCostingMethod === 'average_price' ? 'Average Cost' : 'Price'} {priceChange.direction === 'increased' ? 'Increased' : 'Decreased'} By:</span>
                             <span className="font-mono font-black">{Math.abs(priceChange.percentage).toFixed(1)}%</span>
                           </div>
                         )}
                         {replenishCostingMethod === 'average_price' && (
                           <div className="flex justify-between items-center bg-indigo-50 p-2.5 rounded-lg border border-indigo-100 text-indigo-800">
                             <span className="font-bold">Stock Included:</span>
                             <span className="font-mono font-black">{preview.currentQuantity.toLocaleString()} old + {qty.toLocaleString()} new</span>
                           </div>
                         )}

                         <div className="pt-2">
                           <span className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">Choose POS Selling Method</span>
                           <div className="grid grid-cols-3 gap-2">
                             {[
                               ['fifo', 'FIFO', 'Sell oldest stock first at its batch price'],
                               ['average_price', 'Average', 'Use weighted average price suggestion'],
                               ['batch_price', 'Batch Price', 'Sell by selected/current batch price'],
                             ].map(([method, label, helper]) => (
                               <button
                                 key={method}
                                 type="button"
                                 onClick={() => setReplenishCostingMethod(method as typeof replenishCostingMethod)}
                                 className={`px-2 py-2 rounded-xl border text-left transition-all ${replenishCostingMethod === method ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                               >
                                 <span className="block text-[10px] font-black uppercase">{label}</span>
                                 <span className={`block text-[8px] mt-1 leading-tight ${replenishCostingMethod === method ? 'text-slate-300' : 'text-slate-400'}`}>{helper}</span>
                               </button>
                             ))}
                           </div>
                         </div>

                         <div className="pt-2">
                           <span className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">Set New Sell Price</span>
                           <div className="space-y-2">
                             
                             <label className={`flex items-start p-3 border rounded-xl cursor-pointer transition-colors ${replenishPriceAction === 'suggested' ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
                               <input type="radio" name="priceAction" checked={replenishPriceAction === 'suggested'} onChange={() => setReplenishPriceAction('suggested')} className="mt-0.5 accent-emerald-600" />
                               <div className="ml-3 flex-1">
                                 <span className="block font-bold text-slate-800 text-sm">Suggested Price: {currency}{Math.round(suggestedPrice).toLocaleString()}</span>
                                 <span className="block text-slate-500 mt-0.5">{preview.note}</span>
                               </div>
                             </label>

                             <label className={`flex items-start p-3 border rounded-xl cursor-pointer transition-colors ${replenishPriceAction === 'keep' ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                               <input type="radio" name="priceAction" checked={replenishPriceAction === 'keep'} onChange={() => setReplenishPriceAction('keep')} className="mt-0.5 accent-indigo-600" />
                               <div className="ml-3 flex-1">
                                 <span className="block font-bold text-slate-800 text-sm">Keep Current: {currency}{replenishProduct.sellingPrice.toLocaleString()}</span>
                                 <span className="block text-slate-500 mt-0.5">No changes to selling price</span>
                               </div>
                             </label>

                             <label className={`flex items-start p-3 border rounded-xl cursor-pointer transition-colors ${replenishPriceAction === 'custom' ? 'bg-amber-50 border-amber-500' : 'bg-white border-slate-200 hover:border-amber-300'}`}>
                               <input type="radio" name="priceAction" checked={replenishPriceAction === 'custom'} onChange={() => setReplenishPriceAction('custom')} className="mt-0.5 accent-amber-600" />
                               <div className="ml-3 flex-1">
                                 <span className="block font-bold text-slate-800 text-sm mb-1.5">Enter Custom Price</span>
                                 {replenishPriceAction === 'custom' && (
                                   <input type="number" required placeholder="0.00" value={replenishCustomPrice} onChange={e => setReplenishCustomPrice(e.target.value ? Number(e.target.value) : '')} className="w-full bg-white border border-amber-200 focus:border-amber-500 text-sm px-3 py-2 rounded-lg text-amber-900 font-mono outline-none" />
                                 )}
                               </div>
                             </label>

                           </div>
                         </div>
                       </div>
                     );
                  })()}
                </div>
              )}
            </div>

            <div className="tenant-form-footer bg-slate-50 p-4 flex justify-between space-x-2 border-t border-slate-200">
              <span className="text-[10px] text-slate-500 max-w-[240px] leading-tight flex items-center"><Package className="w-3 h-3 mr-1 shrink-0"/> {replenishCostingMethod === 'average_price' ? 'Saves batch and updates POS average price' : replenishCostingMethod === 'batch_price' ? 'Saves batch for batch-price selling' : 'Saves batch for FIFO selling'}</span>
              <div className="flex space-x-2">
                <button type="button" onClick={() => setReplenishProduct(null)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-lg uppercase tracking-wider text-[10px] cursor-pointer">Cancel</button>
                <button type="submit" disabled={!replenishCost || !replenishQty} className="px-5 py-2 bg-emerald-600 disabled:opacity-50 hover:bg-emerald-500 text-white font-bold rounded-lg uppercase tracking-wider text-[10px] cursor-pointer">Add Batch</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ══ NATIVE PRODUCT ACTION MODAL — root level, z-[200], never clipped ══ */}
      <AnimatePresence>
        {mobileProductMenu && (
          <motion.div
            key="product-action-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Actions for ${mobileProductMenu.name}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="xl:hidden fixed inset-0 z-[220] flex flex-col"
            style={{
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
              background: 'rgba(15,23,42,0.45)',
            }}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Escape') setMobileProductMenu(null); }}
          >
            <div className="flex-1" onClick={() => setMobileProductMenu(null)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="bg-white rounded-t-[28px] overflow-hidden flex flex-col"
              style={{ maxHeight: '88dvh' }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-black text-lg overflow-hidden"
                    style={{
                      background: (mobileProductMenu.stockQty ?? 0) <= 0 ? '#f1f5f9' : '#f0fdf4',
                      color: (mobileProductMenu.stockQty ?? 0) <= 0 ? '#94a3b8' : '#16a34a',
                    }}
                  >
                    {mobileProductMenu.image
                      ? <img src={mobileProductMenu.image} alt="" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                      : mobileProductMenu.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-extrabold text-slate-900 leading-tight truncate">{mobileProductMenu.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                      {mobileProductMenu.sku && <span>{mobileProductMenu.sku}</span>}
                      {mobileProductMenu.category && <span className="ml-1 text-slate-300">· {mobileProductMenu.category}</span>}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileProductMenu(null)}
                  aria-label="Close menu"
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 ml-3 active:bg-slate-200"
                >
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5 mx-4 mb-3 rounded-2xl shrink-0" style={{ background: '#f8fafc' }}>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-slate-400">Shop <strong className="text-slate-700 font-black">{formatProductQuantity(mobileProductMenu.shopStockQty ?? 0, mobileProductMenu)}</strong></span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400">Store <strong className="text-slate-700 font-black">{formatProductQuantity(mobileProductMenu.storeStockQty ?? 0, mobileProductMenu)}</strong></span>
                </div>
                <span className="text-[13px] font-black text-emerald-600 font-mono">{currency}{Math.round(mobileProductMenu.sellingPrice).toLocaleString()}</span>
              </div>
              <div className="overflow-y-auto px-4 pb-4 space-y-2">
                <button type="button" aria-label="View product details"
                  onClick={() => {
                    const prod = mobileProductMenu;
                    if (prod) runAfterMobileMenuClose(() => setViewingProduct(prod));
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 bg-white rounded-2xl active:bg-slate-50 text-left border border-slate-100"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0"><Eye className="w-5 h-5 text-blue-600" /></div>
                  <div className="flex-1"><p className="text-[14px] font-bold text-slate-800">View Details</p><p className="text-[11px] text-slate-400 mt-0.5">See full product information</p></div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
                <button type="button" aria-label="Edit product"
                  onClick={() => {
                    const prod = mobileProductMenu;
                    if (prod) runAfterMobileMenuClose(() => handleBeginEdit(prod));
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 bg-white rounded-2xl active:bg-slate-50 text-left border border-slate-100"
                >
                  <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center shrink-0"><Edit className="w-5 h-5 text-teal-600" /></div>
                  <div className="flex-1"><p className="text-[14px] font-bold text-slate-800">Edit Item</p><p className="text-[11px] text-slate-400 mt-0.5">Update name, price, settings</p></div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
                <button type="button" aria-label="Replenish stock"
                  onClick={() => {
                    const prod = mobileProductMenu;
                    if (prod) runAfterMobileMenuClose(() => {
                      setReplenishProduct(prod);
                      setReplenishCost('');
                      setReplenishQty('');
                      setReplenishSupplier('');
                      setReplenishPriceAction('suggested');
                      setReplenishCostingMethod(prod.costingMethod || prod.inventorySettings?.costingMethod || 'fifo');
                    });
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 bg-white rounded-2xl active:bg-slate-50 text-left border border-slate-100"
                >
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0"><Package className="w-5 h-5 text-emerald-600" /></div>
                  <div className="flex-1"><p className="text-[14px] font-bold text-slate-800">Replenish Stock</p><p className="text-[11px] text-slate-400 mt-0.5">Add new stock from supplier</p></div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
                <button type="button" aria-label="Adjust stock"
                  onClick={() => {
                    const prod = mobileProductMenu;
                    if (prod) runAfterMobileMenuClose(() => {
                      setAdjustProduct(prod);
                      setAdjustQty('');
                      setAdjustReason('');
                      setAdjustSearch(prod.name);
                      setAdjustShowSearch(false);
                    });
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 bg-white rounded-2xl active:bg-slate-50 text-left border border-slate-100"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0"><ArrowLeftRight className="w-5 h-5 text-blue-600" /></div>
                  <div className="flex-1"><p className="text-[14px] font-bold text-slate-800">Adjust Stock</p><p className="text-[11px] text-slate-400 mt-0.5">Manually add or deduct quantity</p></div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
                <button type="button" aria-label="Transfer stock"
                  onClick={() => {
                    const prod = mobileProductMenu;
                    if (prod) runAfterMobileMenuClose(() => {
                      setTransferProduct(prod);
                      setTransferQty(1);
                      setTransferDirection('store_to_shop');
                      setTransferError(null);
                      setTransferSuccess(false);
                    });
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 bg-white rounded-2xl active:bg-indigo-50 text-left border border-indigo-100"
                >
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0"><ArrowLeftRight className="w-5 h-5 text-indigo-600" /></div>
                  <div className="flex-1"><p className="text-[14px] font-bold text-slate-800">Transfer Stock</p><p className="text-[11px] text-slate-400 mt-0.5">Move stock between store and shop</p></div>
                  <ChevronRight className="w-4 h-4 text-indigo-300 shrink-0" />
                </button>
                <div className="h-px bg-slate-100 my-1" />
                <button type="button" aria-label="Delete product"
                  onClick={() => { setProductToDelete(mobileProductMenu); setMobileProductMenu(null); }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 bg-white rounded-2xl active:bg-red-50 text-left border border-red-100"
                >
                  <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0"><Trash2 className="w-5 h-5 text-red-500" /></div>
                  <div className="flex-1"><p className="text-[14px] font-bold text-red-600">Delete Item</p><p className="text-[11px] text-slate-400 mt-0.5">Remove from catalogue permanently</p></div>
                  <ChevronRight className="w-4 h-4 text-red-200 shrink-0" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {productToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
          >
            <motion.div
              initial={{ y: 18, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 18, scale: 0.98 }}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-rose-100 bg-rose-50 px-5 py-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-500">Protected destructive action</p>
                  <h3 id="delete-product-title" className="mt-1 text-base font-black text-slate-900">Delete product from catalogue?</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setProductToDelete(null)}
                  aria-label="Close delete confirmation"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-none bg-white text-slate-500 shadow-sm cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-black text-slate-900">{productToDelete.name}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {productToDelete.barcode || productToDelete.sku || 'No barcode'} • Stock {getTotalStockQty(productToDelete.shopStockQty || 0, productToDelete.storeStockQty || 0)}
                  </p>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">
                  This removes the product from the active catalogue. Existing historical sales remain unchanged.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setProductToDelete(null)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-600 cursor-pointer"
                >
                  Keep Product
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteProduct(productToDelete.id);
                    setProductToDelete(null);
                  }}
                  className="rounded-xl border-none bg-rose-600 px-4 py-2.5 text-xs font-black text-white cursor-pointer hover:bg-rose-700"
                >
                  Confirm Delete Product
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STOCK ADJUSTMENT MODAL ─────────────────────────────────────────── */}
      <AnimatePresence>
        {adjustProduct !== null && (() => {
          try {
            const currentStock = (adjustProduct as any)?.shopStockQty ?? (adjustProduct as any)?.stockQty ?? 0;
            const qty = Number(adjustQty) || 0;
            return (
          <motion.div
            key="adjust-modal-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="tenant-modal-overlay fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setAdjustProduct(null); setAdjustQty(''); setAdjustReason(''); setAdjustSearch(''); setAdjustSearchResults([]); setAdjustShowSearch(false); } }}
          >
            <motion.div
              key="adjust-modal"
              initial={{ y: 60, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="tenant-form-screen w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="tenant-form-header flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                    <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-black text-slate-900">Adjust Stock</h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">Manually add or deduct inventory</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setAdjustProduct(null); setAdjustQty(''); setAdjustReason(''); setAdjustSearch(''); setAdjustSearchResults([]); setAdjustShowSearch(false); }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer border-none transition-colors"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <div className="tenant-form-body px-5 py-4 space-y-4 min-h-0 overflow-y-auto overflow-x-hidden">
                {/* Product selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Product</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={adjustShowSearch ? adjustSearch : ((adjustProduct as any)?.name || '')}
                      onFocus={() => { setAdjustShowSearch(true); setAdjustSearch((adjustProduct as any)?.name || ''); adjustSearchProducts((adjustProduct as any)?.name || ''); }}
                      onChange={(e) => adjustSearchProducts(e.target.value)}
                      placeholder="Search by name or barcode…"
                      className="w-full pl-9 pr-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-400 outline-none text-sm font-semibold text-slate-800 bg-slate-50 focus:bg-white transition-colors"
                    />
                    {adjustShowSearch && adjustSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg z-10 overflow-hidden max-h-48 overflow-y-auto">
                        {adjustSearchResults.map(p => (
                          <button
                            key={p.id} type="button"
                            onClick={() => { setAdjustProduct(p); setAdjustSearch(p.name); setAdjustShowSearch(false); setAdjustSearchResults([]); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left cursor-pointer border-none bg-transparent transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate">{p.name}</p>
                              <p className="text-[10px] text-slate-400">{p.barcode || p.sku || 'No barcode'} · Stock: {(p as any).shopStockQty ?? (p as any).stockQty ?? 0}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Current stock display */}
                <div className="bg-slate-50 rounded-2xl px-4 py-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Current Stock</span>
                  <span className="text-[15px] font-black text-slate-900">
                    {currentStock}
                    <span className="text-[11px] font-medium text-slate-400 ml-1">{(adjustProduct as any)?.unit || 'units'}</span>
                  </span>
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Quantity to Add / Deduct</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Enter quantity…"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-400 outline-none text-sm font-semibold text-slate-800 bg-slate-50 focus:bg-white transition-colors"
                  />
                </div>

                {/* Reason */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Reason <span className="font-normal text-slate-400">(optional)</span></label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="e.g. Damaged goods, counting correction…"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-400 outline-none text-sm text-slate-700 bg-slate-50 focus:bg-white transition-colors"
                  />
                </div>

                {/* Preview */}
                {qty > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50 rounded-2xl px-3 py-2.5 text-center border border-emerald-100">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">After Add</p>
                      <p className="text-[17px] font-black text-emerald-700 mt-0.5">{currentStock + qty}</p>
                    </div>
                    <div className="bg-rose-50 rounded-2xl px-3 py-2.5 text-center border border-rose-100">
                      <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">After Deduct</p>
                      <p className="text-[17px] font-black text-rose-600 mt-0.5">{Math.max(0, currentStock - qty)}</p>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="tenant-form-footer grid grid-cols-2 gap-3 pt-1 pb-2">
                  <button
                    type="button"
                    disabled={qty <= 0}
                    onClick={() => handleAdjustStock('add')}
                    className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 text-white font-black text-sm transition-colors cursor-pointer border-none"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                  <button
                    type="button"
                    disabled={qty <= 0}
                    onClick={() => handleAdjustStock('deduct')}
                    className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-400 active:bg-rose-600 disabled:opacity-40 text-white font-black text-sm transition-colors cursor-pointer border-none"
                  >
                    <X className="w-4 h-4" /> Deduct
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        );
          } catch (err) {
            console.error('[AdjustStock modal render error]', err);
            return null;
          }
        })()}
      </AnimatePresence>

    </div>
  );

}
