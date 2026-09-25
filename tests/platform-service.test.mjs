import test from 'node:test';
import assert from 'node:assert/strict';
import { executePlatform, ApiError } from '../server/neon/platform.mjs';
import handler from '../api/v1/platform.js';
const noDb={query(){throw new Error('Unexpected database access');}};
test('private actions reject absent and unverified identities before database access',async()=>{
  for(const action of ['me','wallet.get','wallet.ensure','profile.update','chat.send','chat.delete','support.send','follow.set']){
    await assert.rejects(executePlatform(noDb,null,action,{}),e=>e instanceof ApiError&&e.status===401);
  }
  for(const action of ['wallet.ensure','profile.update','chat.send','chat.delete','support.send','follow.set']){
    await assert.rejects(executePlatform(noDb,{uid:'test',emailVerified:false},action,{}),e=>e.code==='verified_email_required');
  }
});
test('unknown actions and invalid payloads fail closed',async()=>{
  await assert.rejects(executePlatform(noDb,null,'sql',{query:'select *'}),e=>e.code==='unknown_action');
  await assert.rejects(executePlatform(noDb,null,'profile.get',[]),e=>e.code==='invalid_input');
});
test('platform remains disabled by default and does not disclose configuration',async()=>{
  const old=process.env.ZYTRIX_POSTGRES_STAGING;delete process.env.ZYTRIX_POSTGRES_STAGING;
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(v){this.code=v;return this;},json(v){this.body=v;return this;}};
  try{await handler({method:'POST',headers:{}},res);assert.equal(res.code,503);assert.deepEqual(res.body,{error:'staging_disabled'});assert.equal(res.headers['Cache-Control'],'no-store');}
  finally{if(old!==undefined)process.env.ZYTRIX_POSTGRES_STAGING=old;}
});
