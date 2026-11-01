import React, { type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

export default class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  declare readonly props: AppErrorBoundaryProps;
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Preserve any active form/checkout. Never silently restart the full app.
    console.error('[AppErrorBoundary] A screen failed to render.', { name: error.name, message: error.message });
  }

  private reloadApp = () => {
    window.location.reload();
  };

  private returnToLogin = () => {
    localStorage.removeItem('jasper_cashier_user');
    window.location.assign('/login');
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-white px-5 py-10 dark:bg-slate-950">
        <section className="w-full max-w-sm text-center">
          <img src="/jb-logo.png" alt="Orvix" className="mx-auto h-16 w-16 object-contain" />
          <h1 className="mt-5 text-xl font-black text-slate-900 dark:text-white">Orvix imepata hitilafu ya muda</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Mfumo hautajireload wenyewe. Hifadhi taarifa zozote muhimu kabla ya kubonyeza Refresh.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" onClick={this.reloadApp} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700"><RefreshCw className="h-4 w-4" /> Refresh</button>
            <button type="button" onClick={this.returnToLogin} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Login</button>
          </div>
        </section>
      </main>
    );
  }
}
