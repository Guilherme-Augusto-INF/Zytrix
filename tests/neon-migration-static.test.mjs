import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../database/neon/001_foundation.sql',import.meta.url),'utf8');
test('Neon schema does not depend on Supabase auth identities',()=> {
  assert.match(sql,/create table public\.identities\s*\(/i);
  assert.doesNotMatch(sql,/auth\.users|from public, anon, authenticated|supabase_user_id/i);
  for (const table of ['user_accounts','profiles','lives','chat_messages','wallets','zy_coin_transactions','reports','audit_logs']) {
    assert.match(sql,new RegExp('create table public\\.'+table+'\\s*\\(','i'));
  }
});
