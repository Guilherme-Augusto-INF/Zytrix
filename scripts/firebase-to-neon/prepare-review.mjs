// Local review only. Never writes Firebase or PostgreSQL; never authorizes import.
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { decode, readJson, readJsonLines, sha256, writeJson, writeJsonLines } from './lib.mjs';
import { resolveApprovedUsername } from './resolve-usernames.mjs';

const [sourceDirectory, destination, ...options] = process.argv.slice(2);
const allowedOptions = new Set(['--approved-oldest-keeps-prendedor','--approved-spaces-and-alerts']);
if (options.some(option => !allowedOptions.has(option))) throw new Error('Unknown approval option');
const approval = options.includes('--approved-oldest-keeps-prendedor');
const additionalApproval = options.includes('--approved-spaces-and-alerts');
if (!sourceDirectory || !destination) throw new Error('Usage: node prepare-review.mjs <private-export-directory> <new-private-review-directory>');
const input = resolve(sourceDirectory), output = resolve(destination);
const repository = resolve(import.meta.dirname, '../..');
const inside = (parent, child) => { const p = relative(parent, child); return !p || (!p.startsWith('..') && !isAbsolute(p)); };
if (inside(repository, output) || inside(output, input)) throw new Error('Review output must be outside the repository and must not contain the source');
const rows = await readJsonLines(resolve(input, 'firestore.jsonl'));
const auth = await readJson(resolve(input, 'auth.json'));
const users = Array.isArray(auth) ? auth : auth.users;
if (!Array.isArray(users)) throw new Error('Invalid Auth export');
const ids = new Set(users.map(u => u.uid ?? u.localId));
if (ids.has(undefined) || ids.size !== users.length) throw new Error('Invalid or duplicate Auth IDs');
const rootRows = collection => rows.filter(r => r.path.split('/').length === 2 && r.path.startsWith(collection + '/'));
const orphans = new Set(['users', 'profiles'].flatMap(c => rootRows(c).map(r => r.path.split('/')[1])).filter(id => !ids.has(id)));
// Preserve every row referencing an orphan, including nested references and document paths.
const references = (value, id) => typeof value === 'string' ? value.split('/').includes(id) : Array.isArray(value) ? value.some(v => references(v, id)) : value && typeof value === 'object' ? Object.entries(value).some(([k,v]) => references(k,id) || references(v,id)) : false;
const quarantine = rows.filter(r => [...orphans].some(id => references(r, id))
  || (additionalApproval && /^streams\/[^/]+\/supportAlerts\/[^/]+$/.test(r.path) && decode(r.data).expiresAt == null));
const removed = new Set(quarantine.map(r => r.path));
let candidate = rows.filter(r => !removed.has(r.path));
let usernameResolution = null;
if (approval) {
  const resolved = resolveApprovedUsername(candidate, users);
  candidate = resolved.rows;
  usernameResolution = resolved.audit;
}
const additionalRenames = [];
if (additionalApproval) {
  candidate = candidate.map(row => {
    if (!/^profiles\/[^/]+$/.test(row.path) || !/\s/.test(decode(row.data).username)) return row;
    const old = decode(row.data).username;
    const username = old.trim().replace(/\s+/g, '-');
    if (!/^[A-Za-z0-9_.-]{2,30}$/.test(username)) throw new Error('Username requires further review');
    additionalRenames.push({ path: row.path, old, username });
    return { ...row, data: { ...row.data, username } };
  });
  const keys = candidate.filter(row => /^profiles\/[^/]+$/.test(row.path)).map(row => String(decode(row.data).username).trim().toLowerCase());
  if (new Set(keys).size !== keys.length) throw new Error('Destination username collision');
}
const profiles = rootRows('profiles');
const missingProfiles = [...ids].filter(id => !profiles.some(r => r.path === 'profiles/' + id));
const walletIds = new Set(rootRows('wallets').map(r => r.path.split('/')[1]));
const missingWallets = [...ids].filter(id => !walletIds.has(id));
const financialRows = rows.filter(r => ['zyCoinTransactions', 'zyCoinOrders'].includes(r.path.split('/')[0]));
const missingWalletReferences = financialRows.filter(r => missingWallets.some(id => references(r, id)));
const groups = new Map();
for (const r of profiles.filter(r => !removed.has(r.path))) {
  const key = String(decode(r.data).username ?? '').trim().toLowerCase();
  groups.set(key, [...(groups.get(key) ?? []), r.path]);
}
const conflicts = [...groups.values()].filter(g => g.length > 1);
const report = {
  status: 'BLOCKED_REVIEW_ONLY', importAuthorized: false,
  sourceSha256: sha256(await readFile(resolve(input, 'firestore.jsonl'))),
  authSha256: sha256(await readFile(resolve(input, 'auth.json'))),
  counts: { auth: ids.size, sourceDocuments: rows.length, quarantinedDocuments: quarantine.length,
    candidateDocuments: candidate.length, missingProfiles: missingProfiles.length,
    sourceDuplicateUsernameGroups: conflicts.length,
    unresolvedDuplicateUsernameGroups: conflicts.length - (usernameResolution ? 1 : 0), missingWallets: missingWallets.length,
    missingWalletFinancialReferences: missingWalletReferences.length },
  missingProfiles, missingWallets, duplicateUsernamePaths: conflicts,
  usernameResolution,
  additionalRenames,
  additionalRemediationApproved: additionalApproval,
  decisions: { orphans: 'Quarantine only; no destination identity or public highlight',
    missingProfiles: 'Do not recreate manually deleted profiles without verified profile data',
    usernames: usernameResolution ? 'Approved rule applied to candidate only; original export unchanged' : 'Unchanged; explicit user approval required for oldest Auth createdAt retains name',
    wallets: 'No defaults created; review ledger and orders first' }
};
await mkdir(output); // Refuse to overwrite a prior review.
await writeJsonLines(resolve(output, 'quarantine.jsonl'), quarantine);
await writeJsonLines(resolve(output, 'candidate-firestore.jsonl'), candidate);
await writeJson(resolve(output, 'review.json'), report);
console.log(JSON.stringify({ status: report.status, counts: report.counts }));
