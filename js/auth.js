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

function signOut() {
  auth.signOut();
}

auth.getRedirectResult().then(() => {}).catch(e => {
  if (e.code !== 'auth/no-auth-event') toast(t('loginFail2'));
});

auth.onAuthStateChanged(user => {
  if (user) {
    uid = user.uid;
    document.getElementById('login-screen').classList.remove('visible');
    document.getElementById('user-name').textContent = user.displayName || user.email;
    const av = document.getElementById('user-avatar');
    if (user.photoURL) { av.src = user.photoURL; av.style.display = 'block'; }
    else av.style.display = 'none';
    loadFromFirestore();
  } else {
    uid = null;
    entries = []; invoices = []; eId = 0; iId = 0;
    cfg = { hourly: 50, customers: [], recurring: [], company: '', address: '', phone: '', email: '', ytunnus: '', tilinumero: '', rounding: 15, vat: 0, showTilinumero: true, showErapaiva: true, showViitenumero: false };
    document.getElementById('login-screen').classList.add('visible');
  }
});
