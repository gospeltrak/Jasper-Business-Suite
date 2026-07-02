import { useEffect, useState } from 'react';
import { loadPlatformRecord, savePlatformRecord } from './superAdminPlatformRecords';

export interface GlobalAdPlacementSettings {
  dashboardAdCode: string;
  dashboardAdEnabled: boolean;
  bottomAdCode: string;
  bottomAdEnabled: boolean;
}

export const AD_SETTINGS_EVENT = 'jasper_ad_code_updated';

const DEFAULT_AD_SETTINGS: GlobalAdPlacementSettings = {
  dashboardAdCode: '',
  dashboardAdEnabled: true,
  bottomAdCode: '',
  bottomAdEnabled: true,
};

const LEGACY_KEYS = {
  dashboardAdCode: 'jasper_dashboard_ad_code',
  dashboardAdEnabled: 'jasper_dashboard_ad_enabled',
  bottomAdCode: 'jasper_bottom_ad_code',
  bottomAdEnabled: 'jasper_bottom_ad_enabled',
};

function readLegacySettings(): GlobalAdPlacementSettings {
  return {
    dashboardAdCode: localStorage.getItem(LEGACY_KEYS.dashboardAdCode) || '',
    dashboardAdEnabled: localStorage.getItem(LEGACY_KEYS.dashboardAdEnabled) !== 'false',
    bottomAdCode: localStorage.getItem(LEGACY_KEYS.bottomAdCode) || '',
    bottomAdEnabled: localStorage.getItem(LEGACY_KEYS.bottomAdEnabled) !== 'false',
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
    return () => {
      alive = false;
      window.removeEventListener(AD_SETTINGS_EVENT, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return settings;
}
