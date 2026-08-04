const crypto = require('crypto');

// Excludes visually-ambiguous characters (0/O, 1/I) — these codes get typed
// by hand often enough (manual "liity toiseen organisaatioon" entry, not
// just link-shared) that avoiding lookalikes is worth the tiny entropy cost.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// crypto.randomInt is a CSPRNG (unlike Math.random, which referral/invite
// codes used to be generated with) — that matters here because these codes
// are the only thing standing between "know the code" and "join someone
// else's organization" now that firestore.rules can't self-join without one
// (2026-08-04 security review). 12 chars from a 33-char alphabet is ~61 bits
// of entropy, astronomically out of brute-force range even before the
// per-uid rate limiting on the functions that consume these codes.
function genCode(length = 12) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return code;
}

module.exports = { genCode };
