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
}

window.installApp = installApp;
window.dismissInstall = dismissInstall;
window.snoozeInstallBanner = snoozeInstallBanner;

applyLang();
applyTheme();
