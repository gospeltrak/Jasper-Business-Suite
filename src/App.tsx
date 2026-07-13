import { useState, useEffect, useRef } from 'react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import AffiliatePortal from './components/AffiliatePortal';
import ToolsHub from './components/ToolsHub';
import JasperSplashScreen from './components/JasperSplashScreen';
import { User, Tenant } from './types';
import { useTheme } from './ThemeContext';
import { useTenantLogo } from './TenantLogoContext';
import { getSecureDataBridgeClient, isPlaceholderSecureDataBridgeClient } from './secureDataBridge';
import { endCloudSession, touchCloudSession } from './utils/sessionControl';

type TenantDomainContext = {
  kind: 'loading' | 'landing' | 'app' | 'tenant' | 'tenant-not-found' | 'tenant-inactive' | 'error';
  host?: string;
  baseDomain?: string;
  subdomain?: string;
  tenant?: Tenant | null;
  message?: string;
};

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
  const [tenantDomainContext, setTenantDomainContext] = useState<TenantDomainContext>({ kind: 'loading' });
  
  const { isDark, toggleTheme } = useTheme();
  const { fetchLogoUrl, logoUrl } = useTenantLogo();

  // Splash: show once per session when user first enters dashboard
  const [showSplash, setShowSplash] = useState(false);
  const splashShownRef = useRef(false);
  const publicLandingUrl = tenantDomainContext.baseDomain ? `https://${tenantDomainContext.baseDomain}/` : undefined;

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

  useEffect(() => {
    let cancelled = false;
    const resolveCurrentHost = async () => {
      try {
        const response = await fetch(`/api/tenant/resolve?host=${encodeURIComponent(window.location.host)}`, { cache: 'no-store' });
        const payload = await response.json();
        if (cancelled) return;
        setTenantDomainContext({
          kind: payload?.kind || 'app',
          host: payload?.host,
          baseDomain: payload?.baseDomain,
          subdomain: payload?.subdomain,
          tenant: payload?.tenant || null,
          message: payload?.message || payload?.warning || undefined
        });
      } catch (error) {
        if (!cancelled) {
          setTenantDomainContext({ kind: 'app', host: window.location.hostname, message: 'Domain resolver unavailable.' });
        }
      }
    };
    resolveCurrentHost();
    return () => { cancelled = true; };
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

  const getSessionUserKey = (sessionUser: User) => sessionUser.id || sessionUser.phone || sessionUser.email || sessionUser.name;

  const getSessionTenantId = (sessionUser: User) => sessionUser.tenantId || sessionUser.activeTenant || 'default';

  const getAuthenticatedRoute = (sessionUser: User) => {
    if (sessionUser.role === 'Partner' || sessionUser.portal_role === 'partner') return '/partner';
    if (sessionUser.role === 'Affiliate' || sessionUser.portal_role === 'affiliate') return '/affiliate';
    return '/dashboard';
  };

  const getDeviceLabel = () => {
    const width = window.innerWidth;
    if (width < 768) return 'Mobile';
    if (width < 1024) return 'Tablet';
    return 'Desktop';
  };

  const recordStaffLogin = (sessionUser: User) => {
    const tenantId = getSessionTenantId(sessionUser);
    const userKey = getSessionUserKey(sessionUser);
    const sessionsKey = `jasper_staff_sessions_${tenantId}`;
    const activeSessionKey = `jasper_active_staff_session_${tenantId}_${userKey}`;
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const existingSessions = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
      const cleanedSessions = existingSessions.map((session: any) => {
        const sameUser = session.staffId === sessionUser.id || session.userId === userKey;
        if (!sameUser || session.logoutAt) return session;
        const logoutAt = new Date().toISOString();
        return {
          ...session,
          logoutAt,
          durationMs: Math.max(0, new Date(logoutAt).getTime() - new Date(session.loginAt).getTime()),
          status: 'offline'
        };
      });

      const nextSession = {
        id: sessionId,
        userId: userKey,
        staffId: sessionUser.id,
        staffName: sessionUser.name,
        phone: sessionUser.phone,
        email: sessionUser.email,
        role: sessionUser.role,
        tenantId,
        loginAt: new Date().toISOString(),
        logoutAt: null,
        durationMs: 0,
        status: 'online',
        device: getDeviceLabel()
      };

      localStorage.setItem(sessionsKey, JSON.stringify([nextSession, ...cleanedSessions].slice(0, 500)));
      localStorage.setItem(activeSessionKey, sessionId);
      const statusKey = `jasper_staff_statuses_${tenantId}`;
      const statusMap = JSON.parse(localStorage.getItem(statusKey) || '{}');
      statusMap[sessionUser.id] = true;
      localStorage.setItem(statusKey, JSON.stringify(statusMap));
    } catch (error) {
      console.warn('Failed to record staff login session', error);
    }
  };

  const recordStaffLogout = (sessionUser: User | null) => {
    if (!sessionUser) return;
    const tenantId = getSessionTenantId(sessionUser);
    const userKey = getSessionUserKey(sessionUser);
    const sessionsKey = `jasper_staff_sessions_${tenantId}`;
    const activeSessionKey = `jasper_active_staff_session_${tenantId}_${userKey}`;

    try {
      const activeSessionId = localStorage.getItem(activeSessionKey);
      const logoutAt = new Date().toISOString();
      const sessions = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
      const updatedSessions = sessions.map((session: any) => {
        const sameSession = activeSessionId ? session.id === activeSessionId : session.userId === userKey && !session.logoutAt;
        if (!sameSession) return session;
        return {
          ...session,
          logoutAt,
          durationMs: Math.max(0, new Date(logoutAt).getTime() - new Date(session.loginAt).getTime()),
          status: 'offline'
        };
      });
      localStorage.setItem(sessionsKey, JSON.stringify(updatedSessions));
      localStorage.removeItem(activeSessionKey);

      const statusKey = `jasper_staff_statuses_${tenantId}`;
      const statusMap = JSON.parse(localStorage.getItem(statusKey) || '{}');
      statusMap[sessionUser.id] = false;
      localStorage.setItem(statusKey, JSON.stringify(statusMap));
    } catch (error) {
      console.warn('Failed to record staff logout session', error);
    }
  };

  // Perform route protection redirects check
  useEffect(() => {
    if ((currentPath === '/login' || currentPath.startsWith('/login/')) && user) {
      const targetPath = getAuthenticatedRoute(user);
      window.history.replaceState({}, '', targetPath);
      setCurrentPath(targetPath);
      return;
    }

    if (tenantDomainContext.kind === 'tenant' && user) {
      const userTenantId = user.tenantId || user.activeTenant;
      const isPlatformAdmin = user.role === 'SuperAdmin' || user.isSaaSStaff;
      if (!isPlatformAdmin && userTenantId !== tenantDomainContext.tenant?.id) {
        recordStaffLogout(user);
        setUser(null);
        localStorage.removeItem('jasper_cashier_user');
        setRedirectMessage(`Please log in with an account for ${tenantDomainContext.tenant?.name || 'this business'}.`);
        window.history.replaceState({}, '', '/login');
        setCurrentPath('/login');
        return;
      }
    }
    if (isDashboardRoute(currentPath) && !user) {
      setRedirectMessage('Please log in to continue.');
      window.history.replaceState({}, '', '/login');
      setCurrentPath('/login');
      return;
    }
    // Redirect affiliate/partner away from dashboard to their own portal
    if (isDashboardRoute(currentPath) && user) {
      if (user.role === 'Partner' || user.portal_role === 'partner') {
        setCurrentPath('/partner');
        return;
      }
      if (user.role === 'Affiliate' || user.portal_role === 'affiliate') {
        setCurrentPath('/affiliate');
        return;
      }
    }
  }, [currentPath, user, tenantDomainContext]);

  useEffect(() => {
    if (user || tenantDomainContext.kind === 'loading') return;
    let cancelled = false;

    const restoreCloudSession = async () => {
      try {
        const client: any = await getSecureDataBridgeClient();
        if (isPlaceholderSecureDataBridgeClient(client)) return;

        const { data: sessionData } = await client.auth.getSession();
        const authUser = sessionData?.session?.user;
        if (!authUser?.id) return;

        const { data: userProfile, error: profileError } = await client
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (cancelled || profileError || !userProfile) return;

        const isPlatformAdmin = userProfile?.account_type === 'super_admin' ||
          ['superadmin', 'super_admin'].includes(String(userProfile?.role_key || userProfile?.role || '').toLowerCase());
        const profileTenantId = userProfile?.tenant_id || userProfile?.active_tenant;
        if (!profileTenantId && !isPlatformAdmin) return;

        const restoredUser: User = {
          id: userProfile.id,
          email: userProfile.email || authUser.email || '',
          name: userProfile.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
          role: isPlatformAdmin ? 'SuperAdmin' : (userProfile.role || 'Admin'),
          tenantId: userProfile.tenant_id || 'platform-control',
          activeTenant: userProfile.active_tenant || userProfile.tenant_id || 'platform-control',
          phone: userProfile.phone || authUser.user_metadata?.phone || undefined,
          isSaaSStaff: userProfile.is_saas_staff || false,
          saasPermissions: userProfile.role_permissions || undefined,
          profileImage: userProfile.profile_image_url || undefined
        };

        setUser(restoredUser);
        localStorage.setItem('jasper_cashier_user', JSON.stringify(restoredUser));

        if (currentPath === '/login' || currentPath.startsWith('/login/')) {
          const targetPath = getAuthenticatedRoute(restoredUser);
          window.history.replaceState({}, '', targetPath);
          setCurrentPath(targetPath);
        }
      } catch (error) {
        console.warn('Cloud session restore skipped', error);
      }
    };

    restoreCloudSession();
    return () => { cancelled = true; };
  }, [currentPath, tenantDomainContext.kind, user]);

  const handleLoginSuccess = (authenticatedUser: User) => {
    const domainTenantId = tenantDomainContext.kind === 'tenant' ? tenantDomainContext.tenant?.id : null;
    const userTenantId = authenticatedUser.tenantId || authenticatedUser.activeTenant;
    const isPlatformAdmin = authenticatedUser.role === 'SuperAdmin' || authenticatedUser.isSaaSStaff;
    if (domainTenantId && !isPlatformAdmin && userTenantId !== domainTenantId) {
      setRedirectMessage(`This account does not belong to ${tenantDomainContext.tenant?.name || 'this business'}. Please use the correct business login.`);
      return;
    }
    recordStaffLogin(authenticatedUser);
    setUser(authenticatedUser);
    localStorage.setItem('jasper_cashier_user', JSON.stringify(authenticatedUser));
    // Show splash on fresh login — only once per session
    if (!splashShownRef.current) {
      splashShownRef.current = true;
      setShowSplash(true);
    }
    // Route based on role — Partner and Affiliate get their own portals
    navigateTo(getAuthenticatedRoute(authenticatedUser));
  };

  useEffect(() => {
    if (!user) return;
    touchCloudSession();
    const heartbeat = window.setInterval(() => { touchCloudSession(); }, 5 * 60 * 1000);
    return () => window.clearInterval(heartbeat);
  }, [user?.id]);

  const handleLogoutSuccess = async () => {
    recordStaffLogout(user);
    await endCloudSession();
    setUser(null);
    localStorage.removeItem('jasper_cashier_user');
    navigateTo('/');
  };

  // Dynamic Component switcher based on pathname
  const renderRoute = () => {
    if (tenantDomainContext.kind === 'loading') {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-6 text-center">
          <div className="space-y-3">
            <img src="/jb-logo.png" alt="Ndiva Suite Logo" className="w-14 h-14 object-contain mx-auto animate-pulse" />
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Loading Ndiva Suite</p>
          </div>
        </div>
      );
    }

    if (tenantDomainContext.kind === 'tenant-not-found' || tenantDomainContext.kind === 'tenant-inactive' || tenantDomainContext.kind === 'error') {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <img src="/jb-logo.png" alt="Ndiva Suite Logo" className="mx-auto h-14 w-14 object-contain" />
            <h1 className="mt-4 text-2xl font-black text-slate-900 dark:text-white">
              {tenantDomainContext.kind === 'tenant-inactive' ? 'Business Domain Inactive' : 'Tenant Not Found'}
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              {tenantDomainContext.message || 'We could not find an active business for this domain.'}
            </p>
          </div>
        </div>
      );
    }

    if (currentPath === '/login' || currentPath.startsWith('/login/')) {
      return (
        <LoginPage
          onLogin={handleLoginSuccess}
          onNavigate={navigateTo}
          redirectMessage={redirectMessage}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          resolvedTenant={tenantDomainContext.kind === 'tenant' ? tenantDomainContext.tenant || undefined : undefined}
          domainMode={tenantDomainContext.kind === 'tenant' ? 'tenant' : tenantDomainContext.kind === 'landing' ? 'root' : 'app'}
          landingUrl={publicLandingUrl}
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
          resolvedTenant={tenantDomainContext.kind === 'tenant' ? tenantDomainContext.tenant || undefined : undefined}
          domainMode={tenantDomainContext.kind === 'tenant' ? 'tenant' : tenantDomainContext.kind === 'landing' ? 'root' : 'app'}
          landingUrl={publicLandingUrl}
        />
      );
    }

    switch (currentPath) {
      case '/':
        if (tenantDomainContext.kind === 'tenant') {
          if (user) {
            return (
              <Dashboard
                user={user}
                onLogout={handleLogoutSuccess}
                onNavigate={navigateTo}
                isDark={isDark}
                onToggleTheme={toggleTheme}
                initialTab={getDashboardTab('/dashboard')}
              />
            );
          }
          return (
            <LoginPage
              onLogin={handleLoginSuccess}
              onNavigate={navigateTo}
              redirectMessage={redirectMessage}
              isDark={isDark}
              onToggleTheme={toggleTheme}
              resolvedTenant={tenantDomainContext.tenant || undefined}
              domainMode="tenant"
              landingUrl={publicLandingUrl}
            />
          );
        }
        if (tenantDomainContext.kind === 'app') {
          return (
            <LoginPage
              onLogin={handleLoginSuccess}
              onNavigate={navigateTo}
              redirectMessage={redirectMessage}
              isDark={isDark}
              onToggleTheme={toggleTheme}
              domainMode="app"
              landingUrl={publicLandingUrl}
            />
          );
        }
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
            domainMode="app"
            landingUrl={publicLandingUrl}
          />
        );
      default:
        // Default fallback serves our beautiful styled landing page
        return <LandingPage isDark={isDark} onToggleTheme={toggleTheme} onNavigate={navigateTo} />;
    }
  };

  // Allow landing page to scroll — toggle class on <html> element per route
  useEffect(() => {
    const isDashboard = isDashboardRoute(currentPath);

    // These are full web pages that must scroll freely (not native-app locked)
    const isScrollablePage = currentPath === '/'
      || currentPath === '/login'
      || currentPath.startsWith('/affiliate')
      || currentPath.startsWith('/partner');

    const html = document.documentElement;
    const root = document.getElementById('root');

    if (isDashboard) {
      // Dashboard — remove landing class, enforce native-app lock
      html.classList.remove('landing-page');
      html.style.overflow = 'hidden';
      html.style.height = '100%';
      document.body.style.position = 'fixed';
      document.body.style.overflow = 'hidden';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      if (root) {
        root.style.overflow = 'hidden';
        root.style.height = 'var(--app-height, 100dvh)';
        root.removeAttribute('data-page');
      }
    } else if (isScrollablePage) {
      // Affiliate / Partner portals + landing — always scrollable
      html.classList.add('landing-page');
      html.style.overflow = 'auto';
      html.style.height = '';
      document.body.style.position = '';
      document.body.style.overflow = 'auto';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.bottom = '';
      if (root) {
        root.style.overflow = 'auto';
        root.style.height = '';
        root.style.position = '';
        root.setAttribute('data-page', 'landing');
      }
      window.scrollTo(0, 0);
    }

    return () => {
      html.classList.remove('landing-page');
      // Inline styles are re-applied fresh on every route change by this
      // same effect, so no explicit reset is needed here.
    };
  }, [currentPath]);

  // Resolve logo: tenant custom logo → system default
  const splashLogo = logoUrl || '/jasper_logo_transparent.png';

  return (
    <div id="jasper-app-root" className="app-shell min-h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900 transition-colors duration-300">
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
