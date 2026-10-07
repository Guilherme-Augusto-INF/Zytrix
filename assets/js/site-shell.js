// Shared by the static build and the browser fallback. No auth dependency:
// the public layout must exist before session discovery starts.
const primaryLinks = [
    ['inicio', 'index.html', 'Início'], ['categorias', 'categorias.html', 'Categorias'],
    ['ao-vivo', 'ao-vivo.html', 'Ao Vivo'], ['explore', 'explorar.html', 'Explorar'],
    ['clips', 'clips.html', 'Clipes'], ['sobre', 'sobre.html', 'Sobre']
];
const policyLinks = [
    ['termos', 'Termos'], ['privacidade', 'Privacidade'],
    ['diretrizes-da-comunidade', 'Diretrizes da Comunidade'],
    ['denuncias-e-moderacao', 'Denúncias e Moderação'],
    ['conteudo-proibido', 'Conteúdo Proibido'], ['politicas', 'Central de políticas']
];
const brand = '<a class="brand" href="index.html" aria-label="Zytrix - Início"><span class="brand-mark">Z</span><span>Zytrix</span></a>';
export function headerMarkup(active = '') {
    return `<header class="site-header"><div class="container nav">${brand}
      <nav class="nav-links" aria-label="Navegação principal">${primaryLinks.map(([key, href, label]) => `<a href="${href}"${key === active ? ' class="active" aria-current="page"' : ''}${['explore', 'clips'].includes(key) ? ` data-platform-nav="${key}"` : ''}>${label}</a>`).join('')}</nav>
      <div class="nav-actions"><a class="icon-link" title="Zy Coins" aria-label="Abrir loja de Zy Coins" href="loja.html">◈</a>
        <div id="guest-nav" class="guest-nav"><a class="btn btn-ghost" href="login.html">Entrar</a><a class="btn btn-primary" href="registro.html">Registrar</a></div>
        <a id="profile-nav" class="btn btn-primary hidden" href="perfil.html">Perfil</a>
      </div></div></header>`;
}
export function footerMarkup() {
    const links = [['recursos', 'Recursos'], ['faq', 'FAQ'], ['sobre', 'Sobre'], ['explorar', 'Explorar'], ['clips', 'Clipes'], ['status', 'Status'], ['roadmap', 'Roadmap']];
    return `<footer class="site-footer site-footer-v2"><div class="container footer-shell">
      <div class="footer-top">${brand.replace('class="brand"', 'class="brand footer-brand"')}<nav class="footer-links" aria-label="Links institucionais">${links.map(([slug, label]) => `<a href="${slug}.html"${['explorar', 'clips', 'status', 'roadmap'].includes(slug) ? ` data-platform-footer="${slug === 'explorar' ? 'explore' : slug}"` : ''}>${label}</a>`).join('')}</nav></div>
      <div class="footer-bottom"><span class="footer-copy">© 2026 Zytrix. Todos os direitos reservados.</span><nav class="governance-links" aria-label="Políticas e segurança">${policyLinks.map(([slug, label]) => `<a href="/${slug}">${label}</a>`).join('')}</nav></div>
    </div></footer>`;
}
