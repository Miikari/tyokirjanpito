const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { STRIPE_SECRET_KEY, APP_ORIGIN, getStripe, isCustomerValid } = require('./stripe.js');
const { requireOrgOwner, clearStaleBilling } = require('./org.js');
const { checkRateLimit } = require('./rateLimit.js');

const createPortalSession = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const { orgRef, org } = await requireOrgOwner(request);
  await checkRateLimit(request.auth.uid, 'createPortalSession', { maxCalls: 10, windowMs: 5 * 60 * 1000 });

  if (!org.stripeCustomerId) {
    throw new HttpsError('failed-precondition', 'No billing account yet for this organization.');
  }

  const stripe = getStripe();
  if (!(await isCustomerValid(stripe, org.stripeCustomerId))) {
    // Same stale-customer situation checkout.js self-heals — reset here too
    // so the frontend's "Manage subscription" button reverts to "Upgrade"
    // instead of staying stuck pointed at a dead billing account.
    await clearStaleBilling(orgRef);
    throw new HttpsError('failed-precondition', 'Billing account not found. Please start checkout again.');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${APP_ORIGIN}/?tab=asetukset`,
  });

  return { url: session.url };
});

module.exports = { createPortalSession };
