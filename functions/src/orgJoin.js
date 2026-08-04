const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { checkRateLimit } = require('./rateLimit.js');

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

  if (!(org.members && org.members[request.auth.uid])) {
    await doc.ref.update({
      [`members.${request.auth.uid}`]: { role: 'member', email, displayName },
    });
    await db.collection('users').doc(request.auth.uid).set({ orgId: doc.id, email, displayName }, { merge: true });
  }

  return { orgId: doc.id, name: org.name };
});

module.exports = { lookupOrgByInviteCode, joinOrgByInviteCode };
