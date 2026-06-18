import React from 'react';
import { useJasperNotifications } from '../JasperNotificationContext';
import { Bell, Check, X, Clock, FileText, ShoppingCart, AlertTriangle, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToReports: () => void;
}

export const NotificationCenterModal: React.FC<Props> = ({ isOpen, onClose, onNavigateToReports }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useJasperNotifications();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 lg:p-8 pointer-events-none">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-sm flex flex-col h-[600px] max-h-full pointer-events-auto transform transition-all relative z-10 animate-fade-in overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-slate-700" />
            <h3 className="font-bold text-slate-800 tracking-tight">Notification Center</h3>
            {unreadCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {unreadCount} NEW
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        {(notifications.length > 0 || unreadCount > 0) && (
          <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center shrink-0 bg-white">
            <button 
              onClick={onNavigateToReports}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center space-x-1"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>History</span>
            </button>
            {unreadCount > 0 && (
               <button 
                 onClick={markAllAsRead} 
                 className="text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center bg-slate-100 px-2 py-1 rounded-lg"
               >
                 <Check className="w-3 h-3 mr-1" /> Mark all as read
               </button>
            )}
          </div>
        )}

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto scrollbar-none bg-white p-2 space-y-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3 p-6 text-center">
               <Bell className="w-10 h-10 opacity-20" />
               <p className="text-sm font-medium">You're all caught up!</p>
               <p className="text-xs opacity-70">New automated reports and alerts will appear here.</p>
            </div>
          ) : (
            notifications.map(n => (
               <div 
                 key={n.id} 
                 onClick={() => !n.isRead && markAsRead(n.id)}
                 className={\`p-4 rounded-2xl border transition-colors cursor-pointer \${n.isRead ? 'bg-white border-transparent' : 'bg-emerald-50/50 border-emerald-100'}\`}
               >
                  <div className="flex space-x-3">
                     <div className="shrink-0 mt-0.5">
                        {n.notificationType === 'sale' ? (
                           <div className={\`w-8 h-8 rounded-full flex items-center justify-center \${n.isRead ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-600'}\`}>
                              <ShoppingCart className="w-4 h-4" />
                           </div>
                        ) : n.notificationType === 'report' ? (
                           <div className={\`w-8 h-8 rounded-full flex items-center justify-center \${n.isRead ? 'bg-slate-100 text-slate-500' : 'bg-indigo-100 text-indigo-600'}\`}>
                              <FileText className="w-4 h-4" />
                           </div>
                        ) : (
                           <div className={\`w-8 h-8 rounded-full flex items-center justify-center \${n.isRead ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-600'}\`}>
                              <AlertCircle className="w-4 h-4" />
                           </div>
                        )}
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                           <h4 className={\`text-sm truncate pr-2 \${n.isRead ? 'font-medium text-slate-700' : 'font-bold text-slate-900'}\`}>
                              {n.title}
                           </h4>
                           <span className="text-[10px] text-slate-400 whitespace-nowrap pt-1">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           </span>
                        </div>
                        <p className={\`text-xs leading-relaxed whitespace-pre-wrap \${n.isRead ? 'text-slate-500' : 'text-slate-700'}\`}>
                           {n.message}
                        </p>
                        {!n.isRead && (
                           <div className="mt-2 text-[10px] font-bold text-emerald-600 tracking-wider">
                              NEW
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
