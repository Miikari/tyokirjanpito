const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, getStripe } = require('./stripe.js');
const { tierForPrice, isAtLeast } = require('./tiers.js');

// One month of the base Pro price, in cents — the reward regardless of
// which tier/interval the referred org itself ends up on.
const REFERRAL_REWARD_CENTS = 1490;

// Pays out a referral reward once — the referring org's own referralCode is
// looked up fresh (not trusted from any client-supplied value) and credited
// via Stripe customer balance, which Stripe automatically applies to that
// customer's next invoice. If the referrer has no Stripe customer yet (never
// checked out), the credit is queued on their org doc and applied by
// checkout.js the moment one is created for them.
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
      await stripe.customers.createBalanceTransaction(referrer.stripeCustomerId, {
        amount: -REFERRAL_REWARD_CENTS,
        currency: 'eur',
        description: 'Suositteluetu — 1 kk ilmaiseksi',
      });
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
async function resolveOrgRef(obj) {
  if (obj.metadata?.orgId) {
    return getFirestore().collection('orgs').doc(obj.metadata.orgId);
  }
  if (obj.customer) {
    const snap = await getFirestore().collection('orgs').where('stripeCustomerId', '==', obj.customer).limit(1).get();
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

  try {
    const obj = event.data.object;

    switch (event.type) {
      case 'checkout.session.completed': {
        const orgRef = await resolveOrgRef(obj);
        if (orgRef) {
          // The Checkout Session itself doesn't carry the subscription's
          // line items, so the actual Price (and therefore tier) has to be
          // looked up via the subscription it created rather than assumed.
          const subscription = await stripe.subscriptions.retrieve(obj.subscription);
          const plan = planFor(subscription);
          await orgRef.update({
            stripeSubscriptionId: obj.subscription,
            plan,
            subscriptionStatus: subscription.status,
          });
          if (isAtLeast(plan, 'pro')) {
            await grantReferralRewardIfDue(getFirestore(), stripe, orgRef);
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
        const orgRef = await resolveOrgRef(obj);
        if (orgRef) {
          await orgRef.update({
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
        const orgRef = await resolveOrgRef(obj);
        if (orgRef) {
          await orgRef.update({ plan: 'free', subscriptionStatus: 'canceled' });
        } else {
          logger.error('customer.subscription.deleted: could not resolve org', { subscriptionId: obj.id });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const orgRef = await resolveOrgRef(obj);
        if (orgRef) {
          await orgRef.update({ subscriptionStatus: 'past_due', plan: 'free' });
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
