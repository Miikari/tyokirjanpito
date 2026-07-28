const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, getStripe } = require('./stripe.js');

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

// Not active/trialing => not Pro. Kept to a single boolean everywhere so the
// gate logic (frontend isPro()) never has to special-case individual statuses.
function planFor(status) {
  return status === 'active' || status === 'trialing' ? 'pro' : 'free';
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
          await orgRef.update({
            stripeSubscriptionId: obj.subscription,
            plan: 'pro',
            subscriptionStatus: 'active',
          });
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
            plan: planFor(obj.status),
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
