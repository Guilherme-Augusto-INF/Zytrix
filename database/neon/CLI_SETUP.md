# Neon CLI — configuração do projeto Zytrix

**Destino solicitado:** Neon project `soft-water-98807259`, branch Neon `production`.

O arquivo `neon.ts` foi adicionado nesta branch de trabalho. **Nenhuma conta Neon foi autenticada, nenhum `neon link` executado e nenhum `neon deploy` remoto realizado.** Instalação no ambiente automatizado ficou bloqueada por resolução DNS do registro npm; o diretório de trabalho local dessa sessão também não contém a cópia do repositório. Não presuma configuração remota.

## Executar em máquina autenticada na raiz deste checkout

Use Node.js >=22.20 para que o comando `neon skills` funcione.

```sh
npm i -g neon@latest
neon auth
neon skills -y
neon mcp -y
neon link --project-id soft-water-98807259 --branch production -y
neon config init
# `neon.ts` já existe, exatamente conforme solicitado.
neon config status
neon config plan
# Examinar o plano antes de alterar a branch remota production.
neon deploy
```

A documentação atual da CLI apresenta `neon auth` para autenticação. Caso a versão instalada suporte `neon login` como alias, também pode ser utilizado. Confirme se `neon link` efetivamente vinculou a branch Neon esperada e se os comandos `neon config plan` / `deploy` mostram a conta/projeto corretos.

`neon config init` instala a dependência `@neon/config` e outras ferramentas locais de acordo com a versão da CLI. Depois disso, **adicione ao PR** qualquer mudança legítima de `package.json` / `package-lock.json` produzida no checkout pelo `init`.

### Importante para a migração
- `neon deploy` **aplica a política `neon.ts`**, mas `defineConfig({})` não cria as tabelas de `database/neon/001_foundation.sql`, não migra usuários e não transfere Firestore.
- Os arquivos SQL e ferramentas de importação nesta branch são trabalho em andamento. Executar primeiro no banco **staging**, não na branch Neon `production` com dados de produção.
- Não conceder ao backend acesso com a role de migração.
- Arquivos `.neon` e `.env.local` podem ser sensíveis; inspecionar antes de qualquer commit. Nunca publicar URL de banco, credenciais, exports Firebase, dumps, tokens.
- O domínio oficial Vercel `zytrix-lives.vercel.app` permanece intocado até reconciliação e testes E2E completos.
