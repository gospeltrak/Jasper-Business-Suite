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
    name: 'Sandbox Plan',
    price: 0,
    durationDays: 14,
    maxProducts: 200,
    maxStores: 1,
    maxStaff: 2,
    features: [
      'Max 200 Products catalogued',
      'Max 1 Active Store branch',
      'Max 2 Users / staff access',
      'Supplies management',
      'Cashier Till (POS Simulator)',
      'Basic Business Reports',
      'Customer management system'
    ]
  },
  ruby: {
    id: 'ruby',
    packageId: 'ruby',
    name: 'Ruby',
    price: 20000,
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
    price: 35000,
    durationDays: 30,
    maxProducts: 5000,
    maxStores: 2,
    maxStaff: 6,
    features: [
      'Max 5000 Products catalogued',
      'Max 2 Active Store branches',
      'Max 6 Users / staff accounts',
      'Custom Role Security permissions',
      'Supplies & supplier log ledger',
      'Cashier POS Till checkout',
      'Consolidated P&L index generators',
      'Branch management and stock transfer'
    ]
  },
  tanzanite: {
    id: 'tanzanite',
    packageId: 'tanzanite',
    name: 'Tanzanite',
    price: 50000,
    durationDays: 30,
    maxProducts: 999999,
    maxStores: 5,
    maxStaff: 15,
    features: [
      'Unlimited Products catalogued',
      'Max 5 Active Store branches',
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
    price: 20000,
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
    price: 35000,
    durationDays: 30,
    maxProducts: 5000,
    maxStores: 2,
    maxStaff: 6,
    features: [
      'Max 5000 Products catalogued',
      'Max 2 Active Store branches',
      'Max 6 Users / staff accounts',
      'Custom Role Security permissions',
      'Supplies & supplier log ledger',
      'Cashier POS Till checkout',
      'Consolidated P&L index generators',
      'Branch management and stock transfer'
    ]
  },
  wholesale: {
    id: 'wholesale',
    packageId: 'tanzanite',
    name: 'Tanzanite',
    price: 50000,
    durationDays: 30,
    maxProducts: 999999,
    maxStores: 5,
    maxStaff: 15,
    features: [
      'Unlimited Products catalogued',
      'Max 5 Active Store branches',
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
    const { getDynamicSupabaseClient } = await import('../supabaseClient');
    const client: any = await getDynamicSupabaseClient();
    const url: string = (client as any).supabaseUrl || '';
    if (!url || url.includes('placeholder')) return null;

    const { data, error } = await client
      .from('tenants')
      .select('subscription_plan, subscription_activated_at')
      .eq('id', tenantId)
      .maybeSingle();

    if (error || !data || !data.subscription_plan) return null;

    const normalizedPlanId = normalizeSubscriptionPlanId(data.subscription_plan);
    const state: SubscriptionState = {
      planId: normalizedPlanId,
      trialStartedAt: data.subscription_activated_at || new Date().toISOString(),
      isSubscribedPaid: normalizedPlanId !== 'trial',
      paidAt: data.subscription_activated_at || undefined,
      paymentStatus: 'active',
      autoRenewEnabled: true,
    };
    saveSubscriptionState(state);
    return state;
  } catch (e) {
    return null;
  }
}



export function getSubscriptionState(): SubscriptionState {
  const cached = localStorage.getItem('jasper_subscription_state');
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
  localStorage.setItem('jasper_subscription_state', JSON.stringify(defaultState));
  return defaultState;
}

export function saveSubscriptionState(state: SubscriptionState) {
  localStorage.setItem('jasper_subscription_state', JSON.stringify({
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
  const plan = SUBSCRIPTION_PLANS[normalizedPlanId];
  let daysPassed = 0;
  if (state.simulatedDaysPassed !== undefined && state.simulatedDaysPassed > 0) {
    daysPassed = state.simulatedDaysPassed;
  } else {
    const started = new Date(state.trialStartedAt).getTime();
    const now = new Date().getTime();
    daysPassed = Math.floor(Math.max(0, now - started) / (1000 * 60 * 60 * 24));
  }
  const durationAllowed = normalizedPlanId === 'trial' ? (state.promoCodeUsed ? 30 : 14) : 30;
  const daysRemaining = Math.max(0, durationAllowed - daysPassed);
  const isNearingExpiry = !state.isSubscribedPaid && daysRemaining > 0 && daysRemaining <= 3;
  const isExpired = !state.isSubscribedPaid && daysPassed >= durationAllowed;
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
