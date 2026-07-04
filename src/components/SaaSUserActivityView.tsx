import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Wifi,
  WifiOff,
  Calendar,
  TrendingUp,
  UserCheck,
  Briefcase,
  Award,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  getOnlineUsers,
  getVisitsInRange,
  OnlinePresenceEntry,
  VisitLogEntry,
} from "../utils/userPresence";

// ─── helpers ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function subtractDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type DateRange = "today" | "week" | "month" | "custom";

// ─── Online User Card ─────────────────────────────────────────────────────────

function OnlineUserCard({ user }: { user: OnlinePresenceEntry }) {
  const badgeColor =
    user.userType === "partner"
      ? "bg-amber-100 text-amber-700"
      : user.userType === "affiliate"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-blue-100 text-blue-700";

  const label =
    user.userType === "partner"
      ? "Partner"
      : user.userType === "affiliate"
      ? "Affiliate"
      : "Tenant";

  return (
    <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm">
      <div className="relative shrink-0">
        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
          <span className="text-sm font-black text-slate-600">
            {(user.userName || "?")[0].toUpperCase()}
          </span>
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 truncate">{user.userName}</p>
        <p className="text-[10px] text-slate-400">
          Last seen {formatTime(user.lastHeartbeat)}
        </p>
      </div>
      <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${badgeColor}`}>
        {label}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SaaSUserActivityView() {
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [customFrom, setCustomFrom] = useState(subtractDays(7));
  const [customTo, setCustomTo] = useState(todayStr());
  const [onlineUsers, setOnlineUsers] = useState<OnlinePresenceEntry[]>([]);
  const [visits, setVisits] = useState<VisitLogEntry[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Compute date range
  const getDateRange = useCallback((): { from: string; to: string } => {
    const today = todayStr();
    if (dateRange === "today") return { from: today, to: today };
    if (dateRange === "week") return { from: subtractDays(6), to: today };
    if (dateRange === "month") return { from: subtractDays(29), to: today };
    return { from: customFrom, to: customTo };
  }, [dateRange, customFrom, customTo]);

  const refresh = useCallback(() => {
    setOnlineUsers(getOnlineUsers());
    const { from, to } = getDateRange();
    setVisits(getVisitsInRange(from, to));
    setLastRefresh(new Date());
  }, [getDateRange]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15_000);
    return () => clearInterval(timer);
  }, [refresh]);

  // Summary counts
  const onlineTenants = onlineUsers.filter((u) => u.userType === "tenant").length;
  const onlineAffiliates = onlineUsers.filter((u) => u.userType === "affiliate").length;
  const onlinePartners = onlineUsers.filter((u) => u.userType === "partner").length;
  const totalOnline = onlineUsers.length;

  const visitTenants = new Set(visits.filter((v) => v.userType === "tenant").map((v) => v.userId)).size;
  const visitAffiliates = new Set(visits.filter((v) => v.userType === "affiliate").map((v) => v.userId)).size;
  const visitPartners = new Set(visits.filter((v) => v.userType === "partner").map((v) => v.userId)).size;
  const totalVisitors = visitTenants + visitAffiliates + visitPartners;

  // Build chart data — unique visitors per day per type
  const { from, to } = getDateRange();
  const chartData: Array<{ date: string; Tenants: number; Affiliates: number; Partners: number }> = [];
  const d = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (d <= end) {
    const day = d.toISOString().split("T")[0];
    const dayVisits = visits.filter((v) => v.date === day);
    chartData.push({
      date: formatDateShort(day),
      Tenants: new Set(dayVisits.filter((v) => v.userType === "tenant").map((v) => v.userId)).size,
      Affiliates: new Set(dayVisits.filter((v) => v.userType === "affiliate").map((v) => v.userId)).size,
      Partners: new Set(dayVisits.filter((v) => v.userType === "partner").map((v) => v.userId)).size,
    });
    d.setDate(d.getDate() + 1);
  }

  const rangeLabel =
    dateRange === "today"
      ? "Today"
      : dateRange === "week"
      ? "Last 7 Days"
      : dateRange === "month"
      ? "Last 30 Days"
      : `${customFrom} → ${customTo}`;

  return (
    <div className="space-y-5 font-sans">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            User Activity & Online Report
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time presence + daily visit history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">
            Refreshed {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            onClick={refresh}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer border-none transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* ── Online Now Cards ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-wider">
            Online Right Now
          </h3>
          <span className="ml-auto text-[11px] font-black text-emerald-400">
            {totalOnline} online
          </span>
        </div>

        {/* Online summary chips */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Tenants", count: onlineTenants, icon: Briefcase, color: "text-blue-400", bg: "bg-blue-950/50 border-blue-800/50" },
            { label: "Affiliates", count: onlineAffiliates, icon: Award, color: "text-emerald-400", bg: "bg-emerald-950/50 border-emerald-800/50" },
            { label: "Partners", count: onlinePartners, icon: UserCheck, color: "text-amber-400", bg: "bg-amber-950/50 border-amber-800/50" },
          ].map(({ label, count, icon: Icon, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-3 text-center ${bg}`}>
              <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
              <p className={`text-xl font-black ${color}`}>{count}</p>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Online user list */}
        {totalOnline === 0 ? (
          <div className="text-center py-8">
            <WifiOff className="w-8 h-8 mx-auto text-slate-700 mb-2" />
            <p className="text-sm text-slate-500 font-semibold">No users online right now</p>
            <p className="text-xs text-slate-600 mt-0.5">
              Users appear here within 30 seconds of logging in
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {onlineUsers.map((u) => (
              <OnlineUserCard key={u.userId} user={u} />
            ))}
          </div>
        )}
      </div>

      {/* ── Date Range Picker ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          Visit History — {rangeLabel}
        </h3>

        {/* Range buttons */}
        <div className="flex flex-wrap gap-2">
          {(["today", "week", "month", "custom"] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer border-none transition-colors ${
                dateRange === r
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
              }`}
            >
              {r === "today" ? "Today" : r === "week" ? "7 Days" : r === "month" ? "30 Days" : "Custom"}
            </button>
          ))}
        </div>

        {/* Custom date pickers */}
        {dateRange === "custom" && (
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">From</label>
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">To</label>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayStr()}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {/* Visitor summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {[
            { label: "Total Visitors", count: totalVisitors, color: "text-white", bg: "bg-slate-800 border-slate-700", icon: Users },
            { label: "Tenants", count: visitTenants, color: "text-blue-400", bg: "bg-blue-950/40 border-blue-800/40", icon: Briefcase },
            { label: "Affiliates", count: visitAffiliates, color: "text-emerald-400", bg: "bg-emerald-950/40 border-emerald-800/40", icon: Award },
            { label: "Partners", count: visitPartners, color: "text-amber-400", bg: "bg-amber-950/40 border-amber-800/40", icon: UserCheck },
          ].map(({ label, count, color, bg, icon: Icon }) => (
            <div key={label} className={`rounded-2xl border p-3 text-center ${bg}`}>
              <Icon className={`w-4 h-4 mx-auto mb-1 ${color} opacity-70`} />
              <p className={`text-2xl font-black ${color}`}>{count}</p>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Daily Visitors Chart ── */}
      {chartData.length > 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            Daily Unique Visitors
          </h3>
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "#e2e8f0",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "10px", color: "#94a3b8", paddingTop: "8px" }}
                />
                <Bar dataKey="Tenants" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Affiliates" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Partners" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Today visits list (mobile-first cards) ── */}
      {visits.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-wider">
            Visit Records — {rangeLabel}
          </h3>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 px-3 text-[9px] font-black text-slate-500 uppercase tracking-wider">User</th>
                  <th className="text-left py-2 px-3 text-[9px] font-black text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-left py-2 px-3 text-[9px] font-black text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left py-2 px-3 text-[9px] font-black text-slate-500 uppercase tracking-wider">First Seen</th>
                  <th className="text-left py-2 px-3 text-[9px] font-black text-slate-500 uppercase tracking-wider">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {visits.slice(0, 100).map((v, i) => {
                  const typeColor =
                    v.userType === "partner"
                      ? "bg-amber-900/40 text-amber-400"
                      : v.userType === "affiliate"
                      ? "bg-emerald-900/40 text-emerald-400"
                      : "bg-blue-900/40 text-blue-400";
                  return (
                    <tr key={`${v.userId}-${v.date}-${i}`} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{v.userName}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${typeColor}`}>
                          {v.userType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{v.date}</td>
                      <td className="py-2.5 px-3 text-slate-400">{formatTime(v.firstSeenAt)}</td>
                      <td className="py-2.5 px-3 text-slate-400">{formatTime(v.lastSeenAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2 max-h-72 overflow-y-auto">
            {visits.slice(0, 50).map((v, i) => {
              const typeColor =
                v.userType === "partner"
                  ? "bg-amber-900/40 text-amber-400"
                  : v.userType === "affiliate"
                  ? "bg-emerald-900/40 text-emerald-400"
                  : "bg-blue-900/40 text-blue-400";
              return (
                <div key={`${v.userId}-${v.date}-${i}`} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                    <span className="text-xs font-black text-slate-300">
                      {(v.userName || "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-200 truncate">{v.userName}</p>
                    <p className="text-[10px] text-slate-500">
                      {v.date} · {formatTime(v.firstSeenAt)} – {formatTime(v.lastSeenAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${typeColor}`}>
                    {v.userType}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {visits.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <Wifi className="w-10 h-10 mx-auto text-slate-700 mb-3" />
          <p className="text-sm text-slate-500 font-semibold">No visit data for this period</p>
          <p className="text-xs text-slate-600 mt-1">
            Visit logs are recorded when users log in. Data accumulates over time.
          </p>
        </div>
      )}
    </div>
  );
}
