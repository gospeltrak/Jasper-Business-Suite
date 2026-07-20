import { useEffect, useState, useMemo } from 'react';
import { MapPin, Users, TrendingUp, Building, Globe } from 'lucide-react';
import { loadSuperAdminOverview, mapSuperAdminUsers, SuperAdminUserRow } from '../utils/superAdminData';
import { loadAffiliateMonitoringData } from '../utils/superAffiliateAdmin';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface LocationBucket {
  location: string;
  city: string;
  country: string;
  subscribers: number;
  affiliates: number;
  total: number;
}

const COLORS = ['#10b981','#6366f1','#f59e0b','#ef4444','#8b5cf6','#22d3ee','#f97316','#ec4899','#14b8a6','#84cc16'];

export default function SaaSDemographicsView() {
  const [users, setUsers] = useState<SuperAdminUserRow[]>([]);
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'city' | 'country' | 'region'>('city');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      loadSuperAdminOverview().then(mapSuperAdminUsers),
      loadAffiliateMonitoringData(),
    ])
      .then(([mappedUsers, affData]) => {
        if (!alive) return;
        setUsers(mappedUsers);
        setAffiliates([...affData.affiliates, ...affData.agents]);
        setError('');
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message || 'Failed to load demographic data.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Build location buckets from subscribers
  const locationBuckets = useMemo(() => {
    const map = new Map<string, LocationBucket>();
    
    users.forEach(u => {
      const key = view === 'city'
        ? (u.city || u.location || 'Unknown')
        : view === 'country'
          ? (u.country || 'Unknown')
          : (u.location || 'Unknown');
      
      const existing = map.get(key) || {
        location: key,
        city: u.city || '',
        country: u.country || '',
        subscribers: 0,
        affiliates: 0,
        total: 0,
      };
      existing.subscribers += 1;
      existing.total += 1;
      map.set(key, existing);
    });

    // Add affiliate locations where available
    affiliates.forEach(a => {
      const loc = a.city || a.country || a.phone_whatsapp?.startsWith('+255') ? 'Tanzania' : 'Unknown';
      const key = loc;
      const existing = map.get(key) || {
        location: key,
        city: '',
        country: '',
        subscribers: 0,
        affiliates: 0,
        total: 0,
      };
      existing.affiliates += 1;
      existing.total += 1;
      map.set(key, existing);
    });

    return Array.from(map.values())
      .filter(b => b.location !== 'Unknown' && b.location !== 'Location not provided')
      .sort((a, b) => b.total - a.total);
  }, [users, affiliates, view]);

  const totalSubscribers = users.length;
  const totalAffiliates = affiliates.length;
  const locationsWithData = locationBuckets.length;
  const topLocation = locationBuckets[0]?.location || '—';
  const topCount = locationBuckets[0]?.total || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"/>
          <p className="text-slate-400 text-sm">Loading demographic data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-xs text-rose-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Subscribers', value: totalSubscribers, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Total Affiliates', value: totalAffiliates, icon: TrendingUp, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          { label: 'Locations Mapped', value: locationsWithData, icon: MapPin, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Top Location', value: topLocation, sub: `${topCount} users`, icon: Globe, color: 'text-sky-400', bg: 'bg-sky-500/10' },
        ].map((kpi, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${kpi.bg}`}>
              <kpi.icon className={`w-5 h-5 ${kpi.color}`}/>
            </div>
            <div className="min-w-0">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">{kpi.label}</p>
              <p className={`text-lg font-black truncate ${kpi.color}`}>{kpi.value}</p>
              {kpi.sub && <p className="text-[9px] text-slate-500">{kpi.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Group by:</span>
        {(['city', 'country', 'region'] as const).map(v => (
          <button key={v} type="button" onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border transition-all ${
              view === v
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      {locationBuckets.length > 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400"/>
            Users by {view.charAt(0).toUpperCase() + view.slice(1)}
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={locationBuckets.slice(0, 15)} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/>
                <XAxis dataKey="location" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false}
                  angle={-35} textAnchor="end" interval={0}/>
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false}/>
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px' }}
                  formatter={(value: any, name: string) => [value, name === 'subscribers' ? 'Subscribers' : 'Affiliates']}
                />
                <Bar dataKey="subscribers" name="subscribers" stackId="a" radius={[0,0,0,0]}>
                  {locationBuckets.slice(0,15).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]}/>
                  ))}
                </Bar>
                <Bar dataKey="affiliates" name="affiliates" stackId="a" fill="#6366f1" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
          <MapPin className="w-10 h-10 text-slate-600 mx-auto mb-3"/>
          <p className="text-slate-400 text-sm font-bold">No location data available</p>
          <p className="text-slate-600 text-xs mt-1">Location is set from tenant business setup or GPS</p>
        </div>
      )}

      {/* Location table */}
      {locationBuckets.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <p className="text-sm font-black text-white uppercase tracking-wider">Location Breakdown</p>
            <p className="text-xs text-slate-500">{locationBuckets.length} locations</p>
          </div>
          <div className="divide-y divide-slate-800">
            {locationBuckets.map((bucket, i) => {
              const pct = totalSubscribers > 0 ? Math.round((bucket.subscribers / totalSubscribers) * 100) : 0;
              const color = COLORS[i % COLORS.length];
              return (
                <div key={bucket.location} className="flex items-center gap-4 px-5 py-3">
                  {/* Rank */}
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black"
                    style={{ background: color + '20', color }}>
                    {i + 1}
                  </div>
                  {/* Location name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-white truncate">{bucket.location}</p>
                      {bucket.country && bucket.city && (
                        <span className="text-[9px] text-slate-500 shrink-0">{bucket.country}</span>
                      )}
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }}/>
                    </div>
                  </div>
                  {/* Stats */}
                  <div className="flex items-center gap-4 shrink-0 text-right">
                    <div>
                      <p className="text-[9px] text-emerald-400 font-bold uppercase">Subscribers</p>
                      <p className="text-sm font-black text-white">{bucket.subscribers}</p>
                    </div>
                    {bucket.affiliates > 0 && (
                      <div>
                        <p className="text-[9px] text-indigo-400 font-bold uppercase">Affiliates</p>
                        <p className="text-sm font-black text-white">{bucket.affiliates}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Share</p>
                      <p className="text-sm font-black" style={{ color }}>{pct}%</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No location info message */}
      {(() => {
        const noLocation = users.filter(u => u.locationSource === 'none').length;
        if (noLocation === 0) return null;
        return (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-300 flex items-center gap-2">
            <Building className="w-4 h-4 shrink-0"/>
            {noLocation} subscriber{noLocation > 1 ? 's' : ''} have no location data — they haven&apos;t completed business setup.
          </div>
        );
      })()}

    </div>
  );
}
