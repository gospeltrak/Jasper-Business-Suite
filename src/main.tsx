import './utils/onlineStorage';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import AppErrorBoundary from './components/AppErrorBoundary';
import './index.css';
import { ThemeProvider } from './ThemeContext';
import { LanguageProvider } from './LanguageContext';
import { TenantLogoProvider } from './TenantLogoContext';

function syncViewportVars() {
  const viewport = window.visualViewport;
  const height = viewport?.height || window.innerHeight;
  const width = viewport?.width || window.innerWidth;
  const bottomInset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
  document.documentElement.style.setProperty('--app-height', `${height}px`);
  document.documentElement.style.setProperty('--app-width', `${width}px`);
  document.documentElement.style.setProperty('--browser-bottom-inset', `${bottomInset}px`);
}

syncViewportVars();
window.addEventListener('resize', syncViewportVars, { passive: true });
window.addEventListener('orientationchange', () => window.setTimeout(syncViewportVars, 250), { passive: true });
window.visualViewport?.addEventListener('resize', syncViewportVars, { passive: true });
window.visualViewport?.addEventListener('scroll', syncViewportVars, { passive: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <TenantLogoProvider>
              <App />
          </TenantLogoProvider>
        </LanguageProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
// Sat Jul 18 18:28:48 UTC 2026
