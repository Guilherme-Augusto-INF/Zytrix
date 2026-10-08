import test from 'node:test';import assert from 'node:assert/strict';
import {createPlatformClient} from '../assets/js/staging-client.js';
test('coalesces only concurrent identical reads across consumers, without response caching',async()=>{
 const original=globalThis.fetch;let calls=0,release;const releases=[];
 let user={uid:'one',sessionToken:'session-one',getIdToken:async()=> 'test'};
 globalThis.fetch=async()=>{calls++;await new Promise(r=>{release=r;releases.push(r);});return {ok:true,json:async()=>({value:1})};};
 try{
  const a=createPlatformClient(()=>user),b=createPlatformClient(()=>user);
  const first=a('progress.get'),second=b('progress.get');
  await new Promise(r=>setImmediate(r));assert.equal(calls,1);release();await Promise.all([first,second]);
  const third=b('progress.get');await new Promise(r=>setImmediate(r));assert.equal(calls,2);release();await third;
  const stale=a('progress.get');await new Promise(r=>setImmediate(r));user={...user,sessionToken:'session-two'};release();await assert.rejects(stale,e=>e.code==='authentication_changed');
  const writes=[a('progress.record'),b('progress.record')];await new Promise(r=>setImmediate(r));assert.equal(calls,5);
  // Each mutation owns a separate fetch (completion is irrelevant to coalescing).
  releases.forEach(r=>r());await Promise.all(writes);
 }finally{globalThis.fetch=original;}
});
