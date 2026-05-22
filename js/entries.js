function addEntry(date, secs, customer, src, notes = '', rate = null) {
  const entryRate = (rate !== null && !isNaN(rate) && rate >= 0) ? rate : cfg.hourly;
  entries.unshift({ id: ++eId, date: new Date(date).toISOString(), secs, customer, src, notes, rate: entryRate, selected: false, invoiced: false });
}

function addManual() {
  const cust = document.getElementById('m-customer').value;
  if (!cust || cust === '—') { toast(t('selectCustomer')); return; }
  const d = document.getElementById('m-date').value;
  const h = parseInt(document.getElementById('m-h').value) || 0;
  const m = parseInt(document.getElementById('m-m').value) || 0;
  const rawTotal = h * 3600 + m * 60;
  if (rawTotal < 1) { toast(t('enterTime')); return; }
  const interval = (cfg.rounding || 15) * 60;
  const total = cfg.rounding === 1 ? rawTotal : Math.ceil(rawTotal / interval) * interval;
  const notes = document.getElementById('m-notes').value;
  const rateVal = parseFloat(document.getElementById('m-rate').value);
  const rate = (!isNaN(rateVal) && rateVal >= 0) ? rateVal : cfg.hourly;
  if (total < 1) { toast(t('enterTime')); return; }
  addEntry(d ? new Date(d + 'T12:00:00') : new Date(), total, cust, 'manuaalinen', notes, rate);
  document.getElementById('m-h').value = '';
  document.getElementById('m-m').value = '';
  document.getElementById('m-notes').value = '';
  save(); toast(t('entryAdded'));
}

function toggleEntry(id) {
  const e = entries.find(x => x.id === id);
  if (e && !e.invoiced) e.selected = !e.selected;
  const all = entries.filter(e => !e.invoiced);
  const sel = all.filter(e => e.selected);
  document.getElementById('s-sel').textContent = sel.length;
}

function selectAll() {
  const u = entries.filter(e => !e.invoiced && (!filterCustomer || e.customer === filterCustomer));
  const all = u.length && u.every(e => e.selected);
  u.forEach(e => e.selected = !all);
  renderEntries();
}

function setFilter(c) {
  filterCustomer = filterCustomer === c ? null : c;
  entries.filter(e => !e.invoiced).forEach(e => e.selected = false);
  if (filterCustomer) {
    entries.filter(e => !e.invoiced && e.customer === filterCustomer).forEach(e => e.selected = true);
  }
  renderEntries();
}

function renderFilterPills() {
  const customers = [...new Set(entries.filter(e => !e.invoiced && e.customer).map(e => e.customer))];
  const el = document.getElementById('filter-pills');
  if (!el) return;

  const existing = el.querySelectorAll('.pill');
  if (existing.length === customers.length) {
    existing.forEach(pill => {
      const isActive = pill.textContent.trim() === filterCustomer;
      pill.classList.toggle('active', isActive);
      pill.style.background = isActive ? 'var(--blue)' : 'var(--surface)';
      pill.style.color = isActive ? '#fff' : 'var(--text2)';
      pill.style.borderColor = isActive ? 'var(--blue)' : 'var(--border2)';
    });
    return;
  }

  if (!customers.length) { el.innerHTML = ''; return; }
  el.innerHTML = customers.map(c => `
    <div class="pill ${filterCustomer === c ? 'active' : ''}"
      style="background:${filterCustomer === c ? 'var(--blue)' : 'var(--surface)'};color:${filterCustomer === c ? '#fff' : 'var(--text2)'};border-color:${filterCustomer === c ? 'var(--blue)' : 'var(--border2)'};"
      onclick="setFilter(${esc(JSON.stringify(c))})">${esc(c)}</div>`
  ).join('');
}

function renderEntries() {
  const list = document.getElementById('entries-list');
  const active = entries.filter(e => !e.invoiced && (!filterCustomer || e.customer === filterCustomer));
  const all = entries.filter(e => !e.invoiced);
  const sel = all.filter(e => e.selected);
  document.getElementById('s-count').textContent = active.length;
  document.getElementById('s-sel').textContent = sel.length;
  document.getElementById('s-total').textContent = fmtShort(all.reduce((a, e) => a + e.secs, 0));
  document.getElementById('s-val').textContent = fmtEur(all.reduce((a, e) => a + (e.secs / 3600) * (e.rate ?? cfg.hourly), 0));
  renderFilterPills();
  if (!active.length) {
    list.innerHTML = `<div class="empty">${filterCustomer ? t('noEntriesFor') + ' ' + esc(filterCustomer) : t('noEntries')}<br><br>${!filterCustomer ? t('loginFirst') : ''}</div>`;
    return;
  }
  list.innerHTML = active.map(e => `
    <div class="entry">
      <input type="checkbox" class="ecb" ${e.selected ? 'checked' : ''} onchange="toggleEntry(${e.id})">
      <div class="entry-info">
        <div class="entry-meta">${fmtDate(e.date)}</div>
        <div class="entry-dur">${fmtDur(e.secs)}</div>
        ${e.notes ? `<div style="font-size:12px;color:var(--text2);margin-top:3px;">📝 ${esc(e.notes)}</div>` : ''}
      </div>
      <div class="entry-right">
        ${e.customer ? `<span class="tag tag-cust">${esc(e.customer)}</span>` : ''}
        <span class="entry-eur">${fmtEur((e.secs / 3600) * (e.rate ?? cfg.hourly))}</span>
        <span class="tag tag-open">${t('open') || 'Avoin'}</span>
      </div>
      <button onclick="openEditEntry(${e.id})" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--text2);flex-shrink:0;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>`).join('');
}

// ── EDIT ENTRY ──
function openEditEntry(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  editingEntryId = id;
  const d = new Date(e.date);
  document.getElementById('edit-date').value = d.toISOString().slice(0, 10);
  document.getElementById('edit-h').value = Math.floor(e.secs / 3600);
  document.getElementById('edit-m').value = Math.floor((e.secs % 3600) / 60);
  document.getElementById('edit-notes').value = e.notes || '';
  document.getElementById('edit-rate').value = e.rate ?? cfg.hourly;
  const opts = [`<option value="—">— ${t('noCustomer')} —</option>`,
    ...cfg.customers.map(c => `<option value="${esc(c.name)}" ${e.customer === c.name ? 'selected' : ''}>${esc(c.name)}</option>`)].join('');
  document.getElementById('edit-customer').innerHTML = opts;
  document.getElementById('modal-edit').classList.add('open');
}

function saveEditEntry() {
  const e = entries.find(x => x.id === editingEntryId);
  if (!e) return;
  const d = document.getElementById('edit-date').value;
  const h = parseInt(document.getElementById('edit-h').value) || 0;
  const m = parseInt(document.getElementById('edit-m').value) || 0;
  const cust = document.getElementById('edit-customer').value;
  const notes = document.getElementById('edit-notes').value.trim();
  const total = h * 3600 + m * 60;
  if (total < 1) { toast(t('enterTime')); return; }
  e.date = d ? new Date(d + 'T12:00:00').toISOString() : e.date;
  e.secs = total;
  e.customer = cust === '—' ? null : cust;
  e.notes = notes;
  const rateVal = parseFloat(document.getElementById('edit-rate').value);
  e.rate = (!isNaN(rateVal) && rateVal >= 0) ? rateVal : cfg.hourly;
  closeEditModal();
  save(); renderEntries(); toast(t('entryUpdated'));
}

function deleteEntry() {
  showConfirm(
    t('deleteEntry'),
    t('deleteEntryConfirm'),
    () => {
      entries = entries.filter(x => x.id !== editingEntryId);
      closeEditModal();
      save(); renderEntries(); toast(t('entryRemoved'));
    }
  );
}

function closeEditModal() {
  document.getElementById('modal-edit').classList.remove('open');
  editingEntryId = null;
}
