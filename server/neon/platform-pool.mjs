import pg from 'pg';
import { validateStagingUrl } from '../../scripts/firebase-to-neon/staging-target.mjs';
let pool;
export function platformEnabled() {
  return process.env.ZYTRIX_POSTGRES_STAGING === 'true'
    && process.env.VERCEL_ENV !== 'production' && Boolean(process.env.ZYTRIX_STAGING_DATABASE_URL);
}
export function platformPool() {
  if (!platformEnabled()) throw new Error('staging_disabled');
  const connectionString = validateStagingUrl(process.env.ZYTRIX_STAGING_DATABASE_URL);
  if (decodeURIComponent(new URL(connectionString).username) !== 'zytrix_staging_app') throw new Error('runtime_role_required');
  return pool ??= new pg.Pool({ connectionString, ssl: { rejectUnauthorized: true }, max: 5,
    connectionTimeoutMillis: 5000, statement_timeout: 10000, query_timeout: 12000,
    idleTimeoutMillis: 10000 });
}
