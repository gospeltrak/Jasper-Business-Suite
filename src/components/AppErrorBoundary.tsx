import React, { type ErrorInfo, type ReactNode } from 'react';

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

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary] Unhandled dashboard render error', error, info.componentStack);
  }

  private reloadApp = () => {
    window.location.reload();
  };

  private returnToLogin = () => {
    sessionStorage.removeItem('jasper_cashier_user');
    window.location.assign('/login');
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-[100dvh] bg-slate-50 px-6 py-12 text-slate-900 flex items-center justify-center">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl shadow-slate-200/60">
          <img src="/jb-logo.png" alt="Jasper" className="mx-auto h-14 w-14 object-contain" />
          <h1 className="mt-5 text-2xl font-black">Dashboard needs to reload</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
            Your login is safe, but this dashboard screen could not finish loading. Reload the latest app version and try again.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={this.reloadApp}
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Reload dashboard
            </button>
            <button
              type="button"
              onClick={this.returnToLogin}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Back to sign in
            </button>
          </div>
        </section>
      </main>
    );
  }
}
