import { state } from './state.js';

const i18n = {
  fi: {
    // App
    appName: 'Työtunnit', latausVirhe: 'Latausvirhe', tallennusVirhe: 'Tallennusvirhe',
    // Navigaatio
    kello: 'Kello', kirjanpito: 'Kirjaukset', arkisto: 'Laskut', raportointi: 'Raportit', asetukset: 'Asetukset',
    // Kello
    clockIn: 'Kirjaudu sisään', clockOut: 'Kirjaudu ulos', pause: '⏸ Tauko', resume: '▶ Jatka',
    idle: 'Ei käynnissä', working: '● Töissä', onBreak: '⏸ Tauolla', taukoAlkaa: 'Tauko käynnistetty',
    jatko: 'Jatketaan', selectCustomer: 'Valitse ensin asiakas', noTime: 'Ei aikaa kirjattavana',
    addNotes: 'Lisää merkintöjä', notesPlaceholder: 'Merkintöjä tähän kirjaukseen...', kirjattu: 'Kirjattu ',
    clockedIn: 'Kirjauduttu sisään', cannotSwitch: 'Vaihda asiakas ensin kirjautumalla ulos',
    kmDriven: 'ajetut kilometrit',
    // Kirjaukset (manuaalinen)
    manualEntry: 'Manuaalinen kirjaus', date: 'Päivämäärä', customer: 'Asiakas',
    hours: 'Tunnit', minutes: 'Minuutit', notes: 'Merkintöjä', addEntry: '+ Lisää kirjaus',
    mNotesPlaceholder: 'Lisätietoja...',
    entryAdded: 'Kirjaus lisätty', entryUpdated: 'Kirjaus päivitetty', entryRemoved: 'Kirjaus poistettu',
    enterTime: 'Syötä aika', open: 'Avoin',
    editEntry: 'Muokkaa kirjausta', deleteEntry: 'Poista kirjaus',
    deleteEntryConfirm: 'Haluatko varmasti poistaa tämän kirjauksen?',
    // Kulukorvaukset
    expenses: 'Kulukorvaukset', expenseDesc: 'Kuvaus', expenseAmount: 'Summa (€)',
    addExpense: '+ Lisää kulu', expenseAdded: 'Kulu lisätty', expenseRemoved: 'Kulu poistettu',
    expenseDescRequired: 'Syötä kulun kuvaus', enterAmount: 'Syötä summa',
    expenseReimbursement: 'Kulukorvaus',
    // Kirjanpito-paneeli
    entries: 'Kirjauksia', selected: 'Valittuna', total: 'Tehdyt tunnit', value: 'Laskutukseen tuleva summa',
    selectAll: 'Valitse kaikki', buildInvoice: 'Kokoa lasku ↗',
    noEntries: 'Ei kirjauksia vielä.', loginFirst: 'Kirjaudu sisään tai lisää manuaalisesti.',
    noEntriesFor: 'Ei kirjauksia asiakkaalle', entries_count: 'kirjausta',
    selectEntries: 'Valitse kirjauksia ensin',
    // Laskut (arkisto)
    invoice: 'Lasku', invoicePrefix: 'Lasku #', noInvoices: 'Ei laskuja vielä.',
    grandTotal: 'Loppusumma', vatExcl: 'Veroton summa', monthlyCharge: 'Kuukausiveloitus',
    printPdf: 'Tulosta / PDF', printAttachment: 'Tulosta liitteeksi', edit: 'Muokkaa',
    invoiceUpdated: 'Lasku päivitetty', editInvoice: 'Muokkaa laskua',
    // Maksustatukset
    paid: 'Maksettu', unpaid: 'Maksamatta', invoiceOverdue: 'Lasku maksamatta',
    markPaid: 'Merkitse maksetuksi', markedPaid: 'Lasku merkitty maksetuksi',
    paidRemoved: 'Maksettu-merkintä poistettu',
    sendReminder: 'Lähetä maksumuistutus', sendInvoiceEmail: '✉ Lähetä lasku',
    notAvailableGuest: 'Ei käytössä testikäyttäjällä',
    noCustomerOnInvoice: 'Laskulle ei ole merkitty asiakasta.',
    multipleCustomersInvoice: 'Lasku sisältää useita asiakkaita – lähetä sähköposti manuaalisesti.',
    noCustomerEmail: 'ei ole sähköpostiosoitetta. Lisää se asiakastiedoissa.',
    invalidEmailAddr: 'Sähköpostiosoite näyttää virheelliseltä:',
    // Kilometrikorvaus
    kmReimbursement: 'Kilometrikorvaus', kmRate: 'Kilometrikorvaus', kmRateHint: 'Kilometrihinta laskuun',
    saveKmRate: 'Tallenna kilometrikorvaus', kmRateSaved: 'Kilometrikorvaus tallennettu',
    // Kuukausiveloitukset
    recurring: 'Kuukausiveloitukset', noRecurring: 'Ei kuukausiveloituksia.',
    doAddRecurring: 'Lisätäänkö kuukausiveloitukset?',
    addAllRecurring: 'Lisää kaikki kuukausiveloitukset',
    addCustomerRecurring: 'Lisää kuukausiveloitukset', noRecurringInvoice: 'Ei kuukausiveloituksia',
    addRecurring: '+ Lisää kuukausiveloitus', recNamePlaceholder: 'esim. Ylläpitomaksu',
    allCustomers: 'Kaikki asiakkaat',
    // Raportit
    reports: 'Raportit', customerSummary: 'Asiakaskohtainen yhteenveto',
    hourDistribution: 'Tuntijakauma asiakkaiden välillä', monthlyComparison: 'Vertailu kuukausien välillä',
    noInvoicesYear: 'Ei laskuja vuodelle',
    downloadReport: 'Lataa raportti', monthReport: 'Kuukausiraportti', yearReport: 'Vuosiraportti',
    monthNames: ['Tammikuu','Helmikuu','Maaliskuu','Huhtikuu','Toukokuu','Kesäkuu','Heinäkuu','Elokuu','Syyskuu','Lokakuu','Marraskuu','Joulukuu'],
    monthNamesShort: ['Tam','Hel','Maa','Huh','Tou','Kes','Hei','Elo','Syy','Lok','Mar','Jou'],
    invoicedLabel: 'Laskutettu', createdOn: 'Luotu', monthlyBreakdown: 'Kuukausittainen erittely',
    noActivity: 'Ei toimintaa', totalRow: 'Yhteensä', allInvoiced: 'Kaikki laskutettu',
    uninvoiced: 'Laskuttamatta', uninvoicedEntries: 'Laskuttamattomat kirjaukset',
    receipts: 'kuittiä', printSavePdf: '🖨 Tulosta / Tallenna PDF',
    invoiceSuffix: 'laskua', invoiceSuffix1: 'lasku',
    statusLabel: 'Tila', rateLabel: 'Hinta', valueLabel: 'Arvo', numberLabel: 'Numero',
    noEntriesMonth: 'Ei kirjauksia',
    // Asetukset
    companyInfo: 'Yritystiedot', companyName: 'Nimi / Yritys', companyAddress: 'Osoite',
    companyPhone: 'Puhelin', companyEmail: 'Sähköposti', save: 'Tallenna',
    pricing: 'Hinnoittelu', hourlyRateLabel: 'Tuntihinta', hourlyRate: 'Tuntihinta',
    rounding: 'Pyöristys', roundingHint: 'Pyöristää tunnit ylöspäin', roundingNone: 'Ei pyöristystä',
    vatLabel: 'ALV', vatHint: 'Lisätään laskun loppusummaan',
    saveHourlyBtn: 'Tallenna tuntihinta', saved: 'Tallennettu: ', invalidPrice: 'Virheellinen hinta',
    // Asiakkaat
    customersLabel: 'Asiakkaat', noCustomer: 'Ei asiakasta',
    customerAdded: 'Asiakas lisätty', customerExists: 'Asiakas on jo olemassa',
    customerRemoved: 'Asiakas poistettu',
    deleteCustomer: 'Poista asiakas', deleteCustomerConfirm: 'Haluatko varmasti poistaa asiakkaan',
    customerHasEntries: 'koostamaton kirjaus. Poistetaan asiakas ja kaikki sen kirjaukset pysyvästi?',
    customerHas: 'Asiakkaalla', has: 'on',
    // Modaalit
    saveChanges: 'Tallenna muutokset', cancel: 'Peruuta', confirm: 'Vahvista', yes: 'Kyllä',
    // Kirjautuminen
    loginFail: 'Kirjautuminen epäonnistui: ', loginFail2: 'Kirjautuminen epäonnistui',
    logout: 'Kirjaudu ulos', loginTitle: 'Työtunnit',
    loginSub: 'Seuraa työtunteja ja kokoa laskuja.', loginSub2: 'Kirjaudu sisään päästäksesi alkuun.',
    loginBtn: 'Kirjaudu Google-tilillä',
    loginFooter: 'Tietosi tallennetaan turvallisesti pilveen.',
    loginFooter2: 'Käytä samalla tilillä puhelimella ja tietokoneella.',
    // PWA
    language: 'Kieli', appInstalled: 'Sovellus asennettu!',
    installBanner: '📲 Lisää aloitusnäytölle käyttääksesi sovelluksena', install: 'Asenna',
    // Misc
    description: 'Kuvaus', amount: 'Summa (€)', added: 'Lisätty', enterName: 'Syötä nimi',
    fillDesc: 'Täytä kuvaus ja summa', invoiceArchived: 'arkistoitu',
    perHour: '€/h', perMonth: '/kk',
  },
  en: {
    // App
    appName: 'Work Hours', latausVirhe: 'Loading error', tallennusVirhe: 'Save error',
    // Navigation
    kello: 'Clock', kirjanpito: 'Entries', arkisto: 'Invoices', raportointi: 'Reports', asetukset: 'Settings',
    // Clock
    clockIn: 'Clock in', clockOut: 'Clock out', pause: '⏸ Pause', resume: '▶ Resume',
    idle: 'Not running', working: '● Working', onBreak: '⏸ On break', taukoAlkaa: 'Break started',
    jatko: 'Continuing...', selectCustomer: 'Select a customer first', noTime: 'No time recorded',
    addNotes: 'Add notes', notesPlaceholder: 'Notes for this entry...', kirjattu: 'Clocked out ',
    clockedIn: 'Clocked in', cannotSwitch: 'Clock out before switching customer',
    kmDriven: 'kilometers driven',
    // Entries (manual)
    manualEntry: 'Manual entry', date: 'Date', customer: 'Customer',
    hours: 'Hours', minutes: 'Minutes', notes: 'Notes', addEntry: '+ Add entry',
    mNotesPlaceholder: 'Additional info...',
    entryAdded: 'Entry added', entryUpdated: 'Entry updated', entryRemoved: 'Entry deleted',
    enterTime: 'Enter time', open: 'Open',
    editEntry: 'Edit entry', deleteEntry: 'Delete entry',
    deleteEntryConfirm: 'Are you sure you want to delete this entry?',
    // Expenses
    expenses: 'Expenses', expenseDesc: 'Description', expenseAmount: 'Amount (€)',
    addExpense: '+ Add expense', expenseAdded: 'Expense added', expenseRemoved: 'Expense removed',
    expenseDescRequired: 'Enter expense description', enterAmount: 'Enter amount',
    expenseReimbursement: 'Expense',
    // Entries panel
    entries: 'Entries', selected: 'Selected', total: 'Hours worked', value: 'Amount to invoice',
    selectAll: 'Select all', buildInvoice: 'Build invoice ↗',
    noEntries: 'No entries yet.', loginFirst: 'Clock in or add manually.',
    noEntriesFor: 'No entries for', entries_count: 'entries',
    selectEntries: 'Select entries first',
    // Invoices (archive)
    invoice: 'Invoice', invoicePrefix: 'Invoice #', noInvoices: 'No invoices yet.',
    grandTotal: 'Total', vatExcl: 'Excl. VAT', monthlyCharge: 'Monthly charge',
    printPdf: 'Print / PDF', printAttachment: 'Print as attachment', edit: 'Edit',
    invoiceUpdated: 'Invoice updated', editInvoice: 'Edit invoice',
    // Payment status
    paid: 'Paid', unpaid: 'Unpaid', invoiceOverdue: 'Invoice unpaid',
    markPaid: 'Mark as paid', markedPaid: 'Invoice marked as paid',
    paidRemoved: 'Payment status removed',
    sendReminder: 'Send payment reminder', sendInvoiceEmail: '✉ Send invoice',
    notAvailableGuest: 'Not available in demo mode',
    noCustomerOnInvoice: 'No customer on invoice.',
    multipleCustomersInvoice: 'Invoice has multiple customers – send email manually.',
    noCustomerEmail: 'has no email address. Add it in customer details.',
    invalidEmailAddr: 'Email address appears invalid:',
    // Mileage
    kmReimbursement: 'Mileage reimbursement', kmRate: 'Mileage rate', kmRateHint: 'Rate per kilometer on invoice',
    saveKmRate: 'Save mileage rate', kmRateSaved: 'Mileage rate saved',
    // Recurring
    recurring: 'Monthly charges', noRecurring: 'No monthly charges.',
    doAddRecurring: 'Do you want to add recurring costs?',
    addAllRecurring: 'Add all monthly charges',
    addCustomerRecurring: 'Add monthly charges', noRecurringInvoice: 'No monthly charges',
    addRecurring: '+ Add monthly charge', recNamePlaceholder: 'e.g. Maintenance fee',
    allCustomers: 'All customers',
    // Reports
    reports: 'Reports', customerSummary: 'Customer summary',
    hourDistribution: 'Hour distribution by customer', monthlyComparison: 'Monthly comparison',
    noInvoicesYear: 'No invoices for',
    downloadReport: 'Download report', monthReport: 'Monthly report', yearReport: 'Annual report',
    monthNames: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    monthNamesShort: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    invoicedLabel: 'Invoiced', createdOn: 'Created', monthlyBreakdown: 'Monthly breakdown',
    noActivity: 'No activity', totalRow: 'Total', allInvoiced: 'All invoiced',
    uninvoiced: 'Uninvoiced', uninvoicedEntries: 'Uninvoiced entries',
    receipts: 'receipts', printSavePdf: '🖨 Print / Save PDF',
    invoiceSuffix: 'invoices', invoiceSuffix1: 'invoice',
    statusLabel: 'Status', rateLabel: 'Rate', valueLabel: 'Value', numberLabel: 'Number',
    noEntriesMonth: 'No entries for',
    // Settings
    companyInfo: 'Company details', companyName: 'Name / Company', companyAddress: 'Address',
    companyPhone: 'Phone', companyEmail: 'Email', save: 'Save',
    pricing: 'Pricing', hourlyRateLabel: 'Hourly rate', hourlyRate: 'Hourly rate',
    rounding: 'Rounding', roundingHint: 'Rounds hours up', roundingNone: 'No rounding',
    vatLabel: 'VAT', vatHint: 'Added to invoice total',
    saveHourlyBtn: 'Save hourly rate', saved: 'Saved: ', invalidPrice: 'Invalid price',
    // Customers
    customersLabel: 'Customers', noCustomer: 'No customer',
    customerAdded: 'Customer added', customerExists: 'Customer already exists',
    customerRemoved: 'Customer removed',
    deleteCustomer: 'Delete customer', deleteCustomerConfirm: 'Are you sure you want to delete customer',
    customerHasEntries: 'unbuilt entries. Delete customer and all entries permanently?',
    customerHas: 'Customer', has: 'has',
    // Modals
    saveChanges: 'Save changes', cancel: 'Cancel', confirm: 'Confirm', yes: 'Yes',
    // Auth
    loginFail: 'Login failed: ', loginFail2: 'Login failed',
    logout: 'Sign out', loginTitle: 'Work Hours',
    loginSub: 'Track work hours and build invoices.', loginSub2: 'Sign in to get started.',
    loginBtn: 'Sign in with Google',
    loginFooter: 'Your data is stored securely in the cloud.',
    loginFooter2: 'Use the same account on phone and computer.',
    // PWA
    language: 'Language', appInstalled: 'App installed!',
    installBanner: '📲 Add to home screen to use as an app', install: 'Install',
    // Misc
    description: 'Description', amount: 'Amount (€)', added: 'Added', enterName: 'Enter name',
    fillDesc: 'Fill in description and amount', invoiceArchived: 'archived',
    perHour: '€/h', perMonth: '/mo',
  }
};

export function t(key) { return i18n[state.lang][key] || i18n['fi'][key] || key; }
