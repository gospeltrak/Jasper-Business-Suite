import React, { type ReactNode } from 'react';
import SystemErrorPage from './SystemErrorPage';

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

  componentDidCatch() {
    console.error('[DashboardScreenErrorBoundary] A dashboard screen failed to render.');
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
    return <SystemErrorPage status={500} onRetry={this.reloadUpdatedApp} onBack={this.returnToDashboard} />;
  }
}
