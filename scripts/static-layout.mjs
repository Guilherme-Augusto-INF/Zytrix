import { headerMarkup, footerMarkup } from '../assets/js/site-shell.js';
import { categoryMarkup, filterMarkup } from '../assets/js/discovery-markup.js';

function fillDiv(html, pattern, content) {
    const opening = pattern.exec(html);
    if (!opening) return html;
    const tags = /<\/?div\b[^>]*>/gi;
    tags.lastIndex = opening.index + opening[0].length;
    let depth = 1, tag;
    while ((tag = tags.exec(html))) {
        depth += tag[0].startsWith('</') ? -1 : 1;
        if (!depth) return html.slice(0, opening.index + opening[0].length) + content + html.slice(tag.index);
    }
    throw Error('Unclosed layout wrapper');
}

export function renderStaticLayout(html, filename) {
    const active = { 'index.html': 'inicio', 'categorias.html': 'categorias', 'ao-vivo.html': 'ao-vivo', 'sobre.html': 'sobre', 'explorar.html': 'explore', 'clips.html': 'clips' }[filename] ?? '';
    if (/<div\b[^>]*\bdata-header\b/.test(html)) html = fillDiv(html, /<div\b[^>]*\bdata-header\b[^>]*>/, headerMarkup(active));
    if (/<div\b[^>]*\bdata-footer\b/.test(html)) {
        html = fillDiv(html, /<div\b[^>]*\bdata-footer\b[^>]*>/, footerMarkup());
        if (!/data-zytrix-footer-style/.test(html)) html = html.replace('</head>', '  <link rel="stylesheet" href="/assets/css/footer.css" data-zytrix-footer-style="true">\n</head>');
    }
    if (filename === 'categorias.html') html = fillDiv(html, /<div\b[^>]*\bid="categories-grid"[^>]*>/, categoryMarkup());
    if (filename === 'ao-vivo.html') html = fillDiv(html, /<div\b[^>]*\bid="filters"[^>]*>/, filterMarkup());
    return html;
}
