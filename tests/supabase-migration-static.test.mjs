import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const migrationDirectory = new URL('../supabase/migrations/', import.meta.url);

test('all SECURITY DEFINER routines pin an empty search_path', async () => {
  const files = (await readdir(migrationDirectory)).filter(file => file.endsWith('.sql'));
  const sql = (await Promise.all(files.map(file => readFile(new URL(file, migrationDirectory), 'utf8')))).join('\n');
  const routines = sql.split(/create or replace function /i).slice(1);
  for (const routine of routines) {
    const header = routine.slice(0, routine.indexOf('as $$'));
    if (/security definer/i.test(header)) assert.match(header, /set search_path\s*=\s*''/i);
  }
});

test('every application public table is named in the RLS enable list', async () => {
  const files = (await readdir(migrationDirectory)).filter(file => file.endsWith('.sql')).sort();
  const foundation = await readFile(new URL(files.find(file => file.includes('foundation')), migrationDirectory), 'utf8');
  const security = await readFile(new URL(files.find(file => file.includes('security')), migrationDirectory), 'utf8');
  const publicTables = [...foundation.matchAll(/create table public\.([a-z_]+)/g)].map(match => match[1]);
  for (const table of publicTables) assert.match(security, new RegExp(`'${table}'`), `missing RLS enable entry for ${table}`);
});

test('browser modules never contain a Supabase secret/service-role key', async () => {
  const files = (await readdir(new URL('../assets/js/', import.meta.url))).filter(file => file.endsWith('.js'));
  const source = (await Promise.all(files.map(file => readFile(new URL(`../assets/js/${file}`, import.meta.url), 'utf8')))).join('\n');
  assert.doesNotMatch(source, /service[_-]?role|sb_secret_/i);
});

