import { state } from './state.js';
import { t } from './i18n.js';
import { esc } from './utils.js';
import { toast, showConfirm } from './ui.js';
import { save } from './storage.js';
import { renderPills } from './clock.js';

let editingCustomerName = null; // null = adding new, string = editing existing
let activeCustRow = null; // name of the customer row currently expanded (showing edit/delete) in settings

function openAddCustomerModal() {
  editingCustomerName = null;
  document.getElementById('modal-cust-title').textContent = t('addCustomerTitle');
  document.getElementById('cust-name').value = '';
  document.getElementById('cust-ytunnus').value = '';
  document.getElementById('cust-katuosoite').value = '';
  document.getElementById('cust-postinumero').value = '';
  document.getElementById('cust-postitoimipaikka').value = '';
  document.getElementById('cust-sposti').value = '';
  document.getElementById('cust-puhelin').value = '';
  document.getElementById('cust-maksuehto').value = 10;
  document.getElementById('cust-maksuehto-sopimus').checked = false;
  document.getElementById('cust-maksuehto').disabled = false;
  document.getElementById('modal-customer').classList.add('open');
}

function openEditCustomerModal(name) {
  const c = state.cfg.customers.find(x => x.name === name);
  if (!c) return;
  editingCustomerName = name;
  document.getElementById('modal-cust-title').textContent = t('editCustomerTitle');
  document.getElementById('cust-name').value = c.name || '';
  document.getElementById('cust-ytunnus').value = c.ytunnus || '';
  document.getElementById('cust-katuosoite').value = c.katuosoite || '';
  document.getElementById('cust-postinumero').value = c.postinumero || '';
  document.getElementById('cust-postitoimipaikka').value = c.postitoimipaikka || '';
  document.getElementById('cust-sposti').value = c.sposti || '';
  document.getElementById('cust-puhelin').value = c.puhelin || '';
  const isSopimus = c.maksuehto === 'sopimus';
  document.getElementById('cust-maksuehto-sopimus').checked = isSopimus;
  document.getElementById('cust-maksuehto').value = isSopimus ? '' : (c.maksuehto ?? 10);
  document.getElementById('cust-maksuehto').disabled = isSopimus;
  document.getElementById('modal-customer').classList.add('open');
}

function saveCustomerModal() {
  const name = document.getElementById('cust-name').value.trim();
  if (!name) { toast(t('companyNameRequired')); return; }

  const isSopimus = document.getElementById('cust-maksuehto-sopimus').checked;
  const maksuehto = isSopimus ? 'sopimus' : (parseInt(document.getElementById('cust-maksuehto').value) || 10);
  const data = {
    name,
    ytunnus:           document.getElementById('cust-ytunnus').value.trim(),
    katuosoite:        document.getElementById('cust-katuosoite').value.trim(),
    postinumero:       document.getElementById('cust-postinumero').value.trim(),
    postitoimipaikka:  document.getElementById('cust-postitoimipaikka').value.trim(),
    sposti:            document.getElementById('cust-sposti').value.trim(),
    puhelin:           document.getElementById('cust-puhelin').value.trim(),
    maksuehto,
  };

  if (editingCustomerName === null) {
    // Adding new
    if (state.cfg.customers.some(c => c.name === name)) { toast(t('customerExists')); return; }
    state.cfg.customers.push(data);
    toast(t('customerAdded'));
  } else {
    // Editing existing
    const idx = state.cfg.customers.findIndex(c => c.name === editingCustomerName);
    if (idx === -1) return;
    // If name changed, update activeCustomer and entries references
    if (editingCustomerName !== name) {
      if (state.cfg.customers.some((c, i) => c.name === name && i !== idx)) { toast(t('customerExists')); return; }
      state.entries.forEach(e => { if (e.customer === editingCustomerName) e.customer = name; });
      if (state.activeCustomer === editingCustomerName) state.activeCustomer = name;
    }
    state.cfg.customers[idx] = data;
    toast(t('customerUpdated'));
  }

  closeCustomerModal();
  activeCustRow = null;
  save(); renderCustChips(); renderAllSelects(); renderPills();
}

function toggleMaksuehtoSopimus() {
  const isSopimus = document.getElementById('cust-maksuehto-sopimus').checked;
  const field = document.getElementById('cust-maksuehto');
  field.disabled = isSopimus;
  if (isSopimus) field.value = '';
  else if (!field.value) field.value = 10;
}

function closeCustomerModal() {
  document.getElementById('modal-customer').classList.remove('open');
  editingCustomerName = null;
}

function toggleCustRow(name) {
  activeCustRow = activeCustRow === name ? null : name;
  renderCustChips();
}

function removeCustomer(name) {
  const openEntries = state.entries.filter(e => !e.invoiced && e.customer === name);

  if (openEntries.length > 0) {
    showConfirm(
      t('deleteCustomer'),
      `${t('customerHas')} "${name}" ${t('has')} ${openEntries.length} ${t('customerHasEntries')}`,
      () => {
        state.entries = state.entries.filter(e => !(e.customer === name && !e.invoiced));
        state.cfg.customers = state.cfg.customers.filter(c => c.name !== name);
        if (state.activeCustomer === name) state.activeCustomer = null;
        activeCustRow = null;
        save(); renderCustChips(); renderAllSelects(); renderPills(); toast(t('customerRemoved'));
      }
    );
  } else {
    showConfirm(
      t('deleteCustomer'),
      `${t('deleteCustomerConfirm')} "${name}" ?`,
      () => {
        state.cfg.customers = state.cfg.customers.filter(c => c.name !== name);
        if (state.activeCustomer === name) state.activeCustomer = null;
        activeCustRow = null;
        save(); renderCustChips(); renderAllSelects(); renderPills(); toast(t('customerRemoved'));
      }
    );
  }
}

export function renderCustChips() {
  const el = document.getElementById('cust-chips');
  if (!state.cfg.customers.length) {
    el.innerHTML = `<div style="font-size:14px;color:var(--text2);padding:4px 0">${t('noCustomersYet')}</div>`;
    return;
  }
  const sorted = [...state.cfg.customers].sort((a, b) => a.name.localeCompare(b.name, 'fi', { sensitivity: 'base' }));
  el.innerHTML = `<div class="cust-list">${sorted.map(c => {
    const hasDetails = c.ytunnus || c.katuosoite || c.sposti || c.puhelin;
    const isActive = activeCustRow === c.name;
    const jsonName = esc(JSON.stringify(c.name));
    return `<div class="cust-row${isActive ? ' active' : ''}" onclick="toggleCustRow(${jsonName})">
      <div class="cust-row-name">${esc(c.name)}${hasDetails ? '<span class="cust-has-details">•</span>' : ''}</div>
      <div class="cust-row-actions">
        <button type="button" class="cust-action-btn" onclick="event.stopPropagation(); openEditCustomerModal(${jsonName})">${t('edit')}</button>
        <button type="button" class="cust-action-btn cust-action-danger" onclick="event.stopPropagation(); removeCustomer(${jsonName})">${t('delete')}</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

export function renderAllSelects() {
  const opts = [`<option value="—">— ${t('noCustomer')} —</option>`,
    ...state.cfg.customers.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`)].join('');
  ['m-customer', 'rec-customer', 'exp-customer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

window.openAddCustomerModal = openAddCustomerModal;
window.openEditCustomerModal = openEditCustomerModal;
window.saveCustomerModal = saveCustomerModal;
window.closeCustomerModal = closeCustomerModal;
window.removeCustomer = removeCustomer;
window.toggleMaksuehtoSopimus = toggleMaksuehtoSopimus;
window.toggleCustRow = toggleCustRow;
