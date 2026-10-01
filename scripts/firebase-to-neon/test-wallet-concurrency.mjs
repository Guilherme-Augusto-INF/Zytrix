// Dedicated staging fixtures; owner only provisions/removes them. Operations use app credentials.
import pg from 'pg';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {validateStagingUrl} from './staging-target.mjs';import {executePlatform} from '../../server/neon/platform.mjs';
import {fulfillSandboxEvent} from '../../server/neon/payments.mjs';
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
 checks.push('simultaneous duplicate request creates one debit/ledger row; conservation and non-negative balances');
 const totals=(await admin.query('select total_sent,total_received from public.wallets where user_id=$1',[people[0]])).rows[0];assert.equal(totals.total_sent,'45');assert.equal(totals.total_received,'0');
 assert.equal(BigInt((await admin.query('select sum(total_received)::text as n from public.wallets where user_id=any($1::uuid[])',[people])).rows[0].n),45n);checks.push('totalSent/totalReceived equal completed support ledger');
 assert.equal((await operation(winner,6,randomUUID())).code,'insufficient_balance');
 const order=randomUUID(),session='cs_test_'+randomUUID(),intent='pi_'+randomUUID();
 await admin.query("insert into public.zy_coin_orders(id,user_id,package_id,coins,price_cents,payment_method,mode,idempotency_key,provider_reference) values($1,$2,'zy100',100,490,'card','payment_provider',$3,$4)",[order,people[0],'sandbox-checkout:'+randomUUID(),session]);
 const event={id:'evt_'+randomUUID(),livemode:false,type:'checkout.session.completed',data:{object:{id:session,payment_intent:intent,livemode:false,mode:'payment',payment_status:'paid',currency:'brl',amount_total:490,client_reference_id:order,metadata:{zytrixOrderId:order}}}};
 async function webhook(value,failAfterCredit=false){const c=new pg.Client(runtimeConfig);try{await c.connect();await c.query('begin');if(failAfterCredit){const query=c.query.bind(c);c.query=async(sql,args)=>{const r=await query(sql,args);if(sql.startsWith('update public.wallets set balance=balance+'))throw Error('fixture_intermediate_failure');return r;};}const result=await fulfillSandboxEvent(c,value);await c.query('commit');return result;}catch(e){await c.query('rollback').catch(()=>{});throw e;}finally{await c.end();}}
 await assert.rejects(webhook(event,true),/fixture_intermediate_failure/);assert.equal((await admin.query('select balance from public.wallets where user_id=$1',[people[0]])).rows[0].balance,'5');checks.push('intermediate webhook failure rolls back wallet/order/ledger/event');
 for(const patch of [{amount_total:1},{client_reference_id:randomUUID()},{id:'cs_test_wrong'},{currency:'usd'}])await assert.rejects(webhook({...event,data:{object:{...event.data.object,...patch}}}),e=>e.code==='payment_mismatch');checks.push('tampered amount/user/order/session/currency rejected');
 const fulfilled=await Promise.all([webhook(event),webhook(event),webhook({...event,id:'evt_'+randomUUID()})]);assert.equal(fulfilled.filter(x=>x.credited).length,1);assert.equal(fulfilled.filter(x=>x.replayed).length,2);
 assert.equal((await admin.query('select balance from public.wallets where user_id=$1',[people[0]])).rows[0].balance,'105');checks.push('concurrent duplicate/distinct Stripe events credit once');
 assert.equal((await webhook(event)).replayed,true);checks.push('processed-order and event replay do not alter ledger');
 const refund={id:'evt_'+randomUUID(),livemode:false,type:'charge.refunded',data:{object:{id:'ch_'+randomUUID(),payment_intent:intent,livemode:false,currency:'brl',amount:490,amount_refunded:490}}};
 const refunded=await Promise.all([webhook(refund),webhook(refund)]);assert.equal(refunded.filter(x=>x.refunded).length,1);assert.equal((await admin.query('select balance from public.wallets where user_id=$1',[people[0]])).rows[0].balance,'5');checks.push('full refund concurrent replay is atomic and nonnegative');
 assert.equal((await admin.query('select count(*)::int as n from public.zy_coin_transactions where order_id=$1',[order])).rows[0].n,2);status='PASS';
}catch(error){console.log(JSON.stringify({status:'FAIL',code:error.code??error.name}));process.exitCode=1;}
finally{
 await admin.query('rollback').catch(()=>{});
 if(seeded){try{await admin.query('begin');await admin.query('delete from private.payment_refunds where order_id in(select id from public.zy_coin_orders where user_id=any($1::uuid[]))',[people]);await admin.query('delete from private.payment_events where order_id in(select id from public.zy_coin_orders where user_id=any($1::uuid[]))',[people]);await admin.query('delete from public.zy_coin_transactions where from_user_id=any($1::uuid[]) or to_user_id=any($1::uuid[])',[people]);await admin.query('delete from public.zy_coin_orders where user_id=any($1::uuid[])',[people]);await admin.query('delete from public.channels where id=any($1::uuid[])',[channels]);await admin.query('delete from public.wallets where user_id=any($1::uuid[])',[people]);await admin.query('delete from public.identities where id=any($1::uuid[])',[people]);await admin.query('commit');cleanup=true;}catch(error){await admin.query('rollback').catch(()=>{});status='FAIL';process.exitCode=1;console.log(JSON.stringify({cleanup:'FAIL',code:error.code??error.name}));}}
 await admin.end();await writeFile(reportFile,JSON.stringify({status,checks,fixtures:cleanup?'REMOVED':seeded?'CLEANUP_REQUIRED':'NOT_COMMITTED'},null,2));
 console.log(JSON.stringify({status,checks:checks.length,fixtures:cleanup?'REMOVED':'NOT_COMMITTED'}));
}
