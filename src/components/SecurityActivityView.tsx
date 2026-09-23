import { useEffect, useState } from 'react';
import { ShieldAlert, Ban, ShieldCheck, RefreshCw, MapPin, Loader2 } from 'lucide-react';
import {
  loadSecurityEvents,
  loadIpBlocklist,
  blockIpAddress,
  unblockIpAddress,
  loadIpGeo,
  type SecurityThreatEvent,
  type BlockedIp,
} from '../utils/superAdminData';

const EVENT_LABELS: Record<string, { label: string; tone: string }> = {
  super_admin_session_revoked_after_three_attempts: { label: 'Super Admin locked out (3 failed attempts)', tone: '#ef4444' },
  super_admin_mfa_rejected: { label: 'Super Admin verification code rejected', tone: '#f59e0b' },
  blocked_ip_attempt: { label: 'Blocked IP tried to access the system', tone: '#ef4444' },
  ip_blocked_by_admin: { label: 'IP address blocked', tone: '#64748b' },
  ip_unblocked_by_admin: { label: 'IP address unblocked', tone: '#64748b' },
};

function eventMeta(eventType: string) {
  return EVENT_LABELS[eventType] || { label: eventType.replace(/_/g, ' '), tone: '#64748b' };
}

export default function SecurityActivityView() {
  const [events, setEvents] = useState<SecurityThreatEvent[]>([]);
  const [blocked, setBlocked] = useState<BlockedIp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [geoCache, setGeoCache] = useState<Record<string, { city: string | null; region: string | null; country: string | null; isp: string | null } | null>>({});
  const [geoLoading, setGeoLoading] = useState<Record<string, boolean>>({});
  const [busyIp, setBusyIp] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [eventsList, blockedList] = await Promise.all([loadSecurityEvents(), loadIpBlocklist()]);
      setEvents(eventsList);
      setBlocked(blockedList);
    } catch (err: any) {
      setError(err?.message || 'Could not load security activity.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const showLocation = async (ip: string) => {
    if (geoCache[ip] !== undefined || geoLoading[ip]) return;
    setGeoLoading(prev => ({ ...prev, [ip]: true }));
    try {
      const location = await loadIpGeo(ip);
      setGeoCache(prev => ({ ...prev, [ip]: location }));
    } catch {
      setGeoCache(prev => ({ ...prev, [ip]: null }));
    } finally {
      setGeoLoading(prev => ({ ...prev, [ip]: false }));
    }
  };

  const handleBlock = async (ip: string) => {
    if (!ip || ip === 'unknown') return;
    setBusyIp(ip);
    try {
      await blockIpAddress(ip, 'Blocked from Security Activity');
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Could not block that IP.');
    } finally {
      setBusyIp(null);
    }
  };

  const handleUnblock = async (ip: string) => {
    setBusyIp(ip);
    try {
      await unblockIpAddress(ip);
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Could not unblock that IP.');
    } finally {
      setBusyIp(null);
    }
  };

  const isBlocked = (ip: string | null) => !!ip && blocked.some(b => b.ip_address === ip);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          <h2 className="text-lg font-black">Security Activity</h2>
        </div>
        <button
          onClick={() => void refresh()}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer border-none"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-200">{error}</div>
      )}

      {/* Currently blocked IPs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-xs font-mono font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Ban className="w-4 h-4 text-rose-400" /> Blocked IP Addresses ({blocked.length})
        </h3>
        {blocked.length === 0 ? (
          <p className="text-xs text-slate-500">No IP addresses are blocked right now.</p>
        ) : (
          <div className="space-y-2">
            {blocked.map(b => (
              <div key={b.ip_address} className="flex items-center justify-between bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 gap-3">
                <div className="min-w-0">
                  <p className="font-mono font-bold text-white text-sm">{b.ip_address}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{b.reason || 'No reason given'} · {new Date(b.blocked_at).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => handleUnblock(b.ip_address)}
                  disabled={busyIp === b.ip_address}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold cursor-pointer border-none"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent security events */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-xs font-mono font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" /> Recent Security Events
        </h3>
        {loading ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-xs text-slate-500">No security events recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {events.map(ev => {
              const meta = eventMeta(ev.event_type);
              const ip = ev.ip_address;
              const geo = ip ? geoCache[ip] : undefined;
              return (
                <div key={ev.id} className="relative overflow-hidden bg-slate-800/60 rounded-xl px-4 py-3" style={{ borderLeft: `3px solid ${meta.tone}` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">{meta.label}</p>
                      <p className="text-[10.5px] text-slate-400 mt-0.5 font-mono">
                        {ip ? <span>IP: {ip}</span> : null}
                        {ev.identifier ? <span> · {ev.identifier}</span> : null}
                        <span> · {new Date(ev.created_at).toLocaleString()}</span>
                      </p>
                      {ip && (
                        <div className="mt-1.5">
                          {geoLoading[ip] ? (
                            <span className="text-[10px] text-slate-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Locating…</span>
                          ) : geo === undefined ? (
                            <button onClick={() => void showLocation(ip)} className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer bg-transparent border-none flex items-center gap-1 p-0">
                              <MapPin className="w-3 h-3" /> Show location
                            </button>
                          ) : geo ? (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {[geo.city, geo.region, geo.country].filter(Boolean).join(', ') || 'Unknown'} {geo.isp ? `· ${geo.isp}` : ''}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">Location unavailable</span>
                          )}
                        </div>
                      )}
                    </div>
                    {ip && ip !== 'unknown' && (
                      isBlocked(ip) ? (
                        <span className="shrink-0 text-[10px] font-bold text-rose-400 px-2 py-1 bg-rose-500/10 rounded-lg">Blocked</span>
                      ) : (
                        <button
                          onClick={() => handleBlock(ip)}
                          disabled={busyIp === ip}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold cursor-pointer border-none"
                        >
                          <Ban className="w-3.5 h-3.5" /> Block
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
