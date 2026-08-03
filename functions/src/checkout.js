const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { FieldValue } = require('firebase-admin/firestore');
const { STRIPE_SECRET_KEY, PRO_PRICE_IDS, APP_ORIGIN, getStripe, isCustomerValid } = require('./stripe.js');
const { requireOrgMember, clearStaleBilling } = require('./org.js');
const { isAtLeast } = require('./tiers.js');

const createCheckoutSession = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const { orgRef, org } = await requireOrgMember(request);
  const stripe = getStripe();

  // Resolve whether the stored Stripe customer is still real BEFORE the
  // "already subscribed" guard below — otherwise an org whose customer was
  // deleted out from under it (e.g. test-mode data cleared in the Stripe
  // dashboard, which fires no webhooks) stays stuck: Firestore still says
  // plan:'pro', so re-purchasing is blocked, yet there's no working billing
  // account behind it. Self-heal instead of trusting stale Firestore state.
  const customerValid = await isCustomerValid(stripe, org.stripeCustomerId);
  if (org.stripeCustomerId && !customerValid) {
    await clearStaleBilling(orgRef);
  } else if (isAtLeast(org.plan, 'pro') && (org.subscriptionStatus === 'active' || org.subscriptionStatus === 'trialing')) {
    // Any paid tier already active — including a future higher tier — means
    // checkout isn't the right path anymore; tier changes go through the
    // Customer Portal instead, which handles proration correctly.
    throw new HttpsError('failed-precondition', 'This organization already has an active subscription. Manage it from the billing portal instead.');
  }

  let stripeCustomerId = customerValid ? org.stripeCustomerId : null;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: request.auth.token.email || undefined,
      metadata: { orgId: orgRef.id, firebaseUid: request.auth.uid },
    });
    stripeCustomerId = customer.id;
    const updates = { stripeCustomerId };

    // A referral reward earned before this org ever had a Stripe customer
    // (webhook.js queues it as pendingReferralCreditCents in that case) gets
    // applied now that there's finally a customer to hold the credit.
    if (org.pendingReferralCreditCents) {
      try {
        await stripe.customers.createBalanceTransaction(stripeCustomerId, {
          amount: -org.pendingReferralCreditCents,
          currency: 'eur',
          description: 'Suositteluetu — 1 kk ilmaiseksi',
        });
        updates.pendingReferralCreditCents = FieldValue.delete();
      } catch (e) {
        // Leave the pending amount in place rather than lose it — nothing
        // else currently retries this, so it'd need a manual follow-up.
        logger.error('createCheckoutSession: failed to apply pending referral credit', { orgId: orgRef.id, message: e.message });
      }
    }

    await orgRef.update(updates);
  }

  // Only ever accept an interval keyword from the client, never a price id
  // directly — the actual Price still comes from our own fixed map, so a
  // malicious caller can't substitute someone else's (or a $0) price.
  const interval = request.data?.interval === 'year' ? 'year' : 'month';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: PRO_PRICE_IDS[interval], quantity: 1 }],
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
