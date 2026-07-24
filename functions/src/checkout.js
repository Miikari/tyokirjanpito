const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { STRIPE_SECRET_KEY, PRO_PRICE_ID, APP_ORIGIN, getStripe } = require('./stripe.js');
const { requireOrgMember } = require('./org.js');

const createCheckoutSession = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const { orgRef, org } = await requireOrgMember(request);

  if (org.plan === 'pro' && (org.subscriptionStatus === 'active' || org.subscriptionStatus === 'trialing')) {
    throw new HttpsError('failed-precondition', 'This organization already has an active Pro subscription.');
  }

  const stripe = getStripe();

  let stripeCustomerId = org.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: request.auth.token.email || undefined,
      metadata: { orgId: orgRef.id, firebaseUid: request.auth.uid },
    });
    stripeCustomerId = customer.id;
    await orgRef.update({ stripeCustomerId });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
    // The Customer is pre-created via the API with no address, so Checkout
    // must be forced to collect one and save it back to the Customer —
    // otherwise Stripe Tax has no address to calculate tax from and errors
    // out (customer_tax_location_invalid).
    billing_address_collection: 'required',
    customer_update: { address: 'auto', name: 'auto' },
    tax_id_collection: { enabled: true },
    client_reference_id: orgRef.id,
    metadata: { orgId: orgRef.id },
    subscription_data: { metadata: { orgId: orgRef.id } },
    success_url: `${APP_ORIGIN}/?checkout=success`,
    cancel_url: `${APP_ORIGIN}/?checkout=cancel`,
  });

  return { url: session.url };
});

module.exports = { createCheckoutSession };
