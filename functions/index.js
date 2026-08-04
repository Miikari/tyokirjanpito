const admin = require('firebase-admin');
admin.initializeApp();

const { createCheckoutSession } = require('./src/checkout.js');
const { createPortalSession } = require('./src/portal.js');
const { stripeWebhook } = require('./src/webhook.js');
const { cleanupAnonymousUsers } = require('./src/cleanupAnonymous.js');
const { requestAccountDeletion, cancelAccountDeletion, runScheduledDeletions } = require('./src/accountDeletion.js');
const { ensureReferralCode } = require('./src/referrals.js');
const { lookupOrgByInviteCode, joinOrgByInviteCode } = require('./src/orgJoin.js');

module.exports = {
  createCheckoutSession, createPortalSession, stripeWebhook, cleanupAnonymousUsers,
  requestAccountDeletion, cancelAccountDeletion, runScheduledDeletions,
  ensureReferralCode, lookupOrgByInviteCode, joinOrgByInviteCode,
};
