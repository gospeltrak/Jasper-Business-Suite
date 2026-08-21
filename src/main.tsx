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

// TEMPORARY DIAGNOSTIC — remove once the iOS blank-on-keyboard-focus bug is
// confirmed fixed. Shows live viewport numbers on screen so a screenshot
// taken at the moment of the blank screen tells us the real values instead
// of guessing at them.
let debugOverlayEl: HTMLDivElement | null = null;
function updateDebugOverlay() {
  if (typeof document === 'undefined') return;
  if (!debugOverlayEl) {
    debugOverlayEl = document.createElement('div');
    debugOverlayEl.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:rgba(220,38,38,0.95);color:#fff;font:10px/1.4 monospace;padding:4px 6px;pointer-events:none;white-space:pre-wrap;';
    document.body.appendChild(debugOverlayEl);
  }
  const vv = window.visualViewport;
  const scaffold = document.getElementById('dashboard-scaffold');
  const workspace = document.getElementById('workspace-content');
  const active = document.activeElement;
  // Pinpoints exactly which ancestor between #workspace-content and
  // #dashboard-scaffold fails to shrink to the keyboard-open height: walks
  // parentElement from workspace up to (and including) scaffold, recording
  // each rendered box height. A flex chain that's correctly shrinking should
  // read the same small number all the way up; the first jump to a much
  // larger number identifies the broken link.
  let chain = 'n/a';
  if (workspace && scaffold) {
    const heights: number[] = [];
    let el: HTMLElement | null = workspace;
    let guard = 0;
    while (el && guard < 8) {
      heights.push(Math.round(el.getBoundingClientRect().height));
      if (el === scaffold) break;
      el = el.parentElement;
      guard++;
    }
    chain = heights.join('>');
  }
  debugOverlayEl.textContent =
    `innerH/W=${window.innerHeight}/${window.innerWidth} vv.h/w/top=${vv?.height ?? '-'}/${vv?.width ?? '-'}/${vv?.offsetTop ?? '-'} `
    + `appH=${getComputedStyle(document.documentElement).getPropertyValue('--app-height')} `
    + `scaffoldH=${scaffold ? Math.round(scaffold.getBoundingClientRect().height) : 'none'} `
    + `wsH=${workspace ? Math.round(workspace.getBoundingClientRect().height) : 'none'} wsScrollH=${workspace?.scrollHeight ?? '-'} wsScrollTop=${workspace?.scrollTop ?? '-'} `
    + `chain(ws→scaffold)=${chain} `
    + `active=${active?.tagName}${active?.id ? '#' + active.id : ''}`;
}

function syncViewportVars() {
  const viewport = window.visualViewport;
  const height = viewport?.height || window.innerHeight;
  const width = viewport?.width || window.innerWidth;
  const bottomInset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
  document.documentElement.style.setProperty('--app-height', `${height}px`);
  document.documentElement.style.setProperty('--app-width', `${width}px`);
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
  }
  updateDebugOverlay();
}

// iOS Safari: the app shell is `position: fixed` (to stop bounce/scroll glitches),
// sized live from `--app-height` (window.visualViewport). When a text input inside
// that fixed shell receives focus, iOS's own "scroll input above keyboard" behavior
// scrolls the layout viewport independently of the visual viewport, desyncing the
// fixed shell from what's actually on screen and leaving a blank gap. Pinning the
// layout viewport back to (0,0) around focus/blur keeps the two in sync.
//
// Confirmed via the on-device diagnostic: once #dashboard-scaffold's height
// was fixed to actually shrink for the keyboard, the screen was STILL blank
// because this used to force #workspace-content's scrollTop back to 0
// unconditionally — hiding the focused field below the now-smaller visible
// area instead of showing it. When a text field is focused, scroll it into
// view within its container instead of resetting to the top; only reset to
// the top when nothing text-entry is focused (e.g. keyboard closing).
function pinLayoutViewport() {
  window.scrollTo(0, 0);
  const workspace = document.getElementById('workspace-content');
  if (!workspace) return;
  const active = document.activeElement;
  if (isTextEntryElement(active) && workspace.contains(active as Node)) {
    (active as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } else {
    workspace.scrollTop = 0;
  }
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
