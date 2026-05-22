let editingCustomerName = null; // null = adding new, string = editing existing

function openAddCustomerModal() {
  editingCustomerName = null;
  document.getElementById('modal-cust-title').textContent = 'Lisää asiakas';
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
  const c = cfg.customers.find(x => x.name === name);
  if (!c) return;
  editingCustomerName = name;
  document.getElementById('modal-cust-title').textContent = 'Muokkaa asiakasta';
  document.getElementById('cust-name').value = c.name || '';
  document.getElementById('cust-ytunnus').value = c.ytunnus || '';
  document.getElementById('cust-katuosoite').value = c.katuosoite || '';
  document.getElementById('cust-postinumero').value = c.postinumero || '';
  document.getElementById('cust-postitoimipaikka').value = c.postitoimipaikka || '';
  document.getElementById('cust-sposti').value = c.sposti || '';
  document.getElementById('cust-puhelin').value = c.puhelin || '';
  const isSopimus = c.maksuehto === 'sopimus';
  document.getElementById('cust-maksuehto-sopimus').checked = isSopimus;
  document.getElementById('cust-maksuehto').value = isSopimus ? 10 : (c.maksuehto ?? 10);
  document.getElementById('cust-maksuehto').disabled = isSopimus;
  document.getElementById('modal-customer').classList.add('open');
}

function saveCustomerModal() {
  const name = document.getElementById('cust-name').value.trim();
  if (!name) { toast('Syötä yrityksen nimi'); return; }

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
    if (cfg.customers.some(c => c.name === name)) { toast(t('customerExists')); return; }
    cfg.customers.push(data);
    toast(t('customerAdded'));
  } else {
    // Editing existing
    const idx = cfg.customers.findIndex(c => c.name === editingCustomerName);
    if (idx === -1) return;
    // If name changed, update activeCustomer and entries references
    if (editingCustomerName !== name) {
      if (cfg.customers.some((c, i) => c.name === name && i !== idx)) { toast(t('customerExists')); return; }
      entries.forEach(e => { if (e.customer === editingCustomerName) e.customer = name; });
      if (activeCustomer === editingCustomerName) activeCustomer = name;
    }
    cfg.customers[idx] = data;
    toast('Asiakastiedot tallennettu');
  }

  closeCustomerModal();
  save(); renderCustChips(); renderAllSelects(); renderPills();
}

function toggleMaksuehtoSopimus() {
  const isSopimus = document.getElementById('cust-maksuehto-sopimus').checked;
  document.getElementById('cust-maksuehto').disabled = isSopimus;
}

function closeCustomerModal() {
  document.getElementById('modal-customer').classList.remove('open');
  editingCustomerName = null;
}

function removeCustomer(name) {
  const openEntries = entries.filter(e => !e.invoiced && e.customer === name);

  if (openEntries.length > 0) {
    showConfirm(
      t('deleteCustomer'),
      `${t('customerHas')} "${name}" ${t('has')} ${openEntries.length} ${t('customerHasEntries')}`,
      () => {
        entries = entries.filter(e => !(e.customer === name && !e.invoiced));
        cfg.customers = cfg.customers.filter(c => c.name !== name);
        if (activeCustomer === name) activeCustomer = null;
        save(); renderCustChips(); renderAllSelects(); renderPills(); toast(t('customerRemoved'));
      }
    );
  } else {
    showConfirm(
      t('deleteCustomer'),
      `${t('deleteCustomerConfirm')} "${name}" ?`,
      () => {
        cfg.customers = cfg.customers.filter(c => c.name !== name);
        if (activeCustomer === name) activeCustomer = null;
        save(); renderCustChips(); renderAllSelects(); renderPills(); toast(t('customerRemoved'));
      }
    );
  }
}

function renderCustChips() {
  const el = document.getElementById('cust-chips');
  if (!cfg.customers.length) {
    el.innerHTML = '<div style="font-size:14px;color:var(--text2);padding:4px 0">Ei asiakkaita vielä.</div>';
    return;
  }
  el.innerHTML = cfg.customers.map(c => {
    const hasDetails = c.ytunnus || c.katuosoite || c.sposti || c.puhelin;
    return `<span class="cust-chip">
      ${esc(c.name)}${hasDetails ? '<span class="cust-has-details">•</span>' : ''}
      <span class="cust-edit" onclick="openEditCustomerModal(${esc(JSON.stringify(c.name))})">✎</span>
      <span class="cust-rm" onclick="removeCustomer(${esc(JSON.stringify(c.name))})">×</span>
    </span>`;
  }).join('');
}

function renderAllSelects() {
  const opts = [`<option value="—">— ${t('noCustomer')} —</option>`,
    ...cfg.customers.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`)].join('');
  ['m-customer', 'rec-customer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}
