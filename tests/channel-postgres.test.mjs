import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {executePlatform} from '../server/neon/platform.mjs';

// Explicit opt-in: run against an isolated Neon branch, never the deployed database.
test('channel creation against PostgreSQL with restricted runtime and a non-admin account', {skip:!process.env.CHANNEL_TEST_DATABASE_URL_FILE},async()=>{
 const url=new URL((await readFile(process.env.CHANNEL_TEST_DATABASE_URL_FILE,'utf8')).trim());
 assert.match(url.hostname,/\.neon\.tech$/);assert.ok(!url.hostname.startsWith('ep-icy-night-b6fvg1ni'));
 url.search='';const c=new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:true}});await c.connect();
 const subject='5f2da840-1097-469d-b442-10d089153186';const identity={subject,authProvider:'neon',emailVerified:true};
 try{
  for(const playbackURL of ['https://www.twitch.tv/alanzoka','https://kick.com/example','https://www.youtube.com/watch?v=dQw4w9WgXcQ']){
   await c.query('begin');
   // All channel/live writes are rolled back on this isolated branch.
   assert.equal((await c.query('select current_user')).rows[0].current_user,'zytrix_runtime');
   assert.equal((await c.query('select count(*)::int n from public.admins where user_id=$1 and active',[subject])).rows[0].n,0);
   for(const data of [{playbackURL:'https://www.twitch.tv/'},{playbackURL,ownerUid:'00000000-0000-4000-8000-000000000000'},{playbackURL,owner_id:subject},{playbackURL,streamerUid:subject}])await assert.rejects(executePlatform(c,identity,'channel.create',data),e=>e.status===400);
   await assert.rejects(executePlatform(c,identity,'documents.write',{path:['channels','00000000-0000-4000-8000-000000000000'],operation:'set',data:{channelName:'victim'}}),e=>e.status===403);
   const created=await executePlatform(c,identity,'channel.create',{playbackURL});assert.equal(created.created,true);assert.equal(created.channelId,subject);
   const duplicate=await executePlatform(c,identity,'channel.create',{playbackURL:'https://kick.com/different'});assert.equal(duplicate.created,false);assert.equal(duplicate.streamId,created.streamId);
   const rows=(await c.query('select ch.owner_id,l.owner_id live_owner,l.playback_url,l.status from public.channels ch join public.lives l on l.channel_id=ch.id where ch.owner_id=$1',[subject])).rows;
   assert.equal(rows.length,1);assert.equal(rows[0].owner_id,subject);assert.equal(rows[0].live_owner,subject);assert.equal(rows[0].playback_url,playbackURL);assert.equal(rows[0].status,'created');
   assert.equal((await executePlatform(c,identity,'channel.mine',{})).lives.length,1);
   await c.query('rollback');
  }
  // Force failure of the second write and prove the enclosing transaction is atomic.
  await c.query('begin');
  const failing={query(sql,args){if(sql.startsWith('insert into public.lives'))throw Error('simulated live insert failure');return c.query(sql,args);}};
  await assert.rejects(executePlatform(failing,identity,'channel.create',{playbackURL:'https://www.twitch.tv/alanzoka'}),/simulated/);await c.query('rollback');
  assert.equal((await c.query('select count(*)::int n from public.channels where owner_id=$1',[subject])).rows[0].n,0);
  // A concurrent request must wait for the account lock before creating anything.
  const second=new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:true}});await second.connect();
  try{
   await c.query('begin');await executePlatform(c,identity,'channel.create',{playbackURL:'https://www.twitch.tv/alanzoka'});
   await second.query('begin');let settled=false;
   const pending=executePlatform(second,identity,'channel.create',{playbackURL:'https://www.twitch.tv/alanzoka'}).finally(()=>{settled=true;});
   await c.query('select pg_sleep(0.15)');assert.equal(settled,false);
   await c.query('rollback');assert.equal((await pending).created,true);await second.query('rollback');
  }finally{await second.query('rollback').catch(()=>{});await second.end();}
 }finally{await c.query('rollback').catch(()=>{});await c.end();}
});
