const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, getStripe } = require('./stripe.js');
const { tierForPrice, isAtLeast } = require('./tiers.js');

// One month of the base Pro price, in cents — the reward regardless of
// which tier/interval the referred org itself ends up on.
const REFERRAL_REWARD_CENTS = 1490;

// Stripe explicitly documents that the same event can be delivered more
// than once (retries on timeout/non-2xx, or just duplicate delivery) — a
// webhook handler has to be idempotent on its own, since nothing upstream
// guarantees "exactly once". Claims event.id in a transaction before doing
// any work; a second delivery of the same event (even one arriving
// genuinely concurrently, not just a later retry) sees the doc already
// exists and is skipped entirely (2026-08-04 review).
async function claimEvent(db, event) {
  const ref = db.collection('webhookEvents').doc(event.id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return false;
    tx.set(ref, { type: event.type, receivedAt: FieldValue.serverTimestamp() });
    return true;
  });
}

// Stripe doesn't guarantee webhook delivery order — a later event can be
// delivered before an earlier one, or a retried old event can arrive after
// a newer one already landed. A plain last-write-wins update would let a
// stale event overwrite newer subscription state. Every handler that writes
// plan/subscriptionStatus goes through this instead, gated on the Stripe
// event's own `created` timestamp (not receipt time) — an event no newer
// than the last one actually applied for this org is ignored rather than
// applied (2026-08-04 review).
async function applyIfNewer(db, orgRef, event, updates) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(orgRef);
    const lastEventAt = snap.data()?.lastSubscriptionEventAt || 0;
    if (event.created <= lastEventAt) {
      logger.info('webhook: ignoring stale/out-of-order event', { eventId: event.id, type: event.type, orgId: orgRef.id });
      return false;
    }
    tx.update(orgRef, { ...updates, lastSubscriptionEventAt: event.created });
    return true;
  });
}

// Pays out a referral reward once — the referring org's own referralCode is
// looked up fresh (not trusted from any client-supplied value) and credited
// via Stripe customer balance, which Stripe automatically applies to that
// customer's next invoice. If the referrer has no Stripe customer yet (never
// checked out), the credit is queued on their org doc and applied by
// checkout.js the moment one is created for them. Only ever called once per
// Stripe event (claimEvent above already prevents re-entry for the same
// event.id), and referralRewardGranted itself prevents re-granting on a
// later, different event for an org that resubscribes after cancelling.
async function grantReferralRewardIfDue(db, stripe, orgRef) {
  const snap = await orgRef.get();
  const org = snap.data();
  if (!org || !org.referredBy || org.referralRewardGranted) return;

  const referrerSnap = await db.collection('orgs').where('referralCode', '==', org.referredBy).limit(1).get();
  if (referrerSnap.empty || referrerSnap.docs[0].id === orgRef.id) {
    // Dead code, or somehow self-referential — mark handled so this org
    // doesn't get re-checked on every future webhook event either way.
    await orgRef.update({ referralRewardGranted: true });
    return;
  }

  const referrerRef = referrerSnap.docs[0].ref;
  const referrer = referrerSnap.docs[0].data();
  if (referrer.stripeCustomerId) {
    try {
      // Idempotency key stable per (referrer, referred org) pair — defense
      // in depth alongside claimEvent: even if this function were somehow
      // re-entered for the same referral, Stripe itself guarantees the
      // balance is only ever credited once for this key.
      await stripe.customers.createBalanceTransaction(referrer.stripeCustomerId, {
        amount: -REFERRAL_REWARD_CENTS,
        currency: 'eur',
        description: 'Suositteluetu — 1 kk ilmaiseksi',
      }, { idempotencyKey: `referral-${referrerRef.id}-${orgRef.id}` });
    } catch (e) {
      logger.error('referral: failed to credit balance, queuing instead', { orgId: referrerRef.id, message: e.message });
      await referrerRef.update({ pendingReferralCreditCents: FieldValue.increment(REFERRAL_REWARD_CENTS) });
    }
  } else {
    await referrerRef.update({ pendingReferralCreditCents: FieldValue.increment(REFERRAL_REWARD_CENTS) });
  }
  await orgRef.update({ referralRewardGranted: true });
}

// Not every event carries metadata.orgId directly (e.g. some invoice events),
// so fall back to looking the org up by its stored Stripe customer id.
async function resolveOrgRef(db, obj) {
  if (obj.metadata?.orgId) {
    const orgRef = db.collection('orgs').doc(obj.metadata.orgId);
    if (obj.customer) {
      // Defense in depth: metadata.orgId is data Hoyla wrote itself when
      // creating the Stripe object, not attacker-controlled, but cross-
      // checking against the org's own recorded stripeCustomerId catches a
      // stale/corrupted metadata value before it silently attaches this
      // event's billing state to the wrong org. Only rejects on an actual
      // mismatch — a not-yet-set stripeCustomerId (e.g. very first webhook
      // for a brand-new org) is left unchecked rather than treated as one.
      const snap = await orgRef.get();
      const org = snap.data();
      if (org && org.stripeCustomerId && org.stripeCustomerId !== obj.customer) {
        logger.error('resolveOrgRef: metadata.orgId/customer mismatch, refusing to apply', {
          orgId: obj.metadata.orgId, metadataCustomer: obj.customer, orgStripeCustomerId: org.stripeCustomerId,
        });
        return null;
      }
    }
    return orgRef;
  }
  if (obj.customer) {
    const snap = await db.collection('orgs').where('stripeCustomerId', '==', obj.customer).limit(1).get();
    if (!snap.empty) return snap.docs[0].ref;
  }
  return null;
}

// Not active/trialing => free, regardless of tier. Otherwise the plan is
// whichever tier the subscription's actual Price maps to (see tiers.js) —
// never assume a successful subscription always means 'pro', since which
// Price the customer picked determines the tier once more than one exists.
function planFor(subscription) {
  if (subscription.status !== 'active' && subscription.status !== 'trialing') return 'free';
  const priceId = subscription.items?.data?.[0]?.price?.id;
  return tierForPrice(priceId) || 'pro';
}

const stripeWebhook = onRequest({ secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
  const stripe = getStripe();
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, STRIPE_WEBHOOK_SECRET.value());
  } catch (err) {
    logger.warn('Webhook signature verification failed', { message: err.message });
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  const db = getFirestore();

  try {
    const claimed = await claimEvent(db, event);
    if (!claimed) {
      logger.info('stripeWebhook: duplicate event, skipping', { eventId: event.id, type: event.type });
      res.status(200).send();
      return;
    }

    const obj = event.data.object;

    switch (event.type) {
      case 'checkout.session.completed': {
        const orgRef = await resolveOrgRef(db, obj);
        if (orgRef) {
          // The Checkout Session itself doesn't carry the subscription's
          // line items, so the actual Price (and therefore tier) has to be
          // looked up via the subscription it created rather than assumed.
          const subscription = await stripe.subscriptions.retrieve(obj.subscription);
          const plan = planFor(subscription);
          const applied = await applyIfNewer(db, orgRef, event, {
            stripeSubscriptionId: obj.subscription,
            plan,
            subscriptionStatus: subscription.status,
          });
          if (applied && isAtLeast(plan, 'pro')) {
            await grantReferralRewardIfDue(db, stripe, orgRef);
          }
        } else {
          logger.error('checkout.session.completed: could not resolve org', { sessionId: obj.id });
        }
        break;
      }

      // .created and .updated carry the same shape and both need to sync
      // status/currentPeriodEnd — Stripe doesn't reliably fire .updated
      // right after Checkout creates a fresh subscription, only .created,
      // so relying on .updated alone left currentPeriodEnd blank until the
      // first renewal.
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const orgRef = await resolveOrgRef(db, obj);
        if (orgRef) {
          await applyIfNewer(db, orgRef, event, {
            subscriptionStatus: obj.status,
            plan: planFor(obj),
            currentPeriodEnd: obj.current_period_end
              ? Timestamp.fromMillis(obj.current_period_end * 1000)
              : null,
          });
        } else {
          logger.error(`${event.type}: could not resolve org`, { subscriptionId: obj.id });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const orgRef = await resolveOrgRef(db, obj);
        if (orgRef) {
          await applyIfNewer(db, orgRef, event, { plan: 'free', subscriptionStatus: 'canceled' });
        } else {
          logger.error('customer.subscription.deleted: could not resolve org', { subscriptionId: obj.id });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const orgRef = await resolveOrgRef(db, obj);
        if (orgRef) {
          await applyIfNewer(db, orgRef, event, { subscriptionStatus: 'past_due', plan: 'free' });
        } else {
          logger.error('invoice.payment_failed: could not resolve org', { invoiceId: obj.id });
        }
        break;
      }

      default:
        // Unhandled event type — Stripe still expects a 2xx or it retries.
        break;
    }

    res.status(200).send();
  } catch (err) {
    // Signature already verified above; a failure here is our own bug, not a
    // forged event, so log it and let Stripe retry rather than swallowing it.
    logger.error('Error processing webhook event', { type: event.type, message: err.message });
    res.status(500).send();
  }
});

module.exports = { stripeWebhook };
