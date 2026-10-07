import { header, footer } from './ui.js';
import { categoryMarkup } from './discovery-markup.js';
header('categorias');
footer();
const grid = document.querySelector('#categories-grid');
if (!grid.childElementCount) grid.innerHTML = categoryMarkup();
