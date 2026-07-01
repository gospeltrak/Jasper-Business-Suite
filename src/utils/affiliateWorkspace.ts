import { getDynamicSupabaseClient } from '../supabaseClient';

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

export async function loadAffiliateWorkspace(): Promise<AffiliateWorkspaceData | null> {
  const client: any = await getDynamicSupabaseClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData?.user) return null;

  const { data: profile, error: profileError } = await client
    .from('affiliates')
    .select('id, user_id, display_name, referral_code, promo_code, referral_slug, status, payout_method, payout_account, profile_image_url')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) return null;

  const safeQuery = async (fn: () => Promise<any>) => {
    try { const r = await fn(); return r.error ? { data: [] } : r; } catch { return { data: [] }; }
  };

  const [tasksResult, meetingsResult, assignmentsResult, referralsResult, commissionsResult, payoutsResult, activitiesResult] = await Promise.all([
    safeQuery(() => client.from('affiliate_tasks').select('*').order('created_at', { ascending: false }).limit(50)),
    safeQuery(() => client.from('affiliate_meetings').select('*').order('starts_at', { ascending: true }).limit(50)),
    safeQuery(() => client.from('affiliate_ad_assignments').select('campaign:affiliate_ad_campaigns(*)').order('created_at', { ascending: false }).limit(50)),
    safeQuery(() => client.from('affiliate_referrals').select('id, status, created_at').order('created_at', { ascending: false }).limit(500)),
    safeQuery(() => client.from('affiliate_commissions').select('id, amount, gross_revenue, gross_commission, withholding_tax, net_payout, currency, status, created_at, available_at, paid_at').order('created_at', { ascending: false }).limit(500)),
    safeQuery(() => client.from('affiliate_payouts').select('id, amount, currency, payout_method, payout_reference, status, requested_at, processed_at, notes').order('requested_at', { ascending: false }).limit(100)),
    safeQuery(() => client.from('affiliate_activity_events').select('*').order('created_at', { ascending: false }).limit(200)),
  ]);

  const campaigns = asArray<any>(assignmentsResult.data)
    .map((assignment) => assignment.campaign)
    .filter(Boolean)
    .filter((campaign, index, all) => all.findIndex((candidate) => candidate.id === campaign.id) === index) as AffiliateCampaign[];

  return {
    profile: profile as AffiliateWorkspaceProfile,
    tasks: asArray<AffiliateTask>(tasksResult.data),
    meetings: asArray<AffiliateMeeting>(meetingsResult.data),
    campaigns,
    referrals: asArray<AffiliateReferral>(referralsResult.data),
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
  const client: any = await getDynamicSupabaseClient();
  const { data, error } = await client.rpc('complete_affiliate_task', { p_task_id: taskId });
  if (error) throw error;
  return data as AffiliateTask;
}

export async function recordAffiliateActivity(
  eventType: 'ad_view' | 'ad_download' | 'campaign_link_copy' | 'task_download' | 'meeting_join',
  resourceType: string,
  resourceId: string,
) {
  const client: any = await getDynamicSupabaseClient();
  const { error } = await client.rpc('record_affiliate_activity', {
    p_event_type: eventType,
    p_resource_type: resourceType,
    p_resource_id: resourceId,
  });
  if (error) throw error;
}

export async function loadAffiliateAgentWorkspace(): Promise<AffiliateAgentWorkspace | null> {
  const client: any = await getDynamicSupabaseClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData?.user) return null;

  const [{ data: profile, error: profileError }, { data: assignments, error: assignmentError }] = await Promise.all([
    client.from('users').select('name').eq('id', authData.user.id).maybeSingle(),
    client.from('affiliate_agent_assignments').select('affiliate:affiliates(id, display_name, referral_code, status)').is('ended_at', null).order('assigned_at', { ascending: false }),
  ]);
  if (profileError || assignmentError) throw profileError || assignmentError;
  const affiliates = asArray<any>(assignments)
    .map((assignment) => assignment.affiliate)
    .filter(Boolean)
    .filter((affiliate, index, all) => all.findIndex((candidate) => candidate.id === affiliate.id) === index) as ManagedAffiliate[];
  return { agentName: profile?.name || authData.user.email || 'Agent', affiliates };
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
  const client: any = await getDynamicSupabaseClient();
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
  const client: any = await getDynamicSupabaseClient();
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
