import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { executePlatform, ApiError } from '../server/neon/platform.mjs';
import { watchPublicLiveFeed } from '../assets/js/live-feed-source.js';

const sample = {
  id: 'firebase-stream-1', streamerUid: 'firebase-user-1',
  title: 'Teste', categoryId: 'Gaming', viewerCount: 3, username: 'Streamer',
  playbackURL: 'https://www.twitch.tv/example'
};
const config = enabled => ({ ok: true, async json() {return {postgresStaging:enabled};} });
const feed = rows => ({ ok: true, async json() {return {lives:rows};} });
test('public feed action reads the restricted SQL view without an identity', async () => {
  const sql = [];
  const client = { async query(statement) {
    sql.push(statement);
    return { rows: [sample], rowCount: 1 };
  }};
  assert.deepEqual((await executePlatform(client,null,'live.feed')).lives,[sample]);
  assert.equal(sql.length,1);
  assert.match(sql[0],/from public\.live_feed\b/);
  assert.doesNotMatch(sql[0],/from public\.lives\b/);
  await assert.rejects(executePlatform(client,null,'live.feed',{sql:'select 1'}), e => e instanceof ApiError && e.code==='invalid_input');
  assert.equal(sql.length,1);
});
test('Neon staging uses ONLY its feed and never opens a Firestore subscription', async () => {
  let firebaseCalls=0, schedule;
  const values=[];
  const errors=[];
  const stop=watchPublicLiveFeed({
    subscribeFirebase(){firebaseCalls++;throw Error('unexpected_firestore_access');},
    fetchImpl:async(url,options)=>{
      if(url==='/api/v1/config')return config(true);
      assert.equal(url,'/api/v1/platform');
      assert.equal(JSON.parse(options.body).action,'live.feed');
      return feed([sample]);
    },
    setIntervalImpl(callback){schedule=callback;return 123;},
    clearIntervalImpl(){},
    onData:items=>values.push(items),
    onError:error=>errors.push(error)
  });
  await stop.ready;
  assert.equal(firebaseCalls,0);
  assert.equal(values.length,1);
  assert.equal(values[0][0].id,sample.id);
  assert.equal(values[0][0].viewerCount,3);
  assert.equal(errors.length,0);
  assert.equal(typeof schedule,'function');
  stop();
});
test('non-staging preserves Firestore subscription, and cleans it up', async () => {
  let subscribed=0, stopped=0, requests=0, delivered;
  const stop=watchPublicLiveFeed({
    subscribeFirebase(next){subscribed++;delivered=next;return()=>stopped++;},
    fetchImpl:async()=>{requests++;return config(false);},
    onData() {}, onError() {}
  });
  await stop.ready;
  assert.equal(subscribed,1);
  assert.equal(requests,1);
  delivered([sample]);
  stop();
  assert.equal(stopped,1);
});
test('staging API errors never silently fall back to Firestore', async () => {
  let subscribed=0,errored=0;
  const stop=watchPublicLiveFeed({
    subscribeFirebase(){subscribed++;},
    fetchImpl:async(url)=>url==='/api/v1/config'?config(true):{ok:false},
    onData(){throw Error('unexpected data');},
    onError(){errored++;}
  });
  await stop.ready;
  assert.equal(subscribed,0);
  assert.equal(errored,1);
  stop();
});
test('invalid staging config fails closed', async () => {
  let subscribed=0,errored=0;
  const stop=watchPublicLiveFeed({
    subscribeFirebase(){subscribed++;},
    fetchImpl:async()=>({ok:true,async json(){return {};} }),
    onData(){},
    onError(){errored++;}
  });
  await stop.ready;
  assert.equal(subscribed,0);
  assert.equal(errored,1);
  stop();
});

test('all four public listing screens share the guarded live feed adapter', async () => {
  for (const page of ['home','ao-vivo','categoria','explorar']) {
    const source=await readFile(new URL('../assets/js/'+page+'.js',import.meta.url),'utf8');
    assert.match(source,/watchPublicLiveFeed\(/,page);
    assert.match(source,/subscribeFirebase:/,page);
  }
});
