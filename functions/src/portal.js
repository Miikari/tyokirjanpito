const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { STRIPE_SECRET_KEY, APP_ORIGIN, getStripe } = require('./stripe.js');
const { requireOrgOwner } = require('./org.js');

const createPortalSession = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const { org } = await requireOrgOwner(request);

  if (!org.stripeCustomerId) {
    throw new HttpsError('failed-precondition', 'No billing account yet for this organization.');
  }

  const stripe = getStripe();
  try {
    const customer = await stripe.customers.retrieve(org.stripeCustomerId);
    if (customer.deleted) {
      throw new HttpsError('failed-precondition', 'Billing account not found. Please start checkout again.');
    }
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    throw new HttpsError('failed-precondition', 'Billing account not found. Please start checkout again.');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${APP_ORIGIN}/?tab=asetukset`,
  });

  return { url: session.url };
});

module.exports = { createPortalSession };
