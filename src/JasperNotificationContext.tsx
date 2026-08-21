import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { JasperNotificationSettings, JasperModuleNotificationSettings, JasperNotification, JasperScheduledReport } from './types';
import { getSecureDataBridgeClient } from './secureDataBridge';

type NotificationInboxScope = { tenantId: string; userId: string; role: string };

interface NotificationContextProps {
  settings: JasperNotificationSettings | null;
  moduleSettings: JasperModuleNotificationSettings[];
  notifications: JasperNotification[];
  scheduledReports: JasperScheduledReport[];
  unreadCount: number;
  configureInbox: (scope: NotificationInboxScope) => void;
  refreshInbox: () => Promise<void>;
  updateSettings: (newSettings: Partial<JasperNotificationSettings>) => void;
  getModuleSettings: (tenantId: string, moduleName: string) => JasperModuleNotificationSettings;
  updateModuleSettings: (tenantId: string, moduleName: string, updates: Partial<JasperModuleNotificationSettings>) => JasperModuleNotificationSettings;
  hydrateTenantModuleSettings: (tenantId: string, settings: JasperModuleNotificationSettings[]) => void;
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
  addSubscriptionReminderNotification: (payload: { tenantId: string; title: string; message: string }) => void;
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
    enableWhatsapp: false,
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

const NotificationContext = createContext<NotificationContextProps>({} as any);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<JasperNotificationSettings | null>(null);
  const [moduleSettings, setModuleSettings] = useState<JasperModuleNotificationSettings[]>([]);
  const [notifications, setNotifications] = useState<JasperNotification[]>([]);
  const [scheduledReports, setScheduledReports] = useState<JasperScheduledReport[]>([]);
  const [inboxScope, setInboxScope] = useState<NotificationInboxScope | null>(null);

  useEffect(() => {
    const rawSettings = onlineStorage.getItem('jasper_notification_settings');
    const rawModuleSettings = onlineStorage.getItem('jasper_module_notification_settings');
    const rawReports = onlineStorage.getItem('jasper_scheduled_reports');

    if (rawSettings) setSettings(JSON.parse(rawSettings));
    if (rawModuleSettings) setModuleSettings(JSON.parse(rawModuleSettings));
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
  };

  const refreshInbox = useCallback(async () => {
    if (!inboxScope || !['Admin', 'SuperAdmin'].includes(inboxScope.role)) {
      setNotifications([]);
      return;
    }
    try {
      const client = await getSecureDataBridgeClient();
      const { data: { session } } = await client.auth.getSession();
      if (!session?.access_token) {
        setNotifications([]);
        return;
      }
      const response = await fetch('/api/notifications/inbox', {
        headers: { Accept: 'application/json', Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        setNotifications([]);
        return;
      }
      const payload = await response.json();
      setNotifications(Array.isArray(payload?.notifications) ? payload.notifications : []);
    } catch {
      setNotifications([]);
    }
  }, [inboxScope]);

  const configureInbox = useCallback((scope: NotificationInboxScope) => {
    setInboxScope(current => (
      current?.tenantId === scope.tenantId && current?.userId === scope.userId && current?.role === scope.role
        ? current
        : scope
    ));
  }, []);

  useEffect(() => {
    void refreshInbox();
  }, [refreshInbox]);

  const updateReadState = async (path: string, updater: (current: JasperNotification[]) => JasperNotification[]) => {
    if (!inboxScope || !['Admin', 'SuperAdmin'].includes(inboxScope.role)) return;
    const previous = notifications;
    setNotifications(updater);
    try {
      const client = await getSecureDataBridgeClient();
      const { data: { session } } = await client.auth.getSession();
      if (!session?.access_token) throw new Error('Authentication required');
      const response = await fetch(path, {
        method: 'PATCH',
        headers: { Accept: 'application/json', Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error('Notification update failed');
    } catch {
      setNotifications(previous);
    }
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

  const markAsRead = (id: string) => {
    void updateReadState(`/api/notifications/${encodeURIComponent(id)}/read`, current => current.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllAsRead = () => {
    void updateReadState('/api/notifications/read-all', current => current.map(n => ({ ...n, isRead: true })));
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
    if (!inboxScope || inboxScope.role !== 'Admin' || inboxScope.tenantId !== payload.tenantId) return;
    const activeSettings = settings || defaultSettings;
    const moduleConfig = getModuleSettings(payload.tenantId, payload.moduleName);
    if (!moduleConfig.enableSaleNotifications) return;

    if (activeSettings.enabledModules.length > 0 && !activeSettings.enabledModules.includes('all')) {
      const allowedModules = activeSettings.enabledModules.map(normalizeModuleName);
      if (!allowedModules.includes(normalizeModuleName(payload.moduleName))) return;
    }

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
      deliveryChannel: 'in_app',
      status: 'sent',
      isRead: false,
      createdAt: new Date().toISOString()
    };

    saveNotifications([newNotif, ...notifications]);
  };

  // Phone-only delivery for the subscription-expiry countdown: tablet/desktop
  // show it as a header badge (Dashboard.tsx), but that header doesn't exist
  // on phone width, so it goes into the bell/inbox instead. Same
  // Admin-only/tenant-scoped gating as addSaleNotification, local-state only
  // (no server round-trip) since this is re-derived from live subscription
  // state each time, not a persisted record.
  const addSubscriptionReminderNotification = (payload: { tenantId: string; title: string; message: string }) => {
    if (!inboxScope || inboxScope.role !== 'Admin' || inboxScope.tenantId !== payload.tenantId) return;
    const newNotif: JasperNotification = {
      id: Math.random().toString(36).substr(2, 9),
      tenantId: payload.tenantId,
      moduleName: 'subscription',
      title: payload.title,
      message: payload.message,
      notificationType: 'system_alert',
      deliveryChannel: 'in_app',
      status: 'sent',
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
      configureInbox,
      refreshInbox,
      updateSettings,
      getModuleSettings,
      updateModuleSettings,
      hydrateTenantModuleSettings,
      markAsRead,
      markAllAsRead,
      addSaleNotification,
      addSubscriptionReminderNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useJasperNotifications = () => useContext(NotificationContext);
