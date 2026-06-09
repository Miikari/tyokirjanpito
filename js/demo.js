import { state } from './state.js';

function d(dateStr) {
  return new Date(dateStr + 'T12:00:00').toISOString();
}

export function loadDemoData() {
  state.cfg = {
    hourly: 50,
    company: 'Vierailija Oy',
    ytunnus: '1234567-8',
    address: 'Testikatu 1, 00100 Helsinki',
    phone: '040 123 4567',
    email: 'laskutus@vierailija.fi',
    tilinumero: 'FI21 1234 5600 0007 85',
    rounding: 15,
    vat: 0,
    showTilinumero: true,
    showErapaiva: true,
    showViitenumero: false,
    recurring: [],
    customers: [
      {
        name: 'Esimerkki Oy',
        ytunnus: '8765432-1',
        katuosoite: 'Esimerkkikatu 5 B',
        postinumero: '00200',
        postitoimipaikka: 'Helsinki',
        sposti: 'laskut@esimerkki.fi',
        puhelin: '09 876 5432',
        maksuehto: 14,
      },
      {
        name: 'Demo Solutions Oy',
        ytunnus: '9999888-7',
        katuosoite: 'Kehräämöntie 12',
        postinumero: '33200',
        postitoimipaikka: 'Tampere',
        sposti: 'talous@demosolutions.fi',
        puhelin: '03 555 6677',
        maksuehto: 10,
      },
    ],
  };

  // Laskutetut kirjaukset — Invoice 001 (Demo Solutions Oy)
  const inv1Entries = [
    { id: 1, date: d('2026-04-08'), secs: 14400, customer: 'Demo Solutions Oy', src: 'manuaalinen', notes: 'Projektisuunnittelu', rate: 50, selected: false, invoiced: true },
    { id: 2, date: d('2026-04-15'), secs: 18000, customer: 'Demo Solutions Oy', src: 'manuaalinen', notes: 'Kehitystyö, sprint 1', rate: 50, selected: false, invoiced: true },
    { id: 3, date: d('2026-04-22'), secs: 10800, customer: 'Demo Solutions Oy', src: 'manuaalinen', notes: 'Testaus ja dokumentointi', rate: 50, selected: false, invoiced: true },
  ];

  // Laskutetut kirjaukset — Invoice 002 (Esimerkki Oy)
  const inv2Entries = [
    { id: 4, date: d('2026-03-10'), secs: 21600, customer: 'Esimerkki Oy', src: 'manuaalinen', notes: 'Alkukartoitus ja suunnitelma', rate: 50, selected: false, invoiced: true },
    { id: 5, date: d('2026-03-24'), secs: 14400, customer: 'Esimerkki Oy', src: 'manuaalinen', notes: 'Toteutus ja käyttöönotto', rate: 50, selected: false, invoiced: true },
  ];

  // Avoimet kirjaukset
  const openEntries = [
    { id: 6, date: d('2026-05-20'), secs: 7200,  customer: 'Esimerkki Oy',    src: 'manuaalinen', notes: 'Palaveri asiakkaan kanssa', rate: 50, selected: false, invoiced: false },
    { id: 7, date: d('2026-05-27'), secs: 12600, customer: 'Esimerkki Oy',    src: 'manuaalinen', notes: 'Verkkosivujen päivitys',     rate: 50, selected: false, invoiced: false },
    { id: 8, date: d('2026-06-03'), secs: 5400,  customer: 'Esimerkki Oy',    src: 'manuaalinen', notes: 'Tukipyyntö ja korjaukset',   rate: 50, selected: false, invoiced: false },
    { id: 9, date: d('2026-05-29'), secs: 9000,  customer: 'Demo Solutions Oy', src: 'manuaalinen', notes: 'Käyttäjätestaus, raportti', rate: 50, selected: false, invoiced: false },
    { id: 10, date: d('2026-06-05'), secs: 3600, customer: 'Demo Solutions Oy', src: 'manuaalinen', notes: 'Bugikorjaukset',            rate: 50, selected: false, invoiced: false },
  ];

  function calcInvoice(id, dateStr, entries, maksuehto) {
    const totalSecs = entries.reduce((a, e) => a + e.secs, 0);
    const hourly = entries.reduce((a, e) => a + (e.secs / 3600) * e.rate, 0);
    return { id, date: d(dateStr), entries: entries.map(e => ({ ...e })), totalSecs, hourly, monthly: 0, subtotal: hourly, vatAmount: 0, vat: 0, total: hourly, recurring: [], maksuehto };
  }

  state.invoices = [
    calcInvoice(2, '2026-03-31', inv2Entries, 14),
    calcInvoice(1, '2026-04-30', inv1Entries, 10),
  ];

  state.entries = [...openEntries, ...inv2Entries, ...inv1Entries];
  state.eId = 10;
  state.iId = 2;
}
