import pg from 'pg';
// Use a limited read-only Neon role, never migration-owner credentials.
let pool;
export function enabled() { return process.env.NEON_READ_API_ENABLED === 'true' && !!process.env.NEON_DATABASE_URL; }
export function getPool() {
  if (!enabled()) throw new Error('migration_preview_disabled');
  if (!pool) pool = new pg.Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    max: 3,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
    statement_timeout: 4000,
    query_timeout: 4500
  });
  return pool;
}
