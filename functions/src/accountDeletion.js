const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { STRIPE_SECRET_KEY, getStripe } = require('./stripe.js');
const { requireOrgOwner } = require('./org.js');
const { checkRateLimit } = require('./rateLimit.js');

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

// Owner-only: schedules the whole org (and every member's Firebase Auth
// account) for permanent deletion after a 7-day grace period, so a change
// of mind is still possible before anything is actually gone.
const requestAccountDeletion = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const { orgRef, org } = await requireOrgOwner(request);
  await checkRateLimit(request.auth.uid, 'requestAccountDeletion', { maxCalls: 3, windowMs: 60 * 1000 });

  // Idempotent — a second click (or a slow double-tap) just returns the
  // already-scheduled time instead of pushing the deadline further out.
  if (org.scheduledDeletionAt) {
    return { scheduledDeletionAt: org.scheduledDeletionAt.toMillis() };
  }

  // Stop billing immediately — the grace period is for the user to change
  // their mind about deleting data, not a free extra week of a subscription
  // they already asked to cancel.
  if (org.stripeCustomerId) {
    try {
      const stripe = getStripe();
      const subs = await stripe.subscriptions.list({ customer: org.stripeCustomerId, limit: 100 });
      await Promise.all(
        subs.data
          .filter(s => ['active', 'trialing', 'past_due'].includes(s.status))
          .map(s => stripe.subscriptions.cancel(s.id))
      );
    } catch (e) {
      // Non-fatal: the org still gets scheduled for deletion (and the
      // subscription along with the Stripe customer is force-removed when
      // that runs), so a failure here just means a few extra days of
      // billing rather than a stuck deletion request.
      logger.error('requestAccountDeletion: failed to cancel Stripe subscription', { orgId: orgRef.id, message: e.message });
    }
  }

  const scheduledDeletionAt = Timestamp.fromMillis(Date.now() + GRACE_PERIOD_MS);
  await orgRef.update({
    scheduledDeletionAt,
    plan: 'free',
    subscriptionStatus: FieldValue.delete(),
    deletionRequestedBy: request.auth.uid,
  });

  return { scheduledDeletionAt: scheduledDeletionAt.toMillis() };
});

const cancelAccountDeletion = onCall(async (request) => {
  const { orgRef, org } = await requireOrgOwner(request);
  await checkRateLimit(request.auth.uid, 'cancelAccountDeletion', { maxCalls: 5, windowMs: 60 * 1000 });
  if (!org.scheduledDeletionAt) {
    throw new HttpsError('failed-precondition', 'No deletion is currently scheduled.');
  }
  await orgRef.update({
    scheduledDeletionAt: FieldValue.delete(),
    deletionRequestedBy: FieldValue.delete(),
  });
  return { ok: true };
});

// Runs daily; permanently removes every org whose grace period has fully
// elapsed, along with its Stripe customer and every member's Firebase Auth
// account. Mirrors cleanupAnonymousUsers.js's recursiveDelete + deleteUsers
// pattern, but scoped to orgs the owner explicitly asked to delete.
const runScheduledDeletions = onSchedule(
  { schedule: 'every 24 hours', timeoutSeconds: 540, memory: '256MiB', secrets: [STRIPE_SECRET_KEY] },
  async () => {
    const db = getFirestore();
    const auth = getAuth();
    const stripe = getStripe();
    const snap = await db.collection('orgs').where('scheduledDeletionAt', '<=', Timestamp.now()).get();

    if (snap.empty) {
      logger.info('runScheduledDeletions: nothing due for deletion');
      return;
    }

    for (const doc of snap.docs) {
      const org = doc.data();
      const memberUids = Object.keys(org.members || {});
      try {
        if (org.stripeCustomerId) {
          await stripe.customers.del(org.stripeCustomerId).catch(() => {});
        }
        await db.recursiveDelete(doc.ref);
        await Promise.all(memberUids.map(uid => db.collection('users').doc(uid).delete().catch(() => {})));
        if (memberUids.length) {
          const result = await auth.deleteUsers(memberUids);
          if (result.errors.length) {
            logger.error(`runScheduledDeletions: ${result.errors.length} auth deletions failed for org ${doc.id}`, result.errors);
          }
        }
        logger.info(`runScheduledDeletions: deleted org ${doc.id} and ${memberUids.length} member account(s)`);
      } catch (e) {
        logger.error(`runScheduledDeletions: failed to delete org ${doc.id}`, { message: e.message });
      }
    }
  }
);

module.exports = { requestAccountDeletion, cancelAccountDeletion, runScheduledDeletions };
