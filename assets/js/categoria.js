import { db, collection, query, where, onSnapshot, getProfile, selectStream, mainCategory } from './firebase.js';
import { header, footer, liveCard, categories, icons, escapeHtml } from './ui.js';
import { watchPublicLiveFeed } from './live-feed-source.js';

header('categorias');
footer();
const params = new URLSearchParams(location.search);
const category = params.get('categoria') || 'Gaming';
const sub = params.get('subcategoria') || '';
document.querySelector('#category-title').textContent = sub ? `${category} — ${sub}` : category;
document.querySelector('#category-icon').textContent = icons[category] || '◈';
const subnav = document.querySelector('#subcategories');
const subs = categories[category] || [];
subnav.innerHTML = `<a class="filter ${!sub ? 'active' : ''}" href="categoria.html?categoria=${encodeURIComponent(category)}">Todos</a>`
  + subs.map(value => `<a class="filter ${sub === value ? 'active' : ''}" href="categoria.html?categoria=${encodeURIComponent(category)}&subcategoria=${encodeURIComponent(value)}">${escapeHtml(value)}</a>`).join('');
const grid = document.querySelector('#category-lives');
function render(items) {
  const matches = items.filter(live => mainCategory(live.categoryId) === category
    && (!sub || String(live.categoryId).trim() === `${category} - ${sub}`));
  matches.sort((a, b) => Number(b.viewerCount || 0) - Number(a.viewerCount || 0));
  grid.innerHTML = matches.length ? matches.map(liveCard).join('') : '<div class="state">Nenhuma live nesta categoria.</div>';
  grid.querySelectorAll('.live-card').forEach(card => card.addEventListener('click', () => {
    const live = matches.find(item => item.id === card.dataset.liveId);
    if (!live) return;
    selectStream(live);
    location.href = 'live.html';
  }));
}
const stopFeed = watchPublicLiveFeed({
  subscribeFirebase: (next, error) => onSnapshot(
    query(collection(db, 'streams'), where('status', '==', 'live')),
    async snap => {
      try {
        const base = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        next(await Promise.all(base.map(async live => {
          const profile = await getProfile(live.streamerUid).catch(() => null);
          return { ...live, username: profile?.username || 'Streamer', photoURL: profile?.photoURL || '' };
        })));
      } catch (cause) { error(cause); }
    }, error
  ),
  onData: render,
  onError: () => { grid.innerHTML = '<div class="state">Não foi possível carregar esta categoria.</div>'; }
});
window.addEventListener('pagehide', stopFeed, { once: true });
