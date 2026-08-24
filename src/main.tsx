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
      // The workspace's flex parent can retain its pre-keyboard content height
      // on iOS (for example 996px while the visual viewport/scaffold is only
      // 323px tall). Measuring that parent therefore recreates the bad height.
      // Derive the remaining space directly from the visual-viewport-sized
      // scaffold and the workspace's rendered top edge, then make the flex item
      // an exact-height viewport. This common path covers every dashboard search
      // input on phone and tablet (Stock, Sales, POS, etc.).
      if (scaffold) {
        const scaffoldRect = scaffold.getBoundingClientRect();
        const workspaceRect = workspace.getBoundingClientRect();
        const workspaceTop = Math.max(scaffoldRect.top, workspaceRect.top);
        const wsHeight = Math.max(0, scaffoldRect.bottom - workspaceTop);
        workspace.style.height = `${wsHeight}px`;
        workspace.style.maxHeight = `${wsHeight}px`;
        workspace.style.flexBasis = `${wsHeight}px`;
        workspace.style.flexGrow = '0';
        workspace.style.flexShrink = '0';
      }
    } else {
      workspace.style.height = '';
      workspace.style.maxHeight = '';
      workspace.style.flexBasis = '';
      workspace.style.flexGrow = '';
      workspace.style.flexShrink = '';
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
//
// Deliberately no immediate/rAF pass here (there used to be one): it ran
// before the keyboard animation had started, so it applied a snap based on
// pre-keyboard geometry right as the user's tap was landing -- on some
// devices that coincided with the input receiving focus closely enough to
// interrupt it, making the very first tap on any field appear to not
// register (a retry after the 100ms/350ms passes settled always worked).
// The two delayed passes plus the native visualViewport resize/scroll
// listeners below are enough to still correct the layout once the keyboard
// is actually animating.
function scheduleKeyboardViewportSync() {
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
