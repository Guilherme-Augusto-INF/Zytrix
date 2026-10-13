# Perfis públicos com URLs amigáveis — 13/10/2026

## Resultado e arquitetura

Branch `feat/public-profile-friendly-urls`, baseada na main `1baeb9d` (perfis públicos já incorporados pelo PR31). PR32 de segurança permanece separado: não importamos sua atualização de dependências nem sobrescrevemos seus controles.

- `/@username` resolve o username case-insensitive no servidor e reutiliza a página `usuario.html` e a projeção pública existente.
- `/usuario.html?uid=UUID` e `/usuario?uid=UUID` consultam a mesma conta pelo UUID e devolvem **307** para `/@username`, com `Cache-Control: no-store`. Redirect temporário evita guardar para sempre o username de uma conta que pode mudar.
- Contas inexistentes, excluídas, desativadas ou banidas:404 com mensagem uniforme; banco/migração indisponível:503; bursts:429. GET e HEAD suportados. Acesso direto/refresh não dependem de navigation state.
- Vercel rewrites: `/@:username → /api/public-profile/:username`; legados → `/api/public-profile`. O identificador amigável é extraído do path, não de parâmetros query sobrescrevíveis. Parámetros adicionais em URL amigável são removidos no redirect canônico; legados duplicados/inválidos são rejeitados.
- `usuario.html` não é copiado como asset estático: isso permite um redirect HTTP real. O arquivo original permanece como template e é incluído nas funções por `includeFiles`. CSS/JS continuam em `/assets`, sem catch-all que capture APIs ou arquivos.
- A função devolve título, description, canonical e Open Graph no HTML inicial, além de bootstrap JSON com dados públicos. Mantida a política `noindex,follow`; não adicionamos perfis a sitemap nem dados privados por SEO.
- UUIDs continuam em respostas/projeções públicas quando necessários para comparar o dono autenticado, seguir e denunciar. Não entram em novos links de perfil. Chaves primárias, Auth, chat, moderação, lives, wallet e ledger permanecem UUID; username não concede autorização.

## Investigação do banco real

Consultado o banco usado pelo site: projeto `soft-water-98807259`, branch `br-dawn-flower-b62xw0gm` / `clean-neon-20261007`, sem escrita nessa branch.

- `profiles.username_key` é coluna generated `lower(btrim(username))`, com constraint UNIQUE `profiles_username_key_key`.
- CHECKs: username sem espaços nas bordas, 2–30 caracteres, regex ASCII `[A-Za-z0-9_.-]`. Nenhum username inválido ou chave duplicada na amostra atual (1 perfil).
- Não havia histórico confiável de usernames nem trigger que reservasse nomes abandonados. `private.reserved_usernames` tinha seis nomes de sistema/marca e já era consultada pelos fluxos de cadastro, recuperação e atualização.
- A regra de alteração de7 dias segue no servidor; esta PR não troca a identidade nem o cooldown. Caracteres Unicode continuam rejeitados, sem aliases NFKC ou transliteração que introduzam colisões.

## Migração006 — nomes antigos

`database/neon/006_public_username_routes.sql` instala o trigger `profiles_guard_public_username` para INSERT, UPDATE de username e DELETE. Reutiliza a tabela de reservas existente, sem inventar histórico prévio ou redirects de nomes antigos.

- Renomear ou remover perfil reserva a chave anterior, em transação, com motivo público genérico sem dados privados do Auth.
- Reserva é permanente e também impede que o dono original reutilize o nome antigo. Tradeoff deliberado: um link previamente compartilhado nunca pode ser apropriado por outra conta. Nomes anteriores retornam404; só o link legado por UUID segue a mesma identidade até o username atual.
- Mudança apenas de maiúsculas/minúsculas não abandona a chave. UNIQUE continua impedindo duas contas com o mesmo username normalizado.
- Advisory locks por namespace/chave, ordenados, cobrem tanto quem abandona quanto quem tenta adquirir um nome. O teste de reserva acontece **após** o lock: uma requisição não passa pelo teste antes de aguardar a troca de outro usuário.
- Trigger usa SECURITY DEFINER com search_path fixo `pg_catalog`, referências qualificadas e EXECUTE revogado de PUBLIC; não há SQL dinâmico, permissões novas ao runtime ou escrita pela API anônima.
- As novas rotas falham com503 se o trigger não estiver habilitado. Não publicar código de rota sem aplicar a migração na branch correta. Outros leitores por UUID permanecem disponíveis.

Aplicada e testada **somente** na branch isolada `br-solitary-math-b65n1owo` / `preview-friendly-profile-urls-20261013`, derivada do banco atual. Expiração:20/10/2026 às18:00 UTC. Banco/Neon Auth usados em produção não foram modificados.

## Navegação

Helper único `publicProfileUrl(username)` gera `/@` + chave minúscula validada. Atualizados chat (nome/avatar), página live, cards compartilhados de streamer, rede pública (seguidores/seguindo), lista de canais seguidos no próprio perfil e notificações de seguidores/apoio/canais.

Cards/listas de canal recebem agora o username público do dono pelo join de profiles. O nome de exibição do canal não é usado para resolver a identidade. `profile.search` já devolvia usernames; não existia uma tela independente de busca de contas para reescrever. Busca de lives reutiliza os cards atualizados. Nenhum consumidor atual gera `/usuario.html?uid=`.

Botões/menus de denúncia e ações de seguir/moderação/financeiras não foram reimplementados. URLs desses fluxos e seus IDs internos continuam no contrato existente. Links já renderizados antes de uma troca de username podem ficar404 até os dados serem atualizados; não serão enviados a outra conta.

## Testes executados

- `npm ci`:PASS (271 pacotes); peers/deprecações transitivos já existentes permanecem visíveis. Nenhuma nova dependência.
- `npm run lint`:PASS; `npm run typecheck`:PASS; `npm test`:**95 totais,91 PASS,4 SKIP,0 FAIL**; `npm run build`:PASS.
- Novos testes unitários: normalização ASCII/case, `_`/`-`/`.`, UUID não aceito pelo gerador de URL, caracteres Unicode/inválidos, escapes, slash/traversal, parâmetros duplicados, SQL parametrizado, filtragem de disponibilidade, fail-closed sem migração, XSS em HTML/JSON, canonical/OG, GET/redirect404/503/429, assets e APIs sem catch-all.
- Sessão/seguidores: testes existentes de usuário conectado, troca de conta e descarte de resultado antigo continuaram PASS; não houve troca no contrato de autorização.
- Smoke HTTP **local com fixtures**:GET amigável200 com canonical; legado307; maiúsculas307; query que tenta trocar username307 para o perfil correto. Todas respostas no-store.
- Teste Node/pg novo contra a branch isolada foi tentado com o papel `zytrix_runtime`, mas falhou na conexão por `EAI_AGAIN`/DNS desse ambiente. Não foi marcado PASS. Na suíte sem configuração, fica SKIP; os outros3 SKIPs são integrações PostgreSQL preexistentes.
- Pelo conector Neon, a migração e assertions SQL reais passaram: chave antiga reservada, tentativa de apropriação rejeitada, colisão case-insensitive rejeitada, marca `admin` rejeitada, filtro de conta desativada não retorna perfil.
- Duas transações reais concorrentes disputaram `route_race_test2`/`ROUTE_RACE_TEST2`: uma venceu; outra recebeu a constraint UNIQUE. Em outra corrida, uma conta abandonou esse nome e a segunda tentou adquiri-lo enquanto a primeira aguardava1s: a segunda recebeu `username unavailable`, provando o controle de reserva após lock. UUIDs de ambas permaneceram intactos.
- Uma primeira tentativa paralela teve401 do conector e não foi usada como evidência de concorrência; a repetição controlada acima passou. Tentativa de SET ROLE pelo usuário do conector foi negada; os testes SQL do conector executaram com o papel administrativo dele, não certificam privilégios do runtime. Teste automatizado runtime está versionado para execução onde houver conectividade.
- Template mantém viewport responsivo e CSS existente, e os links gerados usam paths absolutos. Interação visual em dispositivo móvel e OAuth/login real no preview não foram certificados nesta etapa.

## Isolamento do preview

Variáveis Vercel específicas apenas desta branch, target preview: DATABASE_URL do runtime da branch isolada e ZYTRIX_NEON_AUTH_URL do Auth isolado. Segredos não estão no git/HTML/relatório.

O verificador atual de Auth fixa o issuer do serviço usado pelo site. Mantivemos esse pin; com URL de Auth isolada, autenticação no preview falha fechada. As páginas públicas SSR são independentes de login. Não afrouxamos issuer/CSP para testar esta feature, nem apontamos novos logins do preview para Auth de produção. E2E autenticado no preview fica como gate; a autorização existente passou nos testes locais.

PR, URL e resultado do build/smoke hospedado serão registrados após a publicação da branch. Nenhum merge ou deploy em produção está autorizado por esta entrega.

## /DEVIL — riscos e resposta

1. Slugs não controlam acesso: queries usam o filtro público; escritas continuam identidade/sessão UUID verificadas no servidor.
2. Inputs de username não são interpolados em SQL; query usa `$1` sobre coluna UNIQUE indexada. Seleção uid/username é exclusiva.
3. Nenhum hostname/next fornecido pelo usuário entra em Location. Destino é path local validado e normalizado.
4. XSS: escape compartilhado em title/meta/texto; JSON inerte escapa `<`, `>`, `&` e separadores Unicode. Nenhum e-mail, token ou saldo é incluído na projeção pública.
5. Sem cache de resposta/redirect: evita guardar username antigo, conta desativada ou dados de sessão. Rotas públicas não autenticam visitante nem geram sessão.
6. Retired names não viram aliases; migração impede novos donos e conflitos de case sob concorrência. Nomes anteriores à instalação não podem ser inferidos ou recuperados com segurança.
7. Limiter GET compartilha o limiter público existente:120 leituras/min por origem/processo, memória limitada; **não é quota global distribuída**. WAF distribuído é acompanhamento, não uma garantia criada nesta PR.
8. Parser de path decodifica uma vez e aceita só o contrato ASCII; slashes, query delimiters, `%` remanescente, Unicode e paths adicionais são rejeitados. Não usamos `history.replaceState()`.
9. O template SSR exige empacotamento `includeFiles`, testado localmente e sujeito ao build remoto. Assets e APIs existentes não foram reescritos genericamente.
10. Riscos de integração: PR32 também altera platform.js; nossa PR não toca esse arquivo nem package-lock. Mudanças concorrentes no chat devem preservar o helper por username e os novos menus. Atualizar branch/revalidar se main mudar antes de merge.

## Release e rollback

Antes de produção: aplicar006 no banco usado pelo site com autorização de release, conferir trigger habilitado, executar teste runtime/PostgreSQL e validar páginas novas/legadas, login/follow e mobile no ambiente correto. Revalidar base do PR para mudanças concorrentes. Não basta fazer merge para garantir migração.

Rollback do site: reverter os commits desta PR, voltar ao build anterior e manter reservas/trigger para evitar apropriação de links já compartilhados. Nenhum dado financeiro ou identidade foi migrado. Não apagar reservas automaticamente; remover proteção reabre o risco. A branch de teste expira; novos previews depois de20/10 precisam renovar isolamento/variáveis.

## Arquivos

- `api/public-profile/[username].js`, `api/public-profile/index.js`; `server/neon/profile-page.mjs`, `public-profiles.mjs`, `modules.mjs`.
- `database/neon/006_public_username_routes.sql`; `vercel.json`; `scripts/build-site.mjs`, `staging-preview.mjs`.
- `assets/js/profile-url.js`, `html-escape.js`, `ui.js`, `public-profile.js`, `live.js`, `profile-social.js`, `notificacoes.js`, `notifications-plus.js`.
- `tests/friendly-profile-routes.test.mjs`, `friendly-profile-postgres.test.mjs`, `public-profiles.test.mjs`, `public-profile-session.test.mjs`; este relatório.

Referências de roteamento consultadas: https://vercel.com/docs/routing/rewrites e https://vercel.com/docs/project-configuration/vercel-json . Evidências de unicidade vêm do catálogo do banco real, não de suposição baseada no código.
