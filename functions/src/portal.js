const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { STRIPE_SECRET_KEY, APP_ORIGIN, getStripe } = require('./stripe.js');
const { requireOrgMember } = require('./org.js');

const createPortalSession = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const { org } = await requireOrgMember(request);

  if (!org.stripeCustomerId) {
    throw new HttpsError('failed-precondition', 'No billing account yet for this organization.');
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${APP_ORIGIN}/?tab=asetukset`,
  });

  return { url: session.url };
});

module.exports = { createPortalSession };
