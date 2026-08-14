import React, { useEffect, useRef, useState } from 'react';
import { useJasperNotifications } from '../JasperNotificationContext';
import { Save, Bell, Clock, Calendar, AlertTriangle, User } from 'lucide-react';
import { JasperModuleNotificationSettings } from '../types';

interface DashboardNotificationsSettingsProps {
  tenantId?: string;
  moduleName?: string;
  moduleLabel?: string;
  persistedSettings?: JasperModuleNotificationSettings;
  onPersistSettings?: (settings: JasperModuleNotificationSettings) => void | boolean | Promise<boolean>;
}

export const DashboardNotificationsSettings: React.FC<DashboardNotificationsSettingsProps> = ({
  tenantId = 'default-tenant',
  moduleName = 'wholesale-retail',
  moduleLabel = 'Wholesale & Retail',
  persistedSettings,
  onPersistSettings,
}) => {
  const { getModuleSettings, updateModuleSettings } = useJasperNotifications();
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const draftTouchedRef = useRef(false);
  const settingsScopeRef = useRef(`${tenantId}:${moduleName}`);

  const activeMeta = { id: moduleName, label: moduleLabel };

  const localSettings = getModuleSettings(tenantId, activeMeta.id);
  const [settings, setSettings] = useState<JasperModuleNotificationSettings>(() => ({
    ...localSettings,
    ...(persistedSettings || {}),
    tenantId,
    moduleName: activeMeta.id,
  }));

  useEffect(() => {
    const nextScope = `${tenantId}:${activeMeta.id}`;
    if (settingsScopeRef.current !== nextScope) {
      settingsScopeRef.current = nextScope;
      draftTouchedRef.current = false;
    }
    if (draftTouchedRef.current) return;
    setSettings({
      ...getModuleSettings(tenantId, activeMeta.id),
      ...(persistedSettings || {}),
      tenantId,
      moduleName: activeMeta.id,
    });
  }, [tenantId, activeMeta.id, persistedSettings]);

  const update = (updates: Partial<JasperModuleNotificationSettings>) => {
    setError(null);
    draftTouchedRef.current = true;
    setSettings(current => ({
      ...current,
      ...updates,
      tenantId,
      moduleName: activeMeta.id,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleSave = async () => {
    setError(null);
    const updated = {
      ...settings,
      enableInApp: true,
      enableWhatsapp: false,
      enableEmail: false,
      enableSms: false,
      enablePush: false,
      tenantId,
      moduleName: activeMeta.id,
      updatedAt: new Date().toISOString(),
    };
    const saved = await onPersistSettings?.(updated);
    if (saved === false) {
      setError('Notification settings could not be saved safely. Previous saved values were kept.');
      return;
    }
    updateModuleSettings(tenantId, activeMeta.id, updated);
    setSettings(updated);
    draftTouchedRef.current = false;
    setSaveStatus(activeMeta.label + ' notification settings saved.');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const reportToggle = (key: keyof Pick<JasperModuleNotificationSettings, 'enableSaleNotifications' | 'enableMorningSummary' | 'enableEndDayProfitLoss' | 'enableEndDayExpenses' | 'enableWeeklySummary' | 'enableMonthlySummary' | 'enableLowStockAlerts' | 'enablePriceAlerts' | 'enableCashAlerts' | 'enableLossWarnings'>, title: string, desc?: string) => (
    <label className="flex items-start space-x-3 cursor-pointer p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-slate-300 transition-colors">
      <input type="checkbox" checked={!!settings[key]} onChange={e => update({ [key]: e.target.checked } as Partial<JasperModuleNotificationSettings>)} className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
      <div>
        <span className="font-bold text-slate-800 block text-sm">{title}</span>
        {desc && <span className="text-xs text-slate-500 block">{desc}</span>}
      </div>
    </label>
  );

  return (
    <div className="settings-native-section bg-white rounded-3xl border border-slate-200 p-6 space-y-8 shadow-sm text-sm">
      <div className="border-b border-slate-100 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center">
            <Bell className="w-4 h-4 mr-2" /> Notifications & Auto Reports
          </h3>
          <p className="text-xs text-slate-500 font-sans mt-1">
            Choose the reports and alerts the Tenant Admin receives inside Orvix.
          </p>
        </div>
        <button onClick={handleSave} className="flex items-center space-x-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-colors">
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </div>

      {saveStatus && (
        <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold flex items-center">
          <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
          {saveStatus}
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-bold flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleSave}
        className="xl:hidden w-full flex items-center justify-center space-x-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-colors"
      >
        <Save className="w-4 h-4" />
        <span>Save Alert Settings</span>
      </button>

      <section className="space-y-4">
        <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center"><User className="w-4 h-4 mr-2" /> 1. Report Receiver Details - {activeMeta.label}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Receiver name</label>
            <input value={settings.receiverName} onChange={e => update({ receiverName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none focus:border-slate-400 text-sm" placeholder="Owner or manager name" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Role / position (optional)</label>
            <input value={settings.receiverRole || ''} onChange={e => update({ receiverRole: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none focus:border-slate-400 text-sm" placeholder="Owner, manager, pharmacist..." />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2">2. Notification Channels</h4>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-bold text-emerald-800">In-app notifications</p>
          <p className="mt-1 text-xs text-emerald-700">Alerts stay securely inside the Tenant Admin workspace. External messaging channels are disabled.</p>
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2">3. Report Schedule</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center"><Clock className="w-3 h-3 mr-1" /> Morning summary time</label>
            <input type="time" value={settings.morningSummaryTime} onChange={e => update({ morningSummaryTime: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center"><Clock className="w-3 h-3 mr-1" /> End-of-day report time</label>
            <input type="time" value={settings.endDayReportTime} onChange={e => update({ endDayReportTime: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center"><Calendar className="w-3 h-3 mr-1" /> Weekly summary day</label>
            <select value={settings.weeklySummaryDay} onChange={e => update({ weeklySummaryDay: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => <option key={day} value={day}>{day}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center"><Calendar className="w-3 h-3 mr-1" /> Monthly summary day</label>
            <select value={settings.monthlySummaryDay} onChange={e => update({ monthlySummaryDay: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none">
              <option value="1">1st day of month</option>
              <option value="last">Last day of month</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Timezone</label>
            <input value={settings.timezone} onChange={e => update({ timezone: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none" placeholder="Africa/Dar_es_Salaam" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2">4. Report Types</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {reportToggle('enableSaleNotifications', 'Every sale notification', 'Optional and OFF by default to avoid high message volume.')}
          {reportToggle('enableMorningSummary', 'Morning yesterday summary')}
          {reportToggle('enableEndDayProfitLoss', 'End-of-day profit & loss report')}
          {reportToggle('enableEndDayExpenses', 'End-of-day expenses report')}
          {reportToggle('enableWeeklySummary', 'Weekly summary')}
          {reportToggle('enableMonthlySummary', 'Monthly summary')}
          {reportToggle('enableLowStockAlerts', 'Low stock alerts')}
          {reportToggle('enablePriceAlerts', 'Price increase alerts')}
          {reportToggle('enableCashAlerts', 'Cash shortage alerts')}
          {reportToggle('enableLossWarnings', 'Loss warnings')}
        </div>
      </section>

    </div>
  );
};
