import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canRecoverProfile, recoveryPayload } from '../assets/js/staging-recovery.js';

test('only verified existing accounts with a missing profile may see recovery', () => {
  assert.equal(canRecoverProfile({ email:'private@example.invalid', username:null }, true), true);
  assert.equal(canRecoverProfile({ username:null }, false), false);
  assert.equal(canRecoverProfile({ username:'Exists' }, true), false);
  assert.equal(canRecoverProfile(null,true),false);
});
test('a username is chosen by the owner after explicit confirmation', () => {
  assert.deepEqual(recoveryPayload('  New_name-2 ', 'Minha bio',true),{username:'New_name-2',bio:'Minha bio'});
  assert.throws(()=>recoveryPayload('Novo','',false),/consent_required/);
  for(const name of ['', 'a', 'nome com espaço', 'admin<test>', 'x'.repeat(31)]) {
    assert.throws(()=>recoveryPayload(name,'',true),/invalid_username/);
  }
  assert.throws(()=>recoveryPayload('Novo','x'.repeat(501),true),/invalid_bio/);
});
