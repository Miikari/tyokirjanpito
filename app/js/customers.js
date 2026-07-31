import { state } from './state.js';
import { t } from './i18n.js';
import { esc } from './utils.js';
import { toast, showConfirm } from './ui.js';
import { nextId, createCustomer, updateCustomer, deleteCustomerBatch } from './storage.js';
import { renderPills } from './clock.js';
import { renderEntries } from './entries.js';

let editingCustomerId = null; // null = adding new, number = editing existing

// Sentinel option value used across every customer <select> so "+ Lisää
// asiakas" can be picked inline without leaving the current form; resolved
// in handleCustomerSelectChange()/saveCustomerModal().
export const ADD_NEW_VALUE = '__add_new_customer__';
let pendingCustomerSelectId = null; // select whose value to set once the new customer is saved

export function customerById(id) {
  return id == null ? null : state.customers.find(c => c.id === id) || null;
}

export function customerName(id) {
  return customerById(id)?.name || null;
}

// Returns true if the change was an "add new customer" pick (and was
// intercepted); callers should skip their normal onchange handling in that
// case. Reverts the select back to its previous value first, since the new
// customer isn't selectable yet — saveCustomerModal() re-applies it once saved.
function handleCustomerSelectChange(selectEl) {
  if (selectEl.value === ADD_NEW_VALUE) {
    pendingCustomerSelectId = selectEl.id;
    selectEl.value = selectEl.dataset.prevValue || '';
    openAddCustomerModal();
    return true;
  }
  selectEl.dataset.prevValue = selectEl.value;
  return false;
}

function openAddCustomerModal() {
  editingCustomerId = null;
  document.getElementById('modal-cust-title').textContent = t('addCustomerTitle');
  document.getElementById('cust-name').value = '';
  document.getElementById('cust-ytunnus').value = '';
  document.getElementById('cust-katuosoite').value = '';
  document.getElementById('cust-postinumero').value = '';
  document.getElementById('cust-postitoimipaikka').value = '';
  document.getElementById('cust-sposti').value = '';
  document.getElementById('cust-puhelin').value = '';
  document.getElementById('cust-lang').value = 'fi';
  document.getElementById('cust-maksuehto').value = 10;
  document.getElementById('cust-maksuehto-sopimus').checked = false;
  document.getElementById('cust-maksuehto').disabled = false;
  document.getElementById('modal-customer').classList.add('open');
}

function openEditCustomerModal(id) {
  const c = customerById(id);
  if (!c) return;
  editingCustomerId = id;
  document.getElementById('modal-cust-title').textContent = t('editCustomerTitle');
  document.getElementById('cust-name').value = c.name || '';
  document.getElementById('cust-ytunnus').value = c.ytunnus || '';
  document.getElementById('cust-katuosoite').value = c.katuosoite || '';
  document.getElementById('cust-postinumero').value = c.postinumero || '';
  document.getElementById('cust-postitoimipaikka').value = c.postitoimipaikka || '';
  document.getElementById('cust-sposti').value = c.sposti || '';
  document.getElementById('cust-puhelin').value = c.puhelin || '';
  document.getElementById('cust-lang').value = c.lang || 'fi';
  const isSopimus = c.maksuehto === 'sopimus';
  document.getElementById('cust-maksuehto-sopimus').checked = isSopimus;
  document.getElementById('cust-maksuehto').value = isSopimus ? '' : (c.maksuehto ?? 10);
  document.getElementById('cust-maksuehto').disabled = isSopimus;
  document.getElementById('modal-customer').classList.add('open');
}

async function saveCustomerModal() {
  const btn = document.getElementById('cust-save-btn');
  // Guards against the double-click race: nextId()/createCustomer() are
  // async, so a second click before the first save round-trips would read
  // the same stale state.customers and slip past the duplicate-name check,
  // creating two customers with the same name.
  if (btn.disabled) return;
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
    lang:              document.getElementById('cust-lang').value,
    maksuehto,
  };

  const sameName = (a, b) => a.localeCompare(b, 'fi', { sensitivity: 'base' }) === 0;
  let newCustomerId = null;

  // Resolve which branch we're in and validate before touching the button —
  // an early return here must never leave the button stuck disabled.
  const idx = editingCustomerId === null ? -1 : state.customers.findIndex(c => c.id === editingCustomerId);
  if (editingCustomerId !== null && idx === -1) return;
  const isDuplicate = editingCustomerId === null
    ? state.customers.some(c => sameName(c.name, name))
    : state.customers.some((c, i) => sameName(c.name, name) && i !== idx);
  if (isDuplicate) { toast(t('customerExists')); return; }

  const origLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('saving');
  try {
    if (editingCustomerId === null) {
      // Adding new
      const id = await nextId('customer');
      const customer = { id, ...data };
      state.customers.push(customer);
      await createCustomer(customer);
      toast(t('customerAdded'));
      newCustomerId = id;
      if (pendingCustomerSelectId === 'cust-select') state.activeCustomerId = id;
    } else {
      // Editing existing. Entries/expenses reference the customer by id, so
      // a rename needs no cascade into them — they keep pointing at the same
      // customer automatically.
      state.customers[idx] = { id: editingCustomerId, ...data };
      await updateCustomer(editingCustomerId, data);
      toast(t('customerUpdated'));
    }

    closeCustomerModal();
    renderCustChips(); renderAllSelects(); renderPills();

    if (pendingCustomerSelectId && newCustomerId !== null) {
      const sel = document.getElementById(pendingCustomerSelectId);
      if (sel) {
        if (pendingCustomerSelectId === 'edit-customer' && !sel.querySelector(`option[value="${newCustomerId}"]`)) {
          const opt = document.createElement('option');
          opt.value = newCustomerId; opt.textContent = name;
          sel.appendChild(opt);
        }
        sel.value = newCustomerId;
        sel.dataset.prevValue = newCustomerId;
      }
    }
    pendingCustomerSelectId = null;
  } finally {
    btn.disabled = false;
    btn.textContent = origLabel;
  }
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
  editingCustomerId = null;
}

function removeCustomer(id) {
  const c = customerById(id);
  if (!c) return;
  const openEntries = state.entries.filter(e => !e.invoiced && e.customerId === id);

  const doRemove = async () => {
    const openIds = openEntries.map(e => e.id);
    state.entries = state.entries.filter(e => !(e.customerId === id && !e.invoiced));
    state.customers = state.customers.filter(x => x.id !== id);
    if (state.activeCustomerId === id) state.activeCustomerId = null;
    await deleteCustomerBatch(id, openIds);
    renderCustChips(); renderAllSelects(); renderPills(); renderEntries(); toast(t('customerRemoved'));
  };

  if (openEntries.length > 0) {
    showConfirm(
      t('deleteCustomer'),
      `${t('customerHas')} "${c.name}" ${t('has')} ${openEntries.length} ${t('customerHasEntries')}`,
      doRemove
    );
  } else {
    showConfirm(
      t('deleteCustomer'),
      `${t('deleteCustomerConfirm')} "${c.name}" ?`,
      doRemove
    );
  }
}

export function renderCustChips() {
  const el = document.getElementById('cust-chips');
  if (!state.customers.length) {
    el.innerHTML = `<div style="font-size:14px;color:var(--text2);padding:4px 0">${t('noCustomersYet')}</div>`;
    return;
  }
  const sorted = [...state.customers].sort((a, b) => a.name.localeCompare(b.name, 'fi', { sensitivity: 'base' }));
  el.innerHTML = `<div class="cust-list">${sorted.map(c => {
    const hasDetails = c.ytunnus || c.katuosoite || c.sposti || c.puhelin;
    return `<div class="cust-row">
      <div class="cust-row-name">${esc(c.name)}${hasDetails ? '<span class="cust-has-details"></span>' : ''}</div>
      <div class="cust-row-actions">
        <button type="button" class="cust-action-btn" onclick="openEditCustomerModal(${c.id})">${t('edit')}</button>
        <button type="button" class="cust-action-btn cust-action-danger" onclick="removeCustomer(${c.id})">${t('delete')}</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

export function renderAllSelects() {
  const opts = [`<option value="—">— ${t('noCustomer')} —</option>`,
    ...state.customers.map(c => `<option value="${c.id}">${esc(c.name)}</option>`),
    `<option value="${ADD_NEW_VALUE}">${t('addCustomer')}</option>`].join('');
  ['m-customer', 'rec-customer', 'exp-customer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.innerHTML = opts; el.dataset.prevValue = '—'; }
  });
}

window.handleCustomerSelectChange = handleCustomerSelectChange;
window.openAddCustomerModal = openAddCustomerModal;
window.openEditCustomerModal = openEditCustomerModal;
window.saveCustomerModal = saveCustomerModal;
window.closeCustomerModal = closeCustomerModal;
window.removeCustomer = removeCustomer;
window.toggleMaksuehtoSopimus = toggleMaksuehtoSopimus;
