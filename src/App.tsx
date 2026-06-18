import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import AffiliatePortal from './components/AffiliatePortal';
import ToolsHub from './components/ToolsHub';
import { User } from './types';
import { useTheme } from './ThemeContext';
import { useTenantLogo } from './TenantLogoContext';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');
  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('jasper_cashier_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [redirectMessage, setRedirectMessage] = useState<string>('');
  
  const { isDark, toggleTheme } = useTheme();
  const { fetchLogoUrl } = useTenantLogo();

  useEffect(() => {
    if (user?.activeTenant) {
      fetchLogoUrl(user.activeTenant);
    }
  }, [user, fetchLogoUrl]);

  useEffect(() => {
    if (!localStorage.getItem('jasper_lang')) {
      localStorage.setItem('jasper_lang', 'en');
    }
  }, []);

  // Handle browser back and forward button operations
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Intercepting and executing clean internal routing
  const navigateTo = (path: string) => {
    setRedirectMessage('');
    window.history.pushState({}, '', path);
    const baseRoute = path.split('?')[0] || '/';
    setCurrentPath(baseRoute);
  };

  // Perform route protection redirects check
  useEffect(() => {
    if (currentPath === '/dashboard' && !user) {
      setRedirectMessage('Authentication Required. Please log in with a localized staff profile to view dashboard drawers.');
      window.history.pushState({}, '', '/login');
      setCurrentPath('/login');
    }
  }, [currentPath, user]);

  const handleLoginSuccess = (authenticatedUser: User) => {
    setUser(authenticatedUser);
    localStorage.setItem('jasper_cashier_user', JSON.stringify(authenticatedUser));
    navigateTo('/dashboard');
  };

  const handleLogoutSuccess = () => {
    setUser(null);
    localStorage.removeItem('jasper_cashier_user');
    navigateTo('/');
  };

  // Dynamic Component switcher based on pathname
  const renderRoute = () => {
    switch (currentPath) {
      case '/':
        return <LandingPage isDark={isDark} onToggleTheme={toggleTheme} onNavigate={navigateTo} />;
      case '/affiliate':
        return <AffiliatePortal onNavigate={navigateTo} />;
      case '/tools':
        return <ToolsHub isDark={isDark} onToggleTheme={toggleTheme} onNavigate={navigateTo} />;
      case '/login':
        return (
          <LoginPage 
            onLogin={handleLoginSuccess} 
            onNavigate={navigateTo} 
            redirectMessage={redirectMessage} 
            isDark={isDark}
            onToggleTheme={toggleTheme}
          />
        );
      case '/admin':
        return (
          <LoginPage 
            onLogin={handleLoginSuccess} 
            onNavigate={navigateTo} 
            redirectMessage={redirectMessage} 
            isDark={isDark}
            onToggleTheme={toggleTheme}
            isSaasAdminPortal={true}
          />
        );
      case '/dashboard':
        if (user) {
          return (
            <Dashboard 
              user={user} 
              onLogout={handleLogoutSuccess} 
              onNavigate={navigateTo} 
              isDark={isDark}
              onToggleTheme={toggleTheme}
            />
          );
        }
        return null;
      default:
        // Default fallback serves our beautiful styled landing page
        return <LandingPage isDark={isDark} onToggleTheme={toggleTheme} onNavigate={navigateTo} />;
    }
  };

  return (
    <div id="jasper-app-root" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900 transition-colors duration-300">
      {renderRoute()}
    </div>
  );
}
