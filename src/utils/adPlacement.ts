import { useEffect, useState } from 'react';
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
    <p style="margin:0;font-size:20px;line-height:1.05;font-weight:950;">Grow faster with Jasper Suite</p>
    <p style="margin:4px 0 0;font-size:12px;line-height:1.25;opacity:0.86;">POS, inventory, reports and Lucy AI in one business system.</p>
  </div>
  <a href="https://jasper-business-suite.vercel.app" target="_blank" rel="noopener noreferrer" style="flex:0 0 auto;border-radius:999px;background:#ffffff;color:#065f46;padding:9px 13px;font-size:12px;line-height:1;font-weight:900;text-decoration:none;white-space:nowrap;">Open Jasper</a>
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
  const dashboardAdCode = localStorage.getItem(LEGACY_KEYS.dashboardAdCode);
  const dashboardAdEnabled = localStorage.getItem(LEGACY_KEYS.dashboardAdEnabled);
  const bottomAdCode = localStorage.getItem(LEGACY_KEYS.bottomAdCode);
  const bottomAdEnabled = localStorage.getItem(LEGACY_KEYS.bottomAdEnabled);

  return {
    dashboardAdCode: dashboardAdCode === null ? DEFAULT_AD_SETTINGS.dashboardAdCode : dashboardAdCode,
    dashboardAdEnabled: dashboardAdEnabled === null ? DEFAULT_AD_SETTINGS.dashboardAdEnabled : dashboardAdEnabled !== 'false',
    bottomAdCode: bottomAdCode === null ? DEFAULT_AD_SETTINGS.bottomAdCode : bottomAdCode,
    bottomAdEnabled: bottomAdEnabled === null ? DEFAULT_AD_SETTINGS.bottomAdEnabled : bottomAdEnabled !== 'false',
  };
}

function cacheLegacySettings(settings: GlobalAdPlacementSettings) {
  localStorage.setItem(LEGACY_KEYS.dashboardAdCode, settings.dashboardAdCode || '');
  localStorage.setItem(LEGACY_KEYS.dashboardAdEnabled, String(settings.dashboardAdEnabled));
  localStorage.setItem(LEGACY_KEYS.bottomAdCode, settings.bottomAdCode || '');
  localStorage.setItem(LEGACY_KEYS.bottomAdEnabled, String(settings.bottomAdEnabled));
}

export async function loadGlobalAdSettings(): Promise<GlobalAdPlacementSettings> {
  const fallback = { ...DEFAULT_AD_SETTINGS, ...readLegacySettings() };
  const settings = await loadPlatformRecord<GlobalAdPlacementSettings>('global_ad_placement', 'global', fallback);
  const normalized = { ...DEFAULT_AD_SETTINGS, ...settings };
  cacheLegacySettings(normalized);
  return normalized;
}

export async function saveGlobalAdSettings(settings: GlobalAdPlacementSettings): Promise<GlobalAdPlacementSettings> {
  const normalized = { ...DEFAULT_AD_SETTINGS, ...settings };
  cacheLegacySettings(normalized);
  const saved = await savePlatformRecord('global_ad_placement', 'global', normalized);
  window.dispatchEvent(new Event(AD_SETTINGS_EVENT));
  return saved;
}

export function notifyGlobalAdSettingsChanged() {
  window.dispatchEvent(new Event(AD_SETTINGS_EVENT));
}

export function useGlobalAdSettings() {
  const [settings, setSettings] = useState<GlobalAdPlacementSettings>(() => ({ ...DEFAULT_AD_SETTINGS, ...readLegacySettings() }));

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      loadGlobalAdSettings().then((next) => {
        if (alive) setSettings(next);
      });
    };

    refresh();
    window.addEventListener(AD_SETTINGS_EVENT, refresh);
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 2000);
    return () => {
      alive = false;
      window.removeEventListener(AD_SETTINGS_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      window.clearInterval(interval);
    };
  }, []);

  return settings;
}
