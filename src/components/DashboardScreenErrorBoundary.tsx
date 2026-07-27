import React, { type ErrorInfo, type ReactNode } from 'react';

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
  declare readonly props: DashboardScreenErrorBoundaryProps;
  declare setState: (state: Partial<DashboardScreenErrorBoundaryState>) => void;
  state: DashboardScreenErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): DashboardScreenErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[DashboardScreenErrorBoundary] Screen render failed', error, info.componentStack);
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

  render() {
    if (!this.state.error) return this.props.children;
    const developmentError = Boolean((import.meta as any).env?.DEV) ? this.state.error.message : '';

    return (
      <section className="mx-auto flex min-h-[55vh] w-full max-w-xl items-center justify-center p-4">
        <div className="w-full rounded-3xl border border-amber-200 bg-white p-7 text-center shadow-sm dark:border-amber-500/20 dark:bg-slate-900">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">This screen could not open</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Your login and business data are still safe. Return to the dashboard and open the screen again.
          </p>
          {developmentError && (
            <code className="mt-3 block rounded-xl bg-slate-100 px-3 py-2 text-left text-xs text-rose-700 dark:bg-slate-950 dark:text-rose-300">
              {developmentError}
            </code>
          )}
          <button
            type="button"
            onClick={this.returnToDashboard}
            className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
          >
            Return to dashboard
          </button>
        </div>
      </section>
    );
  }
}
