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

// iOS Safari: the app shell is `position: fixed` (to stop bounce/scroll glitches),
// sized live from `--app-height` (window.visualViewport). When a text input inside
// that fixed shell receives focus, iOS's own "scroll input above keyboard" behavior
// scrolls the layout viewport independently of the visual viewport, desyncing the
// fixed shell from what's actually on screen and leaving a blank gap. Pinning the
// layout viewport back to (0,0) around focus/blur keeps the two in sync.
function pinLayoutViewport() {
  window.scrollTo(0, 0);
}

syncViewportVars();
window.addEventListener('resize', syncViewportVars, { passive: true });
window.addEventListener('orientationchange', () => window.setTimeout(syncViewportVars, 250), { passive: true });
// The keyboard closing (e.g. blurring one field to tap a checkbox) also fires a
// visualViewport resize as its height grows back -- re-pin here too, not just on
// focus/blur, since that resize is exactly when the layout/visual viewport can drift.
function handleVisualViewportGeometryChange() {
  syncViewportVars();
  pinLayoutViewport();
}
window.visualViewport?.addEventListener('resize', handleVisualViewportGeometryChange, { passive: true });
window.visualViewport?.addEventListener('scroll', handleVisualViewportGeometryChange, { passive: true });
function isTextEntryElement(el: EventTarget | null): boolean {
  const target = el as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target.isContentEditable;
}
// Two checkpoints (50ms/300ms) assumed a fairly fixed, fast keyboard
// animation. Older iOS/iPadOS Safari versions (pre-16.4, where
// interactive-widget=resizes-content in index.html isn't recognized and
// this JS path is the only mitigation) can take noticeably longer and less
// predictably to finish animating the keyboard in/out, so a wider, denser
// set of checkpoints — covering the same overall window plus a bit more —
// gives more chances to catch the moment the layout viewport actually
// drifts, instead of missing it between two widely-spaced checks.
const VIEWPORT_REPIN_DELAYS_MS = [16, 50, 100, 150, 250, 350, 500];
function schedulePinLayoutViewport() {
  syncViewportVars();
  pinLayoutViewport();
  for (const delay of VIEWPORT_REPIN_DELAYS_MS) {
    window.setTimeout(() => { syncViewportVars(); pinLayoutViewport(); }, delay);
  }
}
document.addEventListener('focusin', (e) => {
  if (!isTextEntryElement(e.target)) return;
  schedulePinLayoutViewport();
}, { passive: true });
document.addEventListener('focusout', (e) => {
  if (!isTextEntryElement(e.target)) return;
  schedulePinLayoutViewport();
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
