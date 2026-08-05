import { state } from './state.js';
import { t } from './i18n.js';
import { toast, applyLang, applyTheme } from './ui.js';

// ── PWA INSTALL ──
const INSTALL_SNOOZE_KEY = 'installBannerSnoozeUntil';
const INSTALL_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); state.deferredPrompt = e;
  const snoozeUntil = parseInt(localStorage.getItem(INSTALL_SNOOZE_KEY), 10);
  if (snoozeUntil && Date.now() < snoozeUntil) return;
  document.getElementById('install-banner').classList.add('visible');
});

function installApp() {
  if (!state.deferredPrompt) return;
  state.deferredPrompt.prompt(); state.deferredPrompt.userChoice.then(() => { state.deferredPrompt = null; dismissInstall(); });
}

function dismissInstall() { document.getElementById('install-banner').classList.remove('visible'); }

function snoozeInstallBanner() {
  localStorage.setItem(INSTALL_SNOOZE_KEY, String(Date.now() + INSTALL_SNOOZE_MS));
  dismissInstall();
}

window.addEventListener('appinstalled', () => { dismissInstall(); toast(t('appInstalled')); });

// ── SERVICE WORKER ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});

  // A new SW can take control (skipWaiting + clients.claim in sw.js) mid-
  // session, after the page's own CSS/JS requests already raced against the
  // old cache — reload once so the page picks up a fully consistent set of
  // assets instead of running with fresh HTML against stale CSS/JS.
  let swRefreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swRefreshing) return;
    swRefreshing = true;
    window.location.reload();
  });
}

window.installApp = installApp;
window.dismissInstall = dismissInstall;
window.snoozeInstallBanner = snoozeInstallBanner;

applyLang();
applyTheme();
