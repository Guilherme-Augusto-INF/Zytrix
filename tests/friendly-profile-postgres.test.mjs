import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import pg from 'pg';
import {executePlatform} from '../server/neon/platform.mjs';import {publicProfile} from '../server/neon/public-profiles.mjs';
import {createProfilePageHandler} from '../server/neon/profile-page.mjs';
const alpha='ef111111-1111-4111-8111-111111111111',beta='ef222222-2222-4222-8222-222222222222';
test('isolated PostgreSQL resolves names, retires old links and serializes competing renames',{skip:!process.env.FRIENDLY_PROFILE_DATABASE_URL_FILE},async()=>{
 const url=new URL((await readFile(process.env.FRIENDLY_PROFILE_DATABASE_URL_FILE,'utf8')).trim());
 assert.match(url.hostname,/\.neon\.tech$/);assert.ok(!url.hostname.startsWith('ep-icy-night-b6fvg1ni'));assert.equal(url.username,'zytrix_runtime');url.search='';
 const pool=new pg.Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true},max:3});
 const identity=subject=>({subject,authProvider:'neon',emailVerified:true});
 const suffix=Date.now().toString(36),newName='route_new_'+suffix,contest='route_race_'+suffix;
 const c=await pool.connect(),other=await pool.connect();
 try{
  assert.equal((await c.query('select current_user')).rows[0].current_user,'zytrix_runtime');
  const before=(await publicProfile(c,{uid:alpha})).profile;
  assert.ok(before);assert.equal((await publicProfile(c,{username:before.username.toUpperCase()})).profile.uid,alpha);
  await assert.rejects(executePlatform(c,null,'profile.update',{username:newName,bio:''}),e=>e.status===401);
  await c.query('begin');await c.query("update public.profiles set username_updated_at=now()-interval '8 days' where user_id=$1",[alpha]);
  await executePlatform(c,identity(alpha),'profile.update',{username:newName,bio:'fixture public bio'});await c.query('commit');
  assert.equal((await publicProfile(c,{username:newName})).profile.uid,alpha);
  assert.equal((await publicProfile(c,{username:before.username})).profile,null);
  await c.query('begin');await c.query("update public.profiles set username_updated_at=now()-interval '8 days' where user_id=$1",[beta]);
  await assert.rejects(executePlatform(c,identity(beta),'profile.update',{username:before.username,bio:''}),e=>e.code==='reserved_username');await c.query('rollback');
  // A competing rename cannot pass a stale reservation check then acquire a released name.
  await c.query('begin');await other.query('begin');
  await c.query("update public.profiles set username_updated_at=now()-interval '8 days' where user_id=$1",[alpha]);
  await other.query("update public.profiles set username_updated_at=now()-interval '8 days' where user_id=$1",[beta]);
  await executePlatform(c,identity(alpha),'profile.update',{username:contest,bio:''});
  const competing=executePlatform(other,identity(beta),'profile.update',{username:contest.toUpperCase(),bio:''}).then(()=>({ok:true}),error=>({error}));
  await c.query('commit');const loser=await competing;assert.equal(loser.ok,undefined);assert.equal(loser.error.code,'23505');await other.query('rollback');
  assert.equal((await publicProfile(c,{username:contest})).profile.uid,alpha);
  await c.query('begin');await c.query('update public.user_accounts set disabled_at=now() where user_id=$1',[alpha]);
  assert.equal((await publicProfile(c,{username:contest})).profile,null);assert.equal((await publicProfile(c,{uid:alpha})).profile,null);await c.query('rollback');
  const handler=createProfilePageHandler({pool:()=>pool,enabled:()=>true,allow:()=>true});
  const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},end(html){this.html=html;}});
  for(const method of ['GET','HEAD']){const res=response();await handler({method,url:'/@'+contest,headers:{authorization:'Bearer invalid-stale-session'}},res);assert.equal(res.code,200);if(method==='HEAD')assert.equal(res.html,'');else assert.ok(res.html.includes('https://zytrix-lives.vercel.app/@'+contest));}
  const legacy=response();await handler({method:'GET',url:'/usuario.html?uid='+alpha,headers:{}},legacy);assert.equal(legacy.code,307);assert.equal(legacy.headers.Location,'/@'+contest);
 }finally{await c.query('rollback').catch(()=>{});await other.query('rollback').catch(()=>{});c.release();other.release();await pool.end();}
});
