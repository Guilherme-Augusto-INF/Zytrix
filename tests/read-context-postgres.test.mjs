import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';
import {actor,executePlatform} from '../server/neon/platform.mjs';
import {readContext} from '../server/neon/read-context.mjs';
import {runtimeConnection} from '../server/neon/platform-pool.mjs';
test('restricted runtime: simultaneous readers, exclusive mutation coordination and own-only data',{
 skip:!process.env.TEST_PERF_DATABASE_URL||!process.env.TEST_PERF_USER_ID
},async()=>{
 const pool=new pg.Pool({connectionString:runtimeConnection(process.env.TEST_PERF_DATABASE_URL),ssl:{rejectUnauthorized:true},max:3});
 const identity={subject:process.env.TEST_PERF_USER_ID,authProvider:'neon',emailVerified:true};
 const clients=[];
 try{
  for(let i=0;i<3;i++){const c=await pool.connect();clients.push(c);await c.query('begin read only');await c.query("set local lock_timeout='1s'");}
  const [a,b]=await Promise.all(clients.slice(0,2).map(c=>actor(readContext(c),identity)));
  assert.equal(a.admin,false);assert.equal(b.id,a.id);
  const lock=await clients[2].query('select pg_try_advisory_xact_lock(hashtextextended($1,0)) as acquired',['account:'+identity.subject]);
  assert.equal(lock.rows[0].acquired,false);
  const scoped=readContext(clients[0]);
  for(const action of ['admin.overview','admin.chat-summary'])await assert.rejects(executePlatform(scoped,identity,action,{}),e=>e.status===403);
  await assert.rejects(executePlatform(scoped,identity,'documents.read',{path:['users','00000000-0000-4000-8000-000000000000']}),e=>e.status===403);
  const own=await executePlatform(scoped,identity,'documents.read',{path:['wallets',identity.subject]});assert.ok(Array.isArray(own.documents));
  for(const c of clients.slice(0,2))await c.query('rollback');
  const unlocked=await clients[2].query('select pg_try_advisory_xact_lock(hashtextextended($1,0)) as acquired',['account:'+identity.subject]);assert.equal(unlocked.rows[0].acquired,true);
 }finally{for(const c of clients){await c.query('rollback').catch(()=>{});c.release();}await pool.end();}
});
