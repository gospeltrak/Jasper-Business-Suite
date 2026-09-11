import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSecureDataBridgeClient } from '../secureDataBridge';
import { loadPlatformRecord, savePlatformRecord } from './superAdminPlatformRecords';

export interface GlobalAdPlacementSettings {
  dashboardAdCode: string;
  dashboardAdEnabled: boolean;
  bottomAdCode: string;
  bottomAdEnabled: boolean;
}

export const AD_SETTINGS_EVENT = 'jasper_ad_code_updated';

export const SAMPLE_HORIZONTAL_AD_CODE = `
<div style="width:100%;max-width:728px;min-height:90px;margin:0 auto;box-sizing:border-box;border:1px solid rgba(16,185,129,0.35);border-radius:14px;background:linear-gradient(90deg,#07111f 0%,#0f766e 48%,#16a34a 100%);color:#ffffff;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 18px;overflow:hidden;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="min-width:0;">
    <p style="margin:0 0 3px;font-size:10px;line-height:1.2;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;opacity:0.75;">Sample 728x90 Ad Placement</p>
    <p style="margin:0;font-size:20px;line-height:1.05;font-weight:950;">Grow faster with Orvix</p>
    <p style="margin:4px 0 0;font-size:12px;line-height:1.25;opacity:0.86;">POS, inventory, reports and Lucy AI in one business system.</p>
  </div>
  <a href="https://jasper-business-suite.vercel.app" target="_blank" rel="noopener noreferrer" style="flex:0 0 auto;border-radius:999px;background:#ffffff;color:#065f46;padding:9px 13px;font-size:12px;line-height:1;font-weight:900;text-decoration:none;white-space:nowrap;">Open Orvix</a>
</div>
`.trim();

export const SAMPLE_STICKY_AD_CODE = `
<div style="width:100%;max-width:760px;margin:0 auto;box-sizing:border-box;border:1px solid rgba(168,85,247,0.35);border-radius:16px;background:linear-gradient(90deg,#111827 0%,#581c87 48%,#7c3aed 100%);color:#ffffff;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 16px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 18px 42px rgba(88,28,135,0.28);">
  <div style="min-width:0;">
    <p style="margin:0 0 3px;font-size:10px;line-height:1.2;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;opacity:0.72;">Sample Sticky Bottom Ad</p>
    <p style="margin:0;font-size:16px;line-height:1.15;font-weight:950;">Lucy AI + business reports are ready</p>
    <p style="margin:3px 0 0;font-size:11px;line-height:1.25;opacity:0.82;">Upgrade to manage sales, stock and insights from one dashboard.</p>
  </div>
  <a href="https://jasper-business-suite.vercel.app" target="_blank" rel="noopener noreferrer" style="flex:0 0 auto;border-radius:999px;background:#ffffff;color:#581c87;padding:9px 12px;font-size:11px;line-height:1;font-weight:900;text-decoration:none;white-space:nowrap;">View Plans</a>
</div>
`.trim();

const DEFAULT_AD_SETTINGS: GlobalAdPlacementSettings = {
  dashboardAdCode: '',
  dashboardAdEnabled: false,
  bottomAdCode: '',
  bottomAdEnabled: false,
};

const LEGACY_KEYS = {
  dashboardAdCode: 'jasper_dashboard_ad_code',
  dashboardAdEnabled: 'jasper_dashboard_ad_enabled',
  bottomAdCode: 'jasper_bottom_ad_code',
  bottomAdEnabled: 'jasper_bottom_ad_enabled',
};

function readLegacySettings(): GlobalAdPlacementSettings {
  const dashboardAdCode = onlineStorage.getItem(LEGACY_KEYS.dashboardAdCode);
  const dashboardAdEnabled = onlineStorage.getItem(LEGACY_KEYS.dashboardAdEnabled);
  const bottomAdCode = onlineStorage.getItem(LEGACY_KEYS.bottomAdCode);
  const bottomAdEnabled = onlineStorage.getItem(LEGACY_KEYS.bottomAdEnabled);

  return {
    dashboardAdCode: dashboardAdCode === null ? DEFAULT_AD_SETTINGS.dashboardAdCode : dashboardAdCode,
    dashboardAdEnabled: dashboardAdEnabled === null ? DEFAULT_AD_SETTINGS.dashboardAdEnabled : dashboardAdEnabled === 'true',
    bottomAdCode: bottomAdCode === null ? DEFAULT_AD_SETTINGS.bottomAdCode : bottomAdCode,
    bottomAdEnabled: bottomAdEnabled === null ? DEFAULT_AD_SETTINGS.bottomAdEnabled : bottomAdEnabled === 'true',
  };
}

function cacheLegacySettings(settings: GlobalAdPlacementSettings) {
  onlineStorage.setItem(LEGACY_KEYS.dashboardAdCode, settings.dashboardAdCode || '');
  onlineStorage.setItem(LEGACY_KEYS.dashboardAdEnabled, String(settings.dashboardAdEnabled));
  onlineStorage.setItem(LEGACY_KEYS.bottomAdCode, settings.bottomAdCode || '');
  onlineStorage.setItem(LEGACY_KEYS.bottomAdEnabled, String(settings.bottomAdEnabled));
}

export async function loadGlobalAdSettings(): Promise<GlobalAdPlacementSettings> {
  const legacy = readLegacySettings();
  const fallback = {
    ...DEFAULT_AD_SETTINGS,
    dashboardAdCode: legacy.dashboardAdCode,
    bottomAdCode: legacy.bottomAdCode,
  };
  const settings = await loadPlatformRecord<GlobalAdPlacementSettings>('global_ad_placement', 'global', fallback);
  const normalized = { ...DEFAULT_AD_SETTINGS, ...settings };
  cacheLegacySettings(normalized);
  return normalized;
}

export async function saveGlobalAdSettings(settings: GlobalAdPlacementSettings): Promise<GlobalAdPlacementSettings> {
  const normalized = { ...DEFAULT_AD_SETTINGS, ...settings };
  const saved = await savePlatformRecord('global_ad_placement', 'global', normalized);
  cacheLegacySettings(saved);
  window.dispatchEvent(new Event(AD_SETTINGS_EVENT));
  return saved;
}

export function notifyGlobalAdSettingsChanged() {
  window.dispatchEvent(new Event(AD_SETTINGS_EVENT));
}

// Shared singleton state: every useGlobalAdSettings() consumer used to run its
// own effect + interval + fetch independently (4 mount sites, each polling on
// its own 5-minute timer, whether ads were on or off). This module now
// fetches once per session and fans the result out to every subscriber, and
// live updates come from a single shared Supabase Realtime subscription
// (postgres_changes on the ad-placement row) instead of polling at all --
// the database is touched once at mount, plus once whenever an admin
// actually changes the setting. RLS grants read on just this one record type
// to authenticated users (it was already public, unauthenticated, via the
// REST fallback endpoint below).
let sharedAdSettings: GlobalAdPlacementSettings = { ...DEFAULT_AD_SETTINGS };
const adSettingsSubscribers = new Set<(settings: GlobalAdPlacementSettings) => void>();
let adSettingsInFlight: Promise<void> | null = null;
let adSettingsListenersActive = false;
let adSettingsChannel: RealtimeChannel | null = null;

function applyAdSettingsPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return;
  const next = { ...DEFAULT_AD_SETTINGS, ...(payload as Partial<GlobalAdPlacementSettings>) };
  sharedAdSettings = next;
  cacheLegacySettings(next);
  adSettingsSubscribers.forEach((notify) => notify(next));
}

function refreshSharedAdSettings() {
  if (adSettingsInFlight) return adSettingsInFlight;
  adSettingsInFlight = loadGlobalAdSettings()
    .then((next) => {
      sharedAdSettings = next;
      adSettingsSubscribers.forEach((notify) => notify(next));
    })
    .finally(() => {
      adSettingsInFlight = null;
    });
  return adSettingsInFlight;
}

async function startAdSettingsRealtimeChannel() {
  if (adSettingsChannel) return;
  try {
    const client: any = await getSecureDataBridgeClient();
    const url = client?.supabaseUrl || '';
    if (!url || url.includes('placeholder-url')) return;
    adSettingsChannel = client
      .channel('global-ad-placement')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'super_admin_platform_records', filter: 'record_type=eq.global_ad_placement' },
        (event: any) => applyAdSettingsPayload(event.new?.payload)
      )
      .subscribe();
  } catch {
    // No realtime this session (offline, placeholder client, etc.) -- the
    // focus/save triggers below still keep this reasonably fresh.
  }
}

function stopAdSettingsRealtimeChannel() {
  if (!adSettingsChannel) return;
  const channel = adSettingsChannel;
  adSettingsChannel = null;
  void getSecureDataBridgeClient().then((client: any) => client.removeChannel(channel)).catch(() => undefined);
}

function startSharedAdSettingsRefreshIfNeeded() {
  if (!adSettingsListenersActive) {
    adSettingsListenersActive = true;
    window.addEventListener(AD_SETTINGS_EVENT, refreshSharedAdSettings);
    window.addEventListener('focus', refreshSharedAdSettings);
    void startAdSettingsRealtimeChannel();
  }
  void refreshSharedAdSettings();
}

function stopSharedAdSettingsRefreshIfIdle() {
  if (adSettingsSubscribers.size > 0) return;
  if (adSettingsListenersActive) {
    window.removeEventListener(AD_SETTINGS_EVENT, refreshSharedAdSettings);
    window.removeEventListener('focus', refreshSharedAdSettings);
    adSettingsListenersActive = false;
  }
  stopAdSettingsRealtimeChannel();
}

export function useGlobalAdSettings() {
  const [settings, setSettings] = useState<GlobalAdPlacementSettings>(() => sharedAdSettings);

  useEffect(() => {
    adSettingsSubscribers.add(setSettings);
    startSharedAdSettingsRefreshIfNeeded();
    // Pick up whatever the shared cache already has in case another consumer
    // fetched it before this one mounted.
    setSettings(sharedAdSettings);
    return () => {
      adSettingsSubscribers.delete(setSettings);
      stopSharedAdSettingsRefreshIfIdle();
    };
  }, []);

  return settings;
}

export function canShowDashboardAd(settings: GlobalAdPlacementSettings) {
  return Boolean(settings.dashboardAdEnabled && settings.dashboardAdCode?.trim());
}

export function canShowStickyBottomAd(settings: GlobalAdPlacementSettings) {
  return Boolean(
    settings.dashboardAdEnabled &&
    settings.bottomAdEnabled &&
    settings.bottomAdCode?.trim()
  );
}
