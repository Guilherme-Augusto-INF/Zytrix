import { filterMarkup } from './discovery-markup.js';
import { db, collection, query, where, onSnapshot, getProfile, selectStream, normalize, mainCategory } from './client.js';
import { header, footer, liveCard } from './ui.js';
import { watchPublicLiveFeed } from './live-feed-source.js';
header('ao-vivo');
footer();
let lives = [];
let filter = 'todos';
let search = '';
const grid = document.querySelector('#lives-grid');
const filters = document.querySelector('#filters');
if (!filters.childElementCount) filters.innerHTML = filterMarkup();
filters.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button)
        return;
    filter = button.dataset.filter;
    filters.querySelectorAll('.filter').forEach(item => item.classList.toggle('active', item === button));
    render();
});
document.querySelector('#search').addEventListener('input', event => { search = event.target.value; render(); });
function render() {
    const term = normalize(search);
    const list = lives.filter(live => {
        if (filter !== 'todos' && mainCategory(live.categoryId) !== filter)
            return false;
        return !term || normalize([live.username, live.title, live.description, live.categoryId].join(' ')).includes(term);
    });
    grid.innerHTML = list.length ? list.map(liveCard).join('') : '<div class="state">Nenhuma transmissão encontrada.</div>';
    grid.querySelectorAll('.live-card').forEach(card => card.addEventListener('click', () => {
        const live = lives.find(item => item.id === card.dataset.liveId);
        if (!live)
            return;
        selectStream(live);
        location.href = 'live.html';
    }));
}
const stopFeed = watchPublicLiveFeed({
onData: items => { lives = items; render(); },
    onError: () => {
        lives = [];
        grid.innerHTML = '<div class="state">Erro ao carregar transmissões.</div>';
    }
});
window.addEventListener('pagehide', stopFeed, { once: true });
