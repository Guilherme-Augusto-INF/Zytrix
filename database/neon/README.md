# Zytrix → Neon PostgreSQL — migração do banco (ainda NÃO concluída)

## Atualização verificada — staging

A carga do snapshot foi concluída exclusivamente na branch Neon staging:
328 registros em 17 tabelas, 52 tabelas de esquema, reconciliação de contagens,
campos importados e saldos PASS. Órfãos e alertas sem expiração foram preservados
em quarentena local; as alterações de username foram autorizadas pelo usuário.
O histórico abaixo registra o diagnóstico anterior à remediação, não o estado atual.

A migração da **aplicação** ainda está em andamento. A API autenticada inicial,
os testes de permissões e a página local isolada estão descritos em
[APPLICATION-MIGRATION.md](APPLICATION-MIGRATION.md). Os módulos originais ainda
não foram conectados globalmente ao novo backend. Não desativar Firestore nem
promover este trabalho para produção.

O importador agora valida o endpoint exato do staging, usa `--dry-run` (rollback)
por padrão e exige `--commit-staging` para gravar. Prefira o caminho de arquivo
privado em `NEON_DATABASE_URL_FILE`; nunca cole uma URL com senha no terminal
como comando, no chat ou no Git. O helper `save-staging-connection.mjs` fornece
entrada oculta para salvar a URL somente na pasta privada local.

## Ambiente verificado
Produção: `zytrix-lives.vercel.app` corresponde ao projeto Vercel `zytrix-web`, integrado ao repositório **Guilherme-Augusto-INF/Zytrix**, branch `main`. O repositório `Zytrix-tcc` é outro projeto e NÃO é a origem da URL oficial. Todas as alterações deste plano estão isoladas em `feat/neon-postgresql-migration`, sem alterar a produção.

**Neon será PostgreSQL primário**. Firebase **Authentication** permanece durante esta primeira etapa focada exclusivamente no banco; eliminar Firebase Auth futuramente exigirá migração adicional de sessões, e-mail/senha e Google. O Firestore só pode ser desligado depois da migração de TODOS os leitores e escritores do frontend, backend e rotinas para a API PostgreSQL. Nenhum corte parcial de carteiras/Zy Coins.

## Estado
- [x] Identificar repositório/deploy oficiais.
- [x] Adaptar esquema relacional completo do plano anterior; PostgreSQL não depende de `auth.users` do Supabase.
- [x] Preparar exportação paginada e privada do Firestore, inventário de Auth sem hashes/senhas, UUID determinístico, transformações e importação para Neon staging.
- [x] Integração Neon instalada; projeto existente `soft-water-98807259`, com branches Neon `production` e `staging` (confirmadas pelo usuário). O conector SQL ainda falha por incompatibilidade de schema de argumentos; validação manual no SQL Editor.
- [x] Exportação local confirmou estado atual **22 identidades Firebase Auth** e **295 documentos Firestore**; discrepâncias detalhadas abaixo. Corrigir exclusivamente em cópia de migração após decisão explícita; não excluir contas automaticamente.
- [x] Usuário executou esquema 001 em Neon `staging`; validação 003 apresentou **52/52 tabelas, 0 ausentes, PASS** (captura de tela de 24/09/2026). Usuário também executou 002 e `SELECT COUNT(*) FROM public.live_feed` retornou **0**, esperado antes da importação. **Pendente:** testes reais de constraints/índices, autenticação e grants com role restrita.
- [x] Exportação local privada Auth/Firestore e preflights executados; **3 erros bloqueadores** encontrados, pendentes de remediação. [ ] Verificar Storage antes do corte.
- [ ] Resolver anomalias (identidades órfãs, campos desconhecidos, relacionamentos). Importar para banco staging vazio e reconciliar contagens/checksums e saldo de cada carteira.
- [x] Adicionar API piloto somente de leitura para a lista pública de lives, protegida por `NEON_READ_API_ENABLED=true` e credenciais runtime Neon limitadas. A API permanece desativada sem conexão configurada.
- [ ] Implementar endpoints backend autenticados/autorizados restantes; migrar TODAS as leituras/escritas da plataforma para PostgreSQL, projetar realtime/chat e remover Firestore do cliente.
- [ ] Testar regressão, segurança, idempotência, carga, rollback e troca de banco. Reconciliar novamente após janela final.
- [ ] Aprovar promoção produção somente após evidências de PASS. Não fazer deploy automático a partir desta branch.

## Evidências de staging (declaradas por capturas enviadas pelo usuário)
- A validação 003 confirmou `expected_tables=52`, `installed_tables=52`, `missing_tables=0`, `schema_status=PASS`.
- A view `public.live_feed` foi criada e consultada; retornou 0 transmissões antes de importar dados.
- **Esses resultados verificam a estrutura, não a migração dos dados reais nem as políticas de autorização.**

## Preflight real mais recente (dados agregados, sem dados pessoais)
- Snapshot local: **22 usuários Auth**, **295 documentos Firestore**, **23 users**, **22 profiles** e **8 wallets**.
- **Órfão:** 1 user e 1 profile com o MESMO UID não presente no Auth; esse UID é referenciado por **1 documento em featuredStreamers**. Sem carteira identificada. A referência deve ser preservada para auditoria; desativação/omissão do destaque na nova plataforma depende da decisão e checagem de outros relacionamentos.
- **Perfil faltante:** 1 conta Auth válida com documento `users` existente e sem `profiles`; usuário informou ter excluído manualmente documento em profiles. Antes de restaurar, inspecionar os campos disponíveis no user doc e histórico/backups locais; se não houver username anterior verificável, **não inventar histórico**. Propor nome provisório não colidente no destino com sinalização de recuperação de perfil.
- **Username duplicado:** 2 perfis chamados `prendedor`, **ambos têm contas Auth válidas**, não relacionados ao UID órfão. Há apenas 1 conflito de username normalizado. Resolver com consentimento do proprietário (preferência de qual preserva o username); fallback documentado se aprovado: perfil mais antigo mantém o nome, o outro recebe nickname provisório exclusivo apenas no destino.
- **14 contas Auth sem carteira** são aviso, não justificativa para recriar automaticamente saldo; cruzar com ledger de transações e pedidos antes de criar carteira com zero.
- Exportação fonte é snapshot sujeito a ficar desatualizado; antes do corte final fazer novo export/reconciliação. Não copiar ou divulgar UIDs/e-mails/chaves em logs/PR.
- **Status: importação bloqueada** até resolver conflito de nome, perfil faltante e destino seguro dos dados órfãos, e executar novamente os preflights com resultados apropriados. Nenhuma alteração no Firebase de origem sem solicitação explícita.

## Comandos para operador AUTORIZADO em máquina privada (NUNCA executar em CI público)
```bash
cd scripts/firebase-to-neon
npm ci
export GOOGLE_APPLICATION_CREDENTIALS=/caminho/PRIVADO/service-account.json
mkdir -p /caminho/PRIVADO/zytrix/normalized
node export-auth.mjs /caminho/PRIVADO/zytrix/auth.json /caminho/PRIVADO/zytrix/auth-map.json /caminho/PRIVADO/zytrix/normalized
node export-firestore.mjs /caminho/PRIVADO/zytrix/firestore.jsonl
node preflight-auth.mjs /caminho/PRIVADO/zytrix/firestore.jsonl /caminho/PRIVADO/zytrix/auth.json /caminho/PRIVADO/zytrix/preflight-auth.json
node preflight.mjs /caminho/PRIVADO/zytrix/firestore.jsonl /caminho/PRIVADO/zytrix/preflight.json
# Pare se qualquer preflight apontar erro crítico. NÃO inventar usuários.
node transform.mjs /caminho/PRIVADO/zytrix/firestore.jsonl /caminho/PRIVADO/zytrix/auth-map.json /caminho/PRIVADO/zytrix/normalized
# Revise normalized/manifest.json e unknownPaths antes de seguir.
```

Em Neon STAGING (role apenas para migração) execute `database/neon/001_foundation.sql`, depois `database/neon/002_public_feed.sql` **uma única vez num banco vazio**. Configure uma role separada `zytrix_runtime` com permissão de leitura apenas sobre `public.live_feed` e forneça a Vercel uma URL Neon dessa role. Nunca forneça a credencial do usuário que executou as migrações à API. Importação e reconciliação somente depois de verificar SQL e transformar dados.

```bash
export NEON_DATABASE_URL='postgresql://...-staging...?...'  # credencial apenas no servidor, NUNCA Git
node import-postgres.mjs /caminho/PRIVADO/zytrix/normalized
node reconcile.mjs /caminho/PRIVADO/zytrix/normalized /caminho/PRIVADO/zytrix/reconcile.json
```

O importador usa uma transação e não ignora conflitos. TLS deve verificar certificado. A exportação é um **snapshot operacional**, não uma transferência incremental automática. Durante a migração final, dados modificados após o export precisam ser sincronizados e reconciliados; congelar escritas ou implementar captura de alterações aprovada.

## Segurança e consistência
- Banco privado Neon, API server-side, credenciais `NEON_DATABASE_URL` fora do navegador e de logs.
- No Vercel Preview, `NEON_READ_API_ENABLED=true` permite apenas GET `/api/v1/health` e GET `/api/v1/lives`. Na produção mantenha `NEON_READ_API_ENABLED=false` até o corte revisado.
- **Não conceder** acesso à rede pública ao banco além das políticas do provedor nem acesso SQL aos visitantes. Usar credenciais de runtime mínimas e pool.
- Toda regra de segurança do Firestore deve ser convertida em autorização backend. Este esquema por si só NÃO a implementa.
- Dados pessoais de Auth, exportações, URLs de conexão e service accounts nunca entram no repositório, artefatos públicos ou previews.
- Saldos históricos sem ledger completo requerem evento de abertura auditável e reconciliação; NUNCA recriar créditos com base em dados incompletos.
- Para reversão, preservar Firebase em modo seguro, backup testado e critérios de RPO/RTO antes de desativar as escritas antigas.
- Storage e Auth são serviços separados do Firestore; migrar apenas banco NÃO equivale a removê-los automaticamente.

## Arquivos
`database/neon/001_foundation.sql`: tabelas, integridade e índices.
`scripts/firebase-to-neon/*`: exportação/ETL, validador e reconciliação. Scripts e testes são base de implementação; só o teste com dados reais e Neon autorizado valida a migração.
