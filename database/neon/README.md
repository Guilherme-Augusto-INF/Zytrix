# Zytrix → Neon PostgreSQL — migração do banco (ainda NÃO concluída)

## Ambiente verificado
Produção: `zytrix-lives.vercel.app` corresponde ao projeto Vercel `zytrix-web`, integrado ao repositório **Guilherme-Augusto-INF/Zytrix**, branch `main`. O repositório `Zytrix-tcc` é outro projeto e NÃO é a origem da URL oficial. Todas as alterações deste plano estão isoladas em `feat/neon-postgresql-migration`, sem alterar a produção.

**Neon será PostgreSQL primário**. Firebase **Authentication** permanece durante esta primeira etapa focada exclusivamente no banco; eliminar Firebase Auth futuramente exigirá migração adicional de sessões, e-mail/senha e Google. O Firestore só pode ser desligado depois da migração de TODOS os leitores e escritores do frontend, backend e rotinas para a API PostgreSQL. Nenhum corte parcial de carteiras/Zy Coins.

## Estado
- [x] Identificar repositório/deploy oficiais.
- [x] Adaptar esquema relacional completo do plano anterior; PostgreSQL não depende de `auth.users` do Supabase.
- [x] Preparar exportação paginada e privada do Firestore, inventário de Auth sem hashes/senhas, UUID determinístico, transformações e importação para Neon staging.
- [ ] Conectar a conta Neon à sessão do ChatGPT e autorizar criação de **projetos separados de staging e produção**; nenhum banco remoto criado ainda.
- [ ] Confirmar estado ATUAL do Firebase; em levantamento anterior havia 19 identidades Auth e 20 documentos users/profiles. A diferença é BLOQUEADORA até reconciliar (não excluir documentos automaticamente).
- [ ] Executar esquema apenas no Neon STAGING e testar constraints/índices, locks e permissões.
- [ ] Executar exportação privada Auth/Firestore e preflights. Verificar Storage antes do corte.
- [ ] Resolver anomalias (identidades órfãs, campos desconhecidos, relacionamentos). Importar para banco staging vazio e reconciliar contagens/checksums e saldo de cada carteira.
- [ ] Criar API backend autorizada, migrar TODAS as leituras/escritas da plataforma para PostgreSQL, projetar realtime/chat e remover Firestore do cliente.
- [ ] Testar regressão, segurança, idempotência, carga, rollback e troca de banco. Reconciliar novamente após janela final.
- [ ] Aprovar promoção produção somente após evidências de PASS. Não fazer deploy automático a partir desta branch.

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

Em Neon STAGING (role apenas para migração) execute `database/neon/001_foundation.sql` **uma única vez num banco vazio**. Importação e reconciliação somente depois de verificar SQL e transformar dados.

```bash
export NEON_DATABASE_URL='postgresql://...-staging...?...'  # credencial apenas no servidor, NUNCA Git
node import-postgres.mjs /caminho/PRIVADO/zytrix/normalized
node reconcile.mjs /caminho/PRIVADO/zytrix/normalized /caminho/PRIVADO/zytrix/reconcile.json
```

O importador usa uma transação e não ignora conflitos. TLS deve verificar certificado. A exportação é um **snapshot operacional**, não uma transferência incremental automática. Durante a migração final, dados modificados após o export precisam ser sincronizados e reconciliados; congelar escritas ou implementar captura de alterações aprovada.

## Segurança e consistência
- Banco privado Neon, API server-side, credenciais `NEON_DATABASE_URL` fora do navegador e de logs.
- **Não conceder** acesso à rede pública ao banco além das políticas do provedor nem acesso SQL aos visitantes. Usar credenciais de runtime mínimas e pool.
- Toda regra de segurança do Firestore deve ser convertida em autorização backend. Este esquema por si só NÃO a implementa.
- Dados pessoais de Auth, exportações, URLs de conexão e service accounts nunca entram no repositório, artefatos públicos ou previews.
- Saldos históricos sem ledger completo requerem evento de abertura auditável e reconciliação; NUNCA recriar créditos com base em dados incompletos.
- Para reversão, preservar Firebase em modo seguro, backup testado e critérios de RPO/RTO antes de desativar as escritas antigas.
- Storage e Auth são serviços separados do Firestore; migrar apenas banco NÃO equivale a removê-los automaticamente.

## Arquivos
`database/neon/001_foundation.sql`: tabelas, integridade e índices.
`scripts/firebase-to-neon/*`: exportação/ETL, validador e reconciliação. Scripts e testes são base de implementação; só o teste com dados reais e Neon autorizado valida a migração.
