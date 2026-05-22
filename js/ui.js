// ── LANG ──
function setLang(l) {
  lang = l;
  localStorage.setItem('lang', l);
  applyLang();
}

function applyLang() {
  document.querySelector('.login-title').textContent = t('loginTitle');
  document.querySelector('.login-sub').innerHTML = t('loginSub') + '<br>' + t('loginSub2');
  document.querySelector('.btn-google').lastChild.textContent = ' ' + t('loginBtn');
  document.querySelector('.login-footer').innerHTML = t('loginFooter') + '<br>' + t('loginFooter2');

  document.querySelector('.install-banner span').textContent = t('installBanner');
  document.querySelector('#install-banner button').textContent = t('install');

  document.querySelector('.btn-logout').textContent = t('logout');
  document.querySelectorAll('.tab')[0].textContent = t('kello');
  document.querySelectorAll('.tab')[1].textContent = t('kirjanpito');
  document.querySelectorAll('.tab')[2].textContent = t('arkisto');
  document.querySelectorAll('.tab')[3].textContent = t('asetukset');

  document.querySelector('.card-label').textContent = t('manualEntry');
  document.querySelector('#notes-toggle-icon').nextSibling.textContent = ' ' + t('addNotes');
  document.getElementById('clock-notes').placeholder = t('notesPlaceholder');
  document.getElementById('m-notes').placeholder = t('mNotesPlaceholder');

  document.querySelectorAll('.sum-label')[0].textContent = t('entries');
  document.querySelectorAll('.sum-label')[1].textContent = t('selected');
  document.querySelectorAll('.sum-label')[2].textContent = t('total');
  document.querySelectorAll('.sum-label')[3].textContent = t('value');
  document.querySelector('.btn-outline').textContent = t('selectAll');
  document.querySelector('.btn-invoice').textContent = t('buildInvoice');

  document.querySelector('#modal h2').textContent = t('recurring');
  document.querySelectorAll('#modal .modal-opt')[0].textContent = t('addAllRecurring');
  document.querySelectorAll('#modal .modal-opt')[1].textContent = t('addCustomerRecurring');
  document.querySelectorAll('#modal .modal-opt')[2].textContent = t('noRecurringInvoice');
  document.querySelectorAll('#modal .modal-opt')[3].textContent = t('cancel');
  document.querySelector('#modal-edit h2').textContent = t('editEntry');
  document.querySelector('#modal-edit .modal-opt.primary').textContent = t('saveChanges');
  document.querySelector('#modal-edit .modal-cancel').textContent = t('cancel');
  document.querySelector('#modal-edit-inv h2').textContent = t('editInvoice');
  document.querySelector('#modal-edit-inv .modal-opt.primary').textContent = t('saveChanges');
  document.querySelector('#modal-edit-inv .modal-cancel').textContent = t('cancel');
  document.getElementById('confirm-ok').textContent = t('yes');
  document.querySelector('#modal-confirm .modal-cancel').textContent = t('cancel');

  document.getElementById('label-language').textContent = t('language');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t(key) !== key) el.textContent = t(key);
  });
  document.getElementById('rec-name').placeholder = t('recNamePlaceholder');
  document.getElementById('btn-fi').style.fontWeight = lang === 'fi' ? '800' : '600';
  document.getElementById('btn-en').style.fontWeight = lang === 'en' ? '800' : '600';

  renderMainBtns(); renderPills(); renderEntries(); renderArchive();
  if (document.getElementById('panel-asetukset').classList.contains('active')) renderSettings();
}

// ── TOAST ──
function toast(msg) {
  const el = document.getElementById('toast');
  clearTimeout(toast._t);
  el.textContent = msg; el.classList.add('show');
  toast._t = setTimeout(() => el.classList.remove('show'), 2400);
}

// ── TABS ──
function showTab(tab, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  if (btn) btn.classList.add('active');
  if (tab === 'kirjanpito') renderEntries();
  if (tab === 'arkisto')    renderArchive();
  if (tab === 'asetukset')  renderSettings();
}

function goTab(tab) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  document.querySelectorAll('.tab').forEach(t => { if (t.textContent.trim().toLowerCase() === tab) t.classList.add('active'); });
}

// ── CLOCK BG & NOTES ──
function updateClockBg() {
  const bg = document.getElementById('clock-bg');
  if (!bg) return;
  if (state === 'running' || state === 'paused') {
    bg.style.backgroundImage = `url('${ANIM_GIF}?t=${Date.now()}')`;
  } else {
    bg.style.backgroundImage = `url('${STILL_IMG}')`;
  }
}

function toggleNotes() {
  const box = document.getElementById('notes-box');
  const icon = document.getElementById('notes-toggle-icon');
  const open = box.style.display === 'none';
  box.style.display = open ? 'block' : 'none';
  icon.textContent = open ? '−' : '+';
}

// ── CONFIRM MODAL ──
function showConfirm(title, text, onOk) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent = text;
  document.getElementById('confirm-ok').onclick = () => { closeConfirm(); onOk(); };
  document.getElementById('modal-confirm').classList.add('open');
}

function closeConfirm() {
  document.getElementById('modal-confirm').classList.remove('open');
}
