# Integração Better Auth e ensaio de preservação

Status em 18/10/2026: integração implementada e validada na branch Neon `teste` (`br-sparkling-math-b6fz3kyb`). Produção continua com Neon Auth. O PR permanece em rascunho até concluir os critérios externos abaixo.

## Comportamento

Novas senhas exigem 8–128 caracteres, uma letra latina (incluindo acentos) e um dígito ASCII. O before hook do Better Auth 1.6.23 cobre cadastro, reset, alteração, definição inicial e escritas por OTP/admin. Login e reautenticação preservam credenciais antigas. A rota pública permite somente operações usadas pelo site; endpoints administrativos não são expostos.

`ZYTRIX_AUTH_PROVIDER` fica em `neon` por padrão. A opção `better-auth` ativa `/api/auth/*`, configuração pública no mesmo domínio, sessões, JWT com issuer/audience fixos e APIs da plataforma usando `zytrix_auth`. O backend verifica assinatura e sessão vigente no banco. Logout revoga a sessão. A rota limita corpos a 16 KiB e recusa POST de outra origem. Rate limits usam PostgreSQL.

O runtime exige configuração completa de Google, SMTP e segredo próprio. Consulte `docs/auth-environment.example`; não versionar valores reais. SMTP usa TLS e não registra códigos ou links. O papel `zytrix_auth_service` é exclusivo do Auth; a plataforma continua em `zytrix_runtime`, sem acesso aos hashes. Kysely qualifica o schema e funciona no pooler Neon sem parâmetros de startup `search_path`.

## Ensaio aplicado somente em teste

`database/neon/rehearsal-auth-copy.sql` preserva o ensaio inicial em schema separado. `database/neon/self-auth-integration.sql` cria `zytrix_auth`, copia usuários, contas e organizações, compara todas as colunas de usuário/conta e verifica IDs existentes. Exige papel restrito provisionado previamente e transação `REPEATABLE READ`; falha se o schema já existir.

O segundo script **altera a FK de `public.identities` e instala o provisionamento no schema novo dentro da branch de teste**. Não executar na branch ativa como migração comum. O schema `neon_auth` e os hashes originais foram preservados. A cópia contém um usuário, uma credencial e um vínculo Google anteriores ao ensaio. Fixtures adicionais são contas artificiais em `example.invalid`, somente em teste.

Sessões, verificações, links de recuperação e chaves JWT anteriores não são importados. Será necessário novo login. Os campos OAuth foram copiados, mas a portabilidade de tokens cifrados não foi presumida.

## Testes reproduzíveis e evidências

- `npm test`: frontend, fábrica real, handler HTTP e compatibilidade da aplicação.
- `npm run lint`, `npm run typecheck`, `npm run build`.
- `node scripts/integration-self-auth.mjs`: PostgreSQL real, carregando `.env.auth-db.local` ignorado pelo Git. Exige `DATABASE_URL` da plataforma e `ZYTRIX_AUTH_DATABASE_URL` do papel restrito, ambos da branch de teste. Nunca usar URLs de produção. `--serve` mantém o servidor para prova no navegador; encerrar depois do teste.

O ensaio PostgreSQL passou cadastro, OTP com entrega simulada, login legado de três caracteres, JWT, registro de identidade, carteira zero, recusa de acesso anônimo/forjado, alteração e reset com a matriz 7/8/9/10/128/129 e sem letra/número, além de revogação pelo logout. Os hashes anteriores ao ensaio permaneceram iguais. Auth não pôde atualizar carteiras; a plataforma não pôde ler hashes. No navegador, login da fixture de oito caracteres abriu o perfil privado e persistiu após recarregar. O controle do navegador se desconectou antes da confirmação visual de logout; a revogação foi comprovada pelo teste HTTP/PostgreSQL.

Estes testes não enviam e-mails reais e não completam OAuth real. A geração do URL Google é testada, mas não comprova consentimento, callback nem acesso à conta migrada.

## Pendências obrigatórias antes da troca

1. Preencher segredos Google e SMTP fora do Git. Registrar no cliente Google existente o callback `https://<domínio-de-ensaio>/api/auth/callback/google`. Validar entrega real de OTP/reset e login Google preservando UUID. O proprietário deve testar sua credencial preservada; não usar sua senha em automação.
2. Comparar configurações operacionais atuais: expiração/renovação de sessão, rate limits, banimentos, vínculo de contas e organizações. Defaults do Better Auth não comprovam equivalência.
3. Ensaiar desativação das escritas públicas do Auth antigo sem apagar usuários. O Neon gerenciado aceitou `abcdefgh` e `12345678`; enquanto aceitar escritas, a composição pode ser contornada. CORS não resolve. Não usar uma operação que exclua dados de Auth.
4. Aprovar backup recuperável, janela sem escritas, cópia final consistente e conferência de contagens/IDs/hashes/vínculos; aplicar referências e implantação coordenadamente. Produção exige `ZYTRIX_MANAGED_AUTH_RETIRED=true`, declaração operacional definida somente após verificar o encerramento do endpoint antigo. A flag não desativa o serviço por si só.

Rollback antes de novas escritas pode restaurar configuração e referências antigas. Depois de cadastro ou mudança de senha no novo provedor, reconciliar o delta antes de voltar; restaurar apenas um snapshot perderia alterações. Nenhuma variável de implantação, conta ou senha de produção foi alterada.
