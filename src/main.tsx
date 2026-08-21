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
  const offsetTop = viewport?.offsetTop || 0;
  const offsetLeft = viewport?.offsetLeft || 0;
  const bottomInset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
  document.documentElement.style.setProperty('--app-height', `${height}px`);
  document.documentElement.style.setProperty('--app-width', `${width}px`);
  document.documentElement.style.setProperty('--visual-viewport-top', `${offsetTop}px`);
  document.documentElement.style.setProperty('--visual-viewport-left', `${offsetLeft}px`);
  document.documentElement.style.setProperty('--browser-bottom-inset', `${bottomInset}px`);
  // Confirmed via an on-device diagnostic: with the keyboard open, #dashboard-scaffold's
  // *actual rendered* height stayed at window.innerHeight (the full, unshrunk layout
  // viewport) even though --app-height above was correctly computed at the smaller
  // visualViewport.height. CSS `height: var(--app-height, 100dvh)` was not taking
  // effect — this device's 100dvh fallback (or the var() itself) was not shrinking for
  // the keyboard the way it should. Setting the height directly, in JS, on the actual
  // element bypasses that entirely.
  const scaffold = document.getElementById('dashboard-scaffold');
  if (scaffold) {
    scaffold.style.height = `${height}px`;
    scaffold.style.maxHeight = `${height}px`;
    // iOS can pan the visual viewport while keeping the layout viewport (and
    // therefore fixed elements) at its original origin. Anchor the fixed app
    // shell to the visual viewport instead of trying to fight that pan with
    // window.scrollTo(), which Safari may ignore while the keyboard animates.
    if (width < 1280) {
      scaffold.style.top = `${offsetTop}px`;
      scaffold.style.left = `${offsetLeft}px`;
    } else {
      scaffold.style.top = '';
      scaffold.style.left = '';
    }
  }
  // Confirmed via the ancestor-chain diagnostic: every element between
  // #workspace-content and #dashboard-scaffold correctly shrinks to the
  // keyboard-open height (they're plain flex-1/min-h-0, no dvh or CSS var
  // involved) -- #workspace-content itself is the one link that doesn't,
  // staying at its full unshrunk content height despite `flex-1 min-h-0
  // overflow-y-auto`. Its ancestor (`overflow:hidden`) then visually clips
  // it, but #workspace-content's own scrollTop/scrollIntoView math still
  // operates against its wrong, oversized box, which is what was landing
  // focused inputs (product search, etc.) in blank space. Compute the
  // actually-available height directly from the DOM (parent height minus
  // its other children) and force it, rather than trust flex to shrink it.
  const workspace = document.getElementById('workspace-content');
  if (workspace) {
    if (width < 1280) {
      const wsParent = workspace.parentElement;
      if (wsParent) {
        let siblingsHeight = 0;
        for (const sibling of Array.from(wsParent.children)) {
          if (sibling !== workspace) siblingsHeight += (sibling as HTMLElement).getBoundingClientRect().height;
        }
        const wsHeight = Math.max(0, wsParent.getBoundingClientRect().height - siblingsHeight);
        workspace.style.height = `${wsHeight}px`;
        workspace.style.maxHeight = `${wsHeight}px`;
      }
    } else {
      workspace.style.height = '';
      workspace.style.maxHeight = '';
    }
  }
  // The Lucy AI chat panel is a `position: fixed` element rendered as a sibling
  // of the scroll container, not a descendant of #dashboard-scaffold's own flex
  // layout — so it never benefited from the height fix above, and its own CSS
  // (`h-[min(680px,calc(var(--app-height,100dvh)-var(--dashboard-bottom-nav-height)-2rem))]`)
  // depends purely on --app-height reactively recomputing through calc(), which is
  // exactly the mechanism confirmed unreliable on-device when the keyboard opens.
  // Force the same formula directly from source values instead of trusting CSS to
  // re-resolve it.
  const lucyPanel = document.querySelector<HTMLElement>('.lucy-copilot-panel');
  if (lucyPanel) {
    if (width < 1280) {
      // Below xl, the panel's own class targets `--app-height - bottom-nav - 2rem`
      // (it clears the mobile bottom nav bar); reproduce that formula here.
      const safeAreaBottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-bottom')) || 0;
      const bottomNavHeight = 64 + safeAreaBottom + bottomInset;
      const lucyHeight = Math.max(160, Math.min(680, height - bottomNavHeight - 32));
      lucyPanel.style.height = `${lucyHeight}px`;
      lucyPanel.style.maxHeight = `${lucyHeight}px`;
    } else {
      // At xl+ the desktop class targets 100dvh - 7rem with no bottom-nav to clear;
      // clear any inline override left over from a narrower viewport.
      lucyPanel.style.height = '';
      lucyPanel.style.maxHeight = '';
    }
  }
  // Same class of bug again: on tablet, #pos-view's split layout
  // (index.css, .pos-tablet-split-grid) is sized with raw `calc(100dvh - 130px)`
  // and `overflow: hidden`, no JS override -- the exact CSS mechanism already
  // confirmed unreliable on-device when the keyboard opens. A stale (unshrunk)
  // #pos-view height can make the browser's scroll-into-view math overshoot
  // into #workspace-content's own bottom padding when the product search
  // input is focused, landing the visible viewport on blank space. Force it
  // from the same reliable source value, scoped to the same tablet range the
  // CSS rule applies to.
  const posView = document.getElementById('pos-view');
  if (posView) {
    if (width >= 768 && width < 1280) {
      const posViewHeight = Math.max(160, height - 130);
      posView.style.height = `${posViewHeight}px`;
      posView.style.maxHeight = `${posViewHeight}px`;
    } else {
      posView.style.height = '';
      posView.style.maxHeight = '';
    }
  }
}

syncViewportVars();
let viewportSyncFrame: number | null = null;
function scheduleViewportSync() {
  if (viewportSyncFrame !== null) return;
  viewportSyncFrame = window.requestAnimationFrame(() => {
    viewportSyncFrame = null;
    syncViewportVars();
  });
}

window.addEventListener('resize', scheduleViewportSync, { passive: true });
window.addEventListener('orientationchange', () => window.setTimeout(scheduleViewportSync, 250), { passive: true });
window.visualViewport?.addEventListener('resize', scheduleViewportSync, { passive: true });
window.visualViewport?.addEventListener('scroll', scheduleViewportSync, { passive: true });
function isTextEntryElement(el: EventTarget | null): boolean {
  const target = el as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target.isContentEditable;
}
// Focus events may arrive just before Safari starts or finishes its keyboard
// animation. Geometry events are the source of truth; these two checkpoints
// only cover versions that occasionally omit one of those events. They never
// change window/workspace scroll positions.
function scheduleKeyboardViewportSync() {
  scheduleViewportSync();
  window.setTimeout(scheduleViewportSync, 100);
  window.setTimeout(scheduleViewportSync, 350);
}
document.addEventListener('focusin', (e) => {
  if (!isTextEntryElement(e.target)) return;
  scheduleKeyboardViewportSync();
}, { passive: true });
document.addEventListener('focusout', (e) => {
  if (!isTextEntryElement(e.target)) return;
  scheduleKeyboardViewportSync();
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
