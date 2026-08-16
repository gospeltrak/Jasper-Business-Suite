export interface User {
  id: string;
  email: string;
  name: string;
  role: 'Admin' | 'Cashier' | 'Manager' | 'SuperAdmin' | 'Affiliate' | 'Partner';
  tenantId: string;
  activeTenant: string;
  profileImage?: string;
  isDuress?: boolean;
  isSaaSStaff?: boolean;
  saasPermissions?: Record<string, boolean>;
  rolePermissions?: CustomRole['permissions'];
  phone?: string;
  password?: string;
  securityQuestion?: string;
  securityAnswer?: string;
  // Subscription trial assignment tracking
  trial_start_date?: string;
  trial_end_date?: string;
  is_affiliate_lead?: boolean;
  referral_code_used?: string;
  // Partner / Affiliate portal role
  portal_role?: 'affiliate' | 'partner';
}

export interface Tenant {
  id: string;
  name: string;
  country: 'Nigeria' | 'Kenya' | 'Ghana' | 'South Africa' | 'Tanzania';
  city: string;
  currency: '₦' | 'KSh' | 'GH₵' | 'R' | 'TSh';
  currencyCode: 'NGN' | 'KES' | 'GHS' | 'ZAR' | 'TZS';
  taxRate: number; // e.g. 0.075 for Nigeria, 0.16 for Kenya
  mobileMoneyProviders: string[];
  businessType?: 'retail' | 'pharmacy' | 'restaurant' | 'hotel';
  selectedPackageId?: 'ruby' | 'diamond' | 'tanzanite';
  activePackageId?: 'ruby' | 'diamond' | 'tanzanite';
  subscriptionStatus?: 'trial' | 'pending' | 'active' | 'expired' | 'suspended';
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  businessName?: string;
  businessNameSlug?: string | null;
  subdomainSlug?: string | null;
  customDomain?: string | null;
  primaryDomain?: string | null;
  domainStatus?: 'pending' | 'active' | 'inactive' | 'failed' | 'verified' | string;
  isDomainActive?: boolean;
  company_settings?: {
    logo_url: string | null;
  };
}

export interface Branch {
  id: string;
  tenantId: string;
  branchName: string;
  branchCode: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  managerId?: string;
  status: 'active' | 'inactive';
  isDefault: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  // Branch-level branding — used on all customer-facing documents for this branch
  businessLogo?: string;        // generic branch logo (used as fallback)
  businessLogoLight?: string;   // light mode / document logo
  businessLogoDark?: string;    // dark mode logo
  businessName?: string;        // override branch display name on documents
}

export interface BranchStock {
  id: string;
  tenantId: string;
  branchId: string;
  productId: string;
  quantity: number;
  shopStockQty: number;
  storeStockQty: number;
  buyingPrice?: number;
  sellingPrice?: number;
  lowStockAlert?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BranchStaffAssignment {
  id: string;
  tenantId: string;
  branchId: string;
  staffId: string;
  role?: string;
  permissions?: Record<string, unknown>;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export type InventoryCostingMethod = 'fifo' | 'average_price' | 'batch_price';
export type LegacySellingMethod = 'fifo' | 'average_cost' | 'manual_batch';

export interface FractionSaleOption {
  id: string;
  label: string;
  quantityInBaseUnit: number;
  price?: number;
  isDefault?: boolean;
}

export interface PharmacyUnitBreakdown {
  purchaseUnit: string;
  stripUnit: string;
  baseUnit: string;
  stripsPerBox: number;
  tabletsPerStrip: number;
}

export type PharmacyProductType = 'pharmaceutical' | 'non_pharmaceutical';
export type PharmacyHierarchyStart = 'box' | 'packet' | 'master_box' | 'carton';

export interface PharmacyHierarchyLevel {
  id: string;
  label: string;
  unit: string;
  quantityToBaseUnit: number;
}

export interface ProductInventorySettings {
  costingMethod: InventoryCostingMethod;
  allowPosMethodOverride: boolean;
  allowScaleSelling: boolean;
  purchaseUnit: string;
  baseUnit: string;
  conversionToBaseUnit: number;
  packageUnitPrice?: number;
  wholePackagePrice?: number;
  halfPackagePrice?: number;
  packageBuyingCost?: number;
  allowCustomQuantity: boolean;
  defaultPricePerBaseUnit?: number;
  fractionSaleOptions?: FractionSaleOption[];
  pharmacyUnitBreakdown?: PharmacyUnitBreakdown;
}

export interface PriceChangeInfo {
  previousBuyingPrice: number;
  newBuyingPrice: number;
  percentage: number;
  direction: 'increased' | 'decreased' | 'unchanged';
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  unit?: string;
  costPrice: number;
  sellingPrice: number;
  stockQty: number; // total stock (shop + store)
  shopStockQty: number; // stock currently on shop floor
  storeStockQty: number; // stock currently in store backroom
  alertQty: number;
  image?: string;
  imageBase64?: string;
  brand?: string;
  syncUpdatedAt?: string;
  updatedAt?: string;
  // Pharmacy dosage configs
  tabsPerPack?: number;
  allowsDosageDividing?: boolean;
  pharmacyProductType?: PharmacyProductType;
  pharmacyHierarchyStart?: PharmacyHierarchyStart;
  pharmacyBaseUnit?: string;
  pharmacyUnitLevels?: PharmacyHierarchyLevel[];
  dosesPerPacket?: number;
  tabsPerDose?: number;
  packetPrice?: number;
  fullDosePrice?: number;
  halfDosePrice?: number;
  tabPrice?: number;
  // Retail & Wholesale properties
  sellInRetail?: boolean;
  sellInWholesale?: boolean;
  wholesalePrice?: number;
  minWholesaleQty?: number;
  
  // Bulk-to-Unit Selling feature fields
  isBulkProduct?: boolean;
  bulkUnit?: string;
  bulkPurchaseQty?: number;
  sellUnit?: string;
  sellUnitQty?: number;
  sellUnitPrice?: number;
  bulkToUnitsRatio?: number;
  sellingMode?: 'standard' | 'scale' | 'pcs' | 'hybrid';
  /** 'open-ended': total quantity unknown upfront (e.g. a cable roll) — priced
   * per unit only, depleted manually via "Mark as Finished" instead of a count. */
  stockTrackingMode?: 'quantity' | 'open-ended';
  markedFinished?: boolean;

  // Batch feature fields
  sellingMethod?: LegacySellingMethod;
  inventorySettings?: ProductInventorySettings;
  costingMethod?: InventoryCostingMethod;
  allowPosMethodOverride?: boolean;
  allowScaleSelling?: boolean;
  purchaseUnit?: string;
  baseUnit?: string;
  conversionToBaseUnit?: number;
  packageUnitPrice?: number;
  wholePackagePrice?: number;
  halfPackagePrice?: number;
  packageBuyingCost?: number;
  fractionSaleOptions?: FractionSaleOption[];
  allowCustomQuantity?: boolean;
  defaultPricePerBaseUnit?: number;
  pharmacyUnitBreakdown?: PharmacyUnitBreakdown;
  latestBuyingPrice?: number;
  averageBuyingCost?: number;
  batches?: ProductBatch[];
  branchId?: string;
}

export interface ProductBatch {
  id: string;
  productId: string;
  batchNumber: string;
  supplierName?: string;
  purchaseDate: string;
  quantityPurchased: number;
  quantityRemaining: number;
  buyingPrice: number;
  previousBuyingPrice?: number;
  priceChangePercentage?: number;
  suggestedSellingPrice?: number;
  finalSellingPrice?: number;
  baseUnit?: string;
  quantityPurchasedBase?: number;
  quantityRemainingBase?: number;
  costingMethodAtCreation?: InventoryCostingMethod;
  status: 'active' | 'finished';
  createdBy: string;
  createdAt: string;
}

export interface SaleBatchInfo {
  batchId: string;
  batchNumber: string;
  qty: number;
  buyingPrice: number; // For profit calculation
  baseQty?: number;
  sellingPrice?: number;
}

export interface SaleBatchItem {
  saleId: string;
  productId: string;
  batchId: string;
  quantitySold: number;
  baseQuantityDeducted: number;
  buyingCost: number;
  sellingPrice: number;
  costingMethodUsed: InventoryCostingMethod;
  profit: number;
  remainingStock: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  qty: number;
  quantity?: number;
  price: number;
  discount: number; // percentage
  subtotal?: number;
  discountType?: 'percent' | 'cash';
  
  batchesUsed?: SaleBatchInfo[]; // Which batches were drawn from for this sale
  costPriceAtSale?: number; // Calculated blended cost or average cost at the time of sale
  baseQuantityDeducted?: number;
  costingMethodUsed?: InventoryCostingMethod;
  batchBreakdown?: SaleBatchItem[];
  
  // For Bulk-to-unit selling
  isBulkProduct?: boolean;
  // Immutable unit snapshot from the completed sale. Reports must prefer this
  // over the current product unit, which may change later.
  unit?: string;
  baseUnit?: string;
  conversionToBaseUnit?: number;
  sellUnit?: string;
  sellMode?: 'scale' | 'pcs';
  
  // Pharmacy dosage options
  dosageType?: 'packet' | 'full' | 'half' | 'tabs' | 'strip' | 'dose' | 'unit';
  tabsSelected?: number;
  tabsPerPack?: number;
  channel?: 'retail' | 'wholesale';
  // Internal Tanzanite document routing. Customer-facing PDFs must never render
  // these source fields.
  sourceBranchId?: string;
  sourceBranchName?: string;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;           // grandTotal including delivery (kept for backward compat)
  productTotal?: number;   // total excluding delivery — use this for revenue/profit reports
  tax: number;
  deliveryCost?: number;
  deliveryPaymentMethod?: string;
  discount?: number;
  discountType?: 'percent' | 'cash';
  paymentMethod: 'Cash' | 'Card' | 'M-Pesa' | 'MTN MoMo' | 'Paystack' | 'Airtel Money' | 'Credit' | 'Bank' | 'Mobile Money' | 'Multi-Channel';
  customerName?: string; // name of the client
  customerPhone?: string; // phone of the client
  staffName?: string; // cashier or recording staff
  reference: string;
  receiptNo?: string;
  tenantId: string;
  timestamp: string; // ISO String
  date?: string;
  syncUpdatedAt?: string;
  syncStatus: 'synced' | 'pending';
  cashierName: string;
  amountPaid?: number;
  amountDue?: number;
  change?: number;
  paymentStatus?: 'paid' | 'partial' | 'unpaid';
  transactionReference?: string;
  paymentNote?: string;
  isManualPayment?: boolean;
  gatewayProvider?: string | null;
  gatewayTransactionId?: string | null;
  vatStatus?: 'vat' | 'non-vat';
  vfdControlNo?: string;
  vfdSignature?: string;
  multiCashAmount?: number;
  multiBankAmount?: number;
  paymentBreakdown?: Array<{ method: string; amount: number; reference?: string }>;
  channel?: 'retail' | 'wholesale';
  approvals?: any[];
  actualTimestamp?: string; // actual entry date/time for security
  branchId?: string;
  treasuryJournalId?: string;
}

export interface Expense {
  id: string;
  category: string; // wages, rent, fuel, electricity, packaging, transport, other
  amount: number;
  timestamp: string; // ISO String
  description: string;
  staffName: string; // staff who recorded/requested it
  receiptRef?: string; // simulated receipt file name / id
  tenantId: string; // tenant branch ID
  receiptImage?: string; // base64 or object URL of attached receipt image
  transactionMessage?: string;
  note?: string;
  paymentMethod?: string;
  paidFromAccountId?: string;
  branchId?: string;
  staffId?: string;
  payrollPaymentType?: 'salary' | 'wages' | 'allowance' | 'bonus' | 'overtime' | 'advance_recovery' | 'other';
  payrollPeriodStart?: string;
  payrollPeriodEnd?: string;
  payrollReference?: string;
  payrollAttachmentName?: string;
  treasuryJournalId?: string;
}

export interface SyncLog {
  id: string;
  type: 'sale' | 'product_update' | 'inventory_audit' | 'auth_sync' | 'system_action';
  status: 'success' | 'warning' | 'pending' | 'failed' | 'error';
  message: string;
  timestamp: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  categories: string[];
  tenantId?: string;
  branchId?: string;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  qty: number;
  costPrice: number;
}

export interface Purchase {
  id: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  paymentMethod?: string;
  paidFromAccountId?: string;
  destination: 'shop' | 'store';
  deliveryStatus: 'Pending' | 'Partial' | 'Full order delivered';
  timestamp: string; // ISO String
  tenantId: string;
  discount?: number;
  discountType?: 'percentage' | 'cash';
  deliveryFee?: number;
  branchId?: string;
  treasuryJournalId?: string;
}

export interface DeliveryRider {
  id: string;
  name: string;
  phone: string;
  vehicleType: 'motorcycle' | 'tuktuk' | 'car';
  classification: 'rider' | 'driver';
  vehicleColor: string;
  licensePlate: string;
  tenantId: string;
  branchId?: string;
  signatureImage?: string;
}

export interface Delivery {
  id: string;
  saleId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  items: SaleItem[];
  totalAmount: number;
  deliveryCost: number;
  status: 'Pending Dispatch' | 'Dispatched' | 'Delivered' | 'Cancelled';
  riderId?: string; // empty if ad-hoc
  riderDetails?: {
    name: string;
    phone: string;
    vehicleType: 'motorcycle' | 'tuktuk' | 'car';
    classification: 'rider' | 'driver';
    vehicleColor: string;
    licensePlate: string;
  };
  timestamp: string; // ISO timestamp
  dispatchedAt?: string;
  deliveredAt?: string;
  notes?: string;
  tenantId: string;
  deliveryPaymentMethod?: string;
  deliveryPaymentAccountId?: string;
  deliveryPaymentStatus?: 'pending' | 'collected' | 'cancelled';
  paymentCollectedAt?: string;
  branchId?: string;
  treasuryJournalId?: string;
}

export interface CompanySettings {
  companyName: string;
  usernameKey: string; // generated based on company name
  phone: string;
  email: string;
  address: string;
  tin: string;
  vat: string;
  currency: string;
  timezone: string;
  logo: string; // base64 or placeholder URL
  themeMode: 'light' | 'dark';
}

export interface BranchBranding {
  businessLogo?: string;
  businessLogoLight?: string;
  businessLogoDark?: string;
  businessName?: string;
}

export interface PaymentModeConfig {
  name: string;
  logoUrl?: string; // transparent PNG or white-bg image uploaded by user
  type?: 'cash' | 'mobile_money' | 'bank' | 'card' | 'credit'; // payment category
}

export interface BusinessSettings {
  businessName: string;
  businessPhone: string;
  businessAddress: string;
  businessLogo: string; // base64 or placeholder URL
  businessLogoLight?: string; // Day mode branding logo
  businessLogoDark?: string;  // Dark mode branding logo
  paymentModes: Array<string | PaymentModeConfig>;
  deliveryPaymentModes?: string[];
  registeredStores: string[];
  tagline?: string;
  businessEmail?: string;
  businessNameSlug?: string;
  subdomainSlug?: string;
  primaryDomain?: string;
  domainStatus?: string;
  isDomainActive?: boolean;
  branchBranding?: Record<string, BranchBranding>; // keyed by store name
}

export interface ProductStoreSettings {
  categories: string[];
  units: string[]; // pcs, kg, litres, box, bottle, etc.
  brands?: { name: string; logo?: string }[];
}

export interface StaffSettings {
  id: string;
  branchId?: string;
  name: string;
  email?: string;
  phone: string;
  /** @deprecated Legacy migration only. Never persist new plaintext credentials. */
  password?: string;
  role: string;
  salary: number;
  salaryType?: 'monthly' | 'weekly' | 'daily' | 'commission' | 'custom';
  salaryStartDate?: string;
  salaryNotes?: string;
  staffType?: 'permanent' | 'temporary' | 'driver' | 'rider' | 'temporary-driver' | 'temporary-rider' | 'other';
  department?: string;
  status?: 'active' | 'inactive';
  dateJoined?: string;
  notes?: string;
  passwordUpdatedAt?: string;
  temporaryPasswordIssuedAt?: string;
  allowances?: StaffAllowance[];
  profileImage?: string;
  signatureImage?: string;
  isOwner?: boolean; // true for the system owner/admin — cannot be deleted
  classification?: 'rider' | 'driver';
  vehicleType?: 'motorcycle' | 'tuktuk' | 'car';
  vehicleColor?: string;
  licensePlate?: string;
}

export interface StaffAllowance {
  id: string;
  name: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'one-time' | 'custom';
  startDate: string;
  endDate?: string;
  notes?: string;
}

export interface RolePermission {
  read: boolean;
  write: boolean;
  edit: boolean;
}

export interface CustomRole {
  id: string;
  name: string;
  permissions: {
    pos: RolePermission;
    products: RolePermission;
    purchases: RolePermission;
    suppliers: RolePermission;
    expenses: RolePermission;
    reportsSalesExpenses: RolePermission;
    reportsProfitCogs: RolePermission;
    sync: RolePermission;
    settings: RolePermission;

    // Advanced modular permission controls based on the user request
    salesList?: RolePermission;
    salesReturn?: RolePermission;
    deleteSale?: RolePermission;
    orderPayments?: RolePermission;
    paymentIn?: RolePermission;
    paymentOut?: RolePermission;
    quotation?: RolePermission;
    stockAdjustment?: RolePermission;
    stockTransfer?: RolePermission;
    companySettings?: RolePermission;
    storageSettings?: RolePermission;
    emailSettings?: RolePermission;
    updateApp?: RolePermission;
    cashAndBank?: RolePermission;
    storesBranch?: RolePermission;
    translations?: RolePermission;
    rolePermissions?: RolePermission;
    taxes?: RolePermission;
    currencies?: RolePermission;
    paymentModes?: RolePermission;
    units?: RolePermission;
    customFields?: RolePermission;
    staffMembers?: RolePermission;
    customersList?: RolePermission;
    suppliersList?: RolePermission;
    saleItemsStats?: RolePermission;
    totalAmountStats?: RolePermission;
    totalExpensesStats?: RolePermission;
    totalPurchasesStats?: RolePermission;
    totalProfitStats?: RolePermission;
    salesDueStats?: RolePermission;
    brands?: RolePermission;
    productCategories?: RolePermission;
    productVariations?: RolePermission;
    productsList?: RolePermission;
    expenseCategories?: RolePermission;
    expensesList?: RolePermission;
    purchaseReturn?: RolePermission;
  };
}

export interface InvoiceSettings {
  invoiceColor?: string; // Hex color code
  tin?: string;
  tinNumber?: string;
  vatNumber?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  authorisedPerson?: string;
  signatureImage?: string; // authorized person signature image
  termsAndConditions?: string[];
  footerNote?: string;
  hasVatByDefault?: boolean;
}

export interface SystemSettings {
  company: CompanySettings;
  business: BusinessSettings;
  productStore: ProductStoreSettings;
  staffs: StaffSettings[];
  settingsSync?: Record<string, string>;
  customRoles?: CustomRole[];
  invoiceSettings?: InvoiceSettings;
  posSettings?: {
    showProductImages: boolean;
  };
  paymentChannels?: PaymentChannel[]; // persisted bank/mobile/cash accounts
  expenseCategories?: string[];
  notificationModuleSettings?: JasperModuleNotificationSettings[];
}

export interface SalesDocument {
  id: string;
  type: 'quotation' | 'proforma invoice' | 'price quote' | 'price quote invoice';
  documentNumber: string;
  items: SaleItem[];
  total: number;
  tax: number;
  discountAmount?: number;
  discountValue?: number;
  discountType?: 'percent' | 'cash';
  deliveryCost?: number;
  paymentMethod?: string;
  paymentAccountNumber?: string;
  paymentAccountName?: string;
  paymentAmount?: number;
  hasVat?: boolean;
  taxRate?: number;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  notes?: string;
  timestamp: string; // Issue Date
  tenantId: string;
  status: 'pending' | 'approved' | 'converted' | 'cancelled';
  validUntil?: string;
  convertedSaleId?: string;
  convertedBranchSaleIds?: string[];
  convertedAt?: string;
  tagline?: string;
  issuingBranchId?: string;
  issuingBranchName?: string;
  serverDocumentId?: string;
  brandingSnapshot?: Record<string, any>;
}

export interface PaymentChannel {
  id: string;
  name: string;
  category: 'telco' | 'bank' | 'physical' | 'person';
  provider?: string;
  accountNumber?: string;
  maskedReference?: string;
  paymentMethod?: string;
  currency?: string;
  branchId?: string;
  status?: 'active' | 'inactive' | 'archived';
  isDefault?: boolean;
}

export interface JasperNotificationSettings {
  id: string;
  tenantId: string;
  ownerPhone: string;
  ownerWhatsapp?: string;
  ownerEmail?: string;
  timezone: string;
  enabledModules: string[]; // 'all', 'wholesale', 'pharmacy'
  enableSaleNotifications: boolean;
  enableMorningSummary: boolean;
  enableEndDayProfitLoss: boolean;
  enableEndDayExpenses: boolean;
  enableWeeklySummary: boolean;
  enableMonthlySummary: boolean;
  morningSummaryTime: string; // '07:00'
  endDayReportTime: string; // '21:00'
  weeklySummaryDay: string; // 'Monday'
  monthlySummaryDay: string; // '1'
  enableInApp: boolean;
  enableEmail: boolean;
  enableSms: boolean;
  enableWhatsapp: boolean;
  enablePush: boolean;
}

export interface JasperModuleNotificationSettings {
  id: string;
  tenantId: string;
  moduleName: string;
  receiverName: string;
  receiverRole?: string;
  whatsappNumber: string;
  backupWhatsappNumber?: string;
  emailAddress?: string;
  smsPhoneNumber?: string;
  timezone: string;
  enableInApp: boolean;
  enableWhatsapp: boolean;
  enableEmail: boolean;
  enableSms: boolean;
  enablePush: boolean;
  enableSaleNotifications: boolean;
  enableMorningSummary: boolean;
  enableEndDayProfitLoss: boolean;
  enableEndDayExpenses: boolean;
  enableWeeklySummary: boolean;
  enableMonthlySummary: boolean;
  enableLowStockAlerts: boolean;
  enablePriceAlerts: boolean;
  enableCashAlerts: boolean;
  enableLossWarnings: boolean;
  morningSummaryTime: string;
  endDayReportTime: string;
  weeklySummaryDay: string;
  monthlySummaryDay: string;
  createdAt: string;
  updatedAt: string;
}
export interface JasperNotification {
  id: string;
  tenantId: string;
  moduleName: string;
  title: string;
  message: string;
  notificationType: 'sale' | 'report' | 'daily_summary' | 'weekly_summary' | 'monthly_summary' | 'profit_loss_report' | 'expense_report' | 'low_stock' | 'price_alert' | 'cash_alert' | 'stock_alert' | 'system_alert';
  reportPeriodStart?: string;
  reportPeriodEnd?: string;
  deliveryChannel: string;
  status: 'pending' | 'sent' | 'failed' | 'pending_configuration';
  isRead: boolean;
  relatedReportId?: string;
  createdAt: string;
  sentAt?: string;
}

export interface JasperScheduledReport {
  id: string;
  tenantId: string;
  reportType: 'daily_summary' | 'profit_loss' | 'expenses' | 'weekly_summary' | 'monthly_summary';
  moduleScope: string;
  periodStart: string;
  periodEnd: string;
  summaryDataJson: string;
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
  sentAt?: string;
}

export interface LedgerEntry {
  id: string;
  tenantId: string;
  channelId: string;
  amount: number;
  entryType: 'debit' | 'credit';
  sourceType: 'POS_CHECKOUT' | 'DELIVERY_COLLECTION' | 'PURCHASE_PAYMENT' | 'SETTLE_TILL_DEPOSIT' | 'EXPENSE_WITHDRAWAL' | 'INITIAL_BALANCE';
  description: string;
  timestamp: string;
  referenceId?: string;
  counterPartyChannelId?: string;
  receiptFile?: string;
  muamalaFile?: string;
}
