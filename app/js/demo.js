import { state } from './state.js';

function d(dateStr) {
  return new Date(dateStr + 'T12:00:00').toISOString();
}

function calcInvoice(id, dateStr, entries, maksuehto, paid = true) {
  const totalSecs = entries.reduce((a, e) => a + e.secs, 0);
  const hourly = entries.reduce((a, e) => a + (e.secs / 3600) * e.rate, 0);
  return {
    id, date: d(dateStr), entries: entries.map(e => ({ ...e })),
    totalSecs, hourly, monthly: 0, subtotal: hourly,
    vatAmount: 0, vat: 0, total: hourly, recurring: [], maksuehto, paid,
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
    hourly: 50,
    company: 'Vierailija Oy',
    ytunnus: '1234567-8',
    address: 'Testikatu 1, 00100 Helsinki',
    phone: '040 123 4567',
    email: 'laskutus@vierailijaoy.fi',
    tilinumero: 'FI21 1234 5600 0007 85',
    rounding: 15,
    vat: 0,
    showTilinumero: true,
    showErapaiva: true,
    showViitenumero: false,
    recurring: [],
    services: [{ id: 1, name: 'Tuntityö', rate: 50 }],
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
    { id: 17, date: d('2026-06-12'), secs: 9000,  customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Käyttäjätestaus, raportti',    rate: 50, selected: false, invoiced: false },
    { id: 18, date: d('2026-06-19'), secs: 3600,  customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Bugikorjaukset',               rate: 50, selected: false, invoiced: false },
  ];

  state.invoices = [
    calcInvoice(6, '2026-06-01', inv6Entries, 14, false), // erääntynyt, maksamatta
    calcInvoice(5, '2026-05-30', inv5Entries, 10, true),
    calcInvoice(4, '2026-04-30', inv4Entries, 14, true),
    calcInvoice(3, '2026-03-31', inv3Entries, 10, true),
    calcInvoice(2, '2026-02-28', inv2Entries, 14, true),
    calcInvoice(1, '2026-01-31', inv1Entries, 10, true),
  ];

  state.entries = [
    ...openEntries,
    ...inv6Entries, ...inv5Entries, ...inv4Entries,
    ...inv3Entries, ...inv2Entries, ...inv1Entries,
  ];
  state.eId = 18;
  state.iId = 6;
  state.cId = 2;
}

function loadDemoDataEn() {
  state.cfg = {
    hourly: 50,
    company: 'Guest Ltd',
    ytunnus: '1234567-8',
    address: '1 Test Street, 00100 Helsinki',
    phone: '040 123 4567',
    email: 'billing@guestltd.com',
    tilinumero: 'FI21 1234 5600 0007 85',
    rounding: 15,
    vat: 0,
    showTilinumero: true,
    showErapaiva: true,
    showViitenumero: false,
    recurring: [],
    services: [{ id: 1, name: 'Hourly work', rate: 50 }],
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
    { id: 17, date: d('2026-06-12'), secs: 9000,  customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'User testing, report',       rate: 50, selected: false, invoiced: false },
    { id: 18, date: d('2026-06-19'), secs: 3600,  customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Bug fixes',                  rate: 50, selected: false, invoiced: false },
  ];

  state.invoices = [
    calcInvoice(6, '2026-06-01', inv6Entries, 14, false), // overdue, unpaid
    calcInvoice(5, '2026-05-30', inv5Entries, 10, true),
    calcInvoice(4, '2026-04-30', inv4Entries, 14, true),
    calcInvoice(3, '2026-03-31', inv3Entries, 10, true),
    calcInvoice(2, '2026-02-28', inv2Entries, 14, true),
    calcInvoice(1, '2026-01-31', inv1Entries, 10, true),
  ];

  state.entries = [
    ...openEntries,
    ...inv6Entries, ...inv5Entries, ...inv4Entries,
    ...inv3Entries, ...inv2Entries, ...inv1Entries,
  ];
  state.eId = 18;
  state.iId = 6;
  state.cId = 2;
}
