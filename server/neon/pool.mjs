import pg from 'pg';
// Use a limited read-only Neon role, never migration-owner credentials.
let pool;
export function enabled() { return process.env.NEON_READ_API_ENABLED === 'true' && !!process.env.NEON_DATABASE_URL; }
export function getPool() {
  if (!enabled()) throw new Error('migration_preview_disabled');
  const url = new URL(process.env.NEON_DATABASE_URL);
  if (!['require', 'verify-full'].includes(url.searchParams.get('sslmode'))) throw new Error('tls_required');
  // pg parses sslmode from the URL and can overwrite explicit certificate checks.
  for (const key of url.searchParams.keys()) if (!['sslmode','channel_binding'].includes(key)) throw new Error('unsupported_connection_option');
  url.search = '';
  if (!pool) pool = new pg.Pool({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true },
    max: 3,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
    statement_timeout: 4000,
    query_timeout: 4500,
    options: '-c default_transaction_read_only=on'
  });
  return pool;
}
