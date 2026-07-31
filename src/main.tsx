import './utils/onlineStorage';
import './utils/pwaInstallPrompt';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import { ThemeProvider } from './ThemeContext';
import { LanguageProvider } from './LanguageContext';
import { TenantLogoProvider } from './TenantLogoContext';
import { NotificationProvider } from './JasperNotificationContext';
import AppErrorBoundary from './components/AppErrorBoundary';

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

// iOS Safari: the app shell is `position: fixed` (to stop bounce/scroll glitches),
// sized live from `--app-height` (window.visualViewport). When a text input inside
// that fixed shell receives focus, iOS's own "scroll input above keyboard" behavior
// scrolls the layout viewport independently of the visual viewport, desyncing the
// fixed shell from what's actually on screen and leaving a blank gap. Pinning the
// layout viewport back to (0,0) around focus/blur keeps the two in sync.
function pinLayoutViewport() {
  window.scrollTo(0, 0);
}
function isTextEntryElement(el: EventTarget | null): boolean {
  const target = el as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target.isContentEditable;
}
document.addEventListener('focusin', (e) => {
  if (!isTextEntryElement(e.target)) return;
  pinLayoutViewport();
  window.setTimeout(pinLayoutViewport, 50);
  window.setTimeout(pinLayoutViewport, 300);
}, { passive: true });
document.addEventListener('focusout', (e) => {
  if (!isTextEntryElement(e.target)) return;
  window.setTimeout(pinLayoutViewport, 50);
}, { passive: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <TenantLogoProvider>
          <NotificationProvider>
            <AppErrorBoundary>
              <App />
            </AppErrorBoundary>
          </NotificationProvider>
        </TenantLogoProvider>
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
);
