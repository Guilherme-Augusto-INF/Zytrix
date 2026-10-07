import { auth, onAuthStateChanged } from './client.js';
import { parseStreamingSource, streamingPlatformLabel } from './streaming.js';
export function header(active = '') {
    const element = document.querySelector('[data-header]');
    if (!element)
        return;
    if (!element.querySelector('.site-header'))
        element.innerHTML = `
    <header class="site-header">
      <div class="container nav">
        <a class="brand" href="index.html" aria-label="Zytrix - Início">
          <span class="brand-mark">Z</span>
          <span>Zytrix</span>
        </a>

        <nav class="nav-links" aria-label="Navegação principal">
          <a class="${active === 'inicio' ? 'active' : ''}" href="index.html">Início</a>
          <a class="${active === 'categorias' ? 'active' : ''}" href="categorias.html">Categorias</a>
          <a class="${active === 'ao-vivo' ? 'active' : ''}" href="ao-vivo.html">Ao Vivo</a>
          <a class="${active === 'sobre' ? 'active' : ''}" href="sobre.html">Sobre</a>
        </nav>

        <div class="nav-actions">
          <a class="icon-link" title="Zy Coins" aria-label="Abrir loja de Zy Coins" href="loja.html">◈</a>

          <div id="guest-nav" class="guest-nav">
            <a class="btn btn-ghost" href="login.html">Entrar</a>
            <a class="btn btn-primary" href="registro.html">Registrar</a>
          </div>

          <a id="profile-nav" class="btn btn-primary hidden" href="perfil.html">Perfil</a>
        </div>
      </div>
    </header>
  `;
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
    element.innerHTML = `
    <footer class="site-footer site-footer-v2">
      <div class="container footer-shell">
        <div class="footer-top">
          <a class="brand footer-brand" href="index.html" aria-label="Zytrix - Início">
            <span class="brand-mark">Z</span>
            <span>Zytrix</span>
          </a>

          <nav class="footer-links" aria-label="Links institucionais">
            <a href="recursos.html">Recursos</a>
            <a href="faq.html">FAQ</a>
            <a href="sobre.html">Sobre</a>
          </nav>
        </div>

        <div class="footer-bottom">
          <span class="footer-copy">© 2026 Zytrix. Todos os direitos reservados.</span>

          <nav class="governance-links" aria-label="Políticas e segurança">
            <a href="/termos">Termos</a>
            <a href="/privacidade">Privacidade</a>
            <a href="/diretrizes-da-comunidade">Diretrizes da Comunidade</a>
            <a href="/denuncias-e-moderacao">Denúncias e Moderação</a>
            <a href="/conteudo-proibido">Conteúdo Proibido</a>
            <a href="/politicas">Central de políticas</a>
          </nav>
        </div>
      </div>
    </footer>
  `;
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
