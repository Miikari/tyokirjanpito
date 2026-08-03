import { state } from './state.js';
import { t } from './i18n.js';
import { esc } from './utils.js';
import { toast } from './ui.js';

// Global, cross-org feature-idea board — deliberately NOT scoped under
// orgs/{orgId} like the rest of this app's data, since it's shared product
// feedback rather than per-business bookkeeping.
function ideasCol() {
  return db.collection('featureIdeas');
}

let ideasCache = [];

export async function renderIdeas() {
  const list = document.getElementById('ideas-list');
  if (!list) return;
  try {
    const snap = await ideasCol().get();
    ideasCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    list.innerHTML = `<div style="font-size:14px;color:var(--text2);padding:4px 0">${t('ideasLoadError')}</div>`;
    return;
  }
  renderIdeasList();
}

function renderIdeasList() {
  const list = document.getElementById('ideas-list');
  if (!list) return;
  if (!ideasCache.length) {
    list.innerHTML = `<div style="font-size:14px;color:var(--text2);padding:4px 0">${t('ideasEmpty')}</div>`;
    return;
  }
  const sorted = [...ideasCache].sort((a, b) => {
    const va = Object.keys(a.voters || {}).length;
    const vb = Object.keys(b.voters || {}).length;
    if (vb !== va) return vb - va;
    return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
  });
  list.innerHTML = sorted.map(idea => {
    const voters = idea.voters || {};
    const count = Object.keys(voters).length;
    const voted = !!voters[state.uid];
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
      <button type="button" onclick="toggleIdeaVote('${idea.id}')"
        style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;width:44px;padding:6px 0;border-radius:var(--r-sm);cursor:pointer;font-weight:700;
        border:1.5px solid ${voted ? 'var(--blue)' : 'var(--border2)'};background:${voted ? 'var(--blue)' : 'var(--bg)'};color:${voted ? '#fff' : 'var(--text)'};">
        <span style="font-size:13px;line-height:1;">▲</span>
        <span style="font-size:13px;line-height:1;">${count}</span>
      </button>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;color:var(--text);">${esc(idea.text)}</div>
        ${idea.createdByName ? `<div style="font-size:12px;color:var(--text3);margin-top:2px;">${esc(idea.createdByName)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

export async function addIdea() {
  const input = document.getElementById('idea-input');
  const btn = document.getElementById('idea-submit-btn');
  if (btn.disabled) return;
  const text = input.value.trim();
  if (!text) { toast(t('ideasEmptyInput')); return; }
  if (text.length > 300) { toast(t('ideasTooLong')); return; }

  const origLabel = btn.textContent;
  btn.disabled = true; btn.textContent = t('saving');
  try {
    await ideasCol().add({
      text,
      createdByUid: state.uid,
      createdByName: state.cfg.company || state.accountName || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    input.value = '';
    toast(t('ideaSubmitted'), 'success');
    await renderIdeas();
  } catch (e) {
    toast(t('ideasSaveError'));
  } finally {
    btn.disabled = false; btn.textContent = origLabel;
  }
}

export async function toggleIdeaVote(id) {
  const idea = ideasCache.find(i => i.id === id);
  if (!idea) return;
  const voters = idea.voters || (idea.voters = {});
  const hadVoted = !!voters[state.uid];

  // Optimistic local flip so the button responds instantly; reverted below
  // if the write itself fails.
  if (hadVoted) delete voters[state.uid]; else voters[state.uid] = true;
  renderIdeasList();

  try {
    await ideasCol().doc(id).update({
      [`voters.${state.uid}`]: hadVoted ? firebase.firestore.FieldValue.delete() : true,
    });
  } catch (e) {
    if (hadVoted) voters[state.uid] = true; else delete voters[state.uid];
    renderIdeasList();
    toast(t('ideasSaveError'));
  }
}

window.addIdea = addIdea;
window.toggleIdeaVote = toggleIdeaVote;
