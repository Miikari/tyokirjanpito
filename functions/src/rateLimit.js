const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Fixed-window rate limit keyed per uid+action, backed by a single Firestore
// doc — an in-memory counter wouldn't work here since Cloud Functions scales
// out to many concurrent instances with no shared memory. Only ever called
// after the caller's uid is already known (post auth/org-membership check),
// and the rateLimits collection has no client-facing firestore.rules match,
// so it's reachable only via the Admin SDK these functions use.
async function checkRateLimit(uid, action, { maxCalls, windowMs }) {
  const db = getFirestore();
  const ref = db.collection('rateLimits').doc(`${uid}_${action}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists ? snap.data() : null;

    if (!data || now - data.windowStart > windowMs) {
      tx.set(ref, { windowStart: now, count: 1 });
      return;
    }
    if (data.count >= maxCalls) {
      throw new HttpsError('resource-exhausted', 'Liikaa yrityksiä lyhyessä ajassa — yritä hetken kuluttua uudelleen.');
    }
    tx.update(ref, { count: FieldValue.increment(1) });
  });
}

module.exports = { checkRateLimit };
