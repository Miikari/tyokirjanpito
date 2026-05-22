function saveRounding() {
  cfg.rounding = parseInt(document.getElementById('set-rounding').value);
  save(); toast(t('saved'));
}

function saveCompany() {
  cfg.company = document.getElementById('set-company').value.trim();
  cfg.address = document.getElementById('set-address').value.trim();
  cfg.phone = document.getElementById('set-phone').value.trim();
  cfg.email = document.getElementById('set-email').value.trim();
  cfg.ytunnus = document.getElementById('set-ytunnus').value.trim();
  cfg.tilinumero = document.getElementById('set-tilinumero').value.trim();
  save(); toast(t('saved'));
}

function saveVat() {
  cfg.vat = parseFloat(document.getElementById('set-vat').value);
  save(); toast(t('saved'));
}

function renderSettings() {
  document.getElementById('set-company').value = cfg.company || '';
  document.getElementById('set-address').value = cfg.address || '';
  document.getElementById('set-phone').value = cfg.phone || '';
  document.getElementById('set-email').value = cfg.email || '';
  document.getElementById('set-ytunnus').value = cfg.ytunnus || '';
  document.getElementById('set-tilinumero').value = cfg.tilinumero || '';
  document.getElementById('inv-show-tilinumero').checked = cfg.showTilinumero !== false;
  document.getElementById('inv-show-erapaiva').checked = cfg.showErapaiva !== false;
  document.getElementById('inv-show-viitenumero').checked = cfg.showViitenumero === true;
  document.getElementById('set-rounding').value = cfg.rounding || 15;
  document.getElementById('set-hourly').value = cfg.hourly;
  document.getElementById('set-vat').value = cfg.vat || 0;
  previewHourly();
  renderRecList(); renderCustChips(); renderAllSelects();
}

function previewHourly() {
  const v = parseFloat(document.getElementById('set-hourly').value) || 0;
  document.getElementById('hourly-hint').textContent = '8h = ' + fmtEur(8 * v) + ' · 160h = ' + fmtEur(160 * v);
}

function saveHourly() {
  const v = parseFloat(document.getElementById('set-hourly').value);
  if (isNaN(v) || v < 0) { toast(t('invalidPrice')); return; }
  cfg.hourly = v; save(); previewHourly(); toast(t('saved') + fmtEur(v) + '/h');
}

function saveInvoiceSettings() {
  cfg.showTilinumero = document.getElementById('inv-show-tilinumero').checked;
  cfg.showErapaiva = document.getElementById('inv-show-erapaiva').checked;
  cfg.showViitenumero = document.getElementById('inv-show-viitenumero').checked;
  save();
}

function addRecurring() {
  const n = document.getElementById('rec-name').value.trim();
  const a = parseFloat(document.getElementById('rec-amount').value);
  const c = document.getElementById('rec-customer').value;
  if (!n || isNaN(a) || a <= 0) { toast(t('fillDesc')); return; }
  cfg.recurring.push({ id: Date.now(), name: n, amount: a, customer: c === '—' ? null : c });
  document.getElementById('rec-name').value = '';
  document.getElementById('rec-amount').value = '';
  save(); renderRecList(); toast(t('added'));
}

function removeRecurring(id) {
  cfg.recurring = cfg.recurring.filter(r => r.id !== id);
  save(); renderRecList();
}

function renderRecList() {
  const el = document.getElementById('rec-list');
  if (!cfg.recurring.length) {
    el.innerHTML = `<div style="font-size:14px;color:var(--text2);padding:4px 0">${t('noRecurring')}</div>`;
    return;
  }
  el.innerHTML = cfg.recurring.map(r => `
    <div class="rec-item">
      <div>
        <div class="rec-name">${r.name}</div>
        <div class="rec-sub">${r.customer || t('allCustomers')}</div>
      </div>
      <div class="rec-right">
        <span class="rec-eur">${fmtEur(r.amount)}/kk</span>
        <span class="rec-rm" onclick="removeRecurring(${r.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </span>
      </div>
    </div>`).join('');
}
