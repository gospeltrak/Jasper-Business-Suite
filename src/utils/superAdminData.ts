import { getSecureDataBridgeClient } from '../secureDataBridge';

export interface SuperAdminOverview {
  tenants: any[];
  users: any[];
  workspaces: any[];
  sessions: any[];
  affiliates: any[];
  referrals: any[];
  sourceTracking: any[];
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
  referringAffiliate?: string;
  subscriberSourceType?: 'organic' | 'organic_affiliate' | 'sub_affiliate' | 'unknown' | 'untracked';
  promoCodeUsed?: string;
  referralCodeUsed?: string;
  subAffiliateId?: string | null;
  subscriptionPlan: string;
  paymentStatus: 'Paid' | 'Unpaid' | 'Grace Period' | 'Overdue';
  paymentMethod: string;
  dateCreated: string;
  status: 'Active' | 'Suspended' | 'Expired';
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
  referrals: [],
  sourceTracking: [],
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
  referrals: Array.isArray(overview?.referrals) ? overview.referrals : [],
  sourceTracking: Array.isArray(overview?.sourceTracking) ? overview.sourceTracking : [],
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
  const overview = normalizeOverview(await apiRequest('/api/super-admin/overview'));

  try {
    const localTenants = JSON.parse(localStorage.getItem('jasper_custom_tenants') || '[]');
    const localUsers = JSON.parse(localStorage.getItem('jasper_custom_users') || '[]');
    const tenantIds = new Set(overview.tenants.map((tenant) => String(tenant.id)));
    const userIds = new Set(overview.users.map((user) => String(user.id)));
    const mergedTenants = [
      ...overview.tenants,
      ...localTenants
        .filter((tenant: any) => tenant?.id && !tenantIds.has(String(tenant.id)))
        .map((tenant: any) => ({
          id: tenant.id,
          name: tenant.name,
          country: tenant.country,
          city: tenant.city,
          currency: tenant.currency,
          currency_code: tenant.currencyCode || tenant.currency_code,
          tax_rate: tenant.taxRate ?? tenant.tax_rate,
          business_type: tenant.businessType || tenant.business_type,
          subscription_plan: tenant.activePackageId || tenant.selectedPackageId || 'trial',
          subscription_status: tenant.subscriptionStatus || 'trial',
          created_at: tenant.subscriptionStartDate || new Date().toISOString(),
        }))
    ];
    const mergedUsers = [
      ...overview.users,
      ...localUsers
        .filter((user: any) => user?.id && !userIds.has(String(user.id)))
        .map((user: any) => ({
          id: user.id,
          tenant_id: user.tenantId || user.tenant_id || user.activeTenant,
          active_tenant: user.activeTenant || user.tenantId,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role || 'Admin',
          role_key: String(user.role || 'Admin').toLowerCase(),
          account_type: user.is_affiliate_lead ? 'subscriber' : 'tenant_owner',
          is_active: true,
          created_at: user.trial_start_date || new Date().toISOString(),
          referral_code_used: user.referral_code_used,
        }))
    ];
    return { ...overview, tenants: mergedTenants, users: mergedUsers };
  } catch {
    return overview;
  }
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
  const usersByTenant = new Map<string, any[]>();
  safeOverview.users.forEach((user) => {
    if (!user.tenant_id) return;
    const key = String(user.tenant_id);
    usersByTenant.set(key, [...(usersByTenant.get(key) || []), user]);
  });

  return safeOverview.users
    .filter((user) => user.account_type !== 'super_admin' && user.account_type !== 'affiliate' && user.account_type !== 'partner')
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
      const promoCodeUsed = sourceTrack?.promo_code_used || sourceTrack?.referral_code_used || referral?.promo_code_used || referral?.referral_code || user.referral_code_used || '';
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
        subscriberSourceType: sourceType,
        promoCodeUsed: promoCodeUsed || undefined,
        referralCodeUsed: sourceTrack?.referral_code_used || referral?.referral_code || user.referral_code_used || undefined,
        subAffiliateId: sourceTrack?.sub_affiliate_id || referral?.sub_affiliate_id || null,
        subscriptionPlan: getTenantPlan(tenant),
        paymentStatus: getPaymentStatus(tenant, user),
        paymentMethod: readTenantSettings(tenant)?.paymentMethod || 'Not recorded',
        dateCreated: formatDate(user.created_at || tenant?.created_at),
        status: user.is_active === false ? 'Suspended' : 'Active',
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
}

export function buildSuperAdminMetrics(overview: SuperAdminOverview): SuperAdminMetrics {
  const safeOverview = normalizeOverview(overview || EMPTY_SUPER_ADMIN_OVERVIEW);
  const users = mapSuperAdminUsers(safeOverview);
  const totalWorkspaceRevenue = users.reduce((sum, user) => sum + user.transactions.reduce((sub, tx) => sub + tx.amount, 0), 0);
  const affiliateRevenue = safeOverview.commissions.reduce((sum, row) => sum + money(row.gross_revenue), 0);
  const affiliatePayouts = safeOverview.commissions.reduce((sum, row) => sum + money(row.net_payout || row.amount), 0);
  const expenses = users.reduce((sum, user) => sum + user.reports.reduce((sub, report) => sub + report.expenseTotal, 0), 0);
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
    subscribersCount: users.length,
    activeTenants: safeOverview.tenants.length,
    activeSessions: safeOverview.sessions.filter((session) => session.is_active).length,
    totalIncome: totalWorkspaceRevenue + affiliateRevenue,
    affiliatePayouts,
    expenses,
    balance: totalWorkspaceRevenue + affiliateRevenue - affiliatePayouts - expenses,
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
