import React, { useEffect, useState } from 'react';
import { CheckCircle, MonitorPlay, Pin, Trash2 } from 'lucide-react';
import {
  GlobalAdPlacementSettings,
  loadGlobalAdSettings,
  SAMPLE_HORIZONTAL_AD_CODE,
  SAMPLE_STICKY_AD_CODE,
  saveGlobalAdSettings,
} from '../utils/adPlacement';

export default function SaaSAdPlacementsPanel({ compact = false }: { compact?: boolean }) {
  const [dashboardAdCode, setDashboardAdCode] = useState('');
  const [dashboardAdEnabled, setDashboardAdEnabled] = useState(true);
  const [bottomAdCode, setBottomAdCode] = useState('');
  const [bottomAdEnabled, setBottomAdEnabled] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    loadGlobalAdSettings()
      .then((settings) => {
        if (!alive) return;
        setDashboardAdCode(settings.dashboardAdCode);
        setDashboardAdEnabled(settings.dashboardAdEnabled);
        setBottomAdCode(settings.bottomAdCode);
        setBottomAdEnabled(settings.bottomAdEnabled);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const currentSettings = (): GlobalAdPlacementSettings => ({
    dashboardAdCode,
    dashboardAdEnabled,
    bottomAdCode,
    bottomAdEnabled,
  });

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3500);
  };

  const publishSettings = async (next: GlobalAdPlacementSettings, message: string) => {
    setSaving(true);
    try {
      const saved = await saveGlobalAdSettings(next);
      setDashboardAdCode(saved.dashboardAdCode);
      setDashboardAdEnabled(saved.dashboardAdEnabled);
      setBottomAdCode(saved.bottomAdCode);
      setBottomAdEnabled(saved.bottomAdEnabled);
      showNotice(message);
    } catch (error: any) {
      showNotice(error?.message || 'Internet is required to save dashboard ad settings.');
    } finally {
      setSaving(false);
    }
  };

  const sectionShell = compact ? 'space-y-5' : 'mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-8';
  const stickyEffectivelyEnabled = dashboardAdEnabled && bottomAdEnabled;

  return (
    <div className={sectionShell}>
      {!compact && (
        <header className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-purple-300">Ad placement control</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Dashboard Ads</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400 sm:text-sm">
                Control the horizontal dashboard banner and sticky bottom ad without opening the full website editor.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
              728x90 ready
            </div>
          </div>
        </header>
      )}

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-300">
          <CheckCircle className="h-4 w-4" />
          {notice}
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <MonitorPlay className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-amber-300">Dashboard Ad Placement</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                728x90 horizontal banner shown on tenant dashboards and affiliate Code & Link banner slot.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`rounded-md px-2.5 py-1 text-[10px] font-black ${dashboardAdEnabled ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                {dashboardAdEnabled ? 'ON' : 'OFF'}
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = !dashboardAdEnabled;
                  publishSettings(
                    { ...currentSettings(), dashboardAdEnabled: next, bottomAdEnabled: next ? bottomAdEnabled : false },
                    `Dashboard ad placement turned ${next ? 'ON' : 'OFF'}.`
                  );
                }}
                className={`relative h-7 w-14 rounded-full border-none transition-colors ${dashboardAdEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                aria-label="Toggle dashboard ad placement"
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${dashboardAdEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <textarea
            value={dashboardAdCode}
            onChange={(event) => setDashboardAdCode(event.target.value)}
            placeholder={'<!-- Paste 728x90 horizontal ad code here -->'}
            rows={compact ? 6 : 9}
            className="mt-4 min-h-44 w-full resize-y rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-300 outline-none placeholder:text-slate-600 focus:border-amber-400"
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto]">
            <button
              type="button"
              onClick={() => setDashboardAdCode(SAMPLE_HORIZONTAL_AD_CODE)}
              className="rounded-xl border-none bg-slate-800 px-4 py-2.5 text-xs font-black text-amber-300 hover:bg-slate-700"
            >
              Load 728x90 Sample
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => publishSettings({ ...currentSettings(), dashboardAdCode }, 'Dashboard ad code published.')}
              className="rounded-xl border-none bg-amber-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-400 disabled:opacity-60"
            >
              {dashboardAdCode ? 'Save / Edit Ad Code' : 'Save Ad Code'}
            </button>
            {dashboardAdCode && (
              <button
                type="button"
                onClick={() => publishSettings({ ...currentSettings(), dashboardAdCode: '', dashboardAdEnabled: false }, 'Dashboard ad deleted and turned off.')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-none bg-slate-800 px-4 py-2.5 text-xs font-black text-rose-400 hover:bg-slate-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Pin className="h-4 w-4 text-purple-300" />
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-purple-300">Sticky Bottom Ad Banner</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Optional sticky banner shown at the bottom of subscriber, affiliate, and partner dashboards.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`rounded-md px-2.5 py-1 text-[10px] font-black ${stickyEffectivelyEnabled ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                {stickyEffectivelyEnabled ? 'ON' : 'OFF'}
              </span>
              <button
                type="button"
                disabled={!dashboardAdEnabled}
                onClick={() => {
                  const next = !bottomAdEnabled;
                  publishSettings({ ...currentSettings(), bottomAdEnabled: next }, `Sticky bottom ad turned ${next ? 'ON' : 'OFF'}.`);
                }}
                className={`relative h-7 w-14 rounded-full border-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${stickyEffectivelyEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                aria-label="Toggle sticky bottom ad"
                title={!dashboardAdEnabled ? 'Turn Dashboard Ad Placement ON first.' : 'Toggle sticky bottom ad'}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${stickyEffectivelyEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <textarea
            value={bottomAdCode}
            onChange={(event) => setBottomAdCode(event.target.value)}
            placeholder={'<!-- Paste sticky bottom ad code here -->'}
            rows={compact ? 6 : 9}
            className="mt-4 min-h-44 w-full resize-y rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-300 outline-none placeholder:text-slate-600 focus:border-purple-400"
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto]">
            <button
              type="button"
              onClick={() => setBottomAdCode(SAMPLE_STICKY_AD_CODE)}
              className="rounded-xl border-none bg-slate-800 px-4 py-2.5 text-xs font-black text-purple-300 hover:bg-slate-700"
            >
              Load Sticky Sample
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => publishSettings({ ...currentSettings(), bottomAdCode }, 'Sticky bottom ad published.')}
              className="rounded-xl border-none bg-purple-600 px-4 py-2.5 text-xs font-black text-white hover:bg-purple-500 disabled:opacity-60"
            >
              {bottomAdCode ? 'Save / Edit Bottom Ad' : 'Save Bottom Ad'}
            </button>
            {bottomAdCode && (
              <button
                type="button"
                onClick={() => publishSettings({ ...currentSettings(), bottomAdCode: '', bottomAdEnabled: false }, 'Sticky bottom ad deleted and turned off.')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-none bg-slate-800 px-4 py-2.5 text-xs font-black text-rose-400 hover:bg-slate-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
