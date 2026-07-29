import React, { useEffect, useRef, useState } from 'react';
import { useJasperNotifications } from '../JasperNotificationContext';
import { Save, Bell, Clock, Calendar, AlertTriangle, Send, User, MessageCircle } from 'lucide-react';
import { JasperModuleNotificationSettings } from '../types';

interface DashboardNotificationsSettingsProps {
  tenantId?: string;
  moduleName?: string;
  moduleLabel?: string;
  persistedSettings?: JasperModuleNotificationSettings;
  onPersistSettings?: (settings: JasperModuleNotificationSettings) => void | boolean | Promise<boolean>;
}

const validateWhatsapp = (value: string) => /^\+[1-9]\d{8,14}$/.test(value.trim());

export const DashboardNotificationsSettings: React.FC<DashboardNotificationsSettingsProps> = ({
  tenantId = 'default-tenant',
  moduleName = 'wholesale-retail',
  moduleLabel = 'Wholesale & Retail',
  persistedSettings,
  onPersistSettings,
}) => {
  const { getModuleSettings, updateModuleSettings, sendTestModuleWhatsappReport } = useJasperNotifications();
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

  const validate = () => {
    if (settings.enableWhatsapp && !validateWhatsapp(settings.whatsappNumber)) {
      setError('Please enter WhatsApp number with country code, example +255712345678.');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setError(null);
    const updated = {
      ...settings,
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

  const handleTest = () => {
    if (!validate()) return;
    const result = sendTestModuleWhatsappReport(tenantId, activeMeta.id, activeMeta.label);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSaveStatus(result.message);
    setTimeout(() => setSaveStatus(null), 4000);
  };

  const channelToggle = (key: keyof Pick<JasperModuleNotificationSettings, 'enableInApp' | 'enableWhatsapp'>, label: string) => (
    <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
      <input type="checkbox" checked={!!settings[key]} onChange={e => update({ [key]: e.target.checked } as Partial<JasperModuleNotificationSettings>)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
      <span className="font-semibold text-slate-700 text-xs">{label}</span>
    </label>
  );

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
            Configure report receiver, In-app notifications, WhatsApp reports, schedules, and alert types.
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Receiver name</label>
            <input value={settings.receiverName} onChange={e => update({ receiverName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none focus:border-slate-400 text-sm" placeholder="Owner or manager name" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">WhatsApp Number for Reports</label>
            <input type="tel" value={settings.whatsappNumber} onChange={e => update({ whatsappNumber: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none focus:border-slate-400 text-sm" placeholder="Example: +255712345678" />
            <p className="text-[10px] text-slate-400 mt-1">This number will receive {activeMeta.label} reports and notifications.</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Backup WhatsApp number (optional)</label>
            <input type="tel" value={settings.backupWhatsappNumber || ''} onChange={e => update({ backupWhatsappNumber: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none focus:border-slate-400 text-sm" placeholder="+255..." />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Role / position (optional)</label>
            <input value={settings.receiverRole || ''} onChange={e => update({ receiverRole: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none focus:border-slate-400 text-sm" placeholder="Owner, manager, pharmacist..." />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2">2. Notification Channels</h4>
        <div className="flex flex-wrap gap-3">
          {channelToggle('enableInApp', 'In-app notification')}
          {channelToggle('enableWhatsapp', 'WhatsApp')}
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

      <section className="space-y-4 border-t border-slate-100 pt-6">
        <h4 className="font-bold text-slate-800 flex items-center"><MessageCircle className="w-4 h-4 mr-2" /> 5. Test Notification</h4>
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-amber-800 text-xs leading-relaxed space-y-3">
            <p>Send a test WhatsApp report for {activeMeta.label}. If no WhatsApp provider is configured, the test will be saved as an in-app notification.</p>
            <button onClick={handleTest} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors flex items-center space-x-2">
              <Send className="w-4 h-4" />
              <span>Send Test WhatsApp Report</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
