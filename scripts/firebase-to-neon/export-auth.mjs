// Execute locally with Firebase service-account credentials; never commit outputs.
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { v5 as uuidv5 } from 'uuid';
import { writeJson, writeJsonLines } from './lib.mjs';
process.umask(0o077);
const [authFile, mapFile, normalizedDir] = process.argv.slice(2);
if (!authFile || !mapFile || !normalizedDir) throw new Error('Usage: node export-auth.mjs <private-auth.json> <private-auth-map.json> <normalized-dir>');
let credential = applicationDefault();
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) credential = cert(JSON.parse(await readFile(resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS),'utf8')));
if (!getApps().length) initializeApp({ credential });
const auth = getAuth();
const namespace = uuidv5('zytrix-ca4f2', uuidv5.DNS);
const users = [], map = {}, identities = [], emailSet = new Set();
let nextPageToken;
do {
  const result = await auth.listUsers(1000, nextPageToken);
  for (const user of result.users) {
    const normalizedEmail = (user.email || '').trim().toLowerCase();
    if (normalizedEmail && emailSet.has(normalizedEmail)) throw new Error('Duplicate Auth email: stop and reconcile identities');
    if (normalizedEmail) emailSet.add(normalizedEmail);
    const id = uuidv5('firebase-auth:' + user.uid, namespace);
    const providers = user.providerData.map(p => ({ providerId: p.providerId }));
    const providerName = providers.some(p => p.providerId === 'google.com') ? 'google' : 'password';
    const created = user.metadata.creationTime ? new Date(user.metadata.creationTime).toISOString() : new Date(0).toISOString();
    // Deliberately exclude password hashes, tokens and unneeded personal metadata.
    users.push({ uid: user.uid, email: user.email || null, emailVerified: !!user.emailVerified,
      providerUserInfo: providers, password_hash_present: !!user.passwordHash,
      createdAt: created });
    map[user.uid] = { postgres_user_id: id, source_email: user.email || null, source_provider: providerName };
    identities.push({ id, firebase_uid: user.uid, created_at: created });
  }
  nextPageToken = result.pageToken;
} while (nextPageToken);
await mkdir(resolve(normalizedDir), { recursive: true, mode: 0o700 });
await writeJson(resolve(authFile), { users });
await writeJson(resolve(mapFile), map);
await writeJsonLines(resolve(normalizedDir, 'identities.jsonl'), identities);
process.stdout.write(JSON.stringify({ identityCount: identities.length, output: 'local private files (never commit)' }) + '\n');
