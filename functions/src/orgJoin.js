const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { checkRateLimit } = require('./rateLimit.js');
const { genCode } = require('./codeGen.js');
const { requireOrgOwner } = require('./org.js');

function requireNonAnonymous(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in required.');
  if (request.auth.token.firebase.sign_in_provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'Guests cannot join an organization.');
  }
}

function normalizeCode(request) {
  const code = String(request.data?.inviteCode || '').trim().toUpperCase();
  if (!code) throw new HttpsError('invalid-argument', 'inviteCode is required.');
  return code;
}

async function findOrgByInviteCode(db, inviteCode) {
  const snap = await db.collection('orgs').where('inviteCode', '==', inviteCode).limit(1).get();
  if (snap.empty) throw new HttpsError('not-found', 'Kutsukoodi ei kelpaa.');
  return snap.docs[0];
}

// Read-only: resolves an invite code to the org's name, so the UI can show
// a "Liitytäänkö organisaatioon X?" confirmation before actually joining.
// This has to run server-side (Admin SDK) rather than as a direct client
// query — firestore.rules can't let clients query the orgs collection by
// inviteCode without also making it `list`-able in general, which would
// expose every org's members/inviteCode/billing fields to any authenticated
// user, not just the one org being looked up.
const lookupOrgByInviteCode = onCall(async (request) => {
  requireNonAnonymous(request);
  await checkRateLimit(request.auth.uid, 'lookupOrgByInviteCode', { maxCalls: 20, windowMs: 5 * 60 * 1000 });
  const inviteCode = normalizeCode(request);
  const doc = await findOrgByInviteCode(getFirestore(), inviteCode);
  return { orgId: doc.id, name: doc.data().name };
});

// Actually joins the caller to the org. This is now the ONLY way membership
// can be granted by invite code — firestore.rules used to also allow a
// client to self-add to an org's members map directly, but that rule only
// checked the org HAD an inviteCode set, never that the caller actually
// supplied the correct one, so anyone who learned/guessed an orgId could
// join it with no code at all (2026-08-04 security review).
const joinOrgByInviteCode = onCall(async (request) => {
  requireNonAnonymous(request);
  await checkRateLimit(request.auth.uid, 'joinOrgByInviteCode', { maxCalls: 10, windowMs: 5 * 60 * 1000 });
  const inviteCode = normalizeCode(request);
  const db = getFirestore();
  const doc = await findOrgByInviteCode(db, inviteCode);
  const org = doc.data();

  const displayName = request.auth.token.name || request.auth.token.email || 'Vieras';
  const email = request.auth.token.email || '';

  // Every user belongs to exactly one org today (users/{uid}.orgId is the
  // single "current org" pointer, not a membership list — orgs/{orgId}.
  // members is the actual source of truth per org). Joining a second org
  // without leaving the first would desync those two: the org doc would
  // gain a member that users/{uid}.orgId no longer points at, and — if the
  // caller owns their current org — could orphan it entirely. There's no
  // "leave org" flow yet, so for now this is simply blocked rather than
  // silently switching (2026-08-04 security review).
  const userDoc = await db.collection('users').doc(request.auth.uid).get();
  const currentOrgId = userDoc.exists ? userDoc.data().orgId : null;
  if (currentOrgId && currentOrgId !== doc.id) {
    throw new HttpsError('failed-precondition', 'Olet jo toisen organisaation jäsen.');
  }

  if (!(org.members && org.members[request.auth.uid])) {
    // Batched so the membership write and the users/{uid}.orgId write can
    // never partially succeed — a failure after only the first would leave
    // the org and the user doc disagreeing about membership (2026-08-04
    // security review, data-integrity finding).
    const batch = db.batch();
    batch.update(doc.ref, { [`members.${request.auth.uid}`]: { role: 'member', email, displayName } });
    batch.set(db.collection('users').doc(request.auth.uid), { orgId: doc.id, email, displayName }, { merge: true });
    await batch.commit();
  }

  return { orgId: doc.id, name: org.name };
});

// Owner-only: mints a fresh invite code, retrying on collision against every
// other org's code (the same astronomically-unlikely-but-still-checked
// pattern as ensureReferralCode in referrals.js). Direct client writes to
// inviteCode are blocked in firestore.rules, so this is the only way it can
// change after an org's creation.
const regenerateInviteCode = onCall(async (request) => {
  const { orgRef } = await requireOrgOwner(request);
  await checkRateLimit(request.auth.uid, 'regenerateInviteCode', { maxCalls: 10, windowMs: 5 * 60 * 1000 });

  const db = getFirestore();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    const existing = await db.collection('orgs').where('inviteCode', '==', code).limit(1).get();
    if (existing.empty) {
      await orgRef.update({ inviteCode: code });
      return { inviteCode: code };
    }
  }
  throw new HttpsError('internal', 'Could not generate a unique invite code — please try again.');
});

module.exports = { lookupOrgByInviteCode, joinOrgByInviteCode, regenerateInviteCode };
