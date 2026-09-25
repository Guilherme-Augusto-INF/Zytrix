import test from 'node:test';
import assert from 'node:assert/strict';
import { stagingHost, validateStagingUrl } from '../staging-target.mjs';
const url = `postgresql://test:fake@${stagingHost}/neondb?sslmode=require&channel_binding=require`;
test('accepts only verified direct staging target and leaves TLS to explicit client config', () => {
  assert.equal(new URL(validateStagingUrl(url)).search, '');
  for (const bad of [url.replace(stagingHost,'production.example.test'), url.replace('/neondb','/other'),
    url.replace('sslmode=require','sslmode=disable'),url+'&host=production.example.test',url.replace('test:fake','test'),
    url.replace(stagingHost,stagingHost.replace('.c-2','-pooler.c-2'))]) assert.throws(()=>validateStagingUrl(bad));
});
