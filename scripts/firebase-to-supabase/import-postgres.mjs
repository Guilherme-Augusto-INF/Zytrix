import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { readJsonLines } from './lib.mjs';

const directory = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Usage: node import-postgres.mjs <normalized-directory>');
if (!process.env.SUPABASE_DB_URL) throw new Error('SUPABASE_DB_URL is required');

const order = [
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
const unknown = [...existing].filter(table => !order.includes(table) && !privateTables.has(table));
if (unknown.length) throw new Error(`No reviewed import order for: ${unknown.join(', ')}`);

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query('begin');
  await client.query("select set_config('statement_timeout', '0', true)");
  for (const table of [...order, 'channel_private_data']) {
    if (!existing.has(table)) continue;
    const rows = await readJsonLines(resolve(directory, `${table}.jsonl`));
    const schema = privateTables.has(table) ? 'private' : 'public';
    for (const row of rows) {
      const columns = Object.keys(row);
      const identifiers = columns.map(column => `"${column.replaceAll('"', '""')}"`).join(', ');
      const parameters = columns.map((_, index) => `$${index + 1}`).join(', ');
      await client.query(`insert into ${schema}."${table}" (${identifiers}) values (${parameters}) on conflict do nothing`, columns.map(column => row[column]));
    }
  }
  await client.query('commit');
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  await client.end();
}
