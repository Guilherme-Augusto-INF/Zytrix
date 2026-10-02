import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';

export async function ensureParent(file) {
  await mkdir(dirname(file), { recursive: true });
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function readJsonLines(file) {
  const rows = [];
  const input = createReadStream(file, 'utf8');
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    if (line.trim()) rows.push(JSON.parse(line));
  }
  return rows;
}

export async function writeJsonLines(file, rows) {
  await ensureParent(file);
  const stream = createWriteStream(file, { encoding: 'utf8' });
  const sorted = [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  for (const row of sorted) stream.write(`${JSON.stringify(row)}\n`);
  await new Promise((resolve, reject) => stream.end(error => error ? reject(error) : resolve()));
}

export async function writeJson(file, value) {
  await ensureParent(file);
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function tableFile(directory, table) {
  return join(directory, `${table}.jsonl`);
}

export function decode(value) {
  if (Array.isArray(value)) return value.map(decode);
  if (!value || typeof value !== 'object') return value;
  if (value.__type === 'timestamp') return value.value;
  if (value.__type === 'reference') return value.path;
  if (value.__type === 'bytes') return value.base64;
  if (value.__type === 'geopoint') return { latitude: value.latitude, longitude: value.longitude };
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, decode(nested)]));
}

export function cleanUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

