import { state } from './state.js';
import { t } from './i18n.js';
import { toast } from './ui.js';
import { loadFromFirestore } from './storage.js';
import { initOrg, handleJoinLink, renderOrgSettings } from './org.js';

const EMAIL_ERRORS = {
  'auth/invalid-email': 'Sähköpostiosoite ei ole kelvollinen.',
  'auth/user-not-found': 'Tunnusta ei löydy.',
  'auth/wrong-password': 'Väärä salasana.',
  'auth/email-already-in-use': 'Sähköposti on jo käytössä.',
  'auth/weak-password': 'Salasana on liian lyhyt (väh. 6 merkkiä).',
  'auth/invalid-credential': 'Väärä sähköposti tai salasana.',
  'auth/too-many-requests': 'Liian monta yritystä. Odota hetki.',
};

function showLoginView(view) {
  ['main', 'signin', 'signup', 'reset'].forEach(v => {
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

function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => {
    if (err.code === 'auth/popup-blocked' ||
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request') {
      auth.signInWithRedirect(provider);
    } else {
      toast(t('loginFail') + err.code);
    }
  });
}

function signInWithEmail() {
  const email = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Täytä kaikki kentät.'; return; }
  auth.signInWithEmailAndPassword(email, password).catch(err => {
    errEl.textContent = EMAIL_ERRORS[err.code] || 'Kirjautuminen epäonnistui.';
  });
}

function signUpWithEmail() {
  const email = document.getElementById('signup-email').value.trim();
  const pw1 = document.getElementById('signup-password').value;
  const pw2 = document.getElementById('signup-password2').value;
  const errEl = document.getElementById('signup-error');
  errEl.textContent = '';
  if (!email || !pw1 || !pw2) { errEl.textContent = 'Täytä kaikki kentät.'; return; }
  if (pw1 !== pw2) { errEl.textContent = 'Salasanat eivät täsmää.'; return; }
  auth.createUserWithEmailAndPassword(email, pw1).catch(err => {
    errEl.textContent = EMAIL_ERRORS[err.code] || 'Tunnuksen luonti epäonnistui.';
  });
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

function signInAnonymously() {
  auth.signInAnonymously().catch(() => toast('Anonyymi kirjautuminen epäonnistui.'));
}

function signOut() {
  auth.signOut().catch(() => toast('Uloskirjautuminen epäonnistui. Yritä uudelleen.'));
}

auth.getRedirectResult().then(() => {}).catch(e => {
  if (e.code !== 'auth/no-auth-event') toast(t('loginFail2'));
});

auth.onAuthStateChanged(async user => {
  if (user) {
    state.uid = user.uid;
    document.getElementById('login-screen').classList.remove('visible');
    const name = user.isAnonymous ? 'Vieras' : (user.displayName || user.email);
    document.getElementById('user-name').textContent = name;
    const av = document.getElementById('user-avatar');
    if (user.photoURL) { av.src = user.photoURL; av.style.display = 'block'; }
    else av.style.display = 'none';

    // Check for invite link in URL before initOrg
    const joinCode = new URLSearchParams(location.search).get('join');
    if (joinCode && state.uid) {
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists && userDoc.data().orgId) {
        // Already in an org — show join prompt
        await initOrg(user);
        await loadFromFirestore();
        renderOrgSettings();
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
    if (user.isAnonymous && state.entries.length === 0 && state.invoices.length === 0) {
      loadDemoData();
      const { renderAllSelects } = await import('./customers.js');
      const { renderEntries } = await import('./entries.js');
      const { renderPills } = await import('./clock.js');
      renderAllSelects(); renderPills(); renderEntries();
    }
    renderOrgSettings();
  } else {
    state.uid = null; state.orgId = null;
    state.entries = []; state.invoices = []; state.eId = 0; state.iId = 0;
    state.cfg = { hourly: 50, customers: [], recurring: [], company: '', address: '', phone: '', email: '', ytunnus: '', tilinumero: '', rounding: 15, vat: 0, showTilinumero: true, showErapaiva: true, showViitenumero: false };
    document.getElementById('login-screen').classList.add('visible');
    showLoginView('main');
  }
});

window.signInWithGoogle = signInWithGoogle;
window.signInWithEmail = signInWithEmail;
window.signUpWithEmail = signUpWithEmail;
window.sendPasswordReset = sendPasswordReset;
window.signInAnonymously = signInAnonymously;
window.showLoginView = showLoginView;
window.signOut = signOut;
