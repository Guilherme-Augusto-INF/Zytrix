import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackendSource} from '../assets/js/backend-source.js';
const response=value=>({ok:true,json:async()=>({postgresStaging:value})});
test('staging reads and writes never invoke Firebase, including API failure',async()=>{
 let calls=0;const source=createBackendSource({fetchImpl:async()=>{calls++;return response(true);}});
 const firebase=()=>{throw Error('Unexpected Firebase access');};
 assert.equal(await source.run(()=>42,firebase),42);
 await assert.rejects(source.run(()=>{throw Error('API unavailable');},firebase),/API unavailable/);
 assert.equal(calls,1);
});
test('invalid or unavailable configuration never invokes either backend',async()=>{
 for(const fetchImpl of [async()=>response(null),async()=>({ok:false})]){
 const source=createBackendSource({fetchImpl});let accessed=false;
 await assert.rejects(source.run(()=>{accessed=true;},()=>{accessed=true;}));assert.equal(accessed,false);
 }
});
test('production keeps Firebase subscription and releases it once stopped',async()=>{
 let released=0;const seen=[];const source=createBackendSource({fetchImpl:async()=>response(false)});
 const stop=source.watch({neon:()=>{throw Error('Unexpected Neon');},firebase:next=>{next('legacy');return ()=>released++;},onData:v=>seen.push(v)});
 await stop.ready;stop();assert.deepEqual(seen,['legacy']);assert.equal(released,1);
});
test('unsubscribe during pending staging request suppresses data and new timers',async()=>{
 let complete,started;const began=new Promise(r=>started=r);let timers=0,data=0;
 const source=createBackendSource({fetchImpl:async()=>response(true),setTimeoutImpl:()=>timers++});
 const stop=source.watch({neon:()=>{started();return new Promise(r=>complete=r);},firebase:()=>{throw Error('Unexpected Firebase');},onData:()=>data++});
 await began;stop();complete('private');await stop.ready;assert.equal(data,0);assert.equal(timers,0);
});
test('staging polling reports errors without opening a legacy listener',async()=>{
 let error;const source=createBackendSource({fetchImpl:async()=>response(true),setTimeoutImpl:()=>0,clearTimeoutImpl:()=>{}});
 const stop=source.watch({neon:async()=>{throw Error('unavailable');},firebase:()=>{throw Error('Unexpected Firebase');},onData:()=>assert.fail(),onError:e=>error=e});
 await stop.ready;stop();assert.equal(error.message,'unavailable');
});
