// viewer-presence-counter-v2
import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  getDoc,
  onSnapshot
} from './firebase.js';
import { escapeHtml } from './ui.js';
import { getGuestPresenceIdentity } from './guest-presence.js';
import {
  selectedStreamId,
  isFollowing,
  setFollowState,
  watchFollowerCount,
  watchActiveViewers,
  startViewerPresence
} from './social.js';

const streamId = selectedStreamId();
let stream = null;
let streamerProfile = null;
let currentUser = null;
let following = false;
let followerCount = 0;
let activeViewers = null;
let stopFollowers = null;
let stopViewers = null;
let stopPresence = null;
let stopStream = null;
let observer = null;
let presenceGeneration = 0;

function waitForLiveContent() {
  const root = document.querySelector('#live-root');
  if (!root) return;

  const tryMount = () => {
    if (!stream) return;
    const loadingOnly = root.children.length === 1 && root.querySelector('.state');
    if (loadingOnly) return;

    if (!root.querySelector('#live-social-panel')) renderPanel();
    else syncPrimaryViewerCount();
  };

  tryMount();
  observer = new MutationObserver(tryMount);
  observer.observe(root, { childList: true, subtree: false });
}

function viewerLabel() {
  if (!currentUser) return 'Login necessário';
  return currentUser?.uid === stream?.streamerUid ? Number(activeViewers || 0).toLocaleString('pt-BR') : 'Privado';
}

function syncPrimaryViewerCount() {
  // The live's public viewerCount is updated atomically along with presence.
  // Do not replace it with the separate 90-second creator analytics estimate.
  const element = document.querySelector('#live-viewer-count');
  if (element && stream) {
    const count = Math.max(0, Number(stream.viewerCount || 0));
    element.textContent = `👁 ${count.toLocaleString('pt-BR')}`;
  }
}

function renderPanel() {
  const root = document.querySelector('#live-root');
  if (!root || !stream) return;

  let panel = root.querySelector('#live-social-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'live-social-panel';
    panel.className = 'card panel social-panel';
    root.appendChild(panel);
  }

  const ownChannel = currentUser?.uid === stream.streamerUid;
  const buttonText = !currentUser
    ? 'Entrar para seguir'
    : ownChannel
      ? 'Seu canal'
      : following
        ? 'Seguindo ✓'
        : 'Seguir';

  panel.innerHTML = `
    <div class="social-panel-head">
      <div>
        <div class="eyebrow">Comunidade</div>
        <h2 style="margin:4px 0 0">${escapeHtml(streamerProfile?.username || 'Streamer')}</h2>
      </div>
      <button
        id="follow-streamer"
        class="btn ${following ? 'is-following follow-button' : 'btn-primary follow-button'}"
        ${ownChannel ? 'disabled' : ''}
      >${escapeHtml(buttonText)}</button>
    </div>

    <div class="social-stats">
      <div class="stat-box">
        <span class="stat-label">Seguidores</span>
        <strong id="live-follower-count">${currentUser?.uid === stream.streamerUid ? followerCount.toLocaleString('pt-BR') : 'Privado'}</strong>
      </div>
      <div class="stat-box">
        <span class="stat-label">Espectadores ativos</span>
        <strong id="zytrix-active-viewers">${viewerLabel()}</strong>
      </div>
      <div class="stat-box">
        <span class="stat-label">Fonte da contagem</span>
        <strong>${ownChannel ? 'Presença Zytrix' : 'Protegida'}</strong>
      </div>
    </div>

    <p class="dashboard-note">
      O contador considera usuários autenticados com presença ativa nesta live nos últimos 90 segundos.
      A presença é renovada automaticamente a cada 30 segundos e deixa de contar quando expira.
    </p>
    <div id="follow-message"></div>
  `;

  syncPrimaryViewerCount();

  const button = panel.querySelector('#follow-streamer');
  if (!button || ownChannel) return;

  button.onclick = async () => {
    if (!currentUser) {
      location.href = `login.html?redirect=${encodeURIComponent(location.pathname + location.search)}`;
      return;
    }

    button.disabled = true;
    const message = panel.querySelector('#follow-message');
    try {
      await setFollowState(currentUser.uid, stream.streamerUid, !following);
      following = !following;
      if (message) {
        message.innerHTML = `<div class="message ok">${following ? 'Você está seguindo este streamer.' : 'Você deixou de seguir este streamer.'}</div>`;
      }
      renderPanel();
    } catch (error) {
      console.error('Erro ao alterar acompanhamento:', error);
      button.disabled = false;
      if (message) {
        message.innerHTML = '<div class="message err">Não foi possível alterar agora.</div>';
      }
    }
  };
}

async function refreshFollowState() {
  if (!currentUser || !stream || currentUser.uid === stream.streamerUid) {
    following = false;
    renderPanel();
    return;
  }
  try {
    following = await isFollowing(currentUser.uid, stream.streamerUid);
  } catch (error) {
    console.warn('Não foi possível verificar se o canal é seguido.', error);
  }
  renderPanel();
}

async function startPresenceForUser() {
  const generation = ++presenceGeneration;
  const previousPresence = stopPresence;
  stopPresence = null;
  stopViewers?.();
  stopViewers = null;
  activeViewers = null;

  // Wait for the previous presence to close before reopening it, avoiding
  // reordering increments/decrements during fast tab visibility changes.
  if (previousPresence) await previousPresence();
  if (generation !== presenceGeneration) return;

  if (!streamId || !stream || document.visibilityState === 'hidden') {
    renderPanel();
    return;
  }

  if (currentUser.uid === stream.streamerUid) {
    // The creator is not an audience member, but may see private analytics.
    stopViewers = watchActiveViewers(
      streamId,
      count => {
        if (generation !== presenceGeneration) return;
        activeViewers = count;
        const element = document.querySelector('#zytrix-active-viewers');
        if (element) element.textContent = count.toLocaleString('pt-BR');
      },
      error => console.warn('Não foi possível acompanhar espectadores ativos.', error)
    );
    renderPanel();
    return;
  }

  if (stream.status !== 'live') {
    renderPanel();
    return;
  }

  try {
    // Signed-in users use their primary identity; visitors get an isolated
    // anonymous Firebase identity solely for presence tracking.
    const identity = currentUser
      ? { uid: currentUser.uid, db }
      : await getGuestPresenceIdentity();
    if (generation !== presenceGeneration) return;
    const stop = await startViewerPresence(identity.uid, streamId, identity.db);
    if (generation !== presenceGeneration) {
      await stop();
      return;
    }
    stopPresence = stop;
    renderPanel();
  } catch (error) {
    // If Anonymous Auth is disabled in Firebase, guest viewing still works,
    // but cannot safely contribute to the public counter.
    console.warn('Presença do espectador indisponível.', error?.code || error);
  }
}

async function initialize() {
  if (!streamId) return;

  const snap = await getDoc(doc(db, 'streams', streamId));
  if (!snap.exists()) return;
  stream = { id: snap.id, ...snap.data() };

  const profileSnap = await getDoc(doc(db, 'profiles', stream.streamerUid));
  streamerProfile = profileSnap.exists() ? profileSnap.data() : null;

  if (currentUser?.uid === stream.streamerUid) stopFollowers = watchFollowerCount(
    stream.streamerUid,
    count => {
      followerCount = count;
      const element = document.querySelector('#live-follower-count');
      if (element) element.textContent = count.toLocaleString('pt-BR');
    },
    error => console.warn('Não foi possível carregar seguidores.', error)
  );

  stopStream = onSnapshot(doc(db, 'streams', streamId), streamSnap => {
    if (!streamSnap.exists()) return;
    const previousStatus = stream?.status;
    stream = { id: streamSnap.id, ...streamSnap.data() };
    renderPanel();
    syncPrimaryViewerCount();
    if (previousStatus !== stream.status) {
      startPresenceForUser().catch(error => console.warn('Presença indisponível.', error));
    }
  });

  waitForLiveContent();
  await refreshFollowState();
  await startPresenceForUser();
}

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (!stream) return;
  await refreshFollowState();
  await startPresenceForUser();
});

initialize().catch(error => console.warn('Recursos sociais da live indisponíveis.', error));

document.addEventListener('visibilitychange', () => {
  if (!stream) return;
  startPresenceForUser().catch(error => console.warn('Falha ao atualizar presença.', error));
});

window.addEventListener('pagehide', () => {
  ++presenceGeneration;
  stopFollowers?.();
  stopViewers?.();
  stopPresence?.();
  stopStream?.();
  observer?.disconnect();
});
