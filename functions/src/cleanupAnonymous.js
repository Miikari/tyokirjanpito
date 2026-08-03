const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { isAtLeast } = require('./tiers.js');

// Deleted this many days after account CREATION, not after last activity —
// an anonymous account is a throwaway guest trial, not a free permanent way
// to run the app, so staying active doesn't extend its life.
const MAX_AGE_DAYS = 30;
// Bounds each run's Firestore reads/deletes so a large backlog can't blow the
// function timeout — a big backlog just gets worked off over several days.
const MAX_PER_RUN = 300;

// Anonymous guest accounts (demo mode) never link a real sign-in method, so
// providerData stays empty for their whole lifetime — that's the only signal
// we trust to decide "safe to delete", never anything based on email/name.
function isStaleAnonymousUser(userRecord) {
  if (userRecord.providerData.length > 0) return false;
  const ageMs = Date.now() - new Date(userRecord.metadata.creationTime).getTime();
  return ageMs > MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

// Deletes the org (and all its subcollections) only if this stale anonymous
// user solely owns it and it has never touched billing — an anonymous user
// who joined someone else's org via an invite link just gets removed as a
// member, leaving that org and its data untouched.
async function cleanupOrgForUser(db, uid) {
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  const orgId = userDoc.exists ? userDoc.data().orgId : null;

  if (orgId) {
    const orgRef = db.collection('orgs').doc(orgId);
    const orgSnap = await orgRef.get();
    if (orgSnap.exists) {
      const org = orgSnap.data();
      const memberIds = Object.keys(org.members || {});
      const hasBilling = isAtLeast(org.plan, 'pro') || !!org.stripeCustomerId;
      if (!hasBilling && org.ownerId === uid && memberIds.length <= 1) {
        await db.recursiveDelete(orgRef);
      } else if (org.members && org.members[uid]) {
        await orgRef.update({ [`members.${uid}`]: FieldValue.delete() });
      }
    }
  }

  await userRef.delete().catch(() => {});
}

const cleanupAnonymousUsers = onSchedule(
  { schedule: 'every 24 hours', timeoutSeconds: 540, memory: '256MiB' },
  async () => {
    const auth = getAuth();
    const db = getFirestore();
    const staleUids = [];
    let pageToken;

    do {
      const page = await auth.listUsers(1000, pageToken);
      pageToken = page.pageToken;
      for (const user of page.users) {
        if (staleUids.length >= MAX_PER_RUN) break;
        if (isStaleAnonymousUser(user)) staleUids.push(user.uid);
      }
    } while (pageToken && staleUids.length < MAX_PER_RUN);

    let cleaned = 0;
    for (const uid of staleUids) {
      try {
        await cleanupOrgForUser(db, uid);
        cleaned++;
      } catch (e) {
        logger.error(`cleanupAnonymousUsers: failed to clean up Firestore data for ${uid}`, e);
      }
    }

    // Bulk Auth deletion happens last, after each user's Firestore data is
    // already gone — deleteUsers() takes up to 1000 uids per call.
    if (staleUids.length) {
      const result = await auth.deleteUsers(staleUids);
      if (result.errors.length) {
        logger.error(`cleanupAnonymousUsers: ${result.errors.length} auth deletions failed`, result.errors);
      }
      logger.info(`cleanupAnonymousUsers: removed ${result.successCount} anonymous accounts (${cleaned} had org data cleaned up first)`);
    } else {
      logger.info('cleanupAnonymousUsers: nothing to clean up');
    }
  }
);

module.exports = { cleanupAnonymousUsers };
