// Dedicated staging fixtures; owner only provisions/removes them. Operations use app credentials.
import pg from 'pg';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {validateStagingUrl} from './staging-target.mjs';import {executePlatform} from '../../server/neon/platform.mjs';
const [ownerFile,runtimeFile,reportFile]=process.argv.slice(2);
const config=async file=>({connectionString:validateStagingUrl((await readFile(file,'utf8')).trim()),ssl:{rejectUnauthorized:true}});
const admin=new pg.Client(await config(ownerFile)),runtimeConfig=await config(runtimeFile);
assert.equal(decodeURIComponent(new URL(runtimeConfig.connectionString).username),'zytrix_staging_app');
const people=[randomUUID(),randomUUID(),randomUUID()],uids=people.map(x=>'concurrency-'+x);
const channels=[randomUUID(),randomUUID()],lives=[randomUUID(),randomUUID()],liveIds=lives.map(x=>'concurrency-'+x);
let seeded=false,status='FAIL',cleanup=false;
const checks=[];
async function operation(index,amount,requestKey){const c=new pg.Client(runtimeConfig);try{await c.connect();assert.equal((await c.query('select current_user as role')).rows[0].role,'zytrix_staging_app');await c.query('begin');const result=await executePlatform(c,{uid:uids[0],emailVerified:true},'support.send',{liveId:liveIds[index],amount,requestKey});await c.query('commit');return {ok:true,index,...result};}catch(error){await c.query('rollback').catch(()=>{});if(error.code==='insufficient_balance')return {ok:false,code:error.code};throw error;}finally{await c.end();}}
try{
 await admin.connect();await admin.query('begin');
 for(let i=0;i<people.length;i++){await admin.query('insert into public.identities(id,firebase_uid) values($1,$2)',[people[i],uids[i]]);await admin.query('insert into public.wallets(user_id,balance) values($1,$2)',[people[i],i===0?50:0]);}
 for(let i=0;i<2;i++){await admin.query("insert into public.channels(id,firebase_id,owner_id,name,slug) values($1,$2,$3,'Concurrency fixture',$4)",[channels[i],uids[i+1],people[i+1],'fixture-'+channels[i]]);await admin.query("insert into public.lives(id,firebase_id,channel_id,owner_id,title,playback_url,status,started_at) values($1,$2,$3,$4,'Concurrency fixture','https://www.twitch.tv/test','live',now())",[lives[i],liveIds[i],channels[i],people[i+1]]);}
 await admin.query('commit');seeded=true;
 const keys=[randomUUID(),randomUUID()],result=await Promise.all([operation(0,40,keys[0]),operation(1,40,keys[1])]);
 assert.equal(result.filter(x=>x.ok).length,1);assert.equal(result.filter(x=>x.code==='insufficient_balance').length,1);
 const winner=result.find(x=>x.ok).index;
 assert.equal((await operation(winner,40,keys[winner])).replayed,true);
 checks.push('competing debits to different lives: one succeeds, one rejects; replay does not credit twice');
 const retryKey=randomUUID(),retry=await Promise.all([operation(winner,5,retryKey),operation(winner,5,retryKey)]);
 assert.equal(retry.filter(x=>x.replayed===false).length,1);assert.equal(retry.filter(x=>x.replayed===true).length,1);
 const balances=(await admin.query('select user_id,balance::text from public.wallets where user_id=any($1::uuid[])',[people])).rows;
 assert.equal(BigInt(balances.find(x=>x.user_id===people[0]).balance),5n);
 assert.equal(balances.reduce((n,x)=>n+BigInt(x.balance),0n),50n);assert.ok(balances.every(x=>BigInt(x.balance)>=0n));
 assert.equal((await admin.query('select count(*)::int as n from public.zy_coin_transactions where from_user_id=$1',[people[0]])).rows[0].n,2);
 checks.push('simultaneous duplicate request creates one debit/ledger row; conservation and non-negative balances');status='PASS';
}catch(error){console.log(JSON.stringify({status:'FAIL',code:error.code??error.name}));process.exitCode=1;}
finally{
 await admin.query('rollback').catch(()=>{});
 if(seeded){try{await admin.query('begin');await admin.query('delete from public.zy_coin_transactions where from_user_id=$1',[people[0]]);await admin.query('delete from public.channels where id=any($1::uuid[])',[channels]);await admin.query('delete from public.wallets where user_id=any($1::uuid[])',[people]);await admin.query('delete from public.identities where id=any($1::uuid[])',[people]);await admin.query('commit');cleanup=true;}catch(error){await admin.query('rollback').catch(()=>{});status='FAIL';process.exitCode=1;console.log(JSON.stringify({cleanup:'FAIL',code:error.code??error.name}));}}
 await admin.end();await writeFile(reportFile,JSON.stringify({status,checks,fixtures:cleanup?'REMOVED':seeded?'CLEANUP_REQUIRED':'NOT_COMMITTED'},null,2));
 console.log(JSON.stringify({status,checks:checks.length,fixtures:cleanup?'REMOVED':'NOT_COMMITTED'}));
}
