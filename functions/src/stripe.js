const { defineSecret } = require('firebase-functions/params');
const Stripe = require('stripe');

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// Not secret: differs between test/live, but the value itself isn't sensitive.
// Currently the Stripe *test-mode* "Hoyla Pro" price — swap for the live price id on cutover.
const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || 'price_1TvcmvV05Wrhhr1GC0Tk37C5';
const APP_ORIGIN = process.env.APP_ORIGIN || 'https://hoyla.dev';

function getStripe() {
  return new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: '2026-06-24.dahlia' });
}

module.exports = { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PRO_PRICE_ID, APP_ORIGIN, getStripe };
