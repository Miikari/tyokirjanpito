const { onCall } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { requireOrgMember } = require('./org.js');
const { checkRateLimit } = require('./rateLimit.js');

function genCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

// Generates and stores this org's own shareable referral code, retrying on
// the astronomically unlikely case of a collision. Done server-side (rather
// than letting the client pick its own string) so referralCode can be
// locked to Cloud-Functions-only writes in firestore.rules — a client free
// to set its own referralCode to any string could copy an existing org's
// code and hijack referral credit meant for that code's real owner.
const ensureReferralCode = onCall(async (request) => {
  const { orgRef, org } = await requireOrgMember(request);
  if (org.referralCode) return { referralCode: org.referralCode };
  await checkRateLimit(request.auth.uid, 'ensureReferralCode', { maxCalls: 5, windowMs: 60 * 1000 });

  const db = getFirestore();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    const existing = await db.collection('orgs').where('referralCode', '==', code).limit(1).get();
    if (existing.empty) {
      await orgRef.update({ referralCode: code });
      return { referralCode: code };
    }
  }
  throw new Error('Could not generate a unique referral code — please try again.');
});

module.exports = { ensureReferralCode };
