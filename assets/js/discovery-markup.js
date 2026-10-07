import { categories, icons } from './categories-data.js';
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
export function categoryMarkup() {
    return Object.entries(categories).map(([name, subs]) => `<a class="card category-card" href="categoria.html?categoria=${encodeURIComponent(name)}"><span class="category-icon">${icons[name]}</span><div><strong>${escape(name)}</strong><div class="muted" style="font-size:11px;margin-top:4px">${subs.length} subcategorias</div></div><span class="arrow">→</span></a>`).join('');
}
export function filterMarkup() {
    return ['todos', 'Gaming', 'Música', 'Just Chatting', 'Criatividade', 'Esportes', 'Tecnologia', 'Podcasts', 'IRL'].map(name => `<button class="filter${name === 'todos' ? ' active' : ''}" data-filter="${name}">${name === 'todos' ? 'Todos' : icons[name] + ' ' + name}</button>`).join('');
}
