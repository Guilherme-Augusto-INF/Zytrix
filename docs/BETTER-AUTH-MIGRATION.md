# Preparação da migração para Better Auth próprio

Status em 18/10/2026: preparação e ensaio, sem troca do provedor ativo. O usuário autorizou preparar a migração com testes de preservação antes da troca. Nenhuma rota da aplicação importa o candidato e nenhuma variável da implantação foi alterada.

## Motivo e solução

O Neon Auth da branch de teste aceitou cadastro com `abcdefgh` e `12345678`. A [API de configuração](https://api-docs.neon.tech/reference/updateneonauthemailandpasswordconfig) não oferece composição de senha. Os [webhooks](https://neon.com/docs/auth/guides/webhooks) não incluem a senha e não fornecem eventos bloqueantes para redefinição/alteração. Validar somente num proxy continuaria permitindo chamadas diretas ao serviço antigo.

A solução preparada usa Better Auth 1.6.23 próprio, PostgreSQL no Neon e um [before hook](https://better-auth.com/docs/concepts/hooks) que rejeita novas senhas inválidas antes de qualquer escrita. O módulo `server/auth/candidate.mjs` é uma fábrica para ensaio; exige banco isolado, segredo, configuração Google e callbacks de entrega explícitos. Inclui OTP, admin, JWT e organizações, mas ainda precisa de comparação completa das políticas com o provedor ativo antes de virar um servidor de produção.

O hook cobre cadastro, redefinição por token, alteração, definição inicial, redefinição por OTP e escritas administrativas. Login e reautenticação não recebem a nova exigência. Contas sem senha, como vínculos Google, não são obrigadas a criar uma senha.

## Preservação já verificada

- Inventário da branch ativa: um vínculo `credential` com hash e um vínculo `google`.
- Ensaio PostgreSQL na branch `teste` (`br-sparkling-math-b6fz3kyb`), derivada de `clean-neon-20261007`: schema candidato `zytrix_auth_candidate_20261018`, um usuário, uma credencial de senha e um vínculo Google copiados. Não é uma cópia nova da branch ativa; é o estado existente da branch de teste.
- A cópia compara todas as colunas de usuário e conta nos dois sentidos com `EXCEPT ALL`; hashes foram confirmados byte a byte. Os IDs de `public.identities` continuam presentes no candidato. O schema original e as referências ativas da aplicação não foram alterados.
- `database/neon/rehearsal-auth-copy.sql` reproduz a cópia. Aplicar numa transação `REPEATABLE READ` somente na branch de teste. Falha se o schema já existe; não remove nem sobrescreve dados.
- Testes com o handler real e adapter de memória preservam UUID, hash e vínculo Google de uma conta simulada durante startup e login com senha antiga de três caracteres. Uma senha inválida em reset/change não altera o hash. Uma senha válida é confirmada por novo login.

Isso comprova a cópia dos dados reais e o comportamento das fixtures. Ainda não comprova login com a senha real do usuário migrado nem o fluxo OAuth real. Esses são critérios obrigatórios do ensaio remoto, não suposições de compatibilidade.

## O que não deve ser importado automaticamente

Sessões, códigos de verificação, tokens de recuperação e chaves JWT do serviço antigo não foram copiados. A assinatura/encriptação pode depender de segredos do provedor. Planejar novo login, novos links de recuperação e novas chaves próprias. A cópia de contas preserva os campos OAuth, mas a portabilidade dos tokens armazenados ainda precisa ser verificada; não prometer que sejam decifráveis com outro segredo.

## Integração necessária antes da troca

1. Provisionar um papel PostgreSQL exclusivo para Auth, restrito ao schema candidato, e segredos de produção fora do Git. Manter `zytrix_runtime` restrito. Não usar credencial de dono do banco na aplicação.
2. Montar um endpoint de ensaio para `auth.handler()` e cliente `better-auth/client`, com domínio confiável explícito. Integrar SMTP/OTP e reset sem registrar senhas, códigos, tokens ou hashes em logs. Configurar o callback Google no projeto OAuth existente, preservando o vínculo por ID de conta/provedor.
3. Comparar as políticas atuais com o candidato: verificação por OTP, vínculo entre contas, banimentos, expiração/renovação de sessão, rate limits, recuperação e organizações. Os defaults do Better Auth não devem ser tratados como equivalentes automaticamente.
4. Adaptar o cliente e as APIs de configuração, autenticação e JWT. A aplicação atual fixa o issuer Neon em `server/neon/neon-token.mjs` e usa o SDK gerenciado para sessões/OAuth; a troca exige alterações coordenadas. Não aceitar qualquer issuer recebido do cliente.
5. Adaptar as consultas de Auth e `private.active_auth_session` para o schema novo. Reatribuir a FK de `public.identities` ao usuário candidato durante a troca. Preservar UUIDs, Zytrix IDs, perfis, carteira e ledger. Recriar o provisionamento de novos perfis somente depois de coordenar essa FK. `LIKE` não copia triggers nem todas as FKs; as FKs do candidato foram criadas explicitamente no ensaio.
6. Testar no PostgreSQL isolado: login com credencial real preservada pelo proprietário; Google; OTP e reset entregues; signup/reset/change de 7, 8, 9, 10, 128 e 129 caracteres e sem letra/número; login legado; rotas privadas; logout e sessões expiradas; identidade e saldo sem alterações.
7. Antes de expor o novo servidor, verificar o encerramento do serviço gerenciado antigo sem exclusão dos dados, em ambiente isolado. O Auth URL antigo deve parar de aceitar escritas; manter os dois serviços públicos permitiria contornar a regra. Não usar `disable_auth` com exclusão de dados nem confiar apenas em CORS.

## Troca e rollback

A troca está pendente e não faz parte dos comandos de ensaio aplicados. Exige backup recuperável, janela curta sem escritas de autenticação, cópia final consistente e validação de contagens/IDs/hashes/vínculos. Só então aplicar referências, implantar cliente/API/novo Auth coordenadamente e validar os fluxos completos.

Rollback antes da primeira escrita no novo provedor pode restaurar configuração e referências antigas. Depois de novas contas ou mudanças de senha, restaurar apenas um snapshot perderia alterações: é obrigatório reconciliar o delta com IDs preservados e tratar sessões/chaves separadamente. Não prometer rollback instantâneo após escritas.

## Validação reproduzível

`node --test tests/auth-migration.test.mjs` executa o handler real do Better Auth em memória, sem chamadas ao Neon/Google/SMTP. Cobre a matriz de senhas nos três fluxos, preservação de credencial antiga/vínculo Google, reset por OTP e rotas administrativas. Esses testes validam a fábrica candidata e o hook; não substituem o ensaio remoto e a integração com o Zytrix descritos acima.

O PR permanece em rascunho até os critérios de integração e troca serem atendidos. A preparação não é uma declaração de que a migração está pronta para produção.
