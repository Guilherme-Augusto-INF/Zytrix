// Recursive, paginated Firestore export. Run only on your authenticated local workstation.
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldPath, Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore';
import { createWriteStream } from 'node:fs';
import { readFile, mkdir } from 'node:fs/promises';
import { once } from 'node:events';
import { dirname, resolve } from 'node:path';
process.umask(0o077);
const target = process.argv[2];
if (!target) throw new Error('Usage: node export-firestore.mjs <private-firestore.jsonl>');
let credential = applicationDefault();
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) credential = cert(JSON.parse(await readFile(resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS),'utf8')));
if (!getApps().length) initializeApp({ credential });
const db = getFirestore();
function encode(value) {
  if (value instanceof Timestamp) return { __type:'timestamp', value:value.toDate().toISOString() };
  if (value instanceof GeoPoint) return { __type:'geopoint',latitude:value.latitude,longitude:value.longitude };
  if (value instanceof DocumentReference) return { __type:'reference',path:value.path };
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { __type:'bytes',base64:Buffer.from(value).toString('base64') };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]));
  return value;
}
await mkdir(dirname(resolve(target)), { recursive:true, mode:0o700 });
const stream = createWriteStream(resolve(target), { flags:'wx',mode:0o600,encoding:'utf8' });
let count = 0;
async function exportCollection(ref) {
  let cursor;
  for (;;) {
    let query = ref.orderBy(FieldPath.documentId()).limit(200);
    if (cursor) query=query.startAfter(cursor);
    const page=await query.get();
    if (page.empty) break;
    for (const document of page.docs) {
      const line=JSON.stringify({ path: document.ref.path,data:encode(document.data()) }) + '\n';
      if (!stream.write(line)) await once(stream, 'drain');
      count++;
      const children=await document.ref.listCollections();
      for (const child of children.sort((a,b)=>a.id.localeCompare(b.id))) await exportCollection(child);
    }
    cursor=page.docs.at(-1);
    if (page.size < 200) break;
  }
}
try {
  const roots=await db.listCollections();
  for (const root of roots.sort((a,b)=>a.id.localeCompare(b.id))) await exportCollection(root);
  stream.end();
  await once(stream,'finish');
  process.stdout.write(JSON.stringify({ documents:count,output:resolve(target) })+'\n');
} catch (error) {
  stream.destroy();
  throw error;
}
