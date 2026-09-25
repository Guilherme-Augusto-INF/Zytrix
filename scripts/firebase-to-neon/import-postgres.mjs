import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { readJsonLines, sha256 } from './lib.mjs';
import { validateStagingUrl } from './staging-target.mjs';

const directory = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Usage: node import-postgres.mjs <normalized-directory>');
const connection = process.env.NEON_DATABASE_URL_FILE
  ? (await readFile(process.env.NEON_DATABASE_URL_FILE, 'utf8')).trim() : process.env.NEON_DATABASE_URL;
const connectionString = validateStagingUrl(connection);
const mode = process.argv[3] ?? '--dry-run';
if (!['--dry-run', '--commit-staging'].includes(mode)) throw new Error('Use --dry-run or --commit-staging');

const order = [
  'identities',
  'firebase_user_map','user_accounts','profiles','admins','categories','channels','channel_profiles','lives','follows',
  'channel_members','live_moderators','live_schedules','rewards','creator_codes','user_preferences',
  'notification_states','watch_history','user_progress','followed_categories','creator_attributions',
  'chat_messages','chat_settings','live_bans','live_reactions','polls','poll_options','poll_votes',
  'wallets','zy_coin_orders','coin_promotions','zy_coin_transactions','support_alerts','promotion_claims',
  'reward_redemptions','clips','moderation_penalties','moderation_actions','governance_config','reports',
  'moderation_audit','policy_acceptances','featured_streamers'
];
const existing = new Set((await readdir(directory)).filter(file => file.endsWith('.jsonl')).map(file => file.slice(0, -6)));
const privateTables = new Set(['firebase_user_map', 'channel_private_data']);
const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
if (!Array.isArray(manifest.unknownPaths) || manifest.unknownPaths.length)
  throw new Error('Unmapped Firestore collections: migration import blocked');
if (!existing.has('identities') || !existing.has('firebase_user_map'))
  throw new Error('Missing exported Firebase identities or identity map');
for (const [table, data] of Object.entries(manifest.tables || {})) {
  if (!existing.has(table)) throw new Error('Missing normalized file for: ' + table);
  const raw=await readFile(resolve(directory, table + '.jsonl'));
  if (sha256(raw) !== data.sha256) throw new Error('Normalized data checksum mismatch: ' + table);
  if ((await readJsonLines(resolve(directory, table + '.jsonl'))).length !== data.rows)
    throw new Error('Normalized data row-count mismatch: ' + table);
}
const identities = await readJsonLines(resolve(directory,'identities.jsonl'));
const mappings = await readJsonLines(resolve(directory,'firebase_user_map.jsonl'));
if (identities.length !== mappings.length || !identities.length)
  throw new Error('Identity count mismatch/empty export');
const unknown = [...existing].filter(table => !order.includes(table) && !privateTables.has(table));
if (unknown.length) throw new Error(`No reviewed import order for: ${unknown.join(', ')}`);
if ([...existing].some(table => !manifest.tables?.[table])) throw new Error('Every normalized file must be checksummed in the manifest');
const identityByUid = new Map(identities.map(row => [row.firebase_uid, row.id]));
if (identityByUid.size !== identities.length || new Set(identities.map(row => row.id)).size !== identities.length
    || new Set(mappings.map(row => row.firebase_uid)).size !== mappings.length
    || mappings.some(row => identityByUid.get(row.firebase_uid) !== row.postgres_user_id))
  throw new Error('Identity mapping mismatch');

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: true } });
await client.connect();
try {
  await client.query('begin');
  await client.query("select set_config('statement_timeout', '120000', true)");
  await client.query("select set_config('lock_timeout', '10000', true)");
  for (const table of [...order, 'channel_private_data']) {
    if (!existing.has(table)) continue;
    const schema = privateTables.has(table) ? 'private' : 'public';
    await client.query(`lock table ${schema}."${table}" in exclusive mode`);
    const count = await client.query(`select count(*)::integer as count from ${schema}."${table}"`);
    if (count.rows[0].count !== 0) throw new Error('Destination table is not empty: ' + table);
  }
  for (const table of [...order, 'channel_private_data']) {
    if (!existing.has(table)) continue;
    const rows = await readJsonLines(resolve(directory, `${table}.jsonl`));
    const schema = privateTables.has(table) ? 'private' : 'public';
    for (const row of rows) {
      const columns = Object.keys(row);
      const identifiers = columns.map(column => `"${column.replaceAll('"', '""')}"`).join(', ');
      const parameters = columns.map((_, index) => `$${index + 1}`).join(', ');
      await client.query(`insert into ${schema}."${table}" (${identifiers}) values (${parameters})`, columns.map(column => row[column]));
    }
  }
  await client.query('set constraints all immediate');
  await client.query(mode === '--commit-staging' ? 'commit' : 'rollback');
  console.log(mode === '--commit-staging' ? 'STAGING IMPORT COMMITTED' : 'STAGING DRY RUN PASSED; ROLLED BACK');
} catch (error) {
  await client.query('rollback');
  // PostgreSQL detail can contain private values. Do not emit it to chat or console.
  console.error(JSON.stringify({ status: 'ROLLED_BACK', code: error.code ?? 'VALIDATION_FAILED',
    table: error.table ?? null, constraint: error.constraint ?? null }));
  process.exitCode = 2;
} finally {
  await client.end();
}
