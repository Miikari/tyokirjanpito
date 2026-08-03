const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Verifies the caller is authenticated and a member of the given org, then
// returns { orgRef, org } for the caller to use. Never trust a client-supplied
// orgId without this check — a malicious client could otherwise pass someone
// else's orgId to read/mutate their billing state.
async function requireOrgMember(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign-in required.');
  }
  const orgId = request.data?.orgId;
  if (!orgId || typeof orgId !== 'string') {
    throw new HttpsError('invalid-argument', 'orgId is required.');
  }
  const orgRef = getFirestore().collection('orgs').doc(orgId);
  const snap = await orgRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Organization not found.');
  }
  const org = snap.data();
  if (!org.members || !org.members[request.auth.uid]) {
    throw new HttpsError('permission-denied', 'Not a member of this organization.');
  }
  return { orgRef, org };
}

// Stricter than requireOrgMember: for actions that affect the org's billing
// (cancelling, changing payment method, viewing invoices/address) — any
// member could otherwise reach these via a member-only check, even one who
// self-joined through a shared invite code.
async function requireOrgOwner(request) {
  const result = await requireOrgMember(request);
  if (result.org.ownerId !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'Only the organization owner can manage billing.');
  }
  return result;
}

// Resets an org's billing fields after its Stripe customer turns out to be
// gone — otherwise a stale plan:'pro'/subscriptionStatus:'active' left over
// from before the customer vanished would keep wrongly blocking a
// re-purchase (createCheckoutSession's "already subscribed" guard) even
// though there's no working billing account behind it anymore.
async function clearStaleBilling(orgRef) {
  await orgRef.update({
    stripeCustomerId: FieldValue.delete(),
    plan: 'free',
    subscriptionStatus: FieldValue.delete(),
  });
}

module.exports = { requireOrgMember, requireOrgOwner, clearStaleBilling };
