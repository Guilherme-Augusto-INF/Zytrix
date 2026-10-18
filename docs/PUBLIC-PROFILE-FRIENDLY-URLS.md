# Perfis públicos com URLs amigáveis — 13/10/2026

## Revisão adicional — 18/10/2026

Esta seção prevalece sobre as evidências históricas abaixo. A main foi confirmada em `f19047213c716c78d2c8be8c2de12c5d1df28364`, com a PR #33 merged. A implantação existente desse SHA está READY na Vercel, target production; esta revisão não criou nem promoveu implantação de produção.

As duas branches incorporaram main. O conflito de platform na #32 foi resolvido mantendo o reader limitado antes de autenticação e os limites de leitura pública da main. Um conflito adicional entre fixtures de sessão das PRs foi eliminado com uma fixture comum. A combinação dos códigos foi validada em checkout detached temporário: lint, typecheck, build, AEO/GEO e 109 testes aprovados, 0 falhas, 4 integrações opt-in ignoradas nessa execução padrão. Nenhum merge de PR ou atualização da main foi feito.

### Evidências atuais

- Node 24.20.0 / npm 11.19.0 no Windows; npm ci concluído para main e ambas as branches, sem alterar configurações de instalação ou segredos.
- #32: lint, typecheck, build e AEO/GEO PASS; suíte padrão 103 testes, 100 PASS / 3 SKIP / 0 FAIL.
- #34: lint, typecheck, build e AEO/GEO PASS; suíte padrão 105 testes, 101 PASS / 4 SKIP / 0 FAIL.
- As integrações opt-in foram executadas separadamente: canal em `br-little-wildflower-b6n0uvub`, imagens em `br-rapid-queen-b6hc5x1h`, leituras restritas e perfis em `br-solitary-math-b65n1owo`. Driver pg com TLS validado, papel real `zytrix_runtime`. PASS para criação concorrente/rollback de canal, ownership, substituição/exclusão de imagens, referências derivadas, falha do storage simulado, cotas, leituras simultâneas, exclusividade de mutações e dados próprios. Blob real não foi acessado.
- #34: integração real PASS para resolução case-insensitive, nome aposentado indisponível inclusive para o dono anterior, disputa pelo mesmo nome e tentativa de tomar nome durante sua aposentadoria (espera antes do commit e rejeição 23505 depois), conta desativada, GET/HEAD e redirect legado. Exclusão de conta com trigger006 passou em transação com rollback; não houve exclusão persistente de conta.
- Migração006 reaplicada apenas dentro de transação descartável na branch isolada, com owner; DDL e locks válidos, security definer, search_path=pg_catalog e trigger habilitado confirmados, seguido de rollback. O runtime não pode inserir/apagar reservas nem executar diretamente a função de trigger; permissões por coluna em profiles preservadas. Não foi executada migração em banco ativo de produção.
- Navegador real: fixture do chat com 15 verificações PASS em 870px e 390px (foco, teclado, Escape/Tab/clique externo, instância única, rerender, sem HTML injetado e sem overflow). Perfil com PostgreSQL isolado: HTML inicial, hidratação anônima e consulta de seguidores PASS; layout em 390px/320px verificado. Viewports não certificam touch físico, player ou ações autenticadas.
- Main: lint/typecheck/build PASS; suíte Windows 95 testes, 90 PASS / 2 FAIL / 3 SKIP. As duas falhas eram extração de imports por regex que não aceitava CRLF na fixture de sessão; corrigidas e testadas nas duas PRs. Isso não foi ocultado como PASS da main.
- npm audit retornou zero advisories. Reproduções limitadas ainda mostram 257 issues Zod para 256 elementos e poisoning do objeto retornado pelo Deepmerge, sem alteração de Object.prototype. Zero no npm audit não certifica ausência desses alertas Snyk.

### Correções adicionais

#32 ganhou teste HTTP real de request chunked acima do limite, confirmando 413 sem reset do socket e preservando resposta segura. As fixtures de sessão e de navegador agora funcionam com CRLF e paths Windows.

#34 corrigiu interpretação de $&, $\`, $' e $$ nas substituições SSR: nome/bio agora são inseridos literalmente por callbacks, com escaping e round-trip de JSON cobertos por regressão. A exclusão passou a usar tombstone aleatório (96 bits), impedindo reserva antecipada de um nome determinístico para negar a exclusão; UUID interno permanece. A largura de 320px revelou texto escapando do cartão: username agora quebra, e conteúdo/botões se reorganizam abaixo de 400px.

### Dependências e bloqueios de prontidão

- Better Auth: SDK oficial Neon0.6.0-beta continua fixando Better Auth1.7.6. O advisory upstream GHSA-q84f-53jg-9ppm recomenda1.7.0+ para o plugin opt-in de device authorization. O upstream consultado diz “No known CVE”; o rótulo CVE-2026-109346 da investigação anterior não foi certificado por essa fonte. A versão do servidor gerenciado não é provada pela versão npm.
- Zod: atualização do advisory em18/10 indica correção em4.6.6+, confirmada no registry. O SDK Neon atual fixa4.5.4; cli-config fixa4.1.11. Nenhuma substituição fora dos contratos do fornecedor, override ou atualização transitiva forçada foi aplicada. Exige atualização compatível oficial ou decisão explícita de aceitação do risco residual; limites próprios não protegem requests diretos ao Auth hospedado.
- Deepmerge: advisory ainda informa ausência de versão corrigida. Mantida análise de alcance: não executado nos caminhos HTTP próprios nem no bundle vanilla examinado, mas ainda instalado transitivamente. Sem ignore/supressão.
- Peers transitivos da UI seguem inconsistentes em npm ls; não foram escondidos com legacy-peer-deps. A UI não é usada pelo aplicativo, mas a compatibilidade oficial do conjunto segue pendente.
- Preview #34 anterior, verificado pelo acesso autenticado do conector Vercel: perfil público200 e config503/neon_not_configured. Issuer pin e CSP continuam restritos ao Auth provisionado originalmente, bloqueando o Auth isolado. Não apontamos testes de login ao Auth ativo nem ampliamos allowlists para tornar testes verdes.
- Google OAuth, OTP/SMTP, reset e revogação de sessão reais em ambiente isolado, além de E2E autenticado e Blob real, continuam sem certificação. São necessários configuração Auth isolada aprovada, contas de teste e acesso ao e-mail/OAuth; contratos simulados não substituem esses testes.
- CI/Vercel/Snyk devem ser conferidos no SHA final de cada PR. SUCCESS Snyk não equivale a zero findings nem substitui inventário autenticado detalhado.

As PRs permanecem em rascunho até resolver esses bloqueios. Ordem recomendada quando aprovadas: #32, depois #34; executar006 somente como etapa de release separadamente autorizada. Rollback da #34 deve manter reservas/trigger; remover a proteção reabre apropriação de nomes aposentados.

Fontes reconsultadas: [Better Auth](https://github.com/better-auth/better-auth/security/advisories/GHSA-q84f-53jg-9ppm), [Zod/Snyk](https://security.snyk.io/vuln/SNYK-JS-ZOD-20510278), [Deepmerge/Snyk](https://security.snyk.io/vuln/SNYK-JS-DEEPMERGE-19964053).

## Evidências históricas da revisão anterior


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
- `npm run lint`:PASS; `npm run typecheck`:PASS; `npm test`:**96 totais,92 PASS,4 SKIP,0 FAIL**; `npm run build`:PASS.
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

PR em rascunho: https://github.com/Guilherme-Augusto-INF/Zytrix/pull/34 . Commits de código: `fffae4e` (resolver/migração), `90efa46` (SSR/navegação), `18f60b5` (testes), `d01285e` (proteção do preview). Tree remota conferida contra a implementação testada localmente.

Preview do código final: https://zytrix-lydrq3jl7-guilhermeaugusto2525-1431.vercel.app/@route_release_test3 — deployment dpl_3e8y65K62KkFggkybCZSFxULcCPW, commit `d01285ee3762b2ca6524ce8ef028f45e18a9bb66`, READY, região gru1, target preview. Vercel e check Snyk do PR:SUCCESS para esse commit; Snyk SUCCESS não certifica ausência de vulnerabilidades preexistentes.

Smoke hospedado pelo conector autenticado Vercel: rota amigável200, HTML com título/canonical/OG/bootstrap público e no-store; refresh/repetição200; nomes inexistentes/aposentados404; conta fixture temporariamente desativada404 por nome e UUID; UUID legado duplicado404; slash codificado404; assets JS/CSS200 (CSS responsivo presente); API lives200. URLs legadas e maiúsculas terminaram na página canônica200 após redirects seguidos pelo conector;307 inicial foi comprovado nos testes HTTP locais, sem presumir que o status200 final é o status do primeiro salto.

O primeiro preview revelou um self-redirect na canonicalização do parâmetro de compartilhamento de proteção Vercel. Corrigido: `_vercel_share` e captura de rewrite que corresponde ao path não alteram a identidade e não disparam loop. Query de username diferente continua sem trocar o perfil. Novo teste de regressão passou, e o preview final devolveu200 no path amigável. Nenhum controle de proteção Vercel foi desativado.

API config503 no preview confirma o pin Auth fail-closed. Leitura SSR real executou com o runtime da branch isolada; escritas runtime/Auth E2E não foram certificadas. A simulação `git merge-tree` com o PR33 (menu de denúncias) concluiu sem conflitos nas versões examinadas; não incorporamos esse PR nem alteramos seus arquivos adicionais. Nenhum merge ou deploy em produção está autorizado por esta entrega.

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
