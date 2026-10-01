import pg from 'pg';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFile,writeFile} from 'node:fs/promises';
import {validateStagingUrl} from './staging-target.mjs';import {executePlatform} from '../../server/neon/platform.mjs';
const [file,reportFile]=process.argv.slice(2);if(!file||!reportFile)throw Error('Usage: test-account-lifecycle.mjs <private-owner-file> <private-report>');
const c=new pg.Client({connectionString:validateStagingUrl((await readFile(file,'utf8')).trim()),ssl:{rejectUnauthorized:true}}),checks=[];
try{await c.connect();await c.query('begin');
 const fixtures=[];
 for(let i=0;i<4;i++){
  const f={id:randomUUID(),subject:randomUUID(),uid:'lifecycle-'+randomUUID(),channel:randomUUID(),live:randomUUID(),token:'fixture-session-'+randomUUID()};fixtures.push(f);
  await c.query('insert into public.identities(id,firebase_uid) values($1,$2)',[f.id,f.uid]);
  await c.query("insert into public.user_accounts(user_id,firebase_uid,zytrix_id,email,provider) values($1,$2,$3,$4,'password')",[f.id,f.uid,'ZY-'+f.id,f.id+'@example.invalid']);
  await c.query("insert into public.profiles(user_id,firebase_uid,username,bio) values($1,$2,$3,'Private bio')",[f.id,f.uid,'fixture_'+f.id.slice(0,18)]);
  await c.query('insert into neon_auth."user"(id,name,email,"emailVerified") values($1,$2,$3,true)',[f.subject,'Fixture',f.subject+'@example.invalid']);
  await c.query('insert into neon_auth.session(id,"userId",token,"expiresAt","createdAt","updatedAt") values($1,$2,$3,now()+interval \'1 hour\',now(),now())',[randomUUID(),f.subject,f.token]);
  await c.query("insert into private.external_auth_identities(provider,subject,user_id) values('neon',$1,$2)",[f.subject,f.id]);
  if(i>0)await c.query('insert into public.wallets(user_id,balance,total_sent,total_received) values($1,50,10,20)',[f.id]);
 }
 const full=fixtures[3],other=fixtures[2];
 await c.query("insert into public.channels(id,firebase_id,owner_id,name,slug) values($1,$2,$3,'Fixture channel',$4)",[full.channel,full.uid,full.id,'fixture-'+full.channel]);
 await c.query("insert into public.lives(id,firebase_id,channel_id,owner_id,title,playback_url,status,started_at,vod_url) values($1,$2,$3,$4,'Fixture live','https://twitch.tv/test','live',now(),'https://twitch.tv/test')",[full.live,'lifecycle-'+full.live,full.channel,full.id]);
 const message=randomUUID();await c.query("insert into public.chat_messages(id,live_id,sender_id,text) values($1,$2,$3,'Evidence retained')",[message,full.live,full.id]);
 await c.query("insert into public.clips(live_id,streamer_id,creator_id,title,moment_seconds,source_url) values($1,$2,$2,'Fixture clip',0,'https://twitch.tv/test')",[full.live,full.id]);
 await c.query("insert into public.zy_coin_transactions(from_user_id,to_user_id,amount,type,status,idempotency_key,live_id) values($1,$2,10,'stream_support','completed',$3,$4)",[fixtures[1].id,full.id,randomUUID(),full.live]);
 await c.query("insert into public.reports(reporter_id,target_type,target_profile_id,reason) values($1,'profile',$2,'spam')",[other.id,full.id]);
 await c.query('insert into public.user_preferences(user_id) values($1)',[full.id]);
 await c.query('insert into public.follows(follower_id,channel_id) values($1,$2)',[other.id,full.channel]);
 await c.query('set local role zytrix_staging_app');assert.equal((await c.query('select current_user as role')).rows[0].role,'zytrix_staging_app');
 const policy=await executePlatform(c,null,'policies.current',{});assert.equal(policy.config.scope,'staging');assert.equal(policy.policies.length,4);checks.push('public versioned staging-only draft snapshots and authoritative signup configuration');
 const operation=f=>executePlatform(c,{authProvider:'neon',subject:f.subject,emailVerified:true,sessionCreatedAt:Date.now()},'account.delete',{confirmation:'EXCLUIR',requestKey:randomUUID(),uid:other.uid});
 await assert.rejects(executePlatform(c,null,'account.delete',{confirmation:'EXCLUIR',requestKey:randomUUID()}),e=>e.code==='authentication_required');checks.push('anonymous deletion denied');
 await assert.rejects(executePlatform(c,{authProvider:'neon',subject:full.subject,emailVerified:true,sessionCreatedAt:0},'account.delete',{confirmation:'EXCLUIR',requestKey:randomUUID()}),e=>e.code==='recent_login_required');checks.push('stale session denied');
 await assert.rejects(operation({subject:randomUUID()}),e=>e.code==='account_not_migrated');checks.push('nonexistent/unlinked account denied');
 for(let i=0;i<fixtures.length;i++){const f=fixtures[i];assert.equal((await operation(f)).deleted,true);assert.equal((await operation(f)).replayed,true);
  assert.ok((await c.query('select disabled_at,deleted_at from public.user_accounts where user_id=$1',[f.id])).rows[0].deleted_at);
  assert.equal((await c.query('select private.active_auth_session($1,$2) as active',[f.subject,f.token])).rows[0].active,null);
  if(i>0){const w=(await c.query('select balance,total_sent,total_received from public.wallets where user_id=$1',[f.id])).rows[0];assert.deepEqual(w,{balance:'50',total_sent:'10',total_received:'20'});}
  checks.push(['normal deletion and repeat','wallet retained and repeat','second wallet/identity retained','content/channel/live/transactions retained and repeat'][i]);
 }
 assert.equal((await c.query('select status,deleted_at from public.lives where id=$1',[full.live])).rows[0].status,'ended');
 assert.equal((await c.query('select count(*)::int as n from public.zy_coin_transactions where live_id=$1',[full.live])).rows[0].n,1);
 assert.equal((await c.query('select count(*)::int as n from public.reports where target_profile_id=$1',[full.id])).rows[0].n,1);
 assert.equal((await c.query('select count(*)::int as n from private.account_deletion_evidence where user_id=$1',[full.id])).rows[0].n,1);
 assert.equal((await c.query('select count(*)::int as n from public.user_preferences where user_id=$1',[full.id])).rows[0].n,0);
 checks.push('financial, report and restricted chat evidence retained; personal preferences removed');
 await assert.rejects(executePlatform(c,{authProvider:'neon',subject:full.subject,emailVerified:true},'wallet.get',{}),e=>e.code==='account_not_migrated');checks.push('deleted account denied after lifecycle');
 await c.query('rollback');await writeFile(reportFile,JSON.stringify({status:'PASS',checks,fixtures:'ROLLED_BACK'},null,2));console.log(JSON.stringify({status:'PASS',checks:checks.length,fixtures:'ROLLED_BACK'}));
}catch(e){await c.query('rollback').catch(()=>{});await writeFile(reportFile,JSON.stringify({status:'FAIL',checks,code:e.code,message:e.message,stack:e.stack},null,2));console.log(JSON.stringify({status:'FAIL',code:e.code??e.name}));process.exitCode=1;}finally{await c.end();}
