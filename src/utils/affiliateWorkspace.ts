import { getSecureDataBridgeClient } from '../secureDataBridge';
import { loadPlatformRecord } from './superAdminPlatformRecords';
import { isSettledPaymentStatus } from './financialStatus';

export type AffiliateTaskStatus = 'new' | 'pending' | 'completed' | 'reviewed';
export type AffiliateMeetingStatus = 'upcoming' | 'live' | 'completed' | 'cancelled';

export interface AffiliateWorkspaceProfile {
  id: string;
  user_id: string;
  display_name: string;
  referral_code: string;
  referral_slug: string;
  status: 'active' | 'suspended' | 'pending';
  payout_method: string | null;
  payout_account: string | null;
  profile_image_url: string | null;
  currency?: string | null;
  phone_whatsapp?: string | null;
}

export interface AffiliateTask {
  id: string;
  affiliate_id: string | null;
  group_id: string | null;
  assigned_by: string;
  sender_name: string | null;
  title: string;
  body: string | null;
  task_type: 'task' | 'note' | 'instruction';
  status: AffiliateTaskStatus;
  due_at: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_mime_type: string | null;
  created_at: string;
}

export interface AffiliateMeeting {
  id: string;
  title: string;
  host_name: string | null;
  notes: string | null;
  meeting_url: string;
  starts_at: string;
  ends_at: string | null;
  status: AffiliateMeetingStatus;
  created_at: string;
}

export interface AffiliateCampaign {
  id: string;
  campaign_name: string;
  title: string;
  description: string | null;
  recommended_caption: string | null;
  media_url: string;
  media_name: string | null;
  media_mime_type: string | null;
  media_size_bytes: number | null;
  duration_seconds: number | null;
  campaign_url: string | null;
  status: 'draft' | 'active' | 'archived';
  available_from: string | null;
  available_until: string | null;
}

export interface AffiliateReferral {
  id: string;
  status: 'clicked' | 'registered' | 'converted' | 'cancelled';
  created_at: string;
}

export interface AffiliateCommission {
  id: string;
  amount: number;
  gross_revenue: number;
  gross_commission: number;
  withholding_tax: number;
  net_payout: number;
  currency: string;
  status: 'pending' | 'available' | 'paid' | 'void';
  created_at: string;
  available_at: string | null;
  paid_at: string | null;
}

export interface AffiliateSubscriber {
  id: string;
  tenant_id: string | null;
  customer_name: string;
  owner_name: string | null;
  email: string | null;
  phone_number: string | null;
  location: string | null;
  region: string | null;
  package_id: string | null;
  package_name: string;
  amount_paid: number;
  payment_status: string;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  promo_code_used: string | null;
  referral_code_used: string | null;
  commission_amount: number;
  commission_status: string;
  status: 'active' | 'inactive';
  days_remaining: number;
  last_activity_at: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface AffiliatePayout {
  id: string;
  amount: number;
  currency: string;
  payout_method: string | null;
  payout_reference: string | null;
  status: 'requested' | 'processing' | 'paid' | 'rejected' | 'cancelled';
  requested_at: string;
  processed_at: string | null;
  notes: string | null;
}

export interface AffiliateActivityEvent {
  id: string;
  affiliate_id: string;
  event_type: 'referral_click' | 'ad_view' | 'ad_download' | 'campaign_link_copy' | 'task_download' | 'meeting_join';
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AffiliateWorkspaceData {
  profile: AffiliateWorkspaceProfile;
  tasks: AffiliateTask[];
  meetings: AffiliateMeeting[];
  campaigns: AffiliateCampaign[];
  referrals: AffiliateReferral[];
  subscribers: AffiliateSubscriber[];
  commissions: AffiliateCommission[];
  payouts: AffiliatePayout[];
  activities: AffiliateActivityEvent[];
}

export interface ManagedAffiliate {
  id: string;
  display_name: string;
  referral_code: string;
  status: 'active' | 'suspended' | 'pending';
}

export interface AffiliateAgentWorkspace {
  agentName: string;
  affiliates: ManagedAffiliate[];
}

const asArray = <T,>(value: T[] | null | undefined): T[] => value || [];

const daysUntil = (value?: string | null) => {
  if (!value) return 0;
  const end = new Date(value).getTime();
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24)));
};

const readablePackage = (value?: string | null) => {
  const plan = String(value || 'free').trim();
  if (!plan) return 'Free';
  const normalized = plan.toLowerCase();
  if (normalized === 'trial' || normalized === 'free_trial') return 'Free Trial';
  if (normalized === 'ruby') return 'Ruby';
  if (normalized === 'diamond') return 'Diamond';
  if (normalized === 'tanzanite') return 'Tanzanite';
  return plan;
};

const mapSubscriberRow = (row: any): AffiliateSubscriber => {
  const endDate = row.subscription_end_date || row.subscriptionEndDate || row.trial_ends_at || null;
  const recordedAmount = Number(row.amount_paid ?? row.amountPaid ?? 0);
  const daysRemaining = daysUntil(endDate);
  const paymentStatus = String(row.payment_status || row.paymentStatus || 'unpaid').toLowerCase();
  const paymentSettled = isSettledPaymentStatus(paymentStatus);
  const amountPaid = paymentSettled ? recordedAmount : 0;
  const recordedCommission = Number(row.commission_amount ?? row.commissionAmount ?? amountPaid * 0.15);
  const commission = paymentSettled ? recordedCommission : 0;
  const isActive = daysRemaining > 0 && !['failed', 'cancelled', 'inactive', 'expired'].includes(paymentStatus);

  return {
    id: String(row.id || row.tenant_id || row.tenantId || ''),
    tenant_id: row.tenant_id || row.tenantId || null,
    customer_name: row.customer_name || row.customerName || row.tenant_name || row.tenantName || row.business_name || row.name || 'Unnamed subscriber',
    owner_name: row.owner_name || row.ownerName || row.contact_name || row.admin_name || null,
    email: row.email || row.owner_email || row.customer_email || row.admin_email || null,
    phone_number: row.phone_number || row.phoneNumber || row.phone || null,
    location: row.location || row.city || row.region || row.country || null,
    region: row.region || row.city || row.location || null,
    package_id: row.package_id || row.packageId || row.active_package_id || null,
    package_name: readablePackage(row.package_name || row.packageName || row.package_id || row.packageId || row.active_package_id),
    amount_paid: amountPaid,
    payment_status: paymentStatus,
    subscription_start_date: row.subscription_start_date || row.subscriptionStartDate || row.created_at || row.createdAt || null,
    subscription_end_date: endDate,
    promo_code_used: row.promo_code_used || row.promoCodeUsed || null,
    referral_code_used: row.referral_code_used || row.referralCodeUsed || null,
    commission_amount: commission,
    commission_status: row.commission_status || row.commissionStatus || 'pending',
    status: isActive ? 'active' : 'inactive',
    days_remaining: daysRemaining,
    last_activity_at: row.last_activity_at || row.lastActivityAt || row.updated_at || row.updatedAt || null,
    last_login_at: row.last_login_at || row.lastLoginAt || null,
    created_at: row.created_at || row.createdAt || '',
  };
};

const mapSspBannerToCampaign = (banner: any): AffiliateCampaign | null => {
  if (!banner) return null;
  const status = String(banner.status || 'active').toLowerCase();
  if (status !== 'active' && status !== 'live') return null;

  const isMessage = banner.adType === 'message' || banner.category === 'Message Ad';
  const mediaUrl = banner.assetData || (isMessage && banner.message
    ? `data:text/plain;charset=utf-8,${encodeURIComponent(banner.message)}`
    : banner.url);

  if (!mediaUrl) return null;

  return {
    id: String(banner.id || `ssp-${banner.title || Date.now()}`),
    campaign_name: 'Ad Exchange SSP',
    title: banner.title || 'Promotional Material',
    description: banner.message || banner.description || null,
    recommended_caption: banner.message || null,
    media_url: mediaUrl,
    media_name: banner.creativeName || `${String(banner.title || 'promo-material').replace(/\s+/g, '-').toLowerCase()}.txt`,
    media_mime_type: banner.creativeMime || (isMessage ? 'text/plain' : null),
    media_size_bytes: banner.assetData ? Math.round(String(banner.assetData).length * 0.75) : null,
    duration_seconds: null,
    campaign_url: banner.url || null,
    status: 'active',
    available_from: null,
    available_until: null,
  };
};

export interface AffiliateWorkspaceLoadOptions {
  affiliateId?: string;
}

export async function loadAffiliateWorkspace(options: AffiliateWorkspaceLoadOptions = {}): Promise<AffiliateWorkspaceData | null> {
  const client: any = await getSecureDataBridgeClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData?.user) return null;

  let profileQuery = client
    .from('affiliates')
    .select('id, user_id, display_name, referral_code, promo_code, referral_slug, status, payout_method, payout_account, profile_image_url');
  profileQuery = options.affiliateId
    ? profileQuery.eq('id', options.affiliateId)
    : profileQuery.eq('user_id', authData.user.id);
  const { data: profile, error: profileError } = await profileQuery.maybeSingle();

  if (profileError) throw profileError;
  // Never turn a stale browser cache into an apparently active affiliate.
  // Missing live profile data must remain visible to the user/admin.
  if (!profile && !options.affiliateId) return null;
  if (!profile) return null;

  const requiredQuery = async (label: string, fn: () => Promise<any>) => {
    const result = await fn();
    if (result?.error) {
      throw new Error(`Live affiliate data source "${label}" is unavailable: ${result.error.message || 'database error'}`);
    }
    return result;
  };
  const optionalQuery = async (label: string, fn: () => Promise<any>) => {
    const result = await fn();
    if (result?.error) {
      console.warn(`[Affiliate workspace] Optional data source "${label}" is unavailable:`, result.error.message || 'database error');
      return { data: [] };
    }
    return result;
  };

  const promoCode = profile.promo_code || profile.referral_code || '';
  const affiliateScope = `affiliate_id.eq.${profile.id}`;
  const ownReferralScope = [
    `affiliate_id.eq.${profile.id}`,
    `sub_affiliate_id.eq.${profile.id}`,
    promoCode ? `promo_code_used.eq.${promoCode}` : '',
    promoCode ? `referral_code_used.eq.${promoCode}` : '',
  ].filter(Boolean).join(',');

  const [tasksResult, meetingsResult, assignmentsResult, sspBanners, referralsResult, subscribersResult, sourceTrackingResult, commissionsResult, payoutsResult, activitiesResult] = await Promise.all([
    requiredQuery('affiliate_tasks', () => client.from('affiliate_tasks').select('*').eq('affiliate_id', profile.id).order('created_at', { ascending: false }).limit(50)),
    requiredQuery('affiliate_meetings', () => client.from('affiliate_meetings').select('*').eq('affiliate_id', profile.id).order('starts_at', { ascending: true }).limit(50)),
    requiredQuery('affiliate_ad_assignments', () => client.from('affiliate_ad_assignments').select('campaign:affiliate_ad_campaigns(*)').eq('affiliate_id', profile.id).order('created_at', { ascending: false }).limit(50)),
    loadPlatformRecord<any[]>('promotional_banners', 'global', []),
    requiredQuery('affiliate_referrals', () => client.from('affiliate_referrals').select('id, status, created_at').or(affiliateScope).order('created_at', { ascending: false }).limit(500)),
    ownReferralScope
      ? optionalQuery('referred_customers', () => client.from('referred_customers').select('*').or(ownReferralScope).order('created_at', { ascending: false }).limit(1000))
      : Promise.resolve({ data: [] }),
    requiredQuery('subscriber_source_tracking', () => client.from('subscriber_source_tracking').select('*').or(ownReferralScope).order('created_at', { ascending: false }).limit(1000)),
    requiredQuery('affiliate_commissions', () => client.from('affiliate_commissions').select('id, amount, gross_revenue, gross_commission, withholding_tax, net_payout, currency, status, created_at, available_at, paid_at').eq('affiliate_id', profile.id).order('created_at', { ascending: false }).limit(500)),
    requiredQuery('affiliate_payouts', () => client.from('affiliate_payouts').select('id, amount, currency, payout_method, payout_reference, status, requested_at, processed_at, notes').eq('affiliate_id', profile.id).order('requested_at', { ascending: false }).limit(100)),
    requiredQuery('affiliate_activity_events', () => client.from('affiliate_activity_events').select('*').eq('affiliate_id', profile.id).order('created_at', { ascending: false }).limit(200)),
  ]);

  const assignedCampaigns = asArray<any>(assignmentsResult.data)
    .map((assignment) => assignment.campaign)
    .filter(Boolean)
    .filter((campaign, index, all) => all.findIndex((candidate) => candidate.id === campaign.id) === index) as AffiliateCampaign[];
  const sspCampaigns = asArray<any>(sspBanners)
    .map(mapSspBannerToCampaign)
    .filter(Boolean) as AffiliateCampaign[];
  const campaigns = [...assignedCampaigns, ...sspCampaigns]
    .filter((campaign, index, all) => all.findIndex((candidate) => candidate.id === campaign.id) === index);
  const subscribers = [
    ...asArray<any>(subscribersResult.data).map(mapSubscriberRow),
    ...asArray<any>(sourceTrackingResult.data).map(mapSubscriberRow),
  ].filter((subscriber, index, all) => (
    all.findIndex((candidate) => (
      (candidate.tenant_id && candidate.tenant_id === subscriber.tenant_id) ||
      candidate.id === subscriber.id
    )) === index
  ));

  return {
    profile: profile as AffiliateWorkspaceProfile,
    tasks: asArray<AffiliateTask>(tasksResult.data),
    meetings: asArray<AffiliateMeeting>(meetingsResult.data),
    campaigns,
    referrals: asArray<AffiliateReferral>(referralsResult.data),
    subscribers,
    commissions: asArray<AffiliateCommission>(commissionsResult.data).map((commission) => ({
      ...commission,
      amount: Number(commission.amount),
      gross_revenue: Number(commission.gross_revenue),
      gross_commission: Number(commission.gross_commission),
      withholding_tax: Number(commission.withholding_tax),
      net_payout: Number(commission.net_payout),
    })),
    payouts: asArray<AffiliatePayout>(payoutsResult.data).map((payout) => ({
      ...payout,
      amount: Number(payout.amount),
    })),
    activities: asArray<AffiliateActivityEvent>(activitiesResult.data),
  };
}

export async function completeAffiliateTask(taskId: string) {
  const client: any = await getSecureDataBridgeClient();
  const { data, error } = await client.rpc('complete_affiliate_task', { p_task_id: taskId });
  if (error) throw error;
  return data as AffiliateTask;
}

export async function recordAffiliateActivity(
  eventType: 'ad_view' | 'ad_download' | 'campaign_link_copy' | 'task_download' | 'meeting_join',
  resourceType: string,
  resourceId: string,
) {
  const client: any = await getSecureDataBridgeClient();
  const { error } = await client.rpc('record_affiliate_activity', {
    p_event_type: eventType,
    p_resource_type: resourceType,
    p_resource_id: resourceId,
  });
  if (error) throw error;
}

export async function loadAffiliateAgentWorkspace(): Promise<AffiliateAgentWorkspace | null> {
  const client: any = await getSecureDataBridgeClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData?.user) return null;

  const [{ data: profile, error: profileError }, { data: partnerProfile }, { data: assignments, error: assignmentError }] = await Promise.all([
    client.from('users').select('name').eq('id', authData.user.id).maybeSingle(),
    client.from('affiliate_partners').select('id, display_name, promo_code').eq('user_id', authData.user.id).maybeSingle(),
    client.from('affiliate_agent_assignments')
      .select('affiliate:affiliates(id, display_name, referral_code, promo_code, status)')
      .eq('agent_user_id', authData.user.id)
      .is('ended_at', null)
      .order('assigned_at', { ascending: false }),
  ]);
  if (profileError || assignmentError) throw profileError || assignmentError;
  const affiliates = asArray<any>(assignments)
    .map((assignment) => assignment.affiliate)
    .filter(Boolean)
    .filter((affiliate, index, all) => all.findIndex((candidate) => candidate.id === affiliate.id) === index) as ManagedAffiliate[];
  return { agentName: partnerProfile?.display_name || profile?.name || authData.user.email || 'Agent', affiliates };
}

export async function createAffiliateTask(input: {
  affiliateId: string;
  senderName: string;
  title: string;
  body?: string;
  taskType: 'task' | 'note' | 'instruction';
  dueAt?: string;
  attachmentUrl?: string;
  attachmentName?: string;
}) {
  const client: any = await getSecureDataBridgeClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData?.user) throw new Error('Sign in is required.');
  const { data, error } = await client.from('affiliate_tasks').insert({
    affiliate_id: input.affiliateId,
    assigned_by: authData.user.id,
    sender_name: input.senderName,
    title: input.title,
    body: input.body || null,
    task_type: input.taskType,
    due_at: input.dueAt || null,
    attachment_url: input.attachmentUrl || null,
    attachment_name: input.attachmentName || null,
  }).select().single();
  if (error) throw error;
  return data as AffiliateTask;
}

export async function createAffiliateMeeting(input: {
  affiliateId: string;
  hostName: string;
  title: string;
  notes?: string;
  meetingUrl: string;
  startsAt: string;
}) {
  const client: any = await getSecureDataBridgeClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData?.user) throw new Error('Sign in is required.');
  const { data, error } = await client.from('affiliate_meetings').insert({
    affiliate_id: input.affiliateId,
    created_by: authData.user.id,
    host_name: input.hostName,
    title: input.title,
    notes: input.notes || null,
    meeting_url: input.meetingUrl,
    starts_at: input.startsAt,
  }).select().single();
  if (error) throw error;
  return data as AffiliateMeeting;
}
