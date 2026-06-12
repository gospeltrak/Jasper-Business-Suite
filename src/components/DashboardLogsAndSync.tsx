import { useState } from 'react';
import { SyncLog, Sale } from '../types';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Database, 
  AlertTriangle, 
  CheckCircle2, 
  Terminal, 
  UploadCloud, 
  Play,
  Activity
} from 'lucide-react';

interface DashboardLogsAndSyncProps {
  logs: SyncLog[];
  sales: Sale[];
  isOfflineMode: boolean;
  onToggleOffline: () => void;
  onSyncOfflineQueue: (callback: () => void) => void;
}

export default function DashboardLogsAndSync({
  logs,
  sales,
  isOfflineMode,
  onToggleOffline,
  onSyncOfflineQueue
}: DashboardLogsAndSyncProps) {
  // Local state for sync simulation
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatusLines, setSyncStatusLines] = useState<string[]>([]);

  // Count size of pending offline sales
  const offlinePendingSales = sales.filter(s => s.syncStatus === 'pending');

  const startManualSync = () => {
    if (offlinePendingSales.length === 0 || isSyncing) return;
    
    setIsSyncing(true);
    setSyncProgress(10);
    setSyncStatusLines([
      '⚡ Connecting to central Google Cloud container router...',
      `📦 Packet matching detected ${offlinePendingSales.length} un-pushed receipts...`
    ]);

    // Staggered animated flushes represent pristine enterprise engineering
    setTimeout(() => {
      setSyncProgress(40);
      setSyncStatusLines(prev => [
        ...prev,
        '🔐 Handshaking SSL auth tokens for Lagos & Nairobi registries...',
        `📡 Uploading ticket ID: ${offlinePendingSales[0].id} via secure mobile gateway JSON...`
      ]);
    }, 800);

    setTimeout(() => {
      setSyncProgress(75);
      if (offlinePendingSales.length > 1) {
        setSyncStatusLines(prev => [
          ...prev,
          `📡 Uploading ticket ID: ${offlinePendingSales[1].id}...`,
        ]);
      }
      setSyncStatusLines(prev => [
        ...prev,
        '✨ Audited inventory quantities alignment completed, resolving VAT rates compliance...',
      ]);
    }, 1600);

    setTimeout(() => {
      setSyncProgress(100);
      setSyncStatusLines(prev => [
        ...prev,
        '✅ Master database sync successful. Offline ledger stack flushed!'
      ]);
      
      // Flush matching parents state
      onSyncOfflineQueue(() => {
        setIsSyncing(false);
        setSyncProgress(0);
      });
    }, 2400);
  };

  return (
    <div id="logs-sync-view" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      
      {/* Offline Controller Panel (5/12 scope) */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between space-y-6 shadow-sm">
        <div className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Database className="w-5 h-5 text-emerald-600" />
            <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wider">Offline-First Control Hub</h4>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Toggle offline simulations to test resilience patterns. During internet blackout modes, cash registers save transactions locally in a standard offline register.
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
                    {isOfflineMode ? 'OFFLINE DISCONNECTED' : 'ONLINE SYNCHRONIZED'}
                  </p>
                  <p className="text-[10px] font-mono text-slate-450 font-bold uppercase tracking-wide">
                    {isOfflineMode ? 'Bypassing Cloud; using local storage' : 'Direct live sockets backup'}
                  </p>
                </div>
              </div>

              <button
                onClick={onToggleOffline}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  isOfflineMode 
                    ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-70s' 
                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                }`}
              >
                {isOfflineMode ? 'Go Online' : 'Force Offline'}
              </button>
            </div>
          </div>

          {/* Pending Sales Warning */}
          {offlinePendingSales.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-start space-x-2 text-xs text-amber-800">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 animate-bounce mt-0.5 text-amber-600" />
                <div className="space-y-0.5 font-sans">
                  <p className="font-bold">Pending Register Flush Required</p>
                  <p className="text-[10.5px] leading-relaxed text-slate-600 font-medium">
                    You have <span className="font-bold text-amber-750 underline">{offlinePendingSales.length} queue receipt(s)</span> compiled offline. Restore server connection to push.
                  </p>
                </div>
              </div>

              {!isOfflineMode && (
                <button
                  disabled={isSyncing}
                  onClick={startManualSync}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer shadow-sm shadow-emerald-505/10"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Sync Offline Queue ({offlinePendingSales.length})</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sync Console Progress */}
        {isSyncing && (
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>Streaming packets:</span>
              <span className="font-bold text-emerald-600">{syncProgress}%</span>
            </div>
            
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/50">
              <div className="bg-emerald-600 h-full rounded-full transition-all duration-300" style={{ width: `${syncProgress}%` }} />
            </div>

            {/* Micro Terminal Display */}
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl font-mono text-[10px] text-slate-350 space-y-1.5 max-h-[100px] overflow-y-auto">
              <div className="flex items-center space-x-1 text-slate-500 border-b border-slate-850 pb-1.5 mb-1 font-bold">
                <Terminal className="w-3.5 h-3.5 text-slate-400" />
                <span>Sync Node Shell</span>
              </div>
              {syncStatusLines.map((line, idx) => (
                <p key={idx} className="leading-tight animate-fade-in text-slate-350 font-medium">
                  {line}
                </p>
              ))}
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
              Standard Server Sync Status OK
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

        <div className="pt-4 border-t border-slate-100 text-center text-[10px] font-mono font-bold text-slate-400">
          LOGS DEPLOYED ON DISTRIBUTED PRIVATE CORES • TILL DESKS ACTIVE
        </div>
      </div>
    </div>
  );
}
