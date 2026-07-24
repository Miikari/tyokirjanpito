# Hoyla ⏱

A Progressive Web App for freelancers to track work hours, manage clients, and generate invoices — a mini ERP, relaunching under the **hoyla.dev** brand with a Stripe-powered subscription layer in progress.

Live: **https://miikari.github.io/tyokirjanpito**

## Features

- **Time Tracking** — Clock in/out with customer and service selection, pause support, configurable rounding (none/15/30/60 min)
- **Manual Entries** — Add work entries by hand with date, hours, minutes, and notes
- **Customers** — Add/edit/delete customers with contact details, per-customer payment terms (fixed days or "per separate agreement"), and a per-customer **invoice language** (Finnish/English) — invoices are generated in the customer's language, independent of the freelancer's own UI language
- **Expense reimbursements** — Track billable expenses per customer, including negative amounts for credit notes
- **Invoice Builder** — Select unbilled entries/expenses for one customer, optionally fold in recurring monthly charges, and build an invoice
- **PDF / Print Export** — Generate a printable invoice or a details-free hour breakdown, with company branding, payment terms, due date, and Finnish reference number (viitenumero)
- **Recurring monthly charges** — Per-customer or catalog-wide, added to invoices automatically or on request
- **VAT** — Configurable rate (0%, 10%, 14%, 25.5%)
- **Payment tracking** — Mark invoices paid/unpaid, automatic overdue detection, one-click payment reminder / send-invoice emails (`mailto:`, no backend involved)
- **Reports** — Monthly/yearly summaries, per-customer breakdowns, downloadable reports
- **Multi-language UI** — Finnish and English, auto-detected from the browser on first visit (`js/state.js`), user choice persisted after that
- **Multi-user organizations** — Firestore-backed orgs with invite-code join, so a freelancer's data can later be shared with a small team without restructuring
- **Guest/demo mode** — Anonymous sign-in seeds realistic sample data (`js/demo.js`) in the visitor's own UI language, so anyone can try the app with zero setup
- **Cloud sync** — All data (entries, invoices, expenses, customers, settings) synced via Firestore across devices
- **PWA** — Installable on iOS/Android, works offline via a cache-first service worker

## Tech stack

- **Frontend**: vanilla JavaScript ES modules (no framework, no bundler/build step), plain CSS, static HTML
- **Firebase Authentication** — Google Sign-In + anonymous (guest/demo)
- **Firebase Firestore** — all app data, org-scoped (see Data model below)
- **Firebase Cloud Functions** (Node.js, in `functions/`) — backend for Stripe billing; the frontend itself has no other server component
- **Stripe** — Billing (subscriptions), Invoicing, Tax — see Billing section below
- Hosted as a static site on **GitHub Pages**; Firebase/Firestore project id is `tyoaikakirjanpito`

## Project structure

```
index.html          Single-page app shell — all panels/modals live here
css/style.css        All styling
sw.js                 Service worker (cache-first for JS/CSS, network-first for HTML)
manifest.json         PWA manifest

js/
  app.js               Bootstraps the app (auth listener, i18n, initial renders)
  firebase.js           Firebase SDK init (compat CDN build, not npm)
  state.js               Central mutable app state + language auto-detection
  i18n.js                 fi/en translation dictionaries, t(key, lang?)
  auth.js                 Sign-in/out, user display, guest/demo bootstrap
  org.js                   Multi-user org creation/join/invite-code logic
  storage.js               Firestore load/save (debounced autosave)
  clock.js                  Clock in/out, active customer/service pickers
  entries.js                Manual entries, entry list rendering/filtering
  customers.js               Customer CRUD, per-customer invoice language
  invoices.js                 Invoice building, printing, payment/reminder emails
  reports.js                   Monthly/yearly report generation
  settings.js                   Company info, pricing, services, org settings UI
  utils.js                      Formatters + validators (email, phone, Y-tunnus, IBAN+checksum)
  demo.js                        Guest-mode sample data (fi/en)

functions/            Firebase Cloud Functions (Stripe backend — see Billing below)
  index.js
  src/stripe.js         Stripe client + secrets
  src/org.js              Shared "is caller a member of this org" auth check
  src/checkout.js          createCheckoutSession callable
  src/portal.js             createPortalSession callable (Stripe Customer Portal)
  src/webhook.js             stripeWebhook — verifies signatures, syncs org plan/status

firestore.rules       Security rules (see Data model)
firebase.json          Firestore + Functions config
```

## Data model (Firestore)

- `users/{uid}` — maps a Firebase user to their org (`orgId`) and profile.
- `orgs/{orgId}` — `{ name, ownerId, members: { uid: {role, email, displayName} }, inviteCode, createdAt }`, plus billing fields (see below). Multiple users can share one org via invite code; a solo freelancer just has an org of one.
- `orgs/{orgId}/data/main` — the actual app data: `entries`, `invoices`, `expenses`, `cfg` (company info, customers, services, settings), counters.

Rules (`firestore.rules`) gate all org access on `members[uid] != null`, and specifically forbid clients from writing the billing fields on the org doc directly (see below) — only the Cloud Functions' Admin SDK can set those.

## Local development

No build step for the frontend — serve the repo root with any static file server, e.g.:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/`.

For the Functions backend, see **Billing** below — it needs the Firebase Emulator Suite and the Stripe CLI for local iteration.

### Service worker / cache-busting

The service worker (`sw.js`) is cache-first for JS/CSS. **Every deploy that changes JS/CSS must bump `CACHE = 'tyotunnit-vNN'` in `sw.js`**, or returning visitors keep the old cached files. A pre-commit hook (`.claude/settings.json`, PreToolUse on `git commit`) does this automatically — no manual step needed when committing through the normal flow.

## Billing (Stripe) — in progress

hoyla.dev freemium model: free tier capped at **50 entries or 5 built invoices** (whichever first); **Pro** removes the cap for **€9.90/month** (flat/standard Stripe pricing, not usage-based). See `.claude/plans/generic-bubbling-rossum.md` for the full implementation plan.

- Backend: Firebase Cloud Functions (`functions/`) — `createCheckoutSession`, `createPortalSession`, `stripeWebhook`. Subscription state (`plan`, `subscriptionStatus`, `stripeCustomerId`, `stripeSubscriptionId`, `currentPeriodEnd`) lives on the `orgs/{orgId}` doc, writable only via the Admin SDK (enforced in `firestore.rules`).
- The quota gate uses **lifetime, increment-only counters** (`lifetimeEntryCount`, `lifetimeInvoiceCount` on the org doc) — never live `entries.length`/`invoices.length` — so deleting entries/invoices can never be used to duck back under the free-tier limit. Enforced both in app logic and in `firestore.rules` (client writes may only increase these fields, never decrease them).
- Requires the Firebase project on the **Blaze** (pay-as-you-go) plan — Cloud Functions don't run on the free Spark plan. (Already upgraded.)
- Secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) are stored via Firebase Secret Manager (`firebase functions:secrets:set ...`), never committed or hardcoded. A repo-root `keys` file exists for local reference only (gitignored) and is never read by the Functions code.
- Uses a Stripe **restricted API key**, not a full secret key, scoped to only what these functions need.
- Local testing: `firebase emulators:start --only functions,firestore` + `stripe listen --forward-to <emulator-url>` + `stripe trigger <event>` to exercise webhook handling without touching deployed functions or real Stripe data.
- Tax: Stripe Tax with `automatic_tax`, gated on an active Finland registration (Dashboard) before going live; expanding to more countries later is a Dashboard-only change, no code changes needed.

## Deployment

- **Frontend**: any push to `main` auto-deploys to GitHub Pages.
- **Backend**: `firebase deploy --only functions` (requires Blaze plan + Stripe secrets already set).
- **Firestore rules**: `firebase deploy --only firestore:rules`.
