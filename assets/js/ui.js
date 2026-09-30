import { auth, onAuthStateChanged } from './firebase.js';
import { parseStreamingSource, streamingPlatformLabel } from './streaming.js';

export function header(active = '') {
    const element = document.querySelector('[data-header]');
    if (!element) return;

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
        if (!guest || !profile) return;

        if (user) {
            guest.classList.add('hidden');
            profile.classList.remove('hidden');
        } else {
            guest.classList.remove('hidden');
            profile.classList.add('hidden');
        }
    });
}

function ensureFooterStyles() {
    if (document.querySelector('link[data-zytrix-footer-style]')) return;

    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'assets/css/footer.css';
    stylesheet.dataset.zytrixFooterStyle = 'true';
    document.head.append(stylesheet);
}

export function footer() {
    const element = document.querySelector('[data-footer]');
    if (!element) return;

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

export function liveCard(live) {
    const initial = (live.username || 'S').charAt(0).toUpperCase();
    const source = parseStreamingSource(live.playbackURL || '');
    const platform = source ? streamingPlatformLabel(source.platform) : '';

    return `
    <article class="card live-card" data-live-id="${escapeAttr(live.id)}">
      <div class="thumb">
        ${live.thumbnailURL
        ? `<img src="${escapeAttr(live.thumbnailURL)}" alt="Thumbnail de ${escapeAttr(live.username || 'streamer')}">`
        : '<div class="state">ZYTRIX</div>'}

        <span class="badge">● AO VIVO</span>

        ${source
        ? `<span class="platform-badge platform-${source.platform} card-platform">${escapeHtml(platform)}</span>`
        : ''}

        <span class="viewers">👁 ${Number(live.viewerCount || 0).toLocaleString('pt-BR')}</span>
        <span class="play">▶</span>
      </div>

      <div class="live-meta">
        ${live.photoURL
        ? `<img class="avatar" src="${escapeAttr(live.photoURL)}" alt="Foto de ${escapeAttr(live.username || 'streamer')}">`
        : `<span class="avatar">${escapeHtml(initial)}</span>`}

        <div>
          <div class="live-title">${escapeHtml(live.username || 'Streamer')}</div>
          <div class="live-sub">${escapeHtml(live.title || 'Transmissão ao vivo')}</div>
          <div class="live-cat">${escapeHtml(live.categoryId || '')}</div>
        </div>
      </div>
    </article>
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

export const categories = {
    Gaming: ['Ação / Aventura', 'RPG', 'FPS', 'Battle Royale', 'MOBA', 'Estratégia', 'Simulação', 'Corrida', 'Esportes', 'Sandbox', 'Terror', 'Indie', 'Mobile', 'Retro'],
    Música: ['Rock', 'Pop', 'Sertanejo', 'Eletrônica', 'Funk', 'Rap / Hip-Hop', 'MPB', 'Lo-fi', 'Instrumental', 'DJ Sets', 'Produção Musical', 'Karaokê'],
    'Just Chatting': ['Bate-Papo', 'Perguntas e Respostas', 'Histórias', 'Desafios', 'React', 'Debates', 'Comédia', 'Comunidade'],
    Criatividade: ['Desenho', 'Design', 'Fotografia', 'Edição', 'Animação', '3D', 'Artesanato', 'Escrita', 'Moda', 'Produção Criativa'],
    Esportes: ['Futebol', 'Basquete', 'Vôlei', 'Automobilismo', 'Lutas', 'Skate', 'Ciclismo', 'Corrida', 'Fitness', 'Esportes Radicais'],
    Tecnologia: ['Programação', 'Hardware', 'Inteligência Artificial', 'Cibersegurança', 'Linux e Open Source', 'Robótica', 'Ciência de Dados', 'Desenvolvimento de Jogos', 'Notícias Tech', 'DevOps'],
    Podcasts: ['Conversas', 'Entrevistas', 'Notícias', 'Entretenimento', 'Educação', 'Esportes', 'Tecnologia', 'Cultura'],
    IRL: ['Viagens', 'Eventos', 'Vida Cotidiana', 'Exploração', 'Bastidores', 'Compras', 'Natureza', 'Gastronomia'],
    Educação: ['Matemática', 'Física', 'Química', 'Biologia', 'História', 'Geografia', 'Idiomas', 'Vestibular e ENEM', 'Programação', 'Estudo ao Vivo'],
    Ciência: ['Astronomia', 'Espaço', 'Física', 'Biologia', 'Química', 'Meio Ambiente', 'Experimentos', 'Divulgação Científica'],
    Gastronomia: ['Culinária', 'Receitas', 'Confeitaria', 'Churrasco', 'Comida de Rua', 'Reviews', 'Cozinha Internacional', 'Desafios Culinários'],
    'Filmes e Séries': ['Filmes', 'Séries', 'Análises', 'Teorias', 'Premiações', 'Bastidores', 'Trailers e Novidades'],
    'Anime e Cultura Pop': ['Anime', 'Mangá', 'Quadrinhos', 'Cosplay', 'Colecionáveis', 'Cultura Geek', 'Eventos'],
    Negócios: ['Empreendedorismo', 'Marketing', 'Finanças Pessoais', 'E-commerce', 'Carreira', 'Produtividade', 'Startups'],
    Lifestyle: ['Moda', 'Beleza', 'Fitness', 'Bem-estar', 'Casa e Decoração', 'Pets', 'Rotina'],
    'Jogos de Mesa': ['RPG de Mesa', 'Board Games', 'Card Games', 'Xadrez', 'D&D', 'Miniaturas']
};

export const icons = {
    Gaming: '🎮',
    Música: '🎵',
    'Just Chatting': '🎙️',
    Criatividade: '🎨',
    Esportes: '⚽',
    Tecnologia: '💻',
    Podcasts: '🎧',
    IRL: '📹',
    Educação: '📚',
    Ciência: '🔬',
    Gastronomia: '🍳',
    'Filmes e Séries': '🎬',
    'Anime e Cultura Pop': '✨',
    Negócios: '📈',
    Lifestyle: '🌿',
    'Jogos de Mesa': '🎲'
};
