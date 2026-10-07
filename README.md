# Zytrix Lives

HTML/CSS/JavaScript, Neon PostgreSQL e Neon Auth. Contas novas usam diretamente o UUID do Auth. O servidor cria perfil e carteira no cadastro e protege todas as operações privadas.

## Execução

Node 22 ou superior. Execute npm ci, npm run lint, npm run typecheck, npm test e npm run build.

Configure DATABASE_URL com a role limitada zytrix_runtime e ZYTRIX_NEON_AUTH_URL com a URL exata da branch clean-neon-20261007. Nunca exponha DATABASE_URL no navegador.

O baseline database/neon/001_clean_baseline.sql destina-se apenas a banco vazio com Neon Auth já habilitado. Aplique depois 002_categories.sql, 003_auth_canonical.sql e 004_ledger_invariants.sql, nessa ordem.

Para executar localmente: defina DATABASE_URL e ZYTRIX_NEON_AUTH_URL e execute node scripts/staging-preview.mjs.

Pagamentos reais permanecem desativados. O saldo público da carteira é calculado pelo ledger imutável; constraints diferidas impedem divergência do cache de saldo. Operações financeiras são atômicas e idempotentes.

O typecheck cobre os contratos TypeScript e a integração real do SDK de autenticação. Os demais módulos JavaScript são verificados por lint de sintaxe/imports e testes.

Para testes reais em uma branch descartável, defina NEON_TEST_ADMIN_FILE com o caminho privado da conexão administrativa e execute node scripts/integration-neon.mjs. As fixtures são removidas ao terminar; o teste financeiro usa rollback. Verificação de e-mail é simulada nesse teste e exige também validação real de entrega. Nunca use credenciais administrativas na aplicação.
