import { useState, useEffect, useRef } from 'react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import AffiliatePortal from './components/AffiliatePortal';
import ToolsHub from './components/ToolsHub';
import JasperSplashScreen from './components/JasperSplashScreen';
import { User } from './types';
import { useTheme } from './ThemeContext';
import { useTenantLogo } from './TenantLogoContext';

export default function App() {
  const normalizePath = (path: string) => {
    const clean = (path || '/').split('?')[0].replace(/\/+$/, '');
    return clean || '/';
  };

  const dashboardRouteMap: Record<string, string | undefined> = {
    '/dashboard': undefined,
    '/sales': 'sales-list',
    '/dashboard/sales': 'sales-list',
    '/sales-list': 'sales-list',
    '/dashboard/sales-list': 'sales-list',
    '/reports': 'reports',
    '/dashboard/reports': 'reports',
    '/pos': 'pos',
    '/dashboard/pos': 'pos',
    '/products': 'products',
    '/dashboard/products': 'products',
    '/settings': 'settings',
    '/dashboard/settings': 'settings'
  };

  const isDashboardRoute = (path: string) => (
    path === '/dashboard' ||
    path.startsWith('/dashboard/') ||
    Object.prototype.hasOwnProperty.call(dashboardRouteMap, path)
  );

  const getDashboardTab = (path: string) => {
    if (Object.prototype.hasOwnProperty.call(dashboardRouteMap, path)) {
      return dashboardRouteMap[path];
    }

    if (path.startsWith('/dashboard/')) {
      const shortPath = `/${path.replace(/^\/dashboard\//, '')}`;
      return dashboardRouteMap[shortPath];
    }

    return undefined;
  };

  const [currentPath, setCurrentPath] = useState<string>(() => normalizePath(window.location.pathname || '/'));
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem('jasper_cashier_user');
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      console.error('Failed to load saved user session', err);
      localStorage.removeItem('jasper_cashier_user');
      return null;
    }
  });
  const [redirectMessage, setRedirectMessage] = useState<string>('');
  
  const { isDark, toggleTheme } = useTheme();
  const { fetchLogoUrl, logoUrl } = useTenantLogo();

  // Splash: show once per session when user first enters dashboard
  const [showSplash, setShowSplash] = useState(false);
  const splashShownRef = useRef(false);

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
      setCurrentPath(normalizePath(window.location.pathname || '/'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Intercepting and executing clean internal routing
  const navigateTo = (path: string) => {
    setRedirectMessage('');
    window.history.pushState({}, '', path);
    setCurrentPath(normalizePath(path));
  };

  // Perform route protection redirects check
  useEffect(() => {
    if (isDashboardRoute(currentPath) && !user) {
      setRedirectMessage('Please log in to continue.');
      window.history.replaceState({}, '', '/login');
      setCurrentPath('/login');
    }
  }, [currentPath, user]);

  const handleLoginSuccess = (authenticatedUser: User) => {
    setUser(authenticatedUser);
    localStorage.setItem('jasper_cashier_user', JSON.stringify(authenticatedUser));
    // Show splash on fresh login — only once per session
    if (!splashShownRef.current) {
      splashShownRef.current = true;
      setShowSplash(true);
    }
    navigateTo('/dashboard');
  };

  const handleLogoutSuccess = () => {
    setUser(null);
    localStorage.removeItem('jasper_cashier_user');
    navigateTo('/');
  };

  // Dynamic Component switcher based on pathname
  const renderRoute = () => {
    if (currentPath === '/login' || currentPath.startsWith('/login/')) {
      return (
        <LoginPage
          onLogin={handleLoginSuccess}
          onNavigate={navigateTo}
          redirectMessage={redirectMessage}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />
      );
    }

    if (currentPath === '/affiliate' || currentPath.startsWith('/affiliate/')) {
      if (!splashShownRef.current) { splashShownRef.current = true; setShowSplash(true); }
      return <AffiliatePortal onNavigate={navigateTo} forcedRole="affiliate" />;
    }
    if (currentPath === '/partner' || currentPath.startsWith('/partner/')) {
      if (!splashShownRef.current) { splashShownRef.current = true; setShowSplash(true); }
      return <AffiliatePortal onNavigate={navigateTo} forcedRole="partner" />;
    }

    if (isDashboardRoute(currentPath)) {
      if (user) {
        return (
          <Dashboard
            user={user}
            onLogout={handleLogoutSuccess}
            onNavigate={navigateTo}
            isDark={isDark}
            onToggleTheme={toggleTheme}
            initialTab={getDashboardTab(currentPath)}
          />
        );
      }

      return (
        <LoginPage
          onLogin={handleLoginSuccess}
          onNavigate={navigateTo}
          redirectMessage={redirectMessage || 'Please log in to continue.'}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />
      );
    }

    switch (currentPath) {
      case '/':
        return <LandingPage isDark={isDark} onToggleTheme={toggleTheme} onNavigate={navigateTo} />;
      case '/tools':
        return <ToolsHub isDark={isDark} onToggleTheme={toggleTheme} onNavigate={navigateTo} />;
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
      default:
        // Default fallback serves our beautiful styled landing page
        return <LandingPage isDark={isDark} onToggleTheme={toggleTheme} onNavigate={navigateTo} />;
    }
  };

  // Allow landing page to scroll — unlock body/html/root when not in dashboard/login
  useEffect(() => {
    const isDashboard = isDashboardRoute(currentPath) || currentPath === '/login' || currentPath.startsWith('/affiliate') || currentPath.startsWith('/partner');
    const root = document.getElementById('root');
    if (isDashboard) {
      // Dashboard / app — fully locked (native app behaviour)
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.height = '100%';
      document.body.style.position = 'fixed';
      document.body.style.overflow = 'hidden';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      if (root) {
        root.style.overflow = 'hidden';
        root.style.height = '100dvh';
        root.removeAttribute('data-page');
      }
    } else {
      // Landing page — fully unlocked, normal web scroll
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.position = '';
      document.body.style.overflow = '';
      document.body.style.width = '';
      document.body.style.height = '';
      if (root) {
        root.style.overflow = 'auto';
        root.style.height = 'auto';
        root.style.position = 'relative';
        root.setAttribute('data-page', 'landing');
      }
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.position = '';
      document.body.style.overflow = '';
      document.body.style.width = '';
      document.body.style.height = '';
      if (root) {
        root.style.overflow = '';
        root.style.height = '';
        root.removeAttribute('data-page');
      }
    };
  }, [currentPath]);

  // Resolve logo: tenant custom logo → system default
  const splashLogo = logoUrl || '/jasper_logo_transparent.png';

  return (
    <div id="jasper-app-root" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900 transition-colors duration-300">
      {/* Premium animated splash — shown only on fresh dashboard login */}
      {showSplash && (
        <JasperSplashScreen
          logoSrc={splashLogo}
          duration={2600}
          onFinish={() => setShowSplash(false)}
        />
      )}
      {renderRoute()}
    </div>
  );
}
