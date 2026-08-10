import { state, defaultCfg } from './state.js';

function d(dateStr) {
  return new Date(dateStr + 'T12:00:00').toISOString();
}

// Open/uninvoiced demo entries stay relative to "today" (max 20 days back)
// rather than fixed 2026 dates, so the guest demo always looks current no
// matter when someone actually tries it — the invoice history below is
// relative too (see monthsAgoLastDay/monthsAgoDay), so the whole demo
// timeline moves together as real time passes.
function daysAgo(n) {
  const dt = new Date();
  dt.setDate(dt.getDate() - n);
  dt.setHours(12, 0, 0, 0);
  return dt.toISOString();
}

function isoDateOnly(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Last calendar day of the month that is n months before the current month
// — e.g. n=2 with "today" in August gives June's last day (30.6.).
function monthsAgoLastDay(n) {
  const dt = new Date();
  dt.setDate(1);
  dt.setMonth(dt.getMonth() - n + 1, 0);
  return isoDateOnly(dt);
}

// A specific day-of-month within the month that is n months before the
// current month, clamped to that month's actual length.
function monthsAgoDay(n, day) {
  const dt = new Date();
  dt.setDate(1);
  dt.setMonth(dt.getMonth() - n);
  const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(day, lastDay));
  return isoDateOnly(dt);
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

  // ── Laskutetut kirjaukset — kummallakin asiakkaalla oma lasku joka kuukausi ──

  const inv1Entries = [
    { id: 1, date: d(monthsAgoDay(7, 8)),  secs: 43200, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Projektisuunnittelu ja kickoff', rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
    { id: 2, date: d(monthsAgoDay(7, 20)), secs: 28800, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Arkkitehtuurisuunnittelu',       rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
  ];
  const inv1bEntries = [
    { id: 21, date: d(monthsAgoDay(7, 6)),  secs: 28800, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Tarvekartoitus',              rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
    { id: 22, date: d(monthsAgoDay(7, 22)), secs: 21600, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Suunnitelman viimeistely',    rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
  ];

  const inv2Entries = [
    { id: 3, date: d(monthsAgoDay(6, 5)),  secs: 36000, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Vaatimusmäärittely',  rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
    { id: 4, date: d(monthsAgoDay(6, 18)), secs: 21600, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Prototyypin toteutus', rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
  ];
  const inv2bEntries = [
    { id: 23, date: d(monthsAgoDay(6, 9)),  secs: 25200, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Infra-pystytys',              rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
    { id: 24, date: d(monthsAgoDay(6, 21)), secs: 32400, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'CI/CD-putken rakentaminen',   rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
  ];

  const inv3Entries = [
    { id: 5, date: d(monthsAgoDay(5, 10)), secs: 43200, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Backend-kehitys, sprint 1', rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
    { id: 6, date: d(monthsAgoDay(5, 24)), secs: 28800, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'API-integraatiot',          rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
  ];
  const inv3bEntries = [
    { id: 25, date: d(monthsAgoDay(5, 12)), secs: 21600, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Tietokantasuunnittelu', rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
    { id: 26, date: d(monthsAgoDay(5, 26)), secs: 28800, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Käyttäjätestaus',        rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
  ];

  const inv4Entries = [
    { id: 7,  date: d(monthsAgoDay(4, 7)),  secs: 28800, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Käyttöliittymäsuunnittelu', rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
    { id: 8,  date: d(monthsAgoDay(4, 15)), secs: 36000, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Frontend-kehitys',          rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
    { id: 9,  date: d(monthsAgoDay(4, 28)), secs: 21600, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Testaus ja korjaukset',     rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
  ];
  const inv4bEntries = [
    { id: 27, date: d(monthsAgoDay(4, 6)),  secs: 36000, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Pilvipalvelun migraatio', rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
    { id: 28, date: d(monthsAgoDay(4, 23)), secs: 21600, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Kuormatestaus',           rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
  ];

  const inv5Entries = [
    { id: 10, date: d(monthsAgoDay(3, 6)),  secs: 57600, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Backend-kehitys, sprint 2', rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
    { id: 11, date: d(monthsAgoDay(3, 19)), secs: 28800, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Suorituskykytestaus',        rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
  ];
  const inv5bEntries = [
    { id: 29, date: d(monthsAgoDay(3, 9)),  secs: 25200, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Julkaisun valmistelu',       rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
    { id: 30, date: d(monthsAgoDay(3, 26)), secs: 18000, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Dokumentaation päivitys',    rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
  ];

  // Viimeisin lasku — toissa kuukauden viimeinen päivä, aina erääntynyt/maksamatta
  // (maksuehto 14pv → eräpäivä osuu viime kuun 14. päivälle)
  const inv6Entries = [
    { id: 12, date: d(monthsAgoDay(2, 20)), secs: 36000, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Käyttöliittymäkehitys, viimeistely', rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
    { id: 13, date: d(monthsAgoDay(2, 28)), secs: 28800, customer: 'Esimerkki Oy', customerId: 1, src: 'manuaalinen', notes: 'Testaus ja julkaisu',                rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
  ];
  const inv6bEntries = [
    { id: 31, date: d(monthsAgoDay(2, 10)), secs: 21600, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Ylläpitosopimuksen uusinta', rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
    { id: 32, date: d(monthsAgoDay(2, 24)), secs: 28800, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Integraatiotuki',            rate: 50, service: 'Tuntityö', selected: false, invoiced: true },
  ];

  // Avoimet kirjaukset — suhteessa tähän päivään, enintään 20 päivää taaksepäin
  const openEntries = [
    { id: 14, date: daysAgo(18), secs: 14400, customer: 'Esimerkki Oy',      customerId: 1, src: 'manuaalinen', notes: 'Jälkiseuranta ja tuki',       rate: 50, service: 'Tuntityö', selected: false, invoiced: false },
    { id: 17, date: daysAgo(15), secs: 18000, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Arkkitehtuurikatselmus',       rate: 90, service: 'Konsultointi', selected: false, invoiced: false },
    { id: 19, date: daysAgo(13), secs: 21600, customer: 'Esimerkki Oy',      customerId: 1, src: 'manuaalinen', notes: 'Sopimusneuvottelu',            rate: 50, service: 'Tuntityö', selected: false, invoiced: false },
    { id: 15, date: daysAgo(11), secs: 25200, customer: 'Esimerkki Oy',      customerId: 1, src: 'manuaalinen', notes: 'Uuden ominaisuuden toteutus',  rate: 50, service: 'Tuntityö', selected: false, invoiced: false },
    { id: 20, date: daysAgo(8),  secs: 25200, customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Tietoturva-auditointi',        rate: 90, service: 'Konsultointi', selected: false, invoiced: false },
    { id: 16, date: daysAgo(6),  secs: 10800, customer: 'Esimerkki Oy',      customerId: 1, src: 'manuaalinen', notes: 'Tukipyyntö ja korjaukset',     rate: 50, service: 'Tuntityö', selected: false, invoiced: false },
    { id: 18, date: daysAgo(4),  secs: 7200,  customer: 'Demo Solutions Oy', customerId: 2, src: 'manuaalinen', notes: 'Käyttöönottotuki',             rate: 90, service: 'Konsultointi', selected: false, invoiced: false },
  ];

  // ── Kulukorvaukset (yleinen + kilometrikorvaus) ──

  const inv4Expenses = [
    { id: 2, date: d(monthsAgoDay(4, 20)), description: 'Kilometrikorvaus: 38 km × 0,57 € = 21,66 €', amount: 21.66, vat: 0, vatAmount: 0, customer: 'Esimerkki Oy', customerId: 1, kind: 'km', km: 38, kmRate: 0.57, selected: false, invoiced: true },
  ];
  const inv5Expenses = [
    { id: 1, date: d(monthsAgoDay(3, 12)), description: 'Matkakulut asiakastapaamiseen', amount: 35, vat: 0, vatAmount: 0, customer: 'Demo Solutions Oy', customerId: 2, kind: 'general', km: 0, kmRate: null, selected: false, invoiced: true },
  ];

  // Avoimet kulukorvaukset — suhteessa tähän päivään, enintään 20 päivää taaksepäin
  const openExpenses = [
    { id: 3, date: daysAgo(9), description: 'Toimistotarvikkeet',                                       amount: 45,    vat: 0, vatAmount: 0, customerId: 1, kind: 'general', km: 0,  kmRate: null, selected: false, invoiced: false },
    { id: 4, date: daysAgo(2), description: 'Kilometrikorvaus: 42 km × 0,57 € = 23,94 €',                amount: 23.94, vat: 0, vatAmount: 0, customerId: 2, kind: 'km',      km: 42, kmRate: 0.57, selected: false, invoiced: false },
  ];

  state.invoices = [
    calcInvoice(12, monthsAgoLastDay(2), inv6bEntries, 10, true),                        // Demo Solutions Oy
    calcInvoice(11, monthsAgoLastDay(2), inv6Entries, 14, false, [], DEMO_VAT),          // Esimerkki Oy — erääntynyt/maksamatta
    calcInvoice(10, monthsAgoLastDay(3), inv5bEntries, 14, true),                        // Esimerkki Oy
    calcInvoice(9,  monthsAgoLastDay(3), inv5Entries, 10, true, inv5Expenses),           // Demo Solutions Oy
    calcInvoice(8,  monthsAgoLastDay(4), inv4bEntries, 10, true),                        // Demo Solutions Oy
    calcInvoice(7,  monthsAgoLastDay(4), inv4Entries, 14, true, inv4Expenses),           // Esimerkki Oy
    calcInvoice(6,  monthsAgoLastDay(5), inv3bEntries, 14, true),                        // Esimerkki Oy
    calcInvoice(5,  monthsAgoLastDay(5), inv3Entries, 10, true),                         // Demo Solutions Oy
    calcInvoice(4,  monthsAgoLastDay(6), inv2bEntries, 10, true),                        // Demo Solutions Oy
    calcInvoice(3,  monthsAgoLastDay(6), inv2Entries, 14, true),                         // Esimerkki Oy
    calcInvoice(2,  monthsAgoLastDay(7), inv1bEntries, 14, true),                        // Esimerkki Oy
    calcInvoice(1,  monthsAgoLastDay(7), inv1Entries, 10, true),                         // Demo Solutions Oy
  ];

  state.entries = [
    ...openEntries,
    ...inv6bEntries, ...inv6Entries, ...inv5bEntries, ...inv5Entries,
    ...inv4bEntries, ...inv4Entries, ...inv3bEntries, ...inv3Entries,
    ...inv2bEntries, ...inv2Entries, ...inv1bEntries, ...inv1Entries,
  ];
  state.expenses = [...openExpenses, ...inv5Expenses, ...inv4Expenses];
  state.eId = 32;
  state.iId = 12;
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

  // ── Invoiced entries — both customers get an invoice every month ──

  const inv1Entries = [
    { id: 1, date: d(monthsAgoDay(7, 8)),  secs: 43200, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Project planning and kickoff', rate: 50, service: 'Hourly work', selected: false, invoiced: true },
    { id: 2, date: d(monthsAgoDay(7, 20)), secs: 28800, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Architecture design',           rate: 50, service: 'Hourly work', selected: false, invoiced: true },
  ];
  const inv1bEntries = [
    { id: 21, date: d(monthsAgoDay(7, 6)),  secs: 28800, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'Needs assessment',   rate: 50, service: 'Hourly work', selected: false, invoiced: true },
    { id: 22, date: d(monthsAgoDay(7, 22)), secs: 21600, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'Plan finalization',  rate: 50, service: 'Hourly work', selected: false, invoiced: true },
  ];

  const inv2Entries = [
    { id: 3, date: d(monthsAgoDay(6, 5)),  secs: 36000, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'Requirements specification',  rate: 50, service: 'Hourly work', selected: false, invoiced: true },
    { id: 4, date: d(monthsAgoDay(6, 18)), secs: 21600, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'Prototype implementation',     rate: 50, service: 'Hourly work', selected: false, invoiced: true },
  ];
  const inv2bEntries = [
    { id: 23, date: d(monthsAgoDay(6, 9)),  secs: 25200, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Infrastructure setup',    rate: 50, service: 'Hourly work', selected: false, invoiced: true },
    { id: 24, date: d(monthsAgoDay(6, 21)), secs: 32400, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'CI/CD pipeline setup',     rate: 50, service: 'Hourly work', selected: false, invoiced: true },
  ];

  const inv3Entries = [
    { id: 5, date: d(monthsAgoDay(5, 10)), secs: 43200, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Backend development, sprint 1', rate: 50, service: 'Hourly work', selected: false, invoiced: true },
    { id: 6, date: d(monthsAgoDay(5, 24)), secs: 28800, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'API integrations',              rate: 50, service: 'Hourly work', selected: false, invoiced: true },
  ];
  const inv3bEntries = [
    { id: 25, date: d(monthsAgoDay(5, 12)), secs: 21600, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'Database design', rate: 50, service: 'Hourly work', selected: false, invoiced: true },
    { id: 26, date: d(monthsAgoDay(5, 26)), secs: 28800, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'User testing',     rate: 50, service: 'Hourly work', selected: false, invoiced: true },
  ];

  const inv4Entries = [
    { id: 7,  date: d(monthsAgoDay(4, 7)),  secs: 28800, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'UI design',              rate: 50, service: 'Hourly work', selected: false, invoiced: true },
    { id: 8,  date: d(monthsAgoDay(4, 15)), secs: 36000, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'Frontend development',    rate: 50, service: 'Hourly work', selected: false, invoiced: true },
    { id: 9,  date: d(monthsAgoDay(4, 28)), secs: 21600, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'Testing and fixes',       rate: 50, service: 'Hourly work', selected: false, invoiced: true },
  ];
  const inv4bEntries = [
    { id: 27, date: d(monthsAgoDay(4, 6)),  secs: 36000, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Cloud migration',   rate: 50, service: 'Hourly work', selected: false, invoiced: true },
    { id: 28, date: d(monthsAgoDay(4, 23)), secs: 21600, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Load testing',       rate: 50, service: 'Hourly work', selected: false, invoiced: true },
  ];

  const inv5Entries = [
    { id: 10, date: d(monthsAgoDay(3, 6)),  secs: 57600, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Backend development, sprint 2', rate: 50, service: 'Hourly work', selected: false, invoiced: true },
    { id: 11, date: d(monthsAgoDay(3, 19)), secs: 28800, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Performance testing',            rate: 50, service: 'Hourly work', selected: false, invoiced: true },
  ];
  const inv5bEntries = [
    { id: 29, date: d(monthsAgoDay(3, 9)),  secs: 25200, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'Release preparation',   rate: 50, service: 'Hourly work', selected: false, invoiced: true },
    { id: 30, date: d(monthsAgoDay(3, 26)), secs: 18000, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'Documentation update',  rate: 50, service: 'Hourly work', selected: false, invoiced: true },
  ];

  // Most recent invoice — last day of the month before last, always overdue/unpaid
  // (14-day terms → due date falls on the 14th of last month)
  const inv6Entries = [
    { id: 12, date: d(monthsAgoDay(2, 20)), secs: 36000, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'UI development, polish', rate: 50, service: 'Hourly work', selected: false, invoiced: true },
    { id: 13, date: d(monthsAgoDay(2, 28)), secs: 28800, customer: 'Example Ltd', customerId: 1, src: 'manuaalinen', notes: 'Testing and release',    rate: 50, service: 'Hourly work', selected: false, invoiced: true },
  ];
  const inv6bEntries = [
    { id: 31, date: d(monthsAgoDay(2, 10)), secs: 21600, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Support contract renewal', rate: 50, service: 'Hourly work', selected: false, invoiced: true },
    { id: 32, date: d(monthsAgoDay(2, 24)), secs: 28800, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Integration support',      rate: 50, service: 'Hourly work', selected: false, invoiced: true },
  ];

  // Open entries — relative to today, at most 20 days back
  const openEntries = [
    { id: 14, date: daysAgo(18), secs: 14400, customer: 'Example Ltd',       customerId: 1, src: 'manuaalinen', notes: 'Follow-up and support',      rate: 50, service: 'Hourly work', selected: false, invoiced: false },
    { id: 17, date: daysAgo(15), secs: 18000, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Architecture review',        rate: 90, service: 'Consulting', selected: false, invoiced: false },
    { id: 19, date: daysAgo(13), secs: 21600, customer: 'Example Ltd',       customerId: 1, src: 'manuaalinen', notes: 'Contract negotiation',       rate: 50, service: 'Hourly work', selected: false, invoiced: false },
    { id: 15, date: daysAgo(11), secs: 25200, customer: 'Example Ltd',       customerId: 1, src: 'manuaalinen', notes: 'New feature implementation', rate: 50, service: 'Hourly work', selected: false, invoiced: false },
    { id: 20, date: daysAgo(8),  secs: 25200, customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Security audit',             rate: 90, service: 'Consulting', selected: false, invoiced: false },
    { id: 16, date: daysAgo(6),  secs: 10800, customer: 'Example Ltd',       customerId: 1, src: 'manuaalinen', notes: 'Support request and fixes',  rate: 50, service: 'Hourly work', selected: false, invoiced: false },
    { id: 18, date: daysAgo(4),  secs: 7200,  customer: 'Demo Solutions Ltd', customerId: 2, src: 'manuaalinen', notes: 'Onboarding support',          rate: 90, service: 'Consulting', selected: false, invoiced: false },
  ];

  // ── Expenses (general + mileage reimbursement) ──

  const inv4Expenses = [
    { id: 2, date: d(monthsAgoDay(4, 20)), description: 'Mileage reimbursement: 38 km × €0.57 = €21.66', amount: 21.66, vat: 0, vatAmount: 0, customer: 'Example Ltd', customerId: 1, kind: 'km', km: 38, kmRate: 0.57, selected: false, invoiced: true },
  ];
  const inv5Expenses = [
    { id: 1, date: d(monthsAgoDay(3, 12)), description: 'Travel costs for client meeting', amount: 35, vat: 0, vatAmount: 0, customer: 'Demo Solutions Ltd', customerId: 2, kind: 'general', km: 0, kmRate: null, selected: false, invoiced: true },
  ];

  // Open (uninvoiced) expenses — relative to today, at most 20 days back
  const openExpenses = [
    { id: 3, date: daysAgo(9), description: 'Office supplies',                                     amount: 45,    vat: 0, vatAmount: 0, customerId: 1, kind: 'general', km: 0,  kmRate: null, selected: false, invoiced: false },
    { id: 4, date: daysAgo(2), description: 'Mileage reimbursement: 42 km × €0.57 = €23.94',        amount: 23.94, vat: 0, vatAmount: 0, customerId: 2, kind: 'km',      km: 42, kmRate: 0.57, selected: false, invoiced: false },
  ];

  state.invoices = [
    calcInvoice(12, monthsAgoLastDay(2), inv6bEntries, 10, true),                      // Demo Solutions Ltd
    calcInvoice(11, monthsAgoLastDay(2), inv6Entries, 14, false),                      // Example Ltd — overdue, unpaid
    calcInvoice(10, monthsAgoLastDay(3), inv5bEntries, 14, true),                       // Example Ltd
    calcInvoice(9,  monthsAgoLastDay(3), inv5Entries, 10, true, inv5Expenses),          // Demo Solutions Ltd
    calcInvoice(8,  monthsAgoLastDay(4), inv4bEntries, 10, true),                       // Demo Solutions Ltd
    calcInvoice(7,  monthsAgoLastDay(4), inv4Entries, 14, true, inv4Expenses),          // Example Ltd
    calcInvoice(6,  monthsAgoLastDay(5), inv3bEntries, 14, true),                       // Example Ltd
    calcInvoice(5,  monthsAgoLastDay(5), inv3Entries, 10, true),                        // Demo Solutions Ltd
    calcInvoice(4,  monthsAgoLastDay(6), inv2bEntries, 10, true),                       // Demo Solutions Ltd
    calcInvoice(3,  monthsAgoLastDay(6), inv2Entries, 14, true),                        // Example Ltd
    calcInvoice(2,  monthsAgoLastDay(7), inv1bEntries, 14, true),                       // Example Ltd
    calcInvoice(1,  monthsAgoLastDay(7), inv1Entries, 10, true),                        // Demo Solutions Ltd
  ];

  state.entries = [
    ...openEntries,
    ...inv6bEntries, ...inv6Entries, ...inv5bEntries, ...inv5Entries,
    ...inv4bEntries, ...inv4Entries, ...inv3bEntries, ...inv3Entries,
    ...inv2bEntries, ...inv2Entries, ...inv1bEntries, ...inv1Entries,
  ];
  state.expenses = [...openExpenses, ...inv5Expenses, ...inv4Expenses];
  state.eId = 32;
  state.iId = 12;
  state.cId = 2;
  state.eExpId = 4;
}
