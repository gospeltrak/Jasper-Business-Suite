import { getSecureDataBridgeClient } from '../secureDataBridge';

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

const apiRequest = async (path: string, init: RequestInit = {}) => {
  const client = await getSecureDataBridgeClient();
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) throw new Error('Super Admin login is required.');

  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(init.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'Super Admin request failed.');
  return payload;
};

export async function loadSuperAdminOverview(): Promise<SuperAdminOverview> {
  let overview: SuperAdminOverview = { ...EMPTY_SUPER_ADMIN_OVERVIEW };

  // Try API first (uses service role via Bearer token)
  try {
    overview = normalizeOverview(await apiRequest('/api/super-admin/overview'));
  } catch (apiErr: any) {
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
        client.from('user_sessions').select('*').order('login_time', { ascending: false }),
        client.from('affiliates').select('*').order('created_at', { ascending: false }),
        client.from('affiliate_partners').select('*').order('created_at', { ascending: false }),
        client.from('affiliate_referrals').select('*').order('created_at', { ascending: false }),
        client.from('affiliate_source_tracking').select('*').order('created_at', { ascending: false }),
        client.from('referred_customers').select('*').order('created_at', { ascending: false }),
        client.from('affiliate_commissions').select('*').order('created_at', { ascending: false }),
        client.from('affiliate_payouts').select('*').order('requested_at', { ascending: false }),
      ]);
      if (!tenantsRes.error && !usersRes.error) {
        overview = normalizeOverview({
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
      }
    } catch (clientErr: any) {
      console.warn('[SuperAdmin] Direct client fallback also failed:', clientErr?.message);
    }
  }

  return overview;
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

const money = (value: unknown) => Number(value || 0);
const formatDate = (value: unknown) => value ? new Date(String(value)).toISOString().slice(0, 10) : '';
const formatDateTime = (value: unknown) => value ? new Date(String(value)).toISOString().replace('T', ' ').slice(0, 16) : '';
const isPositivePaymentStatus = (value: unknown) => {
  const status = String(value || '').trim().toLowerCase();
  return ['paid', 'success', 'successful', 'completed', 'approved', 'active', 'verified'].some((token) => status.includes(token));
};
const isPlatformUser = (user: any) => {
  const accountType = String(user?.account_type || '').toLowerCase();
  const roleKey = String(user?.role_key || user?.role || '').toLowerCase();
  return accountType === 'super_admin' || accountType === 'affiliate' || accountType === 'partner' || roleKey === 'super_admin' || Boolean(user?.is_saas_staff);
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
  const status = String(settings?.paymentStatus || user?.payment_status || tenant?.payment_status || '').toLowerCase();
  if (status.includes('overdue')) return 'Overdue';
  if (status.includes('grace')) return 'Grace Period';
  if (status.includes('unpaid')) return 'Unpaid';
  return 'Paid';
};

const monthLabel = (value: unknown) => {
  const date = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en', { month: 'short' });
};

const activityLabel = (iso: string | null | undefined): string => {
  if (!iso) return 'Never';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return `${Math.floor(diff / 30)}mo ago`;
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
  const tenantById = new Map(safeOverview.tenants.map((tenant) => [String(tenant.id), tenant]));
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

  const mappedUsers = safeOverview.users
    .filter((user) => !isPlatformUser(user))
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
      const sessions = (sessionsByUser.get(String(user.id)) || []).map((session) => {
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
          logoutTime: session.logout_at ? formatDateTime(session.logout_at) : (session.is_active ? 'Online now' : ''),
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
        referralSource: promoCodeUsed ? 'affiliate' : 'direct',
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
        status: user.is_active === false ? 'Suspended' : 'Active',
        ...resolveLocation(tenant, user),
        // Last activity — from sessions, workspace data, or user record
        lastActivity: (() => {
          const latestSession = (sessionsByUser.get(String(user.id)) || [])
            .filter(s => s.login_at)
            .sort((a, b) => new Date(b.login_at).getTime() - new Date(a.login_at).getTime())[0];
          return user.last_activity_at || user.last_login_at || latestSession?.login_at || '';
        })(),
        lastActivityLabel: activityLabel(
          user.last_activity_at || user.last_login_at ||
          (sessionsByUser.get(String(user.id)) || [])
            .filter((s: any) => s.login_at)
            .sort((a: any, b: any) => new Date(b.login_at).getTime() - new Date(a.login_at).getTime())[0]?.login_at
        ),
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
            status: (sessionsByUser.get(String(tenantUser.id)) || []).some((session) => session.is_active) ? 'online' : 'offline'
          })),
        messages: [],
        paymentHistory: []
      };
    });

  const representedTenantIds = new Set(mappedUsers.map((user) => user.tenantId).filter(Boolean).map(String));
  const syntheticTenantUsers: SuperAdminUserRow[] = safeOverview.tenants
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
      const lastActivity = tenant.updated_at || tenant.created_at || '';

      return {
        id: `tenant-${tenantId}`,
        tenantId,
        tenantName: tenant.name || tenant.business_name || 'Subscriber tenant',
        name: tenant.owner_name || tenant.contact_name || tenant.name || tenant.business_name || 'Subscriber tenant',
        username: tenant.phone || tenant.owner_phone || '',
        email: tenant.owner_email || tenant.email || '',
        phone: tenant.owner_phone || tenant.phone || '',
        referralSource: promoCodeUsed ? 'affiliate' : 'direct',
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
        status: tenant.is_active === false ? 'Suspended' : 'Active',
        ...resolveLocation(tenant, {}),
        lastActivity,
        lastActivityLabel: activityLabel(lastActivity),
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
  const users = mapSuperAdminUsers(safeOverview);
  const paidSubscriptionRevenue = safeOverview.referredCustomers
    .filter((row) => isPositivePaymentStatus(row.payment_status || row.status))
    .reduce((sum, row) => sum + money(row.amount_paid || row.amount || row.package_price), 0);
  const paidTrackedRevenue = safeOverview.sourceTracking
    .filter((row) => isPositivePaymentStatus(row.payment_status || row.subscription_status || row.status))
    .reduce((sum, row) => sum + money(row.revenue_generated || row.amount_paid || row.amount), 0);
  const paidCommissionRevenue = safeOverview.commissions
    .filter((row) => isPositivePaymentStatus(row.payment_status || row.commission_status || row.status))
    .reduce((sum, row) => sum + money(row.gross_revenue || row.amount_paid || row.amount), 0);
  const platformRevenue = paidSubscriptionRevenue || paidTrackedRevenue || paidCommissionRevenue;
  const affiliatePayouts = safeOverview.payouts
    .filter((row) => isPositivePaymentStatus(row.status || row.payment_status))
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
    subscribersCount: safeOverview.tenants.length || users.length,
    activeTenants: safeOverview.tenants.length,
    activeSessions: safeOverview.sessions.filter((session) => session.is_active).length,
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
