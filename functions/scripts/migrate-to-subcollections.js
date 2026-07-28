#!/usr/bin/env node
'use strict';

// Migrates orgs from the single-blob doc /orgs/{orgId}/data/main (arrays of
// entries/invoices/expenses + cfg.customers) to per-entity subcollections:
//   /orgs/{orgId}/customers/{id}
//   /orgs/{orgId}/entries/{id}
//   /orgs/{orgId}/expenses/{id}
//   /orgs/{orgId}/invoices/{id}
//   /orgs/{orgId}/settings/config
//
// Safe to run multiple times: an org is skipped once its target
// subcollections already contain documents, unless --force is passed.
// Never deletes the source blob unless --delete-old is passed, and only
// then for orgs it just successfully (re-)migrated.
//
// Usage:
//   node migrate-to-subcollections.js --backup-only
//   node migrate-to-subcollections.js --dry-run
//   node migrate-to-subcollections.js
//   node migrate-to-subcollections.js --org <orgId>
//   node migrate-to-subcollections.js --delete-old
//
// Requires Application Default Credentials for the tyoaikakirjanpito
// Firebase project, e.g.:
//   gcloud auth application-default login
//   gcloud config set project tyoaikakirjanpito
// or GOOGLE_APPLICATION_CREDENTIALS pointing at a service account key.

const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const PROJECT_ID = 'tyoaikakirjanpito';
const BACKUP_DIR = path.join(__dirname, 'backups');
const BATCH_LIMIT = 400; // Firestore hard cap is 500 writes/batch; stay clear of it.

const args = process.argv.slice(2);
const flags = {
  dryRun: args.includes('--dry-run'),
  backupOnly: args.includes('--backup-only'),
  deleteOld: args.includes('--delete-old'),
  force: args.includes('--force'),
  org: (() => {
    const i = args.indexOf('--org');
    return i !== -1 ? args[i + 1] : null;
  })(),
};

const app = initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(app);

function log(...a) { console.log(...a); }
function warn(...a) { console.warn('  ⚠', ...a); }

// Same "sameName" comparator the app uses for customer name matching
// (customers.js), so migrated references line up with app behavior.
function sameName(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'fi', { sensitivity: 'base' }) === 0;
}

// ── Backup ───────────────────────────────────────────────────────────────
// Dumps every org's current data/main blob (plus the org doc itself) to a
// local timestamped JSON file before anything is touched. This is the
// rollback source of truth — the migration never deletes data/main on its
// own, but this file is the recovery path if it ever needs to.
async function backupAll() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(BACKUP_DIR, `orgs-backup-${stamp}.json`);

  const orgsSnap = await db.collection('orgs').get();
  const backup = {};
  for (const orgDoc of orgsSnap.docs) {
    const dataDoc = await db.collection('orgs').doc(orgDoc.id).collection('data').doc('main').get();
    backup[orgDoc.id] = {
      org: orgDoc.data(),
      dataMain: dataDoc.exists ? dataDoc.data() : null,
    };
  }
  fs.writeFileSync(outFile, JSON.stringify(backup, null, 2));
  log(`Varmuuskopio kirjoitettu: ${outFile} (${orgsSnap.size} orgia)`);
  return outFile;
}

// ── Per-org migration ────────────────────────────────────────────────────
async function alreadyMigrated(orgRef) {
  const [custSnap, entrySnap] = await Promise.all([
    orgRef.collection('customers').limit(1).get(),
    orgRef.collection('entries').limit(1).get(),
  ]);
  return !custSnap.empty || !entrySnap.empty;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function commitInChunks(ops) {
  for (const part of chunk(ops, BATCH_LIMIT)) {
    const batch = db.batch();
    for (const op of part) op(batch);
    await batch.commit();
  }
}

async function migrateOrg(orgId, stats) {
  const orgRef = db.collection('orgs').doc(orgId);
  const dataDoc = await orgRef.collection('data').doc('main').get();
  if (!dataDoc.exists) {
    log(`[${orgId}] ei data/main-dokumenttia, ohitetaan.`);
    return;
  }

  if (!flags.force && await alreadyMigrated(orgRef)) {
    log(`[${orgId}] alikokoelmat sisältävät jo dataa, ohitetaan (käytä --force pakottaaksesi).`);
    stats.skipped++;
    return;
  }

  const d = dataDoc.data();
  const cfg = d.cfg || {};
  const rawCustomers = (cfg.customers || []).map(c => (typeof c === 'string' ? { name: c } : c));
  const entries = d.entries || [];
  const invoices = d.invoices || [];
  const expenses = d.expenses || [];

  // Assign stable sequential customer IDs in existing array order.
  const customers = rawCustomers.map((c, i) => ({ ...c, id: i + 1 }));
  const customerIdByName = (name) => {
    if (!name) return null;
    const match = customers.find(c => sameName(c.name, name));
    return match ? match.id : null;
  };

  let unmatchedCustomerRefs = 0;
  const resolveEntryLike = (e) => {
    const customerId = customerIdByName(e.customer);
    if (e.customer && customerId === null) unmatchedCustomerRefs++;
    return { ...e, customerId };
  };

  const migratedEntries = entries.map(resolveEntryLike);
  const migratedExpenses = expenses.map(resolveEntryLike);
  // Invoices keep their frozen `customer` name (historical, must never
  // change retroactively) and additionally get `customerId` alongside it
  // for the entries/expenses embedded within them.
  const migratedInvoices = invoices.map(inv => ({
    ...inv,
    entries: (inv.entries || []).map(resolveEntryLike),
    expenses: (inv.expenses || []).map(resolveEntryLike),
  }));

  const maxId = (list) => list.reduce((m, x) => Math.max(m, x.id || 0), 0);
  const settingsDoc = {
    hourly: cfg.hourly ?? 50,
    kmRate: cfg.kmRate ?? 0.57,
    recurring: cfg.recurring || [],
    company: cfg.company || '',
    address: cfg.address || '',
    phone: cfg.phone || '',
    email: cfg.email || '',
    ytunnus: cfg.ytunnus || '',
    tilinumero: cfg.tilinumero || '',
    rounding: cfg.rounding ?? 15,
    minRounding: cfg.minRounding ?? 0,
    vat: cfg.vat ?? 0,
    showTilinumero: cfg.showTilinumero !== false,
    showErapaiva: cfg.showErapaiva !== false,
    showViitenumero: cfg.showViitenumero === true,
    services: cfg.services && cfg.services.length ? cfg.services : [{ id: 1, name: 'Tuntityö', rate: cfg.hourly ?? 50 }],
    hideRate: !!cfg.hideRate,
    eId: Math.max(d.eId || 0, maxId(entries)),
    iId: Math.max(d.iId || 0, maxId(invoices)),
    eExpId: Math.max(d.eExpId || 0, maxId(expenses)),
    cId: customers.length,
  };

  log(`[${orgId}] asiakkaat=${customers.length} kirjaukset=${entries.length} laskut=${invoices.length} kulut=${expenses.length}` +
    (unmatchedCustomerRefs ? ` (huom: ${unmatchedCustomerRefs} täsmäämätöntä asiakasviittausta)` : ''));

  if (flags.dryRun) { stats.dryRun++; return; }

  const ops = [];
  for (const c of customers) {
    const { id, ...rest } = c;
    ops.push(b => b.set(orgRef.collection('customers').doc(String(id)), { id, ...rest }));
  }
  for (const e of migratedEntries) {
    ops.push(b => b.set(orgRef.collection('entries').doc(String(e.id)), e));
  }
  for (const e of migratedExpenses) {
    ops.push(b => b.set(orgRef.collection('expenses').doc(String(e.id)), e));
  }
  for (const inv of migratedInvoices) {
    ops.push(b => b.set(orgRef.collection('invoices').doc(String(inv.id)), inv));
  }
  ops.push(b => b.set(orgRef.collection('settings').doc('config'), settingsDoc));

  await commitInChunks(ops);
  stats.migrated++;

  if (flags.deleteOld) {
    await orgRef.collection('data').doc('main').delete();
    log(`[${orgId}] data/main poistettu (--delete-old).`);
  }
}

async function main() {
  if (flags.backupOnly) {
    await backupAll();
    return;
  }

  // Always back up before writing anything, unless this is a pure dry run
  // (nothing to protect against — dry run makes no writes).
  if (!flags.dryRun) await backupAll();

  const stats = { migrated: 0, skipped: 0, dryRun: 0, failed: 0 };
  const orgIds = flags.org ? [flags.org] : (await db.collection('orgs').listDocuments()).map(r => r.id);

  log(`Käsitellään ${orgIds.length} organisaatiota${flags.dryRun ? ' (dry-run, ei kirjoiteta)' : ''}...`);

  for (const orgId of orgIds) {
    try {
      await migrateOrg(orgId, stats);
    } catch (e) {
      stats.failed++;
      console.error(`[${orgId}] VIRHE:`, e.message);
    }
  }

  log('\n── Yhteenveto ──');
  log(`Migroitu: ${stats.migrated}`);
  log(`Ohitettu (jo migroitu): ${stats.skipped}`);
  if (flags.dryRun) log(`Dry-run (olisi migroitu): ${stats.dryRun}`);
  log(`Epäonnistui: ${stats.failed}`);

  if (stats.failed > 0) process.exitCode = 1;
}

main().catch(e => { console.error('Fataali virhe:', e); process.exitCode = 1; });
