const admin = require('firebase-admin');
admin.initializeApp();

const { createCheckoutSession } = require('./src/checkout.js');
const { createPortalSession } = require('./src/portal.js');
const { stripeWebhook } = require('./src/webhook.js');

module.exports = { createCheckoutSession, createPortalSession, stripeWebhook };
