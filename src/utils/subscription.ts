export type SubscriptionPlanId = 'trial' | 'essential' | 'business' | 'wholesale';

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  price: number; // 0, 30000, 40000, 50000
  durationDays: number;
  maxProducts: number; // e.g. 20, 100, 500, Unlimited
  maxStores: number;   // e.g. 1, 1, 3, 10
  maxStaff: number;    // e.g. 1, 2, 5, Unlimited
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
  essential: {
    id: 'essential',
    name: 'Essential Ledger',
    price: 15000,
    durationDays: 30,
    maxProducts: 1000,
    maxStores: 5,
    maxStaff: 5,
    features: [
      'Max 1000 Products catalogued',
      'Max 5 Active Store branches',
      'Max 5 Users / staff accounts',
      'Supplies management & alerts',
      'Cashier Till (POS Simulator)',
      'Advanced Business Reports',
      'Customer & Loyalty tracker',
      'Multistore spreadsheet exports'
    ]
  },
  business: {
    id: 'business',
    name: 'Standard Business',
    price: 30000,
    durationDays: 30,
    maxProducts: 5000,
    maxStores: 8,
    maxStaff: 8,
    features: [
      'Max 5000 Products catalogued',
      'Max 8 Active Store branches',
      'Max 8 Users / staff accounts',
      'Custom Role Security permissions',
      'Supplies & supplier log ledger',
      'Cashier POS Till checkout',
      'Consolidated P&L index generators',
      'Lucy self-learning integration'
    ]
  },
  wholesale: {
    id: 'wholesale',
    name: 'Premium',
    price: 45000,
    durationDays: 30,
    maxProducts: 999999, // Unlimited
    maxStores: 10,
    maxStaff: 10,
    features: [
      'Unlimited Products catalogued',
      'Max 10 Active Store branches',
      'Max 10 Users / staff accounts',
      'Supplies management tracking',
      'Cashier Till (POS Simulator)',
      'Full suite Business Reports',
      'Customer management engine',
      'Full white-label custom domain portals',
      'Affiliate progression tracker integration'
    ]
  }
};

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

// Low level helpers
export function getSubscriptionState(): SubscriptionState {
  const cached = localStorage.getItem('jasper_subscription_state');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      // Ensure essential fields exist
      if (parsed && parsed.planId && parsed.trialStartedAt) {
        return parsed;
      }
    } catch (e) {
      // fallback
    }
  }

  // Create default trial state starting today
  const defaultState: SubscriptionState = {
    planId: 'business',
    trialStartedAt: new Date().toISOString(),
    isSubscribedPaid: true,
    simulatedDaysPassed: 0,
    autoRenewEnabled: true,
    paymentStatus: 'active'
  };
  localStorage.setItem('jasper_subscription_state', JSON.stringify(defaultState));
  return defaultState;
}

export function saveSubscriptionState(state: SubscriptionState) {
  localStorage.setItem('jasper_subscription_state', JSON.stringify(state));
}

export interface SubscriptionStatusInfo {
  state: SubscriptionState;
  plan: SubscriptionPlan;
  daysPassed: number;
  daysRemaining: number;
  isExpired: boolean;
  isNearingExpiry: boolean; // 3 days or less remaining
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
  const plan = SUBSCRIPTION_PLANS[state.planId];
  
  // Calculate elapsed time
  let daysPassed = 0;
  if (state.simulatedDaysPassed !== undefined && state.simulatedDaysPassed > 0) {
    daysPassed = state.simulatedDaysPassed;
  } else {
    const started = new Date(state.trialStartedAt).getTime();
    const now = new Date().getTime();
    const diffMs = Math.max(0, now - started);
    daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  // If promo code was registered: 1 month (30 days) free. Else 14 days free.
  const durationAllowed = state.planId === 'trial' 
    ? (state.promoCodeUsed ? 30 : 14) 
    : 30;
  
  const daysRemaining = Math.max(0, durationAllowed - daysPassed);
  
  // Notification triggered 3 days before subscription ends
  const isNearingExpiry = !state.isSubscribedPaid && daysRemaining > 0 && daysRemaining <= 3;
  
  // Expired state triggers lockouts automatically
  const isExpired = !state.isSubscribedPaid && daysPassed >= durationAllowed;

  const productsLimitExceeded = currentProductCount >= plan.maxProducts;
  const storesLimitExceeded = currentStoreCount >= plan.maxStores;
  const staffLimitExceeded = currentStaffCount >= plan.maxStaff;

  return {
    state,
    plan,
    daysPassed,
    daysRemaining,
    isExpired: isExpired || state.paymentStatus === 'expired',
    isNearingExpiry,
    productsLimitExceeded,
    storesLimitExceeded,
    staffLimitExceeded
  };
}
