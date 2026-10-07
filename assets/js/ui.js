import { headerMarkup, footerMarkup } from './site-shell.js';
import { auth, onAuthStateChanged } from './client.js';
import { parseStreamingSource, streamingPlatformLabel } from './streaming.js';
export function header(active = '') {
    const element = document.querySelector('[data-header]');
    if (!element)
        return;
    if (!element.querySelector('.site-header'))
        element.innerHTML = headerMarkup(active);
    onAuthStateChanged(auth, user => {
        const guest = document.querySelector('#guest-nav');
        const profile = document.querySelector('#profile-nav');
        if (!guest || !profile)
            return;
        if (user) {
            if(user.enrollmentRequired&&!document.querySelector('[data-auth-form]')&&!location.pathname.endsWith('/sair.html')){location.replace('login.html?redirect='+encodeURIComponent(location.pathname+location.search));return;}
            guest.classList.add('hidden');
            profile.classList.remove('hidden');
        }
        else {
            guest.classList.remove('hidden');
            profile.classList.add('hidden');
        }
    });
}
function ensureFooterStyles() {
    if (document.querySelector('link[data-zytrix-footer-style]'))
        return;
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'assets/css/footer.css';
    stylesheet.dataset.zytrixFooterStyle = 'true';
    document.head.append(stylesheet);
}
export function footer() {
    const element = document.querySelector('[data-footer]');
    if (!element)
        return;
    ensureFooterStyles();
    if (!element.querySelector('.site-footer-v2'))
        element.innerHTML = footerMarkup();
}
export function liveCard(live, options = {}) {
    const source = parseStreamingSource(live.playbackURL || '');
    const platform = source ? streamingPlatformLabel(source.platform) : '';
    return `
    <article class="card live-card" data-live-id="${escapeAttr(live.id)}">
      <div class="thumb">
        ${live.thumbnailURL
        ? `<img width="640" height="360"${options.priority === true ? ' fetchpriority="high"' : ''} src="${escapeAttr(live.thumbnailURL)}" alt="Thumbnail de ${escapeAttr(live.username || 'streamer')}">`
        : '<div class="state">ZYTRIX</div>'}

        <span class="badge">● AO VIVO</span>

        ${source
        ? `<span class="platform-badge platform-${source.platform} card-platform">${escapeHtml(platform)}</span>`
        : ''}

        <span class="viewers">👁 ${Number(live.viewerCount || 0).toLocaleString('pt-BR')}</span>
        <span class="play">▶</span>
      </div>

      ${liveMeta(live)}
    </article>
  `;
}
export function liveMeta(live) {
    const initial = (live.username || 'S').charAt(0).toUpperCase();
    return `<div class="live-meta">
        ${live.photoURL
        ? `<img width="34" height="34" class="avatar" src="${escapeAttr(live.photoURL)}" alt="Foto de ${escapeAttr(live.username || 'streamer')}">`
        : `<span class="avatar">${escapeHtml(initial)}</span>`}

        <div>
          <div class="live-title">${escapeHtml(live.username || 'Streamer')}</div>
          <div class="live-sub">${escapeHtml(live.title || 'Transmissão ao vivo')}</div>
          <div class="live-cat">${escapeHtml(live.categoryId || '')}</div>
        </div>
      </div>
  `;
}
export function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#039;',
        '"': '&quot;'
    })[character]);
}
export function escapeAttr(value = '') {
    return escapeHtml(value);
}
export { categories, icons } from './categories-data.js';
