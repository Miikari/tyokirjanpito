import { state } from './state.js';
import { t } from './i18n.js';
import { toast } from './ui.js';

// ── PWA INSTALL ──
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); state.deferredPrompt = e;
  document.getElementById('install-banner').classList.add('visible');
});

function installApp() {
  if (!state.deferredPrompt) return;
  state.deferredPrompt.prompt(); state.deferredPrompt.userChoice.then(() => { state.deferredPrompt = null; dismissInstall(); });
}

function dismissInstall() { document.getElementById('install-banner').classList.remove('visible'); }

window.addEventListener('appinstalled', () => { dismissInstall(); toast(t('appInstalled')); });

// ── SERVICE WORKER ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
}

window.installApp = installApp;
window.dismissInstall = dismissInstall;
