import React, { createContext, useContext, useState, useEffect } from 'react';
import { JasperNotificationSettings, JasperNotification, JasperScheduledReport } from './types';

interface NotificationContextProps {
  settings: JasperNotificationSettings | null;
  notifications: JasperNotification[];
  scheduledReports: JasperScheduledReport[];
  unreadCount: number;
  updateSettings: (newSettings: Partial<JasperNotificationSettings>) => void;
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

const NotificationContext = createContext<NotificationContextProps>({} as any);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<JasperNotificationSettings | null>(null);
  const [notifications, setNotifications] = useState<JasperNotification[]>([]);
  const [scheduledReports, setScheduledReports] = useState<JasperScheduledReport[]>([]);

  // Load from localStorage or initialize
  useEffect(() => {
    const rawSettings = localStorage.getItem('jasper_notification_settings');
    const rawNotifs = localStorage.getItem('jasper_notifications');
    const rawReports = localStorage.getItem('jasper_scheduled_reports');

    if (rawSettings) setSettings(JSON.parse(rawSettings));
    if (rawNotifs) setNotifications(JSON.parse(rawNotifs));
    if (rawReports) setScheduledReports(JSON.parse(rawReports));
  }, []);

  const saveSettings = (newSettings: JasperNotificationSettings) => {
    setSettings(newSettings);
    localStorage.setItem('jasper_notification_settings', JSON.stringify(newSettings));
  };

  const saveNotifications = (newNotifs: JasperNotification[]) => {
    setNotifications(newNotifs);
    localStorage.setItem('jasper_notifications', JSON.stringify(newNotifs));
  };

  const updateSettings = (updates: Partial<JasperNotificationSettings>) => {
    const newSettings = { ... (settings || defaultSettings), ...updates };
    saveSettings(newSettings);
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
    if (!activeSettings.enableSaleNotifications) return;

    if (activeSettings.enabledModules.length > 0 && !activeSettings.enabledModules.includes('all')) {
      if (!activeSettings.enabledModules.includes(payload.moduleName)) return;
    }

    const title = 'New Sale Recorded';
    let msg = \`Module: \${payload.moduleName}\nSale: \${payload.amount.toLocaleString()} TZS\nPayment: \${payload.paymentMethod}\nCashier: \${payload.cashierName}\nTime: \${new Date().toLocaleTimeString()}\`;
    if (payload.profit !== undefined) {
      msg += \`\nProfit: \${payload.profit.toLocaleString()} TZS\`;
    }
    if (payload.itemsSummary) {
      msg += \`\nItems: \${payload.itemsSummary}\`;
    }

    const newNotif: JasperNotification = {
      id: Math.random().toString(36).substr(2, 9),
      tenantId: payload.tenantId,
      moduleName: payload.moduleName,
      title,
      message: msg,
      notificationType: 'sale',
      deliveryChannel: 'in_app',
      status: 'pending_configuration', // Simulating external failure
      isRead: false,
      createdAt: new Date().toISOString()
    };

    const newNotifs = [newNotif, ...notifications];
    saveNotifications(newNotifs);

    // Call service wrappers (hypothetical)
    // sendEmailNotification(...)
    // sendSmsNotification(...)
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{
      settings,
      notifications,
      scheduledReports,
      unreadCount,
      updateSettings,
      markAsRead,
      markAllAsRead,
      addSaleNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useJasperNotifications = () => useContext(NotificationContext);
