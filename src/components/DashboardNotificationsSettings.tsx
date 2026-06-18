import React, { useState } from 'react';
import { useJasperNotifications } from '../JasperNotificationContext';
import { Save, Bell, Clock, Calendar, AlertTriangle } from 'lucide-react';

export const DashboardNotificationsSettings: React.FC = () => {
  const { settings, updateSettings } = useJasperNotifications();
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  if (!settings) return null;

  const handleModuleToggle = (mod: string) => {
    let newMods = [...settings.enabledModules];
    if (mod === 'all') {
      newMods = ['all'];
    } else {
      if (newMods.includes('all')) newMods = [];
      if (newMods.includes(mod)) {
        newMods = newMods.filter(m => m !== mod);
      } else {
        newMods.push(mod);
      }
    }
    updateSettings({ enabledModules: newMods });
  };

  const handleSave = () => {
    setSaveStatus('Settings updated successfully!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const testTrigger = () => {
    // Just a placeholder for testing
    alert("Test notification would be generated here.");
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-8 shadow-sm text-sm">
      <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center">
             <Bell className="w-4 h-4 mr-2" /> Global Notifications & Auto Reports
          </h3>
          <p className="text-xs text-slate-500 font-sans mt-1">
             Configure automated business reports and smart alerts for the owner.
          </p>
        </div>
        <button onClick={handleSave} className="flex items-center space-x-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-colors">
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </div>

      {saveStatus && (
         <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold flex items-center">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
            {saveStatus}
         </div>
      )}

      {/* A. Owner Contacts */}
      <div className="space-y-4">
        <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2">A. Owner Contact Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Phone Number</label>
            <input type="tel" value={settings.ownerPhone} onChange={e => updateSettings({ ownerPhone: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none focus:border-slate-400 text-sm" placeholder="+255..." />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">WhatsApp Number (Optional)</label>
            <input type="tel" value={settings.ownerWhatsapp || ''} onChange={e => updateSettings({ ownerWhatsapp: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none focus:border-slate-400 text-sm" placeholder="+255..." />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Email Address (Optional)</label>
            <input type="email" value={settings.ownerEmail || ''} onChange={e => updateSettings({ ownerEmail: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none focus:border-slate-400 text-sm" placeholder="owner@business.com" />
          </div>
        </div>
      </div>

      {/* B. Channels */}
      <div className="space-y-4">
        <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2">B. Delivery Channels</h4>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" checked={settings.enableInApp} onChange={e => updateSettings({ enableInApp: e.target.checked })} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="font-medium text-slate-700">In-App Alerts</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" checked={settings.enableEmail} onChange={e => updateSettings({ enableEmail: e.target.checked })} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="font-medium text-slate-700">Email</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" checked={settings.enableSms} onChange={e => updateSettings({ enableSms: e.target.checked })} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="font-medium text-slate-700">SMS</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" checked={settings.enableWhatsapp} onChange={e => updateSettings({ enableWhatsapp: e.target.checked })} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="font-medium text-slate-700">WhatsApp</span>
          </label>
           <label className="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" checked={settings.enablePush} onChange={e => updateSettings({ enablePush: e.target.checked })} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="font-medium text-slate-700">Push Notifications</span>
          </label>
        </div>
      </div>

      {/* C. Modules */}
      <div className="space-y-4">
        <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2">C. Active Modules to Report</h4>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
            <input type="checkbox" checked={settings.enabledModules.includes('all')} onChange={() => handleModuleToggle('all')} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="font-medium text-slate-700">All Modules</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
            <input type="checkbox" checked={settings.enabledModules.includes('all') || settings.enabledModules.includes('wholesale')} onChange={() => handleModuleToggle('wholesale')} disabled={settings.enabledModules.includes('all')} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="font-medium text-slate-700">Wholesale & Retail</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
            <input type="checkbox" checked={settings.enabledModules.includes('all') || settings.enabledModules.includes('microsoko')} onChange={() => handleModuleToggle('microsoko')} disabled={settings.enabledModules.includes('all')} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="font-medium text-slate-700">MicroSoko</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
            <input type="checkbox" checked={settings.enabledModules.includes('all') || settings.enabledModules.includes('pharmacy')} onChange={() => handleModuleToggle('pharmacy')} disabled={settings.enabledModules.includes('all')} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="font-medium text-slate-700">Pharmacy</span>
          </label>
        </div>
      </div>

      {/* D. Auto Reports */}
      <div className="space-y-4">
        <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2">D. Automated Reports</h4>
        <div className="space-y-3">
          <label className="flex items-start space-x-3 cursor-pointer p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-slate-300 transition-colors">
            <input type="checkbox" checked={settings.enableSaleNotifications} onChange={e => updateSettings({ enableSaleNotifications: e.target.checked })} className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <div>
               <span className="font-bold text-slate-800 block text-sm">Every Sale Notification (Real-time)</span>
               <span className="text-xs text-slate-500 block">Sends an alert immediately after every sale is completed. May cause high volume of messages.</span>
            </div>
          </label>

          <label className="flex items-start space-x-3 cursor-pointer p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-slate-300 transition-colors">
            <input type="checkbox" checked={settings.enableMorningSummary} onChange={e => updateSettings({ enableMorningSummary: e.target.checked })} className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <div>
               <span className="font-bold text-slate-800 block text-sm">Morning Yesterday Summary</span>
               <span className="text-xs text-slate-500 block">Sends a quick brief of yesterday's business every morning.</span>
            </div>
          </label>

          <label className="flex items-start space-x-3 cursor-pointer p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-slate-300 transition-colors">
            <input type="checkbox" checked={settings.enableEndDayProfitLoss} onChange={e => updateSettings({ enableEndDayProfitLoss: e.target.checked })} className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <div>
               <span className="font-bold text-slate-800 block text-sm">End-of-Day Profit & Loss Report</span>
               <span className="text-xs text-slate-500 block">Sends a detailed P&L snapshot at the end of every business day.</span>
            </div>
          </label>

          <label className="flex items-start space-x-3 cursor-pointer p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-slate-300 transition-colors">
            <input type="checkbox" checked={settings.enableEndDayExpenses} onChange={e => updateSettings({ enableEndDayExpenses: e.target.checked })} className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <div>
               <span className="font-bold text-slate-800 block text-sm">End-of-Day Expenses Report</span>
               <span className="text-xs text-slate-500 block">Outlines business expenses spent each day.</span>
            </div>
          </label>

          <label className="flex items-start space-x-3 cursor-pointer p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-slate-300 transition-colors">
            <input type="checkbox" checked={settings.enableWeeklySummary} onChange={e => updateSettings({ enableWeeklySummary: e.target.checked })} className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <div>
               <span className="font-bold text-slate-800 block text-sm">Weekly Business Summary</span>
               <span className="text-xs text-slate-500 block">Comprehensive weekly business metrics and trends.</span>
            </div>
          </label>

          <label className="flex items-start space-x-3 cursor-pointer p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-slate-300 transition-colors">
            <input type="checkbox" checked={settings.enableMonthlySummary} onChange={e => updateSettings({ enableMonthlySummary: e.target.checked })} className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <div>
               <span className="font-bold text-slate-800 block text-sm">Monthly Business Summary</span>
               <span className="text-xs text-slate-500 block">Full monthly report covering total sales, expenses, and insights.</span>
            </div>
          </label>
        </div>
      </div>

      {/* E. Schedule Settings */}
      <div className="space-y-4">
        <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2">E. Report Schedule & Timings</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center"><Clock className="w-3 h-3 mr-1"/> Morning Summary Time</label>
            <input type="time" value={settings.morningSummaryTime} onChange={e => updateSettings({ morningSummaryTime: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center"><Clock className="w-3 h-3 mr-1"/> End-of-Day Time</label>
            <input type="time" value={settings.endDayReportTime} onChange={e => updateSettings({ endDayReportTime: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center"><Calendar className="w-3 h-3 mr-1"/> Weekly Run Day</label>
            <select value={settings.weeklySummaryDay} onChange={e => updateSettings({ weeklySummaryDay: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none">
                <option value="Monday">Monday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
                <option value="Sunday">Sunday</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center"><Calendar className="w-3 h-3 mr-1"/> Monthly Run Day</label>
            <select value={settings.monthlySummaryDay} onChange={e => updateSettings({ monthlySummaryDay: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none">
                <option value="1">1st of the month</option>
                <option value="last">Last day of the month</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Test Engine */}
      <div className="space-y-4 border-t border-slate-100 pt-6">
         <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start space-x-3">
             <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
             <div className="text-amber-800 text-xs leading-relaxed space-y-2">
                 <p className="font-bold text-sm">Testing Global Logic Workflow</p>
                 <p>In-app notifications work immediately. External bindings to Email/SMS wait on platform credential configuration. All reporting logic operates off your selected timezone: <strong>{settings.timezone}</strong>.</p>
                 <button onClick={testTrigger} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors">
                    Send Test Notification
                 </button>
             </div>
         </div>
      </div>

    </div>
  );
};
