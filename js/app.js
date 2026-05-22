// ── PWA INSTALL ──
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  document.getElementById('install-banner').classList.add('visible');
});

function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt(); deferredPrompt.userChoice.then(() => { deferredPrompt = null; dismissInstall(); });
}

function dismissInstall() { document.getElementById('install-banner').classList.remove('visible'); }

window.addEventListener('appinstalled', () => { dismissInstall(); toast(t('appInstalled')); });

// ── SERVICE WORKER ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
