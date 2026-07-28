const { defineSecret } = require('firebase-functions/params');
const Stripe = require('stripe');

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// Not secret: differs between test/live, but the value itself isn't sensitive.
// Live-mode "Hoyla Pro" monthly price. A yearly price also exists in Stripe
// (price_1TyHrxV05EjopucBYrO5Le6Z) but isn't wired up — only one price is
// supported until an interval picker ships.
const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || 'price_1TyHsGV05EjopucBzSlluF21';
const APP_ORIGIN = process.env.APP_ORIGIN || 'https://hoyla.dev';

function getStripe() {
  return new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: '2026-06-24.dahlia' });
}

module.exports = { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PRO_PRICE_ID, APP_ORIGIN, getStripe };
