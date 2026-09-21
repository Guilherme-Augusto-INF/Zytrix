import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { writeJsonLines } from './lib.mjs';

const output = process.argv[2];
if (!output) throw new Error('Usage: node export-firestore.mjs <output.jsonl>');

let credential = applicationDefault();
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  credential = cert(JSON.parse(await readFile(resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS), 'utf8')));
}
if (!getApps().length) initializeApp({ credential });
const db = getFirestore();

function encode(value) {
  if (value instanceof Timestamp) return { __type: 'timestamp', value: value.toDate().toISOString() };
  if (value instanceof GeoPoint) return { __type: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  if (value instanceof DocumentReference) return { __type: 'reference', path: value.path };
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { __type: 'bytes', base64: Buffer.from(value).toString('base64') };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, encode(nested)]));
  return value;
}

const rows = [];
async function exportCollection(collectionRef) {
  const snapshot = await collectionRef.get();
  const documents = [...snapshot.docs].sort((a, b) => a.id.localeCompare(b.id));
  for (const document of documents) {
    rows.push({ path: document.ref.path, data: encode(document.data()) });
    const children = await document.ref.listCollections();
    for (const child of children.sort((a, b) => a.id.localeCompare(b.id))) await exportCollection(child);
  }
}

const roots = await db.listCollections();
for (const root of roots.sort((a, b) => a.id.localeCompare(b.id))) await exportCollection(root);
await writeJsonLines(resolve(output), rows);
process.stdout.write(`${JSON.stringify({ output: resolve(output), documents: rows.length })}\n`);

