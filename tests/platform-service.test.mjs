import test from 'node:test';
import assert from 'node:assert/strict';
import { executePlatform, ApiError } from '../server/neon/platform.mjs';
import handler from '../api/v1/platform.js';
import { platformEnabled } from '../server/neon/platform-pool.mjs';
const noDb={query(){throw new Error('Unexpected database access');}};

test('production refuses the staging application even when its flags are configured',()=>{
 const values=['ZYTRIX_POSTGRES_STAGING','ZYTRIX_STAGING_DATABASE_URL','VERCEL_ENV'].map(name=>[name,process.env[name]]);
 try{process.env.ZYTRIX_POSTGRES_STAGING='true';process.env.ZYTRIX_STAGING_DATABASE_URL='configured';process.env.VERCEL_ENV='production';assert.equal(platformEnabled(),false);}
 finally{for(const[name,value]of values)if(value===undefined)delete process.env[name];else process.env[name]=value;}
});
test('private actions reject absent and unverified identities before database access',async()=>{
  for(const action of ['me','wallet.get','wallet.ensure','profile.update','profile.recover','chat.send','chat.delete','support.send','follow.set','channel.mine','channel.save','live.create','categories.followed','categories.follow','discovery.context']){
    await assert.rejects(executePlatform(noDb,null,action,{}),e=>e instanceof ApiError&&e.status===401);
  }
  for(const action of ['wallet.ensure','profile.update','profile.recover','chat.send','chat.delete','support.send','follow.set','channel.save','live.create','categories.follow']){
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

test('profile recovery requires verified own identity and refuses synthetic history',async()=>{
  const id='11111111-1111-4111-8111-111111111111';
  const uid='valid-firebase-uid';
  const statements=[];
  const db={async query(sql,params){
    statements.push({sql,params});
    if(sql.includes('from public.identities i where i.firebase_uid'))return {rowCount:1,rows:[{id,firebase_uid:uid,admin:false}]};
    if(sql.includes('from public.moderation_penalties'))return {rowCount:0,rows:[]};
    if(sql.includes('from private.reserved_usernames'))return {rowCount:0,rows:[]};
    if(sql.includes('pg_advisory_xact_lock'))return {rowCount:1,rows:[{}]};
    if(sql.includes('from public.user_accounts'))return {rowCount:1,rows:[{one:1}]};
    if(sql.includes('from public.profiles'))return {rowCount:0,rows:[]};
    if(sql.includes('insert into public.profiles'))return {rowCount:1,rows:[{username:'Recuperado',bio:''}]};
    throw new Error('Unexpected SQL: '+sql);
  }};
  const result=await executePlatform(db,{uid,emailVerified:true},'profile.recover',{username:'Recuperado'});
  assert.deepEqual(result,{profile:{username:'Recuperado',bio:''},recovered:true});
  const insert=statements.find(x=>x.sql.includes('insert into public.profiles'));
  assert.deepEqual(insert.params,[id,uid,'Recuperado','']);
  assert.equal(statements.some(x=>/delete from public\.profiles/i.test(x.sql)),false);
});
test('username cooldown blocks early changes but permits bio-only updates',async()=>{
  const id='11111111-1111-4111-8111-111111111111',uid='valid-firebase-uid';
  const db={async query(sql){
    if(sql.includes('from public.identities i'))return {rowCount:1,rows:[{id,firebase_uid:uid,admin:false}]};
    if(sql.includes('from public.moderation_penalties')||sql.includes('from private.reserved_usernames'))return {rowCount:0,rows:[]};
    if(sql.includes('select username from public.profiles'))return {rowCount:1,rows:[{username:'OldName'}]};
    if(sql.includes("interval '7 days'"))return {rowCount:0,rows:[]};
    if(sql.includes('update public.profiles set bio='))return {rowCount:1,rows:[{username:'OldName',bio:'Novo texto'}]};
    throw new Error('Unexpected SQL: '+sql);
  }};
  await assert.rejects(executePlatform(db,{uid,emailVerified:true},'profile.update',{username:'NewName',bio:'Novo texto'}),e=>e.code==='username_cooldown'&&e.status===409);
  const unchanged=await executePlatform(db,{uid,emailVerified:true},'profile.update',{username:'OldName',bio:'Novo texto'});
  assert.equal(unchanged.profile.bio,'Novo texto');
});

test('invalid JSON and oversized Unicode payloads are rejected before authentication or connection',async()=>{
  const oldFlag=process.env.ZYTRIX_POSTGRES_STAGING,oldUrl=process.env.ZYTRIX_STAGING_DATABASE_URL,oldEnv=process.env.VERCEL_ENV;
  process.env.ZYTRIX_POSTGRES_STAGING='true';process.env.ZYTRIX_STAGING_DATABASE_URL='invalid-test-no-connection';process.env.VERCEL_ENV='preview';
  try{for(const body of ['{',JSON.stringify({action:'me',data:{value:'🔥'.repeat(5000)}})]){
    const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
    await handler({method:'POST',headers:{'content-type':'application/json'},body},res);
    assert.equal(res.code,400);assert.equal(res.body.error,'invalid_input');
  }}finally{for(const [name,value]of [['ZYTRIX_POSTGRES_STAGING',oldFlag],['ZYTRIX_STAGING_DATABASE_URL',oldUrl],['VERCEL_ENV',oldEnv]])if(value===undefined)delete process.env[name];else process.env[name]=value;}
});
