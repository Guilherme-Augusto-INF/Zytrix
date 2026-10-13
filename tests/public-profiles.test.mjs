import test from 'node:test';
import assert from 'node:assert/strict';
import {executePlatform,ApiError} from '../server/neon/platform.mjs';
import {publicFields} from '../server/neon/public-profiles.mjs';
import {publicProfileUrl} from '../assets/js/profile-url.js';
import {isReadAction} from '../server/neon/read-context.mjs';
const uid='12345678-1234-4234-8234-123456789012';
const profile={uid,name:'<script>alert(1)</script>',username:'streamer',photoURL:'javascript:alert(1)',bio:'<&>"'.repeat(125),createdAt:'2026-10-01',email:'private',balance:999,sessionToken:'secret',admin:true};
function database(values){const queries=[];return {queries,async query(sql,args){queries.push({sql,args});const rows=values.shift()??[];return {rows,rowCount:rows.length};}};}
test('public identifiers allow immutable UUIDs only and are normalized',async()=>{
 for(const value of [null,'','../admin','https://evil.test','1234',"' OR 1=1",['uid']]){
  assert.equal(publicProfileUrl(value),'');await assert.rejects(executePlatform(database([]),null,'profile.public',{uid:value}),e=>e instanceof ApiError&&e.code==='invalid_uid');
 }
 assert.equal(publicProfileUrl(uid),'/usuario.html?uid='+uid);
});
test('public projection excludes private fields and rejects unsafe image URLs',()=>{
 assert.deepEqual(Object.keys(publicFields(profile)),['uid','name','username','photoURL','bio','createdAt']);
 assert.equal(publicFields(profile).photoURL,'');assert.equal(publicFields(profile).bio.length,500);
});
test('anonymous public profile returns real social stats and channel using parameterized reads',async()=>{
 const db=database([[profile],[{id:'channel',name:'Canal',liveId:'live'}],[{followers:4,following:2}]]);
 const result=await executePlatform(db,null,'profile.public',{uid});
 assert.equal(result.stats.followers,4);assert.equal(result.channel.liveId,'live');assert.equal(result.profile.email,undefined);
 assert.equal(db.queries.length,3);
 for(const q of db.queries){assert.deepEqual(q.args,[uid]);assert.ok(!q.sql.includes(uid));assert.ok(!/insert|update |delete from/i.test(q.sql));}
 assert.match(db.queries[0].sql,/disabled_at is null/);assert.match(db.queries[0].sql,/deleted_at is null/);assert.match(db.queries[0].sql,/banned,false/);assert.match(db.queries[0].sql,/pp.type='ban'/);
 assert.match(db.queries[1].sql,/l.visibility='public'/);assert.match(db.queries[1].sql,/l.status='live'/);assert.match(db.queries[1].sql,/c.visibility='public'/);
});
test('unavailable profiles disclose no channel or social data',async()=>{
 const db=database([[]]);assert.deepEqual(await executePlatform(db,null,'profile.public',{uid}),{profile:null});assert.equal(db.queries.length,1);
});
test('ordinary users do not require channel creation or fabricated stream data',async()=>{
 const result=await executePlatform(database([[{...profile,photoURL:''}],[],[{followers:0,following:0}]]),null,'profile.public',{uid});assert.equal(result.channel,null);assert.deepEqual(result.stats,{followers:0,following:0});
});
test('network is bounded, paginated and exposes public profile projections only',async()=>{
 for(const kind of ['followers','following']){
 const db=database([[{exists:true}],Array.from({length:21},()=>profile)]);
 const result=await executePlatform(db,null,'profile.network',{uid,kind,offset:20});assert.equal(result.profiles.length,20);assert.equal(result.hasMore,true);assert.equal(result.profiles[0].email,undefined);assert.deepEqual(db.queries.at(-1).args,[uid,20]);assert.match(db.queries.at(-1).sql,/limit 21 offset \$2/);
 }
 for(const data of [{uid,kind:'sql'},{uid,kind:'followers',offset:-1},{uid,kind:'following',offset:1001}])await assert.rejects(executePlatform(database([]),null,'profile.network',data),e=>e.code==='invalid_input');
});
test('new public actions are enforced as read-only; writes still require verified auth',async()=>{
 for(const action of ['profile.public','profile.network','profile.search'])assert.equal(isReadAction(action),true);
 await assert.rejects(executePlatform(database([]),null,'follow.set',{channelId:'channel',following:true}),e=>e.status===401);
});
test('follow writes serialize repeated requests and reject self-follow',async()=>{
 const identity={subject:uid,authProvider:'neon',emailVerified:true};
 const own=database([[],[{id:uid,admin:false}],[],[{id:'channel',owner_id:uid}]]);
 await assert.rejects(executePlatform(own,identity,'follow.set',{channelId:'channel',following:true}),e=>e.code==='invalid_channel');
 for(const following of [true,false]){
 const db=database([[],[{id:uid,admin:false}],[],[{id:'channel',owner_id:'another-user'}],[],[]]);
 assert.deepEqual(await executePlatform(db,identity,'follow.set',{channelId:'channel',following}),{following});
 assert.deepEqual(db.queries.at(-2).args,['follow:'+uid+':channel']);assert.match(db.queries.at(-2).sql,/pg_advisory_xact_lock/);
 assert.match(db.queries.at(-1).sql,following?/on conflict do nothing/:/delete from public.follows/);
 }
});

test('legacy adapter denies anonymous bulk enumeration and validates direct identifiers',async()=>{
 await assert.rejects(executePlatform(database([]),null,'documents.read',{path:['profiles']}),e=>e.status===403);
 await assert.rejects(executePlatform(database([]),null,'documents.read',{path:['profiles',"' OR 1=1"]}),e=>e.code==='invalid_uid');
 const db=database([[{id:uid,uid,username:'Streamer'}]]);const result=await executePlatform(db,null,'documents.read',{path:['profiles',uid]});assert.equal(result.documents.length,1);
 assert.match(db.queries[0].sql,/disabled_at is null/);assert.match(db.queries[0].sql,/pn.banned/);assert.match(db.queries[0].sql,/case when i.id=\$2::uuid/);assert.deepEqual(db.queries[0].args,[uid,null]);
});
test('profile.get cannot bypass immutable identifier validation; public search is bounded',async()=>{
 await assert.rejects(executePlatform(database([]),null,'profile.get',{uid:'not-a-uuid'}),e=>e.code==='invalid_uid');
 await assert.rejects(executePlatform(database([]),null,'profile.search',{query:'a'}),e=>e.code==='invalid_input');
 const db=database([[]]);await executePlatform(db,null,'profile.search',{query:'streamer'});assert.deepEqual(db.queries[0].args,['streamer']);assert.match(db.queries[0].sql,/limit 20/);
});
