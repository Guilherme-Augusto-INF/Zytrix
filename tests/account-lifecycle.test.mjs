import test from 'node:test';import assert from 'node:assert/strict';import {deleteAccount} from '../server/neon/account-lifecycle.mjs';import {acquireRealtime} from '../server/neon/sse-limits.mjs';
const noDb={query(){assert.fail('Unexpected query');}};
test('deletion derives identity server-side and rejects missing auth/confirmation',async()=>{
 await assert.rejects(deleteAccount(noDb,null,{}),e=>e.status===401);
 await assert.rejects(deleteAccount(noDb,{authProvider:'neon'},{}),e=>e.code==='invalid_input');
});
test('already deleted account returns idempotently without destructive writes',async()=>{
 const calls=[];const c={async query(sql){calls.push(sql);return {rows:[{id:'internal',deleted_at:new Date()}]};}};
 assert.deepEqual(await deleteAccount(c,{authProvider:'neon',subject:'verified'},{confirmation:'EXCLUIR',requestKey:'valid-request-key-123'}),{deleted:true,replayed:true});
 assert.equal(calls.length,2);assert.ok(calls[1].includes('user_id=$1::uuid'));assert.ok(calls.every(x=>x.startsWith('select')));
});
test('SSE slots bound users/process and release expired/disconnected clients',()=>{
 const a=acquireRealtime('test',{now:1,perUser:1});assert.ok(a);assert.equal(acquireRealtime('test',{now:2,perUser:1}),null);
 a();const b=acquireRealtime('test',{now:3,maximum:1});assert.ok(b);assert.equal(acquireRealtime('other',{now:4,maximum:1}),null);
 const c=acquireRealtime('other',{now:30004,maximum:1});assert.ok(c);b();c();
});
