import { state, defaultCfg } from './state.js';

function d(dateStr) {
  return new Date(dateStr + 'T12:00:00').toISOString();
}

const DEMO_VAT = 25.5;

function calcInvoice(id, dateStr, entries, maksuehto, paid = true, expenses = [], vat = DEMO_VAT) {
  const totalSecs = entries.reduce((a, e) => a + e.secs, 0);
  const hourly = entries.reduce((a, e) => a + (e.secs / 3600) * e.rate, 0);
  const expenseTotal = expenses.reduce((a, e) => a + e.amount, 0);
  const subtotal = hourly + expenseTotal;
  const vatAmount = subtotal * vat / 100;
  return {
    id, date: d(dateStr), entries: entries.map(e => ({ ...e })),
    totalSecs, hourly, monthly: 0,
    expenses: expenses.map(e => ({ ...e })), expenseTotal,
    subtotal, vatAmount, vat, total: subtotal + vatAmount, recurring: [], maksuehto, paid,
  };
}

export function loadDemoData() {
  state.isDemo = true;

  if (state.lang === 'en') {
    loadDemoDataEn();
  } else {
    loadDemoDataFi();
  }
}

function loadDemoDataFi() {
  state.cfg = {
    ...defaultCfg(),
    hourly: 50,
    company: 'Vierailija Oy',
    ytunnus: '1234567-8',
    address: 'Testikatu 1, 00100 Helsinki',
    phone: '040 123 4567',
    email: 'laskutus@vierailijaoy.fi',
    tilinumero: 'FI21 1234 5600 0007 85',
    rounding: 15,
    vat: DEMO_VAT,
    kmRate: 0.57,
    showTilinumero: true,
    showErapaiva: true,
    recurring: [],
    services: [{ id: 1, name: 'Tuntityö', rate: 50 }, { id: 2, name: 'Konsultointi', rate: 90 }],
    hideRate: false,
  };
  state.customers = [
    {
      id: 1,
      name: 'Esimerkki Oy',
      ytunnus: '8765432-1',
      katuosoite: 'Esimerkkikatu 5 B',
      postinumero: '00200',
      postitoimipaikka: 'Helsinki',
      sposti: 'laskut@esimerkkioy.fi',
      puhelin: '09 876 5432',
      maksuehto: 14,
    },
    {
      id: 2,
      name: 'Demo Solutions Oy',
      ytunnus: '9999888-7',
      katuosoite: 'Kehräämöntie 12',
      postinumero: '33200',
      postitoimipaikka: 'Tampere',
      sposti: 'talous@demosolutionsoy.fi',
      puhelin: '03 555 6677',
      maksuehto: 10,
    },
  ];

  // ── Laskutetut kirjaukset ──

  const inv1Entries = [
    { id: 1, date: d('2026-01-08'), secs: 21600, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Projektisuunnittelu ja kickoff', rate: 50, selected: false, invoiced: true },
    { id: 2, date: d('2026-01-20'), secs: 14400, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Arkkitehtuurisuunnittelu',       rate: 50, selected: false, invoiced: true },
  ];

  const inv2Entries = [
    { id: 3, date: d('2026-02-05'), secs: 18000, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Vaatimusmäärittely',  rate: 50, selected: false, invoiced: true },
    { id: 4, date: d('2026-02-18'), secs: 10800, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Prototyypin toteutus', rate: 50, selected: false, invoiced: true },
  ];

  const inv3Entries = [
    { id: 5, date: d('2026-03-10'), secs: 21600, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Backend-kehitys, sprint 1', rate: 50, selected: false, invoiced: true },
    { id: 6, date: d('2026-03-24'), secs: 14400, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'API-integraatiot',          rate: 50, selected: false, invoiced: true },
  ];

  const inv4Entries = [
    { id: 7,  date: d('2026-04-07'), secs: 14400, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Käyttöliittymäsuunnittelu', rate: 50, selected: false, invoiced: true },
    { id: 8,  date: d('2026-04-15'), secs: 18000, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Frontend-kehitys',          rate: 50, selected: false, invoiced: true },
    { id: 9,  date: d('2026-04-28'), secs: 10800, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Testaus ja korjaukset',     rate: 50, selected: false, invoiced: true },
  ];

  const inv5Entries = [
    { id: 10, date: d('2026-05-06'), secs: 28800, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Backend-kehitys, sprint 2', rate: 50, selected: false, invoiced: true },
    { id: 11, date: d('2026-05-19'), secs: 14400, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Suorituskykytestaus',        rate: 50, selected: false, invoiced: true },
  ];

  // Viimeisin lasku — erääntynyt, maksamatta (laskupäivä 2026-06-01, maksuehto 14pv → eräpäivä 2026-06-15)
  const inv6Entries = [
    { id: 12, date: d('2026-05-26'), secs: 18000, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Käyttöliittymäkehitys, viimeistely', rate: 50, selected: false, invoiced: true },
    { id: 13, date: d('2026-05-30'), secs: 14400, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Testaus ja julkaisu',                rate: 50, selected: false, invoiced: true },
  ];

  // Avoimet kirjaukset
  const openEntries = [
    { id: 14, date: d('2026-06-10'), secs: 7200,  customer: 'Esimerkki Oy',      customerId: 1, src: 'manuaalinen', notes: 'Jälkiseuranta ja tuki',       rate: 50, selected: false, invoiced: false },
    { id: 15, date: d('2026-06-16'), secs: 12600, customer: 'Esimerkki Oy',      customerId: 1, src: 'manuaalinen', notes: 'Uuden ominaisuuden toteutus',  rate: 50, selected: false, invoiced: false },
    { id: 16, date: d('2026-06-18'), secs: 5400,  customer: 'Esimerkki Oy',      customerId: 1, src: 'manuaalinen', notes: 'Tukipyyntö ja korjaukset',     rate: 50, selected: false, invoiced: false },
    { id: 17, date: d('2026-06-12'), secs: 9000,  customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Arkkitehtuurikatselmus',       rate: 90, service: 'Konsultointi', selected: false, invoiced: false },
    { id: 18, date: d('2026-06-19'), secs: 3600,  customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Käyttöönottotuki',             rate: 90, service: 'Konsultointi', selected: false, invoiced: false },
  ];

  // ── Kulukorvaukset (yleinen + kilometrikorvaus) ──

  const inv4Expenses = [
    { id: 2, date: d('2026-04-20'), description: 'Kilometrikorvaus: 38 km × 0,57 € = 21,66 €', amount: 21.66, vat: 0, vatAmount: 0, customer: 'Esimerkki Oy', customerId: 1, kind: 'km', km: 38, kmRate: 0.57, selected: false, invoiced: true },
  ];
  const inv5Expenses = [
    { id: 1, date: d('2026-05-12'), description: 'Matkakulut asiakastapaamiseen', amount: 35, vat: 0, vatAmount: 0, customer: 'Demo Solutions Oy', customerId: 2, kind: 'general', km: 0, kmRate: null, selected: false, invoiced: true },
  ];

  // Avoimet kulukorvaukset
  const openExpenses = [
    { id: 3, date: d('2026-06-14'), description: 'Toimistotarvikkeet',                                       amount: 45,    vat: 0, vatAmount: 0, customerId: 1, kind: 'general', km: 0,  kmRate: null, selected: false, invoiced: false },
    { id: 4, date: d('2026-06-20'), description: 'Kilometrikorvaus: 42 km × 0,57 € = 23,94 €',                amount: 23.94, vat: 0, vatAmount: 0, customerId: 2, kind: 'km',      km: 42, kmRate: 0.57, selected: false, invoiced: false },
  ];

  state.invoices = [
    calcInvoice(6, '2026-06-01', inv6Entries, 14, false), // erääntynyt, maksamatta
    calcInvoice(5, '2026-05-30', inv5Entries, 10, true, inv5Expenses),
    calcInvoice(4, '2026-04-30', inv4Entries, 14, true, inv4Expenses),
    calcInvoice(3, '2026-03-31', inv3Entries, 10, true),
    calcInvoice(2, '2026-02-28', inv2Entries, 14, true),
    calcInvoice(1, '2026-01-31', inv1Entries, 10, true),
  ];

  state.entries = [
    ...openEntries,
    ...inv6Entries, ...inv5Entries, ...inv4Entries,
    ...inv3Entries, ...inv2Entries, ...inv1Entries,
  ];
  state.expenses = [...openExpenses, ...inv5Expenses, ...inv4Expenses];
  state.eId = 18;
  state.iId = 6;
  state.cId = 2;
  state.eExpId = 4;
}

function loadDemoDataEn() {
  state.cfg = {
    ...defaultCfg(),
    hourly: 50,
    company: 'Guest Ltd',
    ytunnus: '1234567-8',
    address: '1 Test Street, 00100 Helsinki',
    phone: '040 123 4567',
    email: 'billing@guestltd.com',
    tilinumero: 'FI21 1234 5600 0007 85',
    rounding: 15,
    vat: DEMO_VAT,
    kmRate: 0.57,
    showTilinumero: true,
    showErapaiva: true,
    recurring: [],
    services: [{ id: 1, name: 'Hourly work', rate: 50 }, { id: 2, name: 'Consulting', rate: 90 }],
    hideRate: false,
  };
  state.customers = [
    {
      id: 1,
      name: 'Example Ltd',
      ytunnus: '8765432-1',
      katuosoite: 'Example Street 5 B',
      postinumero: '00200',
      postitoimipaikka: 'Helsinki',
      sposti: 'invoices@exampleltd.com',
      puhelin: '09 876 5432',
      maksuehto: 14,
    },
    {
      id: 2,
      name: 'Demo Solutions Ltd',
      ytunnus: '9999888-7',
      katuosoite: 'Mill Street 12',
      postinumero: '33200',
      postitoimipaikka: 'Tampere',
      sposti: 'finance@demosolutionsltd.com',
      puhelin: '03 555 6677',
      maksuehto: 10,
    },
  ];

  // ── Invoiced entries ──

  const inv1Entries = [
    { id: 1, date: d('2026-01-08'), secs: 21600, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Project planning and kickoff', rate: 50, selected: false, invoiced: true },
    { id: 2, date: d('2026-01-20'), secs: 14400, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Architecture design',           rate: 50, selected: false, invoiced: true },
  ];

  const inv2Entries = [
    { id: 3, date: d('2026-02-05'), secs: 18000, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'Requirements specification',  rate: 50, selected: false, invoiced: true },
    { id: 4, date: d('2026-02-18'), secs: 10800, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'Prototype implementation',     rate: 50, selected: false, invoiced: true },
  ];

  const inv3Entries = [
    { id: 5, date: d('2026-03-10'), secs: 21600, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Backend development, sprint 1', rate: 50, selected: false, invoiced: true },
    { id: 6, date: d('2026-03-24'), secs: 14400, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'API integrations',              rate: 50, selected: false, invoiced: true },
  ];

  const inv4Entries = [
    { id: 7,  date: d('2026-04-07'), secs: 14400, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'UI design',              rate: 50, selected: false, invoiced: true },
    { id: 8,  date: d('2026-04-15'), secs: 18000, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'Frontend development',    rate: 50, selected: false, invoiced: true },
    { id: 9,  date: d('2026-04-28'), secs: 10800, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'Testing and fixes',       rate: 50, selected: false, invoiced: true },
  ];

  const inv5Entries = [
    { id: 10, date: d('2026-05-06'), secs: 28800, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Backend development, sprint 2', rate: 50, selected: false, invoiced: true },
    { id: 11, date: d('2026-05-19'), secs: 14400, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Performance testing',            rate: 50, selected: false, invoiced: true },
  ];

  // Most recent invoice — overdue, unpaid (invoice date 2026-06-01, terms 14 days → due 2026-06-15)
  const inv6Entries = [
    { id: 12, date: d('2026-05-26'), secs: 18000, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'UI development, polish', rate: 50, selected: false, invoiced: true },
    { id: 13, date: d('2026-05-30'), secs: 14400, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'Testing and release',    rate: 50, selected: false, invoiced: true },
  ];

  // Open entries
  const openEntries = [
    { id: 14, date: d('2026-06-10'), secs: 7200,  customer: 'Example Ltd',       customerId: 1, src: 'manuaalinen', notes: 'Follow-up and support',      rate: 50, selected: false, invoiced: false },
    { id: 15, date: d('2026-06-16'), secs: 12600, customer: 'Example Ltd',       customerId: 1, src: 'manuaalinen', notes: 'New feature implementation', rate: 50, selected: false, invoiced: false },
    { id: 16, date: d('2026-06-18'), secs: 5400,  customer: 'Example Ltd',       customerId: 1, src: 'manuaalinen', notes: 'Support request and fixes',  rate: 50, selected: false, invoiced: false },
    { id: 17, date: d('2026-06-12'), secs: 9000,  customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Architecture review',        rate: 90, service: 'Consulting', selected: false, invoiced: false },
    { id: 18, date: d('2026-06-19'), secs: 3600,  customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Onboarding support',          rate: 90, service: 'Consulting', selected: false, invoiced: false },
  ];

  // ── Expenses (general + mileage reimbursement) ──

  const inv4Expenses = [
    { id: 2, date: d('2026-04-20'), description: 'Mileage reimbursement: 38 km × €0.57 = €21.66', amount: 21.66, vat: 0, vatAmount: 0, customer: 'Example Ltd', customerId: 1, kind: 'km', km: 38, kmRate: 0.57, selected: false, invoiced: true },
  ];
  const inv5Expenses = [
    { id: 1, date: d('2026-05-12'), description: 'Travel costs for client meeting', amount: 35, vat: 0, vatAmount: 0, customer: 'Demo Solutions Ltd', customerId: 2, kind: 'general', km: 0, kmRate: null, selected: false, invoiced: true },
  ];

  // Open (uninvoiced) expenses
  const openExpenses = [
    { id: 3, date: d('2026-06-14'), description: 'Office supplies',                                     amount: 45,    vat: 0, vatAmount: 0, customerId: 1, kind: 'general', km: 0,  kmRate: null, selected: false, invoiced: false },
    { id: 4, date: d('2026-06-20'), description: 'Mileage reimbursement: 42 km × €0.57 = €23.94',        amount: 23.94, vat: 0, vatAmount: 0, customerId: 2, kind: 'km',      km: 42, kmRate: 0.57, selected: false, invoiced: false },
  ];

  state.invoices = [
    calcInvoice(6, '2026-06-01', inv6Entries, 14, false), // overdue, unpaid
    calcInvoice(5, '2026-05-30', inv5Entries, 10, true, inv5Expenses),
    calcInvoice(4, '2026-04-30', inv4Entries, 14, true, inv4Expenses),
    calcInvoice(3, '2026-03-31', inv3Entries, 10, true),
    calcInvoice(2, '2026-02-28', inv2Entries, 14, true),
    calcInvoice(1, '2026-01-31', inv1Entries, 10, true),
  ];

  state.entries = [
    ...openEntries,
    ...inv6Entries, ...inv5Entries, ...inv4Entries,
    ...inv3Entries, ...inv2Entries, ...inv1Entries,
  ];
  state.expenses = [...openExpenses, ...inv5Expenses, ...inv4Expenses];
  state.eId = 18;
  state.iId = 6;
  state.cId = 2;
  state.eExpId = 4;
}
