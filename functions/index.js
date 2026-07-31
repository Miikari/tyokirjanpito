const admin = require('firebase-admin');
admin.initializeApp();

const { createCheckoutSession } = require('./src/checkout.js');
const { createPortalSession } = require('./src/portal.js');
const { stripeWebhook } = require('./src/webhook.js');
const { cleanupAnonymousUsers } = require('./src/cleanupAnonymous.js');

module.exports = { createCheckoutSession, createPortalSession, stripeWebhook, cleanupAnonymousUsers };
