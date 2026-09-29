import { db, doc, onSnapshot } from './firebase.js';
import { parseStreamingSource, streamingPlatformLabel } from './streaming.js';

const streamId = new URLSearchParams(location.search).get('stream') ||
  localStorage.getItem('zytrixSelectedStream') ||
  '';
const root = document.querySelector('#live-root');
const MATURE_SESSION_KEY = 'zytrixMatureViewerConfirmed';

let stream = null;
let stopStream = null;
let observer = null;

function matureConfirmed() {
  return sessionStorage.getItem(MATURE_SESSION_KEY) === '1';
}

function externalLink(source) {
  return source?.canonicalUrl || '#';
}

function removeAccessHelp() {
  root?.querySelector('#platform-access-help')?.remove();
}

function renderAccessHelp(player, source) {
  removeAccessHelp();
  if (!player || !source) return;

  const help = document.createElement('div');
  help.id = 'platform-access-help';
  help.className = 'platform-access-help';

  const label = streamingPlatformLabel(source.platform);
  const text = document.createElement('span');

  if (source.platform === 'twitch') {
    text.textContent = 'Se a Twitch solicitar login para conteúdo restrito, use o login do player. Se o navegador bloquear o popup ou cookies, abra diretamente na Twitch.';
  } else if (source.platform === 'kick') {
    text.textContent = 'Lives 18+ continuam sujeitas às preferências e controles da própria Kick. Se o embed restringir o acesso, abra diretamente na Kick.';
  } else {
    text.textContent = 'O YouTube pode bloquear a incorporação de algumas lives, exigir login ou aplicar restrições de idade. Se isso acontecer, abra a transmissão diretamente no YouTube.';
  }

  const link = document.createElement('a');
  link.href = externalLink(source);
  link.target = '_blank';
  link.rel = 'noopener noreferrer external';
  link.referrerPolicy = 'no-referrer';
  link.textContent = `Abrir no ${label}`;

  help.append(text, link);
  player.insertAdjacentElement('afterend', help);
}

function renderMatureGate(player, source) {
  player.innerHTML = '';
  const gate = document.createElement('div');
  gate.className = 'mature-stream-gate';

  const badge = document.createElement('span');
  badge.className = 'mature-stream-badge';
  badge.textContent = '18+';

  const title = document.createElement('strong');
  title.textContent = 'Conteúdo marcado como 18+';

  const text = document.createElement('p');
  text.textContent = `Este aviso da Zytrix não verifica idade nem substitui os controles do ${streamingPlatformLabel(source.platform)}. Ao continuar, o player original será carregado e a plataforma poderá exigir login, confirmação de idade ou outras permissões.`;

  const actions = document.createElement('div');
  actions.className = 'mature-stream-actions';

  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'btn btn-primary';
  confirm.textContent = 'Continuar para o player';
  confirm.onclick = () => {
    sessionStorage.setItem(MATURE_SESSION_KEY, '1');
    player.dataset.zytrixPlayerSignature = '';
    setupPlayer(true);
  };

  const link = document.createElement('a');
  link.className = 'btn';
  link.href = externalLink(source);
  link.target = '_blank';
  link.rel = 'noopener noreferrer external';
  link.referrerPolicy = 'no-referrer';
  link.textContent = `Abrir no ${streamingPlatformLabel(source.platform)}`;

  actions.append(confirm, link);
  gate.append(badge, title, text, actions);
  player.appendChild(gate);
  renderAccessHelp(player, source);
}

function renderKick(player, source) {
  player.innerHTML = '';
  const params = new URLSearchParams({
    autoplay: 'true',
    muted: 'true',
    allowfullscreen: 'true'
  });

  const iframe = document.createElement('iframe');
  iframe.src = `https://player.kick.com/${encodeURIComponent(source.username)}?${params.toString()}`;
  iframe.title = `Player Kick de ${source.username}`;
  iframe.allow = 'autoplay; fullscreen; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';

  player.appendChild(iframe);
  renderAccessHelp(player, source);
}

function renderYouTube(player, source) {
  player.innerHTML = '';

  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    playsinline: '1',
    rel: '0'
  });

  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(source.videoId)}?${params.toString()}`;
  iframe.title = 'Player de live do YouTube';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';

  player.appendChild(iframe);
  renderAccessHelp(player, source);
}

function renderTwitch(player, source) {
  // Use Twitch's documented iframe embed. The previous SDK loader was blocked
  // by the production CSP and replaced the working iframe with an error.
  player.innerHTML = '';
  const params = new URLSearchParams({
    channel: source.username,
    autoplay: 'true',
    muted: 'true'
  });
  params.append('parent', location.hostname);

  const iframe = document.createElement('iframe');
  iframe.src = `https://player.twitch.tv/?${params.toString()}`;
  iframe.title = `Player Twitch de ${source.username}`;
  iframe.allow = 'autoplay; fullscreen; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  player.appendChild(iframe);
  renderAccessHelp(player, source);
}

function setupPlayer(force = false) {
  if (!root || !stream) return;

  const player = root.querySelector('.player');
  if (!player) return;

  const source = parseStreamingSource(stream.playbackURL || '');
  if (!source) return;

  const sourceKey = source.videoId || source.username || '';
  const signature = [
    source.platform,
    sourceKey,
    stream.matureContent === true ? '18' : 'all',
    matureConfirmed() ? 'confirmed' : 'locked'
  ].join(':');

  if (!force && player.dataset.zytrixPlayerSignature === signature) return;

  player.dataset.zytrixPlayerSignature = signature;

  if (stream.matureContent === true && !matureConfirmed()) {
    renderMatureGate(player, source);
    return;
  }

  if (source.platform === 'twitch') {
    renderTwitch(player, source);
    return;
  }

  if (source.platform === 'youtube') {
    renderYouTube(player, source);
    return;
  }

  renderKick(player, source);
}

if (root && streamId) {
  stopStream = onSnapshot(doc(db, 'streams', streamId), snap => {
    if (!snap.exists()) return;
    stream = { id: snap.id, ...snap.data() };
    // Ignore frequent snapshots that only change viewerCount or presence.
    setupPlayer();
  }, error => console.warn('Não foi possível acompanhar o player.', error));

  observer = new MutationObserver(() => setupPlayer());
  observer.observe(root, { childList: true, subtree: false });
}

window.addEventListener('pagehide', () => {
  stopStream?.();
  observer?.disconnect();
});
