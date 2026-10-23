import { SyncLog, Sale } from '../../types';
import {
  Wifi,
  WifiOff,
  Database,
  AlertTriangle,
  Terminal,
  Activity
} from 'lucide-react';

interface DashboardLogsAndSyncProps {
  logs: SyncLog[];
  sales: Sale[];
  isOfflineMode: boolean;
  onToggleOffline: () => void;
  isSyncingOfflineQueue: boolean;
  offlineSyncStuck: boolean;
  onSyncNow: () => void;
}

export default function DashboardLogsAndSync({
  logs,
  sales,
  isOfflineMode,
  onToggleOffline,
  isSyncingOfflineQueue,
  offlineSyncStuck,
  onSyncNow
}: DashboardLogsAndSyncProps) {
  // Sales still queued on this device, oldest first -- mirrors the order the
  // real sync engine (Dashboard.tsx: syncPendingOfflineSales) sends them in.
  const offlinePendingSales = sales
    .filter(s => s.syncStatus === 'pending')
    .sort((a, b) => new Date(a.actualTimestamp || a.timestamp).getTime() - new Date(b.actualTimestamp || b.timestamp).getTime());

  return (
    <div id="logs-sync-view" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      
	      {/* Sync safety panel (5/12 scope) */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between space-y-6 shadow-sm">
        <div className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Database className="w-5 h-5 text-emerald-600" />
	            <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wider">Sync Safety Hub</h4>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed font-medium">
	            Orvix saves your business changes automatically when you are online. This screen shows old records kept on this device for your own review; they are not sent automatically.
          </p>

          {/* Interactive Switch Container */}
          <div className={`p-4 rounded-2xl border transition-all ${
            isOfflineMode 
              ? 'bg-amber-50 border-amber-200' 
              : 'bg-emerald-50/50 border-emerald-100'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {isOfflineMode ? (
                  <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl border border-amber-200">
                    <WifiOff className="w-5 h-5 animate-pulse" />
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200">
                    <Wifi className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-slate-800">
	                    {isOfflineMode ? 'OFFLINE - SAVING DISABLED' : 'ONLINE - READY TO SAVE'}
                  </p>
                  <p className="text-[10px] font-mono text-slate-450 font-bold uppercase tracking-wide">
	                    {isOfflineMode ? 'Reconnect before saving changes' : 'Ready to save your changes'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Sales Warning */}
          {offlinePendingSales.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-start space-x-2 text-xs text-amber-800">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 animate-bounce mt-0.5 text-amber-600" />
                <div className="space-y-0.5 font-sans">
	                  <p className="font-bold">Old Records Kept on This Device</p>
                  <p className="text-[10.5px] leading-relaxed text-slate-600 font-medium">
	                    You have <span className="font-bold text-amber-750 underline">{offlinePendingSales.length} receipt(s)</span> kept on this device. They will not upload automatically.
                  </p>
                </div>
              </div>

              {!isOfflineMode && (
                <button
                  disabled={isSyncingOfflineQueue}
                  onClick={onSyncNow}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer shadow-sm shadow-emerald-505/10"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>{isSyncingOfflineQueue ? 'Syncing…' : `Sync Now (${offlinePendingSales.length})`}</span>
                </button>
              )}
              {offlineSyncStuck && (
                <p className="text-[10.5px] font-semibold text-amber-700">
                  Could not sync after several tries. You can keep selling -- it will keep retrying in the background.
                </p>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-800">Sales Waiting to Sync</p>
                <p className="mt-0.5 text-[10px] font-medium text-slate-500">Oldest first -- this is the order they will sync in.</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${offlinePendingSales.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {offlinePendingSales.length} pending
              </span>
            </div>
            <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
              {offlinePendingSales.slice(0, 6).map((sale) => (
                <div key={sale.id} className="rounded-xl border border-amber-100 bg-white px-3 py-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-700">Sale receipt</span>
                    <span className="font-mono text-amber-700">{sale.id}</span>
                  </div>
                  <p className="mt-0.5 truncate text-slate-500">{sale.customerName || 'Walk-in customer'} · {new Date(sale.actualTimestamp || sale.timestamp).toLocaleString()}</p>
                </div>
              ))}
              {offlinePendingSales.length === 0 && (
                <div className="rounded-xl border border-emerald-100 bg-white px-3 py-4 text-center text-[11px] font-semibold text-emerald-700">
                  No sales waiting. Everything is synced.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sync Console Progress */}
        {isSyncingOfflineQueue && (
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl font-mono text-[10px] text-slate-350 flex items-center space-x-2">
              <Terminal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Syncing {offlinePendingSales.length} offline sale(s)…</span>
            </div>
          </div>
        )}
      </div>

      {/* Sync Ledger Activity Logs (7/12 scope) */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between shadow-sm">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-emerald-600 animate-pulse" />
              <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wider">Consolidated Store Log Ledger</h4>
            </div>
            <span className="text-[10px] font-mono font-bold bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-500">
              All Good
            </span>
          </div>

          {/* Logs List */}
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 pr-1">
            {logs.map((log) => (
              <div key={log.id} className="p-3.5 bg-slate-50/50 border border-slate-150/85 rounded-2xl flex items-start justify-between text-xs font-mono hover:border-slate-300 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${
                      log.status === 'success' 
                        ? 'bg-emerald-600' 
                        : log.status === 'warning' 
                          ? 'bg-amber-500 animate-pulse' 
                          : 'bg-red-500'
                    }`} />
                    <span className="text-[11px] font-bold text-slate-700 uppercase">{log.type.replace('_', ' ')}</span>
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed pr-6 font-medium">{log.message}</p>
                </div>
                <span className="text-[9.5px] text-slate-400 shrink-0 font-bold">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
