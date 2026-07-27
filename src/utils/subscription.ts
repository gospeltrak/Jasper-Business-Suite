export type SubscriptionPackageId = 'ruby' | 'diamond' | 'tanzanite';
export type LegacySubscriptionPlanId = 'essential' | 'business' | 'wholesale';
export type SubscriptionPlanId = 'trial' | SubscriptionPackageId | LegacySubscriptionPlanId;

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  packageId?: SubscriptionPackageId;
  price: number;
  durationDays: number;
  maxProducts: number;
  maxStores: number;
  maxStaff: number;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, SubscriptionPlan> = {
  trial: {
    id: 'trial',
    name: 'Diamond Free Trial',
    price: 0,
    durationDays: 10,
    maxProducts: 5000,
    maxStores: 1,
    maxStaff: 5,
    features: [
      'Diamond experience during trial',
      'Max 5000 Products catalogued',
      'Single business workspace during the Diamond trial',
      'Max 5 Users / staff accounts',
      'Custom Role Security permissions',
      'Supplies & supplier log ledger',
      'Cashier POS Till checkout',
      'Consolidated P&L index generators',
      'Tanzanite branch tools require an active Tanzanite subscription',
      'Lucy AI Diamond access while trial is active'
    ]
  },
  ruby: {
    id: 'ruby',
    packageId: 'ruby',
    name: 'Ruby',
    price: 15000,
    durationDays: 30,
    maxProducts: 1000,
    maxStores: 1,
    maxStaff: 2,
    features: [
      'Max 1000 Products catalogued',
      'Max 1 Active Store branch',
      'Max 2 Users / staff accounts',
      'Supplies management & alerts',
      'Cashier Till (POS Simulator)',
      'Profit & Loss summary reports',
      'Customer management system',
      'Scale selling for kg, grams, litres, and ml'
    ]
  },
  diamond: {
    id: 'diamond',
    packageId: 'diamond',
    name: 'Diamond',
    price: 30000,
    durationDays: 30,
    maxProducts: 5000,
    maxStores: 1,
    maxStaff: 5,
    features: [
      'Max 5000 Products catalogued',
      'Max 1 Active Store branch',
      'Max 5 Users / staff accounts',
      'Custom Role Security permissions',
      'Supplies & supplier log ledger',
      'Cashier POS Till checkout',
      'Consolidated P&L index generators',
      'Delivery, staff, and advanced financial controls'
    ]
  },
  tanzanite: {
    id: 'tanzanite',
    packageId: 'tanzanite',
    name: 'Tanzanite',
    price: 50000,
    durationDays: 30,
    maxProducts: 999999, // Unlimited
    maxStores: 2,
    maxStaff: 15,
    features: [
      'Unlimited Products catalogued',
      '2 total branches included; Super Admin can grant more per tenant',
      'Max 15 Users / staff accounts',
      'Supplies management tracking',
      'Cashier Till (POS Simulator)',
      'Full suite Business Reports',
      'Customer management engine',
      'Custom branding — logo, colors & profile identity',
      'Staff payroll, salary & allowance tracking'
    ]
  },
  essential: {
    id: 'essential',
    packageId: 'ruby',
    name: 'Ruby',
    price: 15000,
    durationDays: 30,
    maxProducts: 1000,
    maxStores: 1,
    maxStaff: 2,
    features: [
      'Max 1000 Products catalogued',
      'Max 1 Active Store branch',
      'Max 2 Users / staff accounts',
      'Supplies management & alerts',
      'Cashier Till (POS Simulator)',
      'Profit & Loss summary reports',
      'Customer management system',
      'Scale selling for kg, grams, litres, and ml'
    ]
  },
  business: {
    id: 'business',
    packageId: 'diamond',
    name: 'Diamond',
    price: 30000,
    durationDays: 30,
    maxProducts: 5000,
    maxStores: 1,
    maxStaff: 5,
    features: [
      'Max 5000 Products catalogued',
      'Max 1 Active Store branch',
      'Max 5 Users / staff accounts',
      'Custom Role Security permissions',
      'Supplies & supplier log ledger',
      'Cashier POS Till checkout',
      'Consolidated P&L index generators',
      'Delivery, staff, and advanced financial controls'
    ]
  },
  wholesale: {
    id: 'wholesale',
    packageId: 'tanzanite',
    name: 'Tanzanite',
    price: 50000,
    durationDays: 30,
    maxProducts: 999999,
    maxStores: 2,
    maxStaff: 15,
    features: [
      'Unlimited Products catalogued',
      '2 total branches included; Super Admin can grant more per tenant',
      'Max 15 Users / staff accounts',
      'Supplies management tracking',
      'Cashier Till (POS Simulator)',
      'Full suite Business Reports',
      'Customer management engine',
      'Full white-label custom domain portals',
      'Affiliate progression tracker integration'
    ]
  }
};

export const PAID_PACKAGE_IDS: SubscriptionPackageId[] = ['ruby', 'diamond', 'tanzanite'];

export function normalizeSubscriptionPlanId(planId?: string | null): SubscriptionPlanId {
  const normalized = String(planId || '').trim().toLowerCase();
  if (normalized === 'ruby' || normalized === 'essential' || normalized === 'basic') return 'ruby';
  if (normalized === 'diamond' || normalized === 'business' || normalized === 'standard business' || normalized === 'standard') return 'diamond';
  if (normalized === 'tanzanite' || normalized === 'jasper' || normalized === 'premium' || normalized === 'wholesale') return 'tanzanite';
  if (normalized === 'trial' || normalized === 'sandbox') return 'trial';
  return 'diamond';
}

const DIAMOND_AND_TANZANITE_TABS = new Set([
  'deliveries',
  'cash-bank-matrix',
  'staff-members',
]);

const TANZANITE_ONLY_TABS = new Set([
  'branches',
  'forecasting',
  'whitelabel',
]);

/**
 * Central package gate for every tenant navigation surface.
 * Trial intentionally previews all product areas; permissions still apply.
 */
export function isTenantPackageTabAllowed(planId: string | null | undefined, tabId: string): boolean {
  const normalizedPlanId = normalizeSubscriptionPlanId(planId);
  if (normalizedPlanId === 'trial') return true;
  if (TANZANITE_ONLY_TABS.has(tabId)) return normalizedPlanId === 'tanzanite';
  if (DIAMOND_AND_TANZANITE_TABS.has(tabId)) return normalizedPlanId !== 'ruby';
  return true;
}

export function getSubscriptionPlan(planId?: string | null): SubscriptionPlan {
  return SUBSCRIPTION_PLANS[normalizeSubscriptionPlanId(planId)];
}

export interface SubscriptionState {
  planId: SubscriptionPlanId;
  trialStartedAt: string; // ISO string
  isSubscribedPaid: boolean;
  paidAt?: string;
  simulatedDaysPassed?: number; // state for interactive time simulation
  promoCodeUsed?: string; // promo code registered with
  autoRenewEnabled?: boolean; // subscription auto renewal flag
  paymentStatus?: 'pending' | 'active' | 'expired';
}

// ─── Load plan from Supabase DB (called on login) ──────────────────────────

export async function loadSubscriptionFromDB(tenantId: string): Promise<SubscriptionState | null> {
  if (!tenantId) return null;
  try {
    const { getSecureDataBridgeClient } = await import('../secureDataBridge');
    const client: any = await getSecureDataBridgeClient();
    const url: string = (client as any).supabaseUrl || '';
    if (!url || url.includes('placeholder')) return null;

    const { data, error } = await client
      .from('tenants')
      .select('subscription_plan, subscription_status, subscription_start_date, subscription_end_date, subscription_activated_at, active_package_id, selected_package_id')
      .eq('id', tenantId)
      .maybeSingle();

    if (error || !data) return null;

    const rawPlan = data.active_package_id || data.selected_package_id || data.subscription_plan || data.subscription_status || 'trial';
    const normalizedPlanId = normalizeSubscriptionPlanId(rawPlan);
    const startedAt = data.subscription_start_date || data.subscription_activated_at || new Date().toISOString();
    const startMs = new Date(startedAt).getTime();
    const endMs = data.subscription_end_date ? new Date(data.subscription_end_date).getTime() : 0;
    const dbTrialDays = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
      ? Math.round((endMs - startMs) / (1000 * 60 * 60 * 24))
      : 10;
    const state: SubscriptionState = {
      planId: normalizedPlanId,
      trialStartedAt: startedAt,
      isSubscribedPaid: normalizedPlanId !== 'trial',
      paidAt: data.subscription_activated_at || undefined,
      promoCodeUsed: normalizedPlanId === 'trial' && dbTrialDays >= 15 ? 'PROMO' : undefined,
      paymentStatus: data.subscription_status === 'expired' ? 'expired' : 'active',
      autoRenewEnabled: true,
    };
    saveSubscriptionState(state);
    return state;
  } catch (e) {
    return null;
  }
}



export function getSubscriptionState(): SubscriptionState {
  const cached = onlineStorage.getItem('jasper_subscription_state');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.planId && parsed.trialStartedAt) {
        return { ...parsed, planId: normalizeSubscriptionPlanId(parsed.planId) };
      }
    } catch (e) {}
  }
  const defaultState: SubscriptionState = {
    planId: 'trial',
    trialStartedAt: new Date().toISOString(),
    isSubscribedPaid: false,
    simulatedDaysPassed: 0,
    autoRenewEnabled: true,
    paymentStatus: 'active'
  };
  onlineStorage.setItem('jasper_subscription_state', JSON.stringify(defaultState));
  return defaultState;
}

export function saveSubscriptionState(state: SubscriptionState) {
  onlineStorage.setItem('jasper_subscription_state', JSON.stringify({
    ...state,
    planId: normalizeSubscriptionPlanId(state.planId)
  }));
}

export interface SubscriptionStatusInfo {
  state: SubscriptionState;
  plan: SubscriptionPlan;
  daysPassed: number;
  daysRemaining: number;
  isExpired: boolean;
  isNearingExpiry: boolean;
  productsLimitExceeded: boolean;
  storesLimitExceeded: boolean;
  staffLimitExceeded: boolean;
}

export function checkSubscriptionStatus(
  state: SubscriptionState,
  currentProductCount: number,
  currentStoreCount: number,
  currentStaffCount: number
): SubscriptionStatusInfo {
  const normalizedPlanId = normalizeSubscriptionPlanId(state.planId);
  const plan = normalizedPlanId === 'trial'
    ? SUBSCRIPTION_PLANS.trial
    : SUBSCRIPTION_PLANS[normalizedPlanId];
  const periodStartedAt = normalizedPlanId === 'trial'
    ? state.trialStartedAt
    : state.paidAt || state.trialStartedAt;
  
  // Calculate elapsed time
  let daysPassed = 0;
  if (state.simulatedDaysPassed !== undefined && state.simulatedDaysPassed > 0) {
    daysPassed = state.simulatedDaysPassed;
  } else {
    const started = new Date(periodStartedAt).getTime();
    const now = new Date().getTime();
    daysPassed = Math.floor(Math.max(0, now - started) / (1000 * 60 * 60 * 24));
  }
  // If promo code was registered: 20 days free. Else 10 days free.
  const durationAllowed = normalizedPlanId === 'trial' 
    ? (state.promoCodeUsed ? 20 : 10) 
    : 30;
  
  const daysRemaining = Math.max(0, durationAllowed - daysPassed);
  
  // Notification triggered 3 days before any trial or paid subscription period ends.
  const isNearingExpiry = daysRemaining > 0 && daysRemaining <= 3;
  
  // Expired state triggers lockouts automatically for trial users and renewal alerts for paid users.
  const isExpired = daysPassed >= durationAllowed;

  const productsLimitExceeded = currentProductCount >= plan.maxProducts;
  const storesLimitExceeded = currentStoreCount >= plan.maxStores;
  const staffLimitExceeded = currentStaffCount >= plan.maxStaff;
  return {
    state: { ...state, planId: normalizedPlanId },
    plan,
    daysPassed,
    daysRemaining,
    isExpired: isExpired || state.paymentStatus === 'expired',
    isNearingExpiry,
    productsLimitExceeded: currentProductCount >= plan.maxProducts,
    storesLimitExceeded: currentStoreCount >= plan.maxStores,
    staffLimitExceeded: currentStaffCount >= plan.maxStaff
  };
}
