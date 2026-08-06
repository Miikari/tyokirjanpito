const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { STRIPE_SECRET_KEY, PRO_PRICE_IDS, APP_ORIGIN, getStripe, isCustomerValid } = require('./stripe.js');
const { requireOrgMember, clearStaleBilling } = require('./org.js');
const { isAtLeast } = require('./tiers.js');
const { checkRateLimit } = require('./rateLimit.js');

// Two near-simultaneous calls for the same org (a double-click, or two open
// tabs) could otherwise both pass the "already subscribed" guard below
// before either one's Stripe customer/subscription exists yet in Firestore,
// each create their own checkout session, and — if the user completes both
// — end up double-subscribed and double-charged. This lock serializes
// createCheckoutSession per org so only one can be in flight at a time; the
// TTL exists so a crashed/interrupted attempt can't wedge future ones
// forever (2026-08-04 review).
const CHECKOUT_LOCK_TTL_MS = 2 * 60 * 1000;

async function acquireCheckoutLock(db, orgRef) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(orgRef);
    const data = snap.data();
    const lockAt = data.checkoutLockAt;
    if (lockAt && Date.now() - lockAt < CHECKOUT_LOCK_TTL_MS) {
      throw new HttpsError('already-exists', 'A checkout is already in progress for this organization — please wait a moment and try again.');
    }
    tx.update(orgRef, { checkoutLockAt: Date.now() });
    return data;
  });
}

const createCheckoutSession = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const { orgRef } = await requireOrgMember(request);
  await checkRateLimit(request.auth.uid, 'createCheckoutSession', { maxCalls: 5, windowMs: 5 * 60 * 1000 });
  const stripe = getStripe();
  const db = getFirestore();

  // Re-reads org fresh as part of acquiring the lock, rather than trusting
  // requireOrgMember's earlier read — that's the whole point of the lock,
  // so it needs data from the instant it was actually acquired.
  const org = await acquireCheckoutLock(db, orgRef);

  try {
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
      // Idempotency key stable per org (not per-request) — belt-and-braces
      // alongside the lock above: even if the lock were ever bypassed
      // (e.g. a retried request after a timeout), Stripe itself guarantees
      // this never creates a second Customer for the same org.
      const customer = await stripe.customers.create({
        email: request.auth.token.email || undefined,
        metadata: { orgId: orgRef.id, firebaseUid: request.auth.uid },
      }, { idempotencyKey: `org-customer-${orgRef.id}` });
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
      // Back into the app itself, not the marketing root — APP_ORIGIN alone
      // pointed here at the landing page with no code anywhere reading the
      // checkout= param, so a paying customer just landed back on the
      // marketing page with no confirmation at all (2026-08-04 review).
      // interval rides along so the client can report the right value for
      // the ad-conversion Purchase event without re-deriving/trusting a
      // client-supplied price — it's just the same keyword already chosen.
      success_url: `${APP_ORIGIN}/app/?checkout=success&interval=${interval}`,
      cancel_url: `${APP_ORIGIN}/app/?checkout=cancel`,
    });

    return { url: session.url };
  } finally {
    await orgRef.update({ checkoutLockAt: FieldValue.delete() }).catch(() => {});
  }
});

module.exports = { createCheckoutSession };
