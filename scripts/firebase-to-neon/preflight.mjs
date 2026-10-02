import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decode, readJson, readJsonLines, sha256, writeJson } from './lib.mjs';

const [input, output, baselineFile] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node preflight.mjs <firestore.jsonl> <report.json> [console-baseline.json]');
const rows = await readJsonLines(resolve(input));
const paths = new Map(rows.map(row => [row.path, decode(row.data)]));
const counts = {};
const fieldTypes = {};
const errors = [];
const warnings = [];
const baselineDifferences = [];

function collectionPattern(path) {
  const parts = path.split('/');
  return parts.map((part, index) => index % 2 ? '{id}' : part).join('/');
}
function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
for (const row of rows) {
  const pattern = collectionPattern(row.path);
  counts[pattern] = (counts[pattern] ?? 0) + 1;
  const data = decode(row.data);
  fieldTypes[pattern] ??= {};
  for (const [field, value] of Object.entries(data)) {
    fieldTypes[pattern][field] ??= {};
    const kind = typeOf(value);
    fieldTypes[pattern][field][kind] = (fieldTypes[pattern][field][kind] ?? 0) + 1;
  }
}

for (const [path, data] of paths) {
  const parts = path.split('/');
  if (parts[0] === 'profiles' && data.uid !== parts[1]) errors.push({ path, issue: 'profile_uid_mismatch' });
  if (parts[0] === 'channels' && parts.length === 2 && data.ownerUid && !paths.has(`users/${data.ownerUid}`)) errors.push({ path, issue: 'orphan_channel_owner', value: data.ownerUid });
  if (parts[0] === 'streams' && parts.length === 2) {
    if (!paths.has(`channels/${data.channelId}`)) errors.push({ path, issue: 'orphan_stream_channel', value: data.channelId });
    if (!paths.has(`profiles/${data.streamerUid}`)) errors.push({ path, issue: 'orphan_stream_owner', value: data.streamerUid });
  }
  if (parts[0] === 'wallets' && Number(data.balance) < 0) errors.push({ path, issue: 'negative_wallet' });
  if (parts[0] === 'streams' && parts[2] === 'viewers' && data.expiresAt && new Date(data.expiresAt) <= new Date()) warnings.push({ path, issue: 'expired_ephemeral_row' });
}

const usernameGroups = new Map();
for (const [path, data] of paths) if (path.startsWith('profiles/') && path.split('/').length === 2) {
  const key = String(data.username ?? '').trim().toLowerCase();
  const list = usernameGroups.get(key) ?? [];
  list.push(path); usernameGroups.set(key, list);
}
for (const [key, duplicates] of usernameGroups) if (key && duplicates.length > 1) errors.push({ issue: 'duplicate_normalized_username', key, paths: duplicates });

if (baselineFile) {
  const baseline = await readJson(resolve(baselineFile));
  for (const [collection, expected] of Object.entries(baseline.rootCollectionCounts ?? {})) {
    const actual = counts[`${collection}/{id}`] ?? 0;
    if (actual !== expected) {
      const difference = { collection, consoleBaseline: expected, exportCount: actual };
      baselineDifferences.push(difference);
      warnings.push({ issue: 'console_baseline_drift', ...difference });
    }
  }
}

const raw = await readFile(resolve(input));
await writeJson(resolve(output), {
  generatedAt: new Date().toISOString(),
  source: resolve(input),
  sha256: sha256(raw),
  totalDocuments: rows.length,
  counts,
  fieldTypes,
  fatalErrorCount: errors.length,
  warningCount: warnings.length,
  baselineDifferences,
  errors,
  warnings
});
if (errors.length) process.exitCode = 2;
