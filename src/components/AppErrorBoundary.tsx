import React, { type ReactNode } from 'react';
import SystemErrorPage from './SystemErrorPage';

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

  componentDidCatch() {
    console.error('[AppErrorBoundary] A screen failed to render.');
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
    return <SystemErrorPage status={500} onRetry={this.reloadApp} onBack={this.returnToLogin} />;
  }
}
