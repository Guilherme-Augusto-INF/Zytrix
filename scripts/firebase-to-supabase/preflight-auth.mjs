import { resolve } from 'node:path';
import { readJson, readJsonLines, sha256, writeJson } from './lib.mjs';

const [firestoreInput, authInput, output] = process.argv.slice(2);
if (!firestoreInput || !authInput || !output) {
  throw new Error('Usage: node preflight-auth.mjs <firestore.jsonl> <firebase-auth.json> <report.json>');
}

const [firestoreRows, authExport] = await Promise.all([
  readJsonLines(resolve(firestoreInput)),
  readJson(resolve(authInput))
]);
const authUsers = Array.isArray(authExport) ? authExport : authExport.users;
if (!Array.isArray(authUsers)) throw new Error('Firebase Auth export must be an array or an object with a users array');

const authIds = new Set();
const emails = new Map();
let passwordOnly = 0;
let googleOnly = 0;
let linkedGooglePassword = 0;
let otherProviderShape = 0;

for (const user of authUsers) {
  const uid = user.localId ?? user.uid;
  if (!uid) throw new Error('Firebase Auth row without localId/uid');
  authIds.add(uid);
  if (user.email) {
    const key = String(user.email).trim().toLowerCase();
    const values = emails.get(key) ?? [];
    values.push(uid);
    emails.set(key, values);
  }
  const providers = new Set((user.providerUserInfo ?? []).map(value => value.providerId));
  const hasGoogle = providers.has('google.com');
  const hasPassword = Boolean(user.passwordHash || user.password_hash || providers.has('password'));
  if (hasGoogle && hasPassword) linkedGooglePassword += 1;
  else if (hasGoogle) googleOnly += 1;
  else if (hasPassword) passwordOnly += 1;
  else otherProviderShape += 1;
}

const rootIds = collection => new Set(
  firestoreRows
    .map(row => row.path.split('/'))
    .filter(parts => parts.length === 2 && parts[0] === collection)
    .map(parts => parts[1])
);
const userDocs = rootIds('users');
const profileDocs = rootIds('profiles');
const walletDocs = rootIds('wallets');
const setDifference = (left, right) => [...left].filter(value => !right.has(value)).sort();
const duplicateEmailHashes = [...emails]
  .filter(([, ids]) => ids.length > 1)
  .map(([email, ids]) => ({ emailSha256: sha256(email), userCount: ids.length }));

const report = {
  generatedAt: new Date().toISOString(),
  counts: {
    authUsers: authIds.size,
    userDocuments: userDocs.size,
    profileDocuments: profileDocs.size,
    walletDocuments: walletDocs.size
  },
  providerShape: { passwordOnly, googleOnly, linkedGooglePassword, otherProviderShape },
  missingUserDocuments: setDifference(authIds, userDocs),
  missingProfileDocuments: setDifference(authIds, profileDocs),
  missingWalletDocuments: setDifference(authIds, walletDocs),
  firestoreUsersWithoutAuth: setDifference(userDocs, authIds),
  firestoreProfilesWithoutAuth: setDifference(profileDocs, authIds),
  duplicateEmailHashes
};
report.fatalErrorCount = report.firestoreUsersWithoutAuth.length
  + report.firestoreProfilesWithoutAuth.length
  + duplicateEmailHashes.length;
report.warningCount = report.missingUserDocuments.length
  + report.missingProfileDocuments.length
  + report.missingWalletDocuments.length
  + otherProviderShape;

await writeJson(resolve(output), report);
if (report.fatalErrorCount) process.exitCode = 2;
