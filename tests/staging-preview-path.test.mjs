import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {resolveSafePreviewPath} from '../scripts/staging-static-path.mjs';

const root=resolve('hypothetical-zytrix-checkout');
test('local staging preview serves only its isolated HTML and assets',()=>{
  assert.equal(resolveSafePreviewPath(root,'/'),resolve(root,'staging-validation.html'));
  assert.equal(resolveSafePreviewPath(root,'/staging-validation.html'),resolve(root,'staging-validation.html'));
  assert.equal(resolveSafePreviewPath(root,'/staging.html'),resolve(root,'staging.html'));
  assert.equal(resolveSafePreviewPath(root,'/assets/js/staging-validation.js'),
    resolve(root,'assets/js/staging-validation.js'));
  assert.equal(resolveSafePreviewPath(root,'/assets/css/staging-validation.css'),
    resolve(root,'assets/css/staging-validation.css'));
});
test('encoded traversal cannot expose app endpoints, SQL or private files',()=>{
  for(const attempt of [
    '/api/v1/platform.js','/server/neon/platform.mjs','/database/neon/001_foundation.sql',
    '/.env.local','/staging-validation.html/../api/v1/platform.js',
    '/assets/%2e%2e%2fapi%2fv1%2fplatform.js',
    '/assets/%2e%2e%2Fserver%2Fneon%2Fpool.mjs',
    '/assets/%252e%252e%252fserver%252fneon%252fplatform.mjs',
    '/assets/../../server/neon/platform.mjs',
    '/assets/%5c..%5capi%5cv1%5cplatform.js',
    '/assets/%00oops.js','/assets//js/file.js','/assets/%',
    '/assets\\..\\api/v1/platform.js'
  ]) {
    assert.equal(resolveSafePreviewPath(root,attempt),null,attempt);
  }
});
