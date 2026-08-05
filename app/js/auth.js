import { state, defaultCfg } from './state.js';
import { t } from './i18n.js';
import { avatarInitial } from './utils.js';
import { toast, applyLang, showTab } from './ui.js';
import { loadFromFirestore, listenActiveState, unlistenActiveState } from './storage.js';
import { initOrg, handleJoinLink, renderOrgSettings, listenOrgState, unlistenOrgState } from './org.js';
import { renderPills } from './clock.js';
import { renderEntries } from './entries.js';
import { renderAllSelects } from './customers.js';
import { renderServiceSelects } from './settings.js';

const EMAIL_ERRORS = {
  'auth/invalid-email': 'Sähköpostiosoite ei ole kelvollinen.',
  'auth/user-not-found': 'Tunnusta ei löydy.',
  'auth/wrong-password': 'Väärä salasana.',
  'auth/email-already-in-use': 'Sähköposti on jo käytössä.',
  'auth/weak-password': 'Salasana on liian lyhyt (väh. 6 merkkiä).',
  'auth/invalid-credential': 'Väärä sähköposti tai salasana.',
  'auth/too-many-requests': 'Liian monta yritystä. Odota hetki.',
};

export function updateUserNameDisplay() {
  const company = (state.cfg.company || '').trim();
  document.getElementById('user-name').textContent = company || state.accountName;
  const av = document.getElementById('user-avatar');
  const avLetter = document.getElementById('user-avatar-letter');
  const avIcon = document.getElementById('user-avatar-icon');
  if (company) {
    avLetter.textContent = avatarInitial(company);
    avLetter.style.display = 'flex';
    av.style.display = 'none';
    avIcon.style.display = 'none';
  } else if (state.accountPhotoURL) {
    av.src = state.accountPhotoURL;
    av.style.display = 'block';
    avLetter.style.display = 'none';
    avIcon.style.display = 'none';
  } else {
    av.style.display = 'none';
    avLetter.style.display = 'none';
    avIcon.style.display = 'flex';
  }
}

function showLoginView(view) {
  ['main', 'signin', 'signup', 'reset', 'checking'].forEach(v => {
    document.getElementById('login-view-' + v).style.display = v === view ? '' : 'none';
  });
  document.getElementById('login-view-main').style.display = view === 'main' ? 'flex' : 'none';
  const subs = {
    main: 'Seuraa työtunteja ja kokoa laskuja.<br>Kirjaudu sisään päästäksesi alkuun.',
    signin: 'Kirjaudu sähköpostilla ja salasanalla.',
    signup: 'Luo uusi tunnus.',
    reset: 'Syötä sähköpostisi niin lähetämme palautuslinkin.',
  };
  document.getElementById('login-sub-text').innerHTML = subs[view];
  clearLoginErrors();
}

function clearLoginErrors() {
  ['login-error', 'signup-error', 'reset-msg'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

// Guards against a fast double-tap firing two concurrent attempts of the
// SAME sign-in method (e.g. two Google popups, or two signInAnonymously()
// calls racing to create separate accounts). Kept per-method rather than
// one shared flag — Firebase can take several seconds to detect a closed
// Google popup, and a shared flag left every other login button (email,
// anon) unresponsive for that whole window, punishing a stray click hard.
let googleInProgress = false;
let emailSigninInProgress = false;
let signupInProgress = false;
let anonInProgress = false;

function signInWithGoogle(btn) {
  // A real disabled attribute would swallow the click outright, so a stray
  // re-click during the pending window couldn't even show the "wait" toast.
  // A CSS-only busy class keeps the button clickable so the guard above runs.
  if (googleInProgress) { toast('Odota hetki..'); return; }
  googleInProgress = true;
  if (btn) btn.classList.add('btn-busy');
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => {
    if (err.code === 'auth/popup-blocked') {
      // Browser blocked the popup outright — redirect is the only way forward.
      auth.signInWithRedirect(provider);
    } else if (err.code !== 'auth/popup-closed-by-user' &&
               err.code !== 'auth/cancelled-popup-request') {
      // User closing the popup or cancelling isn't an error — don't force
      // them into a redirect they didn't ask for.
      toast(t('loginFail') + err.code);
    }
  }).finally(() => { googleInProgress = false; if (btn) btn.classList.remove('btn-busy'); });
}

function signInWithEmail(btn) {
  if (emailSigninInProgress) { toast('Odota hetki..'); return; }
  const email = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Täytä kaikki kentät.'; return; }
  emailSigninInProgress = true;
  const origLabel = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Kirjaudutaan…'; }
  auth.signInWithEmailAndPassword(email, password).catch(err => {
    errEl.textContent = EMAIL_ERRORS[err.code] || 'Kirjautuminen epäonnistui.';
  }).finally(() => { emailSigninInProgress = false; if (btn) { btn.disabled = false; btn.textContent = origLabel; } });
}

function signUpWithEmail(btn) {
  if (signupInProgress) { toast('Odota hetki..'); return; }
  const email = document.getElementById('signup-email').value.trim();
  const pw1 = document.getElementById('signup-password').value;
  const pw2 = document.getElementById('signup-password2').value;
  const errEl = document.getElementById('signup-error');
  errEl.textContent = '';
  if (!email || !pw1 || !pw2) { errEl.textContent = 'Täytä kaikki kentät.'; return; }
  if (pw1 !== pw2) { errEl.textContent = 'Salasanat eivät täsmää.'; return; }
  signupInProgress = true;
  const origLabel = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Luodaan tunnusta…'; }
  auth.createUserWithEmailAndPassword(email, pw1).catch(err => {
    errEl.textContent = EMAIL_ERRORS[err.code] || 'Tunnuksen luonti epäonnistui.';
  }).finally(() => { signupInProgress = false; if (btn) { btn.disabled = false; btn.textContent = origLabel; } });
}

function sendPasswordReset() {
  const email = document.getElementById('reset-email').value.trim();
  const msgEl = document.getElementById('reset-msg');
  msgEl.textContent = '';
  if (!email) { msgEl.textContent = 'Syötä sähköpostiosoite.'; return; }
  auth.sendPasswordResetEmail(email)
    .then(() => {
      msgEl.style.color = '#d0ffd0';
      msgEl.textContent = 'Palautuslinkki lähetetty! Tarkista sähköpostisi.';
    })
    .catch(err => {
      msgEl.style.color = '#ffd0d0';
      msgEl.textContent = EMAIL_ERRORS[err.code] || 'Lähetys epäonnistui.';
    });
}

// Only resets the button on failure — on success the login screen stays up
// for another moment while onAuthStateChanged loads the account, and
// flipping the button back to normal before that finishes reads as the
// login having silently given up.
function resetAnonButton() {
  anonInProgress = false;
  const btn = document.getElementById('btn-anon');
  if (btn) { btn.disabled = false; btn.textContent = 'Kokeile ilman tunnusta'; }
}

function signInAnonymously() {
  if (anonInProgress) { toast('Odota hetki..'); return; }
  anonInProgress = true;
  const btn = document.getElementById('btn-anon');
  if (btn) { btn.disabled = true; btn.textContent = 'Kirjaudutaan…'; }
  auth.signInAnonymously().catch(() => { toast('Anonyymi kirjautuminen epäonnistui.'); resetAnonButton(); });
}

function signOut() {
  auth.signOut().catch(() => toast('Uloskirjautuminen epäonnistui. Yritä uudelleen.'));
}

auth.getRedirectResult().then(() => {}).catch(e => {
  if (e.code !== 'auth/no-auth-event') toast(t('loginFail2'));
});

auth.onAuthStateChanged(async user => {
  if (user) {
    // signInWithPopup can switch straight from one signed-in account to a
    // different one without ever passing through the null (signed-out)
    // branch below, so this is the only place a stale-account guard runs.
    // Without it, the previous account's in-memory entries/invoices/
    // expenses/customers stay rendered on screen for however long initOrg
    // + loadFromFirestore below take to resolve.
    if (state.uid && state.uid !== user.uid) {
      state.entries = []; state.invoices = []; state.expenses = []; state.customers = [];
      state.eId = 0; state.iId = 0; state.eExpId = 0; state.cId = 0;
      state.cfg = defaultCfg();
      renderAllSelects(); renderServiceSelects(); renderPills(); renderEntries();
      window.updateInvoiceBadge?.();
    }
    state.uid = user.uid;
    state.accountName = user.isAnonymous ? 'Vieras' : (user.displayName || user.email);
    state.accountPhotoURL = user.photoURL || '';
    updateUserNameDisplay();

    try {
      // Check for invite link in URL before initOrg
      const joinCode = new URLSearchParams(location.search).get('join');
      if (joinCode && state.uid) {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists && userDoc.data().orgId) {
          // Already in an org — show join prompt
          await initOrg(user);
          await loadFromFirestore();
          updateUserNameDisplay();
          renderOrgSettings();
          document.getElementById('login-screen').classList.remove('visible');
          handleJoinLink(user, joinCode);
          return;
        } else {
          // New user — store code and let initOrg handle it
          localStorage.setItem('pendingJoinCode', joinCode);
          history.replaceState({}, '', location.pathname);
        }
      }

      await initOrg(user);
      await loadFromFirestore();
      updateUserNameDisplay();
      applyLang();
      listenActiveState();
      listenOrgState();
      if (user.isAnonymous && state.entries.length === 0 && state.invoices.length === 0) {
        const { loadDemoData } = await import('./demo.js');
        loadDemoData();
        const { renderAllSelects, renderCustChips } = await import('./customers.js');
        const { renderEntries } = await import('./entries.js');
        const { renderPills } = await import('./clock.js');
        renderAllSelects(); renderCustChips(); renderServiceSelects(); renderPills(); renderEntries();
        window.updateExpenseKindOptions?.();
        window.updateInvoiceBadge?.();
      }
      renderOrgSettings();

      // Stripe (checkout success/cancel, or the billing portal's return_url)
      // sends the browser back to the app with one of these — land on
      // Asetukset either way, since that's where the purchase/subscription
      // actually lives, and thank the user on a confirmed purchase rather
      // than leaving them to notice the plan changed on their own.
      const params = new URLSearchParams(location.search);
      const checkoutResult = params.get('checkout');
      if (checkoutResult === 'success') {
        showTab('asetukset');
        toast(t('checkoutSuccessToast'), 'success');
        history.replaceState({}, '', location.pathname);
      } else if (checkoutResult === 'cancel' || params.get('tab') === 'asetukset') {
        showTab('asetukset');
        history.replaceState({}, '', location.pathname);
      }
    } finally {
      document.getElementById('login-screen').classList.remove('visible');
    }
  } else {
    unlistenActiveState();
    unlistenOrgState();
    document.getElementById('login-screen').classList.add('visible');
    showLoginView('main');
    resetAnonButton();
    state.uid = null; state.orgId = null; state.accountName = ''; state.accountPhotoURL = '';
    state.entries = []; state.invoices = []; state.expenses = []; state.customers = [];
    state.eId = 0; state.iId = 0; state.eExpId = 0; state.cId = 0;
    state.cfg = defaultCfg();
    document.getElementById('user-name').textContent = '';
    document.getElementById('user-avatar').style.display = 'none';
    document.getElementById('user-avatar-letter').style.display = 'none';
    document.getElementById('user-avatar-icon').style.display = 'none';
    renderAllSelects(); renderServiceSelects(); renderPills(); renderEntries();
    window.updateInvoiceBadge?.();
  }
});

window.signInWithGoogle = signInWithGoogle;
window.signInWithEmail = signInWithEmail;
window.signUpWithEmail = signUpWithEmail;
window.sendPasswordReset = sendPasswordReset;
window.signInAnonymously = signInAnonymously;
window.showLoginView = showLoginView;
window.signOut = signOut;
