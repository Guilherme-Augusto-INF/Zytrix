import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { readJsonLines, sha256, writeJson } from './lib.mjs';

const [directoryArg, reportArg] = process.argv.slice(2);
if (!directoryArg || !reportArg) throw new Error('Usage: node reconcile.mjs <normalized-directory> <report.json>');
if (!process.env.SUPABASE_DB_URL) throw new Error('SUPABASE_DB_URL is required');
const directory = resolve(directoryArg);
const files = (await readdir(directory)).filter(file => file.endsWith('.jsonl')).sort();
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const privateTables = new Set(['firebase_user_map', 'channel_private_data']);
await client.connect();
const tables = {};
let passed = true;
try {
  for (const file of files) {
    const table = file.slice(0, -6);
    const schema = privateTables.has(table) ? 'private' : 'public';
    const expectedRows = (await readJsonLines(resolve(directory, file))).length;
    const result = await client.query(`select count(*)::bigint as count from ${schema}."${table}"`);
    const actualRows = Number(result.rows[0].count);
    const status = actualRows === expectedRows ? 'PASS' : 'FAIL';
    if (status === 'FAIL') passed = false;
    tables[table] = { expectedRows, actualRows, status, normalizedSha256: sha256(await readFile(resolve(directory, file))) };
  }
  const invariants = {};
  const checks = {
    orphanLives: 'select count(*)::bigint as count from public.lives l left join public.channels c on c.id=l.channel_id where c.id is null',
    orphanMessages: 'select count(*)::bigint as count from public.chat_messages m left join public.lives l on l.id=m.live_id where l.id is null',
    negativeWallets: 'select count(*)::bigint as count from public.wallets where balance < 0',
    ledgerWithoutParticipant: "select count(*)::bigint as count from public.zy_coin_transactions where from_user_id is null and type not in ('promotion_claim','purchase','admin_adjustment')",
    openDuplicateReports: `select count(*)::bigint as count from (select reporter_id,target_type,coalesce(target_profile_id::text,target_live_id::text,target_chat_message_id::text),count(*) from public.reports where status='open' group by 1,2,3 having count(*)>1) d`
  };
  for (const [name, sql] of Object.entries(checks)) {
    const count = Number((await client.query(sql)).rows[0].count);
    invariants[name] = { count, status: count === 0 ? 'PASS' : 'FAIL' };
    if (count !== 0) passed = false;
  }
  await writeJson(resolve(reportArg), { generatedAt: new Date().toISOString(), status: passed ? 'PASS' : 'FAIL', tables, invariants });
} finally {
  await client.end();
}
if (!passed) process.exitCode = 2;
