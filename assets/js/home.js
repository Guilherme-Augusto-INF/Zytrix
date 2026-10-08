import { auth, db, onAuthStateChanged, collection, getDocs, getProfile, selectStream } from './client.js';
import { header, footer, liveCard, liveMeta, categories, icons, escapeHtml } from './ui.js';
import { initialLives } from './home-data.js';
import { watchPublicLiveFeed } from './live-feed-source.js';
import { getPlatformPreferences, watchFollowedCategories, recommendationScore, filterMature } from './platform-core.js';
header('inicio');
footer();
const featured = document.querySelector('#featured');
const liveNow = document.querySelector('#live-now');
const cats = document.querySelector('#home-categories');
let user = null;
// Until private preferences arrive, only display the safe public feed.
let preferences = { hideMatureContent: true, safeMode: true };
let following = new Set();
let followedCategories = new Set();
let recentStreamers = new Set();
let lives = [];
let livesReady = false;
let stopLive = null;
let stopCategories = null;
let liveGeneration = 0;
let initialLivesUsed = false;
const profiles = new Map();
const pendingProfiles = new Map();
const gridKeys = new WeakMap();
if (!cats.children.length)
    cats.innerHTML = Object.keys(categories).map(c => `<a class="card category-card" href="categoria.html?categoria=${encodeURIComponent(c)}"><span class="category-icon">${icons[c]}</span><div><strong>${c}</strong><div class="muted" style="font-size:11px;margin-top:4px">Explorar conteúdo</div></div><span class="arrow">→</span></a>`).join('');
function ensurePersonalizedSection() {
    let section = document.querySelector('#personalized-home');
    if (section)
        return section;
    const container = document.querySelector('main .container');
    section = document.createElement('section');
    section.id = 'personalized-home';
    section.className = 'section';
    container?.appendChild(section);
    return section;
}
let contextGeneration = 0;
async function loadContext() {
    const version = ++contextGeneration;
    const owner = user;
    following = new Set();
    recentStreamers = new Set();
    stopCategories?.();
    stopCategories = null;
    if (!user) {
        preferences = { hideMatureContent: false, safeMode: false };
        followedCategories = new Set();
        return;
    }
    const [nextPreferences, followingSnap, historySnap] = await Promise.all([
        getPlatformPreferences(owner.uid).catch(() => ({hideMatureContent:true,safeMode:true})),
        getDocs(collection(db, 'users', owner.uid, 'following')).catch(() => null),
        getDocs(collection(db, 'users', owner.uid, 'watchHistory')).catch(() => null)
    ]);
    if (version !== contextGeneration || user !== owner) return;
    preferences = nextPreferences;
    following = new Set(followingSnap?.docs?.map(item => item.id) || []);
    const history = historySnap?.docs?.map(item => item.data()) || [];
    history.sort((a, b) => (b.watchedAt?.seconds || 0) - (a.watchedAt?.seconds || 0));
    recentStreamers = new Set(history.slice(0, 12).map(item => item.streamerUid).filter(Boolean));
    stopCategories = watchFollowedCategories(owner.uid, value => {
        if (version !== contextGeneration) return;
        followedCategories = value;
        renderLives();
    }, () => { });
}
function score(item) {
    return recommendationScore(item, {
        following,
        followedCategories,
        recentStreamers,
        hideMatureContent: preferences.hideMatureContent || preferences.safeMode
    });
}
function renderLives() {
    if (!livesReady)
        return;
    const visible = filterMature(lives, preferences);
    const recommended = [...visible].sort((a, b) => score(b) - score(a));
    const trending = [...visible].sort((a, b) => Number(b.viewerCount || 0) - Number(a.viewerCount || 0));
    renderGrid(featured, recommended.slice(0, 3), 3, 'Nenhuma live em destaque.');
    renderGrid(liveNow, trending.slice(0, 4), 4, 'Nenhuma live agora.');
    const personal = ensurePersonalizedSection();
    if (user) {
        personal.dataset.user = user.uid;
        const followedLives = recommended.filter(item => following.has(item.streamerUid)).slice(0, 4);
        const recentLives = recommended.filter(item => recentStreamers.has(item.streamerUid) && !following.has(item.streamerUid)).slice(0, 4);
        personal.innerHTML = `
      <div class="section-head"><div><div class="eyebrow">PARA VOCÊ</div><h2>Sua Zytrix</h2></div><a class="muted" href="explorar.html">Abrir Explorar →</a></div>
      ${followedLives.length ? `<h3>Canais que você segue</h3><div class="grid grid-4">${followedLives.map(liveCard).join('')}</div>` : ''}
      ${recentLives.length ? `<h3 style="margin-top:18px">Continuar explorando</h3><div class="grid grid-4">${recentLives.map(liveCard).join('')}</div>` : ''}
      ${!followedLives.length && !recentLives.length ? '<div class="card panel"><strong>Personalize sua Home</strong><p class="muted">Siga streamers e categorias para a Zytrix ordenar melhor suas recomendações.</p><a class="btn" href="explorar.html">Explorar agora</a></div>' : ''}
    `;
    }
    else if (personal.dataset.user) {
        delete personal.dataset.user;
        personal.innerHTML = `<div class="card panel"><div class="eyebrow">PERSONALIZAÇÃO</div><h2>Uma Home que aprende com suas escolhas</h2><p class="muted">Entre na sua conta para priorizar canais seguidos, categorias favoritas e conteúdos recentes.</p><a class="btn btn-primary" href="login.html">Entrar</a></div>`;
    }
    bindCards();
}
function renderGrid(element, items, count, message) {
    const keys = JSON.stringify(items.map(item => [item.id, item.thumbnailURL || '', item.playbackURL || '']));
    if (items.length && gridKeys.get(element) === keys) {
        element.querySelectorAll('.live-card').forEach((card, index) => {
            updateCardMetadata(card, items[index]);
            card.querySelector('.viewers').textContent = `👁 ${Number(items[index].viewerCount || 0).toLocaleString('pt-BR')}`;
        });
        return;
    }
    gridKeys.set(element, keys);
    const previews = [...element.querySelectorAll('.home-live-slot')];
    if (items.length && previews.some((slot, index) => slot.dataset.liveId === items[index]?.id)) {
        items.forEach((item, index) => {
            const slot = previews[index];
            const image = slot?.querySelector('.thumb img');
            const template = document.createElement('template');
            template.innerHTML = liveCard(item, { priority: element === featured && index === 0 });
            const card = template.content.firstElementChild;
            if (slot?.dataset.liveId === item.id && image?.getAttribute('src') === item.thumbnailURL) {
                // Keep the painted image in its original position during card hydration.
                slot.className = card.className;
                slot.removeAttribute('aria-hidden');
                slot.querySelector('.live-meta').replaceWith(card.querySelector('.live-meta'));
                const thumb = slot.querySelector('.thumb');
                card.querySelectorAll('.thumb > :not(img)').forEach(child => thumb.appendChild(child));
                image.alt = `Thumbnail de ${item.username || 'streamer'}`;
            }
            else {
                slot?.replaceWith(card);
            }
        });
        previews.slice(items.length).forEach(slot => {
            delete slot.dataset.liveId;
            slot.classList.add('home-live-empty');
            slot.querySelector('.thumb img')?.remove();
        });
        element.querySelector('.home-live-state')?.remove();
        element.setAttribute('aria-busy', 'false');
        return;
    }
    const slot = '<div class="card home-live-slot home-live-empty" aria-hidden="true"><div class="thumb"></div><div class="live-meta"></div></div>';
    element.innerHTML = items.map((item, index) => liveCard(item, { priority: element === featured && index === 0 })).join('') + slot.repeat(count - items.length)
        + (!items.length ? `<div class="state home-live-state" role="status">${escapeHtml(message)}</div>` : '');
    element.setAttribute('aria-busy', 'false');
}
function bindCards() {
    document.querySelectorAll('.live-card').forEach(card => {
        card.onclick = () => {
            const live = lives.find(item => item.id === card.dataset.liveId);
            if (!live)
                return;
            selectStream(live);
            location.href = `live.html?stream=${encodeURIComponent(live.id)}`;
        };
    });
}
function updateCardMetadata(card, item) {
    card.querySelector('.live-meta').outerHTML = liveMeta(item);
    const thumbnail = card.querySelector('.thumb img');
    if (thumbnail)
        thumbnail.alt = `Thumbnail de ${item.username || 'streamer'}`;
}
function applyLives(base, generation) {
    lives = base.map(data => {
        const item = { ...data, viewerCount: Math.max(0, Number(data.viewerCount || 0)) };
        const profile = profiles.get(item.streamerUid);
        return { ...item, username: profile?.username || item.username || 'Streamer', photoURL: profile?.photoURL || item.photoURL || '' };
    });
    // Discover thumbnails immediately; profile requests must not block the cards.
    livesReady = true;
    renderLives();
    for (const uid of new Set(lives.map(item => item.streamerUid))) {
        if (profiles.has(uid) || base.some(item => item.streamerUid === uid && item.username))
            continue;
        if (!pendingProfiles.has(uid)) {
            pendingProfiles.set(uid, getProfile(uid).then(profile => {
                if (profile)
                    profiles.set(uid, profile);
                return profile;
            }).catch(() => null).finally(() => pendingProfiles.delete(uid)));
        }
        pendingProfiles.get(uid).then(profile => {
            if (!profile || generation !== liveGeneration)
                return;
            lives = lives.map(item => item.streamerUid === uid
                ? { ...item, username: profile.username || 'Streamer', photoURL: profile.photoURL || '' } : item);
            document.querySelectorAll('.live-card').forEach(card => {
                const item = lives.find(live => live.id === card.dataset.liveId && live.streamerUid === uid);
                // Preserve the thumbnail DOM and layout when metadata arrives.
                if (item)
                    updateCardMetadata(card, item);
            });
        });
    }
}
function startLives() {
    stopLive?.();
    const generation = ++liveGeneration;
    let receivedSnapshot = false;
    livesReady = false;
    if (!initialLivesUsed) {
        initialLivesUsed = true;
        initialLives.then(base => {
            if (base && !receivedSnapshot && generation === liveGeneration)
                applyLives(base, generation);
        });
    }
    stopLive = watchPublicLiveFeed({onData: items => {
        receivedSnapshot = true;
        applyLives(items, generation);
    }, onError: () => {
        if (livesReady)
            return;
        livesReady = true;
        renderGrid(featured, [], 3, 'Não foi possível carregar as lives.');
        renderGrid(liveNow, [], 4, 'Não foi possível carregar as lives.');
    }});
}
startLives();
onAuthStateChanged(auth, async (current) => {
    user = current;
    preferences = {hideMatureContent:true,safeMode:true};
    await loadContext();
    renderLives();
});
window.addEventListener('pagehide', () => { ++liveGeneration; stopLive?.(); stopCategories?.(); });
