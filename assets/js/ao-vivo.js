import { db, collection, query, where, onSnapshot, getProfile, selectStream, normalize, mainCategory } from './firebase.js';
import { header, footer, liveCard, icons } from './ui.js';
import { watchPublicLiveFeed } from './live-feed-source.js';

header('ao-vivo');
footer();
let lives = [];
let filter = 'todos';
let search = '';
const grid = document.querySelector('#lives-grid');
const filters = document.querySelector('#filters');
const names = ['todos', 'Gaming', 'Música', 'Just Chatting', 'Criatividade', 'Esportes', 'Tecnologia', 'Podcasts', 'IRL'];
filters.innerHTML = names.map(n => `<button class="filter ${n === 'todos' ? 'active' : ''}" data-filter="${n}">${n === 'todos' ? 'Todos' : icons[n] + ' ' + n}</button>`).join('');
filters.addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  filter = button.dataset.filter;
  filters.querySelectorAll('.filter').forEach(item => item.classList.toggle('active', item === button));
  render();
});
document.querySelector('#search').addEventListener('input', event => { search = event.target.value; render(); });
function render() {
  const term = normalize(search);
  const list = lives.filter(live => {
    if (filter !== 'todos' && mainCategory(live.categoryId) !== filter) return false;
    return !term || normalize([live.username, live.title, live.description, live.categoryId].join(' ')).includes(term);
  });
  grid.innerHTML = list.length ? list.map(liveCard).join('') : '<div class="state">Nenhuma transmissão encontrada.</div>';
  grid.querySelectorAll('.live-card').forEach(card => card.addEventListener('click', () => {
    const live = lives.find(item => item.id === card.dataset.liveId);
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
        const base = snap.docs.map(d => ({ id: d.id, ...d.data(), viewerCount: Math.max(0, Number(d.data().viewerCount || 0)) }))
          .sort((a, b) => b.viewerCount - a.viewerCount);
        next(await Promise.all(base.map(async live => {
          const profile = await getProfile(live.streamerUid).catch(() => null);
          return { ...live, username: profile?.username || 'Streamer', photoURL: profile?.photoURL || '' };
        })));
      } catch (cause) { error(cause); }
    }, error
  ),
  onData: items => { lives = items; render(); },
  onError: () => {
    lives = [];
    grid.innerHTML = '<div class="state">Erro ao carregar transmissões.</div>';
  }
});
window.addEventListener('pagehide', stopFeed, { once: true });
