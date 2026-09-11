import React, { type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

type DashboardScreenErrorBoundaryProps = {
  children: ReactNode;
  resetKey: string;
  onReturnToDashboard: () => void;
};

type DashboardScreenErrorBoundaryState = {
  error: Error | null;
};

export default class DashboardScreenErrorBoundary extends React.Component<
  DashboardScreenErrorBoundaryProps,
  DashboardScreenErrorBoundaryState
> {
  state: DashboardScreenErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): DashboardScreenErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[DashboardScreenErrorBoundary] A dashboard screen failed to render.', { name: error.name });
    // Keep the dashboard shell alive. A transient lazy-screen/render failure
    // should return to the safe landing tab instead of becoming a full 500 page.
    window.setTimeout(this.props.onReturnToDashboard, 0);
  }

  componentDidUpdate(previousProps: DashboardScreenErrorBoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private returnToDashboard = () => {
    this.setState({ error: null });
    this.props.onReturnToDashboard();
  };

  private reloadUpdatedApp = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="flex min-h-[55vh] items-center justify-center px-5 py-10" role="status" aria-live="polite">
        <div className="w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <img src="/jb-logo.png" alt="Orvix" className="mx-auto h-14 w-14 object-contain" />
          <h2 className="mt-4 text-lg font-black text-slate-900 dark:text-white">Tunarudisha sehemu yako</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Subiri kidogo, tunafungua Dashboard salama bila kupoteza taarifa zako.</p>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" onClick={this.returnToDashboard} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">Dashboard</button>
            <button type="button" onClick={this.reloadUpdatedApp} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"><RefreshCw className="h-4 w-4" /> Refresh</button>
          </div>
        </div>
      </section>
    );
  }
}
