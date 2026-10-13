# Auditoria Snyk — Zytrix Lives — 2026-10-13

## Escopo e resultado

Base: `main` em `c9123938119a743e5e4763b6d635cab01d1708d1` (PRs recentes #28–#30: imagens e contenção de leituras). Branch: `security/snyk-remediation-2026-10`. Sem alterações no banco, no serviço Neon Auth, em transações reais ou na produção. Implementação diretamente no Work, sem delegação.

Quatro ocorrências investigadas. Nenhuma exploração de uma aplicação Zytrix demonstrada; três comportamentos de componentes reproduzidos localmente (duas versões originais do Zod e Deepmerge). Uma ocorrência tratada pela atualização oficial do SDK; duas não aplicáveis aos caminhos locais examinados; uma pendente de confirmação do fornecedor para o serviço hospedado. Isso não significa ausência de outros riscos.

| Ocorrência / CVE | Versão antes → depois | Risco efetivo e ação | Resultado no escopo examinado |
|---|---|---|---|
| A / CVE-2026-109346 | Better Auth 1.6.23 → 1.7.6 | SDK oficial Neon 0.5.0-beta → 0.6.0-beta; nenhum override ou RC. Fluxo de dispositivos não anunciado/exposto no serviço observado. | MITIGADO no pacote local. NÃO APLICÁVEL ao fluxo público observado hoje; versão interna do fornecedor INCONCLUSIVA. |
| B / CVE-2023-54404 | Zod 4.3.6 → 4.5.4 (Neon) | Baixo nos endpoints próprios, que não usam Zod; limites JSON antecipados. O Zod novo permanece afetado. | MITIGADO o processamento excessivo dos endpoints próprios; INCONCLUSIVO no Neon hospedado. Alerta não resolvido por atualização. |
| C / CVE-2023-54404 | Zod 4.1.11 → 4.1.11 (Blob/CLI config) | Baixo: schemas de configuração local, sem arrays HTTP encaminhados pelo Zytrix. | NÃO APLICÁVEL ao caminho HTTP examinado; pacote continua afetado. |
| D / CVE-2026-93753 | Deepmerge 4.3.1 → 4.3.1 | Baixo: UI/renderização de e-mails instalada, sem execução nos endpoints próprios ou no bundle publicado. | NÃO APLICÁVEL ao caminho local atual; comportamento vulnerável do componente CONFIRMADO em fixture. |

Os estados são específicos dessas fronteiras. Não classificamos alertas como falsos positivos. A investigação do serviço hospedado não se confunde com a inspeção do SDK.

## SPEC e arquitetura

Preservar autenticação gerenciada, banco, APIs e pagamentos. Manter limites anteriores de 16 KiB em platform e 4 KiB em checkout, mas aplicá-los ao stream antes do parsing. Rejeitar estruturas sem utilidade para os contratos existentes, com erro único e seguro. Não criar rate limiter local que aparente funcionar entre instâncias serverless. Não substituir bibliotecas transitivas sem suporte.

Aceite local: requisições excessivas com/sem Content-Length são rejeitadas; JSON malformado, UTF-8 inválido, arrays grandes e chaves de protótipo não alcançam autenticação/DB/Stripe; lote legítimo continua aceito; contrato do SDK preserva sessão revogável e métodos de login, cadastro, Google, reset e OTP; build funcional.

## A — Better Auth

- Caminho original: `@neondatabase/auth@0.5.0-beta → better-auth@1.6.23`, com referências adicionais pela UI. Lockfile original: `node_modules/better-auth`. Após atualização existem cópias 1.7.6 sob `@neondatabase/auth` e `@neondatabase/auth-ui`.
- O projeto importa `createAuthClient` e `BetterAuthVanillaAdapter` em `scripts/neon-managed-client.mjs`. O servidor próprio valida JWT/JWKS e sessão ativa usando `server/neon/auth.mjs`; não instancia `betterAuth()` nem `deviceAuthorization()`.
- Pré-requisito do advisory: servidor com plugin de dispositivos, pedido de autorização controlável por atacante e aprovação de usuário autenticado sem apresentação adequada do cliente/escopos. Impacto possível: consentimento inadequado e acesso no alcance concedido; não foi reproduzido no Zytrix.
- Configuração Neon lida pelo conector: projeto `soft-water-98807259`, branch `br-dawn-flower-b62xw0gm` / `clean-neon-20261007`, que corresponde ao hostname publicado. A branch Neon chamada `production` não tem Auth habilitado e não é o alvo atual do site.
- Leitura anônima e sem mutação de `/neondb/auth/open-api/generate-schema`: HTTP 200, 79 paths; nenhum contendo `device`. `GET /neondb/auth/device`: HTTP 404. Nenhum código de dispositivo foi criado; nenhuma aprovação/sessão foi fabricada.
- A configuração redigida expõe e-mail/senha, Google e SMTP, mas não versão do servidor nem inventário completo de plugins. A documentação atual do Neon lista plugins gerenciados sem Device Authorization. Juntos, schema/404/documentação sustentam ausência de fluxo exposto no ambiente observado, sem prova absoluta dos internos do fornecedor.
- `npm view @neondatabase/auth version dependencies --json` informou versão oficial 0.6.0-beta com Better Auth estável 1.7.6 e Zod 4.5.4. A implementação instalada de Better Auth 1.7.6 retorna `client_id` e `scope` ao dono autenticado do pedido em `dist/plugins/device-authorization/routes.mjs`.
- Metafile do build real: módulos de device authorization contribuíram **zero bytes** ao output. Um módulo client é enumerado como input, mas removido pelo tree-shaking; listar inputs isoladamente seria evidência incorreta de código servido.
- Residual: SDK Neon continua beta, como já era. Atualizar npm não atualiza o servidor gerenciado. Revalidar schema/rota após mudanças do fornecedor e solicitar confirmação de versão/controles internos ao Neon se esse fluxo passar a existir.

## B e C — Zod, separadamente

**B**: original `@neondatabase/auth@0.5.0-beta → zod@4.3.6`, em `node_modules/@neondatabase/auth/node_modules/zod`. Também havia Zod 4.6.5 em caminhos Better Auth/UI. Após atualização oficial, Zod 4.5.4 está deduplicado na raiz. A mudança de versão não é uma correção desse CVE.

No SDK executado no navegador, o uso direto examinado valida a resposta de token anônimo (`token` string, `expires_at` number), recebida do fornecedor. O bundle contém Zod, mas não servidor Better Auth. Nenhum endpoint próprio importa Zod ou o SDK de Auth. Entradas recebidas diretamente pelo Neon não passam pela API Zytrix; limites desta PR não protegem o servidor Neon. Os schemas e rate limits internos do serviço não foram comprovados pelo conector. Risco de disponibilidade hospedada permanece INCONCLUSIVO.

**C**: `@vercel/blob@2.8.1 → @vercel/oidc@3.8.10 → @vercel/cli-config@0.3.1 → zod@4.1.11`, em `node_modules/@vercel/cli-config/node_modules/zod`. Blob 2.8.1 continuava a versão oficial mais recente consultada. O uso examinado é parsing de configuração/credenciais locais em cli-config. Imagens próprias usam bytes decodificados, chave gerada no servidor e opções definidas no código; não passam arrays JSON do visitante aos schemas de CLI.

Importante: Blob pode tentar OIDC antes do token no ambiente; não afirmamos que cli-config nunca executa. Mesmo nesse caso, a entrada de configuração é local, não o payload HTTP. Comprometimento do filesystem/credenciais seria outro modelo de ameaça. Não alteramos OIDC nem impomos override transitivo.

Advisory atual: sem versão Zod corrigida. Pré-requisito: array de entrada não confiável submetido a validação que acumula issues. Impacto demonstrado: amplificação do número de erros, potencial indisponibilidade por memória/CPU; não demonstramos vazamento ou alteração de dados.

Reprodução limitada: arrays de **256** valores inválidos com schema `z.array(z.number()).max(40)` produziram **257 issues**, inclusive na versão original 4.3.6 extraída do tarball oficial em diretório temporário, na 4.1.11 instalada e na 4.5.4 nova. Isso mostra que `.max()` isolado não interrompe validação dos elementos. Não foi tentado crash/OOM. Script repetível: `node --max-old-space-size=128 scripts/security-reproduce.mjs` (versões atualmente instaladas).

## D — Deepmerge

Caminho completo: `@neondatabase/auth@0.5.0-beta → @neondatabase/auth-ui@0.3.0-beta → @daveyplate/better-auth-ui@3.4.0 → @react-email/components@1.0.12 → @react-email/render@2.0.6 → html-to-text@9.0.5 → deepmerge@4.3.1`. Após atualização, os dois primeiros pacotes são 0.6.0-beta e 0.4.0-beta; o trecho final permanece.

`html-to-text/lib/html-to-text.mjs` usa merge ao compilar opções e agrupar seletores. A entrada relevante são objetos de opções/seletores, não simplesmente texto de e-mail. Zytrix não importa renderer/UI/html-to-text no servidor, não usa templates de e-mail locais e não encaminha opções do usuário para essas operações. E-mails são enviados pelo Neon gerenciado. Metafile do output do cliente confirma ausência de Deepmerge, html-to-text e auth-ui. A dependência não foi removida porque pertence ao SDK oficial.

Fixture: `merge({}, payload)` não herdou a flag; `merge(Object.create(null), JSON.parse('{"__proto__":{"fixtureAdmin":true}}'))` herdou `fixtureAdmin`, sem propriedade própria e sem alterar `Object.prototype`. CONFIRMADO no componente, NÃO confirmado como bypass de autorização do Zytrix. Possível impacto de integridade exige consumidor que leia flags herdadas de um objeto mesclado e atacante que controle opções desse merge. Sem versão corrigida oficial segundo o advisory consultado. Não aplicamos freeze global, substituição ou patch transitivo.

## Endpoints e controles

| Endpoint | Entrada e controles atuais | Mudança / limite residual |
|---|---|---|
| POST `/api/v1/platform` | JSON; verificação JWT + sessão no banco; permissões por ação; transações; SQL parametrizado; 16 KiB | Parser automático desativado; leitura limitada pré-parse, 413 no excesso; array <=40, profundidade <=8, chaves por objeto <=64, nós <=2048; chaves especiais rejeitadas antes de auth/DB. |
| POST `/api/v1/checkout` | JSON; sandbox explícito; proibido em produção; identidade; preços derivados e idempotência; 4 KiB | Mesmo reader pré-parse; arrays não vazios rejeitados; profundidade <=2, chaves <=8; validação antes de instanciar Stripe. |
| POST `/api/v1/stripe-webhook` | Bytes originais <=256 KiB; assinatura Stripe antes do banco; eventos sandbox; replay/ledger | Preservado, sem parsing antecipado que altere assinatura. |
| POST/DELETE `/api/v1/images` | Upload binário; bodyParser false; limite 3 MiB; identidade verificada; propriedade no banco; MIME/decode/pixels/metadata; <=10 assets/h | Preservado; sem arrays HTTP para Zod. O limite de assets não equivale a limite global de requisições. |
| GET `/api/v1/events` | Auth, liveId <=128, sessão revalidada; limites SSE por processo/usuário | Preservado; controle local SSE não é limite distribuído entre todas as instâncias. |
| GET `/api/v1/lives`, `/api/home-lives` | Catálogo público fixo, até40 rows, cache curto | Sem payload fornecido ao Zod. |
| GET `/api/v1/config`, `/api/v1/health` | Configuração pública mínima; health sem detalhes de erro | Sem schemas de arrays externos. |
| GET `/api/v1/images-cleanup` | Segredo cron comparado em tempo constante; chaves de imagem geradas no servidor | Não executado no site público nesta auditoria. |
| Neon Auth no hostname externo | E-mail/senha, Google, OTP, sessões gerenciadas | Não atravessa reader Zytrix. Controles internos, versão e proteção contra bursts dependem do fornecedor. |

Limites estruturais derivam dos contratos existentes: lote máximo30, blockedWords máximo40, path máximo6. Fixture de lote30 com40 palavras por operação passou dentro dos16 KiB. Validações de domínio originais permanecem. Rate limits por ação de chat/report/reação e SSE já existem; não foram certificados como distribuídos/atômicos em todos os casos. Proteções Vercel de infraestrutura não foram usadas como prova de proteção contra este CVE. Esta PR limita custo **por requisição**, não elimina DoS por volume de requisições.

## Testes e evidências

- Runtime Node 24.19.0; Vercel projeto `zytrix-web` em Node24.x, domínio `zytrix-lives.vercel.app` confirmado pelo conector.
- Baseline: npm ci aprovado; 74 testes totais, 71 aprovados, 3 ignorados, 0 falhas.
- Após mudanças: npm ci aprovado; lint aprovado; typecheck aprovado; npm test: 81 totais, **78 aprovados, 3 ignorados, 0 falhas**; build aprovado, apenas assets de navegador copiados para public.
- Testes ignorados: `channel-postgres`, `images-postgres`, `read-context-postgres`; faltaram suas configurações de banco descartável/fixtures. Não foram apontados para o banco principal para transformar SKIP em PASS.
- Novos testes: stream fragmentado/excesso sem Content-Length, overflow declarado antes de consumo, Unicode, JSON/UTF-8 inválidos, arrays/profundidade/chaves/nós, escapes de `__proto__`, preservação de lote legítimo, rejeição HTTP antes de DB/Stripe; SDK real com fetch local simulado para e-mail, cadastro, Google, reset, OTP, logout, sessão com header JWT e erro503.
- Primeiro teste de falha do SDK esperava resultado `{error}`; a versão oficial lança erro normalizado. Corrigida a expectativa para rejeição503, sem mudar o SDK/aplicação. A suíte de tratamento de falha/identidade existente passou.
- Auth real Google, entrega OTP/SMTP, recuperação por e-mail e login de uma conta real no preview **não foram testados**. Testes de contratos/falha não substituem teste E2E com o fornecedor.
- Imagens: testes locais de decode/otimização/metadata/MIME e rejeição anônima passaram. Upload real Blob e concorrência com Postgres permanecem sem E2E nesta execução.
- `npm audit --json`: 0 advisories antes e depois. A base npm não reproduz estes alertas Snyk; isso não significa zero vulnerabilidades. Sem acesso ao projeto Snyk/token nesta sessão, comparação de scan Snyk antes/depois pendente.
- `npm ls better-auth zod deepmerge` retorna ELSPROBLEMS antes/depois por peers transitivos da UI: api-key1.7.7 exige Better Auth^1.7.7 e better-call1.4.0, enquanto UI usa versões diferentes. npm ci/build funcionam e UI/API-key não entram no bundle. Não ocultamos esses avisos com legacy-peer-deps ou overrides. Confirmação/correção oficial desse conjunto é acompanhamento para Neon.

Commits de implementação: `2fc8ce7` (SDK + contratos), `ab864ee` (reader + testes + reprodução). Arquivos: package.json/lock; api/v1/platform.js, checkout.js; server/neon/request-body.mjs; tests/managed-client.test.mjs, request-body.test.mjs, platform-service.test.mjs; scripts/security-reproduce.mjs; este relatório.

## /DEVIL

1. Comportamentos vulneráveis Zod/Deepmerge continuam instalados; não há exploração de app demonstrada. Neon hospedado precisa de confirmação interna.
2. Controles novos executam no servidor; nenhuma mitigação depende apenas do navegador.
3. JSON próprio tem os mesmos budgets, agora antes do parse; Stripe256 KiB e imagem3 MiB mantêm seus formatos/limites. Volume agregado não está resolvido.
4. SDK oficial passou contratos/tipos/build; auth real e peers UI ainda são limitações documentadas.
5. Não alteramos JWT, sessão ativa, SQL de autorização nem identidades; testes de anonimato e usuário comum passaram.
6. Nenhum ignore Snyk, supressão, exclusão de lockfile ou override adicionado. Zod/Deepmerge permanecem visíveis.
7. Preços, ledger, idempotência e assinatura inalterados; checkout passa a rejeitar payload excessivo com413. Pagamentos reais não foram tocados.
8. Fixtures verificam bloqueio efetivo e aceitação de contrato legítimo; contratos simulados não provam OAuth externo.
9. Reader não mantém estado global: seus limites valem independentemente sob concorrência. Rate limits de volume/SSE existentes não são garantia global; testes reais Postgres não executados.
10. Mais resistente: menos código afetado instalado para A e JSON rejeitado antes de parse/serviços para entradas excessivas ou com chaves especiais. Não é certificado de segurança total.

## Preview, validação e rollback

PR/preview e smoke serão registrados após o push desta branch. Não fazer merge automático nem promover preview. Gate de release: conferir Snyk atualizado, validar login/Google/OTP/reset com conta de teste em ambiente isolado, confirmar peers do SDK com Neon e executar integração PostgreSQL configurada. Não modificar um banco ativo para preparar testes sem isolamento.

Rollback: antes de merge, fechar PR é suficiente; sem migração SQL ou alteração de Auth hospedado. Se aprovado e integrado, reverter os commits desta PR (incluindo package.json e lockfile juntos), executar npm ci/lint/typecheck/test/build e publicar somente com autorização. Reverter o reader restaura parsing tardio e reabre a redução de resistência documentada. Não reverter migrações de outros PRs.

## Fontes consultadas

- https://security.snyk.io/vuln/SNYK-JS-ZOD-20510278
- https://github.com/colinhacks/zod/issues/1872
- https://github.com/colinhacks/zod/pull/6475
- https://security.snyk.io/vuln/SNYK-JS-DEEPMERGE-19964053
- https://github.com/TehShrike/deepmerge/issues/273
- https://neon.com/docs/auth/guides/plugins
- https://github.com/better-auth/better-auth/releases/tag/v1.7.6
- https://github.com/better-auth/better-auth/blob/main/packages/oauth-provider/CHANGELOG.md
- npm registry: metadados oficiais @neondatabase/auth0.6.0-beta, @vercel/blob2.8.1; tarball Zod4.3.6 e código dos pacotes instalados verificado.

Advisory Better Auth Snyk, NVD e CVE.org específicos não ficaram acessíveis pelo navegador de pesquisa nesta execução; o identificador/descrição originalmente fornecidos foram preservados como entrada, confrontados com código e changelog upstream. Não inventamos retorno desses sites nem confirmação do fornecedor.
