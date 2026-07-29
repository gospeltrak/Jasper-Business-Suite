import { getSecureDataBridgeClient } from '../secureDataBridge';
import { isEarnedCommissionStatus, isPaidPayoutStatus, isSettledPaymentStatus } from './financialStatus';

export interface SuperAdminOverview {
  tenants: any[];
  users: any[];
  workspaces: any[];
  sessions: any[];
  affiliates: any[];
  affiliatePartners: any[];    // affiliate_partners table rows
  referrals: any[];
  sourceTracking: any[];
  referredCustomers: any[];    // referred_customers — who referred which tenant
  commissions: any[];
  payouts: any[];
  auditLogs: any[];
}

export interface SuperAdminUserRow {
  id: string;
  tenantId: string | null;
  tenantName: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  referralSource: 'direct' | 'affiliate';
  referringAffiliate?: string;          // promo code used
  referringAffiliateName?: string;      // affiliate display name
  referringPartnerName?: string;        // parent partner/agent name
  subscriberSourceType?: 'organic' | 'organic_affiliate' | 'sub_affiliate' | 'unknown' | 'untracked';
  promoCodeUsed?: string;
  referralCodeUsed?: string;
  subAffiliateId?: string | null;
  subscriptionPlan: string;
  paymentStatus: 'Paid' | 'Unpaid' | 'Grace Period' | 'Overdue';
  paymentMethod: string;
  dateCreated: string;
  status: 'Active' | 'Suspended' | 'Expired';
  // Location — from tenant business setup, GPS, or region fields
  location: string;            // human-readable label shown in table
  locationSource: 'gps' | 'business_setup' | 'manual' | 'none';
  gpsLat?: number;
  gpsLng?: number;
  country?: string;
  city?: string;
  region?: string;
  // Activity
  lastActivity: string;        // ISO string or '' if never
  lastActivityLabel: string;   // "Today", "Yesterday", "3 days ago", "Never"
  // Subscription dates
  trialStartDate?: string;
  trialEndDate?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  subscriptionStatus: string;  // 'trial' | 'active' | 'expired' | 'cancelled' etc
  sessions: Array<{ loginTime: string; logoutTime: string; durationMinutes: number; device: 'Phone' | 'Tablet' | 'Desktop'; ipAddress: string; location: string }>;
  transactions: Array<{ id: string; date: string; items: string; amount: number; paymentMethod: string }>;
  reports: Array<{ month: string; profit: number; taxCollected: number; expenseTotal: number }>;
  stockRecords: Array<{ id: string; name: string; sku: string; stockQty: number; alertQty: number }>;
  downlines: Array<{ name: string; role: string; status: 'online' | 'offline' }>;
  messages: Array<{ sender: string; timestamp: string; body: string }>;
  paymentHistory: Array<{ invoiceNo: string; date: string; amount: number; method: string; status: 'Success' | 'Pending' }>;
}

export interface SuperAdminMetrics {
  subscribersCount: number;
  activeTenants: number;
  activeSessions: number;
  totalIncome: number;
  affiliatePayouts: number;
  expenses: number;
  balance: number;
  monthlyUsersByPackage: Array<Record<string, string | number>>;
  packageDistribution: Array<{ name: string; value: number; color: string }>;
  organicVsAffiliate: Array<{ name: string; Organic: number; Affiliate: number }>;
}

export type SuperAdminPresenceUserType = 'tenant' | 'affiliate' | 'partner';

export interface SuperAdminPresenceEntry {
  userId: string;
  userType: SuperAdminPresenceUserType;
  userName: string;
  businessName?: string;
  accountRole: string;
  lastHeartbeat: string;
}

export interface SuperAdminVisitEntry extends SuperAdminPresenceEntry {
  date: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

const EMPTY_SUPER_ADMIN_OVERVIEW: SuperAdminOverview = {
  tenants: [],
  users: [],
  workspaces: [],
  sessions: [],
  affiliates: [],
  affiliatePartners: [],
  referrals: [],
  sourceTracking: [],
  referredCustomers: [],
  commissions: [],
  payouts: [],
  auditLogs: []
};

const normalizeOverview = (overview?: Partial<SuperAdminOverview> | null): SuperAdminOverview => ({
  tenants: Array.isArray(overview?.tenants) ? overview.tenants : [],
  users: Array.isArray(overview?.users) ? overview.users : [],
  workspaces: Array.isArray(overview?.workspaces) ? overview.workspaces : [],
  sessions: Array.isArray(overview?.sessions) ? overview.sessions : [],
  affiliates: Array.isArray(overview?.affiliates) ? overview.affiliates : [],
  affiliatePartners: Array.isArray(overview?.affiliatePartners) ? overview.affiliatePartners : [],
  referrals: Array.isArray(overview?.referrals) ? overview.referrals : [],
  sourceTracking: Array.isArray(overview?.sourceTracking) ? overview.sourceTracking : [],
  referredCustomers: Array.isArray(overview?.referredCustomers) ? overview.referredCustomers : [],
  commissions: Array.isArray(overview?.commissions) ? overview.commissions : [],
  payouts: Array.isArray(overview?.payouts) ? overview.payouts : [],
  auditLogs: Array.isArray(overview?.auditLogs) ? overview.auditLogs : []
});

const OVERVIEW_CACHE_TTL_MS = 10_000;
const API_REQUEST_TIMEOUT_MS = 20_000;
let overviewCache: { value: SuperAdminOverview; expiresAt: number } | null = null;
let overviewRequest: Promise<SuperAdminOverview> | null = null;

const apiRequest = async (path: string, init: RequestInit = {}) => {
  const client = await getSecureDataBridgeClient();
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) throw new Error('Super Admin login is required.');

  const method = String(init.method || 'GET').toUpperCase();
  const requestPath = method === 'GET'
    ? `${path}${path.includes('?') ? '&' : '?'}_fresh=${Date.now()}`
    : path;
  const response = await fetch(requestPath, {
    ...init,
    cache: 'no-store',
    signal: init.signal || AbortSignal.timeout(API_REQUEST_TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(init.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const requestError: any = new Error(payload?.error || 'Super Admin request failed.');
    requestError.status = response.status;
    throw requestError;
  }
  if (method !== 'GET') overviewCache = null;
  return payload;
};

async function fetchSuperAdminOverview(): Promise<SuperAdminOverview> {
  let apiError: Error | null = null;

  // Try API first (uses service role via Bearer token)
  try {
    return normalizeOverview(await apiRequest('/api/super-admin/overview'));
  } catch (apiErr: any) {
    apiError = apiErr instanceof Error ? apiErr : new Error('Super Admin overview request failed.');
    const status = Number(apiErr?.status || 0);
    // Only an authorization mismatch can benefit from the RLS-protected direct
    // client fallback. Retrying 5xx, timeouts or network failures as eleven
    // parallel database queries would amplify an already unhealthy backend.
    if (status !== 401 && status !== 403) throw apiError;

    // API auth failed (403/401) — try direct Supabase client as fallback
    // This works when the super admin is authenticated in Supabase but
    // the server-side requirePlatformAdmin check fails (e.g. is_active mismatch)
    console.warn('[SuperAdmin] API fallback to direct client:', apiErr?.message);
    try {
      const client: any = await getSecureDataBridgeClient();
      const [
        tenantsRes,
        usersRes,
        workspacesRes,
        sessionsRes,
        affiliatesRes,
        affiliatePartnersRes,
        referralsRes,
        sourceTrackingRes,
        referredCustomersRes,
        commissionsRes,
        payoutsRes,
      ] = await Promise.all([
        client.from('tenants').select('*').order('name', { ascending: true }),
        client.from('users').select('*').order('name', { ascending: true }),
        client.from('tenant_workspaces').select('*'),
        client.from('user_sessions').select('*').order('last_activity_at', { ascending: false }).limit(500),
        client.from('affiliates').select('*').order('created_at', { ascending: false }),
        client.from('affiliate_partners').select('*').order('created_at', { ascending: false }),
        client.from('affiliate_referrals').select('*').order('created_at', { ascending: false }).limit(1000),
        client.from('subscriber_source_tracking').select('*').order('created_at', { ascending: false }).limit(2000),
        client.from('referred_customers').select('*').order('created_at', { ascending: false }).limit(2000),
        client.from('affiliate_commissions').select('*').order('created_at', { ascending: false }).limit(1000),
        client.from('affiliate_payouts').select('*').order('requested_at', { ascending: false }).limit(1000),
      ]);
      if (!tenantsRes.error && !usersRes.error) {
        const fallbackOverview = normalizeOverview({
          tenants: tenantsRes.data || [],
          users: usersRes.data || [],
          workspaces: workspacesRes.error ? [] : workspacesRes.data || [],
          sessions: sessionsRes.error ? [] : sessionsRes.data || [],
          affiliates: affiliatesRes.error ? [] : affiliatesRes.data || [],
          affiliatePartners: affiliatePartnersRes.error ? [] : affiliatePartnersRes.data || [],
          referrals: referralsRes.error ? [] : referralsRes.data || [],
          sourceTracking: sourceTrackingRes.error ? [] : sourceTrackingRes.data || [],
          referredCustomers: referredCustomersRes.error ? [] : referredCustomersRes.data || [],
          commissions: commissionsRes.error ? [] : commissionsRes.data || [],
          payouts: payoutsRes.error ? [] : payoutsRes.data || [],
          auditLogs: [],
        });
        // A denied RLS read can look like a successful empty query. Do not turn
        // an authenticated API failure into false zero-subscriber metrics.
        if (fallbackOverview.tenants.length || fallbackOverview.users.length) {
          return fallbackOverview;
        }
      }
    } catch (clientErr: any) {
      console.warn('[SuperAdmin] Direct client fallback also failed:', clientErr?.message);
    }
  }

  throw apiError || new Error('Unable to load the live Super Admin overview.');
}

export async function loadSuperAdminOverview(): Promise<SuperAdminOverview> {
  if (overviewCache && overviewCache.expiresAt > Date.now()) return overviewCache.value;
  if (overviewRequest) return overviewRequest;

  overviewRequest = fetchSuperAdminOverview()
    .then((overview) => {
      overviewCache = {
        value: overview,
        expiresAt: Date.now() + OVERVIEW_CACHE_TTL_MS,
      };
      return overview;
    })
    .finally(() => {
      overviewRequest = null;
    });

  return overviewRequest;
}

export async function updateSuperAdminUser(userId: string, payload: Record<string, unknown>) {
  return apiRequest(`/api/super-admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function resetSuperAdminUserPassword(userId: string, password: string) {
  return apiRequest(`/api/super-admin/users/${encodeURIComponent(userId)}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password })
  });
}

export async function deleteSuperAdminUser(userId: string) {
  return apiRequest(`/api/super-admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

export async function createSuperAdminStaff(payload: Record<string, unknown>) {
  return apiRequest('/api/super-admin/staff', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateSuperAdminStaff(staffId: string, payload: Record<string, unknown>) {
  return apiRequest(`/api/super-admin/staff/${encodeURIComponent(staffId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteSuperAdminStaff(staffId: string) {
  return apiRequest(`/api/super-admin/staff/${encodeURIComponent(staffId)}`, { method: 'DELETE' });
}

export interface SuperAdminBranchAccess {
  serverRolloutEnabled: boolean;
  databaseRolloutEnabled: boolean;
  tenantFeatureEnabled: boolean;
  additionalGrantedSlots: number;
  defaultTotalBranches: number;
  effectiveTotalBranches: number;
  currentPhysicalBranchCount: number;
  grantReason: string;
  grantedAt: string | null;
  updatedAt: string | null;
}

export async function loadTenantBranchAccess(tenantId: string) {
  return apiRequest(`/api/super-admin/tenants/${encodeURIComponent(tenantId)}/branch-access`) as Promise<{
    tenant: Record<string, any>;
    branchAccess: SuperAdminBranchAccess;
  }>;
}

export async function activateTenantPackage(
  tenantId: string,
  payload: {
    packageId: 'ruby' | 'diamond' | 'tanzanite';
    durationDays?: number;
    reason: string;
    enableBranches?: boolean;
    paymentProofId?: string;
    idempotencyKey?: string;
  },
) {
  return apiRequest(`/api/super-admin/tenants/${encodeURIComponent(tenantId)}/activate-package`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function configureTenantBranchCapacity(
  tenantId: string,
  payload: {
    additionalBranchSlots: number;
    featureEnabled: boolean;
    reason: string;
  },
) {
  return apiRequest(`/api/super-admin/tenants/${encodeURIComponent(tenantId)}/branch-capacity`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function configureMultiBranchRollout(payload: { enabled: boolean; reason: string }) {
  return apiRequest('/api/super-admin/multibranch-rollout', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

const money = (value: unknown) => Number(value || 0);
const formatDate = (value: unknown) => value ? new Date(String(value)).toISOString().slice(0, 10) : '';
const formatDateTime = (value: unknown) => value ? new Date(String(value)).toISOString().replace('T', ' ').slice(0, 16) : '';
const isPlatformUser = (user: any) => {
  const accountType = String(user?.account_type || '').toLowerCase();
  const roleKey = String(user?.role_key || user?.role || '').toLowerCase();
  return accountType === 'super_admin' || accountType === 'affiliate' || accountType === 'partner' || roleKey === 'super_admin' || Boolean(user?.is_saas_staff);
};

const SEEDED_DEMO_TENANT_IDS = new Set([
  '11111111-1111-1111-1111-111111111111',
]);

export const isRealSubscriberTenant = (tenant: any) => {
  if (!tenant?.id) return false;
  const tenantId = String(tenant.id);
  const settings = readTenantSettings(tenant);
  return !SEEDED_DEMO_TENANT_IDS.has(tenantId)
    && tenant.is_demo !== true
    && settings?.isDemo !== true
    && settings?.is_demo !== true;
};

// The app touches a cloud session once per minute. Seven minutes gives mobile
// browsers enough tolerance for a delayed timer without treating old, abandoned
// `is_active=true` rows as users who are still online.
export const ONLINE_SESSION_WINDOW_MS = 7 * 60 * 1000;

const sessionActivityTimestamp = (session: any): string => {
  const candidates = [session?.last_activity_at, session?.logout_at, session?.updated_at, session?.login_at]
    .filter(Boolean)
    .map(String)
    .filter((value) => Number.isFinite(new Date(value).getTime()));
  if (!candidates.length) return '';
  return candidates.reduce((latest, value) => (
    new Date(value).getTime() > new Date(latest).getTime() ? value : latest
  ));
};

export const isSessionOnline = (session: any, nowMs = Date.now()): boolean => {
  if (!session?.is_active || session?.logout_at) return false;
  const lastSeenAt = sessionActivityTimestamp(session);
  if (!lastSeenAt) return false;
  const age = nowMs - new Date(lastSeenAt).getTime();
  return age >= 0 && age <= ONLINE_SESSION_WINDOW_MS;
};

const latestSessionActivity = (sessions: any[]): string => sessions.reduce((latest, session) => {
  const value = sessionActivityTimestamp(session);
  if (!value) return latest;
  return !latest || new Date(value).getTime() > new Date(latest).getTime() ? value : latest;
}, '');

const localDateKey = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildSessionIdentityResolver = (overview: SuperAdminOverview) => {
  const usersById = new Map(overview.users.map((user) => [String(user.id), user]));
  const tenantById = new Map(
    overview.tenants.filter(isRealSubscriberTenant).map((tenant) => [String(tenant.id), tenant])
  );
  const affiliateByUserId = new Map(
    overview.affiliates.filter((row) => row.user_id).map((row) => [String(row.user_id), row])
  );
  const partnerByUserId = new Map(
    overview.affiliatePartners.filter((row) => row.user_id).map((row) => [String(row.user_id), row])
  );

  return (session: any): Omit<SuperAdminPresenceEntry, 'lastHeartbeat'> | null => {
    const userId = String(session?.user_id || '');
    if (!userId) return null;
    const user = usersById.get(userId);
    const partner = partnerByUserId.get(userId);
    const affiliate = affiliateByUserId.get(userId);
    const accountType = String(user?.account_type || session?.account_type || '').toLowerCase();
    const roleKey = String(user?.role_key || user?.role || session?.role_key || '').toLowerCase();

    if (partner || accountType === 'partner' || roleKey === 'partner') {
      return {
        userId,
        userType: 'partner',
        userName: partner?.display_name || user?.name || 'Partner',
        accountRole: 'Partner',
      };
    }
    if (affiliate || accountType === 'affiliate' || roleKey === 'affiliate') {
      return {
        userId,
        userType: 'affiliate',
        userName: affiliate?.display_name || user?.name || 'Affiliate',
        accountRole: 'Affiliate',
      };
    }

    const tenantId = String(session?.tenant_id || user?.tenant_id || '');
    const tenant = tenantById.get(tenantId);
    if (!tenant || accountType === 'super_admin' || user?.is_saas_staff) return null;
    const isStaff = accountType === 'business_staff';
    return {
      userId,
      userType: 'tenant',
      userName: user?.name || (isStaff ? 'Business staff' : 'Business owner'),
      businessName: tenant.name || 'Unnamed business',
      accountRole: isStaff
        ? `Staff · ${user?.role_key || user?.role || session?.role_key || 'Staff'}`
        : (user?.role_key || user?.role || session?.role_key || 'Owner'),
    };
  };
};

export const buildSuperAdminOnlinePresence = (
  overview: SuperAdminOverview,
  nowMs = Date.now()
): SuperAdminPresenceEntry[] => {
  const safeOverview = normalizeOverview(overview);
  const resolveIdentity = buildSessionIdentityResolver(safeOverview);
  const uniqueAccounts = new Map<string, SuperAdminPresenceEntry>();

  [...safeOverview.sessions]
    .sort((a, b) => new Date(sessionActivityTimestamp(b)).getTime() - new Date(sessionActivityTimestamp(a)).getTime())
    .forEach((session) => {
      if (!isSessionOnline(session, nowMs)) return;
      const identity = resolveIdentity(session);
      if (!identity || uniqueAccounts.has(identity.userId)) return;
      uniqueAccounts.set(identity.userId, {
        ...identity,
        lastHeartbeat: sessionActivityTimestamp(session),
      });
    });

  return Array.from(uniqueAccounts.values());
};

export const buildSuperAdminVisitHistory = (
  overview: SuperAdminOverview,
  dateFrom: string,
  dateTo: string
): SuperAdminVisitEntry[] => {
  const safeOverview = normalizeOverview(overview);
  const resolveIdentity = buildSessionIdentityResolver(safeOverview);
  const visitsByAccountAndDay = new Map<string, SuperAdminVisitEntry>();

  safeOverview.sessions.forEach((session) => {
    if (!session?.login_at) return;
    const identity = resolveIdentity(session);
    if (!identity) return;
    const date = localDateKey(session.login_at);
    if (date < dateFrom || date > dateTo) return;
    const key = `${identity.userId}:${date}`;
    const activityAt = sessionActivityTimestamp(session) || session.login_at;
    const current = visitsByAccountAndDay.get(key);
    if (!current) {
      visitsByAccountAndDay.set(key, {
        ...identity,
        date,
        firstSeenAt: session.login_at,
        lastSeenAt: activityAt,
        lastHeartbeat: activityAt,
      });
      return;
    }
    if (new Date(session.login_at).getTime() < new Date(current.firstSeenAt).getTime()) current.firstSeenAt = session.login_at;
    if (new Date(activityAt).getTime() > new Date(current.lastSeenAt).getTime()) {
      current.lastSeenAt = activityAt;
      current.lastHeartbeat = activityAt;
    }
  });

  return Array.from(visitsByAccountAndDay.values())
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
};

const subscriberOwnerRank = (user: any) => {
  const accountType = String(user?.account_type || '').toLowerCase();
  const role = String(user?.role_key || user?.role || '').toLowerCase();
  if (accountType === 'business_user' && (role.includes('owner') || role.includes('admin'))) return 4;
  if (accountType === 'business_user') return 3;
  if (role.includes('owner') || role.includes('admin')) return 2;
  return 1;
};

const getSubscriberOwnerUsers = (overview: SuperAdminOverview, realTenantIds: Set<string>) => {
  const ownerByTenant = new Map<string, any>();
  overview.users.forEach((user) => {
    const tenantId = user?.tenant_id ? String(user.tenant_id) : '';
    const accountType = String(user?.account_type || '').toLowerCase();
    if (!tenantId || !realTenantIds.has(tenantId) || isPlatformUser(user) || accountType === 'business_staff') return;
    const current = ownerByTenant.get(tenantId);
    if (!current || subscriberOwnerRank(user) > subscriberOwnerRank(current)) ownerByTenant.set(tenantId, user);
  });
  return Array.from(ownerByTenant.values());
};

const getWorkspacePayload = (workspace: any) => {
  const payload = workspace?.payload;
  if (!payload) return {};
  if (typeof payload === 'string') {
    try { return JSON.parse(payload); } catch { return {}; }
  }
  return payload;
};

const readTenantSettings = (tenant: any) => {
  const settings = tenant?.business_settings || tenant?.company_settings || {};
  if (typeof settings === 'string') {
    try { return JSON.parse(settings); } catch { return {}; }
  }
  return settings || {};
};

const getTenantPlan = (tenant: any) => {
  const settings = readTenantSettings(tenant);
  return settings?.subscriptionPlan || settings?.package || tenant?.subscription_plan || tenant?.package || 'Unassigned package';
};

const getPaymentStatus = (tenant: any, user: any): SuperAdminUserRow['paymentStatus'] => {
  const settings = readTenantSettings(tenant);
  const status = String(settings?.paymentStatus || user?.payment_status || tenant?.payment_status || '').trim().toLowerCase();
  if (status.includes('overdue')) return 'Overdue';
  if (status.includes('grace')) return 'Grace Period';
  return isSettledPaymentStatus(status) ? 'Paid' : 'Unpaid';
};

const monthLabel = (value: unknown) => {
  const date = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en', { month: 'short' });
};

const activityLabel = (iso: string | null | undefined, online = false): string => {
  if (online) return 'Online now';
  if (!iso) return 'Never';
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

const resolveLocation = (tenant: any, user: any): {
  location: string; locationSource: 'gps' | 'business_setup' | 'manual' | 'none';
  gpsLat?: number; gpsLng?: number; country?: string; city?: string; region?: string;
} => {
  // GPS first
  if (tenant?.gps_latitude && tenant?.gps_longitude) {
    return {
      location: [tenant.city || tenant.region || tenant.country].filter(Boolean).join(', ') || `${tenant.gps_latitude}, ${tenant.gps_longitude}`,
      locationSource: 'gps',
      gpsLat: Number(tenant.gps_latitude),
      gpsLng: Number(tenant.gps_longitude),
      country: tenant.country,
      city: tenant.city,
      region: tenant.region,
    };
  }
  // Business setup / tenant profile
  const parts = [tenant?.city, tenant?.region, tenant?.country].filter(Boolean);
  if (parts.length) {
    return {
      location: parts.join(', '),
      locationSource: 'business_setup',
      country: tenant?.country,
      city: tenant?.city,
      region: tenant?.region,
    };
  }
  // User profile fallback
  if (user?.city || user?.country) {
    return {
      location: [user.city, user.country].filter(Boolean).join(', '),
      locationSource: 'manual',
      country: user.country,
      city: user.city,
    };
  }
  return { location: 'Location not provided', locationSource: 'none' };
};

export function mapSuperAdminUsers(overview: SuperAdminOverview): SuperAdminUserRow[] {
  const safeOverview = normalizeOverview(overview);
  const realTenants = safeOverview.tenants.filter(isRealSubscriberTenant);
  const realTenantIds = new Set(realTenants.map((tenant) => String(tenant.id)));
  const tenantById = new Map(realTenants.map((tenant) => [String(tenant.id), tenant]));
  const workspaceByTenant = new Map(safeOverview.workspaces.map((workspace) => [String(workspace.tenant_id), getWorkspacePayload(workspace)]));
  const sessionsByUser = new Map<string, any[]>();
  safeOverview.sessions.forEach((session) => {
    const key = String(session.user_id);
    sessionsByUser.set(key, [...(sessionsByUser.get(key) || []), session]);
  });
  const referralsByUser = new Map(safeOverview.referrals.map((referral) => [String(referral.registered_user_id), referral]));
  const trackingByUser = new Map(safeOverview.sourceTracking.map((row) => [String(row.subscriber_user_id), row]));
  const trackingByTenant = new Map(safeOverview.sourceTracking.map((row) => [String(row.tenant_id), row]));
  // Build referred_customers lookup by tenant_id — shows which affiliate referred each tenant
  const referredByTenant = new Map<string, any>();
  safeOverview.referredCustomers.forEach((row) => {
    const tid = String(row.tenant_id || row.customer_id || '');
    if (tid && !referredByTenant.has(tid)) referredByTenant.set(tid, row);
  });
  // Build affiliate lookup by id and promo_code
  const affiliateById = new Map(safeOverview.affiliates.map((a) => [String(a.id), a]));
  const affiliateByPromo = new Map(safeOverview.affiliates.map((a) => [String(a.promo_code || '').toUpperCase(), a]));
  const partnerById = new Map(safeOverview.affiliatePartners.map((p) => [String(p.id), p]));
  const usersByTenant = new Map<string, any[]>();
  safeOverview.users.forEach((user) => {
    if (!user.tenant_id) return;
    const key = String(user.tenant_id);
    usersByTenant.set(key, [...(usersByTenant.get(key) || []), user]);
  });

  const mappedUsers = getSubscriberOwnerUsers(safeOverview, realTenantIds)
    .map((user) => {
      const tenantId = user.tenant_id ? String(user.tenant_id) : null;
      const tenant = tenantId ? tenantById.get(tenantId) : null;
      const workspace = tenantId ? workspaceByTenant.get(tenantId) || {} : {};
      const sales = Array.isArray(workspace.sales) ? workspace.sales : [];
      const expenses = Array.isArray(workspace.expenses) ? workspace.expenses : [];
      const products = Array.isArray(workspace.products) ? workspace.products : [];
      const tenantUsers = tenantId ? usersByTenant.get(tenantId) || [] : [];
      const referral = referralsByUser.get(String(user.id));
      const sourceTrack = trackingByUser.get(String(user.id)) || (tenantId ? trackingByTenant.get(tenantId) : null);
      // referred_customers row gives us who actually referred this tenant
      const referredRow = tenantId ? referredByTenant.get(tenantId) : null;
      const promoCodeUsed = referredRow?.promo_code_used || referredRow?.referral_code_used ||
        sourceTrack?.promo_code_used || sourceTrack?.referral_code_used ||
        referral?.promo_code_used || referral?.referral_code ||
        user.referral_code_used || tenant?.promo_code_used || tenant?.referral_code_used || '';
      // Resolve affiliate from referred_customers or by promo code lookup
      const linkedAffiliate = referredRow?.affiliate_id
        ? affiliateById.get(String(referredRow.affiliate_id))
        : promoCodeUsed ? affiliateByPromo.get(promoCodeUsed.toUpperCase()) : null;
      const linkedPartner = referredRow?.parent_super_agent_id
        ? partnerById.get(String(referredRow.parent_super_agent_id))
        : null;
      const sourceType = (sourceTrack?.source_type || (promoCodeUsed ? 'sub_affiliate' : 'organic')) as SuperAdminUserRow['subscriberSourceType'];
      const rawSessions = sessionsByUser.get(String(user.id)) || [];
      const lastActivity = latestSessionActivity(rawSessions);
      const accountIsOnline = rawSessions.some((session) => isSessionOnline(session));
      const sessions = rawSessions.map((session) => {
        const loginAt = session.login_at ? new Date(session.login_at) : null;
        const logoutAt = session.logout_at ? new Date(session.logout_at) : null;
        const endAt = logoutAt || (session.last_activity_at ? new Date(session.last_activity_at) : null);
        const device: 'Phone' | 'Tablet' | 'Desktop' = String(session.device_label || '').includes('Mobile')
          ? 'Phone'
          : String(session.device_label || '').includes('Tablet')
            ? 'Tablet'
            : 'Desktop';
        return {
          loginTime: formatDateTime(session.login_at),
          logoutTime: session.logout_at ? formatDateTime(session.logout_at) : (isSessionOnline(session) ? 'Online now' : ''),
          durationMinutes: loginAt && endAt ? Math.max(0, Math.round((endAt.getTime() - loginAt.getTime()) / 60000)) : 0,
          device,
          ipAddress: session.ip_hint || '',
          location: tenant?.city || tenant?.country || ''
        };
      });

      const transactions = sales.slice(0, 20).map((sale: any) => ({
        id: String(sale.id || sale.saleNo || sale.receiptNo || 'sale'),
        date: formatDateTime(sale.date || sale.createdAt || sale.created_at),
        items: Array.isArray(sale.items) ? sale.items.map((item: any) => item.productName || item.name).filter(Boolean).join(', ') : 'Sale',
        amount: money(sale.total || sale.totalAmount || sale.amount),
        paymentMethod: sale.paymentMethod || sale.payment_method || 'Recorded sale'
      }));

      const totalSales = sales.reduce((sum: number, sale: any) => sum + money(sale.total || sale.totalAmount || sale.amount), 0);
      const totalExpenses = expenses.reduce((sum: number, expense: any) => sum + money(expense.amount || expense.total), 0);
      const costOfGoods = sales.reduce((sum: number, sale: any) => {
        if (!Array.isArray(sale.items)) return sum;
        return sum + sale.items.reduce((itemSum: number, item: any) => itemSum + money(item.costPriceAtSale || item.costPrice) * money(item.qty || item.quantity || 1), 0);
      }, 0);

      return {
        id: String(user.id),
        tenantId,
        tenantName: tenant?.name || 'No tenant',
        name: user.name || tenant?.name || user.email || 'Unnamed user',
        username: user.username_phone || user.phone || user.email || '',
        email: user.email || '',
        phone: user.phone || user.username_phone || '',
        referralSource: (promoCodeUsed ? 'affiliate' : 'direct') as SuperAdminUserRow['referralSource'],
        referringAffiliate: promoCodeUsed || undefined,
        referringAffiliateName: linkedAffiliate?.display_name || linkedAffiliate?.name || undefined,
        referringPartnerName: linkedPartner?.name || linkedPartner?.display_name || undefined,
        subscriberSourceType: sourceType,
        promoCodeUsed: promoCodeUsed || undefined,
        referralCodeUsed: sourceTrack?.referral_code_used || referral?.referral_code || user.referral_code_used || undefined,
        subAffiliateId: sourceTrack?.sub_affiliate_id || referral?.sub_affiliate_id || null,
        subscriptionPlan: getTenantPlan(tenant),
        paymentStatus: getPaymentStatus(tenant, user),
        paymentMethod: readTenantSettings(tenant)?.paymentMethod || 'Not recorded',
        dateCreated: formatDate(user.created_at || tenant?.created_at),
        status: (user.is_active === false ? 'Suspended' : 'Active') as SuperAdminUserRow['status'],
        ...resolveLocation(tenant, user),
        // Last activity is the latest cloud heartbeat, not tenant metadata or
        // the time at which an old session originally logged in.
        lastActivity,
        lastActivityLabel: activityLabel(lastActivity, accountIsOnline),
        // Subscription dates
        trialStartDate: user.trial_start_date || tenant?.trial_start_date || undefined,
        trialEndDate: user.trial_end_date || tenant?.trial_end_date || tenant?.trial_ends_at || undefined,
        subscriptionStartDate: tenant?.subscription_start_date || undefined,
        subscriptionEndDate: tenant?.subscription_end_date || undefined,
        subscriptionStatus: tenant?.subscription_status || readTenantSettings(tenant)?.subscriptionStatus || 'unknown',
        sessions,
        transactions,
        reports: [{
          month: 'Current workspace',
          profit: Math.max(0, totalSales - totalExpenses - costOfGoods),
          taxCollected: Math.round(totalSales * money(tenant?.tax_rate || 0)),
          expenseTotal: totalExpenses
        }],
        stockRecords: products.slice(0, 50).map((product: any) => ({
          id: String(product.id),
          name: product.name || 'Product',
          sku: product.sku || '',
          stockQty: money(product.stockQty),
          alertQty: money(product.alertQty)
        })),
        downlines: tenantUsers
          .filter((tenantUser) => tenantUser.id !== user.id)
          .map((tenantUser) => ({
            name: tenantUser.name || tenantUser.email || 'Staff',
            role: tenantUser.role_key || tenantUser.role || 'Staff',
            status: ((sessionsByUser.get(String(tenantUser.id)) || []).some((session) => isSessionOnline(session)) ? 'online' : 'offline') as 'online' | 'offline'
          })),
        messages: [],
        paymentHistory: []
      };
    });

  const representedTenantIds = new Set(mappedUsers.map((user) => user.tenantId).filter(Boolean).map(String));
  const syntheticTenantUsers: SuperAdminUserRow[] = realTenants
    .filter((tenant) => tenant?.id && !representedTenantIds.has(String(tenant.id)))
    .map((tenant) => {
      const tenantId = String(tenant.id);
      const sourceTrack = trackingByTenant.get(tenantId);
      const referredRow = referredByTenant.get(tenantId);
      const promoCodeUsed = referredRow?.promo_code_used || referredRow?.referral_code_used ||
        sourceTrack?.promo_code_used || sourceTrack?.referral_code_used ||
        tenant?.promo_code_used || tenant?.referral_code_used || '';
      const linkedAffiliate = referredRow?.affiliate_id
        ? affiliateById.get(String(referredRow.affiliate_id))
        : promoCodeUsed ? affiliateByPromo.get(String(promoCodeUsed).toUpperCase()) : null;
      const linkedPartner = referredRow?.parent_super_agent_id
        ? partnerById.get(String(referredRow.parent_super_agent_id))
        : null;
      const tenantAccountSessions = safeOverview.sessions.filter((session) => String(session.tenant_id || '') === tenantId);
      const lastActivity = latestSessionActivity(tenantAccountSessions);
      const tenantIsOnline = tenantAccountSessions.some((session) => isSessionOnline(session));

      return {
        id: `tenant-${tenantId}`,
        tenantId,
        tenantName: tenant.name || tenant.business_name || 'Subscriber tenant',
        name: tenant.owner_name || tenant.contact_name || tenant.name || tenant.business_name || 'Subscriber tenant',
        username: tenant.phone || tenant.owner_phone || '',
        email: tenant.owner_email || tenant.email || '',
        phone: tenant.owner_phone || tenant.phone || '',
        referralSource: (promoCodeUsed ? 'affiliate' : 'direct') as SuperAdminUserRow['referralSource'],
        referringAffiliate: promoCodeUsed || undefined,
        referringAffiliateName: linkedAffiliate?.display_name || linkedAffiliate?.name || undefined,
        referringPartnerName: linkedPartner?.name || linkedPartner?.display_name || undefined,
        subscriberSourceType: (sourceTrack?.source_type || (promoCodeUsed ? 'sub_affiliate' : 'organic')) as SuperAdminUserRow['subscriberSourceType'],
        promoCodeUsed: promoCodeUsed || undefined,
        referralCodeUsed: sourceTrack?.referral_code_used || tenant.referral_code_used || undefined,
        subAffiliateId: sourceTrack?.sub_affiliate_id || null,
        subscriptionPlan: getTenantPlan(tenant),
        paymentStatus: getPaymentStatus(tenant, {}),
        paymentMethod: readTenantSettings(tenant)?.paymentMethod || 'Not recorded',
        dateCreated: formatDate(tenant.created_at),
        status: (tenant.is_active === false ? 'Suspended' : 'Active') as SuperAdminUserRow['status'],
        ...resolveLocation(tenant, {}),
        lastActivity,
        lastActivityLabel: activityLabel(lastActivity, tenantIsOnline),
        trialStartDate: tenant?.trial_start_date || undefined,
        trialEndDate: tenant?.trial_end_date || tenant?.trial_ends_at || undefined,
        subscriptionStartDate: tenant?.subscription_start_date || undefined,
        subscriptionEndDate: tenant?.subscription_end_date || undefined,
        subscriptionStatus: tenant?.subscription_status || readTenantSettings(tenant)?.subscriptionStatus || 'unknown',
        sessions: [],
        transactions: [],
        reports: [{
          month: 'Current workspace',
          profit: 0,
          taxCollected: 0,
          expenseTotal: 0
        }],
        stockRecords: [],
        downlines: [],
        messages: [],
        paymentHistory: []
      };
    });

  return [...mappedUsers, ...syntheticTenantUsers];
}

export function buildSuperAdminMetrics(overview: SuperAdminOverview): SuperAdminMetrics {
  const safeOverview = normalizeOverview(overview || EMPTY_SUPER_ADMIN_OVERVIEW);
  const realTenants = safeOverview.tenants.filter(isRealSubscriberTenant);
  const users = mapSuperAdminUsers(safeOverview);
  const paidSubscriptionRevenue = safeOverview.referredCustomers
    .filter((row) => isSettledPaymentStatus(row.payment_status || row.status))
    .reduce((sum, row) => sum + money(row.amount_paid || row.amount), 0);
  const paidTrackedRevenue = safeOverview.sourceTracking
    .filter((row) => isSettledPaymentStatus(row.payment_status || row.status))
    .reduce((sum, row) => sum + money(row.revenue_generated || row.amount_paid || row.amount), 0);
  const paidCommissionRevenue = safeOverview.commissions
    .filter((row) => (
      isSettledPaymentStatus(row.payment_status)
      || isEarnedCommissionStatus(row.commission_status)
      || isEarnedCommissionStatus(row.status)
    ))
    .reduce((sum, row) => sum + money(row.gross_revenue || row.amount_paid || row.amount), 0);
  const platformRevenue = paidSubscriptionRevenue || paidTrackedRevenue || paidCommissionRevenue;
  const affiliatePayouts = safeOverview.payouts
    .filter((row) => isPaidPayoutStatus(row.status || row.payment_status))
    .reduce((sum, row) => sum + money(row.amount || row.net_payout || row.payout_amount), 0);
  const expenses = 0;
  const planCounts = new Map<string, number>();
  users.forEach((user) => planCounts.set(user.subscriptionPlan, (planCounts.get(user.subscriptionPlan) || 0) + 1));

  const monthMap = new Map<string, Record<string, string | number>>();
  users.forEach((user) => {
    const label = monthLabel(user.dateCreated);
    const row = monthMap.get(label) || { name: label };
    row[user.subscriptionPlan] = Number(row[user.subscriptionPlan] || 0) + 1;
    monthMap.set(label, row);
  });

  const growthMap = new Map<string, { name: string; Organic: number; Affiliate: number }>();
  users.forEach((user) => {
    const label = monthLabel(user.dateCreated);
    const row = growthMap.get(label) || { name: label, Organic: 0, Affiliate: 0 };
    if (user.referralSource === 'affiliate') row.Affiliate += 1;
    else row.Organic += 1;
    growthMap.set(label, row);
  });

  const colors = ['#34d399', '#60a5fa', '#f87171', '#f59e0b', '#a78bfa', '#22d3ee'];

  return {
    subscribersCount: realTenants.length,
    activeTenants: realTenants.filter((tenant) => tenant.is_active !== false).length,
    activeSessions: buildSuperAdminOnlinePresence(safeOverview).length,
    totalIncome: platformRevenue,
    affiliatePayouts,
    expenses,
    balance: platformRevenue - affiliatePayouts - expenses,
    monthlyUsersByPackage: Array.from(monthMap.values()),
    packageDistribution: Array.from(planCounts.entries()).map(([name, value], index) => ({ name, value, color: colors[index % colors.length] })),
    organicVsAffiliate: Array.from(growthMap.values())
  };
}

export function mapSuperAdminStaff(overview: SuperAdminOverview) {
  const safeOverview = normalizeOverview(overview);
  return safeOverview.users
    .filter((user) => user.role_key === 'super_admin_staff' || (user.is_saas_staff && user.role_key !== 'super_admin'))
    .map((user) => ({
      id: String(user.id),
      name: user.name || user.email || 'SaaS staff',
      email: user.email || '',
      password: '',
      role: 'SuperAdmin' as const,
      tenantId: 'platform-control',
      activeTenant: 'platform-control',
      isSaaSStaff: true,
      profileImage: user.profile_image_url || '',
      saasPermissions: user.role_permissions || {}
    }));
}
