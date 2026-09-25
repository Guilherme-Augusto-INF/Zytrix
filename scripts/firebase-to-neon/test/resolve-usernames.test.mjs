import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApprovedUsername } from '../resolve-usernames.mjs';
const rows = [ { path:'profiles/a', data:{username:'prendedor', bio:'preserved'} }, { path:'profiles/b', data:{username:'prendedor'} } ];
const users = [{uid:'a',createdAt:'2020-01-01T00:00:00Z'}, {uid:'b',createdAt:'2021-01-01T00:00:00Z'}];
test('approved rename follows Auth age regardless of export ordering and preserves original', () => {
  const original = structuredClone(rows);
  const result = resolveApprovedUsername([...rows].reverse(), users);
  assert.equal(result.rows.find(r=>r.path==='profiles/a').data.username,'prendedor');
  assert.equal(result.rows.find(r=>r.path==='profiles/b').data.username,'prendedor-2');
  assert.deepEqual(rows,original);
});
test('refuses occupied destination, invalid/tied dates and missing Auth', () => {
  assert.throws(()=>resolveApprovedUsername([...rows,{path:'profiles/c',data:{username:'PRENDEDOR-2'}}],users));
  assert.throws(()=>resolveApprovedUsername(rows,[users[0],{...users[1],createdAt:users[0].createdAt}]));
  assert.throws(()=>resolveApprovedUsername(rows,[users[0],{...users[1],createdAt:'invalid'}]));
  assert.throws(()=>resolveApprovedUsername(rows,[users[0]]));
});
