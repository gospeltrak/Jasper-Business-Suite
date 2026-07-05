import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Users, Wifi, WifiOff, Calendar, TrendingUp,
  UserCheck, Briefcase, Award, RefreshCw,
  ChevronDown, ChevronUp, Download,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  getOnlineUsers, getVisitsInRange,
  OnlinePresenceEntry, VisitLogEntry,
} from "../utils/userPresence";

// ─── helpers ──────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split("T")[0]; }

function subtractDays(days: number): string {
  const d = new Date(); d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type DateRange = "today" | "week" | "month" | "custom";

// ─── Compact Online User Card (2-column grid) ─────────────────────────────────

function OnlineUserCard({ user }: { user: OnlinePresenceEntry }) {
  const cfg =
    user.userType === "partner"   ? { badge: "bg-amber-900/50 text-amber-300 border-amber-700/50",   dot: "bg-amber-400",   label: "Partner"   } :
    user.userType === "affiliate" ? { badge: "bg-emerald-900/50 text-emerald-300 border-emerald-700/50", dot: "bg-emerald-400", label: "Affiliate" } :
                                    { badge: "bg-blue-900/50 text-blue-300 border-blue-700/50",       dot: "bg-blue-400",    label: "Tenant"    };
  return (
    <div className="flex items-center gap-2.5 bg-slate-800/60 border border-slate-700/50 rounded-2xl px-3 py-2.5">
      <div className="relative shrink-0">
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
          <span className="text-xs font-black text-slate-300">{(user.userName || "?")[0].toUpperCase()}</span>
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${cfg.dot} border-2 border-slate-900 rounded-full`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-200 truncate leading-tight">{user.userName}</p>
        <p className="text-[10px] text-slate-500 leading-tight">{formatTime(user.lastHeartbeat)}</p>
      </div>
      <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-lg uppercase border ${cfg.badge}`}>
        {cfg.label}
      </span>
    </div>
  );
}

// ─── PDF Download ─────────────────────────────────────────────────────────────

function downloadVisitsPdf(visits: VisitLogEntry[], rangeLabel: string) {
  // Build a plain HTML string, then open in new tab for native print-to-PDF
  const rows = visits.map((v, i) => {
    const color = v.userType === "partner" ? "#d97706" : v.userType === "affiliate" ? "#059669" : "#2563eb";
    return `<tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'}">
      <td style="padding:6px 10px;font-size:12px;font-weight:600;color:#1e293b">${v.userName}</td>
      <td style="padding:6px 10px"><span style="background:${color}22;color:${color};font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;text-transform:uppercase">${v.userType}</span></td>
      <td style="padding:6px 10px;font-size:12px;color:#475569">${v.date}</td>
      <td style="padding:6px 10px;font-size:12px;color:#475569">${formatTime(v.firstSeenAt)}</td>
      <td style="padding:6px 10px;font-size:12px;color:#475569">${formatTime(v.lastSeenAt)}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Visit Report — ${rangeLabel}</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:0;padding:20px;color:#1e293b;background:#fff}
    h1{font-size:18px;font-weight:900;margin:0 0 4px}
    p{font-size:12px;color:#64748b;margin:0 0 16px}
    table{width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
    thead{background:#0f172a;color:#fff}
    th{padding:8px 10px;font-size:10px;font-weight:800;text-align:left;letter-spacing:.05em;text-transform:uppercase}
    @media print{body{padding:0}button{display:none}}
  </style></head><body>
  <h1>Visit History Report</h1>
  <p>Period: ${rangeLabel} &nbsp;·&nbsp; ${visits.length} records &nbsp;·&nbsp; Generated: ${new Date().toLocaleString()}</p>
  <button onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;background:#059669;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
  <table><thead><tr>
    <th>User</th><th>Type</th><th>Date</th><th>First Seen</th><th>Last Seen</th>
  </tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `visit-report-${rangeLabel.replace(/\s/g, "-")}.html`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SaaSUserActivityView() {
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [customFrom, setCustomFrom] = useState(subtractDays(7));
  const [customTo, setCustomTo] = useState(todayStr());
  const [onlineUsers, setOnlineUsers] = useState<OnlinePresenceEntry[]>([]);
  const [visits, setVisits] = useState<VisitLogEntry[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [onlineOpen, setOnlineOpen] = useState(false);

  const getDateRange = useCallback((): { from: string; to: string } => {
    const today = todayStr();
    if (dateRange === "today") return { from: today, to: today };
    if (dateRange === "week")  return { from: subtractDays(6), to: today };
    if (dateRange === "month") return { from: subtractDays(29), to: today };
    return { from: customFrom, to: customTo };
  }, [dateRange, customFrom, customTo]);

  const refresh = useCallback(() => {
    setOnlineUsers(getOnlineUsers());
    const { from, to } = getDateRange();
    setVisits(getVisitsInRange(from, to));
    setLastRefresh(new Date());
  }, [getDateRange]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const onlineTenants   = onlineUsers.filter(u => u.userType === "tenant").length;
  const onlineAffiliates= onlineUsers.filter(u => u.userType === "affiliate").length;
  const onlinePartners  = onlineUsers.filter(u => u.userType === "partner").length;
  const totalOnline     = onlineUsers.length;

  const visitTenants    = new Set(visits.filter(v => v.userType === "tenant").map(v => v.userId)).size;
  const visitAffiliates = new Set(visits.filter(v => v.userType === "affiliate").map(v => v.userId)).size;
  const visitPartners   = new Set(visits.filter(v => v.userType === "partner").map(v => v.userId)).size;
  const totalVisitors   = visitTenants + visitAffiliates + visitPartners;

  const { from, to } = getDateRange();
  const chartData: Array<{ date: string; Tenants: number; Affiliates: number; Partners: number }> = [];
  const d = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (d <= end) {
    const day = d.toISOString().split("T")[0];
    const dv = visits.filter(v => v.date === day);
    chartData.push({
      date: formatDateShort(day),
      Tenants:   new Set(dv.filter(v => v.userType === "tenant").map(v => v.userId)).size,
      Affiliates:new Set(dv.filter(v => v.userType === "affiliate").map(v => v.userId)).size,
      Partners:  new Set(dv.filter(v => v.userType === "partner").map(v => v.userId)).size,
    });
    d.setDate(d.getDate() + 1);
  }

  const rangeLabel = dateRange === "today" ? "Today" : dateRange === "week" ? "Last 7 Days" : dateRange === "month" ? "Last 30 Days" : `${customFrom} → ${customTo}`;

  return (
    <div className="space-y-4 font-sans">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" /> User Activity
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">Real-time presence + visit history</p>
        </div>
        <button onClick={refresh}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl cursor-pointer border-none transition-colors">
          <RefreshCw className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] text-slate-400 hidden sm:block">
            {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </button>
      </div>

      {/* ── Online Now — collapsible dropdown ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Dropdown trigger */}
        <button
          type="button"
          onClick={() => setOnlineOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3.5 cursor-pointer border-none bg-transparent"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-[11px] font-black text-slate-300 uppercase tracking-wider">Online Right Now</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Summary chips */}
            <div className="flex items-center gap-1.5">
              {onlineTenants > 0 && (
                <span className="text-[10px] font-black bg-blue-950/60 text-blue-400 border border-blue-800/50 px-2 py-0.5 rounded-lg">
                  {onlineTenants}T
                </span>
              )}
              {onlineAffiliates > 0 && (
                <span className="text-[10px] font-black bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded-lg">
                  {onlineAffiliates}A
                </span>
              )}
              {onlinePartners > 0 && (
                <span className="text-[10px] font-black bg-amber-950/60 text-amber-400 border border-amber-800/50 px-2 py-0.5 rounded-lg">
                  {onlinePartners}P
                </span>
              )}
              <span className="text-[11px] font-black text-emerald-400 ml-1">{totalOnline}</span>
            </div>
            {onlineOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </div>
        </button>

        {/* Expandable content */}
        {onlineOpen && (
          <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-3">
            {/* Count summary row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Tenants",   count: onlineTenants,   icon: Briefcase, color: "text-blue-400",    bg: "bg-blue-950/50 border-blue-800/50"    },
                { label: "Affiliates",count: onlineAffiliates,icon: Award,     color: "text-emerald-400", bg: "bg-emerald-950/50 border-emerald-800/50"},
                { label: "Partners",  count: onlinePartners,  icon: UserCheck, color: "text-amber-400",   bg: "bg-amber-950/50 border-amber-800/50"  },
              ].map(({ label, count, icon: Icon, color, bg }) => (
                <div key={label} className={`rounded-xl border p-2.5 text-center ${bg}`}>
                  <Icon className={`w-3.5 h-3.5 mx-auto mb-1 ${color}`} />
                  <p className={`text-lg font-black leading-none ${color}`}>{count}</p>
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* User cards — 2 columns compact */}
            {totalOnline === 0 ? (
              <div className="text-center py-6">
                <WifiOff className="w-7 h-7 mx-auto text-slate-700 mb-2" />
                <p className="text-xs text-slate-500 font-semibold">No users online right now</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                {onlineUsers.map(u => <OnlineUserCard key={u.userId} user={u} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Visit History section ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" /> Visit History
          </h3>
          {visits.length > 0 && (
            <button
              onClick={() => downloadVisitsPdf(visits, rangeLabel)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] font-black cursor-pointer border-none transition-colors"
            >
              <Download className="w-3 h-3" /> PDF
            </button>
          )}
        </div>

        {/* Range buttons */}
        <div className="flex flex-wrap gap-1.5">
          {(["today", "week", "month", "custom"] as DateRange[]).map(r => (
            <button key={r} onClick={() => setDateRange(r)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer border-none transition-colors ${
                dateRange === r ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}>
              {r === "today" ? "Today" : r === "week" ? "7 Days" : r === "month" ? "30 Days" : "Custom"}
            </button>
          ))}
        </div>

        {/* Custom pickers */}
        {dateRange === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">From</label>
              <input type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">To</label>
              <input type="date" value={customTo} min={customFrom} max={todayStr()} onChange={e => setCustomTo(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500" />
            </div>
          </div>
        )}

        {/* Visitor summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Total",      count: totalVisitors,   color: "text-white",       bg: "bg-slate-800 border-slate-700",           icon: Users      },
            { label: "Tenants",    count: visitTenants,    color: "text-blue-400",    bg: "bg-blue-950/40 border-blue-800/40",        icon: Briefcase  },
            { label: "Affiliates", count: visitAffiliates, color: "text-emerald-400", bg: "bg-emerald-950/40 border-emerald-800/40",  icon: Award      },
            { label: "Partners",   count: visitPartners,   color: "text-amber-400",   bg: "bg-amber-950/40 border-amber-800/40",      icon: UserCheck  },
          ].map(({ label, count, color, bg, icon: Icon }) => (
            <div key={label} className={`rounded-2xl border p-3 text-center ${bg}`}>
              <Icon className={`w-3.5 h-3.5 mx-auto mb-1 ${color} opacity-70`} />
              <p className={`text-xl font-black ${color}`}>{count}</p>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Chart ── */}
      {chartData.length > 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-400" /> Daily Unique Visitors
          </h3>
          <div className="h-44 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", fontSize: "12px", color: "#e2e8f0" }} />
                <Legend wrapperStyle={{ fontSize: "10px", color: "#94a3b8", paddingTop: "8px" }} />
                <Bar dataKey="Tenants"   stackId="a" fill="#3b82f6" radius={[0,0,0,0]} />
                <Bar dataKey="Affiliates"stackId="a" fill="#10b981" radius={[0,0,0,0]} />
                <Bar dataKey="Partners"  stackId="a" fill="#f59e0b" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Visit records ── */}
      {visits.length > 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-wider">
              Records — {rangeLabel}
            </h3>
            <span className="text-[10px] text-slate-500">{visits.length} entries</span>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80">
                  {["User","Type","Date","First Seen","Last Seen"].map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-[9px] font-black text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visits.slice(0, 100).map((v, i) => {
                  const tc = v.userType === "partner" ? "bg-amber-900/40 text-amber-400" : v.userType === "affiliate" ? "bg-emerald-900/40 text-emerald-400" : "bg-blue-900/40 text-blue-400";
                  return (
                    <tr key={`${v.userId}-${v.date}-${i}`} className="border-t border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{v.userName}</td>
                      <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${tc}`}>{v.userType}</span></td>
                      <td className="py-2.5 px-3 text-slate-400">{v.date}</td>
                      <td className="py-2.5 px-3 text-slate-400">{formatTime(v.firstSeenAt)}</td>
                      <td className="py-2.5 px-3 text-slate-400">{formatTime(v.lastSeenAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile/tablet — 2-column compact cards */}
          <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
            {visits.slice(0, 80).map((v, i) => {
              const tc = v.userType === "partner" ? "bg-amber-900/40 text-amber-400 border-amber-800/40" : v.userType === "affiliate" ? "bg-emerald-900/40 text-emerald-400 border-emerald-800/40" : "bg-blue-900/40 text-blue-400 border-blue-800/40";
              return (
                <div key={`${v.userId}-${v.date}-${i}`} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl px-3 py-2.5 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-black text-slate-300">{(v.userName || "?")[0].toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate leading-tight">{v.userName}</p>
                    <p className="text-[10px] text-slate-500 leading-tight">{v.date} · {formatTime(v.firstSeenAt)}</p>
                  </div>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded-lg text-[9px] font-black uppercase border ${tc}`}>{v.userType}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <Wifi className="w-9 h-9 mx-auto text-slate-700 mb-3" />
          <p className="text-sm text-slate-500 font-semibold">No visit data for this period</p>
          <p className="text-xs text-slate-600 mt-1">Visit logs are recorded when users log in.</p>
        </div>
      )}
    </div>
  );
}
