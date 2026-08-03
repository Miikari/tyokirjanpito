const { defineSecret } = require('firebase-functions/params');
const Stripe = require('stripe');

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// Not secret: differs between test/live, but the values themselves aren't
// sensitive. Two Prices on the same live-mode "Hoyla Pro" Product — monthly
// (14.90€) and yearly (149.90€) — Stripe's recommended way to offer a
// billing-interval choice without it being a separate tier/Product.
const PRO_PRICE_IDS = {
  month: process.env.STRIPE_PRO_PRICE_ID || 'price_1TyHsGV05EjopucBzSlluF21',
  year: process.env.STRIPE_PRO_PRICE_ID_YEARLY || 'price_1TyHrxV05EjopucBYrO5Le6Z',
};
const APP_ORIGIN = process.env.APP_ORIGIN || 'https://hoyla.fi';

function getStripe() {
  return new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: '2026-06-24.dahlia' });
}

// Retrieving a deleted customer does NOT throw — it returns 200 with
// `deleted: true` — so a bare try/catch isn't enough, the flag must be
// checked explicitly. Used by checkout/portal to detect a Stripe customer
// that's gone missing (e.g. test-mode data cleared in the dashboard, which
// fires no webhooks) before it crashes a Stripe API call downstream.
async function isCustomerValid(stripe, customerId) {
  if (!customerId) return false;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return !customer.deleted;
  } catch (e) {
    return false;
  }
}

module.exports = { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PRO_PRICE_IDS, APP_ORIGIN, getStripe, isCustomerValid };
