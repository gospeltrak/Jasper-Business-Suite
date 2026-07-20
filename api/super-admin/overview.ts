import { createClient } from '@supabase/supabase-js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, max-age=0',
};

export default async function handler(req: any, res: any) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeaders(CORS_HEADERS).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get env vars
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase service role not configured on server.' });
  }

  // Verify caller is a SuperAdmin using their JWT
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  // Use anon client to verify the user's JWT
  const anonClient = createClient(supabaseUrl, anonKey || serviceRoleKey);
  const { data: authData, error: authError } = await anonClient.auth.getUser(token);
  if (authError || !authData?.user) {
    return res.status(401).json({ error: 'Invalid session.' });
  }

  // Use service role to check user's platform role (bypasses RLS)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: profile } = await adminClient
    .from('users')
    .select('id, account_type, role_key, role, is_active')
    .eq('id', authData.user.id)
    .maybeSingle();

  const accountType = String(profile?.account_type || '').toLowerCase();
  const roleKey = String(profile?.role_key || profile?.role || '').toLowerCase();
  const isPlatformAdmin =
    profile?.is_active &&
    (accountType === 'super_admin' ||
      ['superadmin', 'super_admin', 'admin'].includes(roleKey));

  if (!isPlatformAdmin) {
    return res.status(403).json({ error: 'Super Admin access required.' });
  }

  // Fetch all platform data using service role (bypasses RLS)
  const safe = async (query: Promise<any>) => {
    try {
      const { data, error } = await query;
      if (error) { console.warn('[SuperAdmin API]', error.message); return []; }
      return data || [];
    } catch (e: any) {
      console.warn('[SuperAdmin API] query failed:', e?.message);
      return [];
    }
  };

  const [
    tenants,
    users,
    workspaces,
    sessions,
    affiliates,
    affiliatePartners,
    referrals,
    sourceTracking,
    referredCustomers,
    commissions,
    payouts,
    auditLogs,
  ] = await Promise.all([
    safe(adminClient.from('tenants').select('*').order('name', { ascending: true })),
    safe(adminClient.from('users').select('*').order('name', { ascending: true })),
    safe(adminClient.from('tenant_workspaces').select('*')),
    safe(adminClient.from('user_sessions').select('*').order('login_time', { ascending: false }).limit(500)),
    safe(adminClient.from('affiliates').select('*').order('created_at', { ascending: false })),
    safe(adminClient.from('affiliate_partners').select('*').order('created_at', { ascending: false })),
    safe(adminClient.from('affiliate_referrals').select('*').order('created_at', { ascending: false }).limit(1000)),
    safe(adminClient.from('affiliate_source_tracking').select('*').order('created_at', { ascending: false }).limit(2000)),
    safe(adminClient.from('referred_customers').select('*').order('created_at', { ascending: false }).limit(2000)),
    safe(adminClient.from('affiliate_commissions').select('*').order('created_at', { ascending: false }).limit(1000)),
    safe(adminClient.from('affiliate_payouts').select('*').order('created_at', { ascending: false }).limit(1000)),
    safe(adminClient.from('super_admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(250).catch(() => ({ data: [], error: null }))),
  ]);

  return res.status(200).json({
    tenants,
    users,
    workspaces,
    sessions,
    affiliates,
    affiliatePartners,
    referrals,
    sourceTracking,
    referredCustomers,
    commissions,
    payouts,
    auditLogs,
  });
}
