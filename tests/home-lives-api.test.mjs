import test from 'node:test';import assert from 'node:assert/strict';
import handler from '../api/home-lives.js';import {platformPool} from '../server/neon/platform-pool.mjs';
test('public feed fixes SQL, limits results, caches success and hides database failures',async()=>{
 process.env.DATABASE_URL='postgresql://zytrix_runtime:test@ep-test.neon.tech/neondb?sslmode=require';process.env.ZYTRIX_NEON_AUTH_URL='https://ep-test.neonauth.neon.tech/neondb/auth';
 const pool=platformPool(),query=pool.query;
 try{for(const scenario of ['ok','failure','post']){
  let calls=0;pool.query=async sql=>{calls++;assert.match(sql,/from public.live_feed/);assert.match(sql,/limit 40/);assert.doesNotMatch(sql,/users|wallets|neon_auth/);if(scenario==='failure')throw Error('sensitive_database_detail');return {rows:[]};};
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await handler({method:scenario==='post'?'POST':'GET'},res);
  assert.equal(res.code,scenario==='ok'?200:scenario==='post'?405:503);assert.equal(calls,scenario==='post'?0:1);
  if(scenario==='ok')assert.match(res.headers['Cache-Control'],/s-maxage=5/);if(scenario==='failure'){assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(res.body.error,'feed_unavailable');}
 }}finally{pool.query=query;await pool.end();}
});
