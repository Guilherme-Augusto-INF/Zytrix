import test from 'node:test';
import assert from 'node:assert/strict';
import {actor,executePlatform} from '../server/neon/platform.mjs';
import {readContext,isReadAction} from '../server/neon/read-context.mjs';
const identity={subject:'11111111-1111-4111-8111-111111111111',authProvider:'neon',emailVerified:true};
test('read context is request scoped, shares read locks and never caches verification',async()=>{
 const calls=[];
 const c={async query(sql){calls.push(sql);return sql.includes('select i.id')?{rowCount:1,rows:[{id:identity.subject,admin:false}]}:{rowCount:0,rows:[]};}};
 const scoped=readContext(c);
 await actor(scoped,identity);await actor(scoped,identity);
 assert.equal(calls.length,3);assert.match(calls[0],/lock_shared/);
 assert.match(calls[1],/adm.revoked_at is null/);
 await assert.rejects(actor(scoped,{...identity,emailVerified:false},true),e=>e.status===403);
 await actor(readContext(c),identity);assert.equal(calls.length,6);
 await actor(c,identity);assert.match(calls[6],/pg_advisory_xact_lock\(/);
});
test('common and anonymous readers cannot reach administrative actions',async()=>{
 const c={async query(sql){return sql.includes('select i.id')?{rowCount:1,rows:[{id:identity.subject,admin:false}]}:{rowCount:0,rows:[]};}};
 for(const action of ['admin.overview','admin.chat-summary']){
  await assert.rejects(executePlatform(readContext(c),identity,action,{}),e=>e.status===403);
  await assert.rejects(executePlatform(readContext(c),null,action,{}),e=>e.status===401);
 }
 for(const action of ['account.delete','profile.update','documents.write','documents.batch','wallet.ensure','support.send','auth.logout','progress.record'])assert.equal(isReadAction(action),false);
});
