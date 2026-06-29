/**
 * commissionEngine.ts — Central commission calculation service
 *
 * 20% Network Commission Pool Rule:
 *   - Total Network Pool = Revenue × 20%
 *   - Super Agent / Partner earns  = Revenue × 5%
 *   - Sub-Affiliate gross earns    = Revenue × 15%
 *   - Validation: 5% + 15% must equal 20% exactly
 *
 * Withholding Tax (CURRENTLY NOT ACTIVE):
 *   - WHT = 5% of sub-affiliate GROSS commission (not of revenue)
 *   - Net Payout = Gross Commission - WHT
 *   - Currently: WHT = 0, Net = Gross (full 15%)
 */

export type WithholdingStatus = 'not_active' | 'pending_tin' | 'deducted' | 'exempted';
export type TinStatus = 'not_submitted' | 'submitted' | 'verified' | 'rejected';
export type PayoutStatus = 'pending' | 'approved' | 'paid' | 'rejected' | 'on_hold';
export type SourceType = 'organic' | 'organic_affiliate' | 'sub_affiliate' | 'agent_network';
export type AccountType = 'affiliate' | 'sub_affiliate' | 'partner' | 'super_agent';

// ─── TypeScript Interfaces ────────────────────────────────────────────────────

export interface CommissionBreakdown {
  revenueAmount: number;
  networkPool20: number;           // Revenue × 20%
  managerCommission5: number;      // Revenue × 5%  (goes to Super Agent)
  subAffiliateGrossCommission15: number; // Revenue × 15% (goes to sub-affiliate)
  withholdingTax5: number;         // 5% of grossCommission15 (NOT of revenue)
  subAffiliateNetPayout: number;   // gross15 - withholdingTax5
  withholdingStatus: WithholdingStatus;
  currency: string;
  calculatedAt: string;
}

export interface SuperAgentProfile {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  promoCode: string;
  status: 'active' | 'suspended' | 'inactive';
  subAffiliateCount: number;
  networkRevenue: number;
  networkPool20: number;
  managerCommission5: number;
  subAffiliateShare15: number;
  pendingPayout: number;
  paidAmount: number;
  activeSubAffiliates: number;
  createdAt: string;
}

export interface SubAffiliateProfile {
  id: string;
  userId: string;
  parentSuperAgentId: string;
  name: string;
  phone: string;
  email: string;
  promoCode: string;
  status: 'active' | 'suspended' | 'inactive';
  customersGenerated: number;
  revenueGenerated: number;
  grossCommission15: number;
  withholdingTax5: number;
  netPayout: number;
  tinNumber?: string;
  tinStatus: TinStatus;
  tinSubmittedAt?: string;
  pendingCommission: number;
  paidCommission: number;
  payoutMethod: string;
  payoutAccount: string;
  createdAt: string;
  isDisabled?: boolean;
}

export interface ReferredCustomer {
  id: string;
  customerName: string;
  phoneNumber: string;
  location: string;
  packageId: string;
  packageName: string;
  packagePrice: number;
  amountPaid: number;
  paymentStatus: 'paid' | 'pending' | 'failed' | 'refunded';
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  sourceType: SourceType;
  affiliateId?: string;
  subAffiliateId?: string;
  parentSuperAgentId?: string;
  referralCodeUsed: string;
  promoCodeUsed: string;
  commissionStatus: PayoutStatus;
  commissionAmount: number;
  createdAt: string;
}

export interface MonthlyReconciliationRow {
  month: string;
  superAgentId: string;
  superAgentName: string;
  subAffiliateId: string;
  subAffiliateName: string;
  customerCount: number;
  networkRevenue: number;
  networkPool20: number;
  managerCommission5: number;
  subAffiliateGrossCommission15: number;
  withholdingTax5: number;
  subAffiliateNetPayout: number;
  tinStatus: TinStatus;
  amountPaid: number;
  amountPending: number;
  payoutStatus: PayoutStatus;
}

export interface AffiliateAccountRecord {
  id: string;
  userId: string;
  accountType: AccountType;
  parentSuperAgentId?: string;
  name: string;
  phone: string;
  email: string;
  promoCode: string;
  payoutMethod: string;
  payoutAccount: string;
  status: 'active' | 'suspended' | 'inactive' | 'under_review';
  tinNumber?: string;
  tinStatus: TinStatus;
  tinSubmittedAt?: string;
  tinVerifiedBy?: string;
  tinVerifiedAt?: string;
  tinRejectionReason?: string;
  nidaNumber?: string;
  isDisabled?: boolean;
  createdAt: string;
}

// ─── Core Commission Calculation Functions ────────────────────────────────────

/** Whether withholding tax is currently active system-wide */
export const WITHHOLDING_TAX_ACTIVE = false;

/** Withholding tax rate on gross commission (NOT on revenue) */
export const WITHHOLDING_TAX_RATE = 0.05;

/** Network pool rate */
export const NETWORK_POOL_RATE = 0.20;

/** Manager/Super Agent cut */
export const MANAGER_RATE = 0.05;

/** Sub-affiliate gross commission rate */
export const SUB_AFFILIATE_RATE = 0.15;

/**
 * Full 20% network pool from revenue
 */
export function calculateNetworkPool(revenueAmount: number): number {
  return Math.round(revenueAmount * NETWORK_POOL_RATE * 100) / 100;
}

/**
 * Super Agent / Partner 5% management commission
 */
export function calculateManagerCommission(revenueAmount: number): number {
  return Math.round(revenueAmount * MANAGER_RATE * 100) / 100;
}

/**
 * Sub-affiliate gross commission: 15% of revenue
 */
export function calculateSubAffiliateGrossCommission(revenueAmount: number): number {
  return Math.round(revenueAmount * SUB_AFFILIATE_RATE * 100) / 100;
}

/**
 * Withholding tax: 5% of GROSS COMMISSION (not of revenue)
 * Always returns the calculated amount for display purposes.
 * WITHHOLDING_TAX_ACTIVE flag controls whether it is actually deducted from payout.
 */
export function calculateWithholdingTax(grossCommission: number): number {
  return Math.round(grossCommission * WITHHOLDING_TAX_RATE * 100) / 100;
}

/**
 * Sub-affiliate net payout after withholding tax
 * If WHT is not active, net payout = full gross commission
 * If WHT is active, net payout = gross - WHT
 */
export function calculateSubAffiliateNetPayout(grossCommission: number): number {
  if (!WITHHOLDING_TAX_ACTIVE) return Math.round(grossCommission * 100) / 100;
  const wht = calculateWithholdingTax(grossCommission);
  return Math.round((grossCommission - wht) * 100) / 100;
}

/**
 * Full commission breakdown for a given revenue amount
 */
export function calculateCommissionBreakdown(
  revenueAmount: number,
  currency = 'TZS'
): CommissionBreakdown {
  const networkPool20 = calculateNetworkPool(revenueAmount);
  const managerCommission5 = calculateManagerCommission(revenueAmount);
  const subAffiliateGrossCommission15 = calculateSubAffiliateGrossCommission(revenueAmount);
  const withholdingTax5 = calculateWithholdingTax(subAffiliateGrossCommission15);
  const subAffiliateNetPayout = calculateSubAffiliateNetPayout(subAffiliateGrossCommission15);

  return {
    revenueAmount,
    networkPool20,
    managerCommission5,
    subAffiliateGrossCommission15,
    withholdingTax5,
    subAffiliateNetPayout,
    withholdingStatus: WITHHOLDING_TAX_ACTIVE ? 'deducted' : 'not_active',
    currency,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Validates the 20% commission split
 * manager5 + subAffiliate15 must equal network20
 */
export function validateCommissionSplit(breakdown: CommissionBreakdown): boolean {
  const sum = breakdown.managerCommission5 + breakdown.subAffiliateGrossCommission15;
  const diff = Math.abs(sum - breakdown.networkPool20);
  return diff < 0.01; // allow for floating point rounding
}

/**
 * Mask a TIN number for display — show only last 3 chars
 */
export function maskTIN(tin: string): string {
  if (!tin || tin.length < 4) return '***';
  return '***' + tin.slice(-3);
}

/**
 * Format amount as TZS
 */
export function formatTZS(amount: number): string {
  return 'TZS ' + Math.round(amount).toLocaleString();
}

/**
 * Calculate totals for a Super Agent across all their sub-affiliates
 */
export function calculateSuperAgentNetworkTotals(
  subAffiliates: SubAffiliateProfile[]
): Pick<SuperAgentProfile, 'subAffiliateCount' | 'networkRevenue' | 'networkPool20' | 'managerCommission5' | 'subAffiliateShare15' | 'pendingPayout' | 'paidAmount' | 'activeSubAffiliates'> {
  const activeSubAffiliates = subAffiliates.filter(a => a.status === 'active' && !a.isDisabled).length;
  const networkRevenue = subAffiliates.reduce((s, a) => s + (a.revenueGenerated || 0), 0);
  const networkPool20 = calculateNetworkPool(networkRevenue);
  const managerCommission5 = calculateManagerCommission(networkRevenue);
  const subAffiliateShare15 = calculateSubAffiliateGrossCommission(networkRevenue);
  const pendingPayout = subAffiliates.reduce((s, a) => s + (a.pendingCommission || 0), 0);
  const paidAmount = subAffiliates.reduce((s, a) => s + (a.paidCommission || 0), 0);

  return {
    subAffiliateCount: subAffiliates.length,
    networkRevenue,
    networkPool20,
    managerCommission5,
    subAffiliateShare15,
    pendingPayout,
    paidAmount,
    activeSubAffiliates,
  };
}

/**
 * Build a monthly reconciliation row for a sub-affiliate
 */
export function buildReconciliationRow(
  month: string,
  superAgent: { id: string; name: string },
  subAffiliate: SubAffiliateProfile,
  customers: ReferredCustomer[]
): MonthlyReconciliationRow {
  const monthCustomers = customers.filter(c => c.createdAt.startsWith(month.slice(0, 7)));
  const networkRevenue = monthCustomers.reduce((s, c) => s + c.amountPaid, 0);
  const breakdown = calculateCommissionBreakdown(networkRevenue);
  const amountPaid = subAffiliate.paidCommission || 0;
  const amountPending = Math.max(0, breakdown.subAffiliateNetPayout - amountPaid);

  return {
    month,
    superAgentId: superAgent.id,
    superAgentName: superAgent.name,
    subAffiliateId: subAffiliate.id,
    subAffiliateName: subAffiliate.name,
    customerCount: monthCustomers.length,
    networkRevenue,
    networkPool20: breakdown.networkPool20,
    managerCommission5: breakdown.managerCommission5,
    subAffiliateGrossCommission15: breakdown.subAffiliateGrossCommission15,
    withholdingTax5: breakdown.withholdingTax5,
    subAffiliateNetPayout: breakdown.subAffiliateNetPayout,
    tinStatus: subAffiliate.tinStatus,
    amountPaid,
    amountPending,
    payoutStatus: amountPending > 0 ? 'pending' : 'paid',
  };
}
