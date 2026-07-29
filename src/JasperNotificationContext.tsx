import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { JasperNotificationSettings, JasperModuleNotificationSettings, JasperNotification, JasperScheduledReport } from './types';

interface NotificationContextProps {
  settings: JasperNotificationSettings | null;
  moduleSettings: JasperModuleNotificationSettings[];
  notifications: JasperNotification[];
  scheduledReports: JasperScheduledReport[];
  unreadCount: number;
  updateSettings: (newSettings: Partial<JasperNotificationSettings>) => void;
  getModuleSettings: (tenantId: string, moduleName: string) => JasperModuleNotificationSettings;
  updateModuleSettings: (tenantId: string, moduleName: string, updates: Partial<JasperModuleNotificationSettings>) => JasperModuleNotificationSettings;
  hydrateTenantModuleSettings: (tenantId: string, settings: JasperModuleNotificationSettings[]) => void;
  sendTestModuleWhatsappReport: (tenantId: string, moduleName: string, moduleLabel?: string) => { ok: boolean; message: string };
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addSaleNotification: (payload: {
    tenantId: string;
    moduleName: string;
    amount: number;
    profit?: number;
    paymentMethod: string;
    cashierName: string;
    itemsSummary?: string;
  }) => void;
}

const normalizeModuleName = (moduleName: string) => {
  const normalized = (moduleName || 'wholesale-retail').toLowerCase().trim();
  if (['retail', 'wholesale', 'wholesale-retail', 'wholesale & retail'].includes(normalized)) return 'wholesale-retail';
  if (normalized.includes('pharmacy')) return 'pharmacy';
  return normalized;
};

const defaultSettings: JasperNotificationSettings = {
  id: 'set-default',
  tenantId: '',
  ownerPhone: '',
  timezone: 'Africa/Dar_es_Salaam',
  enabledModules: ['all'],
  enableSaleNotifications: false,
  enableMorningSummary: true,
  enableEndDayProfitLoss: true,
  enableEndDayExpenses: true,
  enableWeeklySummary: true,
  enableMonthlySummary: true,
  morningSummaryTime: '07:00',
  endDayReportTime: '21:00',
  weeklySummaryDay: 'Monday',
  monthlySummaryDay: '1',
  enableInApp: true,
  enableEmail: false,
  enableSms: false,
  enableWhatsapp: false,
  enablePush: false
};

const createDefaultModuleSettings = (tenantId: string, moduleName: string, global?: JasperNotificationSettings | null): JasperModuleNotificationSettings => {
  const now = new Date().toISOString();
  const normalizedModule = normalizeModuleName(moduleName);
  return {
    id: (tenantId || 'global') + '-' + normalizedModule,
    tenantId,
    moduleName: normalizedModule,
    receiverName: '',
    receiverRole: '',
    whatsappNumber: global?.ownerWhatsapp || '',
    backupWhatsappNumber: '',
    emailAddress: global?.ownerEmail || '',
    smsPhoneNumber: global?.ownerPhone || '',
    timezone: global?.timezone || 'Africa/Dar_es_Salaam',
    enableInApp: global?.enableInApp ?? true,
    enableWhatsapp: global?.enableWhatsapp ?? false,
    enableEmail: global?.enableEmail ?? false,
    enableSms: global?.enableSms ?? false,
    enablePush: global?.enablePush ?? false,
    enableSaleNotifications: false,
    enableMorningSummary: global?.enableMorningSummary ?? true,
    enableEndDayProfitLoss: global?.enableEndDayProfitLoss ?? true,
    enableEndDayExpenses: global?.enableEndDayExpenses ?? true,
    enableWeeklySummary: global?.enableWeeklySummary ?? true,
    enableMonthlySummary: global?.enableMonthlySummary ?? true,
    enableLowStockAlerts: true,
    enablePriceAlerts: false,
    enableCashAlerts: false,
    enableLossWarnings: true,
    morningSummaryTime: global?.morningSummaryTime || '07:00',
    endDayReportTime: global?.endDayReportTime || '21:00',
    weeklySummaryDay: global?.weeklySummaryDay || 'Monday',
    monthlySummaryDay: global?.monthlySummaryDay || '1',
    createdAt: now,
    updatedAt: now
  };
};

const hasValidWhatsappNumber = (value: string) => /^\+[1-9]\d{8,14}$/.test(value.trim());

const NotificationContext = createContext<NotificationContextProps>({} as any);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<JasperNotificationSettings | null>(null);
  const [moduleSettings, setModuleSettings] = useState<JasperModuleNotificationSettings[]>([]);
  const [notifications, setNotifications] = useState<JasperNotification[]>([]);
  const [scheduledReports, setScheduledReports] = useState<JasperScheduledReport[]>([]);

  useEffect(() => {
    const rawSettings = onlineStorage.getItem('jasper_notification_settings');
    const rawModuleSettings = onlineStorage.getItem('jasper_module_notification_settings');
    const rawNotifs = onlineStorage.getItem('jasper_notifications');
    const rawReports = onlineStorage.getItem('jasper_scheduled_reports');

    if (rawSettings) setSettings(JSON.parse(rawSettings));
    if (rawModuleSettings) setModuleSettings(JSON.parse(rawModuleSettings));
    if (rawNotifs) setNotifications(JSON.parse(rawNotifs));
    if (rawReports) setScheduledReports(JSON.parse(rawReports));
  }, []);

  const saveSettings = (newSettings: JasperNotificationSettings) => {
    setSettings(newSettings);
    onlineStorage.setItem('jasper_notification_settings', JSON.stringify(newSettings));
  };

  const saveModuleSettings = (newSettings: JasperModuleNotificationSettings[]) => {
    setModuleSettings(newSettings);
    onlineStorage.setItem('jasper_module_notification_settings', JSON.stringify(newSettings));
  };

  const saveNotifications = (newNotifs: JasperNotification[]) => {
    setNotifications(newNotifs);
    onlineStorage.setItem('jasper_notifications', JSON.stringify(newNotifs));
  };

  const updateSettings = (updates: Partial<JasperNotificationSettings>) => {
    const newSettings = { ...(settings || defaultSettings), ...updates };
    saveSettings(newSettings);
  };

  const getModuleSettings = (tenantId: string, moduleName: string) => {
    const normalizedModule = normalizeModuleName(moduleName);
    return moduleSettings.find(s => s.tenantId === tenantId && s.moduleName === normalizedModule)
      || createDefaultModuleSettings(tenantId, normalizedModule, settings || defaultSettings);
  };

  const updateModuleSettings = (tenantId: string, moduleName: string, updates: Partial<JasperModuleNotificationSettings>) => {
    const normalizedModule = normalizeModuleName(moduleName);
    const existing = getModuleSettings(tenantId, normalizedModule);
    const updated: JasperModuleNotificationSettings = {
      ...existing,
      ...updates,
      tenantId,
      moduleName: normalizedModule,
      updatedAt: new Date().toISOString()
    };
    const withoutExisting = moduleSettings.filter(s => !(s.tenantId === tenantId && s.moduleName === normalizedModule));
    saveModuleSettings([updated, ...withoutExisting]);
    return updated;
  };

  const hydrateTenantModuleSettings = useCallback((tenantId: string, persisted: JasperModuleNotificationSettings[]) => {
    if (!tenantId || !Array.isArray(persisted) || persisted.length === 0) return;
    setModuleSettings(current => {
      const outsideTenant = current.filter(setting => setting.tenantId !== tenantId);
      const persistedForTenant = persisted
        .filter(setting => setting.tenantId === tenantId)
        .map(setting => ({
          ...setting,
          tenantId,
          moduleName: normalizeModuleName(setting.moduleName),
        }));
      const hydrated = [...persistedForTenant, ...outsideTenant];
      if (JSON.stringify(hydrated) === JSON.stringify(current)) return current;
      onlineStorage.setItem('jasper_module_notification_settings', JSON.stringify(hydrated));
      return hydrated;
    });
  }, []);

  const sendTestModuleWhatsappReport = (tenantId: string, moduleName: string, moduleLabel = moduleName) => {
    const moduleConfig = getModuleSettings(tenantId, moduleName);
    if (moduleConfig.enableWhatsapp && !hasValidWhatsappNumber(moduleConfig.whatsappNumber)) {
      return { ok: false, message: 'Please enter WhatsApp number with country code, example +255712345678.' };
    }

    const message = 'Module: ' + moduleLabel + '\nThis WhatsApp number is ready to receive ' + moduleLabel + ' reports.';
    const providerConfigured = onlineStorage.getItem('jasper_whatsapp_provider_configured') === 'true';
    const newNotif: JasperNotification = {
      id: Math.random().toString(36).substr(2, 9),
      tenantId,
      moduleName: normalizeModuleName(moduleName),
      title: 'Test Jasper Report',
      message: providerConfigured ? message : message + '\n\nWhatsApp provider is not configured yet. Test message saved as in-app notification.',
      notificationType: 'system_alert',
      deliveryChannel: providerConfigured && moduleConfig.enableWhatsapp ? 'whatsapp' : 'in_app',
      status: providerConfigured && moduleConfig.enableWhatsapp ? 'sent' : 'pending_configuration',
      isRead: false,
      createdAt: new Date().toISOString(),
      sentAt: providerConfigured && moduleConfig.enableWhatsapp ? new Date().toISOString() : undefined
    };
    saveNotifications([newNotif, ...notifications]);
    return {
      ok: true,
      message: providerConfigured ? 'Test WhatsApp report sent.' : 'WhatsApp provider is not configured yet. Test message saved as in-app notification.'
    };
  };

  const markAsRead = (id: string) => {
    saveNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllAsRead = () => {
    saveNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  const addSaleNotification = (payload: {
    tenantId: string;
    moduleName: string;
    amount: number;
    profit?: number;
    paymentMethod: string;
    cashierName: string;
    itemsSummary?: string;
  }) => {
    const activeSettings = settings || defaultSettings;
    const moduleConfig = getModuleSettings(payload.tenantId, payload.moduleName);
    if (!moduleConfig.enableSaleNotifications) return;

    if (activeSettings.enabledModules.length > 0 && !activeSettings.enabledModules.includes('all')) {
      const allowedModules = activeSettings.enabledModules.map(normalizeModuleName);
      if (!allowedModules.includes(normalizeModuleName(payload.moduleName))) return;
    }

    if (moduleConfig.enableWhatsapp && !hasValidWhatsappNumber(moduleConfig.whatsappNumber)) return;

    let msg = 'Module: ' + normalizeModuleName(payload.moduleName) + '\nSale: ' + payload.amount.toLocaleString() + ' TZS\nPayment: ' + payload.paymentMethod + '\nCashier: ' + payload.cashierName + '\nTime: ' + new Date().toLocaleTimeString();
    if (payload.profit !== undefined) {
      msg += '\nProfit: ' + payload.profit.toLocaleString() + ' TZS';
    }
    if (payload.itemsSummary) {
      msg += '\nItems: ' + payload.itemsSummary;
    }

    const newNotif: JasperNotification = {
      id: Math.random().toString(36).substr(2, 9),
      tenantId: payload.tenantId,
      moduleName: normalizeModuleName(payload.moduleName),
      title: 'New Sale Recorded',
      message: msg,
      notificationType: 'sale',
      deliveryChannel: moduleConfig.enableInApp ? 'in_app' : (moduleConfig.enableWhatsapp ? 'whatsapp' : 'in_app'),
      status: moduleConfig.enableWhatsapp ? 'pending_configuration' : 'sent',
      isRead: false,
      createdAt: new Date().toISOString()
    };

    saveNotifications([newNotif, ...notifications]);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{
      settings,
      moduleSettings,
      notifications,
      scheduledReports,
      unreadCount,
      updateSettings,
      getModuleSettings,
      updateModuleSettings,
      hydrateTenantModuleSettings,
      sendTestModuleWhatsappReport,
      markAsRead,
      markAllAsRead,
      addSaleNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useJasperNotifications = () => useContext(NotificationContext);
